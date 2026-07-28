import { getCatalogCategory } from '../server/catalogShared.mjs';

const defaultCategory = 'phone';

function requestedCatalogCategory(request) {
  if (typeof request?.url !== 'string') return defaultCategory;
  try {
    return new URL(request.url, 'https://dealivra.invalid').searchParams.get('category')
      ?.trim()
      .toLowerCase()
      || defaultCategory;
  } catch {
    return defaultCategory;
  }
}

export default async function handler(request, response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const category = requestedCatalogCategory(request);

  try {
    const catalog = getCatalogCategory(category);
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.setHeader(
      'Vercel-CDN-Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400',
    );
    response.status(200).json(catalog);
  } catch (error) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    const status = error?.code === 'UNSUPPORTED_CATALOG_CATEGORY' ? 400 : 503;
    response.status(status).json({
      error: status === 400 ? 'Choose a supported catalog category.' : 'Catalog is temporarily unavailable.',
    });
  }
}
