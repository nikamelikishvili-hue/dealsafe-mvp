import assert from 'node:assert/strict';
import test from 'node:test';
import { runStagingHttpAuthorizationMatrix } from '../scripts/run-staging-http-authorization-matrix.mjs';

const stagingRef = 'a'.repeat(20);
const productionRef = 'b'.repeat(20);
const baseUrl = `https://${stagingRef}.supabase.co`;
const subjects = {
  seller: '00000000-0000-4000-8000-000000000001',
  buyer: '00000000-0000-4000-8000-000000000002',
  outsider: '00000000-0000-4000-8000-000000000003',
  expired: '00000000-0000-4000-8000-000000000004',
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenFor = (role, overrides = {}) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: subjects[role],
  role: 'authenticated',
  aud: 'authenticated',
  iss: `${baseUrl}/auth/v1`,
  exp: Math.floor(Date.now() / 1000) + (role === 'expired' ? -600 : 3600),
  ...overrides,
})}.${Buffer.from('synthetic-test-signature').toString('base64url')}`;
const tokens = Object.fromEntries(Object.keys(subjects).map(role => [role, tokenFor(role)]));
const options = () => ({
  environment: 'staging',
  stagingProjectRef: stagingRef,
  productionProjectRef: productionRef,
  supabaseUrl: baseUrl,
  publishableKey: `sb_publishable_${'synthetic_fixture'.repeat(2)}`,
  origin: 'https://preview.dealivra.test',
  dealId: '00000000-0000-4000-8000-000000000010',
  sellerToken: tokens.seller,
  buyerToken: tokens.buyer,
  outsiderToken: tokens.outsider,
  expiredToken: tokens.expired,
});
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' },
});
const plan = viewerRole => [{
  viewer_role: viewerRole,
  deal_status: 'accepted',
  meeting_status: null,
  seller_arrived: false,
  buyer_arrived: false,
  handoff_code_ready: false,
  shipment_status: null,
  inspection_recorded: false,
  rating_submitted: false,
  delivery_address_ready: false,
  payment_method_recorded: false,
  payment_method_confirmed: false,
  payment_marked_sent: false,
  payment_received: false,
}];

function provider(hook = () => undefined) {
  const objects = new Set();
  const calls = [];
  const deletions = [];
  const fetchImplementation = async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, baseUrl);
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new Headers(init.headers).get('apikey'), options().publishableKey);
    assert.equal(new Headers(init.headers).get('origin'), options().origin);
    const token = new Headers(init.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    const role = Object.keys(tokens).find(name => tokens[name] === token) ?? 'anonymous';
    const method = init.method;
    const isRpc = parsed.pathname === '/rest/v1/rpc/get_deal_action_plan';
    const isList = parsed.pathname === '/storage/v1/object/list/deal-media';
    const kind = isRpc ? 'rpc' : isList ? 'list' : method === 'DELETE' ? 'delete' : 'upload';
    const body = kind === 'upload' ? null : JSON.parse(init.body);
    const path = kind === 'upload' ? decodeURIComponent(parsed.pathname.replace('/storage/v1/object/deal-media/', '')) : null;
    const call = { kind, role, method, path, body, signal: init.signal };
    calls.push(call);
    if (kind === 'rpc') {
      assert.equal(method, 'POST');
      assert.deepEqual(body, { p_deal_id: options().dealId });
    }
    if (kind === 'upload') {
      assert.equal(method, 'POST');
      assert.equal(new Headers(init.headers).get('x-upsert'), 'false');
      const owner = ['outsider', 'expired', 'anonymous'].includes(role) ? subjects.seller : subjects[role];
      assert.match(path, new RegExp(`^${owner}/dat003-[a-f0-9-]+\\.png$`));
    }
    if (kind === 'list') {
      assert.equal(method, 'POST');
      assert.equal(body.prefix, subjects[role]);
      assert.equal(body.limit, 2);
      assert.equal(body.offset, 0);
    }
    const normal = () => {
      if (kind === 'rpc') {
        if (role === 'seller' || role === 'buyer') return json(plan(role));
        return role === 'outsider' ? json([]) : json({ code: '42501' }, 401);
      }
      if (kind === 'list') {
        return json([...objects].filter(value => value.startsWith(`${body.prefix}/`) && value.split('/').at(-1) === body.search)
          .map(value => ({ name: value.split('/').at(-1), id: subjects.seller, metadata: { size: 68 } })));
      }
      if (kind === 'delete') {
        assert.equal(parsed.pathname, '/storage/v1/object/deal-media');
        assert.equal(body.prefixes.length, 1);
        for (const prefix of body.prefixes) {
          assert.match(prefix, new RegExp(`^${subjects[role]}/dat003-[a-f0-9-]+\\.png$`));
          deletions.push(prefix);
          objects.delete(prefix);
        }
        return json([]);
      }
      if (role === 'outsider') return json({ code: 'AccessDenied' }, 403);
      if (role === 'expired' || role === 'anonymous') return json({ code: 'InvalidJWT' }, 401);
      assert.match(path, new RegExp(`^${subjects[role]}/dat003-[a-f0-9-]+\\.png$`));
      objects.add(path);
      return json({ Key: `deal-media/${path}` }, 200);
    };
    return (await hook({ ...call, objects, normal })) ?? normal();
  };
  return { fetchImplementation, objects, calls, deletions };
}

const run = (fixture, overrides = {}) => runStagingHttpAuthorizationMatrix({ ...options(), fetchImplementation: fixture.fetchImplementation, ...overrides });
const row = (report, surface) => report.results.find(result => result.surface === surface);

test('Staging HTTP matrix rejects mixed targets and invalid credentials before network access', async () => {
  const cases = [
    { environment: undefined }, { environment: 'production' },
    { stagingProjectRef: productionRef }, { productionProjectRef: stagingRef },
    { productionProjectRef: '' }, { stagingProjectRef: ` ${stagingRef}` },
    { supabaseUrl: `https://${productionRef}.supabase.co` },
    { supabaseUrl: `${baseUrl}/unexpected` }, { supabaseUrl: 'not-an-origin' },
    { supabaseUrl: `${baseUrl}?credential=do-not-print` },
    { origin: 'https://operator:do-not-print@preview.dealivra.test' },
    { publishableKey: 'arbitrary-nonempty-key' },
    { publishableKey: `sb_secret_${'synthetic'.repeat(6)}` },
    { publishableKey: tokenFor('seller', { role: 'service_role' }) },
    { sellerToken: tokenFor('seller', { exp: undefined }) },
    { sellerToken: tokenFor('seller', { exp: '4102444800' }) },
    { sellerToken: tokenFor('seller', { exp: 0 }) },
    { sellerToken: tokenFor('seller', { iss: `https://${productionRef}.supabase.co/auth/v1` }) },
    { sellerToken: tokenFor('seller', { aud: 'other' }) },
    { sellerToken: tokenFor('seller', { role: 'service_role' }) },
    { sellerToken: ` ${tokens.seller}` }, { sellerToken: 'x'.repeat(8193) },
    { buyerToken: tokens.seller }, { expiredToken: tokens.seller },
  ];
  for (const invalid of cases) {
    const fixture = provider();
    await assert.rejects(run(fixture, invalid), error => {
      assert.doesNotMatch(error.message, /do-not-print|sb_secret_|https:|Bearer/);
      return true;
    });
    assert.equal(fixture.calls.length, 0);
  }
});

