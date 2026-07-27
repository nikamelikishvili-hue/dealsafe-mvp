import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(currentFile, '..', '..');
const builtIndex = resolve(workspaceRoot, 'dist', 'index.html');
const host = '127.0.0.1';
const port = 4175;
const origin = `http://${host}:${port}`;

if (!existsSync(builtIndex)) {
  console.error('Preview smoke test requires a production build. Run npm run build first.');
  process.exit(1);
}

const server = await preview({
  root: workspaceRoot,
  logLevel: 'silent',
  preview: {
    host,
    port,
    strictPort: true,
  },
});

async function waitForPreview() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (!server.httpServer.listening) {
      throw new Error('Preview server exited before becoming ready.');
    }
    try {
      const response = await fetch(origin, { redirect: 'manual' });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(200);
  }
  throw new Error('Preview server did not become ready within 12 seconds.');
}

async function expectApplicationPage(pathname) {
  const response = await fetch(`${origin}${pathname}`, { redirect: 'manual' });
  const body = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}.`);
  if (!body.includes('<div id="root"></div>')) {
    throw new Error(`${pathname} did not return the Dealivra application shell.`);
  }
  return body;
}

async function stopServer() {
  await new Promise((resolveClose, rejectClose) => {
    server.httpServer.close(error => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}

try {
  await waitForPreview();
  const home = await expectApplicationPage('/');
  await expectApplicationPage('/terms');
  await expectApplicationPage('/?start=signin');

  const entryAsset = home.match(/<script[^>]+src="([^"]*\/assets\/[^"]+\.js)"/)?.[1];
  if (!entryAsset) throw new Error('The built application entry asset was not found.');
  const assetResponse = await fetch(new URL(entryAsset, origin));
  if (!assetResponse.ok) throw new Error(`Entry asset returned HTTP ${assetResponse.status}.`);
  const contentType = assetResponse.headers.get('content-type') || '';
  if (!/javascript/i.test(contentType)) {
    throw new Error(`Entry asset returned unexpected content type: ${contentType || 'missing'}.`);
  }

  const serviceWorkerResponse = await fetch(`${origin}/sw.js`);
  if (!serviceWorkerResponse.ok) {
    throw new Error(`Service worker returned HTTP ${serviceWorkerResponse.status}.`);
  }

  console.log('Production preview smoke test passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production preview smoke test failed.');
  process.exitCode = 1;
} finally {
  await stopServer();
}
