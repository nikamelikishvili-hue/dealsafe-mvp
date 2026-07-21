import type { Deal, DealDraft } from '../domain';

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
  sellerVerification: 'verified', agreementVersion: 1, createdAt: new Date().toISOString()
}];

export const demoRepository: DealRepository = {
  async list() { return [...seed]; },
  async create(draft) {
    const deal: Deal = { id: crypto.randomUUID(), publicId: `DS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, title: draft.title, description: draft.description, priceCents: Math.round(Number(draft.price) * 100), currency: 'USD', condition: draft.condition, serialNumber: draft.serialNumber, deliveryMethod: draft.deliveryMethod, status: 'published', sellerName: 'You', sellerVerification: 'pending', agreementVersion: 1, createdAt: new Date().toISOString() };
    seed.unshift(deal); return deal;
  },
  async accept(publicId, buyerName) {
    const deal = seed.find(item => item.publicId === publicId); if (!deal) throw new Error('Deal not found');
    deal.status = 'accepted'; deal.buyerName = buyerName; deal.buyerVerification = 'pending'; return {...deal};
  }
};
