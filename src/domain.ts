import type { CurrencyCode } from './currency';

export type DealStatus = 'draft' | 'published' | 'accepted' | 'completed' | 'cancelled' | 'disputed';
export type VerificationStatus = 'not_started' | 'pending' | 'verified';

export interface Deal {
  id: string;
  publicId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: CurrencyCode;
  condition: 'Like new' | 'Good' | 'Fair';
  serialNumber?: string;
  deliveryMethod: 'Meet in person' | 'Ship to buyer';
  status: DealStatus;
  sellerName: string;
  sellerContactVerified?: boolean;
  sellerVerification: VerificationStatus;
  buyerName?: string;
  buyerVerification?: VerificationStatus;
  agreementVersion: number;
  createdAt: string;
  expiresAt?: string;
  mediaUrls?: string[];
  viewerRole?: 'seller' | 'buyer' | 'visitor';
}

export interface DealDraft extends Pick<Deal, 'title' | 'description' | 'condition' | 'deliveryMethod'> {
  price: string;
  currency: CurrencyCode;
  serialNumber: string;
  expiresInDays?: number;
}
