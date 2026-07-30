import type { Deal, DealDraft } from '../domain';
import { toMinorUnits } from '../currency';
import { isVideoUpload, prepareMediaUpload } from '../mediaPrivacy';
import {
  fetchWithDeadline,
  readBoundedJson,
  readBoundedText,
  readExactArrayBuffer,
  readExactBlobArrayBuffer,
} from './browserResponseBoundary';
import {
  validateEvidenceBytes,
  validateEvidenceDeclaration,
  type EvidenceUploadType,
} from '../../supabase/functions/_shared/evidence-policy';
import {
  parseDealActionPlanRows,
  parsePublicDealRows,
  parseSavedDealRows,
  parseShippingEvidenceReadinessRows,
  parseUserDealRows,
  type DealActionPlanPayload,
  type DealRowPayload,
  type SellerShippingEvidenceReadinessPayload,
} from './runtimeSchemas';
import {
  parseAuthSession,
  parseLoginResponse,
  parseMfaEnrollmentResponse,
  parseMfaStatusResponse,
  parseSignupResponse,
  type AuthSessionPayload,
  type MfaEnrollmentPayload,
  type MfaFactorPayload,
  type MfaStatusPayload,
} from './authRuntimeSchemas';
import {
  parseAuthBearerToken,
  parseAuthErrorEnvelope,
  parseAuthLoginRequest,
  parseAuthLogoutRequest,
  parseAuthMfaRequest,
  parseAuthPasswordRequest,
  parseAuthRecoverRequest,
  parseAuthRefreshRequest,
  parseAuthSignupRequest,
  type AuthErrorBoundary,
} from './authBoundarySchemas';
import {
  parseProtectedPaymentStatusRows,
  parseStripeCheckoutResponse,
  parseStripeConnectOnboardingResponse,
  parseStripeConnectStatusResponse,
  parseStripeDisputeResolutionResponse,
  type ProtectedPaymentStatePayload,
  type ProtectedPaymentStatusPayload,
  type StripeConnectStatusPayload,
} from './paymentRuntimeSchemas';
import {
  parsePaymentErrorEnvelope,
  parsePaymentPostgrestErrorEnvelope,
  parseProtectedPaymentStatusRequest,
  parseStripeCheckoutRequest,
  parseStripeConnectRequest,
  type PaymentErrorBoundary,
} from './paymentBoundarySchemas';
import {
  parseAdminDisputeRows,
  parseDealEvidenceRows,
  parseEvidenceAlertAcknowledgementResponse,
  parseEvidenceHoldKeyResponse,
  parseEvidenceInventoryResponse,
  parseEvidenceJobIdResponse,
  parseEvidenceLifecycleSnapshotResponse,
  parseEvidenceSignedViewerResponse,
  parseEvidenceUploadIntakeResponse,
  parseFinalizeEvidenceResponse,
  type AdminDisputePayload,
  type DealEvidencePayload,
  type EvidenceIntegrityStatusPayload,
  type EvidenceLifecycleAlertPayload,
  type EvidenceLifecycleJobPayload,
  type EvidenceLifecycleSnapshotPayload,
  type EvidenceLifecycleStatusPayload,
} from './evidenceRuntimeSchemas';
import {
  parseEvidenceEdgeErrorEnvelope,
  parseEvidenceFilesRequest,
  parseEvidenceMaintenanceRequest,
  parseFinancialDisputeRequest,
  parseOpenDisputeRequest,
  parsePostgrestErrorEnvelope,
  parseResolveDisputeRequest,
  parseStorageErrorEnvelope,
} from './evidenceBoundarySchemas';
import {
  parseAdminReportRows,
  parseCurrentUserDealSellerResponse,
  parseDealInquiryRows,
  parseDealMessageRows,
  parseDealNotificationRows,
  parseDealOfferRows,
  parseInquiryIdResponse,
  parseSafetyReportIdResponse,
  type AdminReportPayload,
  type DealInquiryPayload,
  type DealMessagePayload,
  type DealNotificationPayload,
  type DealOfferPayload,
} from './interactionRuntimeSchemas';
import {
  parseAdminReportListRequest,
  parseAdminReportResolutionRequest,
  parseCreateInquiryRequest,
  parseCreateOfferRequest,
  parseCurrentUserDealSellerRequest,
  parseDealModerationRequest,
  parseInquiryListRequest,
  parseInteractionPostgrestErrorEnvelope,
  parseMessageListRequest,
  parseNotificationAllReadRequest,
  parseNotificationDealReadRequest,
  parseNotificationListRequest,
  parseOfferListRequest,
  parseReplyInquiryRequest,
  parseRespondOfferRequest,
  parseSafetyReportRequest,
  parseSendDealMessageRequest,
} from './interactionBoundarySchemas';
import {
  parseAdminAccessResponse,
  parseAdminCatalogAdoptionRows,
  parseAdminRevenueSummaryRows,
  parseAdminRevenueTransactionRows,
  type AdminCatalogAdoptionPayload,
  type AdminRevenueSummaryPayload,
  type AdminRevenueTransactionPayload,
} from './adminRuntimeSchemas';
import {
  parseAdminAccessRequest,
  parseAdminCatalogAdoptionRequest,
  parseAdminPostgrestErrorEnvelope,
  parseAdminRevenueSummaryRequest,
  parseAdminRevenueTransactionsRequest,
} from './adminBoundarySchemas';
import {
  parseDealRiskAssessmentRows,
  parsePublicSellerTrustProfileRows,
  parsePublicTrustPassportRows,
  parseTrustPassportSettingsRows,
  parseTrustPassportToggleResponse,
  type PublicTrustProfilePayload,
  type RiskAssessmentPayload,
  type TrustPassportPayload,
  type TrustPassportSettingsPayload,
} from './trustRuntimeSchemas';
import {
  parseDealRiskRequest,
  parsePublicSellerTrustRequest,
  parsePublicTrustPassportRequest,
  parseTrustPassportSettingsRequest,
  parseTrustPassportToggleRequest,
  parseTrustPostgrestErrorEnvelope,
} from './trustBoundarySchemas';
import {
  parseDealDeliveryDetailsRows,
  parseDealInspectionRows,
  parseDealMeetingRows,
  parseDealShipmentRows,
  parseHandoffPinResponse,
  type DealDeliveryDetailsPayload,
  type DealInspectionPayload,
  type DealMeetingPayload,
  type DealShipmentPayload,
} from './deliveryRuntimeSchemas';
import {
  parseDealActionPlanRequest,
  parseDealInspectionReadRequest,
  parseDealInspectionRecordRequest,
  parseDealMeetingReadRequest,
  parseDealShipmentReadRequest,
  parseDeliveryDetailsReadRequest,
  parseDeliveryDetailsSaveRequest,
  parseDeliveryPostgrestErrorEnvelope,
  parseHandoffCompleteRequest,
  parseHandoffPinGenerateRequest,
  parseMeetingArrivalRequest,
  parseMeetingConfirmationRequest,
  parseMeetingProposalRequest,
  parseShipmentCreateRequest,
  parseShipmentDeliveryConfirmationRequest,
  parseShippingEvidenceReadinessRequest,
} from './deliveryBoundarySchemas';
import {
  parseAccountSessionRows,
  parseDealParticipantsRows,
  parseIdentityVerificationResponse,
  parseProfileSummaryRows,
  parseTimelineEventRows,
  type AccountSessionPayload,
  type DealParticipantsPayload,
  type ProfileSummaryPayload,
  type TimelineEventPayload,
} from './accountActivityRuntimeSchemas';
import {
  parseAccountActivityPostgrestErrorEnvelope,
  parseAccountSessionsRequest,
  parseDealParticipantsRequest,
  parseDealTimelineRequest,
  parseIdentityVerificationRequest,
  parseProfileSummaryRequest,
  parseRatingSubmitRequest,
} from './accountActivityBoundarySchemas';
import {
  parseAcceptanceProtectionResponse,
  parseAgreementDocumentRows,
  parseAgreementHistoryRows,
  parseAgreementVerificationRows,
  parseBuyerAccessCodeResponse,
  parseDealRenewalRows,
  parseSellerDeclarationRows,
  parseWatchlistStateResponse,
  type AgreementDocumentSnapshotPayload,
  type AgreementHistoryVersionPayload,
  type AgreementVerificationResultPayload,
  type DealRenewalResultPayload,
  type SellerDeclarationRecordPayload,
} from './agreementRuntimeSchemas';
import {
  parseAcceptanceProtectionRequest,
  parseAgreementDocumentRequest,
  parseAgreementHistoryRequest,
  parseAgreementPostgrestErrorEnvelope,
  parseAgreementVerificationRequest,
  parseBuyerAccessCodeRequest,
  parseDealLinkRenewalRequest,
  parseSellerDeclarationRequest,
  parseWatchlistReadRequest,
  parseWatchlistWriteRequest,
} from './agreementBoundarySchemas';
import {
  parseDealCancelRequest,
  parseDealDraftCreateRequest,
  parseDealDraftUpdateRequest,
  parseDealExpirationDays,
  parseDealIdRequest,
  parseDealMutationPostgrestErrorEnvelope,
  parseDealOwnerContext,
  parseDealPublishRequest,
  parseMediaDeleteRequest,
  parseMediaRecordInsertRequest,
  parseMediaReorderRequest,
  parseMediaUploadBatchRequest,
  parsePublicDealAcceptRequest,
  parsePublicDealRequest,
  parsePublishedDealUpdateRequest,
  parseSavedDealsRequest,
} from './dealMutationBoundarySchemas';
import {
  parsePublicDealAcceptanceResponse,
  parsePublishedDealVersionResponse,
} from './dealMutationRuntimeSchemas';
import {
  parseAccountAuthErrorEnvelope,
  parseAccountNameUpdateRequest,
  parseAccountProfileErrorEnvelope,
} from './accountMutationBoundarySchemas';
import {
  parseLegacyPaymentPostgrestErrorEnvelope,
  parseLegacyPaymentRecordRequest,
} from './legacyPaymentBoundarySchemas';
import {
  parseLegacyPaymentRecordRows,
  type LegacyPaymentMethod,
  type LegacyPaymentRecordPayload,
} from './legacyPaymentRuntimeSchemas';
import {
  parseCreateSupportCaseRequest,
  parseMySupportCasesRequest,
  parseReplySupportCaseRequest,
  parseResolveSupportCaseRequest,
  parseSupportCaseClaimRequest,
  parseSupportCaseReadRequest,
  parseSupportPostgrestErrorEnvelope,
  parseSupportQueueRequest,
  type SupportCategory,
} from './supportBoundarySchemas';
import {
  parseSupportCaseDetailRows,
  parseSupportCaseSummaryRows,
  parseSupportMutationResponse,
  parseSupportQueueRows,
  parseSupportReferenceResponse,
  type SupportCaseDetailPayload,
  type SupportCaseSummaryPayload,
  type SupportQueueItemPayload,
} from './supportRuntimeSchemas';

