import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, BadgeDollarSign, Bell, Bookmark, Car, Check, ChevronDown, CircleCheckBig, Copy, Eye, FileSignature, Fingerprint, ImagePlus, Laptop, Link2, LockKeyhole, Menu, MessageCircle, Package, PackageCheck, Plus, Scale, Search, Send, Share2, ShieldAlert, ShieldCheck, Smartphone, Star, Truck, Watch, X } from 'lucide-react';
import { DEMO_DEAL_PUBLIC_ID, demoRepository } from './services/demoRepository';
import { acceptPublicDeal, createUserDeal, getAdminAccess, getMyNotifications, getMyProfileSummary, getMySavedDeals, getPublicDeal, getPublicTrustPassport, getSellerShippingEvidenceReadiness, getStoredSession, hasSessionHint, isSupabaseConfigured, isTransientAuthenticationError, listUserDeals, markSessionActivity, refreshSession, requestIdentityVerification, restoreSession, saveUserDealDraft, sessionExpiredEvent, sessionUpdatedEvent, signIn, signOut, signUp, uploadDealPhotos, type DealNotification, type ProfileSummary, type StoredSession, type TrustPassport } from './services/supabaseRest';
import { markAllNotificationsRead, markDealNotificationsRead } from './services/supabaseRest';
import { configureBuyerAccessCode, getDealAcceptanceProtection } from './services/supabaseRest';
import { type DealParticipants } from './services/supabaseRest';
import { getDealActionPlan, type DealActionPlan } from './services/supabaseRest';
import { getAppLanguage, t } from './i18n';
import { MfaLoginVerification } from './MfaLoginVerification';
import { mfaRequiredEvent, type MfaLoginChallenge } from './services/supabaseRest';
import { BrandLogo } from './BrandLogo';
import {
  DealQrCode,
  FilePreview,
  MediaPreview,
} from './DealWorkspaceFeatures';
import { CatalogSearchPanel } from './CatalogSearchPanel';
import {
  dealTemplates,
  DealCreationWorkspace,
  type CreateFieldError,
  type CreateFlowStep,
  type DealTemplateId,
  type VehicleVinLookupState,
} from './DealCreationWorkspace';
import {
  resolveDealPrimaryAction,
  type DealPrimaryAction,
  type ShippingNavigationReadiness,
} from './DealWorkspaceShell';
import { AgreementVerificationPage } from './AgreementVerificationPage';
import {
  emptySellerDeclarations,
  SellerDeclarationChecklist,
  type SellerDeclarations,
} from './SellerDeclarations';
import type { Deal, DealDraft } from './domain';
import { formatMoney, toMinorUnits } from './currency';
import { copyTextToClipboard } from './clipboard';
import { NetworkStatusBanner } from './NetworkStatusBanner';
import { filterCatalogDeals, mergeCatalogSearchParams, readCatalogSearchState } from './catalogSearch';
import { OTHER_CATALOG_VALUE, buildDealCatalogIdentity, buildSmartCatalogTitle, emptySmartCatalogSelection, matchCatalogValue, sanitizeSmartCatalogSelection, vehicleCatalog, vehicleYears, type SmartCatalogSelection } from './smartCatalog';
import { decodeVehicleVin } from './services/catalogService';
import { isPublicInfoView, publicInfoPaths, resolveBrowserRoute, verifyPath, type PublicInfoView } from './navigation';
import { applyPageMetadata, DealLinkError, getPageMetadata, NotFoundPage, PublicInfoPage, RouteLoading } from './PublicRoutePages';
import { AccountEntryPage, ForgotPassword, ForgotPasswordEntry, ResetPassword, type AuthFormState, type AuthMode } from './AccountEntryPages';
import { AsyncStatePanel } from './AsyncStatePanel';
import './styles.css';
import './security.css';
import './session-security.css';
import './mfa-security.css';
import './dashboard.css';
import './home.css';
import './dispute.css';
import './timeline.css';
import './agreement-export.css';
import './media-zoom.css';
import './qr.css';
import './chat.css';
import './offers.css';
import './shipping.css';
import './create-status.css';
import './install.css';
import './recovery.css';
import './photo-manager.css';
import './video.css';
import './media-delete.css';
import './cover-selector.css';
import './deal-edit.css';
import './account-settings.css';
import './support-case.css';
import './address-autocomplete.css';
import './deal-readiness.css';
import './inspection-checklist.css';
import './completion-receipt.css';
import './currency.css';
import './agreement-fingerprint.css';
import './agreement-consent.css';
import './buyer-invite.css';
import './deal-expiry.css';
import './create-review.css';
import './saved-draft.css';
import './report-deal.css';
import './admin-center.css';
import './admin-disputes.css';
import './admin-revenue.css';
import './admin-catalog.css';
import './risk-check.css';
import './seller-trust.css';
import './trust-passport.css';
import './watchlist.css';
import './deal-templates.css';
import './smart-catalog.css';
import './seller-declaration-status.css';
import './agreement-history.css';
import './agreement-verification.css';
import './deal-renewal.css';
import './deal-inquiries.css';
import './buyer-access-code.css';
import './deal-participants.css';
import './deal-action-plan.css';
import './delivery-address.css';
import './payment-status.css';
import './payment-receipt.css';
import './evidence.css';
import './global-redesign.css';
import './workspace-redesign.css';
import './deal-workflow-modern.css';
import './deal-sections-compact.css';
import './published-success.css';
import './dealivra-brand.css';
import './catalog-search.css';
import {
  focusPageDestination,
  motionSafeScrollBehavior,
} from './accessibleNavigation';

type View = 'home' | 'create' | 'published' | 'deal' | 'auth' | 'profile' | 'passport' | 'admin' | 'forgot' | 'reset' | 'link-error' | 'route-loading' | 'not-found' | 'verify' | PublicInfoView;

const AccountProfileWorkspace = React.lazy(() =>
  import('./AccountProfileWorkspace').then((module) => ({
    default: module.AccountProfileWorkspace,
  })),
);
const AdministrationWorkspace = React.lazy(() =>
  import('./AdministrationWorkspace').then((module) => ({
    default: module.AdministrationWorkspace,
  })),
);
const DealWorkspace = React.lazy(() =>
  import('./DealWorkspace').then((module) => ({
    default: module.DealWorkspace,
  })),
);

interface InstallPromptEvent extends Event { prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}> }
const initial: DealDraft = {title:'',description:'',price:'',currency:'USD',condition:'Good',serialNumber:'',deliveryMethod:'Meet in person',expiresInDays:7};
const formatDateTime=(value:string)=>new Date(value).toLocaleString(getAppLanguage());
const formatDate=(value:string)=>new Date(value).toLocaleDateString(getAppLanguage());
const dealPrice=(deal:Pick<Deal,'priceCents'|'currency'>)=>formatMoney(deal.priceCents,deal.currency,getAppLanguage());
const groupedDealValue=(deals:Deal[])=>{const totals=new Map<Deal['currency'],number>();deals.forEach(deal=>{totals.set(deal.currency,(totals.get(deal.currency)||0)+deal.priceCents)});return [...totals].map(([currency,value])=>formatMoney(value,currency,getAppLanguage())).join(' · ')||formatMoney(0,'USD',getAppLanguage())};
const isDealExpired=(deal:Deal,now=Date.now())=>deal.status==='published'&&Boolean(deal.expiresAt)&&new Date(deal.expiresAt!).getTime()<=now;

function PublicTrustPassportPage({
  profile,
  message,
  onBack,
  onRetry,
}:{
  profile:TrustPassport|null;
  message:string;
  onBack:()=>void;
  onRetry:()=>void;
}){
  return <section className="trust-passport-page" aria-labelledby={profile?'trust-passport-title':undefined}>
    <button className="back no-print" type="button" onClick={onBack}>← {t('Dashboard')}</button>
    {profile?<>
      <div className="passport-hero">
        <p className="eyebrow">Dealivra · {t('Digital Trust Passport')}</p>
        <div className="passport-identity">
          <span className="passport-avatar" aria-hidden="true">{profile.display_name.slice(0,1)}</span>
          <div>
            <h1 id="trust-passport-title">{profile.display_name}</h1>
            <div className={`passport-verification ${profile.verification_status==='verified'?'verified':''}`}>
              <BadgeCheck size={20} aria-hidden="true"/>
              {t(profile.verification_status==='verified'?'Identity verified':'Verification pending')}
            </div>
            <p>{t('Member since')} {formatDate(profile.member_since)}</p>
          </div>
        </div>
      </div>
      <div className="passport-grid" aria-label={t('Recorded Dealivra activity')}>
        <article><span>{t('Completed deals')}</span><strong>{profile.completed_deals}</strong><small>{t('Successful handoffs')}</small></article>
        <article><span>{t('Completed sales')}</span><strong>{profile.completed_sales}</strong><small>{t('Seller activity')}</small></article>
        <article><span>{t('Completed purchases')}</span><strong>{profile.completed_purchases}</strong><small>{t('Buyer activity')}</small></article>
        <article><span>{t('Average rating')}</span><strong>{profile.average_rating??'—'} <Star size={21} aria-hidden="true"/></strong><small>{profile.rating_count} {t('ratings')}</small></article>
      </div>
      <div className="passport-history">
        <h2>{t('Reputation history')}</h2>
        {profile.recent_ratings.length?<div className="passport-reviews">{profile.recent_ratings.map((rating,index)=><article className="passport-review" key={`${rating.created_at}-${index}`}><strong aria-label={`${rating.stars} out of 5 stars`}>{'★'.repeat(rating.stars)}<span aria-hidden="true">{'☆'.repeat(5-rating.stars)}</span></strong><small>{formatDate(rating.created_at)}</small></article>)}</div>:<div className="empty-state"><Star aria-hidden="true"/><b>{t('No ratings yet')}</b></div>}
      </div>
      <p className="passport-disclaimer"><ShieldCheck size={18} aria-hidden="true"/>{t('This profile shows recorded Dealivra activity and does not guarantee future behavior.')}</p>
    </>:<div className="passport-loading">
      <AsyncStatePanel
        state={message?'error':'loading'}
        title={message?'Passport unavailable':'Loading passport…'}
        message={message||'Checking the latest public trust record.'}
        actionLabel="Try again"
        onAction={message?onRetry:undefined}
      />
    </div>}
  </section>
}

function DealComparison({deals,onClose,onOpen}:{deals:Deal[];onClose:()=>void;onOpen:(deal:Deal)=>void}){
  const dialogRef=useRef<HTMLElement>(null);const closeButtonRef=useRef<HTMLButtonElement>(null);const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
  useEffect(()=>{const previouslyFocused=document.activeElement as HTMLElement|null;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';closeButtonRef.current?.focus();const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onCloseRef.current();return}if(event.key!=='Tab')return;const focusable=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')??[]);if(focusable.length===0){event.preventDefault();closeButtonRef.current?.focus();return}const first=focusable[0];const last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};window.addEventListener('keydown',handleKeyDown);return()=>{window.removeEventListener('keydown',handleKeyDown);document.body.style.overflow=previousOverflow;previouslyFocused?.focus()}},[]);
  const rows=[
    {label:'Price',value:(deal:Deal)=>dealPrice(deal)},
    {label:'Condition',value:(deal:Deal)=>t(deal.condition)},
    {label:'Handoff',value:(deal:Deal)=>t(deal.deliveryMethod)},
    {label:'Seller',value:(deal:Deal)=>deal.sellerName},
    {label:'Verification',value:(deal:Deal)=>t(deal.sellerVerification.replace('_',' '))},
    {label:'Status',value:(deal:Deal)=>t(isDealExpired(deal)?'expired':deal.status)},
    {label:'Offer expires',value:(deal:Deal)=>deal.expiresAt?formatDateTime(deal.expiresAt):'—'}
  ];
  return <div className="compare-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section ref={dialogRef} className="compare-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-title"><div className="compare-title"><div><p className="eyebrow">{t('Private Watchlist')}</p><h2 id="compare-title">{t('Deal comparison')}</h2><p>{t('Compare price, condition, handoff, and seller trust.')}</p></div><button ref={closeButtonRef} type="button" className="compare-close" aria-label={t('Close comparison')} onClick={onClose}><X aria-hidden="true"/></button></div><div className="compare-scroll"><table><thead><tr><th>{t('Detail')}</th>{deals.map(deal=><th key={deal.id}><span className="compare-cover">{deal.mediaUrls?.[0]?<MediaPreview source={deal.mediaUrls[0]} alt={deal.title}/>:deal.title.slice(0,1).toUpperCase()}</span><b>{deal.title}</b><small>{deal.publicId}</small></th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.label}><th>{t(row.label)}</th>{deals.map(deal=><td key={deal.id}>{row.value(deal)}</td>)}</tr>)}<tr className="compare-actions"><th></th>{deals.map(deal=><td key={deal.id}><button className="primary" onClick={()=>onOpen(deal)}>{t('Open Deal Link')}<ArrowRight size={16}/></button></td>)}</tr></tbody></table></div><p className="compare-note"><ShieldCheck size={17}/>{t('Comparison uses the current details recorded in each Deal Link.')}</p></section></div>
}

