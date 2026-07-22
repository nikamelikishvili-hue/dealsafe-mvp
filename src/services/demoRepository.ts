import type { Deal, DealDraft } from '../domain';
import { toMinorUnits } from '../currency';

export interface DealRepository {
  list(): Promise<Deal[]>;
  create(draft: DealDraft): Promise<Deal>;
  accept(publicId: string, buyerName: string): Promise<Deal>;
}

const seed: Deal[] = [{
  id: '1', publicId: 'DS-7K4M2Q', title: 'iPhone 15 Pro · 256 GB',
  description: 'Natural Titanium. Unlocked. Minor wear on lower edge; cameras and Face ID work.',
  priceCents: 78000, currency: 'USD', condition: 'Good', serialNumber: '•••• 7NQ2',
  deliveryMethod: 'Meet in person', status: 'published', sellerName: 'Alex Morgan',
  sellerContactVerified: true, sellerVerification: 'verified', agreementVersion: 1, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+7*24*60*60*1000).toISOString()
}];

export const demoRepository: DealRepository = {
  async list() { return [...seed]; },
  async create(draft) {
    const deal: Deal = { id: crypto.randomUUID(), publicId: `DS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, title: draft.title, description: draft.description, priceCents: toMinorUnits(draft.price, draft.currency), currency: draft.currency, condition: draft.condition, serialNumber: draft.serialNumber, deliveryMethod: draft.deliveryMethod, status: 'published', sellerName: 'You', sellerContactVerified: true, sellerVerification: 'pending', agreementVersion: 1, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000).toISOString() };
    seed.unshift(deal); return deal;
  },
  async accept(publicId, buyerName) {
    const deal = seed.find(item => item.publicId === publicId); if (!deal) throw new Error('Deal not found');
    deal.status = 'accepted'; deal.buyerName = buyerName; deal.buyerVerification = 'pending'; return {...deal};
  }
};
