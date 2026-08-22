import { randomBytes } from 'node:crypto';
import {
  architecturePocEnabled,
  prepareArchitecturePocResponse,
  renderArchitecturePocPage,
} from '../../server/architecturePoc.mjs';

export default function handler(request, response) {
  if (!architecturePocEnabled()) {
    response.status(404).end();
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).end();
    return;
  }
  const nonce = randomBytes(18).toString('base64url');
  prepareArchitecturePocResponse(response, nonce);
  if (request.method === 'HEAD') {
    response.status(200).end();
    return;
  }
  response.status(200).send(renderArchitecturePocPage({ nonce }));
}