function SavedDealsPanel({items,totalCount,onOpen}:{items:Deal[];totalCount:number;onOpen:(deal:Deal)=>void}){
  const [selected,setSelected]=useState<string[]>([]);const [comparing,setComparing]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>setSelected(current=>current.filter(id=>items.some(deal=>deal.id===id))),[items]);
  const toggle=(dealId:string)=>{setMessage('');setSelected(current=>{if(current.includes(dealId))return current.filter(id=>id!==dealId);if(current.length>=3){setMessage('You can compare up to 3 deals.');return current}return [...current,dealId]})};
  const compare=()=>{if(selected.length<2){setMessage('Choose at least 2 deals.');return}setComparing(true)};
  const compared=items.filter(deal=>selected.includes(deal.id));
  return <section className="saved-deals"><div className="saved-heading"><div><p className="eyebrow">{t('Private Watchlist')}</p><h2>{t('Saved Deal Links')}</h2><p>{t('Deals you want to review again stay here.')}</p></div><div className="saved-heading-actions"><span><Bookmark size={17}/>{items.length}/{totalCount}</span>{items.length>=2&&<button className="secondary" disabled={selected.length<2} onClick={compare}><Scale size={17}/>{t('Compare selected')} ({selected.length})</button>}</div></div>{items.length>=2&&<p className="compare-help">{t('Choose 2 or 3 saved deals to compare.')}</p>}{message&&<div className="notice">{t(message)}</div>}{items.length?<div className="saved-grid">{items.map(deal=>{const isSelected=selected.includes(deal.id);return <article className={`saved-card ${isSelected?'selected':''}`} key={deal.id}><button className="saved-card-open" onClick={()=>onOpen(deal)}><span className="saved-card-media">{deal.mediaUrls?.[0]?<MediaPreview source={deal.mediaUrls[0]} alt={deal.title}/>:deal.title.slice(0,1).toUpperCase()}</span><span className="saved-card-body"><b>{deal.title}</b><small>{t('Seller')}: {deal.sellerName}</small><span className="saved-card-meta"><strong>{dealPrice(deal)}</strong><span className={`status ${isDealExpired(deal)?'expired':deal.status}`}>{t(isDealExpired(deal)?'expired':deal.status)}</span></span></span></button>{items.length>=2&&<button className="compare-select" aria-pressed={isSelected} onClick={()=>toggle(deal.id)}>{isSelected?<Check size={16}/>:<Scale size={16}/>} {t(isSelected?'Selected':'Select for comparison')}</button>}</article>})}</div>:<div className="saved-empty"><Bookmark/><span><b>{t(totalCount?'No saved deals match these filters':'No saved deals yet')}</b><span>{t(totalCount?'Change or clear the filters above to see other saved deals.':'Open a Deal Link and choose Save Deal Link.')}</span></span></div>}{comparing&&<DealComparison deals={compared} onClose={()=>setComparing(false)} onOpen={deal=>{setComparing(false);onOpen(deal)}}/>}</section>
}

function EnhancedDashboard({deals,allDeals,onOpen,onCreate}:{deals:Deal[];allDeals:Deal[];onOpen:(deal:Deal)=>void;onCreate:()=>void}){
  const activeCount=allDeals.filter(deal=>(deal.status==='published'&&!isDealExpired(deal))||deal.status==='accepted').length;const completedCount=allDeals.filter(deal=>deal.status==='completed').length;
  return <section className="enhanced-dashboard"><div className="dashboard-heading"><div><p className="eyebrow">{t('Your workspace')}</p><h2>{t('Deal dashboard')}</h2><p>{t('Track every sale from published link to completed handoff.')}</p></div><button className="primary" onClick={onCreate}><Plus size={17}/>{t('New deal')}</button></div><div className="dashboard-stats"><article><span>{t('All deals')}</span><strong>{allDeals.length}</strong></article><article><span>{t('Active')}</span><strong>{activeCount}</strong></article><article><span>{t('Completed')}</span><strong>{completedCount}</strong></article><article><span>{t('Total value')}</span><strong>{groupedDealValue(allDeals)}</strong></article></div>{deals.length?<div className="dashboard-list">{deals.map(deal=>{const expired=isDealExpired(deal);return <button key={deal.id} onClick={()=>onOpen(deal)}><span className="deal-icon">{deal.title.slice(0,1).toUpperCase()}</span><span className="deal-main"><b>{deal.title}</b><small>{deal.publicId} · {t(deal.viewerRole==='buyer'?'Buying':'Selling')}</small></span><strong>{dealPrice(deal)}</strong><span className={`status ${expired?'expired':deal.status}`}>{t(expired?'expired':deal.status)}</span><ArrowRight size={18}/></button>})}</div>:<div className="dashboard-empty"><Search/><b>{t('No matching deals')}</b><span>{t('Change or clear the filters above, or create a new Deal Link.')}</span><button className="secondary" onClick={onCreate}><Plus size={16}/>{t('Create deal')}</button></div>}</section>
}

function WorkspaceDealExplorer({deals,savedDeals,loading,error,onRetry,onOpen,onCreate}:{deals:Deal[];savedDeals:Deal[];loading:boolean;error:string;onRetry:()=>void;onOpen:(deal:Deal)=>void;onCreate:()=>void}){
  const [filters,setFilters]=useState(()=>readCatalogSearchState(location.search));
  const availableDeals=useMemo(()=>{
    const unique=new Map<string,Deal>();
    [...deals,...savedDeals].forEach(deal=>{unique.set(deal.id,deal)});
    return [...unique.values()];
  },[deals,savedDeals]);
  const filteredDeals=useMemo(()=>filterCatalogDeals(deals,filters),[deals,filters]);
  const filteredSavedDeals=useMemo(()=>filterCatalogDeals(savedDeals,filters),[savedDeals,filters]);
  const matchingUniqueCount=useMemo(()=>filterCatalogDeals(availableDeals,filters).length,[availableDeals,filters]);
  useEffect(()=>{
    const search=mergeCatalogSearchParams(location.search,filters);
    const destination=`${location.pathname}${search}${location.hash}`;
    if(`${location.pathname}${location.search}${location.hash}`!==destination)history.replaceState({},'',destination);
  },[filters]);
  return <>
    <div className="dashboard-data-states">
      {loading&&!deals.length&&!savedDeals.length&&<AsyncStatePanel state="loading" title="Loading workspace…"/>}
      {error&&<AsyncStatePanel state="error" title="Refresh failed" message={deals.length||savedDeals.length?`${error} Showing saved data.`:error} onAction={onRetry}/>}
    </div>
    <CatalogSearchPanel deals={availableDeals} filteredCount={matchingUniqueCount} value={filters} onChange={setFilters}/>
    {(deals.length>0||savedDeals.length>0||(!loading&&!error))&&<><SavedDealsPanel items={filteredSavedDeals} totalCount={savedDeals.length} onOpen={onOpen}/><EnhancedDashboard deals={filteredDeals} allDeals={deals} onOpen={onOpen} onCreate={onCreate}/></>}
  </>;
}

const eventLabels:Record<string,string>={deal_published:'Deal Link published',deal_accepted:'Terms accepted',buyer_accepted:'Terms accepted',deal_renewed:'Deal Link extended.',deal_updated:'Deal details updated',question_asked:'Buyer question received',question_answered:'Seller replied to question',offer_made:'Offer sent',offer_declined:'Offer declined',offer_accepted:'Offer accepted',buyer_access_protection_enabled:'Buyer access protection enabled',buyer_access_protection_disabled:'Buyer access protection disabled',buyer_access_code_verified:'Buyer access code verified',meeting_proposed:'Meeting proposed',meeting_confirmed:'Meeting confirmed',participant_arrived:'Arrival recorded',handoff_pin_generated:'Handoff PIN generated',delivery_address_saved:'Delivery address saved',payment_method_recorded:'Payment method recorded',payment_method_confirmed:'Payment method confirmed',payment_marked_sent:'Buyer marked payment sent',payment_received:'Seller confirmed payment received',item_inspected:'Buyer inspection recorded',item_shipped:'Item shipped',shipment_delivered:'Delivery confirmed',media_reordered:'Photo order updated',seller_declaration_recorded:'Seller declaration recorded',deal_reported:'Deal reported',deal_hidden:'Deal hidden from public access',deal_restored:'Deal restored to public access',deal_completed:'Deal completed',deal_cancelled:'Deal cancelled',dispute_opened:'Problem reported'};
function friendlyEvent(type:string){return t(eventLabels[type]||type.replaceAll('_',' '))}

function NotificationCenter({items,deals,loading,error,onRetry,onOpen,onOpenPublic,onMarkAll}:{items:DealNotification[];deals:Deal[];loading:boolean;error:string;onRetry:()=>void;onOpen:(deal:Deal)=>void;onOpenPublic:(publicId:string)=>void;onMarkAll:()=>void}){
  const [expanded,setExpanded]=useState(false);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const centerRef=useRef<HTMLElement>(null);
  const unread=items.filter(item=>!item.is_read).length;
  const close=(restoreFocus=false)=>{setExpanded(false);if(restoreFocus)window.requestAnimationFrame(()=>toggleRef.current?.focus())};
  useEffect(()=>{
    if(!expanded)return;
    const onPointerDown=(event:PointerEvent)=>{if(event.target instanceof Node&&!centerRef.current?.contains(event.target))close()};
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close(true)}};
    document.addEventListener('pointerdown',onPointerDown);
    window.addEventListener('keydown',onKeyDown);
    return()=>{document.removeEventListener('pointerdown',onPointerDown);window.removeEventListener('keydown',onKeyDown)};
  },[expanded]);
  const openItem=(item:DealNotification)=>{close();const deal=deals.find(candidate=>candidate.id===item.deal_id);if(deal)onOpen(deal);else onOpenPublic(item.public_id)};
  return <section ref={centerRef} className="notification-center">
    <button ref={toggleRef} type="button" className="notification-toggle" aria-haspopup="true" aria-expanded={expanded} aria-controls="notification-menu" onClick={()=>setExpanded(current=>!current)}><Bell size={19} aria-hidden="true"/><span>{t('Activity')}</span>{unread>0&&<em aria-label={`${unread} ${t('Unread')}`}>{unread>99?'99+':unread}</em>}</button>
    {expanded&&<div className="notification-menu" id="notification-menu" role="region" aria-labelledby="notification-menu-title">
      <div className="notification-menu-header"><h3 id="notification-menu-title">{t('Recent activity')}</h3>{unread>0&&<button type="button" onClick={onMarkAll}>{t('Mark all as read')}</button>}</div>
      {loading&&!items.length?<AsyncStatePanel state="loading" title="Loading recent activity…"/>:<>{error&&<AsyncStatePanel state="error" title="Activity unavailable" message={items.length?`${error} Showing previously loaded activity.`:error} actionLabel="Retry" onAction={onRetry}/>} {items.length?items.slice(0,8).map(item=><button type="button" className={`notification-item ${item.is_read?'read':'unread'}`} key={item.id} onClick={()=>openItem(item)}><span className="notification-dot" aria-hidden="true"></span><span><b>{friendlyEvent(item.event_type)}</b><small>{item.title} · {formatDateTime(item.created_at)}</small></span></button>):!error&&<p>{t('No deal activity yet.')}</p>}</>}
    </div>}
  </section>
}