// Vercel can preserve pasted line breaks in environment variables. Keep only
// the first non-empty line so an accidental multi-line key never becomes an
// invalid HTTP header value in the browser.
function readPublicEnv(name: string) {
  const raw = import.meta.env[name] as string | undefined;
  return raw?.split(/\r?\n/).map(value => value.trim()).find(Boolean);
}

function normalizePublicServiceUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.replace(/\/+$/, ''));
    const isLocalDevelopment = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(isLocalDevelopment && parsed.protocol === 'http:')) {
      return undefined;
    }
    if (
      parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.pathname !== '' && parsed.pathname !== '/')
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

const supabaseUrl = normalizePublicServiceUrl(readPublicEnv('VITE_SUPABASE_URL'));
const publishableKey = readPublicEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
const browserKeyIsSafe = Boolean(publishableKey && !/^sb_secret_/i.test(publishableKey));

export const isSupabaseConfigured = Boolean(supabaseUrl && browserKeyIsSafe);
const configurationUnavailableMessage = 'Account service is temporarily unavailable. Please try again later.';

function requireSupabaseConfiguration() {
  if (!isSupabaseConfigured) throw new Error(configurationUnavailableMessage);
}

export class AuthenticationApiError extends Error {
  readonly status:number;
  readonly retryAfterSeconds:number|null;
  readonly sessionInvalid:boolean;

  constructor(message:string,status:number,retryAfterSeconds:number|null){
    super(message);
    this.name='AuthenticationApiError';
    this.status=status;
    this.retryAfterSeconds=retryAfterSeconds;
    this.sessionInvalid=status===401;
  }
}

function authenticationApiError(
  response:Response,
  data:unknown,
  boundary:AuthErrorBoundary,
){
  const payload=parseAuthErrorEnvelope(
    data,
    response.status,
    response.headers.get('Retry-After'),
    boundary,
  );
  const retryAfterSeconds=payload.retryAfter;
  const retryGuidance=retryAfterSeconds
    ?` Try again in ${retryAfterSeconds} ${retryAfterSeconds===1?'second':'seconds'}.`
    :'';
  return new AuthenticationApiError(
    `${payload.error}${retryGuidance}`,
    response.status,
    retryAfterSeconds,
  );
}

export function isTransientAuthenticationError(error:unknown){
  return error instanceof AuthenticationApiError
    && (error.status===429||error.status>=500);
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
}

export interface StoredSession {
  accessToken:string;
  expiresAt:number;
  createdAt:number;
  lastActivityAt:number;
  user:AuthUser;
}
export type MfaFactor = MfaFactorPayload;
export interface MfaLoginChallenge {
  mfaRequired:true;
  pendingAccessToken:string;
  expiresAt:number;
  factors:MfaFactor[];
}
export type MfaStatus = MfaStatusPayload;
export type MfaEnrollment = MfaEnrollmentPayload;
export type ProfileSummary = ProfileSummaryPayload;
export type TimelineEvent = TimelineEventPayload;
export type DealNotification = DealNotificationPayload;
export type DealMessage = DealMessagePayload;
export type DealOffer = DealOfferPayload;
export type DealInquiry = DealInquiryPayload;
export type DealShipment = DealShipmentPayload;
export type SellerShippingEvidenceReadiness =
  SellerShippingEvidenceReadinessPayload;
export type DealDeliveryDetails = DealDeliveryDetailsPayload;
export type DealPaymentMethod = LegacyPaymentMethod;
export type DealPaymentRecord = LegacyPaymentRecordPayload;
export type SupportCaseCategory = SupportCategory;
export type SupportCaseSummary = SupportCaseSummaryPayload;
export type SupportCaseDetail = SupportCaseDetailPayload;
export type SupportQueueItem = SupportQueueItemPayload;
export type ProtectedPaymentState=ProtectedPaymentStatePayload;
export type ProtectedPaymentStatus=ProtectedPaymentStatusPayload;
export type StripeConnectStatus=StripeConnectStatusPayload;
export type AdminReport = AdminReportPayload;
export type AdminRevenueSummary = AdminRevenueSummaryPayload;
export type AdminRevenueTransaction = AdminRevenueTransactionPayload;
export type AdminCatalogAdoption = AdminCatalogAdoptionPayload;
export type AccountSession = AccountSessionPayload;
export type RiskAssessment = RiskAssessmentPayload;
export type PublicTrustProfile = PublicTrustProfilePayload;
export type TrustPassportSettings = TrustPassportSettingsPayload;
export type TrustPassport = TrustPassportPayload;
export type DealInspection = DealInspectionPayload;
export type EvidenceType=EvidenceUploadType;
export type EvidenceIntegrityStatus=EvidenceIntegrityStatusPayload;
export type EvidenceLifecycleStatus=EvidenceLifecycleStatusPayload;
export type DealEvidence=DealEvidencePayload;
export interface DealEvidenceViewer { objectUrl:string;expiresAt:string;mimeType:'image/webp'|'video/mp4'|'video/webm'|'video/quicktime';fileName:string;fileSizeBytes:number;sha256:string;scanStatus:'clean';scannedAt:string;integrityStatus:'verified';integrityCheckedAt:string }
export type EvidenceLifecycleJob=EvidenceLifecycleJobPayload;
export type EvidenceLifecycleAlert=EvidenceLifecycleAlertPayload;
export type EvidenceLifecycleSnapshot=EvidenceLifecycleSnapshotPayload;
export type AdminDispute=AdminDisputePayload;
export interface SellerDeclarationRecord
  extends SellerDeclarationRecordPayload {}
export interface AgreementHistoryVersion
  extends AgreementHistoryVersionPayload {}
export interface AgreementDocumentSnapshot
  extends AgreementDocumentSnapshotPayload {}
export interface AgreementVerificationResult
  extends AgreementVerificationResultPayload {}
export interface DealRenewalResult extends DealRenewalResultPayload {}
export type DealParticipants = DealParticipantsPayload;
export type DealActionPlan = DealActionPlanPayload;

export const sessionStorageKey = 'dealivra_session_v2';
export const legacySessionStorageKey = 'dealsafe_session';
export const sessionUpdatedEvent = 'dealivra-session-updated';
export const sessionExpiredEvent = 'dealivra-session-expired';
export const mfaRequiredEvent = 'dealivra-mfa-required';
export const sessionIdleTimeoutMs = 30 * 60 * 1000;
export const sessionAbsoluteTimeoutMs = 8 * 60 * 60 * 1000;
const activityWriteIntervalMs = 60 * 1000;
let refreshPromise: Promise<StoredSession> | null = null;

function decodeJwtPayload(token:string){
  try{
    const encoded=token.split('.')[1];
    if(!encoded)return null;
    const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/');
    const payload=JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='))) as Record<string,unknown>;
    return payload&&typeof payload==='object'?payload:null;
  }catch{return null}
}

function decodeJwtExpiry(token:string){
  const payload=decodeJwtPayload(token);
  return typeof payload?.exp==='number'?payload.exp*1000:null;
}

function clearStoredSession(){
  sessionStorage.removeItem(sessionStorageKey);
  // Remove the legacy browser-readable refresh token if an older release left
  // it behind. Legacy sessions are not migrated into the new architecture.
  localStorage.removeItem(legacySessionStorageKey);
}

type SignOutScope='local'|'others'|'global';

async function revokeServerSession(accessToken?:string,scope:SignOutScope='local'){
  const requestBody=parseAuthLogoutRequest({scope});
  const bearerToken=accessToken
    ?parseAuthBearerToken(accessToken,'auth_logout_request')
    :null;
  const response=await fetchWithDeadline('/api/auth/logout',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      ...(bearerToken?{Authorization:`Bearer ${bearerToken}`}:{})
    },
    credentials:'same-origin',
    body:JSON.stringify(requestBody),
    keepalive:true,
  });
  if(!response.ok){
    const data=await readBoundedJson(response);
    throw authenticationApiError(response,data,'auth_logout_error');
  }
}

function normalizeSession(value:unknown):StoredSession|null{
  if(!value||typeof value!=='object')return null;
  const candidate=value as Partial<StoredSession>;
  if(
    typeof candidate.accessToken!=='string'
    ||!candidate.user
    ||typeof candidate.user.id!=='string'
    ||typeof candidate.user.email!=='string'
  )return null;
  const now=Date.now();
  const createdAt=typeof candidate.createdAt==='number'?candidate.createdAt:now;
  const lastActivityAt=typeof candidate.lastActivityAt==='number'?candidate.lastActivityAt:now;
  const tokenExpiry=decodeJwtExpiry(candidate.accessToken);
  const expiresAt=tokenExpiry??(typeof candidate.expiresAt==='number'?candidate.expiresAt:now);
  return {
    accessToken:candidate.accessToken,
    expiresAt,
    createdAt,
    lastActivityAt,
    user:{
      id:candidate.user.id,
      email:candidate.user.email,
      displayName:candidate.user.displayName||candidate.user.email.split('@')[0],
      emailConfirmed:Boolean(candidate.user.emailConfirmed),
    },
  };
}

