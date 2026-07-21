export interface VerificationProvider {
  start(userId: string): Promise<{ redirectUrl: string }>;
  getStatus(userId: string): Promise<'pending' | 'verified' | 'failed'>;
}

export interface SignatureProvider {
  createRequest(agreementVersionId: string, signerEmail: string): Promise<{ requestId: string }>;
}

// Production implementations belong here. The MVP UI labels these capabilities as placeholders.
