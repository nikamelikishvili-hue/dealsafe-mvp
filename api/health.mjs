function prepare(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export default function handler(request, response) {
  prepare(response);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (request.method === 'HEAD') {
    response.status(200).end();
    return;
  }
  response.status(200).json({
    schema: 'dealivra.health.v1',
    status: 'alive',
  });
}