function readStoredSession(){
  try{
    const current=normalizeSession(JSON.parse(sessionStorage.getItem(sessionStorageKey)||'null'));
    localStorage.removeItem(legacySessionStorageKey);
    return current;
  }catch{
    clearStoredSession();
    return null;
  }
}

function storeSession(data:AuthSessionPayload,user:AuthUser,previous?:StoredSession){
  const now=Date.now();
  const session:StoredSession={
    accessToken:data.access_token,
    expiresAt:decodeJwtExpiry(data.access_token)??now+data.expires_in*1000,
    createdAt:previous?.createdAt||now,
    lastActivityAt:previous?.lastActivityAt||now,
    user,
  };
  sessionStorage.setItem(sessionStorageKey,JSON.stringify(session));
  localStorage.removeItem(legacySessionStorageKey);
  window.dispatchEvent(new CustomEvent<StoredSession>(sessionUpdatedEvent,{detail:session}));
  return session;
}

function headers(token?: string) {
  return {
    apikey: publishableKey ?? '',
    Authorization: `Bearer ${token ?? publishableKey ?? ''}`,
    'Content-Type': 'application/json',
  };
}

function toUser(data: AuthSessionPayload): AuthUser {
  return {
    id: data.user.id,
    email: data.user.email,
    // Display metadata is presentation-only. Authorization is always decided
    // by database roles and RLS, never by user-editable metadata.
    displayName: data.user.user_metadata?.display_name || data.user.email.split('@')[0],
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
}

export function getStoredSession(): StoredSession | null {
  const session=readStoredSession();
  if(!session)return null;
  const now=Date.now();
  if(
    now-session.lastActivityAt>sessionIdleTimeoutMs
    ||now-session.createdAt>sessionAbsoluteTimeoutMs
  ){
    clearStoredSession();
    void revokeServerSession(session.accessToken).catch(()=>{});
    return null;
  }
  return session;
}

export function markSessionActivity(){
  const session=getStoredSession();
  if(!session||Date.now()-session.lastActivityAt<activityWriteIntervalMs)return;
  const updated={...session,lastActivityAt:Date.now()};
  sessionStorage.setItem(sessionStorageKey,JSON.stringify(updated));
}

export async function signUp(email: string, password: string, displayName: string) {
  requireSupabaseConfiguration();
  const requestBody=parseAuthSignupRequest({email,password,displayName});
  const response = await fetchWithDeadline('/api/auth/signup', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    credentials:'same-origin',
    body: JSON.stringify(requestBody),
  });
  const responseBody = await readBoundedJson(response);
  if (!response.ok) throw authenticationApiError(response,responseBody,'auth_signup_error');
  const result=parseSignupResponse(responseBody);
  if (result.session) {
    const user=toUser(result.session);
    const session = storeSession(result.session,user);
    return { session, needsEmailConfirmation: false };
  }
  return { session: null, needsEmailConfirmation: true };
}

export async function signIn(email: string, password: string) {
  requireSupabaseConfiguration();
  const requestBody=parseAuthLoginRequest({email,password});
  const response = await fetchWithDeadline('/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'}, credentials:'same-origin',
    body: JSON.stringify(requestBody),
  });
  const responseBody=await readBoundedJson(response);
  if (!response.ok) throw authenticationApiError(response,responseBody,'auth_login_error');
  const data=parseLoginResponse(responseBody);
  if('mfa_required' in data){
    return {
      mfaRequired:true,
      pendingAccessToken:data.pending_access_token,
      expiresAt:decodeJwtExpiry(data.pending_access_token)??Date.now()+(data.expires_in||300)*1000,
      factors:data.factors,
    } satisfies MfaLoginChallenge;
  }
  return storeSession(data,toUser(data));
}

async function mfaRequest(accessToken:string,body:unknown):Promise<unknown>{
  const bearerToken=parseAuthBearerToken(accessToken,'auth_mfa_request');
  const requestBody=parseAuthMfaRequest(body);
  const response=await fetchWithDeadline('/api/auth/mfa',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${bearerToken}`,
    },
    credentials:'same-origin',
    body:JSON.stringify(requestBody),
  });
  const data=await readBoundedJson(response);
  if(!response.ok)throw authenticationApiError(response,data,'auth_mfa_error');
  if(!data)throw new Error('Authenticator security returned an invalid response.');
  return data;
}

function storeVerifiedMfaSession(data:AuthSessionPayload,previous?:StoredSession){
  const claims=decodeJwtPayload(data.access_token);
  if(claims?.aal!=='aal2')throw new Error('Multi-factor verification did not reach the required security level.');
  return storeSession(data,toUser(data),previous);
}

export async function verifyMfaLogin(challenge:MfaLoginChallenge,factorId:string,code:string){
  if(Date.now()>=challenge.expiresAt)throw new Error('This sign-in attempt expired. Enter your password again.');
  const data=parseAuthSession(await mfaRequest(challenge.pendingAccessToken,{
    action:'challenge_and_verify',
    purpose:'login',
    factorId,
    code:code.trim(),
  }),'mfa_session');
  return storeVerifiedMfaSession(data);
}

export async function getMfaStatus(session:StoredSession){
  const current=await sessionForRemoteRevocation(session);
  return parseMfaStatusResponse(await mfaRequest(current.accessToken,{action:'list'}));
}

export async function startMfaEnrollment(session:StoredSession,friendlyName:string){
  const current=await sessionForRemoteRevocation(session);
  return parseMfaEnrollmentResponse(await mfaRequest(current.accessToken,{
    action:'enroll',
    friendlyName:friendlyName.trim(),
  }));
}

async function verifyMfaFactor(
  session:StoredSession,
  factorId:string,
  code:string,
  purpose:'enrollment'|'step_up',
){
  const current=await sessionForRemoteRevocation(session);
  const data=parseAuthSession(await mfaRequest(current.accessToken,{
    action:'challenge_and_verify',
    purpose,
    factorId,
    code:code.trim(),
  }),'mfa_session');
  return storeVerifiedMfaSession(data,current);
}

export async function verifyMfaEnrollment(session:StoredSession,factorId:string,code:string){
  return verifyMfaFactor(session,factorId,code,'enrollment');
}

export async function verifyMfaStepUp(session:StoredSession,factorId:string,code:string){
  return verifyMfaFactor(session,factorId,code,'step_up');
}

export async function unenrollMfaFactor(session:StoredSession,factorId:string){
  const current=await sessionForRemoteRevocation(session);
  const data=parseAuthSession(
    await mfaRequest(current.accessToken,{action:'unenroll',factorId}),
    'mfa_session',
  );
  return storeSession(data,toUser(data),current);
}

export async function cancelMfaEnrollment(session:StoredSession,factorId:string){
  const current=await sessionForRemoteRevocation(session);
  const data=parseAuthSession(
    await mfaRequest(current.accessToken,{action:'cancel_enrollment',factorId}),
    'mfa_session',
  );
  return storeSession(data,toUser(data),current);
}

export async function refreshSession(session:StoredSession){
  const current=getStoredSession();
  if(!current||current.user.id!==session.user.id)throw new Error('Your session expired. Please sign in again.');
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    const requestBody=parseAuthRefreshRequest({});
    const response=await fetchWithDeadline('/api/auth/refresh',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify(requestBody),
    });
    const responseBody=await readBoundedJson(response);
    if(!response.ok)throw authenticationApiError(response,responseBody,'auth_refresh_error');
    const data=parseAuthSession(responseBody,'auth_refresh');
    return storeSession(data,toUser(data),current);
  })();
  try{return await refreshPromise}finally{refreshPromise=null}
}

function expireSession(){
  const session=readStoredSession();
  clearStoredSession();
  void revokeServerSession(session?.accessToken).catch(()=>{});
  window.dispatchEvent(new Event(sessionExpiredEvent));
}

async function authenticatedFetch(session:StoredSession,input:RequestInfo|URL,init:RequestInit={}){
  let current=getStoredSession();
  if(!current||current.user.id!==session.user.id){
    expireSession();
    throw new Error('Your session expired. Please sign in again.');
  }
  const renew=async()=>{
    try{return await refreshSession(current!)}catch(error){
      if(isTransientAuthenticationError(error))throw error;
      expireSession();
      throw error instanceof Error?error:new Error('Your session expired. Please sign in again.');
    }
  };
  if(!current.expiresAt||current.expiresAt-Date.now()<60_000)current=await renew();
  const send=(token:string)=>{
    const requestHeaders=new Headers(init.headers);
    requestHeaders.set('apikey',publishableKey??'');
    requestHeaders.set('Authorization',`Bearer ${token}`);
    return fetchWithDeadline(input,{...init,headers:requestHeaders});
  };
  let response=await send(current.accessToken);
  if(response.status===401){
    current=await renew();
    response=await send(current.accessToken);
  }
  if(response.status===403){
    const body=await readBoundedText(response.clone(),16_384).catch(()=>'');
    if(/DEALIVRA_MFA_REQUIRED|mfa_required|multi-factor verification is required/i.test(body)){
      window.dispatchEvent(new Event(mfaRequiredEvent));
    }
  }
  return response;
}

export async function requestPasswordReset(email:string){
  const requestBody=parseAuthRecoverRequest({email});
  const response=await fetchWithDeadline('/api/auth/recover',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify(requestBody),
  });
  const data=await readBoundedJson(response);
  if(!response.ok)throw authenticationApiError(response,data,'auth_recover_error');
}
export async function updateRecoveredPassword(accessToken:string,password:string){
  const bearerToken=parseAuthBearerToken(accessToken,'auth_password_request');
  const requestBody=parseAuthPasswordRequest({
    action:'recovery',
    newPassword:password,
  });
  const response=await fetchWithDeadline('/api/auth/password',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${bearerToken}`,
    },
    credentials:'same-origin',
    body:JSON.stringify(requestBody),
  });
  if(!response.ok){
    const data=await readBoundedJson(response);
    throw authenticationApiError(response,data,'auth_password_error');
  }
  clearStoredSession();
}