test('Staging HTTP matrix passes valid isolated role checks and proves both probes absent', async () => {
  const fixture = provider();
  const report = await run(fixture);
  assert.equal(report.passed, true);
  assert.equal(report.schema, 'dealivra.staging-http-authorization-matrix.v1');
  assert.equal(fixture.objects.size, 0);
  assert.equal(new Set(fixture.deletions).size, 2);
  assert.equal(row(report, 'Storage cleanup').outcome, 'PASS');
  for (const role of ['seller', 'buyer']) {
    const uploads = fixture.calls.findIndex(call => call.kind === 'upload' && call.role === role);
    const deletion = fixture.calls.findIndex(call => call.kind === 'delete' && call.role === role);
    assert.ok(fixture.calls.slice(uploads + 1, deletion).some(call => call.kind === 'list' && call.role === role));
    assert.ok(fixture.calls.slice(deletion + 1).some(call => call.kind === 'list' && call.role === role));
  }
  const serialized = JSON.stringify(report);
  for (const value of [...Object.values(subjects), ...Object.values(tokens), options().dealId, options().publishableKey]) {
    assert.equal(serialized.includes(value), false);
  }
  assert.doesNotMatch(serialized, /dat003-|viewer_role|storage\/v1|synthetic-test-signature/);
});

