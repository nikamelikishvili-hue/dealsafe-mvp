import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ignoredDirectories = new Set([
  '.git',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
]);

const textExtensions = new Set([
  '',
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const maximumFileSizeBytes = 2 * 1024 * 1024;

export const secretRules = [
  {
    name: 'Private key material',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  },
  {
    name: 'GitHub access token',
    pattern: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/,
  },
  {
    name: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  },
  {
    name: 'Stripe secret key',
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/,
  },
  {
    name: 'Stripe webhook secret',
    pattern: /\bwhsec_[A-Za-z0-9]{20,}\b/,
  },
  {
    name: 'Supabase secret key',
    pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
  },
  {
    name: 'AWS access key',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    name: 'Slack access token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  },
];

export function scanText(text) {
  return secretRules
    .filter(rule => rule.pattern.test(text))
    .map(rule => rule.name);
}

function collectTextFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collectTextFiles(absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = extname(entry.name).toLowerCase();
    if (!textExtensions.has(extension)) continue;
    if (statSync(absolutePath).size > maximumFileSizeBytes) continue;
    files.push(absolutePath);
  }
  return files;
}

export function scanWorkspace(workspaceRoot) {
  const findings = [];
  for (const absolutePath of collectTextFiles(workspaceRoot)) {
    const matches = scanText(readFileSync(absolutePath, 'utf8'));
    for (const rule of matches) {
      findings.push({
        file: relative(workspaceRoot, absolutePath).replaceAll('\\', '/'),
        rule,
      });
    }
  }
  return findings;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const workspaceRoot = resolve(currentFile, '..', '..');
  const findings = scanWorkspace(workspaceRoot);
  if (findings.length > 0) {
    console.error('Potential secret material detected. Values are intentionally hidden.');
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.rule}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Repository secret scan passed.');
  }
}
