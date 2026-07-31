import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import {
  compareServedAsset,
  normalizeDeploymentOrigin,
  servedAssetManifestFile,
  servedAssetUrl,
  validateServedAssetManifest,
} from '../server/servedAssetIntegrityPolicy.mjs';

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
  configLoader: 'native',
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

  const localOrigin = normalizeDeploymentOrigin(
    origin,
    [],
    { allowLocalPreview: true },
  );
  if (!localOrigin) throw new Error('The local Preview origin was rejected.');
  const manifestResponse = await fetch(
    `${localOrigin}/${servedAssetManifestFile}`,
    { cache: 'no-store', redirect: 'manual' },
  );
  if (!manifestResponse.ok || manifestResponse.redirected) {
    throw new Error('The served asset manifest was not returned directly.');
  }
  const manifest = validateServedAssetManifest(await manifestResponse.json());
  if (!manifest) throw new Error('The served asset manifest is invalid.');
  for (const asset of manifest.assets) {
    const assetUrl = servedAssetUrl(localOrigin, asset.path);
    if (!assetUrl) throw new Error('The served asset manifest contains an unsafe path.');
    const response = await fetch(assetUrl, { cache: 'no-store', redirect: 'manual' });
    if (!response.ok || response.redirected) {
      throw new Error('A reviewed build asset was not returned directly.');
    }
    const comparison = compareServedAsset(
      asset,
      new Uint8Array(await response.arrayBuffer()),
    );
    if (!comparison?.matches) {
      throw new Error('A Preview asset does not match the build manifest.');
    }
  }

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
  const serviceWorker = await serviceWorkerResponse.text();
  if (
    !serviceWorker.includes("IMMUTABLE_ASSET_PATH")
    || !serviceWorker.includes("request.method !== 'GET'")
    || !serviceWorker.includes("url.origin === self.location.origin")
    || /cache\.put\(\s*['"`]\/['"`]/.test(serviceWorker)
    || /cache\.addAll/.test(serviceWorker)
  ) {
    throw new Error('Service worker does not preserve the reviewed private-cache boundary.');
  }

  console.log('Production preview smoke test passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production preview smoke test failed.');
  process.exitCode = 1;
} finally {
  await stopServer();
}