function PublishedDealSuccess({deal,warning,session,acceptanceProtected,acceptanceProtectionState,acceptanceProtectionError,onRetryProtection,onProtectionChanged,onOpen,onDashboard,onCreateAnother}:{deal:Deal;warning:string;session:StoredSession|null;acceptanceProtected:boolean;acceptanceProtectionState:'idle'|'loading'|'ready'|'error';acceptanceProtectionError:string;onRetryProtection:()=>void;onProtectionChanged:(enabled:boolean)=>void;onOpen:()=>void;onDashboard:()=>void;onCreateAnother:()=>void}){
  const [notice,setNotice]=useState('');
  const [accessCode,setAccessCode]=useState('');
  const [accessMessage,setAccessMessage]=useState('');
  const [accessBusy,setAccessBusy]=useState(false);
  const noticeTimer=useRef<number|undefined>(undefined);
  const link=`${location.origin}/?deal=${deal.publicId}`;
  const message=`Review this Dealivra agreement: ${deal.title} · ${dealPrice(deal)} · ${link}`;
  useEffect(()=>()=>window.clearTimeout(noticeTimer.current),[]);
  const flash=(text:string)=>{window.clearTimeout(noticeTimer.current);setNotice(text);noticeTimer.current=window.setTimeout(()=>setNotice(''),2200)};
  const copy=async(value=link,successMessage=value===link?'Deal Link copied.':'Invitation message copied.')=>{
    try{
      await copyTextToClipboard(value);
      flash(successMessage);
    }catch{
      flash('Could not copy automatically. Select the link and copy it.');
    }
  };
  const protectAcceptance=async()=>{
    if(!session){setAccessMessage('Sign in to protect buyer acceptance.');return}
    setAccessBusy(true);
    setAccessMessage('');
    setAccessCode('');
    try{
      const code=await configureBuyerAccessCode(session,deal.id,true);
      if(!code)throw new Error('Could not create a buyer access code.');
      setAccessCode(code);
      onProtectionChanged(true);
    }catch(error){
      setAccessMessage(error instanceof Error?error.message:'Could not create a buyer access code.');
    }finally{
      setAccessBusy(false);
    }
  };
  const share=async()=>{
    try{
      if(!navigator.share)throw new Error('share-unavailable');
      await navigator.share({title:`Dealivra · ${deal.title}`,text:message,url:link});
    }catch(error){
      if(error instanceof Error&&error.name==='AbortError')return;
      await copy(message);
    }
  };
  return <section className="published-success" aria-labelledby="published-success-title">
    <div className="published-success-hero">
      <span className="published-success-mark"><CircleCheckBig/></span>
      <p className="eyebrow">{t('DEAL PUBLISHED')}</p>
      <h1 id="published-success-title">{t('Your Deal Link is ready.')}</h1>
      <p>{t('Send this Deal Link to the buyer. They can review the item, price, disclosures, and handoff terms before accepting.')}</p>
    </div>

    {warning&&<div className="published-success-warning notice" role="alert"><ShieldAlert/><span>{t(warning)}</span></div>}

    <div className="published-success-layout">
      <section className="published-share-card" aria-labelledby="published-share-title">
        <div className="published-deal-summary">
          <span><Package/></span>
          <div><small>{t('Deal')} {deal.publicId}</small><h2>{deal.title}</h2><p>{t(deal.condition)} · {t(deal.deliveryMethod)}</p></div>
          <strong>{dealPrice(deal)}</strong>
        </div>
        <div className="published-link-block">
          <label id="published-share-title" htmlFor="published-deal-link">{t('Deal Link')}</label>
          <div><input id="published-deal-link" value={link} readOnly onFocus={event=>event.currentTarget.select()}/><button type="button" className="primary" onClick={()=>void copy()}><Copy size={18}/>{t('Copy link')}</button></div>
          <small><LockKeyhole/>{t(acceptanceProtectionState==='ready'?(acceptanceProtected?'Acceptance requires the private buyer code.':'Anyone with this link can view the deal. Share it only with the intended buyer.'):'Checking acceptance security before you share this link.')}</small>
        </div>
        <section className={`published-access-panel ${acceptanceProtected?'is-protected':''}`} aria-labelledby="published-access-title">
          {acceptanceProtectionState!=='ready'?<AsyncStatePanel state={acceptanceProtectionState==='error'?'error':'loading'} title={acceptanceProtectionState==='error'?'Acceptance protection unavailable':'Checking acceptance protection…'} message={acceptanceProtectionState==='error'?acceptanceProtectionError:'Loading the current buyer-code requirement.'} actionLabel="Retry" onAction={acceptanceProtectionState==='error'?onRetryProtection:undefined}/>:<>
          <div className="published-access-heading">
            <span><LockKeyhole/></span>
            <div><small>{t('ACCEPTANCE SECURITY')}</small><h3 id="published-access-title">{t(acceptanceProtected?'Buyer code required':'Link-only acceptance')}</h3></div>
            <em>{t(acceptanceProtected?'Protected':'Optional')}</em>
          </div>
          {accessCode?<div className="published-access-code">
            <div><small>{t('One-time buyer code')}</small><strong>{accessCode}</strong><p>{t('Send this code separately from the Deal Link. It is shown only once.')}</p></div>
            <button type="button" className="secondary" onClick={()=>void copy(accessCode,'Buyer access code copied.')}><Copy size={16}/>{t('Copy code')}</button>
          </div>:<div className="published-access-choice">
            <p>{t(acceptanceProtected?'Acceptance protection is active. Generate a new code if the buyer no longer has the original.':'Add a 6-digit code when you want only the intended buyer to accept this deal.')}</p>
            <button type="button" className="secondary" disabled={accessBusy} onClick={()=>void protectAcceptance()}><LockKeyhole size={16}/>{t(accessBusy?'Creating code…':acceptanceProtected?'Generate new code':'Require buyer code')}</button>
          </div>}
          {accessMessage&&<div className="published-access-message notice" role="status">{t(accessMessage)}</div>}
          </>}
        </section>
        <div className="published-share-actions" aria-label={t('Share Deal Link')}>
          <a href={`mailto:?subject=${encodeURIComponent(`Dealivra · ${deal.title}`)}&body=${encodeURIComponent(message)}`}><Send size={17}/>{t('Email')}</a>
          <a href={`sms:?&body=${encodeURIComponent(message)}`}><MessageCircle size={17}/>{t('Text message')}</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={17}/>WhatsApp</a>
          <button type="button" onClick={()=>void share()}><Share2 size={17}/>{t('More apps')}</button>
        </div>
        {notice&&<div className="published-copy-notice" role="status"><Check/>{t(notice)}</div>}
      </section>

      <aside className="published-next-card">
        <div className="published-qr"><DealQrCode deal={deal}/></div>
        <p className="eyebrow">{t('WHAT HAPPENS NEXT')}</p>
        <ol>
          <li><span>1</span><div><b>{t('Share the Deal Link')}</b><small>{t('Send it directly to the intended buyer.')}</small></div></li>
          <li><span>2</span><div><b>{t('Buyer reviews and accepts')}</b><small>{t('Both parties work from the same agreement version.')}</small></div></li>
          <li><span>3</span><div><b>{t('Continue in the Deal Room')}</b><small>{t('Follow payment, delivery, evidence, and completion in one place.')}</small></div></li>
        </ol>
      </aside>
    </div>

    <div className="published-success-actions">
      <button type="button" className="primary" onClick={onOpen}>{t('Open Deal Room')}<ArrowRight size={18}/></button>
      <button type="button" className="secondary" onClick={onDashboard}>{t('Back to dashboard')}</button>
      <button type="button" className="published-create-another" onClick={onCreateAnother}><Plus size={17}/>{t('Create another deal')}</button>
    </div>
  </section>;
}

