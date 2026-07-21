export type DealStatus = 'draft' | 'published' | 'accepted' | 'completed';
export type VerificationStatus = 'not_started' | 'pending' | 'verified';

export interface Deal {
  id: string;
  publicId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: 'USD';
  condition: 'Like new' | 'Good' | 'Fair';
  serialNumber?: string;
  deliveryMethod: 'Meet in person' | 'Ship to buyer';
  status: DealStatus;
  sellerName: string;
  sellerVerification: VerificationStatus;
  buyerName?: string;
  buyerVerification?: VerificationStatus;
  agreementVersion: number;
  createdAt: string;
}

export interface DealDraft extends Pick<Deal, 'title' | 'description' | 'condition' | 'deliveryMethod'> {
  price: string;
  serialNumber: string;
}