export async function updateAccountName(session:StoredSession,displayName:string){
  const request=parseAccountNameUpdateRequest({
    userId:session.user.id,
    displayName,
  });
  const authResponse=await authenticatedFetch(
    session,
    `${supabaseUrl}/auth/v1/user`,
    {
      method:'PUT',
      headers:headers(session.accessToken),
      body:JSON.stringify(request.authBody),
    },
  );
  if(!authResponse.ok){
    const data=await readBoundedJson(authResponse);
    parseAccountAuthErrorEnvelope(data,authResponse.status);
    throw new Error('Could not update account name. Please try again.');
  }
  const profileResponse=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(request.userId)}`,
    {
      method:'PATCH',
      headers:{...headers(session.accessToken),Prefer:'return=minimal'},
      body:JSON.stringify(request.profileBody),
    },
  );
  if(!profileResponse.ok){
    const profileError=await readBoundedJson(profileResponse);
    let authRollbackSucceeded=false;
    try{
      const rollbackRequest=parseAccountNameUpdateRequest({
        userId:request.userId,
        displayName:session.user.displayName,
      });
      const rollbackResponse=await authenticatedFetch(
        session,
        `${supabaseUrl}/auth/v1/user`,
        {
          method:'PUT',
          headers:headers(session.accessToken),
          body:JSON.stringify(rollbackRequest.authBody),
        },
      );
      if(rollbackResponse.ok){
        authRollbackSucceeded=true;
      }else{
        const rollbackError=await readBoundedJson(rollbackResponse);
        parseAccountAuthErrorEnvelope(rollbackError,rollbackResponse.status);
      }
    }catch{
      // Preserve the original profile failure. The next sign-in refreshes the
      // canonical profile while operations can investigate the safe boundary
      // diagnostic without exposing customer data.
    }
    parseAccountProfileErrorEnvelope(profileError,profileResponse.status);
    throw new Error(
      authRollbackSucceeded
        ?'Could not update profile name. Please try again.'
        :'Account name update could not be completed. Sign out and try again.',
    );
  }
  const current=getStoredSession()||session;
  const updated:StoredSession={
    ...current,
    user:{...current.user,displayName:request.displayName},
  };
  sessionStorage.setItem(sessionStorageKey,JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent<StoredSession>(sessionUpdatedEvent,{detail:updated}));
  return updated;
}

export async function updateAccountPassword(session:StoredSession,currentPassword:string,password:string){
  const bearerToken=parseAuthBearerToken(session.accessToken,'auth_password_request');
  const requestBody=parseAuthPasswordRequest({
    action:'change',
    currentPassword,
    newPassword:password,
  });
  const response=await fetchWithDeadline('/api/auth/password',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${bearerToken}`,
    },
    credentials:'same-origin',
    body:JSON.stringify(requestBody),
  });
  if(!response.ok){
    const data=await readBoundedJson(response);
    throw authenticationApiError(response,data,'auth_password_error');
  }
  clearStoredSession();
}

export async function signOut(session:StoredSession|null=getStoredSession()){
  clearStoredSession();
  await revokeServerSession(session?.accessToken,'local').catch(()=>{});
}

async function sessionForRemoteRevocation(session:StoredSession){
  const current=getStoredSession();
  if(!current||current.user.id!==session.user.id){
    throw new Error('Your session expired. Please sign in again.');
  }
  return !current.expiresAt||current.expiresAt-Date.now()<60_000
    ?refreshSession(current)
    :current;
}

export async function signOutOtherSessions(session:StoredSession){
  const current=await sessionForRemoteRevocation(session);
  await revokeServerSession(current.accessToken,'others');
}

export async function signOutEverywhere(session:StoredSession){
  const current=await sessionForRemoteRevocation(session);
  await revokeServerSession(current.accessToken,'global');
  clearStoredSession();
}

async function accountEmailConfirmed(session:StoredSession){
  const response=await authenticatedFetch(session,`${supabaseUrl}/auth/v1/user`,{headers:headers(session.accessToken)});
  if(!response.ok)return false;
  const account=await readBoundedJson(response) as {email_confirmed_at?:string|null};
  return Boolean(account.email_confirmed_at);
}

function mapDeal(row: DealRowPayload, sellerName: string, viewerId?: string, sellerContactVerified=false) {
  const viewerRole: Deal['viewerRole'] = viewerId ? (row.seller_id===viewerId?'seller':row.buyer_id===viewerId?'buyer':'visitor') : 'visitor';
  const catalog: Deal['catalog'] = {
    categoryId: row.category_id || 'general',
    catalogVersion: row.catalog_version || 'legacy',
    brandId: row.catalog_brand_id || undefined,
    brandLabel: row.catalog_brand_label || undefined,
    modelId: row.catalog_model_id || undefined,
    modelLabel: row.catalog_model_label || undefined,
    modelYear: row.model_year || undefined,
    variantId: row.catalog_variant_id || undefined,
    variantLabel: row.catalog_variant_label || undefined,
  };
  return {
    id: row.id, publicId: row.public_id, title: row.title, description: row.description,
    priceCents: row.price_cents, currency: row.currency, condition: row.condition,
    serialNumber: row.serial_last_four ? `•••• ${row.serial_last_four}` : undefined,
    deliveryMethod: row.delivery_method, status: row.status, sellerName,
    sellerContactVerified,
    sellerVerification: 'not_started' as const,
    agreementVersion: row.current_agreement_version, createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    mediaUrls: (row.deal_media || []).sort((a,b)=>a.sort_order-b.sort_order).map(item=>publicMediaUrl(item.storage_path)),
    catalog,
    viewerRole,
  };
}

function catalogWriteColumns(draft: DealDraft) {
  const catalog=draft.catalog;
  return {
    category_id:catalog?.categoryId||'general',
    catalog_version:catalog?.catalogVersion||'legacy',
    catalog_brand_id:catalog?.brandId||null,
    catalog_brand_label:catalog?.brandLabel||null,
    catalog_model_id:catalog?.modelId||null,
    catalog_model_label:catalog?.modelLabel||null,
    model_year:catalog?.modelYear||null,
    catalog_variant_id:catalog?.variantId||null,
    catalog_variant_label:catalog?.variantLabel||null,
  };
}

export async function listUserDeals(session: StoredSession) {
  const [response,sellerContactVerified] = await Promise.all([
    authenticatedFetch(session,`${supabaseUrl}/rest/v1/deals?select=*,deal_media(storage_path,sort_order)&order=created_at.desc`, {headers: headers(session.accessToken)}),
    accountEmailConfirmed(session)
  ]);
  if (!response.ok) throw new Error('Could not load your deals');
  const rows = parseUserDealRows(await readBoundedJson(response));
  return rows.map(row => mapDeal(row, session.user.displayName, session.user.id, sellerContactVerified));
}

function publicMediaUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function uploadDealPhotos(session: StoredSession, dealId: string, files: File[], startIndex=0) {
  const batch=parseMediaUploadBatchRequest({
    dealId,
    ownerId:session.user.id,
    startIndex,
    fileCount:files.length,
  });
  if(files.filter(file=>isVideoUpload(file)).length>1){
    throw new Error('Only one item video is allowed per deal.');
  }
  const urls: string[] = [];
  for (let index=0; index<files.length; index++) {
    const file=await prepareMediaUpload(files[index]);
    const isVideo=isVideoUpload(file);
    if(file.size>(isVideo?25:6)*1024*1024)throw new Error(`${isVideo?'Video':'Photo'} ${index+1} is too large`);
    if(!['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm'].includes(file.type)&&!/^.+\.(jpe?g|png|webp|heic|mp4|webm)$/i.test(file.name))throw new Error(`File ${index+1} has an unsupported format`);
    const extension=file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path=`${batch.ownerId}/${batch.dealId}/${crypto.randomUUID()}.${extension}`;
    const upload=await authenticatedFetch(session,`${supabaseUrl}/storage/v1/object/deal-media/${path}`,{method:'POST',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`,'Content-Type':file.type||(isVideo?'video/mp4':'image/jpeg'),'x-upsert':'false'},body:file});
    if(!upload.ok) throw new Error(`Photo ${index+1} could not be uploaded`);
    const requestBody=parseMediaRecordInsertRequest({
      deal_id:batch.dealId,
      storage_path:path,
      sort_order:batch.startIndex+index,
    },batch.ownerId);
    const record=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_media`,{method:'POST',headers:{...headers(session.accessToken),Prefer:'return=minimal'},body:JSON.stringify(requestBody)});
    if(!record.ok){
      const errorPayload=await readBoundedJson(record);
      await authenticatedFetch(
        session,
        `${supabaseUrl}/storage/v1/object/deal-media/${path.split('/').map(encodeURIComponent).join('/')}`,
        {
          method:'DELETE',
          headers:{
            apikey:publishableKey??'',
            Authorization:`Bearer ${session.accessToken}`,
          },
        },
      ).catch(()=>undefined);
      parseDealMutationPostgrestErrorEnvelope(
        errorPayload,
        record.status,
        'media_record_insert_error',
      );
      throw new Error(`Photo ${index+1} could not be linked to the deal`);
    }
    urls.push(publicMediaUrl(path));
  }
  return urls;
}

async function invokeEvidenceFiles(session:StoredSession,body:Record<string,unknown>):Promise<unknown>{
  const requestBody=parseEvidenceFilesRequest(body);
  const response=await authenticatedFetch(session,`${supabaseUrl}/functions/v1/evidence-files`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});
  const data=await readBoundedJson(response);
  if(!response.ok){
    throw new Error(parseEvidenceEdgeErrorEnvelope(data,response.status,'evidence_files_error').message);
  }
  if(!data)throw new Error('The secure file service returned an invalid response.');
  return data;
}
async function invokeEvidenceMaintenance(session:StoredSession,body:Record<string,unknown>):Promise<unknown>{
  const requestBody=parseEvidenceMaintenanceRequest(body);
  const response=await authenticatedFetch(session,`${supabaseUrl}/functions/v1/evidence-maintenance`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});
  const data=await readBoundedJson(response);
  if(!response.ok){
    throw new Error(parseEvidenceEdgeErrorEnvelope(data,response.status,'evidence_maintenance_error').message);
  }
  if(!data)throw new Error('The evidence lifecycle service returned an invalid response.');
  return data;
}
export async function getEvidenceLifecycleSnapshot(session:StoredSession){
  return parseEvidenceLifecycleSnapshotResponse(await invokeEvidenceMaintenance(session,{action:'snapshot'}));
}
export async function refreshEvidenceLifecycleInventory(session:StoredSession){
  parseEvidenceInventoryResponse(await invokeEvidenceMaintenance(session,{action:'refresh-inventory'}));
}
export async function approveEvidenceDeletion(session:StoredSession,evidenceId:string,reason:string){
  parseEvidenceJobIdResponse(await invokeEvidenceMaintenance(session,{action:'approve-deletion',evidenceId,reason}));
}
export async function placeEvidenceLegalHold(session:StoredSession,evidenceId:string,reason:string){
  return parseEvidenceHoldKeyResponse(await invokeEvidenceMaintenance(session,{action:'place-legal-hold',evidenceId,reason}));
}
export async function releaseEvidenceLegalHold(session:StoredSession,evidenceId:string,holdKey:string,reason:string){
  parseEvidenceHoldKeyResponse(await invokeEvidenceMaintenance(session,{action:'release-legal-hold',evidenceId,holdKey,reason}),holdKey);
}
export async function acknowledgeEvidenceLifecycleAlert(session:StoredSession,alertId:string){
  parseEvidenceAlertAcknowledgementResponse(await invokeEvidenceMaintenance(session,{action:'acknowledge-alert',alertId}));
}
function normalizeEvidenceVideo(file:File){
  const extension=file.name.split('.').pop()?.toLowerCase();
  const mimeType=file.type==='video/quicktime'||extension==='mov'
    ?'video/quicktime'
    :file.type==='video/webm'||extension==='webm'
    ?'video/webm'
    :file.type==='video/mp4'||extension==='mp4'
    ?'video/mp4'
    :'';
  if(!mimeType)throw new Error('Choose an MP4, MOV, or WebM video.');
  return file.type===mimeType?file:new File([file],file.name,{type:mimeType,lastModified:file.lastModified});
}
export async function uploadDealEvidence(session:StoredSession,dealId:string,uploaderRole:'seller'|'buyer',evidenceType:EvidenceType,file:File){
  const preparedFile=isVideoUpload(file)?normalizeEvidenceVideo(file):await prepareMediaUpload(file);
  const declaration={claimedMimeType:preparedFile.type,evidenceType,fileName:preparedFile.name,fileSize:preparedFile.size,role:uploaderRole};
  const validation=validateEvidenceDeclaration(declaration);
  if(!validation.ok)throw new Error(validation.message);
  const byteValidation=validateEvidenceBytes(new Uint8Array(await readExactBlobArrayBuffer(preparedFile,preparedFile.size)),declaration);
  if(!byteValidation.ok)throw new Error(byteValidation.message);
  const intake=parseEvidenceUploadIntakeResponse(await invokeEvidenceFiles(session,{
    action:'request-upload',
    dealId,
    uploaderRole,
    evidenceType,
    fileName:preparedFile.name,
    claimedMimeType:preparedFile.type,
    fileSize:preparedFile.size
  }),session.user.id,dealId);
  const encodedPath=intake.path.split('/').map(encodeURIComponent).join('/');
  const upload=await authenticatedFetch(session,`${supabaseUrl}/storage/v1/object/${intake.bucket}/${encodedPath}`,{method:'POST',headers:{apikey:publishableKey??'',Authorization:`Bearer ${session.accessToken}`,'Content-Type':preparedFile.type,'x-upsert':'false'},body:preparedFile});
  if(!upload.ok){const data=await readBoundedJson(upload);throw new Error(parseStorageErrorEnvelope(data,upload.status).message);}
  const result=parseFinalizeEvidenceResponse(await invokeEvidenceFiles(session,{action:'finalize-upload',intakeId:intake.intakeId}),dealId,uploaderRole);
  return result.evidence;
}
export async function listDealEvidence(session:StoredSession,dealId:string){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_evidence_safe?deal_id=eq.${encodeURIComponent(dealId)}&select=*&order=created_at.desc`,{headers:headers(session.accessToken)});if(!response.ok){const data=await readBoundedJson(response);throw new Error(parsePostgrestErrorEnvelope(data,response.status,'evidence_list_error').message);}return parseDealEvidenceRows(await readBoundedJson(response),dealId)}
async function evidenceViewerSha256(bytes:ArrayBuffer){
  if(!globalThis.crypto?.subtle)throw new Error('Secure file verification is unavailable in this browser.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function loadDealEvidenceViewer(session:StoredSession,evidenceId:string):Promise<DealEvidenceViewer>{
  if(!supabaseUrl)throw new Error(configurationUnavailableMessage);
  const data=parseEvidenceSignedViewerResponse(await invokeEvidenceFiles(session,{action:'signed-url',evidenceId}),supabaseUrl);
  const signedUrl=new URL(data.url);
  const expectedStorageOrigin=new URL(supabaseUrl).origin;
  if(signedUrl.origin!==expectedStorageOrigin||!signedUrl.pathname.startsWith('/storage/v1/object/sign/deal-evidence/')){
    throw new Error('The verified evidence link is not trusted.');
  }
  const response=await fetchWithDeadline(signedUrl,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('The verified evidence file could not be loaded.');
  const responseMimeType=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(responseMimeType&&responseMimeType!==data.mimeType)throw new Error('The evidence file type changed during secure viewing.');
  const bytes=await readExactArrayBuffer(response,data.fileSizeBytes).catch(()=>{
    throw new Error('The evidence file size changed during secure viewing.');
  });
  if(await evidenceViewerSha256(bytes)!==data.sha256)throw new Error('The evidence fingerprint changed during secure viewing.');
  const fileName=(data.fileName||'evidence-file').replace(/[\u0000-\u001f\u007f/\\]+/gu,'-').slice(0,160)||'evidence-file';
  return {
    objectUrl:URL.createObjectURL(new Blob([bytes],{type:data.mimeType})),
    expiresAt:data.expiresAt,
    mimeType:data.mimeType,
    fileName,
    fileSizeBytes:data.fileSizeBytes,
    sha256:data.sha256,
    scanStatus:'clean',
    scannedAt:data.scannedAt,
    integrityStatus:'verified',
    integrityCheckedAt:data.integrityCheckedAt
  };
}

export async function deleteDealMedia(
  session:StoredSession,
  dealId:string,
  publicUrl:string,
){
  const request=parseMediaDeleteRequest({
    dealId,
    ownerId:session.user.id,
    publicUrl,
    supabaseUrl,
  });
  const encodedPath=request.storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const removeObject=await authenticatedFetch(
    session,
    `${supabaseUrl}/storage/v1/object/deal-media/${encodedPath}`,
    {
      method:'DELETE',
      headers:{
        apikey:publishableKey??'',
        Authorization:`Bearer ${session.accessToken}`,
      },
    },
  );
  if(!removeObject.ok)throw new Error('Could not remove the stored file');
  const removeRecord=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/deal_media?deal_id=eq.${request.dealId}&storage_path=eq.${encodeURIComponent(request.storagePath)}`,
    {
      method:'DELETE',
      headers:{...headers(session.accessToken),Prefer:'return=minimal'},
    },
  );
  if(!removeRecord.ok){
    parseDealMutationPostgrestErrorEnvelope(
      await readBoundedJson(removeRecord),
      removeRecord.status,
      'media_delete_error',
    );
    throw new Error('File removed, but its record could not be cleaned up');
  }
}

export async function reorderDealMedia(
  session:StoredSession,
  dealId:string,
  publicUrls:string[],
){
  const requestBody=parseMediaReorderRequest({
    dealId,
    ownerId:session.user.id,
    publicUrls,
    supabaseUrl,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/reorder_deal_media`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(requestBody),
    },
  );
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      await readBoundedJson(response),
      response.status,
      'media_reorder_error',
    );
    throw new Error('Could not reorder media');
  }
}

export async function updatePublishedDeal(
  session:StoredSession,
  dealId:string,
  draft:DealDraft,
){
  const normalizedDealId=parseDealIdRequest(
    {dealId},
    'deal_update_published_request',
  );
  const requestBody=parsePublishedDealUpdateRequest({
    p_deal_id:normalizedDealId,
    p_title:draft.title,
    p_description:draft.description,
    p_price_cents:toMinorUnits(draft.price,draft.currency),
    p_condition:draft.condition,
    p_delivery_method:draft.deliveryMethod,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/update_published_deal`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(requestBody),
    },
  );
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      await readBoundedJson(response),
      response.status,
      'deal_update_published_error',
    );
    throw new Error('Could not update deal');
  }
  return parsePublishedDealVersionResponse(
    await readBoundedJson(response),
  );
}

export async function createUserDeal(session: StoredSession, draft: DealDraft) {
  const saved=await saveUserDealDraft(session,draft);
  return publishUserDealDraft(session,saved.id,draft);
}

