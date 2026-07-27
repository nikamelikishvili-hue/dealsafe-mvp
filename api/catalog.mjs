import { getCatalogCategory } from '../server/catalogShared.mjs';

const defaultCategory = 'phone';

export default async function handler(request, response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const requestedCategory = Array.isArray(request.query?.category)
    ? request.query.category[0]
    : request.query?.category;
  const category = typeof requestedCategory === 'string'
    ? requestedCategory.trim().toLowerCase()
    : defaultCategory;

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
