import type { Deal } from './domain';

type FingerprintDeal = Pick<Deal,
  'publicId' | 'agreementVersion' | 'title' | 'description' | 'priceCents' |
  'currency' | 'condition' | 'serialNumber' | 'deliveryMethod' | 'expiresAt'
>;

export function serializeAgreement(deal: FingerprintDeal) {
  return JSON.stringify({
    format: 'DealSafe-Agreement-v1',
    publicId: deal.publicId,
    agreementVersion: deal.agreementVersion,
    title: deal.title,
    description: deal.description,
    priceCents: deal.priceCents,
    currency: deal.currency,
    condition: deal.condition,
    serialNumber: deal.serialNumber || '',
    deliveryMethod: deal.deliveryMethod,
    expiresAt: deal.expiresAt || '',
  });
}

export async function createAgreementFingerprint(deal: FingerprintDeal) {
  const bytes = new TextEncoder().encode(serializeAgreement(deal));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