export async function saveUserDealDraft(session:StoredSession,draft:DealDraft){
  const expirationDays=parseDealExpirationDays(
    draft.expiresInDays??7,
    'deal_draft_create_request',
  );
  const serial=draft.serialNumber.trim();
  const requestBody=parseDealDraftCreateRequest({
    seller_id:session.user.id,
    title:draft.title,
    description:draft.description,
    price_cents:toMinorUnits(draft.price,draft.currency),
    currency:draft.currency,
    condition:draft.condition,
    serial_last_four:serial?serial.slice(-4):null,
    delivery_method:draft.deliveryMethod,
    status:'draft',
    current_agreement_version:0,
    published_at:null,
    expires_at:new Date(
      Date.now()+expirationDays*24*60*60*1000,
    ).toISOString(),
    ...catalogWriteColumns(draft),
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/deals`,
    {
      method:'POST',
      headers:{
        ...headers(session.accessToken),
        Prefer:'return=representation',
      },
      body:JSON.stringify(requestBody),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      data,
      response.status,
      'deal_draft_create_error',
    );
    throw new Error('Could not save draft');
  }
  const row=parseUserDealRows(data)[0];
  if(!row)throw new Error('Could not save draft');
  return mapDeal(row,session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export async function updateUserDealDraft(session:StoredSession,dealId:string,draft:DealDraft){
  const context=parseDealOwnerContext(
    {dealId,ownerId:session.user.id},
    'deal_draft_update_request',
  );
  const expirationDays=parseDealExpirationDays(
    draft.expiresInDays??7,
    'deal_draft_update_request',
  );
  const serial=draft.serialNumber.trim();
  const requestBody=parseDealDraftUpdateRequest({
    title:draft.title,
    description:draft.description,
    price_cents:toMinorUnits(draft.price,draft.currency),
    currency:draft.currency,
    condition:draft.condition,
    serial_last_four:serial?serial.slice(-4):null,
    delivery_method:draft.deliveryMethod,
    expires_at:new Date(
      Date.now()+expirationDays*24*60*60*1000,
    ).toISOString(),
    updated_at:new Date().toISOString(),
    ...catalogWriteColumns(draft),
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/deals?id=eq.${context.dealId}&seller_id=eq.${context.ownerId}&status=eq.draft`,
    {
      method:'PATCH',
      headers:{
        ...headers(session.accessToken),
        Prefer:'return=representation',
      },
      body:JSON.stringify(requestBody),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      data,
      response.status,
      'deal_draft_update_error',
    );
    throw new Error('Could not update draft');
  }
  const row=parseUserDealRows(data)[0];
  if(!row)throw new Error('Draft was not found');
  return mapDeal(row,session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export async function publishUserDealDraft(session:StoredSession,dealId:string,draft:DealDraft){
  const serial=draft.serialNumber.trim();
  const requestBody=parseDealPublishRequest({
    p_deal_id:dealId,
    p_title:draft.title,
    p_description:draft.description,
    p_price_cents:toMinorUnits(draft.price,draft.currency),
    p_currency:draft.currency,
    p_condition:draft.condition,
    p_serial_last_four:serial?serial.slice(-4):null,
    p_delivery_method:draft.deliveryMethod,
    p_expires_in_days:draft.expiresInDays??7,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/publish_deal_with_seller_declarations`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(requestBody),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      data,
      response.status,
      'deal_publish_error',
    );
    throw new Error('Could not publish draft');
  }
  const row=parseUserDealRows(data)[0];
  if(!row)throw new Error('Draft was not found');
  return mapDeal(row,session.user.displayName,session.user.id,await accountEmailConfirmed(session));
}

export type DealMeeting = DealMeetingPayload;

export async function getDealMeeting(session: StoredSession, dealId: string) {
  const requestBody=parseDealMeetingReadRequest({p_deal_id:dealId});
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_meetings?deal_id=eq.${requestBody.p_deal_id}&select=id,deal_id,proposed_by,location_name,address,scheduled_at,status,seller_arrived,buyer_arrived`,{headers:headers(session.accessToken)});
  if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_meeting_read_error');throw new Error('Could not load meeting')}
  return parseDealMeetingRows(await readBoundedJson(response))[0] || null;
}

export async function proposeMeeting(session:StoredSession,dealId:string,locationName:string,address:string,scheduledAt:string){
  const requestBody=parseMeetingProposalRequest({p_deal_id:dealId,p_location_name:locationName,p_address:address,p_scheduled_at:scheduledAt});
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/propose_meeting`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});
  if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'meeting_proposal_error');throw new Error('Could not propose meeting')}
}
export async function confirmMeeting(session:StoredSession,dealId:string){
  const requestBody=parseMeetingConfirmationRequest({p_deal_id:dealId});
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/confirm_meeting`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});
  if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'meeting_confirmation_error');throw new Error('Could not confirm meeting')}
}
export async function markArrived(session:StoredSession,dealId:string){const requestBody=parseMeetingArrivalRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_arrived`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'meeting_arrival_error');throw new Error('Could not mark arrival')}}
export async function generateHandoffPin(session:StoredSession,dealId:string){const requestBody=parseHandoffPinGenerateRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/generate_handoff_pin`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'handoff_pin_generate_error');throw new Error('Could not generate PIN')}return parseHandoffPinResponse(await readBoundedJson(response))}
export async function completeHandoff(session:StoredSession,dealId:string,pin:string){const requestBody=parseHandoffCompleteRequest({p_deal_id:dealId,p_pin:pin});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/complete_handoff`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'handoff_complete_error');throw new Error('Could not complete deal')}}
export async function submitRating(session:StoredSession,dealId:string,stars:number,comment:string){const requestBody=parseRatingSubmitRequest({p_deal_id:dealId,p_stars:stars,p_comment:comment});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/submit_rating`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAccountActivityPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'rating_submit_error');throw new Error('Could not submit rating')}}
export async function getMyProfileSummary(session:StoredSession){const requestBody=parseProfileSummaryRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_profile_summary`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAccountActivityPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'profile_summary_error');throw new Error('Could not load profile')}const rows=parseProfileSummaryRows(await readBoundedJson(response));if(!rows[0])throw new Error('Profile was not found');return rows[0]}
export async function getMyAccountSessions(session:StoredSession){const requestBody=parseAccountSessionsRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_account_sessions`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAccountActivityPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'account_sessions_error');throw new Error('Could not load signed-in devices')}return parseAccountSessionRows(await readBoundedJson(response))}
export async function requestIdentityVerification(session:StoredSession){const requestBody=parseIdentityVerificationRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/request_identity_verification`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAccountActivityPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'identity_verification_error');throw new Error('Could not request verification')}return parseIdentityVerificationResponse(await readBoundedJson(response))}
export async function cancelDeal(
  session:StoredSession,
  dealId:string,
  reason:string,
){
  const requestBody=parseDealCancelRequest({
    p_deal_id:dealId,
    p_reason:reason,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/cancel_deal`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(requestBody),
    },
  );
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      await readBoundedJson(response),
      response.status,
      'deal_cancel_error',
    );
    throw new Error('Could not cancel deal');
  }
}
export async function openDealDispute(session:StoredSession,dealId:string,reason:string){const requestBody=parseOpenDisputeRequest({p_deal_id:dealId,p_reason:reason});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/open_deal_dispute`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parsePostgrestErrorEnvelope(d,response.status,'dispute_open_error').message)}}
export async function reportPublicDeal(session:StoredSession,publicId:string,category:string,details:string){const requestBody=parseSafetyReportRequest({p_public_id:publicId,p_category:category,p_details:details});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/report_public_deal`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'safety_report_create_error').message)}return parseSafetyReportIdResponse(await readBoundedJson(response))}
export async function getAdminAccess(session:StoredSession){const requestBody=parseAdminAccessRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_dealsafe_admin`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok)return false;return parseAdminAccessResponse(await readBoundedJson(response))}
export async function getAdminRevenueSummary(session:StoredSession){const requestBody=parseAdminRevenueSummaryRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_revenue_summary`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseAdminPostgrestErrorEnvelope(d,response.status,'admin_revenue_summary_error').message)}return parseAdminRevenueSummaryRows(await readBoundedJson(response))}
export async function getAdminRevenueTransactions(session:StoredSession,limit=100){const requestBody=parseAdminRevenueTransactionsRequest({p_limit:limit});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_revenue_transactions`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseAdminPostgrestErrorEnvelope(d,response.status,'admin_revenue_transactions_error').message)}return parseAdminRevenueTransactionRows(await readBoundedJson(response))}
export async function getAdminCatalogAdoption(session:StoredSession,days:7|30|90=30){const requestBody=parseAdminCatalogAdoptionRequest({p_days:days});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_catalog_adoption`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseAdminPostgrestErrorEnvelope(d,response.status,'admin_catalog_adoption_error').message)}return parseAdminCatalogAdoptionRows(await readBoundedJson(response),requestBody.p_days)}
export async function getAdminReports(session:StoredSession,status:'open'|'reviewed'|'dismissed'|'all'='open'){const requestBody=parseAdminReportListRequest({p_status:status});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_reports`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'admin_report_list_error').message)}return parseAdminReportRows(await readBoundedJson(response))}
export async function resolveAdminReport(session:StoredSession,reportId:string,decision:'reviewed'|'dismissed',note:string){const requestBody=parseAdminReportResolutionRequest({p_report_id:reportId,p_decision:decision,p_resolution_note:note});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/resolve_deal_report`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'admin_report_resolve_error').message)}}
export async function getAdminDisputes(session:StoredSession,status:'open'|'resolved'|'all'='open'){const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_admin_disputes`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify({p_status:status})});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parsePostgrestErrorEnvelope(d,response.status,'dispute_queue_error').message)}return parseAdminDisputeRows(await readBoundedJson(response))}
export async function resolveAdminDispute(session:StoredSession,disputeId:string,decision:'resolved_buyer'|'resolved_seller'|'cancelled',note:string){const requestBody=parseResolveDisputeRequest({p_dispute_id:disputeId,p_decision:decision,p_resolution_note:note});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/resolve_deal_dispute`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parsePostgrestErrorEnvelope(d,response.status,'dispute_resolve_error').message)}}
export async function resolveAdminDisputeFinancial(session:StoredSession,disputeId:string,decision:'resolved_buyer'|'resolved_seller',note:string){const requestBody=parseFinancialDisputeRequest({disputeId,decision,note});return parseStripeDisputeResolutionResponse(await invokeEdgeFunction(session,'stripe-resolve-dispute',{...requestBody}))}
export async function setAdminDealVisibility(session:StoredSession,dealId:string,status:'visible'|'hidden',note:string){const requestBody=parseDealModerationRequest({p_deal_id:dealId,p_status:status,p_note:note});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_moderation_status`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'deal_moderation_error').message)}}
export async function getDealRiskAssessment(publicId:string){const requestBody=parseDealRiskRequest({p_public_id:publicId});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_deal_risk_assessment`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseTrustPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_risk_error');throw new Error('Risk check is unavailable')}return parseDealRiskAssessmentRows(await readBoundedJson(response))}
export async function getPublicSellerTrustProfile(publicId:string){const requestBody=parsePublicSellerTrustRequest({p_public_id:publicId});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_public_seller_trust_profile`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseTrustPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'public_seller_trust_error');throw new Error('Seller trust profile is unavailable')}return parsePublicSellerTrustProfileRows(await readBoundedJson(response))}
export async function getTrustPassportSettings(session:StoredSession){const requestBody=parseTrustPassportSettingsRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_trust_passport_settings`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseTrustPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'trust_passport_settings_error');throw new Error('Could not load passport settings')}return parseTrustPassportSettingsRows(await readBoundedJson(response))}
export async function setTrustPassportEnabled(session:StoredSession,enabled:boolean){const requestBody=parseTrustPassportToggleRequest({p_enabled:enabled});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_trust_passport_enabled`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseTrustPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'trust_passport_toggle_error');throw new Error('Could not update passport settings')}return parseTrustPassportToggleResponse(await readBoundedJson(response))}
export async function getPublicTrustPassport(publicId:string){const requestBody=parsePublicTrustPassportRequest({p_public_id:publicId});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_public_trust_passport`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseTrustPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'public_trust_passport_error');throw new Error('Passport unavailable')}return parsePublicTrustPassportRows(await readBoundedJson(response))}
export async function getPublicSellerDeclaration(publicId:string){const requestBody=parseSellerDeclarationRequest({p_public_id:publicId});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_public_seller_declaration`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'seller_declaration_error');throw new Error('Seller declaration unavailable')}return parseSellerDeclarationRows(await readBoundedJson(response))[0]||null}
const agreementDocumentRequests=new Map<string,Promise<AgreementDocumentSnapshot>>();
export function getPublicAgreementDocument(publicId:string,version?:number){
  const requestBody=parseAgreementDocumentRequest({p_public_id:publicId,p_version:version??null});
  const cacheKey=requestBody.p_version?`${requestBody.p_public_id}:${requestBody.p_version}`:'';
  const existing=cacheKey?agreementDocumentRequests.get(cacheKey):null;
  if(existing)return existing;
  const request=(async()=>{const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_public_agreement_document`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'agreement_document_error');throw new Error('The stored agreement document is unavailable')}const record=parseAgreementDocumentRows(await readBoundedJson(response))[0]||null;if(!record)throw new Error('The stored agreement version was not found');return record})();
  if(cacheKey){agreementDocumentRequests.set(cacheKey,request);request.catch(()=>agreementDocumentRequests.delete(cacheKey))}
  return request;
}
export async function getPublicAgreementHistory(publicId:string){const requestBody=parseAgreementHistoryRequest({p_public_id:publicId});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_public_agreement_history`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'agreement_history_error');throw new Error('Agreement history unavailable')}return parseAgreementHistoryRows(await readBoundedJson(response))}
export async function verifyAgreementRecord(publicId:string,contentHash:string){const requestBody=parseAgreementVerificationRequest({p_public_id:publicId,p_content_hash:contentHash});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/verify_agreement_record`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'agreement_verification_error');throw new Error('Agreement verification is unavailable')}return parseAgreementVerificationRows(await readBoundedJson(response))[0]||null}
export async function renewDealLink(session:StoredSession,dealId:string,days:number){const requestBody=parseDealLinkRenewalRequest({p_deal_id:dealId,p_days:days});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/renew_deal_link`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_link_renewal_error');throw new Error('Could not renew Deal Link')}return parseDealRenewalRows(await readBoundedJson(response))[0]}
export async function getDealAcceptanceProtection(publicId:string){const requestBody=parseAcceptanceProtectionRequest({p_public_id:publicId});const response=await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_deal_acceptance_protection`,{method:'POST',headers:headers(),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'acceptance_protection_error');return false}return parseAcceptanceProtectionResponse(await readBoundedJson(response))}
export async function configureBuyerAccessCode(session:StoredSession,dealId:string,enabled:boolean){const requestBody=parseBuyerAccessCodeRequest({p_deal_id:dealId,p_enabled:enabled});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/configure_buyer_access_code`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});const data=await readBoundedJson(response);if(!response.ok){parseAgreementPostgrestErrorEnvelope(data,response.status,'buyer_access_code_error');throw new Error('Could not update buyer access')}return parseBuyerAccessCodeResponse(data)}
export async function isDealSaved(session:StoredSession,publicId:string){const requestBody=parseWatchlistReadRequest({p_public_id:publicId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_deal_saved`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'watchlist_read_error');throw new Error('Could not check saved deal')}return parseWatchlistStateResponse(await readBoundedJson(response))}
export async function setDealSaved(session:StoredSession,publicId:string,saved:boolean){const requestBody=parseWatchlistWriteRequest({p_public_id:publicId,p_saved:saved});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_saved`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAgreementPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'watchlist_write_error');throw new Error('Could not update saved deal')}return parseWatchlistStateResponse(await readBoundedJson(response))}
export async function getDealInspection(session:StoredSession,dealId:string){const requestBody=parseDealInspectionReadRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_inspection`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_inspection_read_error');throw new Error('Could not load inspection receipt')}return parseDealInspectionRows(await readBoundedJson(response))[0]||null}
export async function recordDealInspection(session:StoredSession,dealId:string){const requestBody=parseDealInspectionRecordRequest({p_deal_id:dealId,p_item_reviewed:true,p_price_confirmed:true,p_handoff_confirmed:true,p_reference_checked:true});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/record_deal_inspection`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_inspection_record_error');throw new Error('Could not save inspection receipt')}}
export async function getDealTimeline(session:StoredSession,dealId:string){const requestBody=parseDealTimelineRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_timeline`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAccountActivityPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_timeline_error');throw new Error('Could not load timeline')}return parseTimelineEventRows(await readBoundedJson(response))}
export async function getDealParticipants(session:StoredSession,dealId:string){const requestBody=parseDealParticipantsRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_participants`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseAccountActivityPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_participants_error');throw new Error('Could not load participants')}return parseDealParticipantsRows(await readBoundedJson(response))[0]||null}
export async function getDealActionPlan(session:StoredSession,dealId:string){const requestBody=parseDealActionPlanRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_action_plan`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_action_plan_error');throw new Error('Could not load deal action plan')}return parseDealActionPlanRows(await readBoundedJson(response))[0]||null}
export async function getMyNotifications(session:StoredSession){const requestBody=parseNotificationListRequest({p_limit:12});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_my_notifications`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'notification_list_error').message)}return parseDealNotificationRows(await readBoundedJson(response))}
export async function markDealNotificationsRead(session:StoredSession,dealId:string){const requestBody=parseNotificationDealReadRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_deal_activity_read`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'notification_read_error').message)}}
export async function markAllNotificationsRead(session:StoredSession){const requestBody=parseNotificationAllReadRequest({});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/mark_all_activity_read`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'notification_read_error').message)}}
export async function getDealMessages(session:StoredSession,dealId:string){const requestBody=parseMessageListRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_messages`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'message_list_error').message)}return parseDealMessageRows(await readBoundedJson(response))}
export async function sendDealMessage(session:StoredSession,dealId:string,body:string){const requestBody=parseSendDealMessageRequest({p_deal_id:dealId,p_body:body});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/send_deal_message`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'message_send_error').message)}}
export async function makeDealOffer(session:StoredSession,publicId:string,amountCents:number,typedName:string){const requestBody=parseCreateOfferRequest({p_public_id:publicId,p_amount_cents:amountCents,p_typed_name:typedName});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/make_deal_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'offer_create_error').message)}}
export async function getDealOffers(session:StoredSession,dealId:string){const requestBody=parseOfferListRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_offers`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'offer_list_error').message)}return parseDealOfferRows(await readBoundedJson(response))}
export async function getDealInquiries(session:StoredSession,dealId:string){const requestBody=parseInquiryListRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_inquiries`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'inquiry_list_error').message)}return parseDealInquiryRows(await readBoundedJson(response))}
export async function isCurrentUserDealSeller(session:StoredSession,dealId:string){const requestBody=parseCurrentUserDealSellerRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/is_current_user_deal_seller`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok)return false;return parseCurrentUserDealSellerResponse(await readBoundedJson(response))}
export async function askDealQuestion(session:StoredSession,publicId:string,body:string){const requestBody=parseCreateInquiryRequest({p_public_id:publicId,p_body:body});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/ask_deal_question`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'inquiry_create_error').message)}return parseInquiryIdResponse(await readBoundedJson(response))}
export async function replyDealInquiry(session:StoredSession,inquiryId:string,reply:string){const requestBody=parseReplyInquiryRequest({p_inquiry_id:inquiryId,p_reply:reply});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/reply_deal_inquiry`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'inquiry_reply_error').message)}}
export async function respondToOffer(session:StoredSession,offerId:string,accept:boolean){const requestBody=parseRespondOfferRequest({p_offer_id:offerId,p_accept:accept});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/respond_to_offer`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){const d=await readBoundedJson(response);throw new Error(parseInteractionPostgrestErrorEnvelope(d,response.status,'offer_response_error').message)}}
export async function getDealShipment(session:StoredSession,dealId:string){const requestBody=parseDealShipmentReadRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/deal_shipments?deal_id=eq.${requestBody.p_deal_id}&select=id,deal_id,carrier,tracking_number,status,shipped_at,delivered_at`,{headers:headers(session.accessToken)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'deal_shipment_read_error');throw new Error('Could not load shipment')}return parseDealShipmentRows(await readBoundedJson(response))[0]||null}
export async function getSellerShippingEvidenceReadiness(session:StoredSession,dealId:string){
  const requestBody=parseShippingEvidenceReadinessRequest({p_deal_id:dealId});
  const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_seller_shipping_evidence_readiness`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});
  const data=await readBoundedJson(response);
  if(!response.ok){parseDeliveryPostgrestErrorEnvelope(data,response.status,'shipping_evidence_readiness_error');throw new Error('Could not check shipping evidence')}
  return parseShippingEvidenceReadinessRows(data)[0]||null;
}
export async function getDealDeliveryDetails(session:StoredSession,dealId:string){const requestBody=parseDeliveryDetailsReadRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_deal_delivery_details`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'delivery_details_read_error');throw new Error('Could not load delivery address')}return parseDealDeliveryDetailsRows(await readBoundedJson(response))[0]||null}
export async function saveDealDeliveryDetails(session:StoredSession,dealId:string,recipientName:string,fullAddress:string,country:string,instructions:string){const requestBody=parseDeliveryDetailsSaveRequest({p_deal_id:dealId,p_recipient_name:recipientName,p_full_address:fullAddress,p_country:country,p_instructions:typeof instructions==='string'&&!instructions.trim()?null:instructions});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/set_deal_delivery_details`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'delivery_details_save_error');throw new Error('Could not save delivery address')}}
export async function getDealPaymentRecord(
  session:StoredSession,
  dealId:string,
){
  const request=parseLegacyPaymentRecordRequest({p_deal_id:dealId});
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/get_deal_payment_record`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseLegacyPaymentPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not load the historical payment record.');
  }
  return parseLegacyPaymentRecordRows(data)[0]??null;
}

