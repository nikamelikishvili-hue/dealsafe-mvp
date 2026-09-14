import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBoundedResponseText } from '../server/responseBodyBoundary.mjs';
import { runStagingHttpAuthorizationMatrix } from './run-staging-http-authorization-matrix.mjs';

const stagingRef = 'itlwbzjtijxiggjyetjl';
const productionRef = 'zbjtttdcsbnfzbpvhzfb';
const baseUrl = 'https://' + stagingRef + '.supabase.co';
const fixtures = ['seller', 'buyer', 'outsider'].map((role, index) => ({
  role,
  id: '00000000-0000-4000-8000-00000000010' + (index + 2),
  email: 'staging-' + role + '@dealivra.invalid',
}));
const dealId = '00000000-0000-4000-8000-000000000201';
const origin = 'https://dealivra.com';

function requireCondition(condition) {
  if (!condition) throw new Error('Staging fixture authentication proof rejected.');
}

export async function runFixtureAuthProof({
  env = process.env,
  fetchImplementation = fetch,
  now = Date.now,
  sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms)),
  emit = value => process.stdout.write(JSON.stringify(value) + '\n'),
  matrix = runStagingHttpAuthorizationMatrix,
} = {}) {
  requireCondition(env.DEALIVRA_DATABASE_ENVIRONMENT === 'staging'
    && env.DEALIVRA_STAGING_SUPABASE_PROJECT_REF === stagingRef
    && env.DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF === productionRef
    && typeof env.SUPABASE_ACCESS_TOKEN === 'string'
    && env.SUPABASE_ACCESS_TOKEN.length >= 20);

  // No remote body, credential, identity, or arbitrary exception is logged.
  let phase = 'key-discovery';
  let publicKey;
  let serviceKey;
  const sessions = [];
  let cleanupPassed = true;
  let passed = false;
  const request = async (url, key, body, token, method = 'POST') => {
    requireCondition(url.startsWith(baseUrl + '/')
      || url === 'https://api.supabase.com/v1/projects/' + stagingRef + '/api-keys?reveal=true');
    const response = await fetchImplementation(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        ...(key ? { apikey: key } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
        Origin: origin,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await readBoundedResponseText(response, 65536);
    requireCondition(response.ok);
    return text ? JSON.parse(text) : null;
  };
  const sessionClaims = (session, fixture) => {
    requireCondition(typeof session?.access_token === 'string'
      && typeof session.refresh_token === 'string'
      && session.user?.id === fixture.id);
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
    requireCondition(claims.sub === fixture.id && claims.iss === baseUrl + '/auth/v1'
      && claims.role === 'authenticated' && claims.aud === 'authenticated'
      && Number.isSafeInteger(claims.exp) && claims.exp * 1000 > now());
    return claims;
  };

  try {
    const keys = await request('https://api.supabase.com/v1/projects/' + stagingRef + '/api-keys?reveal=true',
      null, undefined, env.SUPABASE_ACCESS_TOKEN, 'GET');
    requireCondition(Array.isArray(keys));
    publicKey = keys.find(key => key.type === 'publishable' && !key.disabled)?.api_key;
    serviceKey = keys.find(key => key.name === 'service_role' && key.type === 'legacy' && !key.disabled)?.api_key;
    requireCondition(/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(publicKey ?? '')
      && typeof serviceKey === 'string');
    const serviceClaims = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url'));
    requireCondition(serviceClaims.role === 'service_role' && serviceClaims.ref === stagingRef);

    phase = 'existing-fixture-preflight';
    // Check all existing users before generating links, which can otherwise create users.
    for (const fixture of fixtures) {
      const user = await request(baseUrl + '/auth/v1/admin/users/' + fixture.id,
        serviceKey, undefined, serviceKey, 'GET');
      requireCondition(user.id === fixture.id && user.email === fixture.email && user.email_confirmed_at);
    }

    phase = 'fixture-login';
    for (const fixture of fixtures) {
      // Admin generate_link does not send email. Never call the email-sending OTP API.
      const link = await request(baseUrl + '/auth/v1/admin/generate_link', serviceKey,
        { type: 'magiclink', email: fixture.email }, serviceKey);
      requireCondition(link.id === fixture.id && link.email === fixture.email
        && typeof link.hashed_token === 'string');
      const session = await request(baseUrl + '/auth/v1/verify', publicKey,
        { type: 'email', token_hash: link.hashed_token });
      // Register returned sessions for cleanup even if claim validation fails.
      sessions.push(session);
      sessionClaims(session, fixture);
    }
    // Privileged credentials never reach the role/Storage matrix.
    serviceKey = undefined;

    phase = 'participant-preflight';
    for (let index = 0; index < fixtures.length; index += 1) {
      const rows = await request(baseUrl + '/rest/v1/rpc/get_deal_action_plan', publicKey,
        { p_deal_id: dealId }, sessions[index].access_token);
      requireCondition(Array.isArray(rows) && (index === 2 ? rows.length === 0
        : rows.length === 1 && rows[0].viewer_role === fixtures[index].role
          && rows[0].deal_status === 'accepted'));
    }

    const expiredToken = sessions[0].access_token;
    const expiry = sessionClaims(sessions[0], fixtures[0]).exp * 1000;
    requireCondition(expiry - now() <= 70 * 60 * 1000);
    phase = 'natural-expiry-wait';
    // Allow the JWT verifier's clock tolerance too; never modify JWTs or project TTL.
    const resumeAt = expiry + 90_000;
    emit({ phase, participant_preflight: 'passed', resume_at: new Date(resumeAt).toISOString() });
    while (now() < resumeAt) await sleep(Math.min(30_000, resumeAt - now()));

    phase = 'refresh-participants';
    for (let index = 0; index < sessions.length; index += 1) {
      sessions[index] = await request(baseUrl + '/auth/v1/token?grant_type=refresh_token', publicKey,
        { refresh_token: sessions[index].refresh_token });
      sessionClaims(sessions[index], fixtures[index]);
    }
    phase = 'http-matrix';
    const result = await matrix({
      environment: 'staging', stagingProjectRef: stagingRef, productionProjectRef: productionRef,
      supabaseUrl: baseUrl, publishableKey: publicKey, origin, dealId,
      sellerToken: sessions[0].access_token, buyerToken: sessions[1].access_token,
      outsiderToken: sessions[2].access_token, expiredToken,
    });
    emit(result);
    passed = result.passed;
  } catch {
    emit({ phase, outcome: 'failed' });
  } finally {
    // Only this run's synthetic sessions; never global sign-out or account deletion.
    for (const session of sessions) {
      try {
        requireCondition(typeof session?.access_token === 'string');
        await request(baseUrl + '/auth/v1/logout?scope=local', publicKey, undefined, session.access_token);
      } catch {
        cleanupPassed = false;
      }
    }
    serviceKey = undefined;
    sessions.length = 0;
  }
  emit({ phase: 'complete', passed: passed && cleanupPassed, session_cleanup: cleanupPassed ? 'passed' : 'failed' });
  return passed && cleanupPassed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runFixtureAuthProof().then(passed => { if (!passed) process.exitCode = 1; }).catch(() => {
    process.stderr.write('Staging fixture authentication proof rejected before requests.\n');
    process.exitCode = 1;
  });
}
