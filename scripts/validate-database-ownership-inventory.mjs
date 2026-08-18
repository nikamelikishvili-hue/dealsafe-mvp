const allowedKinds = new Set(['table', 'view', 'function', 'bucket', 'policy', 'grant']);
const allowedStewards = new Set([
  'platform_engineering',
  'database_security',
  'identity_security',
  'finance_security',
  'trust_safety_security',
]);
const forbiddenOwners = new Set(['anon', 'authenticated', 'service_role', 'PUBLIC']);

function reject(message) {
  throw new Error(`Database ownership inventory rejected: ${message}`);
}

export function validateDatabaseOwnershipInventory(records) {
  if (!Array.isArray(records) || records.length < 1) reject('the inventory is empty.');
  const identities = new Set();
  const counts = Object.fromEntries([...allowedKinds].map(kind => [kind, 0]));
  for (const record of records) {
    if (record?.schema !== 'dealivra.database-ownership-object.v1') reject('an unknown record schema was returned.');
    if (!allowedKinds.has(record.kind)) reject('an unknown object kind was returned.');
    if (typeof record.identity !== 'string' || record.identity.length < 3 || record.identity.length > 512) reject('an object identity is invalid.');
    const key = `${record.kind}:${record.identity}`;
    if (identities.has(key)) reject('a duplicate object identity was returned.');
    identities.add(key);
    if (typeof record.owner_role !== 'string' || forbiddenOwners.has(record.owner_role)) reject('an object has an unsafe owner role.');
    if (typeof record.exposure !== 'string' || record.exposure.length < 1 || record.exposure.length > 128) reject('an object exposure is invalid.');
    if (!allowedStewards.has(record.steward)) reject('an object has no reviewed steward.');
    counts[record.kind] += 1;
  }
  for (const kind of allowedKinds) {
    if (counts[kind] < 1) reject(`${kind} objects are missing.`);
  }
  return {
    schema: 'dealivra.database-ownership-inventory.v1',
    status: 'passed',
    object_count: records.length,
    counts,
  };
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const records = input.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  process.stdout.write(`${JSON.stringify(validateDatabaseOwnershipInventory(records))}\n`);
}

if (process.argv[1]?.endsWith('validate-database-ownership-inventory.mjs')) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Database ownership inventory failed.'}\n`);
    process.exitCode = 1;
  });
}