test('Staging HTTP matrix never treats provider failures as cross-user denial', async () => {
  for (const status of [400, 404, 409, 429, 500, 502, 503]) {
    const fixture = provider(call => call.kind === 'upload' && call.role === 'outsider' ? json({ code: 'InternalError' }, status) : undefined);
    const report = await run(fixture);
    assert.equal(report.passed, false, `status ${status}`);
    assert.equal(row(report, 'Storage outsider cross-user upload').outcome, 'FAIL');
    assert.equal(fixture.objects.size, 0);
  }
});

test('Staging HTTP matrix recognizes only reviewed legacy Storage authorization errors', async () => {
  for (const code of ['AccessDenied', 'unauthorized', '42501']) {
    const fixture = provider(call => call.kind === 'upload' && call.role === 'outsider' ? json({ code }, 400) : undefined);
    assert.equal((await run(fixture)).passed, true);
  }
});

test('Staging HTTP matrix rejects malformed, wrong-role, or unbounded Data API success', async () => {
  const responses = [
    () => new Response('', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('not-json', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('<h1>Provider error</h1>', { headers: { 'Content-Type': 'text/html' } }),
    () => json({}), () => json(null), () => json([]), () => json(plan('buyer')),
    () => json([ ...plan('seller'), ...plan('seller') ]),
    () => json([{ ...plan('seller')[0], deal_status: 'not-a-deal-state' }]),
    () => json([{ ...plan('seller')[0], deal_status: undefined }]),
    () => new Response(`${JSON.stringify(plan('seller'))}${' '.repeat(70_000)}`, { headers: { 'Content-Type': 'application/json' } }),
  ];
  for (const response of responses) {
    const fixture = provider(call => call.kind === 'rpc' && call.role === 'seller' ? response() : undefined);
    const report = await run(fixture);
    assert.equal(report.passed, false);
    assert.equal(row(report, 'Data API seller').outcome, 'FAIL');
    assert.equal(fixture.calls.some(call => call.kind !== 'rpc'), false);
  }
  for (const value of [null, {}, plan('seller')]) {
    const fixture = provider(call => call.kind === 'rpc' && call.role === 'outsider' ? json(value) : undefined);
    assert.equal((await run(fixture)).passed, false);
    assert.equal(fixture.calls.some(call => call.kind !== 'rpc'), false);
  }
});

test('Staging HTTP matrix cleans potential writes after interrupted or unreadable uploads', async () => {
  for (const mode of ['throw-after-write', 'unreadable-after-write', 'throw-before-write']) {
    const fixture = provider(call => {
      if (call.kind !== 'upload' || call.role !== 'buyer') return undefined;
      if (mode !== 'throw-before-write') call.normal();
      if (mode === 'unreadable-after-write') {
        return new Response(new ReadableStream({ start(controller) { controller.error(new Error('private provider failure')); } }));
      }
      throw new Error(`private provider failure ${tokens.buyer}`);
    });
    const report = await run(fixture);
    assert.equal(report.passed, false);
    assert.equal(fixture.objects.size, 0);
    assert.equal(new Set(fixture.deletions).size, 2);
    assert.doesNotMatch(JSON.stringify(report), /private provider failure/);
    assert.equal(JSON.stringify(report).includes(tokens.buyer), false);
  }
});

test('Staging HTTP matrix cleans an unexpected cross-user write without passing it', async () => {
  const fixture = provider(call => {
    if (call.kind === 'upload' && call.role === 'outsider') {
      call.objects.add(call.path);
      return json({ Key: call.path });
    }
    return undefined;
  });
  const report = await run(fixture);
  assert.equal(report.passed, false);
  assert.equal(row(report, 'Storage outsider cross-user upload').outcome, 'FAIL');
  assert.equal(fixture.objects.size, 0);
  assert.equal(new Set(fixture.deletions).size, 2);
});

test('Staging HTTP matrix attempts both cleanups and fails when deletion or absence is unproven', async () => {
  for (const mode of ['delete-throws', 'delete-lies', 'list-fails', 'list-hides']) {
    const fixture = provider(call => {
      if (call.kind === 'delete' && call.role === 'seller') {
        if (mode === 'delete-throws') throw new Error('private cleanup error');
        if (mode === 'delete-lies') return json([]);
      }
      if (call.kind === 'list') {
        if (mode === 'list-fails') return json({ code: 'InternalError' }, 500);
        if (mode === 'list-hides') return json([]);
      }
      return undefined;
    });
    const report = await run(fixture);
    assert.equal(report.passed, false, mode);
    assert.equal(row(report, 'Storage cleanup').outcome, 'FAIL', mode);
    assert.equal(fixture.calls.filter(call => call.kind === 'delete').length, 2, mode);
    assert.doesNotMatch(JSON.stringify(report), /private cleanup error/);
  }
});

test('Staging HTTP matrix cannot claim uncertain writes absent behind deny-all listings', async () => {
  const fixture = provider(call => {
    if (call.role !== 'buyer') return undefined;
    if (call.kind === 'upload') {
      call.normal();
      throw new Error('private interrupted write');
    }
    if (call.kind === 'list' || call.kind === 'delete') return json([]);
    return undefined;
  });
  const report = await run(fixture);
  assert.equal(report.passed, false);
  assert.equal(fixture.objects.size, 1);
  assert.equal(row(report, 'Storage cleanup').outcome, 'FAIL');
  assert.equal(fixture.calls.filter(call => call.kind === 'delete').length, 2);
  assert.doesNotMatch(JSON.stringify(report), /private interrupted write/);
});

test('Staging HTTP matrix bounds stalled uploads and still runs cleanup', async () => {
  const fixture = provider(call => {
    if (call.kind === 'upload' && call.role === 'buyer') {
      call.normal();
      return new Promise((resolve, reject) => {
        call.signal.addEventListener('abort', () => reject(new Error('private timeout')), { once: true });
      });
    }
    return undefined;
  });
  const report = await run(fixture, { requestTimeoutMs: 25 });
  assert.equal(report.passed, false);
  assert.equal(fixture.objects.size, 0);
  assert.equal(fixture.calls.filter(call => call.kind === 'delete').length, 2);
  assert.doesNotMatch(JSON.stringify(report), /private timeout/);
});

test('Staging HTTP matrix bounds a stalled response body after a write and runs cleanup', { timeout: 2000 }, async () => {
  let bodyCancelled = false;
  const fixture = provider(call => {
    if (call.kind !== 'upload' || call.role !== 'buyer') return undefined;
    call.normal();
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
      cancel() { bodyCancelled = true; },
    }), { headers: { 'Content-Type': 'application/json' } });
  });
  const report = await run(fixture, { requestTimeoutMs: 25 });
  assert.equal(report.passed, false);
  assert.equal(bodyCancelled, true);
  assert.equal(fixture.objects.size, 0);
  assert.equal(fixture.calls.filter(call => call.kind === 'delete').length, 2);
});