export async function createSupportCase(
  session:StoredSession,
  input:{
    dealId?:string|null;
    category:SupportCategory;
    subject:string;
    message:string;
  },
){
  const request=parseCreateSupportCaseRequest({
    p_deal_id:input.dealId??null,
    p_category:input.category,
    p_subject:input.subject,
    p_message:input.message,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/create_support_case`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not open a support case. Please try again.');
  }
  return parseSupportReferenceResponse(data);
}

export async function getMySupportCases(session:StoredSession){
  const request=parseMySupportCasesRequest({});
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/get_my_support_cases`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not load your support cases.');
  }
  return parseSupportCaseSummaryRows(data);
}

export async function getSupportCase(
  session:StoredSession,
  publicReference:string,
){
  const request=parseSupportCaseReadRequest({
    p_public_reference:publicReference,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/get_support_case`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not load this support case.');
  }
  return parseSupportCaseDetailRows(data);
}

export async function replySupportCase(
  session:StoredSession,
  publicReference:string,
  message:string,
){
  const request=parseReplySupportCaseRequest({
    p_public_reference:publicReference,
    p_message:message,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/reply_support_case`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not send your support reply.');
  }
  parseSupportMutationResponse(data);
}

export async function getSupportQueue(
  session:StoredSession,
  scope:'open'|'mine',
){
  const request=parseSupportQueueRequest({p_scope:scope});
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/get_support_queue`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not load the support queue.');
  }
  return parseSupportQueueRows(data);
}

export async function claimSupportCase(
  session:StoredSession,
  publicReference:string,
){
  const request=parseSupportCaseClaimRequest({
    p_public_reference:publicReference,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/claim_support_case`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('This support case could not be assigned.');
  }
  parseSupportMutationResponse(data);
}

export async function resolveSupportCase(
  session:StoredSession,
  publicReference:string,
  resolutionMessage:string,
){
  const request=parseResolveSupportCaseRequest({
    p_public_reference:publicReference,
    p_resolution_message:resolutionMessage,
  });
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/resolve_support_case`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(request),
    },
  );
  const data=await readBoundedJson(response);
  if(!response.ok){
    parseSupportPostgrestErrorEnvelope(data,response.status);
    throw new Error('Could not resolve this support case.');
  }
  parseSupportMutationResponse(data);
}
export class SecurePaymentServiceError extends Error{
  readonly code:string;
  readonly correlationId:string|null;
  readonly retryable:boolean;
  constructor(message:string,code:string,correlationId:string|null,retryable:boolean){
    super(message);
    this.name='SecurePaymentServiceError';
    this.code=code;
    this.correlationId=correlationId;
    this.retryable=retryable;
  }
}
type PaymentEdgeFunctionName='stripe-connect'|'stripe-create-checkout'|'stripe-resolve-dispute';
const paymentErrorBoundaryByFunction:Record<PaymentEdgeFunctionName,Extract<PaymentErrorBoundary,'stripe_connect_error'|'stripe_checkout_error'|'stripe_dispute_resolution_error'>>={
  'stripe-connect':'stripe_connect_error',
  'stripe-create-checkout':'stripe_checkout_error',
  'stripe-resolve-dispute':'stripe_dispute_resolution_error'
};
async function invokeEdgeFunction(session:StoredSession,name:PaymentEdgeFunctionName,body:Record<string,unknown>):Promise<unknown>{
  const response=await authenticatedFetch(session,`${supabaseUrl}/functions/v1/${name}`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body)});
  const data=await readBoundedJson(response);
  if(!response.ok){
    const error=parsePaymentErrorEnvelope(data,response.status,response.headers.get('X-Dealivra-Correlation-Id'),paymentErrorBoundaryByFunction[name]);
    throw new SecurePaymentServiceError(`${error.error} Support reference: ${error.correlationId}.`,error.code,error.correlationId,error.retryable);
  }
  return data;
}
export async function getStripeConnectStatus(session:StoredSession){const requestBody=parseStripeConnectRequest({action:'status'});return parseStripeConnectStatusResponse(await invokeEdgeFunction(session,'stripe-connect',{...requestBody}))}
export async function startStripeConnectOnboarding(session:StoredSession,dealPublicId:string){const requestBody=parseStripeConnectRequest({action:'onboard',dealPublicId});return parseStripeConnectOnboardingResponse(await invokeEdgeFunction(session,'stripe-connect',{...requestBody}))}
export async function getProtectedPaymentStatus(session:StoredSession,dealId:string){const requestBody=parseProtectedPaymentStatusRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/get_protected_payment_status`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});const data=await readBoundedJson(response);if(!response.ok)throw new Error(parsePaymentPostgrestErrorEnvelope(data,response.status).message);return parseProtectedPaymentStatusRows(data)}
export async function createProtectedCheckout(session:StoredSession,dealId:string){const requestBody=parseStripeCheckoutRequest({dealId});return parseStripeCheckoutResponse(await invokeEdgeFunction(session,'stripe-create-checkout',{...requestBody}))}
export async function createDealShipment(session:StoredSession,dealId:string,carrier:string,trackingNumber:string){const requestBody=parseShipmentCreateRequest({p_deal_id:dealId,p_carrier:carrier,p_tracking_number:trackingNumber});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/create_deal_shipment`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'shipment_create_error');throw new Error('Could not save shipment')}}
export async function confirmShipmentDelivery(session:StoredSession,dealId:string){const requestBody=parseShipmentDeliveryConfirmationRequest({p_deal_id:dealId});const response=await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/confirm_shipment_delivery`,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(requestBody)});if(!response.ok){parseDeliveryPostgrestErrorEnvelope(await readBoundedJson(response),response.status,'shipment_delivery_confirmation_error');throw new Error('Could not confirm delivery')}}

