import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

export type DealMutationResponseBoundary =
  | 'published_deal_version'
  | 'public_deal_acceptance';

export type PublicDealAcceptancePayload =
  | 'accepted'
  | 'incorrect_code'
  | 'rate_limited';

export class DealMutationResponseValidationError extends Error {
  readonly boundary: DealMutationResponseBoundary;
  readonly issue: string;

  constructor(boundary: DealMutationResponseBoundary, issue: string) {
    super('The deal service returned an invalid response. Please try again later.');
    this.name = 'DealMutationResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(
  boundary: DealMutationResponseBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.deal-mutation.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new DealMutationResponseValidationError(boundary, safeIssue);
}

export function parsePublishedDealVersionResponse(value: unknown): number {
  const boundary = 'published_deal_version';
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
    || value > 1_000_000
  ) {
    reject(boundary, 'version_invalid');
  }
  return value;
}

export function parsePublicDealAcceptanceResponse(
  value: unknown,
): PublicDealAcceptancePayload {
  const boundary = 'public_deal_acceptance';
  if (
    value !== 'accepted'
    && value !== 'incorrect_code'
    && value !== 'rate_limited'
  ) {
    reject(boundary, 'acceptance_result_invalid');
  }
  return value;
}
