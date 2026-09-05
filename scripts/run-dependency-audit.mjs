import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDependencyAuditWithRetry } from '../server/dependencyAuditPolicy.mjs';

const attemptTimeoutMs = 45_000;
const maximumOutputBytes = 512_000;

function npmCliPath() {
  const candidate = process.env.npm_execpath?.trim() ?? '';
  if (!candidate || !isAbsolute(candidate) || !existsSync(candidate)) {
    throw new Error('Dependency audit failed closed: npm must provide an absolute executable path.');
  }
  return candidate;
}

function appendBounded(current, chunk) {
  const next = Buffer.concat([current, Buffer.from(chunk)]);
  return next.length <= maximumOutputBytes
    ? { contents: next, exceeded: false }
    : { contents: next.subarray(0, maximumOutputBytes), exceeded: true };
}

export function executeDependencyAuditAttempt() {
  return new Promise(resolveAttempt => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let outputLimitExceeded = false;
    let timedOut = false;
    let settled = false;
    let timeout;
    const child = spawn(process.execPath, [npmCliPath(), 'audit', '--audit-level=high', '--json', '--ignore-scripts'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = result => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolveAttempt({
        exitCode: result.exitCode,
        spawnErrorCode: result.spawnErrorCode ?? '',
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        timedOut,
        outputLimitExceeded,
      });
    };
    const capture = (current, chunk) => {
      const captured = appendBounded(current, chunk);
      if (captured.exceeded) {
        outputLimitExceeded = true;
        child.kill('SIGKILL');
      }
      return captured.contents;
    };
    child.stdout.on('data', chunk => {
      stdout = capture(stdout, chunk);
    });
    child.stderr.on('data', chunk => {
      stderr = capture(stderr, chunk);
    });
    child.once('error', error => {
      finish({ exitCode: null, spawnErrorCode: error.code });
    });
    child.once('close', exitCode => {
      finish({ exitCode });
    });
    timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, attemptTimeoutMs);
  });
}

async function main() {
  const result = await runDependencyAuditWithRetry({
    executeAttempt: executeDependencyAuditAttempt,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Dependency audit failed closed.');
    process.exitCode = 1;
  });
}