export async function getMySavedDeals(session:StoredSession){
  const requestBody=parseSavedDealsRequest({});
  const response=await authenticatedFetch(
    session,
    `${supabaseUrl}/rest/v1/rpc/get_my_saved_deals`,
    {
      method:'POST',
      headers:headers(session.accessToken),
      body:JSON.stringify(requestBody),
    },
  );
  if(!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      await readBoundedJson(response),
      response.status,
      'saved_deals_error',
    );
    throw new Error('Could not load saved deals');
  }
  const rows=parseSavedDealRows(await readBoundedJson(response));
  return rows.map(row=>({...mapDeal(row,row.seller_name),sellerContactVerified:row.seller_contact_verified,sellerVerification:row.seller_verification,mediaUrls:(row.media_paths||[]).map(publicMediaUrl)}));
}

export async function getPublicDeal(publicId: string) {
  requireSupabaseConfiguration();
  const requestBody=parsePublicDealRequest({p_public_id:publicId});
  const response = await fetchWithDeadline(`${supabaseUrl}/rest/v1/rpc/get_public_deal`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(requestBody),
  });
  if (!response.ok){
    parseDealMutationPostgrestErrorEnvelope(
      await readBoundedJson(response),
      response.status,
      'public_deal_error',
    );
    throw new Error('Deal Link is unavailable');
  }
  const rows = parsePublicDealRows(await readBoundedJson(response));
  const row = rows[0];
  if (!row) throw new Error('Deal Link was not found');
  return {
    ...mapDeal(row, row.seller_name),
    agreementVersion: row.agreement_version,
    sellerContactVerified: row.seller_contact_verified,
    sellerVerification: row.seller_verification,
    mediaUrls: (row.media_paths || []).map(publicMediaUrl),
  };
}

export async function acceptPublicDeal(session: StoredSession, publicId: string, typedName: string, accessCode='') {
  const requestBody=parsePublicDealAcceptRequest({
    p_public_id:publicId,
    p_typed_name:typedName,
    p_access_code:accessCode.trim()||null,
  });
  const response = await authenticatedFetch(session,`${supabaseUrl}/rest/v1/rpc/accept_deal`, {
    method: 'POST', headers: headers(session.accessToken),
    body: JSON.stringify(requestBody),
  });
  const data = await readBoundedJson(response);
  if (!response.ok) {
    parseDealMutationPostgrestErrorEnvelope(
      data,
      response.status,
      'public_deal_accept_error',
    );
    throw new Error('Could not accept this deal');
  }
  const result=parsePublicDealAcceptanceResponse(data);
  if(result==='incorrect_code')throw new Error('Incorrect buyer access code');
  if(result==='rate_limited')throw new Error('Too many incorrect codes. Try again in 15 minutes.');
}

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabaseUrl || !publishableKey) return false;

  try {
    // Health checks must not require anonymous SELECT access to a private
    // business table. The Auth health endpoint exposes no customer data.
    const response = await fetchWithDeadline(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: publishableKey },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Authenticated CRUD is added after sign-up and the remaining RLS policies are ready.
