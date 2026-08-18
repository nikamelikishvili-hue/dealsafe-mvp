import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const storageCallPattern =
  /(?:window\.)?(localStorage|sessionStorage)\.([A-Za-z_$][\w$]*)\s*\(/g;
const approvedMethods = new Set(['getItem', 'setItem', 'removeItem']);
const forbiddenBrowserPersistencePattern = /\b(?:document\.cookie|indexedDB)\b/;

const reviewedStorageSites = new Map([
  ['src/app.tsx', {
    localStorage: 5,
    sessionStorage: 0,
    required: [
      "guestCreateDraftKey='dealivra:guest-create-draft:v2'",
      "legacyGuestCreateDraftKey='dealivra:guest-create-draft:v1'",
      'guestCreateDraftLifetime=24*60*60*1000',
      'guestCreateDraftMaximumBytes=16*1024',
      "serialNumber:''",
    ],
  }],
  ['src/i18nFull.ts', {
    localStorage: 5,
    sessionStorage: 0,
    required: [
      "languageKey='dealivra_language'",
      'localStorage.removeItem(legacyLanguageKey)',
    ],
  }],
  ['src/main.tsx', {
    localStorage: 2,
    sessionStorage: 1,
    required: [
      "localStorage.removeItem('dealsafe_session')",
      "sessionStorage.removeItem('dealivra_session_v2')",
      "localStorage.getItem('dealivra_session_hint_v1')",
    ],
  }],
  ['src/services/supabaseRest.ts', {
    localStorage: 6,
    sessionStorage: 2,
    required: [
      "legacyBrowserSessionStorageKey = 'dealivra_session_v2'",
      "sessionHintStorageKey = 'dealivra_session_hint_v1'",
      'let activeSession: StoredSession | null = null',
      'localStorage.setItem(sessionHintStorageKey',
      'sessionStorage.removeItem(legacyBrowserSessionStorageKey)',
      'localStorage.removeItem(legacySessionStorageKey)',
    ],
    forbidden: ['sessionStorage.setItem(', 'localStorage.setItem(legacySessionStorageKey'],
  }],
]);

function fail(message) {
  throw new Error(`Browser storage policy rejected: ${message}`);
}

function collectSourceFiles(directory, workspaceRoot, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath, workspaceRoot, files);
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) continue;
    files.push(relative(workspaceRoot, absolutePath).replaceAll('\\', '/'));
  }
  return files;
}

export function verifyBrowserStoragePolicy(workspaceRoot) {
  const observedSites = new Map();
  const sourceRoot = join(workspaceRoot, 'src');

  for (const file of collectSourceFiles(sourceRoot, workspaceRoot)) {
    const source = readFileSync(join(workspaceRoot, file), 'utf8');
    if (forbiddenBrowserPersistencePattern.test(source)) {
      fail(`${file} contains unreviewed persistent browser state`);
    }

    const calls = [...source.matchAll(storageCallPattern)];
    if (calls.length === 0) continue;
    const counts = { localStorage: 0, sessionStorage: 0 };
    for (const call of calls) {
      const storage = call[1];
      const method = call[2];
      if (!approvedMethods.has(method)) {
        fail(`${file} uses unreviewed ${storage}.${method}`);
      }
      counts[storage] += 1;
    }
    observedSites.set(file, counts);
  }

  for (const [file, counts] of observedSites) {
    const review = reviewedStorageSites.get(file);
    if (!review) fail(`${file} contains unreviewed browser storage`);
    for (const storage of ['localStorage', 'sessionStorage']) {
      if (counts[storage] !== review[storage]) {
        fail(`${file} contains ${counts[storage]} ${storage} calls; expected ${review[storage]}`);
      }
    }
  }

  for (const [file, review] of reviewedStorageSites) {
    const counts = observedSites.get(file);
    if (
      !counts
      || counts.localStorage !== review.localStorage
      || counts.sessionStorage !== review.sessionStorage
    ) {
      fail(`${file} is missing its exact reviewed browser-storage inventory`);
    }
    const source = readFileSync(join(workspaceRoot, file), 'utf8');
    for (const required of review.required) {
      if (!source.includes(required)) {
        fail(`${file} is missing a reviewed browser-storage control`);
      }
    }
    for (const forbidden of review.forbidden ?? []) {
      if (source.includes(forbidden)) {
        fail(`${file} contains forbidden persistent session storage`);
      }
    }
  }

  return {
    schema: 'dealivra.browser-storage-policy-result.v1',
    status: 'passed',
    reviewed_files: observedSites.size,
    local_storage_calls: [...observedSites.values()]
      .reduce((total, counts) => total + counts.localStorage, 0),
    session_storage_calls: [...observedSites.values()]
      .reduce((total, counts) => total + counts.sessionStorage, 0),
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const workspaceRoot = resolve(currentFile, '..', '..');
  console.log(JSON.stringify(verifyBrowserStoragePolicy(workspaceRoot)));
}