function InstallApp(){
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
  const [installing,setInstalling]=useState(false);
  const [message,setMessage]=useState('');
  const installingRef=useRef(false);
  useEffect(()=>{
    const handler=(event:Event)=>{
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt',handler);
    return()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);
  if(!installPrompt)return message?<span className="sr-only" role="status" aria-live="polite">{t(message)}</span>:null;
  const install=async()=>{
    if(installingRef.current)return;
    installingRef.current=true;
    setInstalling(true);
    setMessage('');
    try{
      await installPrompt.prompt();
      const choice=await installPrompt.userChoice;
      setMessage(choice.outcome==='accepted'
        ?'Dealivra installation started.'
        :'Installation was cancelled. You can install Dealivra later from your browser menu.');
      setInstallPrompt(null);
    }catch{
      setMessage('Your browser could not start installation. Use its app or home-screen menu instead.');
    }finally{
      installingRef.current=false;
      setInstalling(false);
    }
  };
  return <aside className="install-app no-print" aria-busy={installing}>
    <Smartphone aria-hidden="true"/>
    <div><b>{t('Install Dealivra')}</b><span>{t('Add it to your home screen for faster access.')}</span></div>
    <button type="button" className="primary" disabled={installing} onClick={install}>{t(installing?'Opening installer…':'Install app')}</button>
    {message?<span className="sr-only" role="status" aria-live="polite">{t(message)}</span>:null}
  </aside>
}

type GuestCreateDraftRecovery={
  version:2;
  savedAt:number;
  draft:DealDraft;
  dealTemplate:DealTemplateId;
  catalogSelection?:SmartCatalogSelection;
  createStep:CreateFlowStep;
  reviewingDraft:boolean;
};
const guestCreateDraftKey='dealivra:guest-create-draft:v2';
const legacyGuestCreateDraftKey='dealivra:guest-create-draft:v1';
const guestCreateDraftLifetime=24*60*60*1000;
const guestCreateDraftMaximumBytes=16*1024;
const isCreateDraftMeaningful=(draft:DealDraft,template:DealTemplateId)=>Boolean(
  draft.title.trim()||
  draft.description.trim()||
  draft.price.trim()||
  template!=='phone'||
  draft.condition!=='Good'||
  draft.deliveryMethod!=='Meet in person'||
  draft.expiresInDays!==7
);
const clearGuestCreateDraft=()=>{
  try{
    window.localStorage.removeItem(guestCreateDraftKey);
    window.localStorage.removeItem(legacyGuestCreateDraftKey);
  }catch{}
};
const readGuestCreateDraft=():GuestCreateDraftRecovery|null=>{
  try{
    window.localStorage.removeItem(legacyGuestCreateDraftKey);
    const raw=window.localStorage.getItem(guestCreateDraftKey);
    if(!raw)return null;
    if(new TextEncoder().encode(raw).byteLength>guestCreateDraftMaximumBytes){
      clearGuestCreateDraft();
      return null;
    }
    const stored=JSON.parse(raw) as Partial<GuestCreateDraftRecovery>;
    const now=Date.now();
    if(stored.version!==2||typeof stored.savedAt!=='number'||stored.savedAt<=0||stored.savedAt>now||now-stored.savedAt>guestCreateDraftLifetime||!stored.draft){
      clearGuestCreateDraft();
      return null;
    }
    const template=dealTemplates.some(item=>item.id===stored.dealTemplate)?stored.dealTemplate!:'phone';
    const step=([1,2,3,4] as CreateFlowStep[]).includes(stored.createStep as CreateFlowStep)?stored.createStep as CreateFlowStep:1;
    const condition=(['Like new','Good','Fair'] as DealDraft['condition'][]).includes(stored.draft.condition as DealDraft['condition'])?stored.draft.condition as DealDraft['condition']:'Good';
    const deliveryMethod=(['Meet in person','Ship to buyer'] as DealDraft['deliveryMethod'][]).includes(stored.draft.deliveryMethod as DealDraft['deliveryMethod'])?stored.draft.deliveryMethod as DealDraft['deliveryMethod']:'Meet in person';
    const expiresInDays=([1,3,7,14,30] as number[]).includes(stored.draft.expiresInDays as number)?stored.draft.expiresInDays as number:7;
    const catalogSelection=sanitizeSmartCatalogSelection(stored.catalogSelection);
    const draft:DealDraft={
      title:typeof stored.draft.title==='string'?stored.draft.title.slice(0,120):'',
      description:typeof stored.draft.description==='string'?stored.draft.description.slice(0,10_000):'',
      price:typeof stored.draft.price==='string'?stored.draft.price.slice(0,32):'',
      currency:'USD',
      condition,
      serialNumber:'',
      deliveryMethod,
      expiresInDays
    };
    if(!isCreateDraftMeaningful(draft,template)){
      clearGuestCreateDraft();
      return null;
    }
    const reviewingDraft=Boolean(stored.reviewingDraft&&draft.title.trim().length>=3&&Number(draft.price)>0&&draft.description.trim().length>=20);
    return {version:2,savedAt:stored.savedAt,draft,dealTemplate:template,catalogSelection,createStep:step,reviewingDraft};
  }catch{
    clearGuestCreateDraft();
    return null;
  }
};
const writeGuestCreateDraft=(recovery:GuestCreateDraftRecovery)=>{
  try{
    const safeRecovery:GuestCreateDraftRecovery={
      version:2,
      savedAt:recovery.savedAt,
      draft:{
        title:recovery.draft.title.slice(0,120),
        description:recovery.draft.description.slice(0,10_000),
        price:recovery.draft.price.slice(0,32),
        currency:'USD',
        condition:recovery.draft.condition,
        serialNumber:'',
        deliveryMethod:recovery.draft.deliveryMethod,
        expiresInDays:recovery.draft.expiresInDays,
      },
      dealTemplate:recovery.dealTemplate,
      catalogSelection:sanitizeSmartCatalogSelection(recovery.catalogSelection),
      createStep:recovery.createStep,
      reviewingDraft:Boolean(recovery.reviewingDraft),
    };
    const serialized=JSON.stringify(safeRecovery);
    if(new TextEncoder().encode(serialized).byteLength>guestCreateDraftMaximumBytes){
      clearGuestCreateDraft();
      return;
    }
    window.localStorage.setItem(guestCreateDraftKey,serialized);
  }catch{clearGuestCreateDraft()}
};
function CreateDealReview({
  draft,
  photos,
  creating,
  requiresAccount,
  declarations,
  onDeclarationsChange,
  onEdit,
  onSaveDraft,
  onPublish
}:{
  draft:DealDraft;
  photos:File[];
  creating:boolean;
  requiresAccount:boolean;
  declarations:SellerDeclarations;
  onDeclarationsChange:(next:SellerDeclarations)=>void;
  onEdit:()=>void;
  onSaveDraft:()=>void;
  onPublish:()=>void;
}){
  const expiresAt=new Date(Date.now()+(draft.expiresInDays||7)*24*60*60*1000);
  const declarationsComplete=Object.values(declarations).every(Boolean);
  return <section className="draft-review">
    <button className="back" onClick={onEdit}>← {t('Edit details')}</button>
    <p className="eyebrow">{t('Review before publishing')}</p>
    <h1>{draft.title.trim()}</h1>
    <p className="lede small">{t(requiresAccount?'Check every detail. You will create an account only when you are ready to save or publish.':'Check every detail before creating the public Deal Link.')}</p>
    <div className="draft-review-grid">
      <div>
        {photos.length?<div className="draft-review-media">{photos.map((file,index)=><FilePreview key={`${file.name}-${file.size}-${index}`} file={file} alt={`${t('Preview')} ${index+1}`}/>)}</div>:<div className="draft-review-empty"><ImagePlus/><span>{t('No media selected')}</span></div>}
        <h2>{t('Item details')}</h2>
        <p className="draft-review-description">{draft.description.trim()}</p>
        <section className="draft-publish-clarity" aria-labelledby="publish-clarity-title">
          <div className="draft-publish-clarity-heading">
            <Eye/>
            <div><p className="eyebrow">{t('Before you publish')}</p><h2 id="publish-clarity-title">{t('Know exactly what happens next')}</h2></div>
          </div>
          <div className="draft-publish-clarity-grid">
            <article>
              <span className="draft-publish-clarity-icon"><Eye/></span>
              <div><h3>{t('The buyer will see')}</h3><ul>
                <li><Check/>{t('Item, price, condition, and disclosures')}</li>
                <li><Check/>{t(photos.length?`${photos.length} selected ${photos.length===1?'media file':'media files'}`:'No media unless you add it')}</li>
                <li><Check/>{t(`${draft.deliveryMethod} handoff terms`)}</li>
              </ul></div>
            </article>
            <article>
              <span className="draft-publish-clarity-icon"><Link2/></span>
              <div><h3>{t('After publishing')}</h3><ul>
                <li><Check/>{t('A unique Deal Link is created')}</li>
                <li><Check/>{t('You choose who receives the link')}</li>
                <li><Check/>{t('Buyer review continues in the Deal Room')}</li>
              </ul></div>
            </article>
          </div>
          <p className="draft-publish-clarity-note"><LockKeyhole/>{t('Publishing creates the deal record. It does not charge either party.')}</p>
        </section>
      </div>
      <aside className="draft-review-summary">
        <strong>{formatMoney(toMinorUnits(draft.price,draft.currency),draft.currency,getAppLanguage())}</strong>
        <div><span>{t('Condition')}</span><b>{t(draft.condition)}</b></div>
        <div><span>{t('Handoff')}</span><b>{t(draft.deliveryMethod)}</b></div>
        <div><span>{t('Serial')}</span><b>{draft.serialNumber.trim()?`•••• ${draft.serialNumber.trim().slice(-4)}`:t('Not provided')}</b></div>
        <div><span>{t('Offer expires')}</span><b>{expiresAt.toLocaleString(getAppLanguage())}</b></div>
        <SellerDeclarationChecklist id="seller-declarations" value={declarations} onChange={onDeclarationsChange}/>
        <p><LockKeyhole/>{t(requiresAccount?'Your draft stays private. Create an account only when you are ready to save or publish.':'The Deal Link is not public until you confirm.')}</p>
        {!declarationsComplete&&<small className="declaration-required">{t('Confirm all declarations before publishing.')}</small>}
        <div className="draft-review-save"><div><Bookmark/><span><b>{t('Save for later')}</b><small>{t(requiresAccount?'Create an account and keep this record private.':'Keep this record private until you are ready to publish.')}</small></span></div><button className="secondary" disabled={creating} onClick={onSaveDraft}>{t(requiresAccount?'Create account to save':'Save draft')}</button></div>
      </aside>
    </div>
    <div className="create-review-dock" role="region" aria-live="polite" aria-label={t('Publish deal actions')}>
      <div><small>{t('Final step')}</small><strong>{t(declarationsComplete?(requiresAccount?'Ready to create your account':'Ready to publish'):'Seller confirmation required')}</strong><span>{t(declarationsComplete?(requiresAccount?'Your completed draft will stay here while you sign up.':'Your deal details are ready.'):'Complete the 3 seller declarations to continue.')}</span></div>
      <button type="button" className="secondary" disabled={creating} onClick={onEdit}>{t('Edit')}</button>
      <button type="button" className="primary" aria-label={t(creating?'Publishing…':declarationsComplete?(requiresAccount?'Create account to publish':'Confirm and publish'):'Complete declarations')} disabled={creating} onClick={()=>{if(declarationsComplete){onPublish();return}const checklist=document.getElementById('seller-declarations');checklist?.scrollIntoView({behavior:motionSafeScrollBehavior('smooth'),block:'center'});checklist?.setAttribute('tabindex','-1');checklist?.focus({preventScroll:true})}}>{t(creating?'Publishing…':declarationsComplete?(requiresAccount?'Create account':'Confirm and publish'):'Complete declarations')}<ArrowRight size={18}/></button>
    </div>
  </section>
}

function GlobalHome({onCreate,onDemo,onInfo}:{onCreate:()=>void;onDemo:()=>void;onInfo:(view:PublicInfoView)=>void}){
  const steps=[
    {icon:<FileSignature/>,number:'01',title:'Create one secure record',body:'Add the item, price, condition, photos, and handoff terms.'},
    {icon:<Link2/>,number:'02',title:'Share the Deal Link',body:'Both parties review the same version and keep the conversation together.'},
    {icon:<BadgeDollarSign/>,number:'03',title:'Follow the payment status',body:'Both parties can see the Stripe Sandbox payment state and what happens next.'},
    {icon:<PackageCheck/>,number:'04',title:'Complete with evidence',body:'Record delivery, inspection, and the final handoff in the same deal history.'},
  ];
  return <>
    <section className="global-hero">
      <div className="global-hero-copy">
        <p className="global-kicker"><ShieldCheck size={17}/>One Deal Room from agreement to handoff</p>
        <h1>Make every private deal<br/><span>clear from the start.</span></h1>
        <p className="global-lede">Agree on the terms, follow the payment status, and keep delivery evidence together in one private transaction record.</p>
        <div className="global-hero-actions">
          <button type="button" className="global-primary" onClick={onCreate}><Plus size={18}/>{t('Start a deal')}<ArrowRight size={18}/></button>
          <button type="button" className="global-secondary" onClick={onDemo}><Eye size={18}/>{t('See a sample')}</button>
        </div>
        <div className="global-proof">
          <span><FileSignature size={18}/>{t('Shared agreement')}</span>
          <span><BadgeDollarSign size={18}/>{t('Visible payment status')}</span>
          <span><PackageCheck size={18}/>{t('Recorded handoff')}</span>
        </div>
        <p className="beta-payment-note"><ShieldAlert size={16}/>{t('Sandbox demo — no real money is transferred. Dealivra is not legal escrow.')}</p>
      </div>
      <div className="network-stage" aria-label={t('Dealivra protected transaction flow')}>
        <article className="home-product-preview">
          <header>
            <div><span className="preview-mark"><ShieldCheck/></span><div><small>{t('DEAL ROOM')}</small><b>{t('One place for the whole transaction')}</b></div></div>
            <span className="preview-live"><i></i>{t('Sandbox workflow')}</span>
          </header>
          <div className="preview-item">
            <span className="preview-item-icon"><Laptop/></span>
            <div><small>{t('ACTIVE DEAL')}</small><strong>MacBook Pro 14 · M3</strong><p>{t('Like new')} · {t('Ship to buyer')}</p></div>
            <b>{formatMoney(145000,'USD',getAppLanguage())}</b>
          </div>
          <div className="preview-progress" role="group" aria-label={t('Deal progress')}>
            <div className="done"><span><Check/></span><small>{t('Agreement')}</small></div>
            <i></i>
            <div className="active"><span><LockKeyhole/></span><small>{t('Payment')}</small></div>
            <i></i>
            <div><span><Truck/></span><small>{t('Delivery')}</small></div>
            <i></i>
            <div><span><PackageCheck/></span><small>{t('Complete')}</small></div>
          </div>
          <div className="preview-next">
            <div><small>{t('NEXT STEP')}</small><b>{t('Buyer reviews and confirms the shared terms')}</b></div>
            <button type="button" onClick={onDemo}>{t('Open sample')}<ArrowRight/></button>
          </div>
          <footer><span><BadgeCheck/>{t('Seller contact verified')}</span><span><Fingerprint/>{t('Agreement version recorded')}</span></footer>
        </article>
      </div>
    </section>

    <section className="home-capability-strip" aria-label={t('What Dealivra keeps together')}>
      <article><FileSignature/><div><b>{t('Clear agreement')}</b><span>{t('Price, condition, and handoff terms in one version.')}</span></div></article>
      <article><BadgeDollarSign/><div><b>{t('Visible payment state')}</b><span>{t('Both parties can see what is ready and what comes next.')}</span></div></article>
      <article><PackageCheck/><div><b>{t('Proof of delivery')}</b><span>{t('Photos, inspection, and handoff stay with the deal.')}</span></div></article>
      <article><Scale/><div><b>{t('Dispute record')}</b><span>{t('Problems and evidence remain tied to the same timeline.')}</span></div></article>
    </section>

    <section className="deal-flow" id="how-it-works">
      <div className="global-section-heading">
        <p className="eyebrow">{t('HOW DEALIVRA WORKS')}</p>
        <h2>{t('A clear path from agreement to completion.')}</h2>
        <p>{t('The essential steps stay visible to both sides, without the clutter of a traditional marketplace.')}</p>
      </div>
      <div className="deal-flow-grid">{steps.map(step=><article key={step.number}><div className="flow-icon">{step.icon}</div><span>{step.number}</span><h3>{t(step.title)}</h3><p>{t(step.body)}</p></article>)}</div>
    </section>

    <section className="home-use-cases" aria-labelledby="use-cases-title">
      <div className="global-section-heading">
        <p className="eyebrow">{t('BUILT FOR PRIVATE SALES')}</p>
        <h2 id="use-cases-title">{t('Useful when the item matters and the buyer is not beside you.')}</h2>
        <p>{t('Dealivra is focused on higher-trust private transactions, not an endless public marketplace feed.')}</p>
      </div>
      <div className="use-case-grid">
        <article><Laptop/><div><h3>{t('Electronics')}</h3><p>{t('Record condition, serial details, photos, shipping, and inspection expectations.')}</p></div></article>
        <article><Car/><div><h3>{t('Vehicles')}</h3><p>{t('Keep VIN details, known defects, price, and the planned in-person handoff together.')}</p></div></article>
        <article><Watch/><div><h3>{t('Watches and collectibles')}</h3><p>{t('Document identifiers, authenticity claims, included accessories, and delivery evidence.')}</p></div></article>
      </div>
    </section>

    <section className="money-flow" aria-labelledby="money-flow-title">
      <div className="money-flow-copy">
        <p className="eyebrow">{t('PAYMENT CLARITY')}</p>
        <h2 id="money-flow-title">{t('Know what the beta does before you continue.')}</h2>
        <p>{t('The current product demonstrates a Stripe Sandbox payment workflow. It does not transfer real money and Dealivra is not a licensed escrow service.')}</p>
        <ol>
          <li><span>1</span><div><strong>{t('Agree to one version')}</strong><small>{t('Both parties review the same item, price, disclosures, and handoff terms.')}</small></div></li>
          <li><span>2</span><div><strong>{t('Open Stripe Sandbox')}</strong><small>{t('The buyer tests checkout without a real charge or live card transfer.')}</small></div></li>
          <li><span>3</span><div><strong>{t('Record delivery evidence')}</strong><small>{t('Shipping, inspection, messages, and handoff activity stay with the deal.')}</small></div></li>
          <li><span>4</span><div><strong>{t('Complete or raise a problem')}</strong><small>{t('The final status remains visible in the same transaction history.')}</small></div></li>
        </ol>
      </div>
      <aside className="fee-preview" aria-label={t('Production cost preview')}>
        <p className="eyebrow">{t('PRODUCTION COST PREVIEW')}</p>
        <h3>{t('Every charge must be visible before payment.')}</h3>
        <dl>
          <div><dt>{t('Item price')}</dt><dd>{t('Set by seller')}</dd></div>
          <div><dt>{t('Dealivra service fee')}</dt><dd>{t('Shown before payment')}</dd></div>
          <div><dt>{t('Processing, shipping, and tax')}</dt><dd>{t('Itemized separately')}</dd></div>
          <div className="fee-total"><dt>{t('Final amount')}</dt><dd>{t('One U.S. dollar total')}</dd></div>
        </dl>
        <p><ShieldAlert/>{t('Production pricing, payment limits, and state availability are not published yet.')}</p>
        <button type="button" className="global-secondary light" onClick={()=>onInfo('fees')}>{t('Read fees and availability')}<ArrowRight size={16}/></button>
      </aside>
    </section>

    <section className="global-protection" id="protection">
      <div className="global-protection-copy">
        <p className="eyebrow">{t('BUILT FOR TRUST')}</p>
        <h2>{t('Protection both parties can understand.')}</h2>
        <p>{t('Dealivra keeps the agreement, payment status, evidence, and handoff history in one private transaction record.')}</p>
        <button type="button" className="global-secondary light" onClick={onCreate}>{t('Start a deal')}<ArrowRight size={17}/></button>
      </div>
      <div className="protection-grid">
        <article><FileSignature/><div><h3>{t('One shared agreement')}</h3><p>{t('Price, disclosures, and every accepted version stay together.')}</p></div></article>
        <article><BadgeDollarSign/><div><h3>{t('Visible card-payment status')}</h3><p>{t('The payment state and seller transfer steps are recorded clearly.')}</p></div></article>
        <article><ShieldCheck/><div><h3>{t('Evidence before release')}</h3><p>{t('Shipping, inspection, and disputes use the same deal history.')}</p></div></article>
      </div>
      <div className="protection-links" aria-label={t('Learn about protection')}>
        <a href={publicInfoPaths['buyer-protection']} onClick={event=>{event.preventDefault();onInfo('buyer-protection')}}>{t('Buyer protection')}<ArrowRight size={15}/></a>
        <a href={publicInfoPaths['seller-protection']} onClick={event=>{event.preventDefault();onInfo('seller-protection')}}>{t('Seller protection')}<ArrowRight size={15}/></a>
        <a href={publicInfoPaths.disputes} onClick={event=>{event.preventDefault();onInfo('disputes')}}>{t('Disputes and refunds')}<ArrowRight size={15}/></a>
        <a href={publicInfoPaths.fees} onClick={event=>{event.preventDefault();onInfo('fees')}}>{t('Fees and availability')}<ArrowRight size={15}/></a>
      </div>
    </section>

    <section className="home-faq" aria-labelledby="faq-title">
      <div className="global-section-heading">
        <p className="eyebrow">{t('BEFORE YOU START')}</p>
        <h2 id="faq-title">{t('Straight answers about the U.S. beta.')}</h2>
      </div>
      <div className="faq-list">
        <details><summary>{t('Is Dealivra a legal escrow service?')}<ChevronDown/></summary><p>{t('No. The current beta records agreements, Sandbox payment status, evidence, and handoff activity. A licensed payment or escrow partner and legal review are required before a live-money launch.')}</p></details>
        <details><summary>{t('Does Dealivra store card or bank details?')}<ChevronDown/></summary><p>{t('No. Payment credentials belong in the payment provider flow, not in Dealivra messages, forms, or evidence uploads.')}</p></details>
        <details><summary>{t('Where is the first release available?')}<ChevronDown/></summary><p>{t('The first release is planned for the United States in English (US) and U.S. dollars. Provider approval and applicable law may limit availability by state.')}</p></details>
        <details><summary>{t('What happens if something goes wrong?')}<ChevronDown/></summary><p>{t('A dispute keeps the reason, messages, delivery evidence, and inspection details in the deal record. Final refund and release rights must follow the published terms and payment-provider rules.')}</p></details>
      </div>
    </section>

    <section className="global-cta">
      <div><p className="eyebrow">{t('READY WHEN YOU ARE')}</p><h2>{t('Make the next private deal easier to trust.')}</h2></div>
      <button type="button" className="global-primary" onClick={onCreate}>{t('Start a deal')}<ArrowRight size={18}/></button>
    </section>
  </>
}

export function App() {
  const initialSession=getStoredSession();
  const [recoveredCreateDraft]=useState(()=>initialSession?null:readGuestCreateDraft());
  const initialRoute=resolveBrowserRoute(location.href);
  const entryView:View=initialRoute.view==='deal'?'route-loading':initialRoute.view;
  const [view,setView]=useState<View>(entryView); const [deals,setDeals]=useState<Deal[]>([]); const [active,setActive]=useState<Deal>(); const [draft,setDraft]=useState<DealDraft>(()=>recoveredCreateDraft?.draft||{...initial}); const [buyer,setBuyer]=useState('');
  const dealListRequestRef=useRef(0);
  const [dashboardRevision,setDashboardRevision]=useState(0);
  const [dashboardLoading,setDashboardLoading]=useState(true);
  const [dashboardError,setDashboardError]=useState('');
  const [session,setSession]=useState<StoredSession|null>(initialSession);
  const user=session?.user??null;
  const [authMode,setAuthMode]=useState<AuthMode>(initialRoute.authMode||'signup');
  const [recoveryToken,setRecoveryToken]=useState(initialRoute.recoveryToken||'');
  const [routeRevision,setRouteRevision]=useState(0);
  const routeRequestRef=useRef(0);
  const publicDealRequestRef=useRef(0);
  const profileRequestRef=useRef(0);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const mobileMenuButtonRef=useRef<HTMLButtonElement>(null);
  const [passwordVisible,setPasswordVisible]=useState(false);
  const [acceptedPolicies,setAcceptedPolicies]=useState(false);
  const [returnAfterAuth,setReturnAfterAuth]=useState<View>(initialRoute.view==='create'?'create':'home');
  const [authForm,setAuthForm]=useState<AuthFormState>({displayName:'',email:'',password:''});
  const [authMessage,setAuthMessage]=useState('');
  const [mfaLogin,setMfaLogin]=useState<MfaLoginChallenge|null>(null);
  const [photos,setPhotos]=useState<File[]>([]);
  const [dealTemplate,setDealTemplate]=useState<DealTemplateId>(()=>recoveredCreateDraft?.dealTemplate||'phone');
  const [catalogSelection,setCatalogSelection]=useState<SmartCatalogSelection>(()=>recoveredCreateDraft?.catalogSelection||emptySmartCatalogSelection());
  const catalogSelectionRef=useRef(catalogSelection);
  const [vehicleVinLookup,setVehicleVinLookup]=useState<VehicleVinLookupState>({status:'idle',message:''});
  const vehicleVinRequestRef=useRef(0);
  const vehicleVinActiveRef=useRef(false);
  const [agreementChecks,setAgreementChecks]=useState({item:false,price:false,handoff:false});
  const [demoCompleted,setDemoCompleted]=useState(false);
  const [acceptanceProtected,setAcceptanceProtected]=useState(false);
  const [acceptanceProtectionState,setAcceptanceProtectionState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [acceptanceProtectionError,setAcceptanceProtectionError]=useState('');
  const [acceptanceProtectionRevision,setAcceptanceProtectionRevision]=useState(0);
  const [buyerAccessCode,setBuyerAccessCode]=useState('');
  const [paymentReadyByDeal,setPaymentReadyByDeal]=useState<Record<string,boolean>>({});
  const [actionPlanByDeal,setActionPlanByDeal]=useState<Record<string,DealActionPlan>>({});
  const [shippingReadinessByDeal,setShippingReadinessByDeal]=useState<Record<string,ShippingNavigationReadiness>>({});
  const [evidenceRevision,setEvidenceRevision]=useState(0);
  const [creating,setCreating]=useState(false);
  const createMutationRef=useRef(false);
  const [accepting,setAccepting]=useState(false);
  const [authSubmitting,setAuthSubmitting]=useState(false);
  const authSubmittingRef=useRef(false);
  const acceptMutationRef=useRef(false);
  const verificationMutationRef=useRef(false);
  const [createStep,setCreateStep]=useState<CreateFlowStep>(()=>recoveredCreateDraft?.createStep||1);
  const [reviewingDraft,setReviewingDraft]=useState(()=>Boolean(recoveredCreateDraft?.reviewingDraft));
  const [createValidationAttempted,setCreateValidationAttempted]=useState(false);
  const [sellerDeclarations,setSellerDeclarations]=useState<SellerDeclarations>(emptySellerDeclarations);
  const [pendingCreateAction,setPendingCreateAction]=useState<'save'|'publish'|null>(null);
  const [draftRecovered,setDraftRecovered]=useState(Boolean(recoveredCreateDraft));
  const [draftSavedAt,setDraftSavedAt]=useState<number|null>(recoveredCreateDraft?.savedAt||null);
  const selectedDealTemplate=dealTemplates.find(item=>item.id===dealTemplate)||dealTemplates[0];
  const identifierEntered=Boolean(draft.serialNumber.trim());
  const identifierValid=!identifierEntered||new RegExp(`^(?:${selectedDealTemplate.identifierPattern})$`,'i').test(draft.serialNumber.trim());
  const createItemReady=draft.title.trim().length>=3&&draft.title.trim().length<=120&&Number(draft.price)>0;
  const createTermsReady=draft.description.trim().length>=20&&identifierValid;
  const createAvailableStep:CreateFlowStep=reviewingDraft?4:createItemReady?(createTermsReady?3:2):1;
  const getCreateStepErrors=(step:CreateFlowStep):CreateFieldError[]=>{
    if(step===1){
      const errors:CreateFieldError[]=[];
      if(draft.title.trim().length<3)errors.push({fieldId:'create-item-title',message:draft.title.trim()?'Use at least 3 characters for the item title.':'Add an item title.'});
      if(!draft.price.trim()||Number(draft.price)<=0)errors.push({fieldId:'create-item-price',message:draft.price.trim()?'Enter a price greater than $0.':'Enter the item price.'});
      return errors;
    }
    if(step===2){
      const errors:CreateFieldError[]=[];
      if(draft.description.trim().length<20)errors.push({fieldId:'create-item-description',message:'Describe the condition and defects using at least 20 characters.'});
      if(!identifierValid)errors.push({fieldId:'create-item-identifier',message:`${selectedDealTemplate.identifierLabel}: ${selectedDealTemplate.identifierHelp}`});
      return errors;
    }
    return [];
  };
  const createErrors=createValidationAttempted?getCreateStepErrors(createStep):[];
  const [profile,setProfile]=useState<ProfileSummary|null>(null);
  const [profileLoading,setProfileLoading]=useState(false);
  const [publicPassport,setPublicPassport]=useState<TrustPassport|null>(null);
  const [passportMessage,setPassportMessage]=useState('');
  const [savedDeals,setSavedDeals]=useState<Deal[]>([]);
  const savedDealsRequestRef=useRef(0);
  const [verificationMessage,setVerificationMessage]=useState('');
  const [verificationRequesting,setVerificationRequesting]=useState(false);
  const [notifications,setNotifications]=useState<DealNotification[]>([]);
  const [notificationsLoading,setNotificationsLoading]=useState(false);
  const [notificationsError,setNotificationsError]=useState('');
  const [notificationsRevision,setNotificationsRevision]=useState(0);
  const notificationRequestRef=useRef(0);
  const [isAdmin,setIsAdmin]=useState(false);
  const [clock,setClock]=useState(Date.now());
  const previousViewRef=useRef<View>(view);
  useEffect(()=>{applyPageMetadata(getPageMetadata(view,active?.title,Boolean(user)))},[view,active?.title,user]);
  useEffect(()=>{
    if(previousViewRef.current===view)return;
    previousViewRef.current=view;
    const frame=window.requestAnimationFrame(()=>{
      document.getElementById('main-content')?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'auto'});
    });
    return()=>window.cancelAnimationFrame(frame);
  },[view]);
  useEffect(()=>{
    if(!mobileMenuOpen)return;
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      setMobileMenuOpen(false);
      window.requestAnimationFrame(()=>mobileMenuButtonRef.current?.focus());
    };
    const closeAboveTablet=()=>{
      if(window.innerWidth>860)setMobileMenuOpen(false);
    };
    document.addEventListener('keydown',closeOnEscape);
    window.addEventListener('resize',closeAboveTablet);
    return()=>{
      document.removeEventListener('keydown',closeOnEscape);
      window.removeEventListener('resize',closeAboveTablet);
    };
  },[mobileMenuOpen]);
  useEffect(()=>{
    const scrollToLocation=()=>{
      const id=location.hash.slice(1);
      window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>focusPageDestination(id||undefined)));
    };
    const onPopState=()=>setRouteRevision(revision=>revision+1);
    if(entryView==='home'&&location.hash)scrollToLocation();
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[]);
  useEffect(()=>{
    const requestId=++routeRequestRef.current;
    let current=true;
    const route=resolveBrowserRoute(location.href);
    const isCurrent=()=>current&&requestId===routeRequestRef.current;
    const scrollToLocation=()=>{
      const id=location.hash.slice(1);
      window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>focusPageDestination(id||undefined,id?'smooth':'auto')));
    };

    setMobileMenuOpen(false);
    setRecoveryToken(route.recoveryToken||'');
    if(route.view==='auth'){
      setAuthMode(route.authMode||'signup');
      setReturnAfterAuth('home');
      setAuthMessage('');
      setView('auth');
    }else if(route.view==='passport'&&route.trustId){
      setPublicPassport(null);
      setPassportMessage('');
      setView('passport');
      getPublicTrustPassport(route.trustId)
        .then(passport=>{
          if(!isCurrent())return;
          if(passport)setPublicPassport(passport);
          else setPassportMessage('Passport unavailable');
        })
        .catch(error=>{if(isCurrent())setPassportMessage(error instanceof Error?error.message:'Passport unavailable')});
    }else if(route.view==='deal'&&route.publicDealId){
      setAuthMessage('');
      setView('route-loading');
      const loadDeal=route.publicDealId===DEMO_DEAL_PUBLIC_ID
        ?demoRepository.list().then(items=>{
          const deal=items.find(item=>item.publicId===route.publicDealId);
          if(!deal)throw new Error('Deal Link unavailable');
          return {...deal,viewerRole:'visitor' as const};
        })
        :getPublicDeal(route.publicDealId);
      loadDeal
        .then(deal=>{if(isCurrent()){setActive(deal);setView('deal')}})
        .catch(error=>{if(isCurrent()){setAuthMessage(error instanceof Error?error.message:'Deal Link unavailable');setView('link-error')}});
    }else{
      if(route.view==='create')setReturnAfterAuth('create');
      setView(route.view);
      if(route.view==='home')scrollToLocation();
    }
    return()=>{current=false};
  },[routeRevision]);
  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{if(view==='auth'&&!isSupabaseConfigured)setAuthMessage('Account service is temporarily unavailable. Please try again later.')},[view,authMode]);
  useEffect(()=>{
    if(initialSession||!hasSessionHint())return;
    let current=true;
    restoreSession()
      .then(restored=>{if(current&&restored)setSession(restored)})
      .catch(error=>{
        if(current&&view==='auth')setAuthMessage(error instanceof Error?error.message:'Could not restore your session.');
      });
    return()=>{current=false};
  },[]);
  useEffect(()=>{const updated=(event:Event)=>setSession((event as CustomEvent<StoredSession>).detail);const expired=()=>{setSession(null);setMfaLogin(null);setAuthMessage('Your session expired. Please sign in again.');setView('auth')};const requiresMfa=()=>{setAuthMessage('Verify or enroll an authenticator before continuing with this protected account.');setView('profile')};window.addEventListener(sessionUpdatedEvent,updated);window.addEventListener(sessionExpiredEvent,expired);window.addEventListener(mfaRequiredEvent,requiresMfa);return()=>{window.removeEventListener(sessionUpdatedEvent,updated);window.removeEventListener(sessionExpiredEvent,expired);window.removeEventListener(mfaRequiredEvent,requiresMfa)}},[]);
  useEffect(()=>{if(!session)return;const recordActivity=()=>markSessionActivity();const events=['pointerdown','keydown','touchstart'] as const;events.forEach(event=>{window.addEventListener(event,recordActivity,{passive:true})});window.addEventListener('focus',recordActivity);return()=>{events.forEach(event=>{window.removeEventListener(event,recordActivity)});window.removeEventListener('focus',recordActivity)}},[session?.user.id]);
  useEffect(()=>{const request=++dealListRequestRef.current;const savedRequest=++savedDealsRequestRef.current;setDashboardLoading(true);setDashboardError('');const sources=session?Promise.all([listUserDeals(session),getMySavedDeals(session)]):Promise.all([demoRepository.list(),Promise.resolve([] as Deal[])]);sources.then(([nextDeals,nextSaved])=>{if(request===dealListRequestRef.current&&savedRequest===savedDealsRequestRef.current){setDeals(nextDeals);setSavedDeals(nextSaved)}}).catch(error=>{if(request===dealListRequestRef.current&&savedRequest===savedDealsRequestRef.current)setDashboardError(error instanceof Error?error.message:'Could not load your workspace.')}).finally(()=>{if(request===dealListRequestRef.current&&savedRequest===savedDealsRequestRef.current)setDashboardLoading(false)});return()=>{dealListRequestRef.current+=1;savedDealsRequestRef.current+=1}},[session,dashboardRevision]);
  useEffect(()=>{
    if(session){
      clearGuestCreateDraft();
      setDraftSavedAt(null);
      return;
    }
    if(!isCreateDraftMeaningful(draft,dealTemplate)){
      clearGuestCreateDraft();
      setDraftSavedAt(null);
      return;
    }
    const timer=window.setTimeout(()=>{
      const savedAt=Date.now();
      writeGuestCreateDraft({
        version:2,
        savedAt,
        draft:{
          title:draft.title,
          description:draft.description,
          price:draft.price,
          currency:'USD',
          condition:draft.condition,
          serialNumber:'',
          deliveryMethod:draft.deliveryMethod,
          expiresInDays:draft.expiresInDays,
        },
        dealTemplate,
        catalogSelection,
        createStep,
        reviewingDraft
      });
      setDraftSavedAt(savedAt);
    },450);
    return()=>window.clearTimeout(timer);
  },[draft,dealTemplate,catalogSelection,createStep,reviewingDraft,session]);
  useEffect(()=>{if(!session)return;let current=true;let renewing=false;const renew=()=>{if(renewing)return;if(!session.expiresAt||session.expiresAt-Date.now()<10*60*1000){renewing=true;refreshSession(session).then(next=>{if(current)setSession(next)}).catch(error=>{if(!current)return;if(isTransientAuthenticationError(error)){setAuthMessage(error.message);return}void signOut(session);setSession(null);setAuthMessage('Your session expired. Please sign in again.');setView('auth')}).finally(()=>{renewing=false})}};renew();const timer=setInterval(renew,5*60*1000);return()=>{current=false;clearInterval(timer)}},[session?.user.id,session?.expiresAt]);
  useEffect(()=>{catalogSelectionRef.current=catalogSelection},[catalogSelection]);
  useEffect(()=>{if(!session){notificationRequestRef.current+=1;setNotifications([]);setNotificationsError('');setNotificationsLoading(false);return}let current=true;const load=()=>{const request=++notificationRequestRef.current;setNotificationsLoading(true);setNotificationsError('');return getMyNotifications(session).then(items=>{if(current&&request===notificationRequestRef.current)setNotifications(items)}).catch(error=>{if(current&&request===notificationRequestRef.current)setNotificationsError(error instanceof Error?error.message:'Could not load recent activity.')}).finally(()=>{if(current&&request===notificationRequestRef.current)setNotificationsLoading(false)})};void load();const timer=window.setInterval(()=>void load(),30_000);return()=>{current=false;notificationRequestRef.current+=1;window.clearInterval(timer)}},[session?.accessToken,notificationsRevision]);
  useEffect(()=>{if(view!=='deal'||!active||!session)return;setNotifications(items=>items.map(item=>item.deal_id===active.id?{...item,is_read:true}:item));void markDealNotificationsRead(session,active.id).catch(()=>{})},[view,active?.id,session?.accessToken]);
  useEffect(()=>{if(!session){setIsAdmin(false);return}let current=true;getAdminAccess(session).then(access=>{if(current)setIsAdmin(access)}).catch(()=>{if(current)setIsAdmin(false)});return()=>{current=false}},[session]);
  useEffect(()=>{setBuyer('');setBuyerAccessCode('');setAgreementChecks({item:false,price:false,handoff:false});setDemoCompleted(false)},[active?.publicId,active?.agreementVersion]);
  useEffect(()=>{let current=true;setAcceptanceProtected(false);setAcceptanceProtectionError('');if(!active||active.status!=='published'){setAcceptanceProtectionState('idle');return}if(active.publicId===DEMO_DEAL_PUBLIC_ID){setAcceptanceProtectionState('ready');return}setAcceptanceProtectionState('loading');getDealAcceptanceProtection(active.publicId).then(enabled=>{if(current){setAcceptanceProtected(enabled);setAcceptanceProtectionState('ready')}}).catch(error=>{if(current){setAcceptanceProtectionError(error instanceof Error?error.message:'Could not verify buyer-code protection.');setAcceptanceProtectionState('error')}});return()=>{current=false}},[active?.publicId,active?.status,acceptanceProtectionRevision]);
  useEffect(()=>{
    if(!active||!session||active.viewerRole!=='seller'||active.status!=='accepted'||active.deliveryMethod!=='Ship to buyer')return;
    let current=true;
    const dealId=active.id;
    setShippingReadinessByDeal(items=>({...items,[dealId]:{status:'loading',ready:items[dealId]?.ready??false}}));
    getSellerShippingEvidenceReadiness(session,dealId)
      .then(readiness=>{if(current)setShippingReadinessByDeal(items=>({...items,[dealId]:{status:'ready',ready:Boolean(readiness?.ready)}}))})
      .catch(()=>{if(current)setShippingReadinessByDeal(items=>({...items,[dealId]:{status:'error',ready:items[dealId]?.ready??false}}))});
    return()=>{current=false};
  },[active?.id,active?.viewerRole,active?.status,active?.deliveryMethod,session?.accessToken,evidenceRevision]);
  const focusCreateField=(fieldId:string)=>{const field=document.getElementById(fieldId);field?.focus({preventScroll:true});field?.scrollIntoView({behavior:motionSafeScrollBehavior('smooth'),block:'center'})};
  const chooseDealTemplate=(template:DealTemplateId)=>{
    if(template===dealTemplate)return;
    const emptySelection=emptySmartCatalogSelection();
    setDealTemplate(template);
    vehicleVinRequestRef.current+=1;
    vehicleVinActiveRef.current=false;
    setVehicleVinLookup({status:'idle',message:''});
    catalogSelectionRef.current=emptySelection;
    setCatalogSelection(emptySelection);
    setDraft(current=>({...current,title:''}));
  };
  const updateCatalogSelection=(patch:Partial<SmartCatalogSelection>)=>{
    const next={...catalogSelectionRef.current,...patch};
    catalogSelectionRef.current=next;
    setCatalogSelection(next);
    setDraft(current=>({...current,title:buildSmartCatalogTitle(dealTemplate,next)}));
  };
  const checkVehicleVin=async()=>{
    if(dealTemplate!=='vehicle'||!identifierEntered||!identifierValid||vehicleVinActiveRef.current)return;
    const request=++vehicleVinRequestRef.current;
    vehicleVinActiveRef.current=true;
    setVehicleVinLookup({status:'loading',message:'Checking manufacturer data…'});
    try{
      const result=await decodeVehicleVin(draft.serialNumber);
      if(request!==vehicleVinRequestRef.current)return;
      const matchedBrand=vehicleCatalog.find(item=>item.label.toLocaleLowerCase('en-US')===result.make.toLocaleLowerCase('en-US'));
      const matchedModel=matchedBrand?matchCatalogValue(matchedBrand.models,result.model):'';
      const matchedYear=matchCatalogValue(vehicleYears,result.modelYear);
      const patch:Partial<SmartCatalogSelection>={
        year:matchedYear||catalogSelectionRef.current.year,
        brand:matchedBrand?.label||OTHER_CATALOG_VALUE,
        model:matchedBrand?(matchedModel||OTHER_CATALOG_VALUE):'',
        customBrand:matchedBrand?'':result.make,
        customModel:matchedModel?'':result.model,
      };
      updateCatalogSelection(patch);
      const identity=[result.modelYear,result.make,result.model].filter(Boolean).join(' ');
      setVehicleVinLookup({
        status:'success',
        message:`Matched ${identity}. Review the details before continuing.`,
        result,
      });
    }catch(error){
      if(request!==vehicleVinRequestRef.current)return;
      setVehicleVinLookup({
        status:'error',
        message:error instanceof Error?error.message:'VIN could not be checked. Enter the details manually.',
      });
    }finally{
      if(request===vehicleVinRequestRef.current)vehicleVinActiveRef.current=false;
    }
  };
  const showCreateErrors=()=>{
    setCreateValidationAttempted(true);
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>document.getElementById('create-validation-summary')?.focus({preventScroll:false})));
  };
  const submitCreateStep=(step:CreateFlowStep)=>{
    const errors=getCreateStepErrors(step);
    if(errors.length){showCreateErrors();return}
    setCreateValidationAttempted(false);
    if(step===1)goToCreateStep(2);
    else if(step===2)goToCreateStep(3);
  };
  const goToCreateStep=(step:CreateFlowStep)=>{if(step>createAvailableStep)return;setAuthMessage('');setCreateValidationAttempted(false);setReviewingDraft(step===4);if(step<4)setCreateStep(step);window.requestAnimationFrame(()=>document.getElementById('create-deal-flow')?.scrollIntoView({behavior:motionSafeScrollBehavior('smooth'),block:'start'}))};
  const reviewDraft=(e:React.FormEvent)=>{e.preventDefault();setAuthMessage('');if(!createItemReady){setCreateStep(1);return}if(!createTermsReady){setCreateStep(2);return}setReviewingDraft(true);window.scrollTo({top:0,behavior:motionSafeScrollBehavior('smooth')})};
  const resetCreateFlow=()=>{const emptySelection=emptySmartCatalogSelection();clearGuestCreateDraft();vehicleVinRequestRef.current+=1;vehicleVinActiveRef.current=false;setDraft({...initial});setPhotos([]);setDealTemplate('phone');setVehicleVinLookup({status:'idle',message:''});catalogSelectionRef.current=emptySelection;setCatalogSelection(emptySelection);setCreateStep(1);setReviewingDraft(false);setCreateValidationAttempted(false);setSellerDeclarations(emptySellerDeclarations);setPendingCreateAction(null);setDraftRecovered(false);setDraftSavedAt(null)};
  const draftForPersistence=():DealDraft=>({...draft,catalog:buildDealCatalogIdentity(dealTemplate,catalogSelectionRef.current)});
  const updateBrowserAddress=(destination:string,replace=false)=>{
    if(`${location.pathname}${location.search}${location.hash}`===destination)return;
    history[replace?'replaceState':'pushState']({},'',destination);
  };
  const openAuthRoute=(mode:'signin'|'signup',returnView:View)=>{
    updateBrowserAddress(`/?start=${mode}`);
    setAuthMode(mode);
    setReturnAfterAuth(returnView);
    setAuthMessage('');
    setMobileMenuOpen(false);
    setView('auth');
  };
  const publishDraft=async(activeSession:StoredSession)=>{if(createMutationRef.current)return;createMutationRef.current=true;setCreating(true);setAuthMessage('');try{let deal=await createUserDeal(activeSession,draftForPersistence());setDeals(x=>[deal,...x]);setActive(deal);if(photos.length){try{const mediaUrls=await uploadDealPhotos(activeSession,deal.id,photos);deal={...deal,mediaUrls};setActive(deal);setDeals(items=>items.map(item=>item.id===deal.id?deal:item))}catch(error){setAuthMessage(`Deal created, but photos need to be added again: ${error instanceof Error?error.message:'upload failed'}`)}}resetCreateFlow();setActive(deal);setView('published')}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not save this deal');setView('create')}finally{createMutationRef.current=false;setCreating(false)}};
  const saveDraftForSession=async(activeSession:StoredSession)=>{if(createMutationRef.current)return;createMutationRef.current=true;setCreating(true);setAuthMessage('');try{let deal=await saveUserDealDraft(activeSession,draftForPersistence());setDeals(items=>[deal,...items]);setActive(deal);if(photos.length){try{const mediaUrls=await uploadDealPhotos(activeSession,deal.id,photos);deal={...deal,mediaUrls};setActive(deal);setDeals(items=>items.map(item=>item.id===deal.id?deal:item))}catch(error){setAuthMessage(`Draft saved, but photos need to be added again: ${error instanceof Error?error.message:'upload failed'}`)}}resetCreateFlow();setView('deal')}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not save draft');setView('create')}finally{createMutationRef.current=false;setCreating(false)}};
  const requestCreateAction=(action:'save'|'publish')=>{
    if(session){void (action==='publish'?publishDraft(session):saveDraftForSession(session));return}
    setPendingCreateAction(action);
    openAuthRoute('signup','create');
  };
  const open=(d:Deal)=>{setActive(d);setView('deal')};
  const openPublicDeal=async(publicId:string)=>{
    const request=++publicDealRequestRef.current;
    updateBrowserAddress(`/?deal=${encodeURIComponent(publicId)}`);
    setAuthMessage('');
    setView('route-loading');
    try{
      const deal=await getPublicDeal(publicId);
      if(request!==publicDealRequestRef.current)return;
      setActive(deal);
      setView('deal');
    }catch(error){
      if(request===publicDealRequestRef.current){setAuthMessage(error instanceof Error?error.message:'Deal Link unavailable');setView('link-error')}
    }
  };
  const agreementConfirmed=Object.values(agreementChecks).every(Boolean);
  const accept=async()=>{if(!active||!buyer.trim()||!agreementConfirmed||acceptMutationRef.current)return;if(active.publicId===DEMO_DEAL_PUBLIC_ID&&!session){setDemoCompleted(true);setAuthMessage('');window.requestAnimationFrame(()=>window.requestAnimationFrame(scrollToAgreement));return}if(isDealExpired(active)){setAuthMessage('This Deal Link can no longer be accepted.');return}if(!session){openAuthRoute('signin','deal');setAuthMessage('Sign in or create an account to accept this deal.');return}acceptMutationRef.current=true;setAccepting(true);try{const protectionRequired=await getDealAcceptanceProtection(active.publicId);setAcceptanceProtected(protectionRequired);if(protectionRequired&&!/^[0-9]{6}$/.test(buyerAccessCode)){setAuthMessage('Enter the 6-digit buyer code.');return}await acceptPublicDeal(session,active.publicId,buyer.trim(),buyerAccessCode);const deal={...active,status:'accepted' as const,buyerName:buyer.trim(),buyerVerification:'not_started' as const,viewerRole:'buyer' as const};setActive(deal);setAcceptanceProtected(false);setDeals(x=>x.map(d=>d.id===deal.id?deal:d))}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not accept this deal')}finally{acceptMutationRef.current=false;setAccepting(false)}};
  const openCreate=()=>{updateBrowserAddress('/?start=create');setAuthMessage('');if(session||!isCreateDraftMeaningful(draft,dealTemplate))resetCreateFlow();setView('create')};
  const openDemo=async()=>{const sample=deals.find(deal=>deal.publicId===DEMO_DEAL_PUBLIC_ID)||(await demoRepository.list())[0];if(!sample)return;updateBrowserAddress(`/?deal=${encodeURIComponent(sample.publicId)}`);setAuthMessage('');setBuyer('');setAgreementChecks({item:false,price:false,handoff:false});setDemoCompleted(false);setActive({...sample,viewerRole:'visitor'});setView('deal');window.scrollTo({top:0,behavior:motionSafeScrollBehavior('smooth')})};
  const finishAuthentication=async(nextSession:StoredSession)=>{
    setMfaLogin(null);
    setSession(nextSession);
    if(returnAfterAuth==='create'&&pendingCreateAction){
      const action=pendingCreateAction;
      setPendingCreateAction(null);
      updateBrowserAddress('/?start=create',true);
      setView('create');
      await (action==='publish'?publishDraft(nextSession):saveDraftForSession(nextSession));
      return;
    }
    updateBrowserAddress(returnAfterAuth==='deal'&&active?`/?deal=${encodeURIComponent(active.publicId)}`:returnAfterAuth==='create'?'/?start=create':'/',true);
    setView(returnAfterAuth);
  };
  const submitAuth=async(e:React.FormEvent)=>{e.preventDefault();if(authSubmittingRef.current)return;authSubmittingRef.current=true;setAuthSubmitting(true);setAuthMessage('');try{if(authMode==='signup'){const result=await signUp(authForm.email.trim(),authForm.password,authForm.displayName.trim());if(result.session)await finishAuthentication(result.session);else setAuthMessage('Check your email to confirm your account, then return to this tab and sign in. Your completed draft will stay here.')}else{const result=await signIn(authForm.email.trim(),authForm.password);if('mfaRequired' in result){setMfaLogin(result);setAuthForm(current=>({...current,password:''}));return}await finishAuthentication(result)}}catch(error){setAuthMessage(error instanceof Error?error.message:'Something went wrong')}finally{authSubmittingRef.current=false;setAuthSubmitting(false)}};
  const finishSignedOutSession=()=>{publicDealRequestRef.current+=1;profileRequestRef.current+=1;updateBrowserAddress('/',true);setSession(null);setMfaLogin(null);setIsAdmin(false);setView('home')};
  const logout=()=>{void signOut(session);finishSignedOutSession()};
  const openProfile=async()=>{if(!session)return;const request=++profileRequestRef.current;setProfileLoading(true);setAuthMessage('');setView('profile');try{const next=await getMyProfileSummary(session);if(request===profileRequestRef.current)setProfile(next)}catch(error){if(request===profileRequestRef.current)setAuthMessage(error instanceof Error?error.message:'Could not load profile')}finally{if(request===profileRequestRef.current)setProfileLoading(false)}};
  const requestVerification=async()=>{if(!session||!profile||verificationMutationRef.current)return;verificationMutationRef.current=true;setVerificationRequesting(true);setVerificationMessage('');try{const status=await requestIdentityVerification(session);setProfile({...profile,verification_status:status});setVerificationMessage('Request recorded. A verification provider must be connected before identity can be approved.')}catch(error){setVerificationMessage(error instanceof Error?error.message:'Could not request verification')}finally{verificationMutationRef.current=false;setVerificationRequesting(false)}};
  const refreshSavedDeals=()=>{if(!session)return;const request=++savedDealsRequestRef.current;setDashboardError('');getMySavedDeals(session).then(items=>{if(request===savedDealsRequestRef.current)setSavedDeals(items)}).catch(error=>{if(request===savedDealsRequestRef.current)setDashboardError(error instanceof Error?error.message:'Could not refresh your Watchlist.')})};
  const markAllActivityRead=()=>{if(!session)return;const request=++notificationRequestRef.current;const previous=notifications;setNotifications(items=>items.map(item=>({...item,is_read:true})));setNotificationsError('');void markAllNotificationsRead(session).catch(error=>{if(request===notificationRequestRef.current){setNotifications(previous);setNotificationsError(error instanceof Error?error.message:'Could not mark activity as read.')}})};
  const applyDealParticipants=(dealId:string,participants:DealParticipants)=>{const merge=(deal:Deal):Deal=>({...deal,sellerName:participants.seller_name,sellerVerification:participants.seller_verification,buyerName:participants.buyer_name,buyerVerification:participants.buyer_verification,viewerRole:participants.viewer_role});setActive(current=>current?.id===dealId?merge(current):current);setDeals(items=>items.map(item=>item.id===dealId?merge(item):item))};
  const applyDealActionPlan=(dealId:string,plan:DealActionPlan)=>{
    setActionPlanByDeal(items=>{
      const previous=items[dealId];
      return previous&&JSON.stringify(previous)===JSON.stringify(plan)?items:{...items,[dealId]:plan};
    });
    setActive(current=>current?.id===dealId&&(current.status!==plan.deal_status||current.viewerRole!==plan.viewer_role)?{...current,status:plan.deal_status,viewerRole:plan.viewer_role}:current);
    setDeals(items=>items.map(item=>item.id===dealId&&(item.status!==plan.deal_status||item.viewerRole!==plan.viewer_role)?{...item,status:plan.deal_status,viewerRole:plan.viewer_role}:item));
  };
  const refreshDealActionPlan=async(dealId:string)=>{
    if(!session)return;
    const plan=await getDealActionPlan(session,dealId).catch(()=>null);
    if(plan)applyDealActionPlan(dealId,plan);
  };
  const activeExpired=active?isDealExpired(active,clock):false;
  const isDemoActive=Boolean(active?.publicId===DEMO_DEAL_PUBLIC_ID&&!user);
  const demoFlowCompleted=isDemoActive&&demoCompleted;
  const agreementActionReady=agreementConfirmed&&Boolean(buyer.trim())&&!demoFlowCompleted&&(isDemoActive||acceptanceProtectionState==='ready');
  const scrollToDealSection=(id:string)=>{
    const section=document.getElementById(id)||document.getElementById('deal-actions');
    if(!section)return;
    const expandable=section instanceof HTMLDetailsElement?section:section?.closest('details');
    if(expandable instanceof HTMLDetailsElement)expandable.open=true;
    section.classList.remove('deal-target-highlight');
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      section.scrollIntoView({behavior:motionSafeScrollBehavior('smooth'),block:'center'});
      section.setAttribute('tabindex','-1');
      section.focus({preventScroll:true});
      section.classList.add('deal-target-highlight');
      window.setTimeout(()=>section.classList.remove('deal-target-highlight'),1400);
    }));
  };
  const scrollToAgreement=()=>scrollToDealSection('deal-agreement');
  const resetDemoFlow=()=>{
    setAgreementChecks({item:false,price:false,handoff:false});
    setBuyer('');
    setAuthMessage('');
    setDemoCompleted(false);
    window.requestAnimationFrame(()=>window.requestAnimationFrame(scrollToAgreement));
  };
  const activePaymentReady=Boolean(active&&paymentReadyByDeal[active.id]);
  const activeActionPlan=active?actionPlanByDeal[active.id]:undefined;
  const activeShippingReadiness=active?shippingReadinessByDeal[active.id]:undefined;
  const dealPrimaryAction:DealPrimaryAction|null=active
    ? resolveDealPrimaryAction({
        deal:active,
        demoCompleted:demoFlowCompleted,
        expired:activeExpired,
        agreementActionReady,
        signedIn:Boolean(session),
        paymentReady:activePaymentReady,
        actionPlan:activeActionPlan,
        shippingReadiness:activeShippingReadiness,
      })
    : null;
  const dealNextStep=dealPrimaryAction?.detail||(!active?'Review the deal':active.status==='completed'?'Deal completed':'Review the current deal status');
  const runDealPrimaryAction=()=>{
    if(!dealPrimaryAction)return;
    if(dealPrimaryAction.kind==='create'){openCreate();return}
    if(dealPrimaryAction.kind==='accept'){void accept();return}
    if(dealPrimaryAction.kind==='signin'){openAuthRoute('signin','deal');return}
    if(dealPrimaryAction.kind==='retry-shipping'){
      setEvidenceRevision(revision=>revision+1);
      scrollToDealSection(dealPrimaryAction.targetId);
      return;
    }
    scrollToDealSection(dealPrimaryAction.targetId);
  };
  const goHomeSection=(id?:string)=>{
    const destination=id?`/#${id}`:'/';
    if(`${location.pathname}${location.search}${location.hash}`!==destination)history.pushState({},'',destination);
    setView('home');
    setMobileMenuOpen(false);
    setAuthMessage('');
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>focusPageDestination(id)));
  };
  const followHomeLink=(event:React.MouseEvent<HTMLAnchorElement>,id?:string)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    goHomeSection(id);
  };
  const followInfoLink=(event:React.MouseEvent<HTMLAnchorElement>,next:PublicInfoView)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    openInfo(next);
  };
  const openInfo=(next:PublicInfoView)=>{history.pushState({},'',publicInfoPaths[next]);setView(next);setMobileMenuOpen(false);window.scrollTo({top:0,behavior:motionSafeScrollBehavior('smooth')})};
  const openVerify=()=>{history.pushState({},'',verifyPath);setView('verify');setMobileMenuOpen(false);window.scrollTo({top:0,behavior:motionSafeScrollBehavior('smooth')})};
  const currentPageLabel=getPageMetadata(view,active?.title,Boolean(user)).label;
  const agreementDocumentMode=view==='deal'&&resolveBrowserRoute(location.href).documentMode===true;
  const createDraftRecoveryVisible=!session&&isCreateDraftMeaningful(draft,dealTemplate);
  const createDraftRecoveryTime=draftSavedAt?new Date(draftSavedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Saving…';

  return <div className={`app view-${view}${agreementDocumentMode?' agreement-document-view':''}${demoFlowCompleted?' demo-flow-complete':''}`}>
    <a className="skip-link" href="#main-content">{t('Skip to main content')}</a>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{t(currentPageLabel)}</div>
    <NetworkStatusBanner />
    <header className="site-header"><div className="header-inner">
      <div className="header-brand-group"><a className="brand" href="/" aria-label="Dealivra home" onClick={event=>followHomeLink(event)}><BrandLogo/></a><span className="beta">Launching in the U.S.</span></div>
      <nav className="site-nav" aria-label={t('Primary navigation')}><a href="/" onClick={event=>followHomeLink(event)}>{t(user?'Dashboard':'Home')}</a><a href="/#how-it-works" onClick={event=>followHomeLink(event,'how-it-works')}>{t('How it works')}</a><a href="/#protection" onClick={event=>followHomeLink(event,'protection')}>{t('Protection')}</a><a href={publicInfoPaths.fees} onClick={event=>followInfoLink(event,'fees')}>{t('Fees')}</a></nav>
      <div className="header-actions">{user&&<button type="button" className="header-create" onClick={openCreate}><Plus size={16}/><span>{t('New deal')}</span></button>}<div className="account">{user?<>{isAdmin&&<button type="button" className="admin-link" onClick={()=>setView('admin')}><ShieldCheck size={15}/>{t('Admin')}</button>}<button type="button" onClick={openProfile}>{user.displayName}</button><button type="button" onClick={logout}>{t('Sign out')}</button></>:<><button type="button" onClick={()=>openAuthRoute('signin','home')}>{t('Sign in')}</button><button type="button" className="header-signup" onClick={()=>openAuthRoute('signup','home')}>{t('Create account')}</button></>}</div><button ref={mobileMenuButtonRef} type="button" className="mobile-menu-toggle" aria-label={t(mobileMenuOpen?'Close menu':'Open menu')} aria-expanded={mobileMenuOpen} aria-controls="application-mobile-navigation" onClick={()=>setMobileMenuOpen(open=>!open)}>{mobileMenuOpen?<X/>:<Menu/>}</button></div>
    </div></header>
    {mobileMenuOpen&&<nav className="mobile-menu" id="application-mobile-navigation" aria-label={t('Mobile navigation')}>
      <a href="/" onClick={event=>followHomeLink(event)}>{t(user?'Dashboard':'Home')}</a>
      <a href="/#how-it-works" onClick={event=>followHomeLink(event,'how-it-works')}>{t('How it works')}</a>
      <a href="/#protection" onClick={event=>followHomeLink(event,'protection')}>{t('Protection')}</a>
      <a href={publicInfoPaths.fees} onClick={event=>followInfoLink(event,'fees')}>{t('Fees')}</a>
      <a href={publicInfoPaths.disputes} onClick={event=>followInfoLink(event,'disputes')}>{t('Disputes')}</a>
      {!user&&<><button type="button" className="mobile-signin" onClick={()=>openAuthRoute('signin','home')}>{t('Sign in')}</button><button type="button" className="mobile-signup" onClick={()=>openAuthRoute('signup','home')}>{t('Create account')}</button></>}
    </nav>}
    <main id="main-content" tabIndex={-1}>
      {view==='auth'&&authMode==='signin'&&<ForgotPasswordEntry onOpen={()=>{updateBrowserAddress('/?start=forgot');setView('forgot')}}/>}
      {view==='forgot'&&<ForgotPassword onBack={()=>openAuthRoute('signin','home')}/>}
      {view==='reset'&&recoveryToken&&<ResetPassword token={recoveryToken} onDone={()=>setView('auth')}/>}
      {view==='route-loading'&&<RouteLoading/>}
      {view==='link-error'&&<DealLinkError message={authMessage} onRetry={()=>setRouteRevision(revision=>revision+1)} onBack={()=>goHomeSection()}/>}
      {view==='not-found'&&<NotFoundPage onBack={()=>goHomeSection()}/>}
      {view==='verify'&&<AgreementVerificationPage onBack={()=>goHomeSection()}/>}
      {isPublicInfoView(view)&&<PublicInfoPage view={view} onBack={()=>goHomeSection()} onCreate={openCreate}/>}
      {view==='home'&&<InstallApp/>}
      {view==='admin'&&session&&isAdmin&&<React.Suspense fallback={<RouteLoading/>}><AdministrationWorkspace session={session} onBack={()=>setView('home')} onOpenDeal={deal=>{setActive(deal);setView('deal')}}/></React.Suspense>}
      {view==='published'&&active&&<PublishedDealSuccess deal={active} warning={authMessage} session={session} acceptanceProtected={acceptanceProtected} acceptanceProtectionState={acceptanceProtectionState} acceptanceProtectionError={acceptanceProtectionError} onRetryProtection={()=>setAcceptanceProtectionRevision(revision=>revision+1)} onProtectionChanged={enabled=>{setAcceptanceProtected(enabled);setAcceptanceProtectionState('ready')}} onOpen={()=>{setAuthMessage('');setView('deal')}} onDashboard={()=>goHomeSection()} onCreateAnother={openCreate}/>}
      {view==='create'&&authMessage&&<div className="creation-error notice">{t(authMessage)}</div>}
      {view==='create'&&creating&&<div className="creation-progress notice">{t('Creating your Deal Link…')}</div>}
      {view==='home'&&user&&<NotificationCenter items={notifications} deals={deals} loading={notificationsLoading} error={notificationsError} onRetry={()=>setNotificationsRevision(revision=>revision+1)} onOpen={open} onOpenPublic={publicId=>void openPublicDeal(publicId)} onMarkAll={markAllActivityRead}/>}
      {view==='home'&&user&&<WorkspaceDealExplorer deals={deals} savedDeals={savedDeals} loading={dashboardLoading} error={dashboardError} onRetry={()=>setDashboardRevision(revision=>revision+1)} onOpen={open} onCreate={openCreate}/>}
      {view==='profile'&&session&&<React.Suspense fallback={<RouteLoading/>}><AccountProfileWorkspace
        session={session}
        profile={profile}
        email={user?.email||''}
        displayName={user?.displayName||''}
        message={authMessage}
        verificationMessage={verificationMessage}
        verificationRequesting={verificationRequesting}
        onRequestVerification={requestVerification}
        onSessionUpdated={setSession}
        onSignedOut={finishSignedOutSession}
        onNameUpdated={name=>setProfile(current=>current?{...current,display_name:name}:current)}
        onPasswordUpdated={()=>{setSession(null);setMfaLogin(null);setAuthMode('signin');setAuthMessage('Your password was updated. Sign in again with the new password.');setView('auth')}}
        profileLoading={profileLoading}
        onRetryProfile={()=>void openProfile()}
        onBack={()=>setView('home')}
      /></React.Suspense>}
      {view==='passport'&&<PublicTrustPassportPage profile={publicPassport} message={passportMessage} onBack={()=>goHomeSection()} onRetry={()=>setRouteRevision(revision=>revision+1)}/>}
      {view==='home'&&!user&&<GlobalHome onCreate={openCreate} onDemo={openDemo} onInfo={openInfo}/>}
      {view==='auth'&&mfaLogin&&<MfaLoginVerification challenge={mfaLogin} onVerified={finishAuthentication} onCancel={()=>{setMfaLogin(null);setAuthMessage('');setAuthMode('signin')}}/>}
      {view==='auth'&&!mfaLogin&&<AccountEntryPage
        mode={authMode}
        form={authForm}
        onFormChange={setAuthForm}
        onSubmit={submitAuth}
        passwordVisible={passwordVisible}
        onTogglePassword={()=>setPasswordVisible(visible=>!visible)}
        acceptedPolicies={acceptedPolicies}
        onAcceptedPoliciesChange={setAcceptedPolicies}
        message={authMessage}
        submitting={authSubmitting}
        pendingCreateAction={pendingCreateAction}
        returnToCreate={returnAfterAuth==='create'}
        onBack={()=>{
          if(returnAfterAuth==='create'){
            setPendingCreateAction(null);
            setView('create');
            return;
          }
          setView('home');
        }}
        onOpenInfo={openInfo}
        onSwitchMode={()=>{
          setAuthMode(authMode==='signup'?'signin':'signup');
          setAuthMessage('');
          setPasswordVisible(false);
          setAcceptedPolicies(false);
        }}
      />}
      {view==='create'&&<DealCreationWorkspace
        currentStep={createStep}
        availableStep={createAvailableStep}
        reviewingDraft={reviewingDraft}
        draftRecoveryVisible={createDraftRecoveryVisible}
        draftRecovered={draftRecovered}
        draftRecoveryTime={createDraftRecoveryTime}
        dashboardAvailable={Boolean(user)}
        templates={dealTemplates}
        templateId={dealTemplate}
        selectedTemplate={selectedDealTemplate}
        catalogSelection={catalogSelection}
        draft={draft}
        errors={createErrors}
        identifierEntered={identifierEntered}
        identifierValid={identifierValid}
        vehicleVinLookup={vehicleVinLookup}
        photos={photos}
        reviewContent={<CreateDealReview draft={draft} photos={photos} creating={creating} requiresAccount={!session} declarations={sellerDeclarations} onDeclarationsChange={setSellerDeclarations} onEdit={()=>{setReviewingDraft(false);setCreateStep(3)}} onSaveDraft={()=>requestCreateAction('save')} onPublish={()=>requestCreateAction('publish')}/>}
        onSelectStep={goToCreateStep}
        onReset={resetCreateFlow}
        onBack={()=>setView('home')}
        onFocusError={focusCreateField}
        onSelectTemplate={chooseDealTemplate}
        onCatalogSelectionChange={updateCatalogSelection}
        onDraftChange={setDraft}
        onClearVinLookup={()=>{vehicleVinRequestRef.current+=1;vehicleVinActiveRef.current=false;setVehicleVinLookup({status:'idle',message:''})}}
        onCheckVehicleVin={()=>void checkVehicleVin()}
        onPhotosChange={setPhotos}
        onReviewDraft={reviewDraft}
        onSubmitStep={submitCreateStep}
      />}
      {view==='deal'&&active&&dealPrimaryAction&&<React.Suspense fallback={<RouteLoading/>}><DealWorkspace
        deal={active}
        session={session}
        now={clock}
        expired={activeExpired}
        demo={isDemoActive}
        demoCompleted={demoFlowCompleted}
        agreementChecks={agreementChecks}
        buyer={buyer}
        buyerAccessCode={buyerAccessCode}
        paymentReady={activePaymentReady}
        evidenceRevision={evidenceRevision}
        acceptanceProtected={acceptanceProtected}
        acceptanceProtectionState={acceptanceProtectionState}
        acceptanceProtectionError={acceptanceProtectionError}
        agreementDocumentMode={agreementDocumentMode}
        primaryAction={dealPrimaryAction}
        nextStep={dealNextStep}
        homeLabel={user?'Dashboard':'Home'}
        authMessage={authMessage}
        onBack={()=>goHomeSection()}
        onOpenCreate={openCreate}
        onOpenProfile={openProfile}
        onSignIn={()=>openAuthRoute('signin','deal')}
        onRefreshSavedDeals={refreshSavedDeals}
        onAccept={()=>void accept()}
        accepting={accepting}
        onResetDemo={resetDemoFlow}
        onAgreementCheckChange={(key,checked)=>setAgreementChecks(current=>({...current,[key]:checked}))}
        onBuyerChange={setBuyer}
        onBuyerAccessCodeChange={setBuyerAccessCode}
        onPaymentReadyChanged={ready=>setPaymentReadyByDeal(current=>({...current,[active.id]:ready}))}
        onEvidenceChanged={()=>setEvidenceRevision(value=>value+1)}
        onActionPlanSync={plan=>applyDealActionPlan(active.id,plan)}
        onParticipantsLoaded={participants=>applyDealParticipants(active.id,participants)}
        onRefreshActionPlan={()=>void refreshDealActionPlan(active.id)}
        onDealChanged={updated=>{setActive(updated);setDeals(items=>items.map(item=>item.id===updated.id?updated:item))}}
        onAcceptanceProtectedChanged={setAcceptanceProtected}
        onRetryAcceptanceProtection={()=>setAcceptanceProtectionRevision(revision=>revision+1)}
        onOpenActions={()=>scrollToDealSection('deal-actions')}
        onOpenProtection={()=>scrollToDealSection('deal-safety')}
        onOpenRecords={()=>scrollToDealSection('deal-records')}
        onPrimaryAction={runDealPrimaryAction}
      /></React.Suspense>}
    </main><footer><div><BrandLogo className="footer-brand-logo"/><span>Global vision · U.S. launch · English (US) · USD</span></div><nav aria-label={t('Legal and protection')}><a href={publicInfoPaths['buyer-protection']} onClick={event=>{event.preventDefault();openInfo('buyer-protection')}}>{t('Buyer protection')}</a><a href={publicInfoPaths['seller-protection']} onClick={event=>{event.preventDefault();openInfo('seller-protection')}}>{t('Seller protection')}</a><a href={publicInfoPaths.fees} onClick={event=>{event.preventDefault();openInfo('fees')}}>{t('Fees')}</a><a href={publicInfoPaths.disputes} onClick={event=>{event.preventDefault();openInfo('disputes')}}>{t('Disputes')}</a><a href={verifyPath} onClick={event=>{event.preventDefault();openVerify()}}>{t('Verify agreement')}</a><a href={publicInfoPaths.terms} onClick={event=>{event.preventDefault();openInfo('terms')}}>{t('Terms')}</a><a href={publicInfoPaths.privacy} onClick={event=>{event.preventDefault();openInfo('privacy')}}>{t('Privacy')}</a></nav></footer>
  </div>
}
