import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDirectory, '..');
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^\d{4}-\d{2}-\d{2}\.\d+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const expectedCategories = [
  'camera',
  'gaming',
  'laptop',
  'phone',
  'tablet',
  'tools',
  'vehicle',
  'watch',
];
const requiredEvidenceCommands = new Set([
  'npm run catalog:verify',
  'npm run verify',
]);
const forbiddenMetricDimensions = new Set([
  'deal_id',
  'public_id',
  'user_id',
  'email',
  'address',
  'serial_number',
  'payment_identifier',
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveInside(root, path, label) {
  invariant(typeof path === 'string' && path.length > 0, `${label} path is required.`);
  invariant(!isAbsolute(path), `${label} path must be repository-relative.`);
  const resolved = resolve(root, path);
  const relativePath = relative(root, resolved);
  invariant(
    relativePath !== '..' && !relativePath.startsWith(`..${sep}`),
    `${label} path must stay inside the repository.`,
  );
  return resolved;
}

function validateCatalogCategory(categoryId, category) {
  invariant(category && typeof category === 'object', `${categoryId} catalog data is required.`);
  invariant(Array.isArray(category.brands) && category.brands.length > 0, `${categoryId} needs brands.`);

  const brandIds = new Set();
  const brandLabels = new Set();
  let modelCount = 0;

  for (const brand of category.brands) {
    invariant(identifierPattern.test(brand.id), `${categoryId} has an invalid brand ID.`);
    invariant(typeof brand.label === 'string' && brand.label.trim(), `${categoryId} has an empty brand label.`);
    invariant(!brandIds.has(brand.id), `${categoryId} repeats brand ID ${brand.id}.`);
    const normalizedLabel = brand.label.trim().toLocaleLowerCase('en-US');
    invariant(!brandLabels.has(normalizedLabel), `${categoryId} repeats brand label ${brand.label}.`);
    brandIds.add(brand.id);
    brandLabels.add(normalizedLabel);

    invariant(Array.isArray(brand.models) && brand.models.length > 0, `${brand.label} needs models.`);
    const models = new Set();
    for (const model of brand.models) {
      invariant(typeof model === 'string' && model.trim(), `${brand.label} has an empty model.`);
      const normalizedModel = model.trim().toLocaleLowerCase('en-US');
      invariant(!models.has(normalizedModel), `${brand.label} repeats model ${model}.`);
      models.add(normalizedModel);
      modelCount += 1;
    }
  }

  if (category.variants !== undefined) {
    invariant(Array.isArray(category.variants), `${categoryId} variants must be an array.`);
    const variants = category.variants.map(value => String(value).trim());
    invariant(variants.every(Boolean), `${categoryId} has an empty variant.`);
    invariant(new Set(variants.map(value => value.toLocaleLowerCase('en-US'))).size === variants.length, `${categoryId} repeats a variant.`);
  }

  if (categoryId === 'vehicle') {
    invariant(Number.isInteger(category.yearMin) && category.yearMin >= 1886, 'Vehicle minimum year is invalid.');
    invariant(Number.isInteger(category.yearMax) && category.yearMax >= category.yearMin, 'Vehicle maximum year is invalid.');
  }

  return { brandCount: brandIds.size, modelCount };
}

export function validateCatalogRelease(root = defaultRoot) {
  const pointerPath = resolveInside(root, 'catalog/active-release.json', 'Active release');
  const pointer = readJson(pointerPath);
  invariant(pointer.schemaVersion === 1, 'Active release schemaVersion must be 1.');
  invariant(versionPattern.test(pointer.catalogVersion), 'Active catalog version is invalid.');

  const manifestPath = resolveInside(root, pointer.manifest, 'Manifest');
  invariant(
    relative(resolve(root, 'catalog/releases'), manifestPath).split(sep)[0] !== '..',
    'Manifest must live in catalog/releases.',
  );
  const manifest = readJson(manifestPath);
  invariant(manifest.schemaVersion === 1, 'Release manifest schemaVersion must be 1.');
  invariant(manifest.status === 'active', 'The selected release must be active.');
  invariant(manifest.catalogVersion === pointer.catalogVersion, 'Pointer and manifest versions differ.');
  invariant(versionPattern.test(manifest.catalogVersion), 'Manifest catalog version is invalid.');
  invariant(manifest.market === 'US', 'The launch catalog market must be US.');
  invariant(datePattern.test(manifest.releasedAt), 'Release date is invalid.');

  const datasetPath = resolveInside(root, manifest.dataset?.path, 'Dataset');
  invariant(manifest.dataset.path === 'src/catalog.v1.json', 'The active dataset path is unexpected.');
  const datasetBytes = readFileSync(datasetPath);
  const digest = createHash('sha256').update(datasetBytes).digest('hex');
  invariant(digest === manifest.dataset.sha256, 'Catalog checksum does not match the release manifest.');

  const catalog = JSON.parse(datasetBytes.toString('utf8'));
  invariant(catalog.schemaVersion === 1, 'Catalog schemaVersion must be 1.');
  invariant(catalog.catalogVersion === manifest.catalogVersion, 'Catalog and manifest versions differ.');
  invariant(catalog.market === manifest.market, 'Catalog and manifest markets differ.');
  invariant(catalog.updatedAt === manifest.releasedAt, 'Catalog update date and release date differ.');

  const categoryIds = Object.keys(catalog.categories ?? {}).sort();
  invariant(JSON.stringify(categoryIds) === JSON.stringify(expectedCategories), 'Catalog category set changed without governance review.');
  invariant(
    JSON.stringify([...manifest.dataset.categories].sort()) === JSON.stringify(expectedCategories),
    'Manifest category set is incomplete.',
  );

  let brandCount = 0;
  let modelCount = 0;
  for (const categoryId of expectedCategories) {
    const counts = validateCatalogCategory(categoryId, catalog.categories[categoryId]);
    brandCount += counts.brandCount;
    modelCount += counts.modelCount;
  }

  const ownership = manifest.ownership ?? {};
  for (const role of ['businessOwner', 'technicalOwner', 'riskReviewer']) {
    invariant(typeof ownership[role] === 'string' && ownership[role].trim(), `${role} is required.`);
  }
  invariant(Array.isArray(manifest.sources) && manifest.sources.length > 0, 'At least one catalog source is required.');
  for (const source of manifest.sources) {
    invariant(identifierPattern.test(source.id), 'Catalog source ID is invalid.');
    invariant(typeof source.owner === 'string' && source.owner.trim(), `${source.id} needs an owner.`);
    invariant(datePattern.test(source.retrievedAt) || source.retrievedAt === 'runtime', `${source.id} retrieval date is invalid.`);
    invariant(
      (typeof source.url === 'string' && source.url.startsWith('https://'))
      || (typeof source.reference === 'string' && source.reference.startsWith('docs/')),
      `${source.id} needs an HTTPS URL or repository documentation reference.`,
    );
  }

  const cadence = manifest.updateCadence ?? {};
  invariant(Number.isInteger(cadence.regularReviewDays) && cadence.regularReviewDays > 0 && cadence.regularReviewDays <= 90, 'Regular catalog review cadence is invalid.');
  invariant(Number.isInteger(cadence.staleWarningDays) && cadence.staleWarningDays >= cadence.regularReviewDays, 'Catalog stale warning must follow the regular review.');
  invariant(Number.isInteger(cadence.emergencyReviewHours) && cadence.emergencyReviewHours > 0 && cadence.emergencyReviewHours <= 72, 'Emergency review window is invalid.');

  const evidenceCommands = new Set(manifest.releaseEvidence?.commands ?? []);
  for (const command of requiredEvidenceCommands) {
    invariant(evidenceCommands.has(command), `Release evidence must include ${command}.`);
  }
  invariant(manifest.releaseEvidence?.status === 'verified', 'Release evidence must be verified.');
  invariant((manifest.releaseEvidence?.requiredReview ?? []).length >= 4, 'Release review evidence is incomplete.');

  const metrics = manifest.metrics ?? {};
  invariant(metrics.source === 'public.get_admin_catalog_adoption(integer)', 'Catalog metrics source is not approved.');
  invariant((metrics.windowsDays ?? []).every(value => [7, 30, 90].includes(value)), 'Catalog metric windows are not approved.');
  invariant((metrics.dimensions ?? []).every(value => ['catalog_version', 'category_id'].includes(value)), 'Catalog metrics include an unapproved dimension.');
  const manifestForbidden = new Set(metrics.forbiddenDimensions ?? []);
  for (const dimension of forbiddenMetricDimensions) {
    invariant(manifestForbidden.has(dimension), `Catalog metrics must forbid ${dimension}.`);
  }

  const rollback = manifest.rollback ?? {};
  invariant(rollback.strategy === 'git-revert-and-redeploy', 'Rollback strategy is not approved.');
  invariant(rollback.databaseRollbackRequired === false, 'Catalog releases must not require destructive database rollback.');
  invariant(rollback.preserveHistoricalDeals === true, 'Rollback must preserve historical deal catalog snapshots.');
  invariant(typeof rollback.procedure === 'string' && rollback.procedure.startsWith('docs/'), 'Rollback procedure is missing.');

  return {
    catalogVersion: manifest.catalogVersion,
    market: manifest.market,
    categoryCount: categoryIds.length,
    brandCount,
    modelCount,
    sha256: digest,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = validateCatalogRelease();
    console.log(
      `Catalog ${report.catalogVersion} verified: ${report.categoryCount} categories, `
      + `${report.brandCount} brands, ${report.modelCount} models, SHA-256 ${report.sha256}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Catalog release validation failed.');
    process.exitCode = 1;
  }
}
