import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, BadgeDollarSign, Bell, Bookmark, Boxes, Briefcase, CalendarClock, CalendarDays, Camera, Car, Check, ChevronDown, CircleCheckBig, Clock3, Copy, CreditCard, Eye, EyeOff, FileCheck2, FileDown, FileSignature, Fingerprint, Flag, Gamepad2, Gem, ImagePlus, Laptop, Link2, LockKeyhole, MailCheck, MapPinned, Menu, MessageCircle, Package, PackageCheck, Pencil, Plus, QrCode, Route, Scale, ScanSearch, Search, Send, Share2, ShieldAlert, ShieldCheck, Smartphone, Star, Tablet, Trash2, Truck, Watch, Wrench, X, ZoomIn } from 'lucide-react';
import { DEMO_DEAL_PUBLIC_ID, demoRepository } from './services/demoRepository';
import { acceptPublicDeal, askDealQuestion, cancelDeal, checkSupabaseConnection, completeHandoff, confirmMeeting, confirmShipmentDelivery, createDealEvidenceSignedUrl, createDealShipment, createUserDeal, deleteDealMedia, generateHandoffPin, getAdminAccess, getAdminDisputes, getAdminReports, getAdminRevenueSummary, getAdminRevenueTransactions, getDealInquiries, getDealInspection, getDealMeeting, getDealMessages, getDealOffers, getDealRiskAssessment, getDealShipment, getDealTimeline, getMyNotifications, getMyProfileSummary, getMySavedDeals, getPublicAgreementHistory, getPublicDeal, getPublicSellerDeclaration, getPublicSellerTrustProfile, getPublicTrustPassport, getSellerShippingEvidenceReadiness, getStoredSession, getTrustPassportSettings, isCurrentUserDealSeller, isDealSaved, isSupabaseConfigured, listDealEvidence, listUserDeals, makeDealOffer, markArrived, markSessionActivity, openDealDispute, proposeMeeting, publishUserDealDraft, recordDealInspection, refreshSession, renewDealLink, reorderDealMedia, replyDealInquiry, reportPublicDeal, requestIdentityVerification, requestPasswordReset, resolveAdminDispute, resolveAdminDisputeFinancial, resolveAdminReport, respondToOffer, saveUserDealDraft, sendDealMessage, sessionExpiredEvent, sessionUpdatedEvent, setAdminDealVisibility, setDealSaved, setTrustPassportEnabled, signIn, signOut, signUp, submitRating, updateAccountName, updateAccountPassword, updatePublishedDeal, updateRecoveredPassword, updateUserDealDraft, uploadDealEvidence, uploadDealPhotos, verifyAgreementRecord, type AdminDispute, type AdminReport, type AdminRevenueSummary, type AdminRevenueTransaction, type AgreementHistoryVersion, type AgreementVerificationResult, type DealEvidence, type DealInquiry, type DealInspection, type DealMeeting, type DealMessage, type DealNotification, type DealOffer, type DealShipment, type EvidenceType, type ProfileSummary, type PublicTrustProfile, type RiskAssessment, type SellerDeclarationRecord, type SellerShippingEvidenceReadiness, type StoredSession, type TimelineEvent, type TrustPassport, type TrustPassportSettings } from './services/supabaseRest';
import { markAllNotificationsRead, markDealNotificationsRead } from './services/supabaseRest';
import { configureBuyerAccessCode, getDealAcceptanceProtection } from './services/supabaseRest';
import { getDealParticipants, type DealParticipants } from './services/supabaseRest';
import { getDealActionPlan, type DealActionPlan } from './services/supabaseRest';
import { getDealDeliveryDetails, saveDealDeliveryDetails, type DealDeliveryDetails } from './services/supabaseRest';
import { confirmDealPaymentMethod, createProtectedCheckout, getDealPaymentRecord, getProtectedPaymentStatus, getStripeConnectStatus, releaseProtectedPayment, startStripeConnectOnboarding, type DealPaymentMethod, type DealPaymentRecord, type ProtectedPaymentState, type ProtectedPaymentStatus, type StripeConnectStatus } from './services/supabaseRest';
import { getAppLanguage, t } from './i18n';
import { AddressAutocomplete } from './AddressAutocomplete';
import { BrandLogo } from './BrandLogo';
import { SmartCatalogFields } from './SmartCatalogFields';
import type { Deal, DealDraft } from './domain';
import { amountForInput, currencyStep, formatMoney, toMinorUnits } from './currency';
import { createAgreementFingerprint } from './agreementFingerprint';
import { OTHER_CATALOG_VALUE, buildSmartCatalogTitle, emptySmartCatalogSelection, isGuidedCatalogCategory, matchCatalogValue, sanitizeSmartCatalogSelection, vehicleCatalog, vehicleYears, type SmartCatalogCategoryId, type SmartCatalogSelection } from './smartCatalog';
import { decodeVehicleVin, type VehicleVinResult } from './services/catalogService';
import './styles.css';
import './security.css';
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

type PublicInfoView='buyer-protection'|'seller-protection'|'fees'|'disputes'|'terms'|'privacy';
type View = 'home' | 'create' | 'published' | 'deal' | 'auth' | 'profile' | 'passport' | 'admin' | 'forgot' | 'reset' | 'link-error' | 'verify' | PublicInfoView;
type DealPrimaryAction={
  label:string;
  detail:string;
  targetId:string;
  kind:'scroll'|'create'|'accept'|'signin';
};
type ShippingNavigationReadiness={loaded:boolean;ready:boolean};
type CreateFieldError={fieldId:string;message:string};
type VehicleVinLookupState={
  status:'idle'|'loading'|'success'|'error';
  message:string;
  result?:VehicleVinResult;
};

function getShippingPrimaryAction(
  deal:Deal,
  plan:DealActionPlan|undefined,
  readiness:ShippingNavigationReadiness|undefined
):DealPrimaryAction{
  if(deal.viewerRole==='seller'){
    if(!plan)return {label:'Review delivery',detail:'Checking the latest payment and shipping status.',targetId:'deal-actions',kind:'scroll'};
    if(!readiness?.loaded)return {label:'Check package evidence',detail:'Checking the required evidence before shipping.',targetId:'deal-evidence-vault',kind:'scroll'};
    if(!readiness.ready)return {label:'Add package evidence',detail:'Step 1 of 2: document the item and sealed package.',targetId:'deal-evidence-vault',kind:'scroll'};
    if(!plan.delivery_address_ready)return {label:'View address status',detail:'Package evidence is complete. The buyer must add a delivery address.',targetId:'shipping-panel',kind:'scroll'};
    if(!plan.shipment_status)return {label:'Add tracking',detail:'Step 2 of 2: choose the carrier and save tracking.',targetId:'shipping-panel',kind:'scroll'};
    if(plan.shipment_status==='shipped')return {label:'View shipment',detail:'Tracking is saved. Waiting for buyer inspection and receipt.',targetId:'shipping-panel',kind:'scroll'};
    return {label:'Review receipt',detail:'Delivery is recorded. Review the completed transaction.',targetId:'shipping-panel',kind:'scroll'};
  }
  if(!plan)return {label:'Review delivery',detail:'Checking the latest delivery status.',targetId:'deal-actions',kind:'scroll'};
  if(!plan.delivery_address_ready)return {label:'Add delivery address',detail:'Add the private address the seller should ship to.',targetId:'shipping-panel',kind:'scroll'};
  if(!plan.shipment_status)return {label:'View delivery status',detail:'Your address is saved. Waiting for the seller to ship.',targetId:'shipping-panel',kind:'scroll'};
  if(!plan.inspection_recorded)return {label:'Record inspection',detail:'Inspect the delivered item before confirming receipt.',targetId:'shipping-panel',kind:'scroll'};
  if(plan.shipment_status==='shipped')return {label:'Confirm delivery',detail:'Your inspection is saved. Confirm that the item was received.',targetId:'shipping-panel',kind:'scroll'};
  return {label:'Review receipt',detail:'Delivery is recorded. Review the completed transaction.',targetId:'shipping-panel',kind:'scroll'};
}

const publicInfoPaths:Record<PublicInfoView,string>={
  'buyer-protection':'/buyer-protection',
  'seller-protection':'/seller-protection',
  fees:'/fees',
  disputes:'/disputes',
  terms:'/terms',
  privacy:'/privacy'
};
const verifyPath='/verify';
const usStateOptions=[
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
] as const;
const isUsPostalCode=(value:string)=>/^\d{5}(?:-\d{4})?$/.test(value.trim());
const viewFromPath=():PublicInfoView|'verify'|'home'=>(
  (location.pathname===verifyPath?'verify':Object.entries(publicInfoPaths).find(([,path])=>location.pathname===path)?.[0] as PublicInfoView|undefined)||'home'
);
interface InstallPromptEvent extends Event { prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}> }
const initial: DealDraft = {title:'',description:'',price:'',currency:'USD',condition:'Good',serialNumber:'',deliveryMethod:'Meet in person',expiresInDays:7};
type DealTemplateId=SmartCatalogCategoryId;
type CreateFlowStep=1|2|3|4;
type DealTemplate={id:DealTemplateId;label:string;titlePlaceholder:string;descriptionPrompt:string;photoPrompt:string;identifierLabel:string;identifierPlaceholder:string;identifierHelp:string;identifierPattern:string;icon:typeof Smartphone};
const createFlowSteps=[
  {number:1 as const,label:'Item',detail:'Category, title, and price',icon:Package},
  {number:2 as const,label:'Terms',detail:'Condition and handoff',icon:FileSignature},
  {number:3 as const,label:'Photos',detail:'Optional evidence',icon:ImagePlus},
  {number:4 as const,label:'Review',detail:'Confirm and publish',icon:BadgeCheck}
];
const createStepMeta={
  1:{eyebrow:'STEP 1 OF 4',title:'What are you selling?',description:'Choose the closest category, then add a clear title and price.',action:'Continue to terms',dock:'Item and price'},
  2:{eyebrow:'STEP 2 OF 4',title:'Set the deal terms.',description:'Record the condition, important disclosures, and how the item will be handed over.',action:'Continue to photos',dock:'Condition and handoff'},
  3:{eyebrow:'STEP 3 OF 4',title:'Add visual evidence.',description:'Photos are optional in this beta, but clear evidence helps both parties understand the item.',action:'Review deal',dock:'Photos and evidence'},
  4:{eyebrow:'FINAL STEP',title:'Review and publish.',description:'Confirm the shared record before creating the Deal Link.',action:'Confirm and publish',dock:'Final review'}
} satisfies Record<CreateFlowStep,{eyebrow:string;title:string;description:string;action:string;dock:string}>;
const dealTemplates:DealTemplate[]=[
  {id:'phone',label:'Phone',titlePlaceholder:'iPhone 15 Pro · 256 GB',descriptionPrompt:'Include the model, storage, battery health, lock status, repairs, damage, and accessories.',photoPrompt:'Photograph the front, back, sides, powered-on screen, serial or IMEI label, damage, and accessories.',identifierLabel:'Serial or IMEI (optional)',identifierPlaceholder:'15-digit IMEI or manufacturer serial',identifierHelp:'Enter a 15-digit IMEI or a manufacturer serial number with 6 to 30 characters.',identifierPattern:'(?:[0-9]{15}|[A-Za-z0-9-]{6,30})',icon:Smartphone},
  {id:'laptop',label:'Laptop',titlePlaceholder:'MacBook Pro 14 · M3 · 512 GB',descriptionPrompt:'Include the processor, memory, storage, battery condition, screen condition, repairs, and charger.',photoPrompt:'Photograph the lid, powered-on screen, keyboard, ports, bottom serial label, charger, and damage.',identifierLabel:'Serial number (optional)',identifierPlaceholder:'Manufacturer serial number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Laptop},
  {id:'tablet',label:'Tablet',titlePlaceholder:'Apple iPad Pro 11 · 256 GB',descriptionPrompt:'Include the model, storage, connectivity, battery condition, screen condition, repairs, and accessories.',photoPrompt:'Photograph the front, back, sides, powered-on screen, serial label, damage, and accessories.',identifierLabel:'Serial or IMEI (optional)',identifierPlaceholder:'Serial number or IMEI',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Tablet},
  {id:'vehicle',label:'Vehicle',titlePlaceholder:'2021 BMW X5 · 42,000 miles',descriptionPrompt:'Include the mileage, title status, accident history, service history, warning lights, and known defects.',photoPrompt:'Photograph the front, rear, both sides, interior, odometer, VIN label, tires, and known defects.',identifierLabel:'VIN (optional)',identifierPlaceholder:'17-character VIN',identifierHelp:'A VIN must contain exactly 17 letters or numbers and cannot use I, O, or Q.',identifierPattern:'[A-HJ-NPR-Z0-9]{17}',icon:Car},
  {id:'watch',label:'Luxury watch',titlePlaceholder:'Rolex Submariner · Reference 126610LN',descriptionPrompt:'Include the reference number, authenticity evidence, service history, condition, box, papers, and accessories.',photoPrompt:'Photograph the dial, caseback, crown, bracelet, serial or reference, box, papers, and visible wear.',identifierLabel:'Reference or serial number (optional)',identifierPlaceholder:'Reference or serial number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Watch},
  {id:'camera',label:'Camera',titlePlaceholder:'Sony Alpha a7 IV · Body only',descriptionPrompt:'Include shutter count, sensor and body condition, repairs, included lenses, batteries, and accessories.',photoPrompt:'Photograph the front, back, sensor or lens mount, powered-on screen, serial label, accessories, and damage.',identifierLabel:'Serial number (optional)',identifierPlaceholder:'Manufacturer serial number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Camera},
  {id:'gaming',label:'Gaming',titlePlaceholder:'Sony PlayStation 5 · Disc edition',descriptionPrompt:'Include the exact model, storage, controller count, account or lock status, repairs, and accessories.',photoPrompt:'Photograph every side, powered-on screen, serial label, controllers, cables, games, and damage.',identifierLabel:'Serial number (optional)',identifierPlaceholder:'Manufacturer serial number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Gamepad2},
  {id:'tools',label:'Tools & equipment',titlePlaceholder:'DeWalt 20V MAX drill kit',descriptionPrompt:'Include the model, hours or usage, power source, operational condition, repairs, batteries, and attachments.',photoPrompt:'Photograph all sides, model plate, operating controls, batteries, attachments, and wear or damage.',identifierLabel:'Serial or equipment number (optional)',identifierPlaceholder:'Serial or equipment number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Wrench},
  {id:'business',label:'Business equipment',titlePlaceholder:'Commercial equipment brand and model',descriptionPrompt:'Include the manufacturer, model, age, hours or usage, service history, defects, and included components.',photoPrompt:'Photograph all sides, data plate, controls, powered-on state, accessories, and wear or damage.',identifierLabel:'Serial or asset number (optional)',identifierPlaceholder:'Serial or asset number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Briefcase},
  {id:'jewelry',label:'Jewelry',titlePlaceholder:'18K gold diamond ring · Size 7',descriptionPrompt:'Include the material, weight, stones, measurements, hallmark, appraisal, repairs, and condition.',photoPrompt:'Photograph all angles, hallmark, clasp or setting, appraisal or certificate, packaging, and visible wear.',identifierLabel:'Certificate or reference (optional)',identifierPlaceholder:'Certificate or reference number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Gem},
  {id:'collectible',label:'Collectibles',titlePlaceholder:'Item name · Edition or year',descriptionPrompt:'Include the creator or brand, edition, year, provenance, grading, restoration, defects, and packaging.',photoPrompt:'Photograph the front, back, markings, certificate or grading label, packaging, and every defect.',identifierLabel:'Certificate or reference (optional)',identifierPlaceholder:'Certificate or reference number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Boxes},
  {id:'general',label:'Other item',titlePlaceholder:'Item brand and model',descriptionPrompt:'Include the brand, model, age, usage, known defects, repairs, and included parts or accessories.',photoPrompt:'Photograph the front, back, multiple angles, serial or reference label, defects, and included parts.',identifierLabel:'Serial or reference number (optional)',identifierPlaceholder:'Serial or reference number',identifierHelp:'Enter at least 3 characters.',identifierPattern:'.{3,40}',icon:Package}
];
const formatDateTime=(value:string)=>new Date(value).toLocaleString(getAppLanguage());
const formatDate=(value:string)=>new Date(value).toLocaleDateString(getAppLanguage());
const dealPrice=(deal:Pick<Deal,'priceCents'|'currency'>)=>formatMoney(deal.priceCents,deal.currency,getAppLanguage());
const groupedDealValue=(deals:Deal[])=>{const totals=new Map<Deal['currency'],number>();deals.forEach(deal=>totals.set(deal.currency,(totals.get(deal.currency)||0)+deal.priceCents));return [...totals].map(([currency,value])=>formatMoney(value,currency,getAppLanguage())).join(' · ')||formatMoney(0,'USD',getAppLanguage())};
const isDealExpired=(deal:Deal,now=Date.now())=>deal.status==='published'&&Boolean(deal.expiresAt)&&new Date(deal.expiresAt!).getTime()<=now;
const relativeExpiry=(expiresAt:string,now:number)=>{const difference=new Date(expiresAt).getTime()-now;const absolute=Math.abs(difference);const [amount,unit]=absolute>=24*60*60*1000?[Math.ceil(difference/(24*60*60*1000)),'day' as const]:absolute>=60*60*1000?[Math.ceil(difference/(60*60*1000)),'hour' as const]:[Math.ceil(difference/(60*1000)),'minute' as const];return new Intl.RelativeTimeFormat(getAppLanguage(),{numeric:'auto'}).format(amount,unit)};

function DealTemplatePicker({selected,onSelect}:{selected:DealTemplateId;onSelect:(id:DealTemplateId)=>void}){
  const featuredIds:DealTemplateId[]=['phone','vehicle','laptop','tablet','watch'];
  const [expanded,setExpanded]=useState(false);
  const template=dealTemplates.find(item=>item.id===selected)||dealTemplates[0];
  const visibleTemplates=expanded?dealTemplates:dealTemplates.filter(item=>featuredIds.includes(item.id)||item.id===selected);
  return <section className="deal-template-picker no-print"><div className="deal-template-heading"><PackageCheck/><div><p className="eyebrow">{t('Start with a template')}</p><h2>{t('Choose an item category')}</h2><p>{t('Select the closest category to get a safer description checklist.')}</p></div></div><div className="deal-template-grid">{visibleTemplates.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={selected===item.id?'selected':''} aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}><Icon/><span>{t(item.label)}</span>{selected===item.id&&<Check/>}</button>})}</div><button type="button" className="catalog-category-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{t(expanded?'Show fewer categories':'More categories')}<ChevronDown className={expanded?'is-open':''}/></button><div className="deal-template-guidance"><ShieldCheck/><div><b>{t('Include these details')}</b><span>{t(template.descriptionPrompt)}</span></div></div></section>;
}

function DealPhotoGuide({template,count}:{template:DealTemplate;count:number}){
  const goal=6;const progress=Math.min(100,Math.round(count/goal*100));const enough=count>=4;
  return <section className={`deal-photo-guide no-print ${enough?'ready':''}`}><div className="deal-photo-guide-title"><ImagePlus/><div><p className="eyebrow">{t('Photo evidence')}</p><h3>{t('Recommended photo set')}</h3></div><strong>{count}/{goal}</strong></div><p>{t(template.photoPrompt)}</p><div className="deal-photo-progress" role="progressbar" aria-label={t('Recommended photo set')} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(count,goal)}><span style={{width:`${progress}%`}}/></div><small>{t(enough?'Good coverage. Add more angles if they show important condition details.':'Add at least 4 clear photos before publishing.')}</small></section>;
}

function CreateDealProgress({current,available,onSelect}:{current:CreateFlowStep;available:CreateFlowStep;onSelect:(step:CreateFlowStep)=>void}){
  return <nav className="create-flow-progress" aria-label={t('Create deal progress')}>
    {createFlowSteps.map(item=>{const Icon=item.icon;const completed=item.number<current;const disabled=item.number>available;return <button key={item.number} type="button" className={`${item.number===current?'is-current ':''}${completed?'is-complete':''}`} aria-current={item.number===current?'step':undefined} disabled={disabled} onClick={()=>onSelect(item.number)}><span className="create-flow-step-icon">{completed?<Check/>:<Icon/>}</span><span><small>{t(`Step ${item.number}`)}</small><strong>{t(item.label)}</strong><em>{t(item.detail)}</em></span></button>})}
  </nav>;
}

function CreateValidationSummary({errors,onSelect}:{errors:CreateFieldError[];onSelect:(fieldId:string)=>void}){
  return <section id="create-validation-summary" className="create-validation-summary" role="alert" aria-labelledby="create-validation-title" tabIndex={-1}>
    <span className="create-validation-icon"><ShieldAlert/></span>
    <div>
      <p className="eyebrow">{t('Needs attention')}</p>
      <h2 id="create-validation-title">{t(errors.length===1?'Check 1 detail before continuing':`Check ${errors.length} details before continuing`)}</h2>
      <p>{t('Choose an item below to jump directly to the field.')}</p>
      <ul>{errors.map(error=><li key={error.fieldId}><button type="button" onClick={()=>onSelect(error.fieldId)}>{t(error.message)}<ArrowRight size={15}/></button></li>)}</ul>
    </div>
  </section>;
}

function MeetingPanel({deal,session}:{deal:Deal;session:StoredSession}){
  const [meeting,setMeeting]=useState<DealMeeting|null>(null);
  const [form,setForm]=useState({locationName:'',streetAddress:'',city:'',state:'',postalCode:'',scheduledAt:''});
  const [message,setMessage]=useState('');
  useEffect(()=>{getDealMeeting(session,deal.id).then(setMeeting).catch(()=>{})},[deal.id,session]);
  const completeAddress=`${form.streetAddress.trim()}, ${form.city.trim()}, ${form.state} ${form.postalCode.trim()}`;
  const formComplete=form.locationName.trim().length>=2&&form.streetAddress.trim().length>=3&&form.city.trim().length>=2&&Boolean(form.state)&&isUsPostalCode(form.postalCode)&&Boolean(form.scheduledAt);
  const propose=async(e:React.FormEvent)=>{e.preventDefault();if(!formComplete)return;setMessage('');try{await proposeMeeting(session,deal.id,form.locationName.trim(),completeAddress,form.scheduledAt);const next=await getDealMeeting(session,deal.id);setMeeting(next);setMessage('Meeting proposal sent to the other party.')}catch(error){setMessage(error instanceof Error?error.message:'Could not propose meeting')}};
  const confirm=async()=>{setMessage('');try{await confirmMeeting(session,deal.id);const next=await getDealMeeting(session,deal.id);setMeeting(next);setMessage('Meeting confirmed.')}catch(error){setMessage(error instanceof Error?error.message:'Could not confirm meeting')}};
  return <section className="meeting-panel" aria-labelledby="meeting-panel-title">
    <div className="meeting-title"><span className="workflow-icon"><MapPinned/></span><div><p className="eyebrow">{t('Safe handoff')}</p><h2 id="meeting-panel-title">{t('Plan the meeting')}</h2><span>{t('Set one verified public location and a clear meeting time.')}</span></div></div>
    {meeting
      ? <div className="meeting-summary">
          <div><MapPinned/><span><b>{meeting.location_name}</b><small>{meeting.address}</small></span></div>
          <div><CalendarClock/><span><b>{formatDateTime(meeting.scheduled_at)}</b><small className={`meeting-status ${meeting.status}`}>{t(meeting.status)}</small></span></div>
          {meeting.status==='proposed'&&meeting.proposed_by!==session.user.id&&<button className="primary" onClick={confirm}>{t('Confirm meeting')}</button>}
          {meeting.status==='proposed'&&meeting.proposed_by===session.user.id&&<p>{t('Waiting for the other party to confirm.')}</p>}
        </div>
      : <form className="meeting-form" onSubmit={propose}>
          <label className="meeting-field meeting-field-place">{t('Public meeting place')}<input required minLength={2} maxLength={120} placeholder={t('Police safe exchange zone or busy café')} value={form.locationName} onChange={e=>setForm({...form,locationName:e.target.value})}/></label>
          <label className="meeting-field meeting-field-street">{t('Street address')}<AddressAutocomplete streetAddressOnly placeholder={t('123 Main St')} value={form.streetAddress} onChange={streetAddress=>setForm(current=>({...current,streetAddress}))} onAddressParts={parts=>setForm(current=>({...current,streetAddress:parts.streetAddress||current.streetAddress,city:parts.city||current.city,state:parts.state||current.state,postalCode:parts.postalCode||current.postalCode}))}/></label>
          <label className="meeting-field meeting-field-city">{t('City')}<input required minLength={2} maxLength={100} autoComplete="address-level2" placeholder={t('New York')} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <label className="meeting-field meeting-field-state">{t('State')}<select required autoComplete="address-level1" value={form.state} onChange={e=>setForm({...form,state:e.target.value})}><option value="">{t('Select state')}</option>{usStateOptions.map(([code,name])=><option key={code} value={code}>{code} — {name}</option>)}</select></label>
          <label className="meeting-field meeting-field-zip">{t('ZIP code')}<input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" aria-invalid={Boolean(form.postalCode)&&!isUsPostalCode(form.postalCode)} placeholder="10001" value={form.postalCode} onChange={e=>setForm({...form,postalCode:e.target.value})}/><small className={form.postalCode&&!isUsPostalCode(form.postalCode)?'field-help invalid':'field-help'}>{t(form.postalCode&&!isUsPostalCode(form.postalCode)?'Enter a valid 5-digit ZIP code or ZIP+4.':'5 digits or ZIP+4')}</small></label>
          <label className="meeting-field meeting-field-date">{t('Date and time')}<input required type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label>
          <button className="primary meeting-submit" disabled={!formComplete}><CalendarClock size={18}/>{t('Propose meeting')}</button>
        </form>}
    {message&&<div className="notice">{t(message)}</div>}
    <p className="meeting-safety"><ShieldCheck/> {t('Prefer a staffed, well-lit public location. Never share a home address by default.')}</p>
  </section>
}

function InspectionRecorder({deal,session,onRecorded}:{deal:Deal;session:StoredSession;onRecorded:(saved:boolean)=>void}){
  const [saved,setSaved]=useState<DealInspection|null>(null);const [checks,setChecks]=useState({item:false,price:false,handoff:false,reference:false});const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);
  useEffect(()=>{getDealInspection(session,deal.id).then(receipt=>{setSaved(receipt);onRecorded(Boolean(receipt))}).catch(()=>onRecorded(false))},[deal.id,session]);
  const complete=Object.values(checks).every(Boolean);const items=[{key:'item' as const,label:'Item and defects reviewed'},{key:'price' as const,label:'Price confirmed'},{key:'handoff' as const,label:'Handoff terms confirmed'},{key:'reference' as const,label:deal.serialNumber?'Serial':'Condition'}];
  const save=async()=>{if(!complete)return;setSaving(true);setMessage('');try{await recordDealInspection(session,deal.id);const receipt=await getDealInspection(session,deal.id);setSaved(receipt);onRecorded(true);setMessage('Inspection receipt saved.')}catch(error){setMessage(error instanceof Error?error.message:'Could not save inspection receipt')}finally{setSaving(false)}};
  if(saved)return <div className="inspection-receipt"><BadgeCheck/><div><b>{t('Buyer inspection recorded')}</b><span>{saved.buyer_name} · {t('Version')} {saved.agreement_version} · {formatDateTime(saved.inspected_at)}</span><small>{t('This checklist is stored with the deal record.')}</small></div></div>;
  if(deal.viewerRole!=='buyer')return <div className="inspection-wait"><Clock3/><span>{t('Waiting for buyer inspection.')}</span></div>;
  return <div className="inspection-checklist"><p className="eyebrow">{t('Buyer inspection receipt')}</p><h3>{t('Inspect the item before sharing or entering the PIN.')}</h3><div className="inspection-items">{items.map(item=><label key={item.key} className={checks[item.key]?'checked':''}><input type="checkbox" checked={checks[item.key]} onChange={event=>setChecks(current=>({...current,[item.key]:event.target.checked}))}/><span>{t(item.label)}</span></label>)}</div><button className="primary inspection-save" disabled={!complete||saving} onClick={save}>{t(saving?'Saving…':'Save inspection receipt')}</button>{message&&<div className="notice">{t(message)}</div>}<small className="inspection-help">{t('This checklist is stored with the deal record.')}</small></div>;
}

function HandoffPanel({deal,session,paymentReady,onComplete}:{deal:Deal;session:StoredSession;paymentReady:boolean;onComplete:()=>void}){
  const [meeting,setMeeting]=useState<DealMeeting|null>(null);const [pin,setPin]=useState('');const [sellerPin,setSellerPin]=useState('');const [message,setMessage]=useState('');const [inspectionRecorded,setInspectionRecorded]=useState(false);
  const reload=()=>getDealMeeting(session,deal.id).then(setMeeting).catch(()=>{});useEffect(()=>{reload()},[deal.id,session]);
  if(!meeting||meeting.status!=='confirmed')return null;
  const myArrived=deal.viewerRole==='seller'?meeting.seller_arrived:meeting.buyer_arrived;
  const arrive=async()=>{try{await markArrived(session,deal.id);await reload();setMessage('Arrival recorded.')}catch(e){setMessage(e instanceof Error?e.message:'Could not record arrival')}};
  const makePin=async()=>{try{setSellerPin(await generateHandoffPin(session,deal.id));setMessage('Show this PIN only after the buyer inspects the item.')}catch(e){setMessage(e instanceof Error?e.message:'Could not generate PIN')}};
  const finish=async()=>{try{await completeHandoff(session,deal.id,pin);setMessage('Item receipt confirmed. Deal completed.');onComplete()}catch(e){setMessage(e instanceof Error?e.message:'Could not complete deal')}};
  return <section className="handoff-panel"><p className="eyebrow">{t('In-person handoff')}</p><h2>{t('Complete the exchange safely')}</h2><div className="arrival-grid"><div className={meeting.seller_arrived?'done':''}><Check/><span>{t('Seller arrived')}</span></div><div className={meeting.buyer_arrived?'done':''}><Check/><span>{t('Buyer arrived')}</span></div></div>{!myArrived&&<button className="primary" onClick={arrive}>{t('I arrived')}</button>}{meeting.seller_arrived&&meeting.buyer_arrived&&<InspectionRecorder deal={deal} session={session} onRecorded={setInspectionRecorded}/>} {meeting.seller_arrived&&meeting.buyer_arrived&&!paymentReady&&<div className="payment-wait"><Clock3/>{t('Waiting for seller to confirm payment received')}</div>}{meeting.seller_arrived&&meeting.buyer_arrived&&deal.viewerRole==='seller'&&<div className="pin-box">{sellerPin?<><small>{t('One-time handoff PIN')}</small><strong>{sellerPin}</strong></>:<button className="primary" disabled={!paymentReady} onClick={makePin}>{t('Generate handoff PIN')}</button>}</div>}{meeting.seller_arrived&&meeting.buyer_arrived&&deal.viewerRole==='buyer'&&<div className={`pin-entry ${inspectionRecorded&&paymentReady?'':'locked'}`}><label>{t('Enter seller’s 6-digit PIN')}<input disabled={!inspectionRecorded||!paymentReady} inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label><button className="primary" disabled={!inspectionRecorded||!paymentReady||pin.length!==6} onClick={finish}>{t('Confirm item received')}</button></div>}{message&&<div className="notice">{t(message)}</div>}<p className="meeting-safety"><ShieldCheck/> {t('Inspect the item before sharing or entering the PIN.')}</p></section>
}

function RatingPanel({deal,session}:{deal:Deal;session:StoredSession}){const [stars,setStars]=useState(5);const [comment,setComment]=useState('');const [message,setMessage]=useState('');const send=async(e:React.FormEvent)=>{e.preventDefault();try{await submitRating(session,deal.id,stars,comment);setMessage('Thank you. Your rating was saved.')}catch(error){setMessage(error instanceof Error?error.message:'Could not save rating')}};return <section className="rating-panel"><Star/><div><p className="eyebrow">{t('Deal completed')}</p><h2>{t('Rate the other party')}</h2><form onSubmit={send}><label>{t('Rating')}<select value={stars} onChange={e=>setStars(Number(e.target.value))}><option value="5">{t('5 — Excellent')}</option><option value="4">{t('4 — Good')}</option><option value="3">{t('3 — Okay')}</option><option value="2">{t('2 — Poor')}</option><option value="1">{t('1 — Very poor')}</option></select></label><label>{t('Comment')}<textarea maxLength={500} value={comment} onChange={e=>setComment(e.target.value)} placeholder={t('What went well?')}/></label><button className="primary">{t('Submit rating')}</button></form>{message&&<div className="notice">{t(message)}</div>}</div></section>}

function DealReadiness({deal,onOpenProfile,onEditDetails}:{deal:Deal;onOpenProfile?:()=>void;onEditDetails?:()=>void}){
  const contactVerified=deal.sellerContactVerified===true;
  const sellerVerified=deal.sellerVerification==='verified';
  const descriptionCharacters=deal.description.trim().length;
  const descriptionReady=descriptionCharacters>=20;
  const checks=[
    {label:'Seller contact verification',complete:contactVerified,status:contactVerified?'Completed':'Verification pending'},
    {label:'Seller identity verification',complete:sellerVerified,status:sellerVerified?'Completed':'Verification pending'},
    {label:'Item photos or video',complete:Boolean(deal.mediaUrls?.length),status:deal.mediaUrls?.length?'Completed':'pending'},
    {label:'Known condition and defects',complete:descriptionReady,status:descriptionReady?'Completed':'Minimum 20 characters required'},
    {label:'Serial or IMEI (optional)',complete:Boolean(deal.serialNumber),status:deal.serialNumber?'Completed':'pending'},
    {label:'Shared terms',complete:deal.agreementVersion>=1,status:deal.agreementVersion>=1?'Completed':'pending'},
    {label:'Offer active',complete:!isDealExpired(deal),status:!isDealExpired(deal)?'Completed':'pending'},
    {label:'Recorded consent',complete:!['draft','published'].includes(deal.status),status:!['draft','published'].includes(deal.status)?'Completed':'pending'},
    {label:'Handoff',complete:Boolean(deal.deliveryMethod),status:deal.deliveryMethod?'Completed':'pending'}
  ];
  const completed=checks.filter(check=>check.complete).length;
  const percentage=Math.round(completed/checks.length*100);
  const riskScore=Math.min(100,(contactVerified?0:10)+(sellerVerified?0:15)+(deal.mediaUrls?.length?0:20)+(deal.description.trim().length>=20?0:15)+(deal.serialNumber?0:5)+(deal.agreementVersion>=1?0:15)+(['draft','published'].includes(deal.status)?10:0)+(isDealExpired(deal)?35:0)+(deal.status==='disputed'?35:0)+(deal.status==='cancelled'?15:0));
  const riskLevel=riskScore<=20?'Low concern':riskScore<=45?'Review recommended':'Caution';
  const riskClass=riskScore<=20?'low':riskScore<=45?'review':'caution';
  return <section className="deal-readiness no-print">
    <div className="readiness-heading">
      <span className="workflow-icon"><ShieldCheck/></span>
      <div>
        <p className="eyebrow">{t('Safety controls')}</p>
        <h2>{t('Deal safety check')}</h2>
        <span className="readiness-summary">{completed}/{checks.length} {t('checks recorded')}</span>
      </div>
      <div className={`readiness-score risk-${riskClass}`}>
        <strong>{riskScore}</strong>
        <small>{t('Risk score')}</small>
      </div>
    </div>
    <div className="readiness-status-row">
      <span className={`risk-level ${riskClass}`}>{t(riskLevel)}</span>
      <div className="readiness-progress" role="progressbar" aria-label={t('Deal safety check')} aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={completed}><span style={{width:`${percentage}%`}}/></div>
      <strong>{percentage}%</strong>
    </div>
    {(!contactVerified||!sellerVerified||!descriptionReady)&&<div className="readiness-guidance">
      {!contactVerified&&<article><p><MailCheck/>{t('Confirm the email address from the message sent during account registration.')}</p>{onOpenProfile&&<button type="button" onClick={onOpenProfile}>{t('Open verification center')}</button>}</article>}
      {!sellerVerified&&<article><p><BadgeCheck/>{t('Complete identity verification from Profile → Verification & Security Center.')}</p>{onOpenProfile&&<button type="button" onClick={onOpenProfile}>{t('Open verification center')}</button>}</article>}
      {!descriptionReady&&<article><p><Pencil/><span>{t('Description progress')}: {descriptionCharacters}/20 · {t('Describe wear, repairs, or defects.')}</span></p>{onEditDetails&&<button type="button" onClick={onEditDetails}>{t('Edit description')}</button>}</article>}
    </div>}
    <details className="readiness-details">
      <summary><span>{t('Review all safety signals')}</span><ChevronDown/></summary>
      <div className="readiness-grid">{checks.map(check=><article key={check.label} className={check.complete?'complete':''}>{check.complete?<Check/>:<Clock3/>}<span>{t(check.label)}</span><small>{t(check.status)}</small></article>)}</div>
      <div className="readiness-notes">
        <p className="readiness-note"><ShieldCheck/>{t('This automated check uses only the details in this Dealivra record. It is not an accusation, guarantee, or market-price check.')}</p>
        <p className="readiness-note"><LockKeyhole/>{t('Dealivra does not hold or insure payments in this beta. Never send deposits outside the agreed process.')}</p>
      </div>
    </details>
  </section>
}

function SecurityCenter({email,status,message,onRequest}:{email:string;status:ProfileSummary['verification_status'];message:string;onRequest:()=>void}){
  return <section className="security-center"><div className="security-heading"><ShieldCheck/><div><p className="eyebrow">{t('Account protection')}</p><h2>{t('Verification & Security Center')}</h2></div></div><div className="security-checks"><article><Check/><div><b>{t('Email account active')}</b><span>{email}</span></div></article><article className={status==='verified'?'verified':''}><BadgeCheck/><div><b>{t('Identity verification')}</b><span>{t(status.replace('_',' '))}</span></div>{status==='not_started'&&<button className="secondary" onClick={onRequest}>{t('Request verification')}</button>}</article><article><LockKeyhole/><div><b>{t('Secure handoff enabled')}</b><span>{t('Meeting confirmation and one-time PIN protect in-person deals.')}</span></div></article></div>{status==='pending'&&<div className="notice">{t('Identity verification is pending. Approval requires a licensed verification provider, which is not connected in this beta.')}</div>}{message&&<div className="notice">{t(message)}</div>}<p className="security-warning"><LockKeyhole/> {t('Dealivra does not hold or insure payments in this beta. Never send deposits outside the agreed process.')}</p></section>
}

function AccountSettings({session,displayName,onNameUpdated}:{session:StoredSession;displayName:string;onNameUpdated:(name:string)=>void}){const [name,setName]=useState(displayName);const [password,setPassword]=useState('');const [confirmPassword,setConfirmPassword]=useState('');const [nameMessage,setNameMessage]=useState('');const [passwordMessage,setPasswordMessage]=useState('');const [savingName,setSavingName]=useState(false);const [savingPassword,setSavingPassword]=useState(false);useEffect(()=>setName(displayName),[displayName]);const saveName=async(e:React.FormEvent)=>{e.preventDefault();setNameMessage('');setSavingName(true);try{await updateAccountName(session,name);onNameUpdated(name.trim());setNameMessage('Your display name was updated.')}catch(error){setNameMessage(error instanceof Error?error.message:'Could not update name')}finally{setSavingName(false)}};const savePassword=async(e:React.FormEvent)=>{e.preventDefault();setPasswordMessage('');if(password!==confirmPassword){setPasswordMessage('Passwords do not match.');return}setSavingPassword(true);try{await updateAccountPassword(session,password);setPassword('');setConfirmPassword('');setPasswordMessage('Your password was updated securely.')}catch(error){setPasswordMessage(error instanceof Error?error.message:'Could not update password')}finally{setSavingPassword(false)}};return <section className="account-settings no-print"><div className="settings-heading"><Pencil/><div><p className="eyebrow">{t('Account settings')}</p><h2>{t('Manage your account')}</h2></div></div><div className="settings-grid"><form onSubmit={saveName}><h3>{t('Public display name')}</h3><p>{t('This name appears on your profile and Deal Links.')}</p><label>{t('Your name')}<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>{nameMessage&&<div className="notice">{t(nameMessage)}</div>}<button className="primary" disabled={savingName||name.trim()===displayName}>{t(savingName?'Saving…':'Save name')}</button></form><form onSubmit={savePassword}><h3>{t('Change password')}</h3><p>{t('Use at least 12 characters with uppercase, lowercase, and a number.')}</p><label>{t('New password')}<input required minLength={12} autoComplete="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>{t('Confirm password')}<input required minLength={12} autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>{passwordMessage&&<div className="notice">{t(passwordMessage)}</div>}<button className="primary" disabled={savingPassword}>{t(savingPassword?'Updating…':'Update password')}</button></form></div></section>}

function TrustPassportControls({session}:{session:StoredSession}){
  const [settings,setSettings]=useState<TrustPassportSettings|null>(null);const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);
  useEffect(()=>{getTrustPassportSettings(session).then(setSettings).catch(error=>setMessage(error instanceof Error?error.message:'Could not load passport settings'))},[session]);
  const publicUrl=settings?`${location.origin}/?trust=${settings.public_id}`:'';
  const toggle=async()=>{if(!settings)return;setSaving(true);setMessage('');try{const publicId=await setTrustPassportEnabled(session,!settings.enabled);setSettings({public_id:publicId,enabled:!settings.enabled})}catch(error){setMessage(error instanceof Error?error.message:'Could not update passport settings')}finally{setSaving(false)}};
  const copy=async()=>{await navigator.clipboard?.writeText(publicUrl);setMessage('Passport link copied.')};
  const share=async()=>{if(navigator.share){await navigator.share({title:'Dealivra Digital Trust Passport',url:publicUrl})}else await copy()};
  return <section className="trust-passport-controls no-print"><div className="passport-heading"><ShieldCheck/><div><p className="eyebrow">{t('Public reputation')}</p><h2>{t('Digital Trust Passport')}</h2><p>{t('Share your verified Dealivra reputation with one link.')}</p></div></div>{settings?<><div className="passport-status"><span><b>{t(settings.enabled?'Public passport is active':'Public passport is off')}</b><small>{settings.enabled?publicUrl:t('Enable it only when you want to share your reputation.')}</small></span><button className={settings.enabled?'secondary':'primary'} disabled={saving} onClick={toggle}>{t(settings.enabled?'Disable public passport':'Enable public passport')}</button></div>{settings.enabled&&<div className="passport-actions"><button className="secondary" onClick={copy}><Copy size={17}/>{t('Copy passport link')}</button><button className="primary" onClick={share}><Share2 size={17}/>{t('Share passport')}</button></div>}</>:!message&&<div className="notice">{t('Loading passport…')}</div>}{message&&<div className="notice">{t(message)}</div>}<p className="passport-private"><LockKeyhole size={17}/>{t('Your email, phone, addresses, and identity documents are never shown.')}</p></section>
}

function PublicTrustPassportPage({profile,message,onBack}:{profile:TrustPassport|null;message:string;onBack:()=>void}){
  return <section className="trust-passport-page"><button className="back no-print" onClick={onBack}>← {t('Dashboard')}</button>{profile?<><div className="passport-hero"><p className="eyebrow">Dealivra · {t('Digital Trust Passport')}</p><div className="passport-identity"><span className="passport-avatar">{profile.display_name.slice(0,1)}</span><div><h1>{profile.display_name}</h1><div className={`passport-verification ${profile.verification_status==='verified'?'verified':''}`}><BadgeCheck size={20}/>{t(profile.verification_status==='verified'?'Identity verified':'Verification pending')}</div><p>{t('Member since')} {formatDate(profile.member_since)}</p></div></div></div><div className="passport-grid"><article><span>{t('Completed deals')}</span><strong>{profile.completed_deals}</strong><small>{t('Successful handoffs')}</small></article><article><span>{t('Completed sales')}</span><strong>{profile.completed_sales}</strong><small>{t('Seller activity')}</small></article><article><span>{t('Completed purchases')}</span><strong>{profile.completed_purchases}</strong><small>{t('Buyer activity')}</small></article><article><span>{t('Average rating')}</span><strong>{profile.average_rating??'—'} <Star size={21}/></strong><small>{profile.rating_count} {t('ratings')}</small></article></div><div className="passport-history"><h2>{t('Reputation history')}</h2>{profile.recent_ratings.length?<div className="passport-reviews">{profile.recent_ratings.map((rating,index)=><article className="passport-review" key={`${rating.created_at}-${index}`}><strong>{'★'.repeat(rating.stars)}{'☆'.repeat(5-rating.stars)}</strong><small>{formatDate(rating.created_at)}</small></article>)}</div>:<div className="empty-state"><Star/><b>{t('No ratings yet')}</b></div>}</div><p className="passport-disclaimer"><ShieldCheck size={18}/>{t('This profile shows recorded Dealivra activity and does not guarantee future behavior.')}</p></>:<div className="passport-loading"><div><ShieldCheck size={42}/><h1>{t(message?'Passport unavailable':'Loading passport…')}</h1>{message&&<p>{t(message)}</p>}</div></div>}</section>
}

function SaveDealButton({deal,session,onSignIn,onChanged}:{deal:Deal;session:StoredSession|null;onSignIn:()=>void;onChanged:()=>void}){
  const [saved,setSaved]=useState(false);const [loading,setLoading]=useState(Boolean(session));const [message,setMessage]=useState('');
  useEffect(()=>{let current=true;if(!session){setSaved(false);setLoading(false);return}setLoading(true);isDealSaved(session,deal.publicId).then(value=>{if(current)setSaved(value)}).catch(()=>{}).finally(()=>{if(current)setLoading(false)});return()=>{current=false}},[deal.publicId,session]);
  const toggle=async()=>{if(!session){onSignIn();return}setLoading(true);setMessage('');try{const next=await setDealSaved(session,deal.publicId,!saved);setSaved(next);setMessage(next?'Deal Link saved to your Watchlist.':'Deal Link removed from your Watchlist.');onChanged()}catch(error){setMessage(error instanceof Error?error.message:'Could not update saved deal')}finally{setLoading(false)}};
  return <section className="save-deal no-print"><div><Bookmark fill={saved?'currentColor':'none'}/><span><b>{t(saved?'Saved to Watchlist':'Save this Deal Link')}</b><small>{t(saved?'You can find it on your Dashboard.':'Keep this deal in your private account list.')}</small></span></div><button className={saved?'secondary':'primary'} disabled={loading} onClick={toggle}><Bookmark size={17} fill={saved?'currentColor':'none'}/>{t(session?(saved?'Remove saved deal':'Save Deal Link'):'Sign in to save')}</button>{message&&<div className="notice">{t(message)}</div>}</section>
}

function DealComparison({deals,onClose,onOpen}:{deals:Deal[];onClose:()=>void;onOpen:(deal:Deal)=>void}){
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[onClose]);
  const rows=[
    {label:'Price',value:(deal:Deal)=>dealPrice(deal)},
    {label:'Condition',value:(deal:Deal)=>t(deal.condition)},
    {label:'Handoff',value:(deal:Deal)=>t(deal.deliveryMethod)},
    {label:'Seller',value:(deal:Deal)=>deal.sellerName},
    {label:'Verification',value:(deal:Deal)=>t(deal.sellerVerification.replace('_',' '))},
    {label:'Status',value:(deal:Deal)=>t(isDealExpired(deal)?'expired':deal.status)},
    {label:'Offer expires',value:(deal:Deal)=>deal.expiresAt?formatDateTime(deal.expiresAt):'—'}
  ];
  return <div className="compare-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="compare-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-title"><div className="compare-title"><div><p className="eyebrow">{t('Private Watchlist')}</p><h2 id="compare-title">{t('Deal comparison')}</h2><p>{t('Compare price, condition, handoff, and seller trust.')}</p></div><button className="compare-close" aria-label={t('Close comparison')} onClick={onClose}><X/></button></div><div className="compare-scroll"><table><thead><tr><th>{t('Detail')}</th>{deals.map(deal=><th key={deal.id}><span className="compare-cover">{deal.mediaUrls?.[0]?<MediaPreview source={deal.mediaUrls[0]} alt={deal.title}/>:deal.title.slice(0,1).toUpperCase()}</span><b>{deal.title}</b><small>{deal.publicId}</small></th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.label}><th>{t(row.label)}</th>{deals.map(deal=><td key={deal.id}>{row.value(deal)}</td>)}</tr>)}<tr className="compare-actions"><th></th>{deals.map(deal=><td key={deal.id}><button className="primary" onClick={()=>onOpen(deal)}>{t('Open Deal Link')}<ArrowRight size={16}/></button></td>)}</tr></tbody></table></div><p className="compare-note"><ShieldCheck size={17}/>{t('Comparison uses the current details recorded in each Deal Link.')}</p></section></div>
}

function SavedDealsPanel({items,onOpen}:{items:Deal[];onOpen:(deal:Deal)=>void}){
  const [selected,setSelected]=useState<string[]>([]);const [comparing,setComparing]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>setSelected(current=>current.filter(id=>items.some(deal=>deal.id===id))),[items]);
  const toggle=(dealId:string)=>{setMessage('');setSelected(current=>{if(current.includes(dealId))return current.filter(id=>id!==dealId);if(current.length>=3){setMessage('You can compare up to 3 deals.');return current}return [...current,dealId]})};
  const compare=()=>{if(selected.length<2){setMessage('Choose at least 2 deals.');return}setComparing(true)};
  const compared=items.filter(deal=>selected.includes(deal.id));
  return <section className="saved-deals"><div className="saved-heading"><div><p className="eyebrow">{t('Private Watchlist')}</p><h2>{t('Saved Deal Links')}</h2><p>{t('Deals you want to review again stay here.')}</p></div><div className="saved-heading-actions"><span><Bookmark size={17}/>{items.length}</span>{items.length>=2&&<button className="secondary" disabled={selected.length<2} onClick={compare}><Scale size={17}/>{t('Compare selected')} ({selected.length})</button>}</div></div>{items.length>=2&&<p className="compare-help">{t('Choose 2 or 3 saved deals to compare.')}</p>}{message&&<div className="notice">{t(message)}</div>}{items.length?<div className="saved-grid">{items.map(deal=>{const isSelected=selected.includes(deal.id);return <article className={`saved-card ${isSelected?'selected':''}`} key={deal.id}><button className="saved-card-open" onClick={()=>onOpen(deal)}><span className="saved-card-media">{deal.mediaUrls?.[0]?<MediaPreview source={deal.mediaUrls[0]} alt={deal.title}/>:deal.title.slice(0,1).toUpperCase()}</span><span className="saved-card-body"><b>{deal.title}</b><small>{t('Seller')}: {deal.sellerName}</small><span className="saved-card-meta"><strong>{dealPrice(deal)}</strong><span className={`status ${isDealExpired(deal)?'expired':deal.status}`}>{t(isDealExpired(deal)?'expired':deal.status)}</span></span></span></button>{items.length>=2&&<button className="compare-select" aria-pressed={isSelected} onClick={()=>toggle(deal.id)}>{isSelected?<Check size={16}/>:<Scale size={16}/>} {t(isSelected?'Selected':'Select for comparison')}</button>}</article>})}</div>:<div className="saved-empty"><Bookmark/><span><b>{t('No saved deals yet')}</b><span>{t('Open a Deal Link and choose Save Deal Link.')}</span></span></div>}{comparing&&<DealComparison deals={compared} onClose={()=>setComparing(false)} onOpen={deal=>{setComparing(false);onOpen(deal)}}/>}</section>
}

function EnhancedDashboard({deals,onOpen,onCreate}:{deals:Deal[];onOpen:(deal:Deal)=>void;onCreate:()=>void}){
  const [query,setQuery]=useState('');const [filter,setFilter]=useState<'all'|Deal['status']>('all');
  const visible=deals.filter(deal=>(filter==='all'||deal.status===filter)&&(`${deal.title} ${deal.publicId}`.toLowerCase().includes(query.toLowerCase())));
  const activeCount=deals.filter(deal=>(deal.status==='published'&&!isDealExpired(deal))||deal.status==='accepted').length;const completedCount=deals.filter(deal=>deal.status==='completed').length;
  return <section className="enhanced-dashboard"><div className="dashboard-heading"><div><p className="eyebrow">{t('Your workspace')}</p><h2>{t('Deal dashboard')}</h2><p>{t('Track every sale from published link to completed handoff.')}</p></div><button className="primary" onClick={onCreate}><Plus size={17}/>{t('New deal')}</button></div><div className="dashboard-stats"><article><span>{t('All deals')}</span><strong>{deals.length}</strong></article><article><span>{t('Active')}</span><strong>{activeCount}</strong></article><article><span>{t('Completed')}</span><strong>{completedCount}</strong></article><article><span>{t('Total value')}</span><strong>{groupedDealValue(deals)}</strong></article></div><div className="dashboard-tools"><label><Search size={17}/><input aria-label={t('Search deals')} placeholder={t('Search by item or Deal ID')} value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="filter-tabs">{(['all','published','accepted','completed'] as const).map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{t(item)}</button>)}</div></div>{visible.length?<div className="dashboard-list">{visible.map(deal=>{const expired=isDealExpired(deal);return <button key={deal.id} onClick={()=>onOpen(deal)}><span className="deal-icon">{deal.title.slice(0,1).toUpperCase()}</span><span className="deal-main"><b>{deal.title}</b><small>{deal.publicId} · {t(deal.viewerRole==='buyer'?'Buying':'Selling')}</small></span><strong>{dealPrice(deal)}</strong><span className={`status ${expired?'expired':deal.status}`}>{t(expired?'expired':deal.status)}</span><ArrowRight size={18}/></button>})}</div>:<div className="dashboard-empty"><Search/><b>{t('No matching deals')}</b><span>{t('Try another search or filter, or create a new Deal Link.')}</span><button className="secondary" onClick={onCreate}><Plus size={16}/>{t('Create deal')}</button></div>}</section>
}

function DealSafetyActions({deal,session,onStatus}:{deal:Deal;session:StoredSession;onStatus:(status:Deal['status'])=>void}){
  const [mode,setMode]=useState<'cancel'|'dispute'|null>(null);const [reason,setReason]=useState('');const [message,setMessage]=useState('');const [paymentState,setPaymentState]=useState<ProtectedPaymentState|null>(null);
  useEffect(()=>{if(deal.status!=='completed'){setPaymentState(null);return}let active=true;void getProtectedPaymentStatus(session,deal.id).then(payment=>{if(active)setPaymentState(payment.status)}).catch(()=>{if(active)setPaymentState(null)});return()=>{active=false}},[deal.id,deal.status,session.accessToken]);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!mode)return;setMessage('');try{if(mode==='cancel'){if(!confirm(t('Cancel this deal? This action cannot be undone.')))return;await cancelDeal(session,deal.id,reason);onStatus('cancelled');setMessage('Deal cancelled.')}else{if(!confirm(t('Open a dispute and pause this deal?')))return;await openDealDispute(session,deal.id,reason);onStatus('disputed');setMessage('Problem reported. The deal is now disputed.')}setMode(null);setReason('')}catch(error){setMessage(error instanceof Error?error.message:'Action failed')}};
  if(deal.status==='cancelled'||deal.status==='disputed')return <section className={`deal-alert ${deal.status}`}><ShieldCheck/><div><b>{t(deal.status==='cancelled'?'Deal cancelled':'Deal disputed')}</b><span>{t(deal.status==='cancelled'?'No further handoff actions are available.':'The handoff is paused while the report is reviewed.')}</span></div></section>;
  const canDispute=deal.status==='accepted'||(deal.status==='completed'&&paymentState!==null&&paymentState!=='released'&&paymentState!=='release_pending'&&paymentState!=='refund_pending'&&paymentState!=='refunded');
  return <section className="deal-safety-actions"><div><p className="eyebrow">{t('Safety controls')}</p><h2>{t('Need to stop or report this deal?')}</h2><p>{t('Reasons are recorded in the private audit history.')}</p></div><div className="safety-buttons">{deal.viewerRole==='seller'&&<button className="secondary danger" onClick={()=>setMode('cancel')}>{t('Cancel deal')}</button>}{canDispute&&<button className="secondary" onClick={()=>setMode('dispute')}>{t('Report a problem')}</button>}</div>{mode&&<form onSubmit={submit}><label>{t(mode==='cancel'?'Why are you cancelling?':'Describe the problem')}<textarea required minLength={mode==='cancel'?5:10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder={t(mode==='cancel'?'Example: Item is no longer available':'Include what happened and what outcome you expect')}/></label><div><button type="button" className="secondary" onClick={()=>{setMode(null);setReason('')}}>{t('Go back')}</button><button className="primary">{t(mode==='cancel'?'Confirm cancellation':'Open dispute')}</button></div></form>}{message&&<div className="notice">{t(message)}</div>}</section>
}

function ReportDealPanel({deal,session,onSignIn}:{deal:Deal;session:StoredSession|null;onSignIn:()=>void}){
  const [open,setOpen]=useState(false);const [category,setCategory]=useState('Suspected fraud');const [details,setDetails]=useState('');const [message,setMessage]=useState('');const [sending,setSending]=useState(false);const [submitted,setSubmitted]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!session||details.trim().length<10)return;setSending(true);setMessage('');try{await reportPublicDeal(session,deal.publicId,category,details);setSubmitted(true);setOpen(false)}catch(error){setMessage(error instanceof Error?error.message:'Could not submit report')}finally{setSending(false)}};
  return <section className={`report-deal no-print ${submitted?'submitted':''}`}><div className="report-heading"><Flag/><div><p className="eyebrow">{t('Trust and safety')}</p><h2>{t('Report suspicious deal')}</h2><span>{t('Help Dealivra review possible fraud, prohibited goods, or misleading information.')}</span></div></div>{submitted?<div className="report-success"><Check/><div><b>{t('Report submitted')}</b><span>{t('Thank you. The report was recorded for review.')}</span></div></div>:<>{!open?<button className="secondary danger" onClick={()=>setOpen(true)}><Flag size={16}/>{t('Report suspicious deal')}</button>:session?<form onSubmit={submit}><label>{t('Report category')}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="Suspected fraud">{t('Suspected fraud')}</option><option value="Prohibited item">{t('Prohibited item')}</option><option value="Misleading information">{t('Misleading information')}</option><option value="Duplicate or stolen photos">{t('Duplicate or stolen photos')}</option><option value="Other">{t('Other')}</option></select></label><label>{t('Details')}<textarea required minLength={10} maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)} placeholder={t('Describe what you noticed without sharing passwords or financial information.')}/><small>{details.trim().length}/1000</small></label>{message&&<div className="notice">{t(message)}</div>}<div className="report-actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>{t('Go back')}</button><button className="primary" disabled={sending||details.trim().length<10}>{t(sending?'Sending…':'Submit report')}</button></div></form>:<div className="report-signin"><LockKeyhole/><span>{t('Sign in so the report can be recorded and protected from abuse.')}</span><button className="primary" onClick={onSignIn}>{t('Sign in to report')}</button></div>}</>}</section>
}

function AdminEvidenceReview({dispute,session}:{dispute:AdminDispute;session:StoredSession}){
  const [items,setItems]=useState<DealEvidence[]>([]);const [urls,setUrls]=useState<Record<string,string>>({});const [message,setMessage]=useState('');
  useEffect(()=>{let current=true;setMessage('');setUrls({});listDealEvidence(session,dispute.deal_id).then(async next=>{if(!current)return;setItems(next);const pairs=await Promise.all(next.map(async item=>{try{return [item.id,await createDealEvidenceSignedUrl(session,item.storage_path)] as const}catch{return null}}));if(current)setUrls(Object.fromEntries(pairs.filter(Boolean) as [string,string][]))}).catch(error=>{if(current)setMessage(error instanceof Error?error.message:'Could not load evidence')});return()=>{current=false}},[dispute.deal_id,session.accessToken]);
  return <div className="admin-evidence-review"><div className="admin-evidence-heading"><b>{t('Evidence files')}</b><span>{items.length} {t(items.length===1?'file':'files')}</span></div>{message&&<div className="notice">{t(message)}</div>}{items.length?items.map(item=><article key={item.id}><div className="admin-evidence-preview">{urls[item.id]&&item.mime_type?.startsWith('image/')?<img src={urls[item.id]} alt={item.file_name||t('Evidence file')}/>:urls[item.id]&&item.mime_type?.startsWith('video/')?<video src={urls[item.id]} controls preload="metadata"/>:<Package size={20}/>}</div><div><b>{t(evidenceLabels[item.evidence_type]||'Other evidence')}</b><span>{item.file_name||t('Uploaded file')} · {item.uploader_role} · {item.sha256?`SHA-256 ${item.sha256.slice(0,12)}…`:t('Fingerprint unavailable')}</span></div>{urls[item.id]?<a className="secondary" href={urls[item.id]} target="_blank" rel="noreferrer">{t('Open file')}</a>:<em>{t('Preparing…')}</em>}</article>):<p>{t('No evidence uploaded yet.')}</p>}</div>
}

function AdminRevenueCenter({session,onOpenDeal}:{session:StoredSession;onOpenDeal:(deal:Deal)=>void}){
  const [summary,setSummary]=useState<AdminRevenueSummary|null>(null);
  const [transactions,setTransactions]=useState<AdminRevenueTransaction[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [transactionsMessage,setTransactionsMessage]=useState('');
  const [transactionQuery,setTransactionQuery]=useState('');
  const [transactionStatus,setTransactionStatus]=useState('all');
  const [openingDeal,setOpeningDeal]=useState('');
  const load=async()=>{setLoading(true);setMessage('');setTransactionsMessage('');try{setSummary(await getAdminRevenueSummary(session))}catch(error){setMessage(error instanceof Error?error.message:'Could not load revenue summary')}try{setTransactions(await getAdminRevenueTransactions(session,100))}catch(error){setTransactionsMessage(error instanceof Error?error.message:'Could not load revenue transactions')}finally{setLoading(false)}};
  useEffect(()=>{void load()},[session.accessToken]);
  const money=(cents:number)=>summary?formatMoney(Number(cents||0),summary.currency,getAppLanguage()):'—';
  const filteredTransactions=transactions.filter(item=>{const query=transactionQuery.trim().toLowerCase();const matchesQuery=!query||[item.public_id,item.title,item.seller_name,item.buyer_name].some(value=>String(value||'').toLowerCase().includes(query));const matchesStatus=transactionStatus==='all'||item.status===transactionStatus;return matchesQuery&&matchesStatus});
  const transactionStatuses=Array.from(new Set(transactions.map(item=>item.status))).sort();
  const openDeal=async(publicId:string)=>{setOpeningDeal(publicId);setTransactionsMessage('');try{onOpenDeal(await getPublicDeal(publicId))}catch(error){setTransactionsMessage(error instanceof Error?error.message:'Deal Link is unavailable')}finally{setOpeningDeal('')}};
  useEffect(()=>{const table=document.querySelector('.admin-revenue-table');if(!table)return;const head=table.querySelector('thead tr');if(head&&!head.querySelector('.action-heading')){const cell=document.createElement('th');cell.className='action-heading';cell.textContent=t('Action');head.appendChild(cell)}const rows=Array.from(table.querySelectorAll('tbody tr'));rows.forEach((row,index)=>{row.querySelector('.table-open-cell')?.remove();const item=filteredTransactions[index];if(!item)return;const cell=document.createElement('td');cell.className='table-open-cell';const button=document.createElement('button');button.className='table-open secondary';button.type='button';button.disabled=openingDeal===item.public_id;button.textContent=openingDeal===item.public_id?t('Opening'):t('Open Deal Link');button.onclick=()=>void openDeal(item.public_id);cell.appendChild(button);row.appendChild(cell)});},[filteredTransactions,openingDeal]);
  const exportCsv=()=>{if(!filteredTransactions.length)return;const cell=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;const rows=[['Dealivra ID','Title','Status','Gross USD','Dealivra fee allocation USD','Seller amount USD','Seller','Buyer','Created'],...filteredTransactions.map(item=>[item.public_id,item.title,item.status,(Number(item.item_amount_cents)/100).toFixed(2),(Number(item.platform_fee_cents)/100).toFixed(2),(Number(item.seller_amount_cents)/100).toFixed(2),item.seller_name,item.buyer_name,item.created_at])];const csv=rows.map(row=>row.map(cell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`dealivra-revenue-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url)};
  const cards=summary?[
    {label:'Payment volume',value:money(summary.total_payment_volume_cents),detail:`${summary.payment_count} ${t(summary.payment_count===1?'payment':'payments')}`,tone:'neutral'},
    {label:'Dealivra commission earned',value:money(summary.total_commission_earned_cents),detail:`${summary.released_count} ${t(summary.released_count===1?'released deal':'released deals')}`,tone:'green'},
    {label:'Released to sellers',value:money(summary.total_released_to_sellers_cents),detail:t('Completed payouts'),tone:'green'},
    {label:'Funds currently protected',value:money(summary.total_protected_cents),detail:t('Awaiting release or review'),tone:'gold'},
    {label:'Refunded to buyers',value:money(summary.total_refunded_cents),detail:`${summary.refunded_count} ${t(summary.refunded_count===1?'refund':'refunds')}`,tone:'rose'},
    {label:'Open disputes',value:String(summary.disputed_count),detail:t('Needs admin review'),tone:'gold'},
  ]:[];
  return <section className="admin-revenue"><div className="admin-revenue-heading"><div className="admin-revenue-title"><BadgeDollarSign/><div><p className="eyebrow">{t('Administrator finances')}</p><h2>{t('Revenue dashboard')}</h2><span>{t('Track payment volume, earned commission, protected funds, and payouts in one place.')}</span></div></div><button className="secondary" onClick={load} disabled={loading}>{t(loading?'Refreshing…':'Refresh')}</button></div>{message&&<div className="notice" role="alert">{t(message)}</div>}{loading&&!summary?<div className="admin-revenue-loading">{t('Loading revenue summary…')}</div>:summary?<><div className="admin-revenue-grid">{cards.map(card=><article className={`admin-revenue-card ${card.tone}`} key={card.label}><span>{t(card.label)}</span><strong>{card.value}</strong><small>{card.detail}</small></article>)}</div><p className="admin-revenue-note"><ShieldCheck size={16}/>{t('Commission earned is counted only after funds are released to the seller. Stripe processing fees are shown separately in Stripe and are not included in Dealivra commission.')}</p><div className="admin-revenue-ledger"><div className="admin-revenue-ledger-heading"><div><p className="eyebrow">{t('Payment activity')}</p><h3>{t('Recent transactions')}</h3><span>{t('Review the latest protected payments and fee allocations.')}</span></div><button className="secondary" onClick={exportCsv} disabled={!filteredTransactions.length}><FileDown size={16}/>{t('Export CSV')}</button></div><div className="admin-revenue-filters"><label><Search size={16}/><input value={transactionQuery} onChange={event=>setTransactionQuery(event.target.value)} placeholder={t('Search transactions')} aria-label={t('Search transactions')}/></label><select value={transactionStatus} onChange={event=>setTransactionStatus(event.target.value)} aria-label={t('Filter by status')}><option value="all">{t('All statuses')}</option>{transactionStatuses.map(status=><option key={status} value={status}>{t(status.replaceAll('_',' '))}</option>)}</select><span>{filteredTransactions.length} / {transactions.length}</span></div>{transactionsMessage&&<div className="notice">{t(transactionsMessage)}</div>}{filteredTransactions.length?<div className="admin-revenue-table-wrap"><table className="admin-revenue-table"><thead><tr><th>{t('Deal')}</th><th>{t('Status')}</th><th>{t('Gross')}</th><th>{t('Dealivra fee')}</th><th>{t('Seller amount')}</th><th>{t('Created')}</th></tr></thead><tbody>{filteredTransactions.map(item=><tr key={item.transaction_id}><td><b>{item.title}</b><small>{item.public_id}</small></td><td><span className={`status ${item.status}`}>{t(item.status.replaceAll('_',' '))}</span></td><td>{formatMoney(Number(item.item_amount_cents),item.currency,getAppLanguage())}</td><td>{formatMoney(Number(item.platform_fee_cents),item.currency,getAppLanguage())}</td><td>{formatMoney(Number(item.seller_amount_cents),item.currency,getAppLanguage())}</td><td>{formatDateTime(item.created_at)}</td></tr>)}</tbody></table></div>:transactions.length?<div className="admin-revenue-loading">{t('No matching transactions.')}</div>:!transactionsMessage&&<div className="admin-revenue-loading">{t('No payment activity yet.')}</div>}</div></>:<div className="admin-revenue-loading">{t('Revenue summary is unavailable.')}</div>}</section>
}

function AdminDisputeCenter({session}:{session:StoredSession}){
  const [filter,setFilter]=useState<'open'|'resolved'|'all'>('open');const [disputes,setDisputes]=useState<AdminDispute[]>([]);const [notes,setNotes]=useState<Record<string,string>>({});const [expanded,setExpanded]=useState<string|null>(null);const [message,setMessage]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState('');
  const load=()=>{setLoading(true);setMessage('');getAdminDisputes(session,filter).then(setDisputes).catch(error=>setMessage(error instanceof Error?error.message:'Could not load dispute queue')).finally(()=>setLoading(false))};
  useEffect(load,[filter,session.accessToken]);
  const decide=async(dispute:AdminDispute,decision:'resolved_buyer'|'resolved_seller'|'cancelled')=>{const note=(notes[dispute.dispute_id]||'').trim();if(note.length<3)return;const prompt=decision==='resolved_buyer'?'Resolve for buyer and issue a full Stripe refund?':decision==='resolved_seller'?'Resolve for seller and release the protected Stripe funds?':'Close this dispute without moving funds?';if(!confirm(t(prompt)))return;setSaving(dispute.dispute_id);setMessage('');try{if(decision==='cancelled')await resolveAdminDispute(session,dispute.dispute_id,decision,note);else await resolveAdminDisputeFinancial(session,dispute.dispute_id,decision,note);setDisputes(items=>filter==='all'?items.map(item=>item.dispute_id===dispute.dispute_id?{...item,dispute_status:decision,resolution_note:note,payment_status:decision==='resolved_buyer'?'refunded':decision==='resolved_seller'?'released':item.payment_status}:item):items.filter(item=>item.dispute_id!==dispute.dispute_id));setMessage(decision==='resolved_buyer'?'Dispute resolved and buyer refunded.':decision==='resolved_seller'?'Dispute resolved and funds released to seller.':'Dispute closed.')}catch(error){setMessage(error instanceof Error?error.message:'Could not resolve dispute')}finally{setSaving('')}};
  return <section className="admin-disputes"><div className="admin-disputes-heading"><Scale/><div><p className="eyebrow">{t('Buyer and seller protection')}</p><h2>{t('Dispute review')}</h2><span>{t('Compare both parties’ evidence before recording a decision.')}</span></div></div><div className="admin-filters">{(['open','resolved','all'] as const).map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{t(item==='open'?'Open disputes':item==='resolved'?'Resolved':'All disputes')}</button>)}</div>{message&&<div className="notice">{t(message)}</div>}{loading?<div className="admin-empty">{t('Loading disputes…')}</div>:disputes.length?<div className="admin-dispute-list">{disputes.map(dispute=><article key={dispute.dispute_id}><div className="admin-dispute-top"><div><div className="admin-dispute-badges"><span className={`status ${dispute.dispute_status}`}>{t(dispute.dispute_status.replaceAll('_',' '))}</span><span className="status moderation-visible">{t(dispute.payment_status.replaceAll('_',' '))}</span></div><h3>{dispute.title}</h3><small>{dispute.public_id} · {formatDateTime(dispute.opened_at)}</small></div><strong>{formatMoney(Number(dispute.item_amount_cents),dispute.currency,getAppLanguage())}</strong></div><p className="admin-dispute-reason">{dispute.reason}</p><div className="admin-dispute-people"><span>{t('Opened by')}<b>{dispute.opened_by_name}</b></span><span>{t('Seller')}<b>{dispute.seller_name}</b></span><span>{t('Buyer')}<b>{dispute.buyer_name}</b></span><span>{t('Response deadline')}<b>{formatDateTime(dispute.response_deadline)}</b></span></div><button className="secondary admin-evidence-toggle" onClick={()=>setExpanded(expanded===dispute.dispute_id?null:dispute.dispute_id)}><ShieldCheck size={16}/>{t(expanded===dispute.dispute_id?'Hide evidence':'Review evidence')}</button>{expanded===dispute.dispute_id&&<AdminEvidenceReview dispute={dispute} session={session}/>} {dispute.dispute_status==='open'||dispute.dispute_status==='evidence_requested'||dispute.dispute_status==='under_review'?<div className="admin-dispute-decision"><label>{t('Decision note')}<textarea required minLength={3} maxLength={1000} value={notes[dispute.dispute_id]||''} onChange={event=>setNotes(current=>({...current,[dispute.dispute_id]:event.target.value}))} placeholder={t('Explain what evidence was checked and the next payment action.')}/></label><div><button className="secondary" disabled={saving===dispute.dispute_id||(notes[dispute.dispute_id]||'').trim().length<3} onClick={()=>decide(dispute,'cancelled')}>{t('Close dispute')}</button><button className="secondary" disabled={saving===dispute.dispute_id||(notes[dispute.dispute_id]||'').trim().length<3} onClick={()=>decide(dispute,'resolved_buyer')}>{t('Resolve for buyer')}</button><button className="primary" disabled={saving===dispute.dispute_id||(notes[dispute.dispute_id]||'').trim().length<3} onClick={()=>decide(dispute,'resolved_seller')}>{t('Resolve for seller')}</button></div></div>:dispute.resolution_note&&<div className="admin-resolution"><b>{t('Decision note')}</b><p>{dispute.resolution_note}</p></div>}</article>)}</div>:<div className="admin-empty"><Check/><b>{t('No disputes in this queue.')}</b></div>}<p className="admin-dispute-note"><LockKeyhole size={16}/>{t('Recording a decision does not refund or release funds. Complete the separate Stripe action after reviewing the evidence.')}</p></section>
}

function AdminReportCenter({session,onBack,onOpenDeal}:{session:StoredSession;onBack:()=>void;onOpenDeal:(deal:Deal)=>void}){
  const [filter,setFilter]=useState<'open'|'reviewed'|'dismissed'|'all'>('open');const [reports,setReports]=useState<AdminReport[]>([]);const [notes,setNotes]=useState<Record<string,string>>({});const [message,setMessage]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState('');
  const load=()=>{setLoading(true);setMessage('');getAdminReports(session,filter).then(setReports).catch(error=>setMessage(error instanceof Error?error.message:'Could not load report queue')).finally(()=>setLoading(false))};
  useEffect(load,[filter,session]);
  const openDeal=async(publicId:string)=>{setMessage('');try{onOpenDeal(await getPublicDeal(publicId))}catch(error){setMessage(error instanceof Error?error.message:'Deal Link unavailable')}};
  const decide=async(report:AdminReport,decision:'reviewed'|'dismissed')=>{const note=(notes[report.report_id]||'').trim();if(note.length<3)return;setSaving(report.report_id);setMessage('');try{await resolveAdminReport(session,report.report_id,decision,note);setReports(items=>filter==='all'?items.map(item=>item.report_id===report.report_id?{...item,report_status:decision,resolution_note:note}:item):items.filter(item=>item.report_id!==report.report_id));setMessage('Decision saved.')}catch(error){setMessage(error instanceof Error?error.message:'Could not save report decision')}finally{setSaving('')}};
  const changeVisibility=async(report:AdminReport)=>{const note=(notes[report.report_id]||'').trim();if(note.length<3)return;const status=report.moderation_status==='hidden'?'visible':'hidden';setSaving(report.report_id);setMessage('');try{await setAdminDealVisibility(session,report.deal_id,status,note);setReports(items=>items.map(item=>item.deal_id===report.deal_id?{...item,moderation_status:status}:item));setMessage(status==='hidden'?'Deal hidden from public access.':'Deal restored to public access.')}catch(error){setMessage(error instanceof Error?error.message:'Could not update Deal Link visibility')}finally{setSaving('')}};
  return <section className="admin-center"><button className="back" onClick={onBack}>← {t('Dashboard')}</button><div className="admin-heading"><ShieldCheck/><div><p className="eyebrow">{t('Admin review')}</p><h1>{t('Moderation queue')}</h1><p>{t('Review reported deals and record a decision.')}</p></div></div><div className="admin-filters">{(['open','reviewed','dismissed','all'] as const).map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{t(item==='open'?'Open reports':item==='reviewed'?'Reviewed':item==='dismissed'?'Dismissed':'All reports')}</button>)}</div>{message&&<div className="notice">{t(message)}</div>}{loading?<div className="admin-empty">{t('Loading reports…')}</div>:reports.length?<div className="admin-report-list">{reports.map(report=><article key={report.report_id}><div className="admin-report-top"><div className="admin-report-identity"><div><span className={`status ${report.report_status}`}>{t(report.report_status)}</span><span className={`status moderation-${report.moderation_status}`}>{t(report.moderation_status==='hidden'?'Hidden':'Visible')}</span></div><h2>{report.title}</h2><small>{report.public_id} · {formatDateTime(report.created_at)}</small></div><button className="secondary" disabled={report.moderation_status==='hidden'} onClick={()=>openDeal(report.public_id)}>{t('Open Deal Link')}<ArrowRight size={16}/></button></div>{report.moderation_status==='hidden'&&<p className="admin-hidden-note">{t('Hidden Deal Links cannot be opened or accepted until restored.')}</p>}<p className="admin-reason">{report.reason}</p><div className="admin-people"><span>{t('Reporter')}<b>{report.reporter_name}</b></span><span>{t('Seller')}<b>{report.seller_name}</b></span></div><div className="admin-decision"><label>{t('Resolution note')}<textarea required minLength={3} maxLength={500} value={notes[report.report_id]||''} onChange={e=>setNotes(current=>({...current,[report.report_id]:e.target.value}))} placeholder={t('Record what was checked and why this decision was made.')}/></label><div><button className={`secondary ${report.moderation_status==='hidden'?'':'danger'}`} disabled={saving===report.report_id||(notes[report.report_id]||'').trim().length<3} onClick={()=>changeVisibility(report)}>{t(report.moderation_status==='hidden'?'Restore Deal Link':'Hide Deal Link')}</button>{report.report_status==='open'&&<><button className="secondary" disabled={saving===report.report_id||(notes[report.report_id]||'').trim().length<3} onClick={()=>decide(report,'dismissed')}>{t('Dismiss report')}</button><button className="primary" disabled={saving===report.report_id||(notes[report.report_id]||'').trim().length<3} onClick={()=>decide(report,'reviewed')}>{t('Mark reviewed')}</button></>}</div></div>{report.report_status!=='open'&&report.resolution_note&&<div className="admin-resolution"><b>{t('Resolution note')}</b><p>{report.resolution_note}</p></div>}</article>)}</div>:<div className="admin-empty"><Check/><b>{t('No reports in this queue.')}</b></div>}</section>
}

const eventLabels:Record<string,string>={deal_published:'Deal Link published',deal_accepted:'Terms accepted',buyer_accepted:'Terms accepted',deal_renewed:'Deal Link extended.',deal_updated:'Deal details updated',question_asked:'Buyer question received',question_answered:'Seller replied to question',offer_made:'Offer sent',offer_declined:'Offer declined',offer_accepted:'Offer accepted',buyer_access_protection_enabled:'Buyer access protection enabled',buyer_access_protection_disabled:'Buyer access protection disabled',buyer_access_code_verified:'Buyer access code verified',meeting_proposed:'Meeting proposed',meeting_confirmed:'Meeting confirmed',participant_arrived:'Arrival recorded',handoff_pin_generated:'Handoff PIN generated',delivery_address_saved:'Delivery address saved',payment_method_recorded:'Payment method recorded',payment_method_confirmed:'Payment method confirmed',payment_marked_sent:'Buyer marked payment sent',payment_received:'Seller confirmed payment received',item_inspected:'Buyer inspection recorded',item_shipped:'Item shipped',shipment_delivered:'Delivery confirmed',media_reordered:'Photo order updated',seller_declaration_recorded:'Seller declaration recorded',deal_reported:'Deal reported',deal_hidden:'Deal hidden from public access',deal_restored:'Deal restored to public access',deal_completed:'Deal completed',deal_cancelled:'Deal cancelled',dispute_opened:'Problem reported'};
function friendlyEvent(type:string){return t(eventLabels[type]||type.replaceAll('_',' '))}

function TimelinePanel({deal,session}:{deal:Deal;session:StoredSession}){
  const [events,setEvents]=useState<TimelineEvent[]>([]);const [error,setError]=useState('');
  useEffect(()=>{let active=true;const load=()=>getDealTimeline(session,deal.id).then(items=>{if(active){setEvents(items);setError('')}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load timeline')});void load();const timer=window.setInterval(load,15_000);const visible=()=>{if(document.visibilityState==='visible')void load()};document.addEventListener('visibilitychange',visible);return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[deal.id,deal.status,session.accessToken]);
  const share=async()=>{const history=[`Dealivra · ${deal.publicId}`,deal.title,dealPrice(deal),'',...events.slice().reverse().map(event=>`${formatDateTime(event.created_at)} · ${friendlyEvent(event.event_type)} · ${t(event.is_mine?'By you':'By the other party')}`)].join('\n');try{if(navigator.share)await navigator.share({title:`Dealivra · ${deal.publicId}`,text:history,url:`${location.origin}/?deal=${deal.publicId}`});else await navigator.clipboard.writeText(history)}catch(error){if(error instanceof Error&&error.name!=='AbortError')setError('Could not share this link.')}};
  return <section className="timeline-panel"><div className="timeline-heading"><Clock3/><div><p className="eyebrow">{t('Recorded history')}</p><h2>{t('Deal timeline')}</h2></div><div className="timeline-actions no-print"><button className="secondary" onClick={()=>window.print()}><FileDown size={16}/>{t('Print / Save PDF')}</button><button className="secondary" onClick={share}><Share2 size={16}/>{t('Share')}</button></div></div>{error&&<div className="notice">{t(error)}</div>}<div className="timeline-list">{events.length?events.map(event=><article key={event.id}><span></span><div><b>{friendlyEvent(event.event_type)}</b><small>{t(event.is_mine?'By you':'By the other party')} · {formatDateTime(event.created_at)}</small></div></article>):<p>{t('No deal activity yet.')}</p>}</div></section>}

function CompletionReceipt({deal,session}:{deal:Deal;session:StoredSession}){
  const [completedAt,setCompletedAt]=useState('');const [payment,setPayment]=useState<DealPaymentRecord|null>(null);
  useEffect(()=>{getDealTimeline(session,deal.id).then(events=>setCompletedAt(events.find(event=>event.event_type==='deal_completed')?.created_at||'')).catch(()=>{});getDealPaymentRecord(session,deal.id).then(setPayment).catch(()=>{})},[deal.id,session.accessToken]);
  const link=`${location.origin}/?deal=${deal.publicId}`;
  const share=async()=>{if(navigator.share){await navigator.share({title:`Dealivra · ${t('Deal completed')}`,text:`${deal.title} · ${deal.publicId}`,url:link}).catch(()=>{})}else await navigator.clipboard?.writeText(link)};
  return <section className="completion-receipt"><div className="receipt-heading"><PackageCheck/><div><p className="eyebrow">{t('Agreement copy')}</p><h2>{t('Deal completed')}</h2></div><span className="receipt-stamp"><Check size={15}/>{t('Completed')}</span></div><div className="receipt-grid"><div><span>{t('Deal')}</span><strong>{deal.publicId}</strong></div><div><span>{t('Item details')}</span><strong>{deal.title}</strong></div><div><span>{t('Price')}</span><strong>{dealPrice(deal)}</strong></div><div><span>{t('Seller contact')}</span><strong>{deal.sellerName}</strong></div><div><span>{t('Buyer')}</span><strong>{deal.buyerName||t('Not provided')}</strong></div><div><span>{t('Version')}</span><strong>{deal.agreementVersion}</strong></div><div><span>{t('Handoff')}</span><strong>{t(deal.deliveryMethod)}</strong></div><div><span>{t('Condition')}</span><strong>{t(deal.condition)}</strong></div><div><span>{t('Agreed payment method')}</span><strong>{payment?t(paymentMethodLabels[payment.method]):t('Not provided')}</strong></div><div><span>{t('Payment status')}</span><strong>{payment?.seller_marked_received_at?t('Seller confirmed receipt'):t('Not provided')}</strong></div><div><span>{t('Completed')}</span><strong>{completedAt?formatDateTime(completedAt):'—'}</strong></div></div><div className="receipt-actions"><button className="secondary" onClick={()=>window.print()}><FileDown size={17}/>{t('Print / Save PDF')}</button><button className="primary" onClick={share}><Share2 size={17}/>{t('Share')}</button></div><p className="receipt-note"><ShieldCheck/>{t('Use your browser’s print screen to save a PDF copy. The live Deal Link remains the current record.')}</p></section>
}

function NotificationCenter({items,deals,onOpen,onOpenPublic,onMarkAll}:{items:DealNotification[];deals:Deal[];onOpen:(deal:Deal)=>void;onOpenPublic:(publicId:string)=>void;onMarkAll:()=>void}){const [expanded,setExpanded]=useState(false);const unread=items.filter(item=>!item.is_read).length;return <section className="notification-center"><button className="notification-toggle" onClick={()=>setExpanded(!expanded)}><Bell size={19}/><span>{t('Activity')}</span>{unread>0&&<em aria-label={`${unread} ${t('Unread')}`}>{unread}</em>}</button>{expanded&&<div className="notification-menu"><div className="notification-menu-header"><h3>{t('Recent activity')}</h3>{unread>0&&<button onClick={onMarkAll}>{t('Mark all as read')}</button>}</div>{items.length?items.slice(0,8).map(item=><button className={`notification-item ${item.is_read?'read':'unread'}`} key={item.id} onClick={()=>{const deal=deals.find(d=>d.id===item.deal_id);if(deal)onOpen(deal);else onOpenPublic(item.public_id)}}><span className="notification-dot"></span><span><b>{friendlyEvent(item.event_type)}</b><small>{item.title} · {formatDateTime(item.created_at)}</small></span></button>):<p>{t('No deal activity yet.')}</p>}</div>}</section>}

function AgreementExport({deal}:{deal:Deal}){
  const [message,setMessage]=useState('');
  const url=`${location.origin}/?deal=${deal.publicId}`;
  const share=async()=>{
    try{
      if(navigator.share)await navigator.share({title:`Dealivra agreement: ${deal.title}`,text:`Review Dealivra agreement ${deal.publicId}`,url});
      else{
        await navigator.clipboard.writeText(url);
        setMessage('Deal Link copied.');
      }
    }catch(error){
      if(error instanceof Error&&error.name!=='AbortError')setMessage('Could not share this link.');
    }
  };
  return <section className="agreement-export no-print">
    <div className="agreement-export-icon"><FileSignature/></div>
    <div className="agreement-export-copy">
      <p className="eyebrow">{t('Agreement document')}</p>
      <h2>{t('Professional agreement copy')}</h2>
      <p>{t('A clean, dated PDF with the parties, item terms, agreement version, and verification code.')}</p>
      <div className="agreement-export-meta">
        <span><b>{t('Deal ID')}</b>{deal.publicId}</span>
        <span><b>{t('Version')}</b>{deal.agreementVersion}</span>
        <span><b>{t('Status')}</b>{t(deal.status)}</span>
      </div>
    </div>
    <div className="agreement-export-actions">
      <button className="primary" onClick={()=>window.print()}><FileDown size={17}/>{t('Download agreement PDF')}</button>
      <button className="secondary" onClick={()=>window.open(`${url}&document=1`,'_blank','noopener,noreferrer')}><Eye size={17}/>{t('Preview document')}</button>
      <button className="secondary" onClick={share}><Share2 size={17}/>{t('Share Deal Link')}</button>
    </div>
    {message&&<div className="notice">{t(message)}</div>}
  </section>;
}

function AgreementPrintDocument({deal}:{deal:Deal}){
  const [fingerprint,setFingerprint]=useState('');
  const [generatedAt]=useState(()=>new Date().toLocaleString('en-US',{
    month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'
  }));
  useEffect(()=>{
    let current=true;
    createAgreementFingerprint(deal).then(value=>{if(current)setFingerprint(value)}).catch(()=>{});
    return()=>{current=false};
  },[deal]);
  const link=`${location.origin}/?deal=${deal.publicId}`;
  const buyerRecorded=Boolean(deal.buyerName);
  const sellerVerification=deal.sellerVerification==='verified'?'Identity verified':deal.sellerContactVerified?'Contact verified':'Verification pending';
  const buyerVerification=deal.buyerVerification==='verified'?'Identity verified':buyerRecorded?'Verification pending':'Not yet recorded';
  const statusLabel=deal.status.charAt(0).toUpperCase()+deal.status.slice(1);
  const acceptanceCopy=deal.status==='published'
    ?'The seller has issued this agreement version for buyer review. Buyer acceptance has not yet been recorded.'
    :deal.status==='draft'
      ?'This is a private draft and has not been issued to a buyer.'
      :`Agreement Version ${deal.agreementVersion} is the recorded transaction version associated with the current ${deal.status} deal status.`;
  return <>
    <div className="agreement-document-toolbar no-print">
      <button className="secondary" onClick={()=>{location.href=`/?deal=${deal.publicId}`}}>← {t('Back to deal')}</button>
      <div><span><ShieldCheck/></span><strong>{t('Agreement preview')}</strong><small>{deal.publicId} · {t('Version')} {deal.agreementVersion}</small></div>
      <button className="primary" onClick={()=>window.print()}><FileDown size={17}/>{t('Download PDF')}</button>
    </div>
    <article className="agreement-print-document">
    <header className="agreement-print-header">
      <div className="agreement-print-brand"><span><BrandLogo iconOnly/></span><div><strong>Dealivra</strong><small>PRIVATE TRANSACTION RECORD</small></div></div>
      <div className="agreement-print-status"><small>RECORD STATUS</small><strong>{statusLabel}</strong></div>
    </header>

    <section className="agreement-print-hero">
      <div>
        <p>TRANSACTION AGREEMENT</p>
        <h1>Private sale agreement</h1>
        <span>Deal {deal.publicId} · Agreement Version {deal.agreementVersion}</span>
      </div>
      <div className="agreement-print-price"><small>AGREED PRICE</small><strong>{dealPrice(deal)}</strong><span>{deal.currency}</span></div>
    </section>

    <section className="agreement-print-meta">
      <div><small>DEAL ID</small><strong>{deal.publicId}</strong></div>
      <div><small>VERSION</small><strong>{deal.agreementVersion}</strong></div>
      <div><small>CREATED</small><strong>{formatDateTime(deal.createdAt)}</strong></div>
      <div><small>DOCUMENT GENERATED</small><strong>{generatedAt}</strong></div>
    </section>

    <section className="agreement-print-section">
      <div className="agreement-print-section-title"><span>01</span><div><small>PARTIES</small><h2>Transaction participants</h2></div></div>
      <div className="agreement-print-parties">
        <article><small>SELLER</small><strong>{deal.sellerName}</strong><span><BadgeCheck/>{sellerVerification}</span></article>
        <article><small>BUYER</small><strong>{deal.buyerName||'Pending buyer'}</strong><span><BadgeCheck/>{buyerVerification}</span></article>
      </div>
    </section>

    <section className="agreement-print-section">
      <div className="agreement-print-section-title"><span>02</span><div><small>TRANSACTION</small><h2>Item and agreed terms</h2></div></div>
      <div className="agreement-print-terms">
        <div className="agreement-print-item"><small>ITEM</small><strong>{deal.title}</strong><p>{deal.description}</p></div>
        <dl>
          <div><dt>Price</dt><dd>{dealPrice(deal)}</dd></div>
          <div><dt>Condition</dt><dd>{deal.condition}</dd></div>
          <div><dt>Handoff</dt><dd>{deal.deliveryMethod}</dd></div>
          <div><dt>Serial / identifier</dt><dd>{deal.serialNumber||'Not provided'}</dd></div>
          <div><dt>Offer expiration</dt><dd>{deal.expiresAt?formatDateTime(deal.expiresAt):'Not specified'}</dd></div>
        </dl>
      </div>
    </section>

    <section className="agreement-print-section agreement-print-conditions">
      <div className="agreement-print-section-title"><span>03</span><div><small>AGREEMENT RECORD</small><h2>Confirmed transaction conditions</h2></div></div>
      <p className="agreement-print-acceptance">{acceptanceCopy}</p>
      <ol>
        <li><span>1</span><p><b>Shared item terms.</b> The title, price, condition disclosure, identifier information, and handoff method above form this agreement version.</p></li>
        <li><span>2</span><p><b>Recorded changes.</b> Material edits create or update the Dealivra record. The live Deal Link remains the current source of transaction status.</p></li>
        <li><span>3</span><p><b>Delivery and inspection.</b> The parties should keep tracking, delivery, inspection, and condition evidence with the Dealivra record before confirming completion.</p></li>
        <li><span>4</span><p><b>Problems and disputes.</b> A party should report a material issue before confirming completion or authorizing any payment release.</p></li>
      </ol>
    </section>

    <section className="agreement-print-section agreement-print-verification">
      <div className="agreement-print-section-title"><span>04</span><div><small>INTEGRITY</small><h2>Record verification</h2></div></div>
      <div className="agreement-print-code">
        <span><Fingerprint/></span>
        <div><small>SHA-256 AGREEMENT CODE</small><code>{fingerprint||'Generating verification code…'}</code></div>
      </div>
      <div className="agreement-print-link"><small>LIVE DEAL LINK</small><span>{link}</span></div>
    </section>

    <section className="agreement-print-notice">
      <ShieldAlert/>
      <p><b>Important platform notice.</b> This document is a Dealivra transaction record, not legal advice, title verification, insurance, or an escrow certificate. During the beta, payments use Stripe Sandbox and no real money is transferred. Dealivra does not hold or insure funds.</p>
    </section>

    <footer className="agreement-print-footer">
      <span>Dealivra · Clear terms. Recorded handoff.</span>
      <span>Deal {deal.publicId} · Version {deal.agreementVersion}</span>
      <span className="agreement-print-page">Page </span>
    </footer>
    </article>
  </>;
}

function BuyerInvitePanel({deal}:{deal:Deal}){const [notice,setNotice]=useState('');const link=`${location.origin}/?deal=${deal.publicId}`;const message=`${t('Review agreement')}: ${deal.title} · ${dealPrice(deal)} · ${link}`;const flash=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(''),2200)};const copyText=async(text:string)=>{try{await navigator.clipboard?.writeText(text)}catch{}};const copy=async()=>{await copyText(link);flash('Deal Link copied.')};const sms=async()=>{await copyText(message);flash('Message copied. Paste it into SMS if needed.');window.location.href=/Android/i.test(navigator.userAgent)?`sms:?body=${encodeURIComponent(message)}`:'sms:'};const more=async()=>{try{if(!navigator.share)throw new Error('share-unavailable');await navigator.share({title:`Dealivra · ${deal.title}`,text:message,url:link})}catch(error){if(error instanceof Error&&error.name==='AbortError')return;await copyText(message);flash('Sharing is not available. Message copied.')}};return <section className="buyer-invite no-print"><div className="invite-heading"><Send/><div><p className="eyebrow">{t('Share')}</p><h2>{t('Invite buyer')}</h2><p>{t('Share this Deal Link directly with the intended buyer.')}</p></div></div><div className="invite-actions"><button className="secondary" onClick={copy}><Copy size={16}/>{t('Copy Deal Link')}</button><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a><a href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`${t('Review agreement')}: ${deal.title}`)}`} target="_blank" rel="noreferrer">Telegram</a><a href={`mailto:?subject=${encodeURIComponent(`Dealivra · ${deal.title}`)}&body=${encodeURIComponent(message)}`}>{t('Email')}</a><button className="secondary" onClick={sms}><MessageCircle size={16}/>{t('SMS')}</button><button className="secondary invite-more" onClick={more}><Share2 size={16}/>{t('More apps')}</button></div>{notice&&<div className="notice">{t(notice)}</div>}</section>}

function PublishedDealSuccess({deal,warning,session,acceptanceProtected,onProtectionChanged,onOpen,onDashboard,onCreateAnother}:{deal:Deal;warning:string;session:StoredSession|null;acceptanceProtected:boolean;onProtectionChanged:(enabled:boolean)=>void;onOpen:()=>void;onDashboard:()=>void;onCreateAnother:()=>void}){
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
      await navigator.clipboard.writeText(value);
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
          <small><LockKeyhole/>{t(acceptanceProtected?'Acceptance requires the private buyer code.':'Anyone with this link can view the deal. Share it only with the intended buyer.')}</small>
        </div>
        <section className={`published-access-panel ${acceptanceProtected?'is-protected':''}`} aria-labelledby="published-access-title">
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

function BuyerAccessCodeManager({deal,session,enabled,onChanged}:{deal:Deal;session:StoredSession;enabled:boolean;onChanged:(enabled:boolean)=>void}){
  const [code,setCode]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [copied,setCopied]=useState(false);
  const generate=async()=>{setBusy(true);setMessage('');setCode('');try{const next=await configureBuyerAccessCode(session,deal.id,true);if(!next)throw new Error('Could not update buyer access');setCode(next);onChanged(true)}catch(error){setMessage(error instanceof Error?error.message:'Could not update buyer access')}finally{setBusy(false)}};
  const disable=async()=>{if(!confirm(t('Turn off buyer code protection?')))return;setBusy(true);setMessage('');try{await configureBuyerAccessCode(session,deal.id,false);setCode('');onChanged(false)}catch(error){setMessage(error instanceof Error?error.message:'Could not update buyer access')}finally{setBusy(false)}};
  const copy=async()=>{if(!code)return;await navigator.clipboard?.writeText(code);setCopied(true);window.setTimeout(()=>setCopied(false),1800)};
  return <section className={`buyer-access-manager no-print ${enabled?'enabled':''}`}><div className="buyer-access-heading"><LockKeyhole/><div><p className="eyebrow">{t('Protected acceptance')}</p><h2>{t('Buyer access code')}</h2><span>{t('Require a private code before a buyer can accept this Deal Link.')}</span></div><em>{t(enabled?'Acceptance code required':'Anyone with the Deal Link can accept')}</em></div>{code&&<div className="buyer-access-code"><span>{t('One-time code')}</span><strong>{code}</strong><button className="secondary" onClick={copy}><Copy size={16}/>{t(copied?'Code copied.':'Copy code')}</button><small>{t('Share this code privately with the intended buyer. It is shown only once.')}</small></div>}<div className="buyer-access-actions"><button className="primary" disabled={busy} onClick={generate}>{t(enabled?'Generate new code':'Generate access code')}</button>{enabled&&<button className="secondary danger" disabled={busy} onClick={disable}>{t('Turn off code')}</button>}</div>{message&&<div className="notice">{t(message)}</div>}</section>;
}

function BuyerAccessCodeEntry({value,onChange}:{value:string;onChange:(value:string)=>void}){return <section className="buyer-access-entry no-print"><LockKeyhole/><div><p className="eyebrow">{t('Protected acceptance')}</p><h2>{t('Acceptance code required')}</h2><span>{t('This Deal Link requires the private code from the seller.')}</span><label>{t('Enter 6-digit buyer code')}<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={value} onChange={event=>onChange(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label></div></section>}

function DealExpiry({deal,now}:{deal:Deal;now:number}){if(deal.status!=='published'||!deal.expiresAt)return null;const expired=isDealExpired(deal,now);return <section className={`deal-expiry ${expired?'expired':''}`}><Clock3/><div><p className="eyebrow">{t(expired?'Expired':'Offer active')}</p><h2>{t(expired?'Deal Link expired':'Offer expires')} {expired?'':relativeExpiry(deal.expiresAt,now)}</h2><span>{new Date(deal.expiresAt).toLocaleString(getAppLanguage())} · {t(expired?'This Deal Link can no longer be accepted.':'Buyer must accept before this time.')}</span></div></section>}

function DealRenewalPanel({deal,session,onRenewed}:{deal:Deal;session:StoredSession;onRenewed:(agreementVersion:number,expiresAt:string)=>void}){
  const expired=isDealExpired(deal);const [days,setDays]=useState(7);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [newExpiry,setNewExpiry]=useState('');
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setSaving(true);setMessage('');setNewExpiry('');try{const result=await renewDealLink(session,deal.id,days);onRenewed(result.agreement_version,result.expires_at);setNewExpiry(result.expires_at)}catch{setMessage('Could not renew Deal Link')}finally{setSaving(false)}};
  return <section className={`deal-renewal no-print ${expired?'expired':''}`}><div className="deal-renewal-heading"><CalendarDays/><div><p className="eyebrow">{t('Seller controls')}</p><h2>{t(expired?'Renew expired Deal Link':'Extend Deal Link')}</h2><span>{t('A new expiration date and agreement version will be recorded.')}</span></div></div><form onSubmit={submit}><label>{t('Offer valid for')}<select value={days} onChange={event=>setDays(Number(event.target.value))}><option value={1}>{t('1 day')}</option><option value={3}>{t('3 days')}</option><option value={7}>{t('7 days')}</option><option value={14}>{t('14 days')}</option><option value={30}>{t('30 days')}</option></select></label><button className="primary" disabled={saving}>{t(saving?'Updating…':expired?'Renew link':'Extend offer')}</button></form>{newExpiry&&<div className="deal-renewal-success"><BadgeCheck/>{t('Deal Link extended.')} {t('New expiration')}: {formatDateTime(newExpiry)}</div>}{message&&<div className="notice">{t(message)}</div>}</section>;
}
const riskSignalCopy:Record<string,string>={
  unverified_seller:'Seller identity verification is not complete.',
  new_account:'Seller account was created recently.',
  limited_history:'Seller account has limited history.',
  no_photos:'No item photos were provided.',
  single_photo:'Only one item photo was provided.',
  missing_serial:'No serial or IMEI ending was recorded for this electronic item.',
  payment_language:'The description contains language associated with higher-risk payment requests.',
  community_reports:'This deal has unresolved community reports.',
  no_flags:'No elevated risk signals were found in the available data.'
};

function DealRiskCheck({deal}:{deal:Deal}){
  const [assessment,setAssessment]=useState<RiskAssessment|null>(null);const [loading,setLoading]=useState(true);const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{let current=true;setLoading(true);setUnavailable(false);getDealRiskAssessment(deal.publicId).then(result=>{if(current)setAssessment(result)}).catch(()=>{if(current)setUnavailable(true)}).finally(()=>{if(current)setLoading(false)});return()=>{current=false}},[deal.publicId]);
  if(!isSupabaseConfigured||unavailable)return null;
  if(loading)return <section className="risk-check loading"><ShieldCheck/><span>{t('Checking visible risk signals…')}</span></section>;
  if(!assessment)return null;
  const levelTitle=assessment.risk_level==='high'?'High risk signals':assessment.risk_level==='medium'?'Medium risk signals':'Low risk signals';
  return <section className={`risk-check risk-${assessment.risk_level}`}><div className="risk-heading"><ShieldAlert/><div><p className="eyebrow">{t('Automated Risk Check')}</p><h2>{t(levelTitle)}</h2></div><div className="risk-score"><strong>{assessment.risk_score}</strong><small>/100</small></div></div><div className="risk-meter" aria-label={`${t('Risk score')} ${assessment.risk_score} ${t('out of 100')}`}><span style={{width:`${assessment.risk_score}%`}}/></div><ul>{assessment.signals.map(signal=><li key={signal}><span>{signal==='no_flags'?<Check size={17}/>:<ShieldAlert size={17}/>}</span>{t(riskSignalCopy[signal]||signal)}</li>)}</ul><div className="risk-disclaimer"><b>{t('Risk signals, not a verdict')}</b><span>{t('This automated check uses available Dealivra data and cannot guarantee that a deal or person is safe.')}</span></div></section>;
}

function DealParticipantsCard({deal,session,onLoaded}:{deal:Deal;session:StoredSession;onLoaded:(participants:DealParticipants)=>void}){
  const [participants,setParticipants]=useState<DealParticipants|null>(null);
  useEffect(()=>{let current=true;setParticipants(null);getDealParticipants(session,deal.id).then(record=>{if(!current||!record)return;setParticipants(record);onLoaded(record)}).catch(()=>{});return()=>{current=false}},[deal.id,deal.status,session.accessToken]);
  if(!participants)return null;
  const verification=(status:DealParticipants['seller_verification'])=>status==='verified'?'Identity verified':status==='pending'?'Verification pending':status==='failed'?'Verification failed':'Not verified';
  const card=(role:'Seller'|'Buyer',name:string,status:DealParticipants['seller_verification'])=><article className="participant-card"><span className="participant-avatar">{name.slice(0,1)||'?'}</span><div><span className="participant-role">{t(role)}{participants.viewer_role===role.toLowerCase()?` · ${t('You')}`:''}</span><strong>{name}</strong><span className={`participant-verification ${status}`}><BadgeCheck size={16}/>{t(verification(status))}</span></div></article>;
  return <section className="deal-participants">
    <div className="participant-heading">
      <span className="workflow-icon"><ShieldCheck/></span>
      <div><p className="eyebrow">{t('Verified parties')}</p><h2>{t('Deal participants')}</h2></div>
      <span className="participant-private"><LockKeyhole size={14}/>{t('Private')}</span>
    </div>
    <div className="participant-grid">{card('Seller',participants.seller_name,participants.seller_verification)}{card('Buyer',participants.buyer_name,participants.buyer_verification)}</div>
    <div className="participant-meta">
      {participants.accepted_at&&<span><Clock3 size={15}/>{t('Accepted on')} {formatDateTime(participants.accepted_at)}</span>}
      <span><ShieldCheck size={15}/>{t('Identity details stay private')}</span>
    </div>
  </section>;
}

function DealActionPlanCard({deal,session,onSync}:{deal:Deal;session:StoredSession;onSync:(plan:DealActionPlan)=>void}){
  const [plan,setPlan]=useState<DealActionPlan|null>(null);
  useEffect(()=>{let current=true;const load=()=>getDealActionPlan(session,deal.id).then(record=>{if(!current||!record)return;setPlan(record);onSync(record)}).catch(()=>{});void load();const timer=window.setInterval(load,12_000);return()=>{current=false;window.clearInterval(timer)}},[deal.id,deal.status,deal.viewerRole,session.accessToken]);
  if(!plan)return null;
  const completed=plan.deal_status==='completed';
  const handoffReady=deal.deliveryMethod==='Meet in person'?plan.meeting_status==='confirmed':Boolean(plan.shipment_status);
  const steps=[
    {label:'Terms accepted',done:true,icon:FileCheck2},
    {label:'Payment acknowledged',done:plan.payment_received||completed,icon:CreditCard},
    {label:deal.deliveryMethod==='Meet in person'?'Meeting confirmed':'Shipped',done:handoffReady,icon:deal.deliveryMethod==='Meet in person'?MapPinned:Truck},
    {label:'Buyer inspection recorded',done:plan.inspection_recorded,icon:ScanSearch},
    {label:'Deal completed',done:completed,icon:CircleCheckBig},
    {label:'Rating submitted',done:plan.rating_submitted,icon:Star}
  ];
  const currentIndex=steps.findIndex(step=>!step.done);const doneCount=steps.filter(step=>step.done).length;
  return <section id="deal-action-plan" className="deal-action-plan no-print"><div className="action-plan-heading"><div className="action-plan-title"><span className="workflow-icon"><Route/></span><div><p className="eyebrow">{t('Live deal status')}</p><h2>{t('Deal progress')}</h2><p>{t('Milestones update automatically from the shared record.')}</p></div></div><div className="action-plan-score" aria-label={`${doneCount} ${t('of')} ${steps.length} ${t('steps complete')}`}><strong>{doneCount}</strong><span>/ {steps.length}</span></div></div><div className="action-plan-progress" role="progressbar" aria-label={t('Deal progress')} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}><span style={{width:`${doneCount/steps.length*100}%`}}/></div><ol className="action-plan-steps">{steps.map((step,index)=>{const Icon=step.icon;const state=step.done?'done':index===currentIndex?'current':'upcoming';return <li key={step.label} className={state} aria-current={state==='current'?'step':undefined}><span className="action-plan-step-icon">{step.done?<Check size={18}/>:<Icon size={18}/>}</span><span><b>{t(step.label)}</b><small>{t(step.done?'Done':index===currentIndex?'In progress':'Upcoming')}</small></span></li>})}</ol><p className="action-plan-note"><ShieldCheck size={16}/>{t('Progress updates automatically from the protected deal record.')}</p></section>;
}

function SellerTrustProfile({deal}:{deal:Deal}){
  const [profile,setProfile]=useState<PublicTrustProfile|null>(null);const [loading,setLoading]=useState(true);const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{let current=true;setLoading(true);setUnavailable(false);getPublicSellerTrustProfile(deal.publicId).then(result=>{if(current)setProfile(result)}).catch(()=>{if(current)setUnavailable(true)}).finally(()=>{if(current)setLoading(false)});return()=>{current=false}},[deal.publicId]);
  if(!isSupabaseConfigured||unavailable)return null;
  if(loading)return <section className="seller-trust loading"><BadgeCheck/><span>{t('Loading seller trust profile…')}</span></section>;
  if(!profile)return null;
  return <section className="seller-trust"><div className="seller-trust-heading"><span className="seller-avatar">{profile.display_name.slice(0,1).toUpperCase()}</span><div><p className="eyebrow">{t('Seller Trust Profile')}</p><h2>{profile.display_name}</h2><span className={`seller-verification ${profile.verification_status==='verified'?'verified':''}`}><BadgeCheck size={16}/>{t(profile.verification_status==='verified'?'Identity verified':'Verification pending')}</span></div></div><div className="seller-trust-stats"><article><strong>{profile.completed_sales}</strong><span>{t('Completed sales')}</span></article><article><strong>{profile.average_rating??'—'} <Star size={18}/></strong><span>{profile.rating_count} {t('ratings')}</span></article><article><strong>{new Date(profile.member_since).toLocaleDateString(getAppLanguage(),{month:'short',year:'numeric'})}</strong><span>{t('Member since')}</span></article></div><p className="seller-trust-note"><LockKeyhole size={15}/>{t('Public profile excludes contact and identity details.')}</p></section>;
}

function AgreementExpiredNotice(){return <div className="expired-agreement"><Clock3/><div><b>{t('Deal Link expired')}</b><span>{t('This Deal Link can no longer be accepted.')}</span></div></div>}

function AgreementFingerprint({deal}:{deal:Deal}){
  const [fingerprint,setFingerprint]=useState('');const [copied,setCopied]=useState(false);
  useEffect(()=>{let current=true;const load=async()=>{try{const versions=await getPublicAgreementHistory(deal.publicId);const saved=versions.find(item=>item.is_current)||versions.find(item=>item.version===deal.agreementVersion);if(saved?.content_hash){if(current)setFingerprint(saved.content_hash.toUpperCase());return}}catch{}try{const local=await createAgreementFingerprint(deal);if(current)setFingerprint(local)}catch{if(current)setFingerprint('—')}};load();return()=>{current=false}},[deal.publicId,deal.agreementVersion,deal.title,deal.description,deal.priceCents,deal.currency,deal.condition,deal.serialNumber,deal.deliveryMethod,deal.expiresAt]);
  const copy=async()=>{if(!fingerprint||fingerprint==='—')return;await navigator.clipboard?.writeText(fingerprint);setCopied(true);window.setTimeout(()=>setCopied(false),1800)};
  return <section className="agreement-fingerprint"><div className="fingerprint-heading"><Fingerprint/><div><p className="eyebrow">SHA-256</p><h2>{t('Agreement fingerprint')}</h2><span>{t('Version')} {deal.agreementVersion}</span></div></div><code>{fingerprint||'SHA-256…'}</code><div className="fingerprint-footer"><p><ShieldCheck/>{t('This code changes when agreement details change. It helps compare copies but is not a qualified electronic signature.')}</p><button className="secondary no-print" onClick={copy} disabled={!fingerprint||fingerprint==='—'}><Copy size={16}/>{t(copied?'Fingerprint copied.':'Copy fingerprint')}</button></div></section>
}

function AgreementHistory({deal}:{deal:Deal}){
  const [versions,setVersions]=useState<AgreementHistoryVersion[]>([]);const [loaded,setLoaded]=useState(false);
  useEffect(()=>{let current=true;setLoaded(false);getPublicAgreementHistory(deal.publicId).then(items=>{if(current){setVersions(items);setLoaded(true)}}).catch(()=>{if(current){setVersions([]);setLoaded(true)}});return()=>{current=false}},[deal.publicId,deal.agreementVersion]);
  if(!isSupabaseConfigured||!loaded||!versions.length)return null;
  const acceptanceLabel=(count:number)=>count>=2?'Accepted by both parties':count===1?'Accepted by one party':'No recorded acceptance';
  return <section className="agreement-history"><div className="agreement-history-heading"><FileSignature/><div><p className="eyebrow">{t('Published versions')}</p><h2>{t('Agreement history')}</h2><span>{t('Privacy-safe record of published agreement changes.')}</span></div></div><div className="agreement-history-list">{versions.map(item=>{const accepted=Number(item.acceptance_count)||0;return <details key={item.version} open={item.is_current}><summary><span className="agreement-history-version"><strong>{t('Version')} {item.version}</strong>{item.is_current&&<em>{t('Current version')}</em>}</span><time>{formatDateTime(item.created_at)}</time></summary><div className="agreement-history-body"><div className="agreement-history-facts"><div><span>{t('Price')}</span><b>{formatMoney(Number(item.price_cents),item.currency,getAppLanguage())}</b></div><div><span>{t('Condition')}</span><b>{t(item.condition)}</b></div><div><span>{t('Handoff')}</span><b>{t(item.delivery_method)}</b></div></div><p className={`agreement-history-acceptance ${accepted?'':'pending'}`}>{accepted?<BadgeCheck size={18}/>:<Clock3 size={18}/>} {t(acceptanceLabel(accepted))}</p><span className="eyebrow">{t('Agreement code')}</span><code className="agreement-history-code">{item.content_hash.toUpperCase()}</code></div></details>})}</div><p className="agreement-history-note"><LockKeyhole size={16}/>{t('This history does not reveal names, contact details, or signatures.')}</p></section>;
}

function AgreementVerifier(){
  const [dealId,setDealId]=useState('');
  const [code,setCode]=useState('');
  const [result,setResult]=useState<AgreementVerificationResult|false|null>(null);
  const [message,setMessage]=useState('');
  const [checking,setChecking]=useState(false);
  const cleanId=dealId.replace(/^deal\s+/i,'').trim();
  const cleanCode=code.replace(/\s/g,'').trim();
  const validationVisible=message==='Review the highlighted fields.';
  const dealIdInvalid=validationVisible&&cleanId.length<4;
  const codeInvalid=validationVisible&&!/^[a-f0-9]{64}$/i.test(cleanCode);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    setMessage('');
    setResult(null);
    if(cleanId.length<4||!/^[a-f0-9]{64}$/i.test(cleanCode)){
      setMessage('Review the highlighted fields.');
      return;
    }
    setChecking(true);
    try{
      const match=await verifyAgreementRecord(cleanId,cleanCode);
      setResult(match||false);
    }catch(error){
      setMessage(error instanceof Error?error.message:'Agreement verification is unavailable');
    }finally{
      setChecking(false);
    }
  };
  return <section className="agreement-verifier">
    <div className="agreement-verifier-copy"><Fingerprint/><div><p className="eyebrow">{t('Independent check')}</p><h2>{t('Check agreement code')}</h2><p>{t('Compare a saved Dealivra agreement without signing in.')}</p></div></div>
    <form onSubmit={submit} noValidate>
      <label>{t('Deal ID')}
        <input required minLength={4} maxLength={30} autoCapitalize="characters" spellCheck={false} value={dealId} onChange={event=>setDealId(event.target.value.toUpperCase())} placeholder="1089BDF0" aria-invalid={dealIdInvalid} aria-describedby={dealIdInvalid?'deal-id-error':undefined}/>
        {dealIdInvalid&&<small id="deal-id-error" className="agreement-verifier-field-error">{t('Enter at least 4 characters from the Deal ID.')}</small>}
      </label>
      <label>{t('Agreement code')}
        <input className="agreement-verifier-code" required minLength={64} maxLength={80} autoCapitalize="none" spellCheck={false} value={code} onChange={event=>setCode(event.target.value)} placeholder="SHA-256" aria-invalid={codeInvalid} aria-describedby={codeInvalid?'agreement-code-error':undefined}/>
        {codeInvalid&&<small id="agreement-code-error" className="agreement-verifier-field-error">{t('Enter the full 64-character SHA-256 code.')}</small>}
      </label>
      <button className="primary" disabled={checking}>{t(checking?'Checking…':'Check code')}</button>
      {result&&<div className={`agreement-verifier-result ${result.is_current?'success':'warning'}`}>{result.is_current?<BadgeCheck/>:<Clock3/>}<div><b>{t(result.is_current?'Match confirmed':'Matches a previous version')}</b><span>{t('Version')} {result.version} · {formatDateTime(result.created_at)}</span><a href={`/?deal=${encodeURIComponent(result.public_id)}`}>{t('Open Deal Link')} →</a></div></div>}
      {result===false&&<div className="agreement-verifier-result error" role="alert"><X/><div><b>{t('No match found')}</b></div></div>}
      {message&&<div className="agreement-verifier-result error" role="alert"><ShieldAlert/><div><b>{t(message)}</b></div></div>}
      <small className="agreement-verifier-note"><LockKeyhole size={15}/>{t('A match confirms only the stored agreement record, not the item or payment.')}</small>
    </form>
  </section>;
}
async function copyTextToClipboard(value:string){
  if(navigator.clipboard?.writeText){
    try{
      await navigator.clipboard.writeText(value);
      return;
    }catch{
      // Fall through to the browser selection fallback.
    }
  }
  const field=document.createElement('textarea');
  field.value=value;
  field.setAttribute('readonly','');
  field.style.position='fixed';
  field.style.opacity='0';
  field.style.pointerEvents='none';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0,value.length);
  const copied=document.execCommand('copy');
  field.remove();
  if(!copied)throw new Error('copy-failed');
}

function DealCopyLinkButton({deal}:{deal:Deal}){
  const [state,setState]=useState<'idle'|'copying'|'copied'|'error'>('idle');
  const resetTimer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(resetTimer.current),[]);
  const copy=async()=>{
    setState('copying');
    try{
      await copyTextToClipboard(`${location.origin}/?deal=${deal.publicId}`);
      setState('copied');
    }catch{
      setState('error');
    }
    window.clearTimeout(resetTimer.current);
    resetTimer.current=window.setTimeout(()=>setState('idle'),2600);
  };
  const label=state==='copying'?'Copying…':state==='copied'?'Deal Link copied':state==='error'?'Try copying again':'Copy Deal Link';
  return <div className={`copy-deal-link-action ${state}`}>
    <button type="button" className="copy no-print" disabled={state==='copying'} onClick={()=>void copy()}>
      {state==='copied'?<Check size={17}/>:<Copy size={17}/>}
      {t(label)}
    </button>
    <span className="sr-only" role="status" aria-live="polite">
      {state==='copied'?t('Deal Link copied to clipboard.'):state==='error'?t('Could not copy the Deal Link. Try again or copy the browser address.'):''}
    </span>
  </div>;
}

function DealQrCode({deal}:{deal:Deal}){const [open,setOpen]=useState(false);const [image,setImage]=useState('');const url=`${location.origin}/?deal=${deal.publicId}`;useEffect(()=>{if(!open||image)return;let current=true;void import('qrcode').then(({default:QRCode})=>QRCode.toDataURL(url,{width:360,margin:2,errorCorrectionLevel:'M',color:{dark:'#15221d',light:'#ffffff'}})).then(result=>{if(current)setImage(result)}).catch(()=>{if(current)setImage('')});return()=>{current=false}},[open,image,url]);return <div className="deal-qr"><button className="copy no-print" onClick={()=>setOpen(value=>!value)}><QrCode size={17}/>{t(open?'Hide QR Code':'Show QR Code')}</button>{open&&<div className="qr-panel no-print">{image?<><img src={image} alt={`${t('QR code for deal')} ${deal.publicId}`}/><p>{t('Scan to open this Deal Link on another phone.')}</p><a className="secondary" href={image} download={`Dealivra-${deal.publicId}-QR.png`}>{t('Download QR')}</a></>:<p>{t('Preparing QR Code…')}</p>}</div>}{image&&<div className="print-qr"><img src={image} alt={t('Deal Link QR code')}/><div><b>{t('Live Deal Link')}</b><small>{t('Scan to open the current Dealivra record.')}</small><span>{deal.publicId}</span></div></div>}</div>}

function DealChat({deal,session}:{deal:Deal;session:StoredSession}){const [messages,setMessages]=useState<DealMessage[]>([]);const [body,setBody]=useState('');const [error,setError]=useState('');const [open,setOpen]=useState(false);const [unread,setUnread]=useState(0);const openRef=useRef(false);const loadedRef=useRef(false);const lastSeenRef=useRef<string|undefined>(undefined);const setChatOpen=(value:boolean)=>{openRef.current=value;setOpen(value);if(value){setUnread(0);const latest=messages[messages.length-1]?.created_at;if(latest)lastSeenRef.current=latest}};const load=async()=>{try{const next=await getDealMessages(session,deal.id);setMessages(next);const latest=next[next.length-1]?.created_at;if(!loadedRef.current){loadedRef.current=true;lastSeenRef.current=latest}else if(openRef.current){setUnread(0);if(latest)lastSeenRef.current=latest}else{const seen=lastSeenRef.current?new Date(lastSeenRef.current).getTime():0;setUnread(next.filter(message=>!message.is_mine&&new Date(message.created_at).getTime()>seen).length)}}catch(e){setError(e instanceof Error?e.message:'Could not load messages')}};useEffect(()=>{loadedRef.current=false;lastSeenRef.current=undefined;setUnread(0)},[deal.id,session]);useEffect(()=>{if(!open)return;void load();const timer=setInterval(()=>void load(),10000);return()=>clearInterval(timer)},[open,deal.id,session]);const send=async(e:React.FormEvent)=>{e.preventDefault();if(!body.trim())return;setError('');try{await sendDealMessage(session,deal.id,body);setBody('');await load()}catch(e){setError(e instanceof Error?e.message:'Could not send message')}};return <div className={`deal-chat-float ${open?'open':''}`} onMouseEnter={()=>setChatOpen(true)} onMouseLeave={()=>setChatOpen(false)}><button type="button" className="deal-chat-launcher" aria-expanded={open} aria-label={t('Deal chat')} onClick={()=>setChatOpen(!open)}><MessageCircle size={19}/><span>{t('Deal chat')}</span>{unread>0&&<b aria-label={`${unread} ${t('Unread')}`}>{unread>9?'9+':unread}</b>}</button>{open&&<section className="deal-chat deal-chat-panel no-print"><div className="chat-heading"><MessageCircle/><div><p className="eyebrow">{t('Private conversation')}</p><h2>{t('Deal chat')}</h2></div><button type="button" className="chat-close" aria-label={t('Close chat')} onClick={()=>setChatOpen(false)}>×</button></div><div className="chat-messages">{messages.length?messages.map(message=><article key={message.id} className={message.is_mine?'mine':''}><small>{message.is_mine?t('You'):message.sender_name}</small><p>{message.body}</p><time>{formatDateTime(message.created_at)}</time></article>):<div className="chat-empty">{t('No messages yet. Keep important deal details here.')}</div>}</div>{error&&<div className="notice">{t(error)}</div>}<form onSubmit={send}><textarea required maxLength={1000} value={body} onChange={e=>setBody(e.target.value)} placeholder={t('Write a message about this deal…')}/><button className="primary" disabled={!body.trim()}><Send size={17}/>{t('Send')}</button></form><small className="chat-note"><LockKeyhole/> {t('Never share passwords, payment codes, or full financial information.')}</small></section>}</div>}

function DealInquiries({deal,session,onSignIn}:{deal:Deal;session:StoredSession|null;onSignIn:()=>void}){
  const [items,setItems]=useState<DealInquiry[]>([]);
  const [question,setQuestion]=useState('');
  const [replies,setReplies]=useState<Record<string,string>>({});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState('');
  const [sellerAccess,setSellerAccess]=useState(deal.viewerRole==='seller');
  const isSeller=sellerAccess;
  const expired=isDealExpired(deal);
  const load=async()=>{if(!session)return;try{setItems(await getDealInquiries(session,deal.id))}catch{setMessage('Could not load questions')}};
  useEffect(()=>{setSellerAccess(deal.viewerRole==='seller');if(session)void isCurrentUserDealSeller(session,deal.id).then(setSellerAccess)},[deal.id,deal.viewerRole,session?.accessToken]);
  useEffect(()=>{if(!session){setItems([]);return}void load();const timer=window.setInterval(()=>void load(),15_000);return()=>window.clearInterval(timer)},[deal.id,session?.accessToken]);
  const ask=async(event:React.FormEvent)=>{event.preventDefault();if(!session||question.trim().length<5)return;setBusy('ask');setMessage('');try{await askDealQuestion(session,deal.publicId,question);setQuestion('');setMessage('Question sent.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Could not send question')}finally{setBusy('')}};
  const reply=async(event:React.FormEvent,inquiry:DealInquiry)=>{event.preventDefault();const text=replies[inquiry.id]?.trim()||'';if(!session||text.length<2)return;setBusy(inquiry.id);setMessage('');try{await replyDealInquiry(session,inquiry.id,text);setReplies(current=>({...current,[inquiry.id]:''}));setMessage('Reply sent.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Could not send reply')}finally{setBusy('')}};
  return <section className="deal-inquiries no-print"><div className="inquiry-heading"><MessageCircle/><div><p className="eyebrow">{t('Questions before accepting')}</p><h2>{t(isSeller?'Buyer questions':'Ask the seller')}</h2><span>{t('Keep important item questions inside the Dealivra record.')}</span></div></div>{!session?<div className="inquiry-signin"><span>{t('Sign in to ask seller')}</span><button className="primary" onClick={onSignIn}>{t('Sign in')}</button></div>:!isSeller&&!expired&&<form className="inquiry-form" onSubmit={ask}><label>{t('Your question')}<textarea required minLength={5} maxLength={1000} value={question} onChange={event=>setQuestion(event.target.value)}/></label><button className="primary" disabled={busy==='ask'}><Send size={17}/>{t('Ask question')}</button></form>}{session&&items.length===0&&<div className="inquiry-empty"><MessageCircle size={17}/>{t('No questions yet.')}</div>}<div className="inquiry-list">{items.map(inquiry=><article className="inquiry-card" key={inquiry.id}><div className="inquiry-question"><span className="inquiry-avatar">{inquiry.buyer_name.slice(0,1).toUpperCase()}</span><div><b>{isSeller?inquiry.buyer_name:t('Your question')}</b><time>{formatDateTime(inquiry.created_at)}</time></div><p>{inquiry.body}</p></div>{inquiry.seller_reply?<div className="inquiry-answer"><b>{t('Seller reply')}</b><p>{inquiry.seller_reply}</p>{inquiry.replied_at&&<time>{formatDateTime(inquiry.replied_at)}</time>}</div>:isSeller?<form className="inquiry-reply-form" onSubmit={event=>reply(event,inquiry)}><label>{t('Reply')}<textarea required minLength={2} maxLength={1000} value={replies[inquiry.id]||''} onChange={event=>setReplies(current=>({...current,[inquiry.id]:event.target.value}))}/></label><button className="primary" disabled={busy===inquiry.id}><Send size={16}/>{t('Send reply')}</button></form>:<div className="inquiry-waiting"><Clock3 size={15}/>{t('Waiting for seller reply.')}</div>}</article>)}</div>{message&&<div className="notice">{t(message)}</div>}<p className="inquiry-privacy"><LockKeyhole size={14}/>{t('Only the questioner and seller can see each conversation.')}</p></section>;
}

function OfferPanel({deal,session,onAccepted}:{deal:Deal;session:StoredSession;onAccepted:(amount:number)=>void}){const [offers,setOffers]=useState<DealOffer[]>([]);const [amount,setAmount]=useState('');const [name,setName]=useState(session.user.displayName);const [message,setMessage]=useState('');const load=()=>getDealOffers(session,deal.id).then(setOffers).catch(()=>{});useEffect(()=>{load()},[deal.id,session]);const submit=async(e:React.FormEvent)=>{e.preventDefault();setMessage('');try{await makeDealOffer(session,deal.publicId,toMinorUnits(amount,deal.currency),name);setAmount('');setMessage('Your offer was sent to the seller.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Could not send offer')}};const respond=async(offer:DealOffer,accept:boolean)=>{setMessage('');try{await respondToOffer(session,offer.id,accept);setMessage(accept?'Offer accepted. The agreement price has been updated.':'Offer declined.');await load();if(accept)onAccepted(offer.amount_cents)}catch(error){setMessage(error instanceof Error?error.message:'Could not respond')}};return <section className="offer-panel no-print"><div className="offer-heading"><BadgeDollarSign/><div><p className="eyebrow">{t('Price negotiation')}</p><h2>{t(deal.viewerRole==='seller'?'Buyer offers':'Make an offer')}</h2></div></div>{deal.viewerRole!=='seller'&&<form onSubmit={submit}><label>{t('Your offer')} ({deal.currency})<input required type="number" min={currencyStep(deal.currency)} step={currencyStep(deal.currency)} value={amount} onChange={e=>setAmount(e.target.value)} placeholder={amountForInput(deal.priceCents,deal.currency)}/></label><label>{t('Your full name')}<input required minLength={2} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary">{t('Send offer')}</button></form>}<div className="offer-list">{offers.map(offer=><article key={offer.id}><div><strong>{formatMoney(offer.amount_cents,deal.currency,getAppLanguage())}</strong><span>{offer.is_mine?t('Your offer'):offer.buyer_name} · {formatDate(offer.created_at)}</span></div><em className={offer.status}>{t(offer.status)}</em>{deal.viewerRole==='seller'&&offer.status==='pending'&&<div><button className="secondary" onClick={()=>respond(offer,false)}>{t('Decline')}</button><button className="primary" onClick={()=>respond(offer,true)}>{t('Accept')}</button></div>}</article>)}</div>{message&&<div className="notice">{t(message)}</div>}<small className="offer-note">{t('An accepted offer creates a new agreement version at the accepted price.')}</small></section>}

const paymentMethodLabels:Record<DealPaymentMethod,string>={cash_at_handoff:'Cash at handoff',bank_transfer:'Bank transfer',payment_app:'Payment app',card_invoice:'Card invoice',other:'Other agreed method'};
const protectedPaymentLabels:Record<ProtectedPaymentState,string>={not_started:'Not started',checkout_created:'Checkout ready',processing:'Payment processing',funds_secured:'Payment confirmed',release_pending:'Release in progress',released:'Released to seller',failed:'Payment failed',expired:'Checkout expired',cancelled:'Payment cancelled',refund_pending:'Refund in progress',refunded:'Refunded',disputed:'Payment disputed',release_failed:'Release failed'};
const escapePaymentReceiptHtml=(value:string|number)=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]||character));
function printProtectedPaymentReceipt(deal:Deal,payment:ProtectedPaymentStatus){
  const popup=window.open('','_blank','width=900,height=780');
  if(!popup)return false;
  popup.opener=null;
  const money=(amount:number)=>formatMoney(amount,payment.currency,getAppLanguage());
  const paid=Boolean(payment.paid_at);
  const receiptTitle=t(paid?'Payment receipt':'Payment breakdown');
  const paidAt=payment.paid_at?formatDateTime(payment.paid_at):t('Pending');
  const finalEvent=payment.refunded_at
    ? [t('Refunded at'),formatDateTime(payment.refunded_at)]
    : payment.disputed_at
      ? [t('Disputed at'),formatDateTime(payment.disputed_at)]
      : [t('Released at'),payment.released_at?formatDateTime(payment.released_at):t('Not released yet')];
  const rows=[
    [t('Deal reference'),deal.publicId],
    [t('Item amount'),money(payment.item_amount_cents)],
    [t('Dealivra service fee'),money(payment.platform_fee_cents)],
    [t('Seller payout'),money(payment.seller_amount_cents)],
    [t('Payment status'),t(protectedPaymentLabels[payment.status])],
    [t('Paid at'),paidAt],
    ...(payment.checkout_expires_at&&!paid?[[t('Checkout expires at'),formatDateTime(payment.checkout_expires_at)]]:[]),
    finalEvent
  ];
  const language=getAppLanguage();
  const direction=language==='ar'||language==='he'?'rtl':'ltr';
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="${escapePaymentReceiptHtml(language)}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapePaymentReceiptHtml(receiptTitle)} · ${escapePaymentReceiptHtml(deal.publicId)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f4f7f5;color:#14251c;font-family:Inter,Arial,sans-serif}.sheet{width:min(820px,calc(100% - 32px));margin:32px auto;padding:38px;border:1px solid #d5e0d9;border-radius:24px;background:#fff}.brand{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:22px;border-bottom:2px solid #347653}.brand strong{font-size:1.45rem}.brand span{color:#347653;font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:30px 0 7px;font-size:2rem}.reference{margin:0 0 26px;color:#66746c}.rows{overflow:hidden;border:1px solid #d8e2dc;border-radius:16px}.row{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(0,1.2fr);gap:20px;padding:15px 18px;border-bottom:1px solid #e2e8e4}.row:last-child{border-bottom:0}.row span{color:#68766e;font-size:.88rem}.row strong{text-align:end;overflow-wrap:anywhere}.row.total{background:#edf6f0;color:#245f40}.note{margin:22px 0 0;padding:16px;border-radius:14px;background:#f5f7f5;color:#5f6d65;font-size:.82rem;line-height:1.55}.legal{margin:12px 0 0;color:#78837d;font-size:.75rem;line-height:1.5}@media(max-width:600px){.sheet{margin:0;width:100%;padding:24px;border:0;border-radius:0}.row{grid-template-columns:1fr;gap:5px}.row strong{text-align:start}}@media print{body{background:#fff}.sheet{width:100%;margin:0;border:0;box-shadow:none} @page{size:auto;margin:14mm}}
  </style></head><body><main class="sheet"><header class="brand"><strong>Dealivra</strong><span>${escapePaymentReceiptHtml(t('Transparent fee record'))}</span></header><h1>${escapePaymentReceiptHtml(receiptTitle)}</h1>${paid?'':`<p class="note"><strong>${escapePaymentReceiptHtml(t('Not paid'))}:</strong> ${escapePaymentReceiptHtml(t('This checkout has not been paid yet.'))}</p>`}<p class="reference">${escapePaymentReceiptHtml(t('Deal reference'))}: <strong>${escapePaymentReceiptHtml(deal.publicId)}</strong></p><section class="rows">${rows.map(([label,value],index)=>`<div class="row${index===3?' total':''}"><span>${escapePaymentReceiptHtml(label)}</span><strong>${escapePaymentReceiptHtml(value)}</strong></div>`).join('')}</section><p class="note">${escapePaymentReceiptHtml(t(payment.status==='released'?'Service fee earned after seller payout':'Service fee allocated at checkout'))}. ${escapePaymentReceiptHtml(t('Stripe processing fees are separate and are not included in the Dealivra service fee.'))}</p><p class="legal">${escapePaymentReceiptHtml(t('This receipt records the Dealivra payment status. It is not a bank statement or legal escrow certificate.'))}</p></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));<\/script></body></html>`);
  popup.document.close();
  return true;
}
function ProtectedPaymentPanel({deal,session,onChanged}:{deal:Deal;session:StoredSession;onChanged:(ready:boolean)=>void}){
  const [payment,setPayment]=useState<ProtectedPaymentStatus|null>(null);const [connect,setConnect]=useState<StripeConnectStatus|null>(null);const [plan,setPlan]=useState<DealActionPlan|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState<'connect'|'checkout'|'release'|''>('');const [loaded,setLoaded]=useState(false);
  const load=async()=>{try{const [next,account]=await Promise.all([getProtectedPaymentStatus(session,deal.id),getStripeConnectStatus(session)]);const actionPlan=await getDealActionPlan(session,deal.id).catch(()=>null);setPayment(next);setConnect(account);setPlan(actionPlan);onChanged(['funds_secured','release_pending','released'].includes(next.status))}catch(error){setMessage(error instanceof Error?error.message:'Could not load protected payment');onChanged(false)}finally{setLoaded(true)}};
  useEffect(()=>{setLoaded(false);void load();const timer=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(timer)},[deal.id,session.accessToken]);
  const startOnboarding=async()=>{setBusy('connect');setMessage('');try{const result=await startStripeConnectOnboarding(session,deal.publicId);window.location.assign(result.url)}catch(error){setMessage(error instanceof Error?error.message:'Could not open Stripe onboarding')}finally{setBusy('')}};
  const checkout=async()=>{setBusy('checkout');setMessage('');try{const result=await createProtectedCheckout(session,deal.id);window.location.assign(result.url)}catch(error){setMessage(error instanceof Error?error.message:'Could not open secure checkout');setBusy('')}};
  const release=async()=>{if(!window.confirm(t('Release the secured funds to the seller after confirming delivery?')))return;setBusy('release');setMessage('');try{await releaseProtectedPayment(session,deal.id);setMessage('Funds released to the seller.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Could not release payment')}finally{setBusy('')}};
  if(!loaded)return null;
  const state=payment?.status||'not_started';
  const ready=Boolean(payment?.seller_payouts_ready||connect?.ready);
  const secured=['funds_secured','release_pending','released'].includes(state);
  const terminal=['failed','expired','cancelled','refunded','disputed','release_failed'].includes(state);
  const released=state==='released';
  const shipped=deal.deliveryMethod==='Meet in person'?plan?.meeting_status==='confirmed':Boolean(plan?.shipment_status);
  const tracking=deal.deliveryMethod==='Meet in person'?Boolean(plan?.inspection_recorded):plan?.shipment_status==='delivered'||Boolean(plan?.inspection_recorded);
  const buyerConfirmed=deal.status==='completed'||plan?.deal_status==='completed';
  const paymentMilestones=[
    {label:'Payment',detail:payment?.paid_at?formatDateTime(payment.paid_at):t(protectedPaymentLabels[state]),done:secured},
    {label:deal.deliveryMethod==='Meet in person'?'Handoff':'Delivery',detail:shipped?t('Recorded'):t('Next'),done:shipped},
    {label:'Buyer approval',detail:buyerConfirmed?t('Confirmed'):t('Waiting'),done:buyerConfirmed},
    {label:'Seller payout',detail:released?t('Released'):t('Pending'),done:released},
  ];
  const paymentFlow=[
    {label:'Buyer pays',detail:state==='not_started'?t('Waiting to start'):t('Checkout started'),done:secured},
    {label:'Stripe Checkout',detail:state==='not_started'?t('Not started'):t('Card payment'),done:state!=='not_started'},
    {label:'Payment confirmed',detail:payment?.paid_at?formatDateTime(payment.paid_at):t('Waiting for Stripe'),done:secured},
    {label:deal.deliveryMethod==='Meet in person'?'Seller meets buyer':'Seller ships',detail:shipped?t('Recorded'):t('Waiting for next step'),done:shipped},
    {label:deal.deliveryMethod==='Meet in person'?'Handoff verification':'Tracking verification',detail:tracking?t('Recorded'):t('Waiting for confirmation'),done:tracking},
    {label:'Buyer confirmation',detail:buyerConfirmed?t('Deal completed'):t('Waiting for buyer'),done:buyerConfirmed},
    {label:'Stripe releases funds',detail:released?t('Transfer created'):t('After confirmation'),done:released},
    {label:'Seller paid',detail:released?t('Transfer complete'):t('Pending release'),done:released},
    {label:'Dealivra commission',detail:payment?.platform_fee_cents?formatMoney(Number(payment.platform_fee_cents),payment.currency,getAppLanguage()):t('Configured at checkout'),done:released},
  ];
  return <section className="payment-status no-print" id="payment-status-panel">
    <div className="payment-status-heading">
      <span className="workflow-icon"><BadgeDollarSign/></span>
      <div><p className="eyebrow">{t('Stripe payment')}</p><h2>{t('Payment status')}</h2><p>{t('A clear record from checkout to seller payout.')}</p></div>
      <strong className="payment-amount">{dealPrice(deal)}</strong>
    </div>
    <div className={`protected-payment-state ${secured?'success':terminal?'warning':''}`}>
      <span><i aria-hidden="true"/>{t(protectedPaymentLabels[state])}</span>
      {payment?.paid_at&&<small>{formatDateTime(payment.paid_at)}</small>}
    </div>
    <ol className="payment-milestones" aria-label={t('Payment progress')}>
      {paymentMilestones.map((step,index)=><li className={step.done?'done':index===paymentMilestones.findIndex(item=>!item.done)?'current':''} key={step.label}>
        <span>{step.done?<Check size={15}/>:index+1}</span>
        <div><b>{t(step.label)}</b><small>{step.detail}</small></div>
      </li>)}
    </ol>
    {deal.viewerRole==='seller'&&!ready&&state==='not_started'&&<div className="payment-next-step"><ShieldCheck/><div><b>{t('Connect Stripe payouts')}</b><span>{t('Complete Stripe onboarding before a buyer can pay this deal.')}</span></div><button className="primary" disabled={busy==='connect'} onClick={startOnboarding}>{t(busy==='connect'?'Opening…':'Connect Stripe')}</button></div>}
    {deal.viewerRole==='seller'&&ready&&state==='not_started'&&<div className="payment-wait"><Clock3/>{t('Stripe payouts are connected. Waiting for the buyer to pay.')}</div>}
    {deal.viewerRole==='buyer'&&state==='not_started'&&!ready&&<div className="payment-wait"><Clock3/>{t('Waiting for the seller to finish Stripe payout setup.')}</div>}
    {deal.viewerRole==='buyer'&&state==='not_started'&&ready&&deal.status==='accepted'&&<div className="payment-actions"><button className="primary" disabled={busy==='checkout'} onClick={checkout}><BadgeDollarSign size={17}/>{t(busy==='checkout'?'Opening Stripe Sandbox…':'Open Stripe Sandbox checkout')}</button></div>}
    {state==='checkout_created'&&deal.viewerRole==='buyer'&&<div className="payment-actions"><button className="primary" disabled={busy==='checkout'} onClick={checkout}>{t('Continue Stripe Sandbox checkout')}</button></div>}
    {state==='processing'&&<div className="payment-wait"><Clock3/>{t('Stripe is processing the payment. This page will update automatically.')}</div>}
    {state==='funds_secured'&&deal.viewerRole==='buyer'&&deal.status==='completed'&&<div className="payment-actions"><button className="primary" disabled={busy==='release'} onClick={release}>{t(busy==='release'?'Releasing…':'Release funds to seller')}</button></div>}
    {state==='released'&&<div className="payment-wait"><Check/>{t('Payment has been released to the seller.')}</div>}
    {payment?.failure_message&&<div className="notice">{t(payment.failure_message)}</div>}
    {message&&<div className="notice">{t(message)}</div>}
    <details className="payment-details">
      <summary><span>{t('Payment events and fee details')}</span><ChevronDown/></summary>
      <div className="payment-flow" aria-label={t('Payment flow')}>{paymentFlow.map(step=><article className={`payment-flow-step ${step.done?'done':''}`} key={step.label}>{step.done?<Check size={17}/>:<Clock3 size={17}/>}<span><b>{t(step.label)}</b><small>{step.detail}</small></span></article>)}</div>
      <p className="payment-disclaimer"><ShieldCheck/>{t('Payments are processed in Stripe Sandbox. Dealivra never stores card or bank details. This beta is not legal escrow.')}</p>
    </details>
  </section>;
}

function ProtectedPaymentReceipt({deal,session}:{deal:Deal;session:StoredSession}){
  const [payment,setPayment]=useState<ProtectedPaymentStatus|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let mounted=true;
    const load=()=>getProtectedPaymentStatus(session,deal.id).then(result=>{if(mounted)setPayment(result)}).catch(()=>{});
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return()=>{mounted=false;window.clearInterval(timer)};
  },[deal.id,session.accessToken]);
  if(!payment||payment.status==='not_started')return null;
  const money=(amount:number)=>formatMoney(amount,payment.currency,getAppLanguage());
  const paid=Boolean(payment.paid_at);
  const receiptTitle=t(paid?'Payment receipt':'Payment breakdown');
  const finalEvent=payment.refunded_at
    ? {label:'Refunded at',value:formatDateTime(payment.refunded_at)}
    : payment.disputed_at
      ? {label:'Disputed at',value:formatDateTime(payment.disputed_at)}
      : {label:'Released at',value:payment.released_at?formatDateTime(payment.released_at):t('Not released yet')};
  const firstEvent=payment.paid_at
    ? {label:'Paid at',value:formatDateTime(payment.paid_at)}
    : payment.checkout_expires_at
      ? {label:'Checkout expires at',value:formatDateTime(payment.checkout_expires_at)}
      : {label:'Paid at',value:t('Pending')};
  const printReceipt=()=>{setMessage('');if(!printProtectedPaymentReceipt(deal,payment))setMessage('Allow pop-ups to print the payment receipt.')};
  return <section className="payment-receipt" aria-labelledby="payment-receipt-title"><div className="payment-receipt-heading"><div className="payment-receipt-title"><BadgeDollarSign/><div><p className="eyebrow">{t('Transparent fee record')}</p><h2 id="payment-receipt-title">{receiptTitle}</h2><span>{t('Deal reference')}: <b>{deal.publicId}</b></span></div></div><button className="secondary no-print" onClick={printReceipt}><FileDown size={18}/>{t('Print payment receipt')}</button></div>{!paid&&<div className="payment-receipt-unpaid"><ShieldAlert size={18}/><strong>{t('Not paid')}</strong><span>{t('This checkout has not been paid yet.')}</span></div>}<div className="payment-receipt-grid"><article><span>{t('Item amount')}</span><strong>{money(payment.item_amount_cents)}</strong></article><article><span>{t('Dealivra service fee')}</span><strong>{money(payment.platform_fee_cents)}</strong></article><article className="payment-receipt-net"><span>{t('Seller payout')}</span><strong>{money(payment.seller_amount_cents)}</strong></article><article><span>{t('Payment status')}</span><strong>{t(protectedPaymentLabels[payment.status])}</strong></article><article><span>{t(firstEvent.label)}</span><strong>{firstEvent.value}</strong></article><article><span>{t(finalEvent.label)}</span><strong>{finalEvent.value}</strong></article></div><p className="payment-receipt-note"><ShieldCheck size={17}/><span>{t(payment.status==='released'?'Service fee earned after seller payout':'Service fee allocated at checkout')}. {t('Stripe processing fees are separate and are not included in the Dealivra service fee.')}</span></p><p className="payment-receipt-legal">{t('This receipt records the Dealivra payment status. It is not a bank statement or legal escrow certificate.')}</p>{message&&<div className="notice no-print">{t(message)}</div>}</section>;
}

function splitDeliveryAddress(value:string){
  const lines=value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const locationLine=lines.at(-1)||'';
  const usLocation=locationLine.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if(usLocation)return {streetAddress:lines[0]||'',addressLine2:lines.slice(1,-1).join(' '),city:usLocation[1].trim(),state:usLocation[2].toUpperCase(),postalCode:usLocation[3]};
  return {streetAddress:lines[0]||'',addressLine2:lines.length>2?lines[1]||'':'',city:lines.length>2?lines.slice(2).join(' '):lines[1]||'',state:'',postalCode:''};
}

function ShippingPanel({deal,session,paymentReady,evidenceRevision,onProgressChanged,onDelivered}:{deal:Deal;session:StoredSession;paymentReady:boolean;evidenceRevision:number;onProgressChanged?:()=>void;onDelivered:()=>void}){
  const [shipment,setShipment]=useState<DealShipment|null>(null);const [delivery,setDelivery]=useState<DealDeliveryDetails|null>(null);const [carrier,setCarrier]=useState('');const [tracking,setTracking]=useState('');const [message,setMessage]=useState('');const [inspectionRecorded,setInspectionRecorded]=useState(false);const [editingAddress,setEditingAddress]=useState(false);const [savingAddress,setSavingAddress]=useState(false);const [readiness,setReadiness]=useState<SellerShippingEvidenceReadiness|null>(null);const [checkingReadiness,setCheckingReadiness]=useState(false);const [readinessError,setReadinessError]=useState('');const [address,setAddress]=useState({recipientName:session.user.displayName,streetAddress:'',addressLine2:'',city:'',state:'',postalCode:'',country:'United States',instructions:''});
  const loadShipment=()=>getDealShipment(session,deal.id).then(setShipment).catch(()=>{});const loadDelivery=()=>getDealDeliveryDetails(session,deal.id).then(details=>{setDelivery(details);if(details){const parsed=splitDeliveryAddress(details.full_address);setAddress({recipientName:details.recipient_name,streetAddress:parsed.streetAddress,addressLine2:parsed.addressLine2,city:parsed.city,state:parsed.state,postalCode:parsed.postalCode,country:details.country||'United States',instructions:details.instructions||''})}}).catch(()=>{});
  const loadReadiness=async()=>{if(deal.viewerRole!=='seller')return;setCheckingReadiness(true);setReadinessError('');try{setReadiness(await getSellerShippingEvidenceReadiness(session,deal.id))}catch{setReadiness(null);setReadinessError('Shipping readiness could not be verified.')}finally{setCheckingReadiness(false)}};
  useEffect(()=>{void loadShipment();void loadDelivery()},[deal.id,session.accessToken]);
  useEffect(()=>{void loadReadiness()},[deal.id,session.accessToken,deal.viewerRole,evidenceRevision]);
  const saveAddress=async(e:React.FormEvent)=>{e.preventDefault();if(!address.state||!isUsPostalCode(address.postalCode))return;setSavingAddress(true);setMessage('');try{const storedAddress=[address.streetAddress.trim(),address.addressLine2.trim(),`${address.city.trim()}, ${address.state} ${address.postalCode.trim()}`].filter(Boolean).join('\n');await saveDealDeliveryDetails(session,deal.id,address.recipientName,storedAddress,'United States',address.instructions);await loadDelivery();onProgressChanged?.();setEditingAddress(false);setMessage('Address saved. The seller can now prepare the shipment.')}catch(error){setMessage(error instanceof Error?error.message:'Could not save delivery address')}finally{setSavingAddress(false)}};
  const copyAddress=async()=>{if(!delivery)return;await navigator.clipboard?.writeText(`${delivery.recipient_name}\n${delivery.full_address}\n${delivery.country}${delivery.instructions?`\n${delivery.instructions}`:''}`);setMessage('Address copied.')};
  const evidenceReady=readiness?.ready===true;const readyToShip=paymentReady&&Boolean(delivery)&&evidenceReady;
  const serialRequired=readiness?.serial_required??Boolean(deal.serialNumber);
  const readinessSteps=[
    {label:'Payment confirmed',ready:paymentReady},
    {label:'Delivery address saved',ready:Boolean(delivery)},
    {label:'Item condition photo',ready:Boolean(readiness?.item_photo_ready)},
    {label:'Packing video',ready:Boolean(readiness?.packing_video_ready)},
    {label:'Package weight photo',ready:Boolean(readiness?.package_weight_ready)},
    {label:'Serial / IMEI photo',ready:serialRequired?Boolean(readiness?.serial_photo_ready):true,optional:!serialRequired},
  ];
  const completedReadinessSteps=readinessSteps.filter(step=>step.ready).length;
  const saveShipment=async(e:React.FormEvent)=>{e.preventDefault();setMessage('');if(!readyToShip){setMessage('Complete the shipping readiness checklist first.');return}try{await createDealShipment(session,deal.id,carrier,tracking);setMessage('Shipment details saved.');await loadShipment();await loadDelivery();await loadReadiness();onProgressChanged?.()}catch(error){setMessage(error instanceof Error?error.message:'Could not save shipment')}};
  const delivered=async()=>{if(!confirm(t('Confirm that you received and inspected this item?')))return;setMessage('');try{await confirmShipmentDelivery(session,deal.id);setMessage('Delivery confirmed. Deal completed.');await loadShipment();await loadDelivery();onProgressChanged?.();onDelivered()}catch(error){setMessage(error instanceof Error?error.message:'Could not confirm delivery')}};
  const streetNumberMissing=address.streetAddress.trim().length>0&&!/\d/.test(address.streetAddress);
  const addressIncomplete=address.recipientName.trim().length<2||address.streetAddress.trim().length<3||streetNumberMissing||address.city.trim().length<2||!address.state||!isUsPostalCode(address.postalCode);
  const shippingState=shipment?.status==='delivered'?'Delivered':shipment?'In transit':readyToShip?'Ready to ship':delivery?'Preparing shipment':'Address needed';
  return <section className="shipping-panel no-print">
    <div className="shipping-heading">
      <span className="workflow-icon"><Truck/></span>
      <div><p className="eyebrow">{t('Tracked delivery')}</p><h2>{t('Shipping & receipt')}</h2><span>{t('Address, tracking, inspection, and receipt in one place.')}</span></div>
      <strong className={`shipping-state ${shipment?.status==='delivered'?'complete':''}`}>{t(shippingState)}</strong>
    </div>
    <div className="delivery-address-section">
      <div className="delivery-address-heading"><span className="workflow-icon"><MapPinned/></span><div><p className="eyebrow">{t('Protected delivery')}</p><h3>{t('Delivery address')}</h3><span>{t('Only the buyer and seller can view this address.')}</span></div></div>
      {delivery&&!editingAddress&&<div className="delivery-address-card"><div><span>{t('Recipient name')}</span><strong>{delivery.recipient_name}</strong><address>{delivery.full_address}<br/>{delivery.country}</address>{delivery.instructions&&<small>{t('Delivery instructions')}: {delivery.instructions}</small>}</div><div className="delivery-address-actions">{delivery.locked&&<em><LockKeyhole size={14}/>{t('Locked after shipping')}</em>}<button className="secondary" onClick={copyAddress}><Copy size={16}/>{t('Copy address')}</button>{deal.viewerRole==='buyer'&&!delivery.locked&&<button className="secondary" onClick={()=>setEditingAddress(true)}>{t('Edit address')}</button>}</div></div>}
      {deal.viewerRole==='buyer'&&(!delivery||editingAddress)&&<form className="delivery-address-form" onSubmit={saveAddress}>
        <label>{t('Recipient name')}<input required minLength={2} maxLength={100} autoComplete="name" value={address.recipientName} onChange={e=>setAddress({...address,recipientName:e.target.value})}/></label>
        <label className="address-field-wide">{t('Street address (number and name)')}<AddressAutocomplete streetAddressOnly placeholder={t('123 Main St')} value={address.streetAddress} onChange={streetAddress=>setAddress(current=>({...current,streetAddress}))} onAddressParts={parts=>setAddress(current=>({...current,streetAddress:parts.streetAddress||current.streetAddress,city:parts.city||current.city,state:parts.state||current.state,postalCode:parts.postalCode||current.postalCode,country:'United States'}))}/>{streetNumberMissing&&<small className="address-validation">{t('Choose a specific address that includes a street number.')}</small>}</label>
        <label className="address-field-wide address-field-line-two">{t('Address line 2 (optional)')}<input maxLength={100} autoComplete="address-line2" value={address.addressLine2} onChange={e=>setAddress({...address,addressLine2:e.target.value})} placeholder={t('Apartment, suite, unit, building, or floor')}/><small className="field-help">{t('Add apartment, suite, unit, building, floor, or mailbox details.')}</small></label>
        <label>{t('City')}<input required minLength={2} maxLength={100} autoComplete="address-level2" value={address.city} onChange={e=>setAddress({...address,city:e.target.value})} placeholder={t('New York')}/></label>
        <label>{t('State')}<select required autoComplete="address-level1" value={address.state} onChange={e=>setAddress({...address,state:e.target.value})}><option value="">{t('Select state')}</option>{usStateOptions.map(([code,name])=><option key={code} value={code}>{code} — {name}</option>)}</select></label>
        <label>{t('ZIP code')}<input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" aria-invalid={Boolean(address.postalCode)&&!isUsPostalCode(address.postalCode)} placeholder="10001" value={address.postalCode} onChange={e=>setAddress({...address,postalCode:e.target.value})}/><small className={address.postalCode&&!isUsPostalCode(address.postalCode)?'field-help invalid':'field-help'}>{t(address.postalCode&&!isUsPostalCode(address.postalCode)?'Enter a valid 5-digit ZIP code or ZIP+4.':'5 digits or ZIP+4')}</small></label>
        <label className="address-field-country">{t('Country or region')}<input readOnly autoComplete="country-name" value="United States"/></label>
        <label className="address-field-wide">{t('Delivery instructions (optional)')}<textarea maxLength={500} value={address.instructions} onChange={e=>setAddress({...address,instructions:e.target.value})} placeholder={t('Apartment, access code, or safe delivery note')}/></label>
        <div className="delivery-form-actions">{delivery&&<button type="button" className="secondary" onClick={()=>setEditingAddress(false)}>{t('Go back')}</button>}<button className="primary" disabled={savingAddress||addressIncomplete}>{t(savingAddress?'Saving…':'Save delivery address')}</button></div>
      </form>}
      {deal.viewerRole==='seller'&&!delivery&&<div className="shipping-wait">{t('Waiting for the buyer to add a delivery address.')}</div>}
      <p className="delivery-privacy"><LockKeyhole size={15}/>{t('This address is used only for this deal and is never shown on the public Deal Link.')}</p>
    </div>
    {deal.viewerRole==='seller'&&!shipment&&<details className={`shipping-readiness ${readyToShip?'is-ready':''}`} aria-busy={checkingReadiness}>
      <summary className="shipping-readiness-heading">
        <span className="shipping-readiness-icon">{readyToShip?<Check/>:<ShieldCheck/>}</span>
        <div><p className="eyebrow">{t('Shipping readiness')}</p><h3>{t(readyToShip?'Ready to ship':'Complete shipping checks')}</h3><span>{completedReadinessSteps}/{readinessSteps.length} {t('steps complete')}</span></div>
        <ChevronDown className="shipping-readiness-chevron"/>
      </summary>
      <div className="shipping-readiness-body">
        <div className="shipping-readiness-progress"><span style={{width:`${completedReadinessSteps/readinessSteps.length*100}%`}}/></div>
        <div className="shipping-readiness-list">{readinessSteps.map(step=><div key={step.label} className={step.ready?'complete':'missing'}>{step.ready?<Check/>:<Clock3/>}<span>{t(step.label)}</span><em>{t(step.optional?'Not required':step.ready?'Ready':'Missing')}</em></div>)}</div>
        {checkingReadiness&&<div className="shipping-readiness-status">{t('Checking shipping readiness…')}</div>}
        {readinessError&&<div className="notice">{t(readinessError)}</div>}
        {!readyToShip&&<button type="button" className="secondary shipping-evidence-link" onClick={()=>document.getElementById('deal-evidence-vault')?.scrollIntoView({behavior:'smooth',block:'center'})}><ShieldCheck size={17}/>{t('Upload required evidence')}</button>}
      </div>
    </details>}
    {shipment?<div className="shipment-card"><PackageCheck/><div><b>{shipment.carrier}</b><span>{t('Tracking number:')} {shipment.tracking_number}</span><small>{t(shipment.status==='delivered'?'Delivered':'Shipped')} · {formatDateTime(shipment.shipped_at)}</small></div></div>:deal.viewerRole==='seller'&&delivery?<form onSubmit={saveShipment}><label>{t('Carrier')}<input required minLength={2} value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder={t('UPS, FedEx, USPS…')}/></label><label>{t('Tracking number')}<input required minLength={4} value={tracking} onChange={e=>setTracking(e.target.value)} placeholder={t('Enter tracking number')}/></label><button className="primary" disabled={!readyToShip||carrier.trim().length<2||tracking.trim().length<4}>{t('Mark as shipped')}</button></form>:deal.viewerRole==='buyer'&&delivery?<div className="shipping-wait">{t('Waiting for the seller to add tracking information.')}</div>:null}
    {shipment?.status==='shipped'&&deal.status==='accepted'&&<InspectionRecorder deal={deal} session={session} onRecorded={setInspectionRecorded}/>}
    {shipment?.status==='shipped'&&deal.viewerRole==='buyer'&&deal.status==='accepted'&&<button className="primary confirm-delivery" disabled={!inspectionRecorded} onClick={delivered}><PackageCheck size={18}/>{t('Confirm delivery')}</button>}
    {message&&<div className="notice">{t(message)}</div>}
    <p className="shipping-note"><ShieldCheck/> {t(inspectionRecorded?'Inspection recorded. Delivery can now be confirmed.':'Confirm delivery only after receiving and inspecting the item.')}</p>
  </section>
}

const evidenceLabels:Record<string,string>={seller_packing_video:'Packing video',seller_item_photo:'Item condition photo',seller_serial_number:'Serial / IMEI photo',seller_package_weight:'Package weight photo',buyer_unboxing_video:'Unboxing video',buyer_received_photo:'Received item photo',buyer_damage_photo:'Damage or missing-item photo',other:'Other evidence'};
function EvidencePanel({deal,session,onChanged}:{deal:Deal;session:StoredSession;onChanged?:()=>void}){
  const role=deal.viewerRole==='buyer'?'buyer':'seller';
  const sellerOptions:EvidenceType[]=['seller_packing_video','seller_item_photo','seller_serial_number','seller_package_weight'];
  const buyerOptions:EvidenceType[]=['buyer_unboxing_video','buyer_received_photo','buyer_damage_photo','other'];
  const [evidenceType,setEvidenceType]=useState<EvidenceType>(role==='seller'?'seller_packing_video':'buyer_unboxing_video');
  const [files,setFiles]=useState<File[]>([]);const [items,setItems]=useState<DealEvidence[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const load=async()=>{try{setItems(await listDealEvidence(session,deal.id))}catch(error){setMessage(error instanceof Error?error.message:'Could not load evidence')}};
  useEffect(()=>{setEvidenceType(role==='seller'?'seller_packing_video':'buyer_unboxing_video');setFiles([]);setMessage('');void load()},[deal.id,session.accessToken,role]);
  const upload=async(event:React.FormEvent)=>{event.preventDefault();if(!files.length)return;setBusy(true);setMessage('');try{for(const file of files)await uploadDealEvidence(session,deal.id,role,evidenceType,file);setFiles([]);await load();onChanged?.();setMessage('Evidence saved privately to this deal record.')}catch(error){setMessage(error instanceof Error?error.message:'Could not upload evidence')}finally{setBusy(false)}};
  const options=role==='seller'?sellerOptions:buyerOptions;
  const acceptedFiles=role==='seller'?(evidenceType==='seller_packing_video'?'video/*':'image/*'):'image/*,video/*';
  return <section id="deal-evidence-vault" className="evidence-panel no-print"><div className="evidence-heading"><ShieldCheck/><div><p className="eyebrow">{t('Evidence vault')}</p><h2>{t(role==='seller'?'Document the package before shipping':'Document the item when it arrives')}</h2><span>{t(role==='seller'?'Record the item, serial number, and sealed package.':'Record the delivery, packaging, and unboxing before using the item.')}</span></div></div><form className="evidence-form" onSubmit={upload}><label>{t('Evidence type')}<select value={evidenceType} onChange={event=>{setEvidenceType(event.target.value as EvidenceType);setFiles([])}}>{options.map(option=><option key={option} value={option}>{t(evidenceLabels[option])}</option>)}</select></label><label className="evidence-picker">{t('Choose photos or video')}<input type="file" accept={acceptedFiles} multiple onChange={event=>{setFiles(Array.from(event.target.files||[]));event.currentTarget.value=''}}/><small>{files.length?`${files.length} ${t(files.length===1?'file selected':'files selected')}`:t('Up to 50 MB per file')}</small></label>{files.length>0&&<div className="evidence-file-list">{files.map((file,index)=><span key={`${file.name}-${index}`}><Package size={15}/>{file.name}<small>{Math.ceil(file.size/1024/1024)} MB</small></span>)}</div>}<button className="primary" disabled={busy||!files.length}>{busy?t('Uploading securely…'):t('Save evidence')}</button></form>{message&&<div className="notice">{t(message)}</div>}<div className="evidence-list"><div className="evidence-list-heading"><b>{t('Saved evidence')}</b><span>{items.length} {t(items.length===1?'file':'files')} · {t('Private to the deal participants')}</span></div>{items.length?items.map(item=><article key={item.id}><BadgeCheck size={17}/><div><b>{t(evidenceLabels[item.evidence_type]||'Other evidence')}</b><span>{item.file_name||t('Uploaded file')} · {formatDateTime(item.created_at)}</span></div><em>{t('Stored privately')}</em></article>):<p>{t('No evidence uploaded yet.')}</p>}</div><p className="evidence-note"><LockKeyhole size={15}/>{t('Evidence is append-only and is never shown on the public Deal Link.')}</p></section>;
}

function InstallApp(){const [prompt,setPrompt]=useState<InstallPromptEvent|null>(null);useEffect(()=>{const handler=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);if(!prompt)return null;const install=async()=>{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setPrompt(null)};return <aside className="install-app no-print"><Smartphone/><div><b>{t('Install Dealivra')}</b><span>{t('Add it to your home screen for faster access.')}</span></div><button className="primary" onClick={install}>{t('Install app')}</button></aside>}

function ForgotPassword({onBack}:{onBack:()=>void}){const [email,setEmail]=useState('');const [message,setMessage]=useState('');const [sending,setSending]=useState(false);const submit=async(e:React.FormEvent)=>{e.preventDefault();setSending(true);setMessage('');try{await requestPasswordReset(email,location.origin);setMessage('If an account exists for this email, a password reset link has been sent.')}catch(error){setMessage(error instanceof Error?error.message:'Could not send reset email')}finally{setSending(false)}};return <section className="recovery-page"><button className="back" onClick={onBack}>← {t('Back to sign in')}</button><p className="eyebrow">{t('Account recovery')}</p><h1>{t('Reset your password')}</h1><p>{t('Enter your account email. For privacy, the result will not reveal whether an account exists.')}</p><form onSubmit={submit}><label>{t('Email')}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>{message&&<div className="notice">{t(message)}</div>}<button className="primary full" disabled={sending}>{t(sending?'Sending…':'Send reset link')}</button></form></section>}

function ResetPassword({token,onDone}:{token:string;onDone:()=>void}){const [password,setPassword]=useState('');const [confirmPassword,setConfirmPassword]=useState('');const [message,setMessage]=useState('');const submit=async(e:React.FormEvent)=>{e.preventDefault();setMessage('');if(password!==confirmPassword){setMessage('Passwords do not match.');return}try{await updateRecoveredPassword(token,password);history.replaceState(null,'',location.pathname);setMessage('Password updated. You can now sign in.');setTimeout(onDone,1000)}catch(error){setMessage(error instanceof Error?error.message:'Could not update password')}};return <section className="recovery-page"><p className="eyebrow">{t('Secure recovery')}</p><h1>{t('Choose a new password')}</h1><form onSubmit={submit}><label>{t('New password')}<input required minLength={12} autoComplete="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>{t('Confirm password')}<input required minLength={12} autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><small>{t('Use 12+ characters with uppercase, lowercase, and a number.')}</small>{message&&<div className="notice">{t(message)}</div>}<button className="primary full">{t('Update password')}</button></form></section>}

const isVideoSource=(source:string)=>/\.(mp4|webm)(?:$|\?)/i.test(source);
const isVideoFile=(file:File)=>file.type.startsWith('video/')||/\.(mp4|webm)$/i.test(file.name);
function MediaPreview({source,className,alt}:{source:string;className?:string;alt:string}){return isVideoSource(source)?<video className={className} src={source} controls playsInline preload="metadata" aria-label={alt}/>:<img className={className} src={source} alt={alt}/>}
function MediaLightbox({source,alt,onClose}:{source:string;alt:string;onClose:()=>void}){
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
    window.addEventListener('keydown',onKeyDown);
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{window.removeEventListener('keydown',onKeyDown);document.body.style.overflow=previousOverflow};
  },[onClose]);
  return <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={t('Image preview')} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><button className="media-lightbox-close" type="button" onClick={onClose} aria-label={t('Close image')}><X size={22}/></button>{isVideoSource(source)?<video className="media-lightbox-content" src={source} controls autoPlay playsInline aria-label={alt}/>:<img className="media-lightbox-content" src={source} alt={alt}/>}</div>;
}
function ZoomableMedia({source,className,alt,onOpen}:{source:string;className?:string;alt:string;onOpen:()=>void}){
  if(isVideoSource(source))return <MediaPreview className={className} source={source} alt={alt}/>;
  return <button type="button" className="media-zoom-button" onClick={onOpen} aria-label={`${t('Zoom image')}: ${alt}`}><MediaPreview className={className} source={source} alt={alt}/><span className="media-zoom-indicator" aria-hidden="true"><ZoomIn size={20}/></span></button>;
}
function DealMedia({deal}:{deal:Deal}){
  const media=deal.mediaUrls||[];
  const cover=media[0];
  const printable=media.filter(url=>!isVideoSource(url));
  const [lightboxSource,setLightboxSource]=useState<string|null>(null);
  if(!cover){
    const ArtIcon=deal.publicId===DEMO_DEAL_PUBLIC_ID?Smartphone:Package;
    return <div className="product-art product-art-empty"><ArtIcon/><span>{deal.title}</span><small>{t(deal.publicId===DEMO_DEAL_PUBLIC_ID?'Sample item preview':'No item photos added')}</small></div>;
  }
  const openImage=(source:string)=>setLightboxSource(source);
  return <>
    <div className="screen-media-gallery">
      <ZoomableMedia className={`product-media${isVideoSource(cover)?' video-cover':''}`} source={cover} alt={`${deal.title} ${t('cover')}`} onOpen={()=>openImage(cover)}/>
      {media.length>1&&<div className="deal-gallery supporting-gallery">{media.slice(1).map((url,index)=><ZoomableMedia key={url} source={url} alt={`${deal.title} ${t('media')} ${index+2}`} onOpen={()=>openImage(url)}/>)}</div>}
    </div>
    <div className="print-media-gallery" aria-label={t('Printable item photos')}>
      {printable.length>0?printable.map((url,index)=><img key={url} className="print-photo" src={url} alt={`${deal.title} ${t('printable item')} ${index+1}`}/>):<div className="product-art print-video-note">{t('Item video is attached to the live Deal Link')}</div>}
    </div>
    {lightboxSource&&<MediaLightbox source={lightboxSource} alt={`${deal.title} ${t('image preview')}`} onClose={()=>setLightboxSource(null)}/>} 
  </>;
}
function FilePreview({file,alt}:{file:File;alt:string}){const source=URL.createObjectURL(file);return isVideoFile(file)?<video src={source} controls muted playsInline preload="metadata" aria-label={alt}/>:<img src={source} alt={alt}/>}

type SellerDeclarations={authority:boolean;lawful:boolean;disclosure:boolean};
const emptySellerDeclarations:SellerDeclarations={authority:false,lawful:false,disclosure:false};
type GuestCreateDraftRecovery={
  version:1;
  savedAt:number;
  draft:DealDraft;
  dealTemplate:DealTemplateId;
  catalogSelection?:SmartCatalogSelection;
  createStep:CreateFlowStep;
  reviewingDraft:boolean;
};
const guestCreateDraftKey='dealivra:guest-create-draft:v1';
const guestCreateDraftLifetime=7*24*60*60*1000;
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
  try{window.localStorage.removeItem(guestCreateDraftKey)}catch{}
};
const readGuestCreateDraft=():GuestCreateDraftRecovery|null=>{
  try{
    const raw=window.localStorage.getItem(guestCreateDraftKey);
    if(!raw)return null;
    const stored=JSON.parse(raw) as Partial<GuestCreateDraftRecovery>;
    if(stored.version!==1||typeof stored.savedAt!=='number'||Date.now()-stored.savedAt>guestCreateDraftLifetime||!stored.draft){
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
      title:typeof stored.draft.title==='string'?stored.draft.title:'',
      description:typeof stored.draft.description==='string'?stored.draft.description:'',
      price:typeof stored.draft.price==='string'?stored.draft.price:'',
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
    return {version:1,savedAt:stored.savedAt,draft,dealTemplate:template,catalogSelection,createStep:step,reviewingDraft};
  }catch{
    clearGuestCreateDraft();
    return null;
  }
};
const writeGuestCreateDraft=(recovery:GuestCreateDraftRecovery)=>{
  try{window.localStorage.setItem(guestCreateDraftKey,JSON.stringify(recovery))}catch{}
};
function SellerDeclarationChecklist({value,onChange,id}:{value:SellerDeclarations;onChange:(next:SellerDeclarations)=>void;id?:string}){
  const items=[{key:'authority' as const,label:'I confirm I own this item or have authority to sell it.'},{key:'lawful' as const,label:'I confirm this item is not stolen, counterfeit, or prohibited by law.'},{key:'disclosure' as const,label:'I confirm the description includes all known defects and material facts.'}];
  return <fieldset id={id} className="seller-declarations"><legend><ShieldCheck/>{t('Seller declaration')}</legend>{items.map(item=><label key={item.key} className={value[item.key]?'checked':''}><input type="checkbox" checked={value[item.key]} onChange={event=>onChange({...value,[item.key]:event.target.checked})}/><span>{t(item.label)}</span></label>)}<small><LockKeyhole/>{t('These confirmations are recorded when the Deal Link is published.')}</small></fieldset>;
}

function PublicSellerDeclaration({deal}:{deal:Deal}){
  const [record,setRecord]=useState<SellerDeclarationRecord|null>(null);const [loaded,setLoaded]=useState(false);
  useEffect(()=>{let current=true;setLoaded(false);getPublicSellerDeclaration(deal.publicId).then(value=>{if(current){setRecord(value);setLoaded(true)}}).catch(()=>{if(current){setRecord(null);setLoaded(true)}});return()=>{current=false}},[deal.publicId]);
  if(!loaded||!record)return null;
  if(!record.attested)return <section className="seller-declaration-status missing no-print"><div className="seller-declaration-heading"><ShieldAlert/><div><p className="eyebrow">{t('Seller declaration')}</p><h2>{t('No recorded seller declaration')}</h2></div></div><p className="seller-declaration-note"><Clock3/>{t('This Deal Link may have been published before seller declarations were required.')}</p></section>;
  const items=['Ownership or authority to sell declared','Item declared not stolen, counterfeit, or prohibited','Known defects and material facts declared'];
  return <section className="seller-declaration-status no-print"><div className="seller-declaration-heading"><BadgeCheck/><div><p className="eyebrow">{t('Recorded statement')}</p><h2>{t('Seller declarations recorded')}</h2></div></div><ul>{items.map(item=><li key={item}><Check/><span>{t(item)}</span></li>)}</ul>{record.attested_at&&<p className="seller-declaration-meta">{t('Recorded')} · {formatDateTime(record.attested_at)}</p>}<p className="seller-declaration-note"><ShieldCheck/>{t("This records the seller's statements. It does not verify ownership or authenticity.")}</p></section>;
}

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
      <button type="button" className="primary" aria-label={t(creating?'Publishing…':declarationsComplete?(requiresAccount?'Create account to publish':'Confirm and publish'):'Complete declarations')} disabled={creating} onClick={()=>{if(declarationsComplete){onPublish();return}const checklist=document.getElementById('seller-declarations');checklist?.scrollIntoView({behavior:'smooth',block:'center'});checklist?.setAttribute('tabindex','-1');checklist?.focus({preventScroll:true})}}>{t(creating?'Publishing…':declarationsComplete?(requiresAccount?'Create account':'Confirm and publish'):'Complete declarations')}<ArrowRight size={18}/></button>
    </div>
  </section>
}

function SavedDraftPanel({deal,session,onUpdated}:{deal:Deal;session:StoredSession;onUpdated:(deal:Deal)=>void}){
  const remainingDays=deal.expiresAt?Math.max(1,Math.round((new Date(deal.expiresAt).getTime()-new Date(deal.createdAt).getTime())/(24*60*60*1000))):7;
  const [edit,setEdit]=useState<DealDraft>({title:deal.title,description:deal.description,price:amountForInput(deal.priceCents,deal.currency),currency:deal.currency,condition:deal.condition,serialNumber:deal.serialNumber?.slice(-4)||'',deliveryMethod:deal.deliveryMethod,expiresInDays:remainingDays});
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [declarations,setDeclarations]=useState<SellerDeclarations>(emptySellerDeclarations);const declarationsComplete=Object.values(declarations).every(Boolean);
  useEffect(()=>setEdit({title:deal.title,description:deal.description,price:amountForInput(deal.priceCents,deal.currency),currency:deal.currency,condition:deal.condition,serialNumber:deal.serialNumber?.slice(-4)||'',deliveryMethod:deal.deliveryMethod,expiresInDays:remainingDays}),[deal.id]);
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const action=((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value||'save';if(action==='publish'&&!declarationsComplete){setMessage('Confirm all declarations before publishing.');return}setBusy(true);setMessage('');try{const updated=action==='publish'?await publishUserDealDraft(session,deal.id,edit):await updateUserDealDraft(session,deal.id,edit);onUpdated({...updated,mediaUrls:deal.mediaUrls});setMessage(action==='publish'?'Deal Link published.':'Draft saved.')}catch(error){setMessage(error instanceof Error?error.message:'Could not update draft')}finally{setBusy(false)}};
  return <section className="saved-draft no-print"><div className="saved-draft-heading"><LockKeyhole/><div><p className="eyebrow">{t('Private draft')}</p><h2>{t('Edit details')}</h2><span>{t('This draft is not shared through a Deal Link until you publish it.')}</span></div></div><form onSubmit={submit}><label>{t('Item title')}<input required minLength={3} maxLength={120} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><div className="two"><label>{t('Price')}<span className="price-currency-controls"><input required min={currencyStep(edit.currency)} step={currencyStep(edit.currency)} type="number" value={edit.price} onChange={e=>setEdit({...edit,price:e.target.value})}/><span className="currency-label">USD</span></span></label><label>{t('Condition')}<select value={edit.condition} onChange={e=>setEdit({...edit,condition:e.target.value as DealDraft['condition']})}><option value="Like new">{t('Like new')}</option><option value="Good">{t('Good')}</option><option value="Fair">{t('Fair')}</option></select></label></div><label>{t('Known condition and defects')}<textarea required minLength={20} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/><small>{edit.description.trim().length}/20 · {t('Describe wear, repairs, or defects.')}</small></label><div className="two"><label>{t('Handoff')}<select value={edit.deliveryMethod} onChange={e=>setEdit({...edit,deliveryMethod:e.target.value as DealDraft['deliveryMethod']})}><option value="Meet in person">{t('Meet in person')}</option><option value="Ship to buyer">{t('Ship to buyer')}</option></select></label><label>{t('Offer valid for')}<select value={edit.expiresInDays||7} onChange={e=>setEdit({...edit,expiresInDays:Number(e.target.value)})}><option value={1}>{t('1 day')}</option><option value={3}>{t('3 days')}</option><option value={7}>{t('7 days')}</option><option value={14}>{t('14 days')}</option><option value={30}>{t('30 days')}</option></select></label></div><SellerDeclarationChecklist value={declarations} onChange={setDeclarations}/>{!declarationsComplete&&<small className="declaration-required">{t('Confirm all declarations before publishing.')}</small>}{message&&<div className="notice">{t(message)}</div>}<div className="saved-draft-actions"><button className="secondary" name="action" value="save" disabled={busy}>{t(busy?'Saving…':'Save changes')}</button><button className="primary" name="action" value="publish" disabled={busy||!declarationsComplete}>{t('Publish Deal Link')}<ArrowRight size={17}/></button></div></form></section>
}

function PhotoManager({deal,session,onAdded}:{deal:Deal;session:StoredSession;onAdded:(urls:string[])=>void}){
  const [files,setFiles]=useState<File[]>([]);
  const [message,setMessage]=useState('');
  const [uploading,setUploading]=useState(false);
  const remaining=Math.max(0,6-(deal.mediaUrls?.length||0));
  const hasVideo=(deal.mediaUrls||[]).some(isVideoSource);
  const choose=(selected:File[])=>{
    setMessage('');
    const combined=[...files,...selected].filter((file,index,all)=>all.findIndex(other=>other.name===file.name&&other.size===file.size)===index).slice(0,remaining);
    const videos=combined.filter(isVideoFile);
    const invalid=combined.find(file=>file.size>(isVideoFile(file)?25:20)*1024*1024);
    if(invalid||videos.length+(hasVideo?1:0)>1){setMessage(invalid?`${invalid.name} ${t('is too large.')}`:'Only one item video is allowed per deal.');return}
    setFiles(combined);
  };
  const upload=async()=>{if(!files.length)return;setUploading(true);setMessage('');try{const urls=await uploadDealPhotos(session,deal.id,files,deal.mediaUrls?.length||0);onAdded(urls);setFiles([]);setMessage('Media added successfully.')}catch(error){setMessage(error instanceof Error?error.message:'Could not upload media')}finally{setUploading(false)}};
  return <section className="photo-manager no-print"><div><ImagePlus/><span><b>{t('Add photos or video')}</b><small>{remaining} {t('of 6 spaces available')} · {files.length} {t('selected')}</small></span></div><p className="media-privacy"><ShieldCheck/>{t('Photo privacy: location and camera metadata are removed before upload.')}</p>{remaining>files.length&&<label className="secondary">{t('Choose more media')}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm" multiple onChange={e=>{choose(Array.from(e.target.files||[]));e.currentTarget.value=''}}/></label>}{files.length>0&&<div className="manager-previews">{files.map((file,index)=><FilePreview key={`${file.name}-${index}`} file={file} alt={t('Upload preview')}/>)}</div>}{files.length>0&&<button className="primary" disabled={uploading} onClick={upload}>{uploading?t('Preparing and uploading…'):`${t('Upload')} ${files.length} ${t(files.length>1?'files':'file')}`}</button>}{message&&<div className="notice">{t(message)}</div>}</section>
}

function ExistingMediaManager({deal,session,onRemoved}:{deal:Deal;session:StoredSession;onRemoved:(url:string)=>void}){const [removing,setRemoving]=useState('');const [message,setMessage]=useState('');const [previewSource,setPreviewSource]=useState<string|null>(null);const remove=async(url:string)=>{if(!confirm(t('Remove this photo or video from the Deal Link?')))return;setRemoving(url);setMessage('');try{await deleteDealMedia(session,deal.id,url);onRemoved(url);setMessage('Media removed.');if(previewSource===url)setPreviewSource(null)}catch(error){setMessage(error instanceof Error?error.message:'Could not remove media')}finally{setRemoving('')}};if(!deal.mediaUrls?.length)return null;return <section className="existing-media no-print"><div><p className="eyebrow">{t('Published media')}</p><h2>{t('Manage photos and video')}</h2></div><div className="existing-media-grid">{deal.mediaUrls.map((url,index)=><article key={url}><ZoomableMedia source={url} alt={`${deal.title} ${t('media')} ${index+1}`} onOpen={()=>setPreviewSource(url)}/><button aria-label={`${t('Remove media')} ${index+1}`} disabled={removing===url} onClick={()=>remove(url)}><Trash2 size={16}/>{t(removing===url?'Removing…':'Remove')}</button></article>)}</div>{message&&<div className="notice">{t(message)}</div>}{previewSource&&<MediaLightbox source={previewSource} alt={`${deal.title} ${t('image preview')}`} onClose={()=>setPreviewSource(null)}/>}</section>}

function CoverSelector({deal,session,onReordered}:{deal:Deal;session:StoredSession;onReordered:(urls:string[])=>void}){const urls=deal.mediaUrls||[];const [selected,setSelected]=useState(urls[0]||'');const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);useEffect(()=>setSelected(urls[0]||''),[urls[0]]);if(urls.length<2)return null;const save=async()=>{const ordered=[selected,...urls.filter(url=>url!==selected)];setSaving(true);setMessage('');try{await reorderDealMedia(session,deal.id,ordered);onReordered(ordered);setMessage('Cover media updated.')}catch(error){setMessage(error instanceof Error?error.message:'Could not update cover')}finally{setSaving(false)}};return <section className="cover-selector no-print"><div><p className="eyebrow">{t('Deal Link cover')}</p><h2>{t('Choose the first photo')}</h2><span>{t('The selected file appears first and at the largest size.')}</span></div><div className="cover-options">{urls.map((url,index)=><button key={url} className={selected===url?'selected':''} onClick={()=>setSelected(url)}><MediaPreview source={url} alt={`${t('Cover option')} ${index+1}`}/><span>{selected===url?<><Star size={14}/>{t('Selected')}</>:`${t('Media')} ${index+1}`}</span></button>)}</div><button className="primary" disabled={saving||selected===urls[0]} onClick={save}>{t(saving?'Saving…':'Set as cover')}</button>{message&&<div className="notice">{t(message)}</div>}</section>}

function DealEditor({deal,session,onSaved}:{deal:Deal;session:StoredSession;onSaved:(deal:Deal)=>void}){const [open,setOpen]=useState(false);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [edit,setEdit]=useState<DealDraft>({title:deal.title,description:deal.description,price:amountForInput(deal.priceCents,deal.currency),currency:deal.currency,condition:deal.condition,serialNumber:'',deliveryMethod:deal.deliveryMethod});const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setMessage('');try{const version=await updatePublishedDeal(session,deal.id,edit);onSaved({...deal,title:edit.title,description:edit.description,priceCents:toMinorUnits(edit.price,edit.currency),condition:edit.condition,deliveryMethod:edit.deliveryMethod,agreementVersion:version});setMessage(`${t('Changes published as agreement version')} ${version}.`);setOpen(false)}catch(error){setMessage(error instanceof Error?error.message:'Could not update deal')}finally{setSaving(false)}};return <section id="deal-editor" className="deal-editor no-print"><div><Pencil/><span><b>{t('Edit published deal')}</b><small>{t('Changes create a new agreement version.')}</small></span></div><button id="deal-editor-toggle" className="secondary" onClick={()=>setOpen(!open)}>{t(open?'Close editor':'Edit details')}</button>{open&&<form onSubmit={save}><label>{t('Item title')}<input required minLength={3} maxLength={120} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><div className="edit-two"><label>{t('Price')} ({edit.currency})<input required type="number" min={currencyStep(edit.currency)} step={currencyStep(edit.currency)} value={edit.price} onChange={e=>setEdit({...edit,price:e.target.value})}/></label><label>{t('Condition')}<select value={edit.condition} onChange={e=>setEdit({...edit,condition:e.target.value as DealDraft['condition']})}><option value="Like new">{t('Like new')}</option><option value="Good">{t('Good')}</option><option value="Fair">{t('Fair')}</option></select></label></div><label>{t('Description and defects')}<textarea required minLength={20} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/><small>{edit.description.trim().length}/20 · {t('Describe wear, repairs, or defects.')}</small></label><label>{t('Handoff')}<select value={edit.deliveryMethod} onChange={e=>setEdit({...edit,deliveryMethod:e.target.value as DealDraft['deliveryMethod']})}><option value="Meet in person">{t('Meet in person')}</option><option value="Ship to buyer">{t('Ship to buyer')}</option></select></label><button className="primary full" disabled={saving}>{t(saving?'Publishing…':'Publish changes')}</button></form>}{message&&<div className="notice">{t(message)}</div>}</section>}

function DealLinkError({message,onBack}:{message:string;onBack:()=>void}){
  return <section className="form-wrap deal-link-error">
    <div className="safe pending"><ShieldAlert/>{t('Deal Link unavailable')}</div>
    <h1>{t('Deal Link unavailable')}</h1>
    <p className="lede small">{t('The link may be incomplete, expired, or no longer public.')}</p>
    {message&&<div className="notice"><ShieldAlert size={18}/><span>{t(message)}</span></div>}
    <button className="primary" onClick={onBack}>{t('Back')}</button>
  </section>
}

function DemoAgreementComplete({buyerName,onStart,onReviewAgain}:{buyerName:string;onStart:()=>void;onReviewAgain:()=>void}){
  return <section className="demo-agreement-complete" role="status" aria-live="polite">
    <div className="demo-complete-heading">
      <span><BadgeCheck/></span>
      <div><p className="eyebrow">{t('Sample complete')}</p><h3>{t('You completed the buyer review.')}</h3><p>{t(`${buyerName||'Buyer'} reviewed the shared terms. No agreement, payment, or account was created.`)}</p></div>
    </div>
    <div className="demo-complete-next" aria-label={t('What happens next in a live deal')}>
      <p>{t('In a live deal, both parties continue in the same private record:')}</p>
      <ul>
        <li><CreditCard/><span><b>{t('Payment status')}</b><small>{t('Both sides see when payment is ready.')}</small></span></li>
        <li><Truck/><span><b>{t('Delivery evidence')}</b><small>{t('Shipping or handoff proof stays with the deal.')}</small></span></li>
        <li><PackageCheck/><span><b>{t('Completion record')}</b><small>{t('Inspection and receipt close the transaction.')}</small></span></li>
      </ul>
    </div>
    <div className="demo-complete-actions">
      <button type="button" className="primary" onClick={onStart}>{t('Start your own deal')}<ArrowRight size={16}/></button>
      <button type="button" className="secondary" onClick={onReviewAgain}>{t('Review sample again')}</button>
    </div>
  </section>
}

function DealProgressStrip({deal,paymentReady}:{deal:Deal;paymentReady:boolean}){
  const complete=deal.status==='completed';
  const currentStage=complete?3:deal.status==='accepted'&&paymentReady?2:(['accepted','disputed'] as Deal['status'][]).includes(deal.status)?1:0;
  const steps=[
    {label:'Terms',icon:FileSignature},
    {label:'Pay',icon:BadgeDollarSign},
    {label:'Delivery',icon:Truck},
    {label:'Done',icon:PackageCheck},
  ];
  return <ol className="deal-progress-strip" aria-label={t('Deal progress')}>
    {steps.map((step,index)=>{
      const state=complete||index<currentStage?'complete':index===currentStage?'current':'upcoming';
      const Icon=step.icon;
      return <li key={step.label} className={state} aria-current={state==='current'?'step':undefined}>
        <span>{state==='complete'?<Check/>:<Icon/>}</span>
        <small>{t(step.label)}</small>
      </li>
    })}
  </ol>
}

function DealWorkspaceGroup({
  id,icon:Icon,kicker,title,summary,defaultOpen=false,children
}:{
  id:string;
  icon:typeof ShieldCheck;
  kicker:string;
  title:string;
  summary:string;
  defaultOpen?:boolean;
  children:React.ReactNode;
}){
  const [open,setOpen]=useState(defaultOpen);
  return <details id={id} className="deal-workspace-group" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>
      <span className="deal-workspace-group-icon"><Icon/></span>
      <span className="deal-workspace-group-copy"><small>{t(kicker)}</small><strong>{t(title)}</strong><em>{t(summary)}</em></span>
      <ChevronDown className="deal-workspace-chevron"/>
    </summary>
    <div className="deal-workspace-group-content">{children}</div>
  </details>
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

const publicInfoContent:Record<PublicInfoView,{eyebrow:string;title:string;intro:string;sections:Array<{title:string;body:string}>}>={
  'buyer-protection':{
    eyebrow:'BUYER PROTECTION',title:'Know what happens before you pay.',
    intro:'Dealivra keeps the accepted terms, payment state, delivery evidence, inspection record, and dispute history together.',
    sections:[
      {title:'Review one shared agreement',body:'Confirm the item, price, condition disclosures, delivery method, and accepted agreement version before paying.'},
      {title:'Payment status stays visible',body:'The beta uses Stripe Sandbox. Dealivra does not store card or bank details and is not legal escrow.'},
      {title:'Raise a problem before release',body:'A dispute records evidence and pauses the normal completion path while the issue is reviewed.'}
    ]
  },
  'seller-protection':{
    eyebrow:'SELLER PROTECTION',title:'Ship or hand off with a clearer record.',
    intro:'The seller can see whether terms were accepted and whether the payment workflow is ready before releasing an item.',
    sections:[
      {title:'Accepted terms are versioned',body:'Price, disclosures, handoff terms, and each accepted agreement version remain attached to the deal.'},
      {title:'Evidence supports the handoff',body:'Shipping, meeting confirmation, inspection, photos, and messages stay with the transaction record.'},
      {title:'Release is recorded',body:'Payment and completion actions are time-stamped so both parties can understand the current state.'}
    ]
  },
  fees:{
    eyebrow:'FEES & AVAILABILITY',title:'See costs before committing.',
    intro:'This private beta does not publish production pricing yet. A production transaction must show every fee before either party confirms payment.',
    sections:[
      {title:'Sandbox testing only',body:'Stripe Sandbox is used for testing. Live U.S. payment methods, transaction limits, and fees depend on approved provider availability.'},
      {title:'What the final quote should show',body:'Item price, Dealivra fee, payment processing, shipping, insurance, applicable taxes, and the final U.S. dollar amount.'},
      {title:'United States launch',body:'The first release is English-only and U.S.-only. State availability may depend on payment-provider approval and applicable law.'}
    ]
  },
  disputes:{
    eyebrow:'DISPUTES & REFUNDS',title:'A problem should stop the normal release path.',
    intro:'Dealivra keeps the dispute reason, messages, delivery evidence, inspection record, and financial resolution together.',
    sections:[
      {title:'Open a dispute',body:'Report non-delivery, damage, a material mismatch, suspected counterfeit goods, or another documented problem.'},
      {title:'Add evidence',body:'Upload relevant photos, shipment records, inspection details, and messages without sharing passwords or full payment credentials.'},
      {title:'Possible outcomes',body:'A production policy may support release, full refund, partial refund, or return. Exact rights require provider terms and legal review.'}
    ]
  },
  terms:{
    eyebrow:'TERMS',title:'Beta terms and important limitations.',
    intro:'Dealivra is a private beta for recording transaction facts, consent, payment state, evidence, and handoff activity.',
    sections:[
      {title:'Not legal advice or legal escrow',body:'The current beta must not be treated as a licensed escrow service, legal opinion, authenticity guarantee, or ownership guarantee.'},
      {title:'Users remain responsible',body:'Users must provide accurate information, comply with applicable law, and avoid prohibited goods or unsafe payment requests.'},
      {title:'Production review required',body:'Binding terms, refund rights, fees, supported markets, and dispute rules require specialist legal and payments review before launch.'}
    ]
  },
  privacy:{
    eyebrow:'PRIVACY',title:'Collect only what the deal needs.',
    intro:'Dealivra is designed to keep transaction information in one private record and avoid exposing personal contact details unnecessarily.',
    sections:[
      {title:'Sensitive payment data',body:'Card and bank details are handled by the payment provider and are not stored by Dealivra.'},
      {title:'Media privacy',body:'Uploaded item media is prepared to remove location and camera metadata before storage.'},
      {title:'Access and retention',body:'A production privacy policy must define data categories, lawful bases, retention periods, user rights, subprocessors, and international transfers.'}
    ]
  }
};

type PageMetadata={label:string;title:string;description:string;path:string;indexable:boolean};
const siteOrigin='https://dealivra.com';
const privateViewLabels:Partial<Record<View,string>>={
  auth:'Dealivra account',create:'Start a deal',published:'Deal Link ready',deal:'Deal record',profile:'Trust profile',
  passport:'Digital Trust Passport',admin:'Admin',forgot:'Reset password',reset:'Choose a new password','link-error':'Deal Link unavailable',
  verify:'Verify an agreement'
};
const getPageMetadata=(view:View,activeDeal?:Deal):PageMetadata=>{
  if(view==='home')return {
    label:'Home',
    title:'Dealivra — Private Deals, Made Clear',
    description:'Create one trusted record for the agreement, payment state, evidence, delivery, and handoff.',
    path:'/',
    indexable:true
  };
  if(view==='verify')return {
    label:'Verify an agreement',
    title:'Verify an Agreement — Dealivra',
    description:'Compare a saved Dealivra agreement code without signing in.',
    path:verifyPath,
    indexable:true
  };
  if(Object.prototype.hasOwnProperty.call(publicInfoContent,view)){
    const content=publicInfoContent[view as PublicInfoView];
    return {label:content.title,title:`Dealivra — ${content.title}`,description:content.intro,path:publicInfoPaths[view as PublicInfoView],indexable:true};
  }
  const label=view==='deal'&&activeDeal?.title?activeDeal.title:(privateViewLabels[view]||'Private workspace');
  return {
    label,
    title:`${label} — Dealivra`,
    description:'Private Dealivra workspace for protected transaction records.',
    path:'/',
    indexable:false
  };
};
const upsertNamedMeta=(name:string,content:string)=>{
  let element=document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if(!element){element=document.createElement('meta');element.name=name;document.head.append(element)}
  element.content=content;
};
const upsertPropertyMeta=(property:string,content:string)=>{
  let element=document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if(!element){element=document.createElement('meta');element.setAttribute('property',property);document.head.append(element)}
  element.content=content;
};
const applyPageMetadata=(metadata:PageMetadata)=>{
  const title=t(metadata.title);
  const description=t(metadata.description);
  const canonicalUrl=`${siteOrigin}${metadata.path}`;
  document.title=title;
  upsertNamedMeta('description',description);
  upsertNamedMeta('robots',metadata.indexable?'index,follow,max-image-preview:large':'noindex,nofollow,noarchive');
  upsertNamedMeta('twitter:title',title);
  upsertNamedMeta('twitter:description',description);
  upsertPropertyMeta('og:title',title);
  upsertPropertyMeta('og:description',description);
  upsertPropertyMeta('og:url',canonicalUrl);
  let canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}
  canonical.href=canonicalUrl;
};

function PublicInfoPage({view,onBack,onCreate}:{view:PublicInfoView;onBack:()=>void;onCreate:()=>void}){
  const content=publicInfoContent[view];
  return <section className="public-info-page">
    <button className="back" onClick={onBack}>← {t('Back to home')}</button>
    <p className="eyebrow">{t(content.eyebrow)}</p>
    <h1>{t(content.title)}</h1>
    <p className="lede small">{t(content.intro)}</p>
    <div className="public-info-grid">{content.sections.map(section=><article key={section.title}><ShieldCheck/><div><h2>{t(section.title)}</h2><p>{t(section.body)}</p></div></article>)}</div>
    <div className="legal-caution"><ShieldAlert/><p>{t('Important: production payment protection, fees, refunds, and dispute rights depend on licensed providers, applicable law, and final legal terms.')}</p></div>
    <button className="global-primary" onClick={onCreate}>{t('Start a deal')}<ArrowRight size={18}/></button>
  </section>
}

export function App() {
  const initialSession=getStoredSession();
  const [recoveredCreateDraft]=useState(()=>initialSession?null:readGuestCreateDraft());
  const entryIntent=new URLSearchParams(location.search).get('start');
  const recoveryParams=new URLSearchParams(location.hash.slice(1));const recoveryToken=recoveryParams.get('type')==='recovery'?recoveryParams.get('access_token')||'':'';
  const entryView:View=recoveryToken?'reset':entryIntent==='create'?'create':entryIntent==='signin'||entryIntent==='signup'?'auth':viewFromPath();
  const [view,setView]=useState<View>(entryView); const [deals,setDeals]=useState<Deal[]>([]); const [active,setActive]=useState<Deal>(); const [draft,setDraft]=useState<DealDraft>(()=>recoveredCreateDraft?.draft||{...initial}); const [buyer,setBuyer]=useState('');
  const [session,setSession]=useState<StoredSession|null>(initialSession);
  const user=session?.user??null;
  const [authMode,setAuthMode]=useState<'signin'|'signup'>(entryIntent==='signin'?'signin':'signup');
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [passwordVisible,setPasswordVisible]=useState(false);
  const [acceptedPolicies,setAcceptedPolicies]=useState(false);
  const [returnAfterAuth,setReturnAfterAuth]=useState<View>(entryIntent==='create'?'create':'home');
  const [authForm,setAuthForm]=useState({displayName:'',email:'',password:''});
  const [authMessage,setAuthMessage]=useState('');
  const [photos,setPhotos]=useState<File[]>([]);
  const [dealTemplate,setDealTemplate]=useState<DealTemplateId>(()=>recoveredCreateDraft?.dealTemplate||'phone');
  const [catalogSelection,setCatalogSelection]=useState<SmartCatalogSelection>(()=>recoveredCreateDraft?.catalogSelection||emptySmartCatalogSelection());
  const catalogSelectionRef=useRef(catalogSelection);
  const [vehicleVinLookup,setVehicleVinLookup]=useState<VehicleVinLookupState>({status:'idle',message:''});
  const [agreementChecks,setAgreementChecks]=useState({item:false,price:false,handoff:false});
  const [demoCompleted,setDemoCompleted]=useState(false);
  const [acceptanceProtected,setAcceptanceProtected]=useState(false);
  const [buyerAccessCode,setBuyerAccessCode]=useState('');
  const [paymentReadyByDeal,setPaymentReadyByDeal]=useState<Record<string,boolean>>({});
  const [actionPlanByDeal,setActionPlanByDeal]=useState<Record<string,DealActionPlan>>({});
  const [shippingReadinessByDeal,setShippingReadinessByDeal]=useState<Record<string,ShippingNavigationReadiness>>({});
  const [evidenceRevision,setEvidenceRevision]=useState(0);
  const [creating,setCreating]=useState(false);
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
  const [publicPassport,setPublicPassport]=useState<TrustPassport|null>(null);
  const [passportMessage,setPassportMessage]=useState('');
  const [savedDeals,setSavedDeals]=useState<Deal[]>([]);
  const [verificationMessage,setVerificationMessage]=useState('');
  const [notifications,setNotifications]=useState<DealNotification[]>([]);
  const [isAdmin,setIsAdmin]=useState(false);
  const [clock,setClock]=useState(Date.now());
  const previousViewRef=useRef<View>(view);
  useEffect(()=>{applyPageMetadata(getPageMetadata(view,active))},[view,active?.title]);
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
    const scrollToLocation=()=>{
      const id=location.hash.slice(1);
      window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>id
        ?document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})
        :window.scrollTo({top:0,behavior:'smooth'})));
    };
    const onPopState=()=>{
      const nextView=viewFromPath();
      setView(nextView);
      setMobileMenuOpen(false);
      if(nextView==='home')scrollToLocation();
    };
    if(entryView==='home'&&location.hash)scrollToLocation();
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[]);
  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{if(view==='auth'&&!isSupabaseConfigured)setAuthMessage('Account service is temporarily unavailable. Please try again later.')},[view,authMode]);
  useEffect(()=>{const updated=(event:Event)=>setSession((event as CustomEvent<StoredSession>).detail);const expired=()=>{setSession(null);setAuthMessage('Your session expired. Please sign in again.');setView('auth')};window.addEventListener(sessionUpdatedEvent,updated);window.addEventListener(sessionExpiredEvent,expired);return()=>{window.removeEventListener(sessionUpdatedEvent,updated);window.removeEventListener(sessionExpiredEvent,expired)}},[]);
  useEffect(()=>{if(!session)return;const recordActivity=()=>markSessionActivity();const events=['pointerdown','keydown','touchstart'] as const;events.forEach(event=>window.addEventListener(event,recordActivity,{passive:true}));window.addEventListener('focus',recordActivity);return()=>{events.forEach(event=>window.removeEventListener(event,recordActivity));window.removeEventListener('focus',recordActivity)}},[session?.user.id]);
  useEffect(()=>{if(session){listUserDeals(session).then(setDeals).catch(()=>setDeals([]))}else{demoRepository.list().then(setDeals)}},[session]);
  useEffect(()=>{if(session)getMySavedDeals(session).then(setSavedDeals).catch(()=>setSavedDeals([]));else setSavedDeals([])},[session]);
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
        version:1,
        savedAt,
        draft:{...draft,serialNumber:''},
        dealTemplate,
        catalogSelection,
        createStep,
        reviewingDraft
      });
      setDraftSavedAt(savedAt);
    },450);
    return()=>window.clearTimeout(timer);
  },[draft,dealTemplate,catalogSelection,createStep,reviewingDraft,session]);
  useEffect(()=>{if(!session)return;const renew=()=>{if(!session.expiresAt||session.expiresAt-Date.now()<10*60*1000)refreshSession(session).then(setSession).catch(()=>{void signOut(session);setSession(null);setAuthMessage('Your session expired. Please sign in again.');setView('auth')})};renew();const timer=setInterval(renew,5*60*1000);return()=>clearInterval(timer)},[session?.user.id,session?.expiresAt]);
  useEffect(()=>{catalogSelectionRef.current=catalogSelection},[catalogSelection]);
  useEffect(()=>{if(!session){setNotifications([]);return}const load=()=>getMyNotifications(session).then(setNotifications).catch(()=>setNotifications([]));void load();const timer=window.setInterval(()=>void load(),30_000);return()=>window.clearInterval(timer)},[session?.accessToken]);
  useEffect(()=>{if(view!=='deal'||!active||!session)return;setNotifications(items=>items.map(item=>item.deal_id===active.id?{...item,is_read:true}:item));void markDealNotificationsRead(session,active.id).catch(()=>{})},[view,active?.id,session?.accessToken]);
  useEffect(()=>{if(session)getAdminAccess(session).then(setIsAdmin).catch(()=>setIsAdmin(false));else setIsAdmin(false)},[session]);
   useEffect(()=>{const params=new URLSearchParams(location.search);const trustId=params.get('trust');const publicId=params.get('deal');if(trustId){setView('passport');setPassportMessage('');getPublicTrustPassport(trustId).then(passport=>{if(passport)setPublicPassport(passport);else setPassportMessage('Passport unavailable')}).catch(error=>setPassportMessage(error instanceof Error?error.message:'Passport unavailable'))}else if(publicId){const loadDeal=publicId===DEMO_DEAL_PUBLIC_ID?demoRepository.list().then(items=>{const deal=items.find(item=>item.publicId===publicId);if(!deal)throw new Error('Deal Link unavailable');return {...deal,viewerRole:'visitor' as const}}):getPublicDeal(publicId);loadDeal.then(deal=>{setActive(deal);setView('deal')}).catch(error=>{setAuthMessage(error instanceof Error?error.message:'Deal Link unavailable');setView('link-error')})}},[]);
  useEffect(()=>{setBuyer('');setBuyerAccessCode('');setAgreementChecks({item:false,price:false,handoff:false});setDemoCompleted(false)},[active?.publicId,active?.agreementVersion]);
  useEffect(()=>{let current=true;setAcceptanceProtected(false);if(!active||active.status!=='published')return;getDealAcceptanceProtection(active.publicId).then(enabled=>{if(current)setAcceptanceProtected(enabled)}).catch(()=>{});return()=>{current=false}},[active?.publicId,active?.status]);
  useEffect(()=>{
    if(!active||!session||active.viewerRole!=='seller'||active.status!=='accepted'||active.deliveryMethod!=='Ship to buyer')return;
    let current=true;
    const dealId=active.id;
    setShippingReadinessByDeal(items=>({...items,[dealId]:{loaded:false,ready:false}}));
    getSellerShippingEvidenceReadiness(session,dealId)
      .then(readiness=>{if(current)setShippingReadinessByDeal(items=>({...items,[dealId]:{loaded:true,ready:Boolean(readiness?.ready)}}))})
      .catch(()=>{if(current)setShippingReadinessByDeal(items=>({...items,[dealId]:{loaded:true,ready:false}}))});
    return()=>{current=false};
  },[active?.id,active?.viewerRole,active?.status,active?.deliveryMethod,session?.accessToken,evidenceRevision]);
  const focusCreateField=(fieldId:string)=>{const field=document.getElementById(fieldId);field?.focus({preventScroll:true});field?.scrollIntoView({behavior:'smooth',block:'center'})};
  const chooseDealTemplate=(template:DealTemplateId)=>{
    if(template===dealTemplate)return;
    const emptySelection=emptySmartCatalogSelection();
    setDealTemplate(template);
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
    if(dealTemplate!=='vehicle'||!identifierEntered||!identifierValid||vehicleVinLookup.status==='loading')return;
    setVehicleVinLookup({status:'loading',message:'Checking manufacturer data…'});
    try{
      const result=await decodeVehicleVin(draft.serialNumber);
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
      setVehicleVinLookup({
        status:'error',
        message:error instanceof Error?error.message:'VIN could not be checked. Enter the details manually.',
      });
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
  const goToCreateStep=(step:CreateFlowStep)=>{if(step>createAvailableStep)return;setAuthMessage('');setCreateValidationAttempted(false);setReviewingDraft(step===4);if(step<4)setCreateStep(step);window.requestAnimationFrame(()=>document.getElementById('create-deal-flow')?.scrollIntoView({behavior:'smooth',block:'start'}))};
  const reviewDraft=(e:React.FormEvent)=>{e.preventDefault();setAuthMessage('');if(!createItemReady){setCreateStep(1);return}if(!createTermsReady){setCreateStep(2);return}setReviewingDraft(true);window.scrollTo({top:0,behavior:'smooth'})};
  const resetCreateFlow=()=>{const emptySelection=emptySmartCatalogSelection();clearGuestCreateDraft();setDraft({...initial});setPhotos([]);setDealTemplate('phone');setVehicleVinLookup({status:'idle',message:''});catalogSelectionRef.current=emptySelection;setCatalogSelection(emptySelection);setCreateStep(1);setReviewingDraft(false);setCreateValidationAttempted(false);setSellerDeclarations(emptySellerDeclarations);setPendingCreateAction(null);setDraftRecovered(false);setDraftSavedAt(null)};
  const publishDraft=async(activeSession:StoredSession)=>{if(creating)return;setCreating(true);setAuthMessage('');try{let deal=await createUserDeal(activeSession,draft);setDeals(x=>[deal,...x]);setActive(deal);if(photos.length){try{const mediaUrls=await uploadDealPhotos(activeSession,deal.id,photos);deal={...deal,mediaUrls};setActive(deal);setDeals(items=>items.map(item=>item.id===deal.id?deal:item))}catch(error){setAuthMessage(`Deal created, but photos need to be added again: ${error instanceof Error?error.message:'upload failed'}`)}}resetCreateFlow();setActive(deal);setView('published')}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not save this deal');setView('create')}finally{setCreating(false)}};
  const saveDraftForSession=async(activeSession:StoredSession)=>{if(creating)return;setCreating(true);setAuthMessage('');try{let deal=await saveUserDealDraft(activeSession,draft);setDeals(items=>[deal,...items]);setActive(deal);if(photos.length){try{const mediaUrls=await uploadDealPhotos(activeSession,deal.id,photos);deal={...deal,mediaUrls};setActive(deal);setDeals(items=>items.map(item=>item.id===deal.id?deal:item))}catch(error){setAuthMessage(`Draft saved, but photos need to be added again: ${error instanceof Error?error.message:'upload failed'}`)}}resetCreateFlow();setView('deal')}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not save draft');setView('create')}finally{setCreating(false)}};
  const requestCreateAction=(action:'save'|'publish')=>{
    if(session){void (action==='publish'?publishDraft(session):saveDraftForSession(session));return}
    setPendingCreateAction(action);
    setReturnAfterAuth('create');
    setAuthMode('signup');
    setAuthMessage('');
    setView('auth');
  };
  const open=(d:Deal)=>{setActive(d);setView('deal')};
  const agreementConfirmed=Object.values(agreementChecks).every(Boolean);
  const accept=async()=>{if(!active||!buyer.trim()||!agreementConfirmed)return;if(active.publicId===DEMO_DEAL_PUBLIC_ID&&!session){setDemoCompleted(true);setAuthMessage('');window.requestAnimationFrame(()=>window.requestAnimationFrame(scrollToAgreement));return}if(isDealExpired(active)){setAuthMessage('This Deal Link can no longer be accepted.');return}if(acceptanceProtected&&!/^[0-9]{6}$/.test(buyerAccessCode)){setAuthMessage('Enter the 6-digit buyer code.');return}if(!session){setAuthMessage('Sign in or create an account to accept this deal.');setReturnAfterAuth('deal');setView('auth');return}try{await acceptPublicDeal(session,active.publicId,buyer.trim(),buyerAccessCode);const deal={...active,status:'accepted' as const,buyerName:buyer.trim(),buyerVerification:'not_started' as const,viewerRole:'buyer' as const};setActive(deal);setAcceptanceProtected(false);setDeals(x=>x.map(d=>d.id===deal.id?deal:d))}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not accept this deal')}};
  const openCreate=()=>{setAuthMessage('');if(session||!isCreateDraftMeaningful(draft,dealTemplate))resetCreateFlow();setView('create')};
  const openDemo=async()=>{const sample=deals.find(deal=>deal.publicId===DEMO_DEAL_PUBLIC_ID)||(await demoRepository.list())[0];if(!sample)return;setAuthMessage('');setBuyer('');setAgreementChecks({item:false,price:false,handoff:false});setDemoCompleted(false);setActive({...sample,viewerRole:'visitor'});setView('deal');window.scrollTo({top:0,behavior:'smooth'})};
  const finishAuthentication=async(nextSession:StoredSession)=>{
    setSession(nextSession);
    if(returnAfterAuth==='create'&&pendingCreateAction){
      const action=pendingCreateAction;
      setPendingCreateAction(null);
      setView('create');
      await (action==='publish'?publishDraft(nextSession):saveDraftForSession(nextSession));
      return;
    }
    setView(returnAfterAuth);
  };
  const submitAuth=async(e:React.FormEvent)=>{e.preventDefault();setAuthMessage('');try{if(authMode==='signup'){const result=await signUp(authForm.email,authForm.password,authForm.displayName);if(result.session)await finishAuthentication(result.session);else setAuthMessage('Check your email to confirm your account, then return to this tab and sign in. Your completed draft will stay here.')}else{const nextSession=await signIn(authForm.email,authForm.password);await finishAuthentication(nextSession)}}catch(error){setAuthMessage(error instanceof Error?error.message:'Something went wrong')}};
  const logout=()=>{void signOut(session);setSession(null);setIsAdmin(false);setView('home')};
  const openProfile=async()=>{if(!session)return;setAuthMessage('');setView('profile');try{setProfile(await getMyProfileSummary(session))}catch(error){setAuthMessage(error instanceof Error?error.message:'Could not load profile')}};
  const requestVerification=async()=>{if(!session||!profile)return;setVerificationMessage('');try{const status=await requestIdentityVerification(session);setProfile({...profile,verification_status:status});setVerificationMessage('Request recorded. A verification provider must be connected before identity can be approved.')}catch(error){setVerificationMessage(error instanceof Error?error.message:'Could not request verification')}};
  const refreshSavedDeals=()=>{if(session)getMySavedDeals(session).then(setSavedDeals).catch(()=>setSavedDeals([]))};
  const markAllActivityRead=()=>{if(!session)return;setNotifications(items=>items.map(item=>({...item,is_read:true})));void markAllNotificationsRead(session).catch(()=>getMyNotifications(session).then(setNotifications).catch(()=>{}))};
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
  const agreementActionReady=agreementConfirmed&&Boolean(buyer.trim())&&!demoFlowCompleted;
  const scrollToAgreement=()=>{
    const agreement=document.querySelector<HTMLElement>('.deal-grid aside');
    agreement?.scrollIntoView({behavior:'smooth',block:'start'});
    agreement?.setAttribute('tabindex','-1');
    agreement?.focus({preventScroll:true});
  };
  const scrollToDealSection=(id:string)=>{
    const section=document.getElementById(id)||document.getElementById('deal-actions');
    if(!section)return;
    const expandable=section instanceof HTMLDetailsElement?section:section?.closest('details');
    if(expandable instanceof HTMLDetailsElement)expandable.open=true;
    section.classList.remove('deal-target-highlight');
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      section.scrollIntoView({behavior:'smooth',block:'center'});
      section.setAttribute('tabindex','-1');
      section.focus({preventScroll:true});
      section.classList.add('deal-target-highlight');
      window.setTimeout(()=>section.classList.remove('deal-target-highlight'),1400);
    }));
  };
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
    ? demoFlowCompleted
      ? {label:'Start a deal',detail:'Create your own private Deal Link.',targetId:'deal-overview',kind:'create'}
      : activeExpired
      ? {label:'Review status',detail:'This offer has expired.',targetId:'deal-safety',kind:'scroll'}
      : active.status==='draft'
        ? {label:'Finish draft',detail:'Complete the details and publish when ready.',targetId:'deal-manage',kind:'scroll'}
        : active.status==='published'&&active.viewerRole!=='seller'
          ? {label:agreementActionReady?'Accept terms':'Review agreement',detail:agreementActionReady?'Your confirmations are complete.':'Confirm the item, price, handoff, and your name.',targetId:'deal-agreement',kind:agreementActionReady?'accept':'scroll'}
          : active.status==='published'
            ? {label:'Share with buyer',detail:'Copy the Deal Link or invite the buyer.',targetId:'deal-actions',kind:'scroll'}
            : active.status==='accepted'&&(!session||active.viewerRole==='visitor')
              ? {label:'Sign in to continue',detail:'Sign in to access payment and delivery actions.',targetId:'deal-actions',kind:'signin'}
              : active.status==='accepted'&&!activePaymentReady
                ? {label:active.viewerRole==='seller'?'Set up payment':'Continue payment',detail:active.viewerRole==='seller'?'Connect payouts so the buyer can pay.':'Open the Stripe Sandbox payment step.',targetId:'payment-status-panel',kind:'scroll'}
                : active.status==='accepted'&&active.deliveryMethod==='Ship to buyer'
                  ? getShippingPrimaryAction(active,activeActionPlan,activeShippingReadiness)
                  : active.status==='accepted'
                    ? {label:'Plan handoff',detail:'Arrange and complete the in-person exchange.',targetId:'meeting-panel',kind:'scroll'}
                    : active.status==='completed'&&session&&active.viewerRole!=='visitor'
                      ? {label:'Finish deal',detail:'Review the receipt or rate the other party.',targetId:'rating-panel',kind:'scroll'}
                      : {label:'Review status',detail:'See the current record and safety actions.',targetId:active.status==='disputed'||active.status==='cancelled'?'deal-safety':'deal-records',kind:'scroll'}
    : null;
  const dealNextStep=dealPrimaryAction?.detail||(!active?'Review the deal':active.status==='completed'?'Deal completed':'Review the current deal status');
  const runDealPrimaryAction=()=>{
    if(!dealPrimaryAction)return;
    if(dealPrimaryAction.kind==='create'){openCreate();return}
    if(dealPrimaryAction.kind==='accept'){void accept();return}
    if(dealPrimaryAction.kind==='signin'){setReturnAfterAuth('deal');setView('auth');return}
    if(dealPrimaryAction.targetId==='deal-agreement'){scrollToAgreement();return}
    scrollToDealSection(dealPrimaryAction.targetId);
  };
  const goHomeSection=(id?:string)=>{
    const destination=id?`/#${id}`:'/';
    if(`${location.pathname}${location.search}${location.hash}`!==destination)history.pushState({},'',destination);
    setView('home');
    setMobileMenuOpen(false);
    setAuthMessage('');
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>id
      ?document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})
      :window.scrollTo({top:0,behavior:'smooth'})));
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
  const openInfo=(next:PublicInfoView)=>{history.pushState({},'',publicInfoPaths[next]);setView(next);setMobileMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'})};
  const openVerify=()=>{history.pushState({},'',verifyPath);setView('verify');setMobileMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'})};
  const currentPageLabel=getPageMetadata(view,active).label;
  const agreementDocumentMode=view==='deal'&&new URLSearchParams(location.search).get('document')==='1';
  const pendingCreateLabel=pendingCreateAction==='save'?'save this draft':'publish this deal';
  const pendingAuthTitle=authMode==='signup'?`Create your account to ${pendingCreateLabel}.`:`Sign in to ${pendingCreateLabel}.`;
  const pendingAuthAction=authMode==='signup'
    ? pendingCreateAction==='save'?'Create account & save':'Create account & publish'
    : pendingCreateAction==='save'?'Sign in & save':'Sign in & publish';
  const createDraftRecoveryVisible=!session&&isCreateDraftMeaningful(draft,dealTemplate);
  const createDraftRecoveryTime=draftSavedAt?new Date(draftSavedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Saving…';

  return <div className={`app view-${view}${agreementDocumentMode?' agreement-document-view':''}${demoFlowCompleted?' demo-flow-complete':''}`}>
    <a className="skip-link" href="#main-content">{t('Skip to main content')}</a>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{t(currentPageLabel)}</div>
    <header className="site-header"><div className="header-inner">
      <div className="header-brand-group"><a className="brand" href="/" aria-label="Dealivra home" onClick={event=>followHomeLink(event)}><BrandLogo/></a><span className="beta">Launching in the U.S.</span></div>
      <nav className="site-nav" aria-label={t('Primary navigation')}><a href="/" onClick={event=>followHomeLink(event)}>{t(user?'Dashboard':'Home')}</a><a href="/#how-it-works" onClick={event=>followHomeLink(event,'how-it-works')}>{t('How it works')}</a><a href="/#protection" onClick={event=>followHomeLink(event,'protection')}>{t('Protection')}</a><a href={publicInfoPaths.fees} onClick={event=>followInfoLink(event,'fees')}>{t('Fees')}</a></nav>
      <div className="header-actions">{user&&<button className="header-create" onClick={openCreate}><Plus size={16}/><span>{t('New deal')}</span></button>}<div className="account">{user?<>{isAdmin&&<button className="admin-link" onClick={()=>setView('admin')}><ShieldCheck size={15}/>{t('Admin')}</button>}<button onClick={openProfile}>{user.displayName}</button><button onClick={logout}>{t('Sign out')}</button></>:<><button onClick={()=>{setAuthMode('signin');setReturnAfterAuth('home');setView('auth')}}>{t('Sign in')}</button><button className="header-signup" onClick={()=>{setAuthMode('signup');setReturnAfterAuth('home');setView('auth')}}>{t('Create account')}</button></>}</div><button className="mobile-menu-toggle" aria-label={t(mobileMenuOpen?'Close menu':'Open menu')} aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(open=>!open)}>{mobileMenuOpen?<X/>:<Menu/>}</button></div>
    </div></header>
    {mobileMenuOpen&&<nav className="mobile-menu" aria-label={t('Mobile navigation')}>
      <a href="/" onClick={event=>followHomeLink(event)}>{t(user?'Dashboard':'Home')}</a>
      <a href="/#how-it-works" onClick={event=>followHomeLink(event,'how-it-works')}>{t('How it works')}</a>
      <a href="/#protection" onClick={event=>followHomeLink(event,'protection')}>{t('Protection')}</a>
      <a href={publicInfoPaths.fees} onClick={event=>followInfoLink(event,'fees')}>{t('Fees')}</a>
      <a href={publicInfoPaths.disputes} onClick={event=>followInfoLink(event,'disputes')}>{t('Disputes')}</a>
      {!user&&<><button className="mobile-signin" onClick={()=>{setAuthMode('signin');setReturnAfterAuth('home');setView('auth');setMobileMenuOpen(false)}}>{t('Sign in')}</button><button className="mobile-signup" onClick={()=>{setAuthMode('signup');setReturnAfterAuth('home');setView('auth');setMobileMenuOpen(false)}}>{t('Create account')}</button></>}
    </nav>}
    <main id="main-content" tabIndex={-1}>
      {view==='auth'&&authMode==='signin'&&<div className="forgot-entry"><button onClick={()=>setView('forgot')}>{t('Forgot password?')}</button></div>}
      {view==='forgot'&&<ForgotPassword onBack={()=>setView('auth')}/>}
      {view==='reset'&&recoveryToken&&<ResetPassword token={recoveryToken} onDone={()=>setView('auth')}/>}
      {view==='link-error'&&<DealLinkError message={authMessage} onBack={()=>goHomeSection()}/>}
      {view==='verify'&&<section className="agreement-verifier-page"><button className="back" onClick={()=>goHomeSection()}>← {t('Back to home')}</button><p className="eyebrow">{t('Agreement verification')}</p><h1>{t('Verify an agreement')}</h1><p className="lede small">{t('Use the Deal ID and SHA-256 agreement code saved with the record.')}</p><AgreementVerifier/></section>}
      {Object.prototype.hasOwnProperty.call(publicInfoPaths,view)&&<PublicInfoPage view={view as PublicInfoView} onBack={()=>goHomeSection()} onCreate={openCreate}/>}
      {view==='home'&&<InstallApp/>}
      {view==='admin'&&session&&isAdmin&&<><AdminRevenueCenter session={session} onOpenDeal={deal=>{setActive(deal);setView('deal')}}/><AdminDisputeCenter session={session}/><AdminReportCenter session={session} onBack={()=>setView('home')} onOpenDeal={deal=>{setActive(deal);setView('deal')}}/></>}
      {view==='published'&&active&&<PublishedDealSuccess deal={active} warning={authMessage} session={session} acceptanceProtected={acceptanceProtected} onProtectionChanged={setAcceptanceProtected} onOpen={()=>{setAuthMessage('');setView('deal')}} onDashboard={()=>goHomeSection()} onCreateAnother={openCreate}/>}
      {view==='create'&&authMessage&&<div className="creation-error notice">{t(authMessage)}</div>}
      {view==='create'&&creating&&<div className="creation-progress notice">{t('Creating your Deal Link…')}</div>}
      {view==='deal'&&active&&!isDemoActive&&<div className="deal-workspace-sections">
        <DealWorkspaceGroup id="deal-actions" icon={ArrowRight} kicker="NEXT ACTIONS" title="What to do now" summary={dealNextStep} defaultOpen>
          {session&&(['accepted','completed','disputed','cancelled'] as Deal['status'][]).includes(active.status)&&<DealActionPlanCard deal={active} session={session} onSync={plan=>applyDealActionPlan(active.id,plan)}/>}
          <DealExpiry deal={active} now={clock}/>
          <div className="deal-trust-grid">
            <DealReadiness deal={active} onOpenProfile={active.viewerRole==='seller'&&session?openProfile:undefined} onEditDetails={active.viewerRole==='seller'&&session&&active.status==='published'&&!activeExpired?()=>{const toggle=document.getElementById('deal-editor-toggle') as HTMLButtonElement|null;const editor=document.getElementById('deal-editor');if(toggle?.textContent?.includes(t('Edit details')))toggle.click();window.setTimeout(()=>editor?.scrollIntoView({behavior:'smooth',block:'center'}),0)}:undefined}/>
            {session&&(['accepted','completed','disputed','cancelled'] as Deal['status'][]).includes(active.status)&&<DealParticipantsCard deal={active} session={session} onLoaded={participants=>applyDealParticipants(active.id,participants)}/>}
          </div>
          {active.viewerRole!=='seller'&&!(['draft','cancelled'] as Deal['status'][]).includes(active.status)&&<SaveDealButton deal={active} session={session} onChanged={refreshSavedDeals} onSignIn={()=>{setReturnAfterAuth('deal');setView('auth')}}/>}
          {active.viewerRole==='seller'&&active.status==='published'&&!activeExpired&&<BuyerInvitePanel deal={active}/>}
          {active.viewerRole!=='seller'&&active.status==='published'&&!activeExpired&&acceptanceProtected&&<BuyerAccessCodeEntry value={buyerAccessCode} onChange={setBuyerAccessCode}/>}
          {active.status==='published'&&<DealInquiries deal={active} session={session} onSignIn={()=>{setReturnAfterAuth('deal');setView('auth')}}/>}
          {session&&active.status==='published'&&!activeExpired&&<OfferPanel deal={active} session={session} onAccepted={amount=>{const updated={...active,priceCents:amount,status:'accepted' as const};setActive(updated);setDeals(items=>items.map(item=>item.id===active.id?updated:item))}}/>}
          {session&&active.viewerRole!=='visitor'&&(['accepted','completed','disputed','cancelled'] as Deal['status'][]).includes(active.status)&&<div className="deal-fulfillment-grid is-single">
            <ProtectedPaymentPanel deal={active} session={session} onChanged={ready=>setPaymentReadyByDeal(current=>({...current,[active.id]:ready}))}/>
          </div>}
          {session&&active.viewerRole==='seller'&&active.deliveryMethod==='Ship to buyer'&&(['accepted','completed'] as Deal['status'][]).includes(active.status)&&<div className="deal-shipping-protection is-prerequisite">
            <div className="deal-shipping-protection-intro">
              <span className="shipping-sequence-number" aria-hidden="true">1</span>
              <div><p className="eyebrow">{t('Step 1 · Required before shipping')}</p><h2>{t('Prepare the protected shipping record')}</h2><p>{t('Document the condition, packing, weight, and serial number first. Shipping unlocks automatically when the required evidence is saved.')}</p></div>
            </div>
            <EvidencePanel deal={active} session={session} onChanged={()=>setEvidenceRevision(value=>value+1)}/>
          </div>}
          {session&&active.viewerRole!=='visitor'&&active.deliveryMethod==='Ship to buyer'&&(['accepted','completed'] as Deal['status'][]).includes(active.status)&&<div className={`deal-shipping-stage ${active.viewerRole==='seller'?'follows-evidence':''}`}>
            {active.viewerRole==='seller'&&<div className="deal-shipping-stage-marker">
              <span aria-hidden="true">2</span>
              <div><p className="eyebrow">{t('Step 2 · Shipping')}</p><strong>{t('Add carrier and tracking')}</strong><small>{t('This step becomes available as soon as the required package evidence is complete.')}</small></div>
              <ArrowRight aria-hidden="true"/>
            </div>}
            <div id="shipping-panel"><ShippingPanel deal={active} session={session} paymentReady={Boolean(paymentReadyByDeal[active.id])} evidenceRevision={evidenceRevision} onProgressChanged={()=>void refreshDealActionPlan(active.id)} onDelivered={()=>{const updated={...active,status:'completed' as const};setActive(updated);setDeals(items=>items.map(item=>item.id===active.id?updated:item))}}/></div>
          </div>}
          {session&&active.viewerRole!=='visitor'&&active.deliveryMethod==='Ship to buyer'&&(active.viewerRole!=='seller'||active.status==='disputed')&&(['accepted','completed','disputed'] as Deal['status'][]).includes(active.status)&&<div className="deal-shipping-protection is-arrival-evidence">
            <div className="deal-shipping-protection-intro">
              <span><ShieldCheck/></span>
              <div><p className="eyebrow">{t(active.status==='disputed'?'Issue evidence':'After delivery')}</p><h2>{t(active.status==='disputed'?'Add evidence to the deal record':'Document the item on arrival')}</h2><p>{t(active.status==='disputed'?'Keep photos, videos, and supporting proof tied to this transaction.':'Record the delivery, packaging, and unboxing before using the item.')}</p></div>
            </div>
            <EvidencePanel deal={active} session={session} onChanged={()=>setEvidenceRevision(value=>value+1)}/>
          </div>}
          {session&&active.status==='accepted'&&active.deliveryMethod==='Meet in person'&&active.viewerRole!=='visitor'&&<div id="meeting-panel"><MeetingPanel deal={active} session={session}/></div>}
          {session&&active.status==='accepted'&&active.deliveryMethod==='Meet in person'&&active.viewerRole!=='visitor'&&<div id="handoff-panel"><HandoffPanel deal={active} session={session} paymentReady={Boolean(paymentReadyByDeal[active.id])} onComplete={()=>setActive({...active,status:'completed'})}/></div>}
          {session&&active.status==='completed'&&active.viewerRole!=='visitor'&&<div id="rating-panel"><RatingPanel deal={active} session={session}/></div>}
        </DealWorkspaceGroup>

        <DealWorkspaceGroup id="deal-safety" icon={ShieldCheck} kicker="PROTECTION & SUPPORT" title="Help and issue resolution" summary="Evidence, reporting, disputes, cancellation, and urgent safety actions.">
          {session&&active.viewerRole!=='visitor'&&active.deliveryMethod!=='Ship to buyer'&&(['accepted','completed','disputed'] as Deal['status'][]).includes(active.status)&&<EvidencePanel deal={active} session={session} onChanged={()=>setEvidenceRevision(value=>value+1)}/>}
          {session&&active.viewerRole!=='visitor'&&<DealSafetyActions deal={active} session={session} onStatus={status=>{setActive({...active,status});setDeals(items=>items.map(item=>item.id===active.id?{...item,status}:item))}}/>}
          {active.viewerRole!=='seller'&&!(['draft','cancelled'] as Deal['status'][]).includes(active.status)&&<ReportDealPanel deal={active} session={session} onSignIn={()=>{setReturnAfterAuth('deal');setView('auth')}}/>}
        </DealWorkspaceGroup>

        <DealWorkspaceGroup id="deal-records" icon={FileSignature} kicker="DEAL RECORD" title="Agreement and activity" summary="Versions, receipts, trust checks, and the complete timeline.">
          {active.status!=='draft'&&<AgreementExport deal={active}/>}
          {active.status!=='draft'&&<DealRiskCheck deal={active}/>}
          {active.status!=='draft'&&<PublicSellerDeclaration deal={active}/>}
          {active.status!=='draft'&&<SellerTrustProfile deal={active}/>}
          {active.status!=='draft'&&<AgreementFingerprint deal={active}/>}
          {active.status!=='draft'&&<AgreementHistory deal={active}/>}
          {session&&active.viewerRole!=='visitor'&&(['accepted','completed','disputed','cancelled'] as Deal['status'][]).includes(active.status)&&<ProtectedPaymentReceipt deal={active} session={session}/>}
          {session&&active.status==='completed'&&active.viewerRole!=='visitor'&&<CompletionReceipt deal={active} session={session}/>}
          {session&&active.viewerRole!=='visitor'&&<TimelinePanel deal={active} session={session}/>}
        </DealWorkspaceGroup>

        {session&&active.viewerRole==='seller'&&<DealWorkspaceGroup id="deal-manage" icon={Pencil} kicker="SELLER TOOLS" title="Manage this deal" summary="Edit the listing, sharing controls, photos, and offer expiry.">
          {active.status==='published'&&<DealRenewalPanel deal={active} session={session} onRenewed={(agreementVersion,expiresAt)=>{const updated={...active,agreementVersion,expiresAt};setActive(updated);setDeals(items=>items.map(item=>item.id===active.id?updated:item))}}/>}
          {active.status==='published'&&!activeExpired&&<BuyerAccessCodeManager deal={active} session={session} enabled={acceptanceProtected} onChanged={setAcceptanceProtected}/>}
          {active.status==='draft'&&<SavedDraftPanel deal={active} session={session} onUpdated={updated=>{setActive(updated);setDeals(items=>items.map(item=>item.id===updated.id?updated:item))}}/>}
          {active.status==='published'&&!activeExpired&&<DealEditor deal={active} session={session} onSaved={updated=>{setActive(updated);setDeals(items=>items.map(item=>item.id===updated.id?updated:item))}}/>}
          {active.status!=='cancelled'&&<PhotoManager deal={active} session={session} onAdded={urls=>{const updated={...active,mediaUrls:[...(active.mediaUrls||[]),...urls]};setActive(updated);setDeals(items=>items.map(item=>item.id===active.id?updated:item))}}/>}
          {active.status!=='cancelled'&&<ExistingMediaManager deal={active} session={session} onRemoved={url=>{const updated={...active,mediaUrls:(active.mediaUrls||[]).filter(item=>item!==url)};setActive(updated);setDeals(items=>items.map(item=>item.id===active.id?updated:item))}}/>}
          {active.status!=='cancelled'&&<CoverSelector deal={active} session={session} onReordered={urls=>{const updated={...active,mediaUrls:urls};setActive(updated);setDeals(items=>items.map(item=>item.id===active.id?updated:item))}}/>}
        </DealWorkspaceGroup>}

      </div>}
      {view==='deal'&&active&&session&&active.viewerRole!=='visitor'&&(['accepted','completed','disputed'] as Deal['status'][]).includes(active.status)&&<DealChat deal={active} session={session}/>}
      {view==='home'&&user&&<NotificationCenter items={notifications} deals={deals} onOpen={open} onOpenPublic={publicId=>getPublicDeal(publicId).then(deal=>{setActive(deal);setView('deal')}).catch(error=>setAuthMessage(error instanceof Error?error.message:'Deal Link unavailable'))} onMarkAll={markAllActivityRead}/>}
      {view==='home'&&user&&<SavedDealsPanel items={savedDeals} onOpen={open}/>}
      {view==='home'&&user&&<EnhancedDashboard deals={deals} onOpen={open} onCreate={openCreate}/>}
      {view==='profile'&&profile&&<SecurityCenter email={user?.email||''} status={profile.verification_status} message={verificationMessage} onRequest={requestVerification}/>}
      {view==='profile'&&session&&<TrustPassportControls session={session}/>}
      {view==='profile'&&profile&&session&&<AccountSettings session={session} displayName={profile.display_name} onNameUpdated={name=>setProfile({...profile,display_name:name})}/>}
      {view==='passport'&&<PublicTrustPassportPage profile={publicPassport} message={passportMessage} onBack={()=>goHomeSection()}/>}
      {view==='home'&&!user&&<GlobalHome onCreate={openCreate} onDemo={openDemo} onInfo={openInfo}/>}
      {view==='profile'&&<section className="profile-page"><button className="back" onClick={()=>setView('home')}>← {t('Dashboard')}</button><p className="eyebrow">{t('Trust profile')}</p><h1>{profile?.display_name||user?.displayName}</h1>{authMessage&&<div className="notice">{t(authMessage)}</div>}{profile&&<><div className="profile-stats"><article><span>{t('Average rating')}</span><strong>{profile.average_rating??'—'} <Star size={22}/></strong><small>{profile.rating_count} {t('received')}</small></article><article><span>{t('Completed deals')}</span><strong>{profile.completed_deals}</strong><small>{t('Successful handoffs')}</small></article><article><span>{t('Verification')}</span><strong className="verification-value"><BadgeCheck size={22}/>{t(profile.verification_status.replace('_',' '))}</strong><small>{t('Identity verification comes next')}</small></article></div><div className="profile-details"><h2>{t('Reputation history')}</h2><p>{t('Member since')} {new Date(profile.member_since).toLocaleDateString(getAppLanguage())}</p>{profile.recent_ratings.length?<div className="review-list">{profile.recent_ratings.map((rating,index)=><article key={`${rating.created_at}-${index}`}><div>{'★'.repeat(rating.stars)}{'☆'.repeat(5-rating.stars)}</div><p>{rating.comment||t('No written comment.')}</p><small>{new Date(rating.created_at).toLocaleDateString(getAppLanguage())}</small></article>)}</div>:<div className="empty-state"><Star/><b>{t('No ratings yet')}</b><span>{t('Ratings received after completed deals will appear here.')}</span></div>}</div></>}</section>}
      {view==='auth'&&<section className="form-wrap auth-wrap"><button className="back" onClick={()=>{if(returnAfterAuth==='create'){setPendingCreateAction(null);setView('create');return}setView('home')}}>← {t(returnAfterAuth==='create'?'Back to draft':'Back')}</button><p className="eyebrow">{pendingCreateAction?'FINAL STEP · ACCOUNT':authMode==='signup'?'START YOUR PRIVATE DEAL':'DEALIVRA ACCOUNT'}</p><h1>{t(pendingCreateAction?pendingAuthTitle:(authMode==='signup'?'Create your account to start a deal.':'Welcome back'))}</h1><p className="auth-market-note">{pendingCreateAction?'Your completed draft is ready. Sign in or create an account, and Dealivra will finish the action you selected.':authMode==='signup'?'Save the item, terms, and handoff details in one private record. Setup takes about a minute.':'Sign in to continue your active deals and saved records.'}</p>{authMode==='signup'&&<ol className="auth-journey" aria-label="Deal setup progress"><li className={pendingCreateAction?'is-complete':'is-current'}><span>{pendingCreateAction?<Check size={15}/>:1}</span><div><strong>{pendingCreateAction?'Draft ready':'Account'}</strong><small>{pendingCreateAction?'Item and terms completed':'Create your secure profile'}</small></div></li><li className={pendingCreateAction?'is-current':''}><span>2</span><div><strong>{pendingCreateAction?'Account':'Deal details'}</strong><small>{pendingCreateAction?'Secure your private record':'Add item and terms'}</small></div></li><li><span>3</span><div><strong>Share link</strong><small>Invite the other party</small></div></li></ol>}<form onSubmit={submitAuth}>{authMode==='signup'&&<label>{t('Your name')}<input required minLength={2} maxLength={80} autoComplete="name" placeholder="Alex Morgan" value={authForm.displayName} onChange={e=>setAuthForm({...authForm,displayName:e.target.value})}/></label>}<label>{t('Email')}<input required type="email" autoComplete="email" placeholder="you@example.com" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/></label><label>{t('Password')}<span className="password-field"><input required minLength={authMode==='signup'?12:1} type={passwordVisible?'text':'password'} autoComplete={authMode==='signup'?'new-password':'current-password'} placeholder={t(authMode==='signup'?'12+ characters':'Your password')} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/><button type="button" aria-label={t(passwordVisible?'Hide password':'Show password')} onClick={()=>setPasswordVisible(visible=>!visible)}>{passwordVisible?<EyeOff/>:<Eye/>}</button></span>{authMode==='signup'&&<small>{t('Use 12+ characters with uppercase, lowercase, and a number.')}</small>}</label>{authMode==='signup'&&<label className="policy-consent"><input required type="checkbox" checked={acceptedPolicies} onChange={event=>setAcceptedPolicies(event.target.checked)}/><span>I agree to the beta <a href={publicInfoPaths.terms} onClick={event=>{event.preventDefault();event.stopPropagation();openInfo('terms')}}>Terms</a> and acknowledge the <a href={publicInfoPaths.privacy} onClick={event=>{event.preventDefault();event.stopPropagation();openInfo('privacy')}}>Privacy notice</a>.</span></label>}{authMessage&&<div className="notice" role="status">{t(authMessage)}</div>}<button className="primary full" disabled={authMode==='signup'&&!acceptedPolicies}>{t(pendingCreateAction?pendingAuthAction:(authMode==='signup'?'Create account & continue':'Sign in'))}</button><button type="button" className="switch-auth" onClick={()=>{setAuthMode(authMode==='signup'?'signin':'signup');setAuthMessage('');setPasswordVisible(false);setAcceptedPolicies(false)}}>{t(authMode==='signup'?'Already have an account? Sign in':'New to Dealivra? Create account')}</button></form></section>}
      {view==='create'&&<section id="create-deal-flow" className="create-flow-shell">
        <CreateDealProgress current={reviewingDraft?4:createStep} available={createAvailableStep} onSelect={goToCreateStep}/>
        {createDraftRecoveryVisible&&<section className={`create-draft-recovery ${draftRecovered?'is-recovered':''}`} aria-label={t('Draft recovery')}>
          <span className="create-draft-recovery-icon"><Clock3/></span>
          <div><strong>{t(draftRecovered?'Draft recovered':'Draft recovery is on')}</strong><span aria-live="polite">{t(draftRecovered?'Your item and terms were restored from this device. Review them before publishing.':`Saved privately on this device · ${createDraftRecoveryTime}`)}</span><small>{t('Photos, files, identifiers, and seller confirmations are never stored in browser recovery.')}</small></div>
          <button type="button" onClick={resetCreateFlow}><Trash2 size={15}/>{t('Start over')}</button>
        </section>}
        {!reviewingDraft&&<header className="create-flow-heading"><button className="back" onClick={()=>setView('home')}>← {t(user?'Dashboard':'Home')}</button><p className="eyebrow">{t(createStepMeta[createStep].eyebrow)}</p><h1>{t(createStepMeta[createStep].title)}</h1><p className="lede small">{t(createStepMeta[createStep].description)}</p></header>}
        {!reviewingDraft&&createErrors.length>0&&<CreateValidationSummary errors={createErrors} onSelect={focusCreateField}/>}
        {!reviewingDraft&&createStep===1&&<div className="create-step-layout">
          <DealTemplatePicker selected={dealTemplate} onSelect={chooseDealTemplate}/>
          <section className="form-wrap create-step-card"><form id="create-step-1" noValidate onSubmit={event=>{event.preventDefault();submitCreateStep(1)}}><SmartCatalogFields category={dealTemplate} value={catalogSelection} onChange={updateCatalogSelection}/><label>{t('Item title')}<input id="create-item-title" required minLength={3} maxLength={120} aria-invalid={createErrors.some(error=>error.fieldId==='create-item-title')} aria-describedby="create-item-title-help" placeholder={selectedDealTemplate.titlePlaceholder} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/><small id="create-item-title-help" className={createErrors.some(error=>error.fieldId==='create-item-title')?'field-help invalid':'field-help'}>{t(createErrors.find(error=>error.fieldId==='create-item-title')?.message||(isGuidedCatalogCategory(dealTemplate)?'Auto-filled from your choices; edit it if needed.':'Use the brand, model, and one detail that helps identify the item.'))}</small></label><div className="two"><label>{t('Price')}<span className="price-currency-controls"><input id="create-item-price" required min={currencyStep(draft.currency)} step={currencyStep(draft.currency)} type="number" aria-invalid={createErrors.some(error=>error.fieldId==='create-item-price')} aria-describedby="create-item-price-help" placeholder="780" value={draft.price} onChange={event=>setDraft({...draft,price:event.target.value})}/><span className="currency-label">USD</span></span><small id="create-item-price-help" className={createErrors.some(error=>error.fieldId==='create-item-price')?'field-help invalid':'field-help'}>{t(createErrors.find(error=>error.fieldId==='create-item-price')?.message||'Enter the agreed item price before fees or shipping.')}</small></label><label>{t('Condition')}<select value={draft.condition} onChange={event=>setDraft({...draft,condition:event.target.value as DealDraft['condition']})}><option value="Like new">{t('Like new')}</option><option value="Good">{t('Good')}</option><option value="Fair">{t('Fair')}</option></select></label></div></form></section>
        </div>}
        {!reviewingDraft&&createStep===2&&<section className="form-wrap create-step-card">
          <form id="create-step-2" noValidate onSubmit={event=>{event.preventDefault();submitCreateStep(2)}}>
            <div className="create-step-guidance"><ShieldCheck/><div><b>{t('What the buyer needs to know')}</b><span>{t(selectedDealTemplate.descriptionPrompt)}</span></div></div>
            <label>{t('Known condition and defects')}
              <textarea id="create-item-description" required minLength={20} aria-invalid={createErrors.some(error=>error.fieldId==='create-item-description')} aria-describedby="create-item-description-help" placeholder={t(selectedDealTemplate.descriptionPrompt)} value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/>
              <small id="create-item-description-help" className={createErrors.some(error=>error.fieldId==='create-item-description')?'field-help invalid':'field-help'}>{t(createErrors.find(error=>error.fieldId==='create-item-description')?.message||`${draft.description.trim().length}/20 · Describe wear, repairs, or defects.`)}</small>
            </label>
            <div className={`identifier-field ${dealTemplate==='vehicle'?'is-vin':''}`}>
              <label htmlFor="create-item-identifier">{t(selectedDealTemplate.identifierLabel)}</label>
              <div className="identifier-input-action">
                <input id="create-item-identifier" maxLength={dealTemplate==='vehicle'?17:40} pattern={selectedDealTemplate.identifierPattern} title={t(selectedDealTemplate.identifierHelp)} aria-describedby="create-item-identifier-help" placeholder={t(selectedDealTemplate.identifierPlaceholder)} spellCheck={false} aria-invalid={identifierEntered&&!identifierValid} value={draft.serialNumber} onChange={event=>{setDraft({...draft,serialNumber:dealTemplate==='vehicle'?event.target.value.toUpperCase():event.target.value});setVehicleVinLookup({status:'idle',message:''})}}/>
                {dealTemplate==='vehicle'&&<button type="button" className="vin-check-button" disabled={!identifierEntered||!identifierValid||vehicleVinLookup.status==='loading'} onClick={()=>void checkVehicleVin()}><ScanSearch/>{t(vehicleVinLookup.status==='loading'?'Checking…':'Check VIN')}</button>}
              </div>
              <small id="create-item-identifier-help" className={`identifier-feedback ${identifierEntered?(identifierValid?'valid':'invalid'):''}`}>{t(identifierEntered?(identifierValid?(dealTemplate==='vehicle'?'Format is ready for an NHTSA VIN check.':'Format looks correct. This checks format only, not ownership or authenticity.'):selectedDealTemplate.identifierHelp):'Stored privately; only last characters shown')}</small>
            </div>
            {dealTemplate==='vehicle'&&vehicleVinLookup.status!=='idle'&&<div className={`vin-lookup-status is-${vehicleVinLookup.status}`} role="status" aria-live="polite">
              {vehicleVinLookup.status==='success'?<BadgeCheck/>:vehicleVinLookup.status==='error'?<ShieldAlert/>:<Clock3/>}
              <span><b>{t(vehicleVinLookup.status==='success'?'VIN details found':vehicleVinLookup.status==='error'?'VIN check unavailable':'Checking VIN')}</b><small>{t(vehicleVinLookup.message)}</small>{vehicleVinLookup.result&&<em>{[vehicleVinLookup.result.vehicleType,vehicleVinLookup.result.bodyClass].filter(Boolean).join(' · ')}</em>}</span>
            </div>}
            {dealTemplate==='vehicle'&&<p className="vin-lookup-disclaimer"><ShieldCheck/>{t('NHTSA decoding helps identify manufacturer data. It does not prove ownership, title status, condition, or authenticity.')}</p>}
            <div className="two"><label>{t('Handoff')}<select value={draft.deliveryMethod} onChange={event=>setDraft({...draft,deliveryMethod:event.target.value as DealDraft['deliveryMethod']})}><option value="Meet in person">{t('Meet in person')}</option><option value="Ship to buyer">{t('Ship to buyer')}</option></select></label><label>{t('Offer valid for')}<select value={draft.expiresInDays||7} onChange={event=>setDraft({...draft,expiresInDays:Number(event.target.value)})}><option value={1}>{t('1 day')}</option><option value={3}>{t('3 days')}</option><option value={7}>{t('7 days')}</option><option value={14}>{t('14 days')}</option><option value={30}>{t('30 days')}</option></select></label></div>
            <div className="notice"><ShieldCheck/><span>{t('The Deal Link is not public until you confirm.')}</span></div>
          </form>
        </section>}
        {!reviewingDraft&&createStep===3&&<form id="create-step-3" className="create-media-step" onSubmit={reviewDraft}><section className="media-picker"><label>{t('Item photos or video')}<input className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm" multiple onChange={event=>{const added=Array.from(event.target.files||[]);setPhotos(previous=>{const combined=[...previous,...added].filter((file,index,all)=>all.findIndex(other=>other.name===file.name&&other.size===file.size)===index).slice(0,6);let videoSeen=false;return combined.filter(file=>!isVideoFile(file)||(!videoSeen&&(videoSeen=true)))});event.currentTarget.value=''}}/><small>{t('Choose photos together or add them one at a time')} · {photos.length} {t('of 6')} {t('selected')}</small></label><p className="media-privacy"><ShieldCheck/>{t('Photo privacy: location and camera metadata are removed before upload.')}</p>{photos.length>0&&<div className="photo-previews">{photos.map((file,index)=><div key={`${file.name}-${index}`}><FilePreview file={file} alt={`${t('Preview')} ${index+1}`}/><span>{t(isVideoFile(file)?'Item video':index===0?'Main photo':'Photo')} {index>0&&!isVideoFile(file)?index+1:''}</span></div>)}</div>}</section><DealPhotoGuide template={selectedDealTemplate} count={photos.filter(file=>!file.type.startsWith('video/')).length}/><p className="create-media-optional"><ImagePlus/><span><b>{t('Photos are recommended, not required')}</b><small>{t('You can continue to review now and add more media before publishing.')}</small></span></p></form>}
        {reviewingDraft&&<CreateDealReview draft={draft} photos={photos} creating={creating} requiresAccount={!session} declarations={sellerDeclarations} onDeclarationsChange={setSellerDeclarations} onEdit={()=>{setReviewingDraft(false);setCreateStep(3)}} onSaveDraft={()=>requestCreateAction('save')} onPublish={()=>requestCreateAction('publish')}/>}
        {!reviewingDraft&&<div className={`create-action-dock ${createErrors.length?'has-errors':''}`} role="region" aria-label={t('Create deal action')}><div><small>{t(createErrors.length?'Needs attention':createStepMeta[createStep].eyebrow)}</small><strong>{t(createErrors.length?(createErrors.length===1?'1 detail needs attention':`${createErrors.length} details need attention`):createStepMeta[createStep].dock)}</strong><span>{t(createErrors.length?'Review the highlighted fields before continuing.':createStep===3?'Photos are optional. Continue when the record looks clear.':'Your progress stays here while you complete the next short step.')}</span></div><button type="button" className="primary" onClick={()=>{if(createErrors.length){document.getElementById('create-validation-summary')?.focus();return}const form=document.getElementById(`create-step-${createStep}`) as HTMLFormElement|null;form?.requestSubmit()}}>{t(createErrors.length?'Review details':createStepMeta[createStep].action)}<ArrowRight size={18}/></button></div>}
      </section>}
      {view==='deal'&&active&&<section id="deal-overview" className={`deal-page${agreementDocumentMode?' agreement-document-mode':''}`}>
        <div className="deal-workspace-bar">
          <button className="back" onClick={()=>goHomeSection()}>← {t(user?'Dashboard':'Home')}</button>
          <div className="deal-workspace-id"><span className={`status ${activeExpired?'expired':active.status}`}>{t(activeExpired?'expired':active.status)}</span><b>{active.publicId}</b></div>
          <nav aria-label={t('Deal page navigation')}>
            <span className="deal-workspace-next"><small>{t('Next step')}</small><b>{t(dealNextStep)}</b></span>
            {!isDemoActive&&<><button type="button" className="deal-nav-actions" onClick={()=>scrollToDealSection('deal-actions')}>{t('Actions')}</button><button type="button" className="deal-nav-protection" onClick={()=>scrollToDealSection('deal-safety')}><ShieldCheck size={15}/><span>{t('Protection')}</span></button><button type="button" className="deal-nav-records" onClick={()=>scrollToDealSection('deal-records')}>{t('Records')}</button></>}
            <button type="button" className="deal-action-link" onClick={runDealPrimaryAction}>{t(dealPrimaryAction?.label||'Review agreement')}<ArrowRight size={15}/></button>
          </nav>
        </div>
        {isDemoActive&&<section className="demo-deal-banner" aria-label={t('Interactive sample deal')}>
          <span className="demo-deal-icon"><Eye/></span>
          <div><p className="eyebrow">{t('INTERACTIVE SAMPLE')}</p><h2>{t('See how a Deal Link works.')}</h2><p>{t('Sample only — no real item, agreement, or payment is created.')}</p></div>
          <button type="button" className="primary" onClick={openCreate}><Plus size={17}/>{t('Start a deal')}</button>
        </section>}
        <DealProgressStrip deal={active} paymentReady={Boolean(paymentReadyByDeal[active.id])}/>
        <div className="deal-mobile-summary"><span className="deal-mobile-icon"><Package/></span><div><small>{active.publicId} · {t(active.viewerRole==='seller'?'Seller view':'Buyer view')}</small><b>{active.title}</b></div><strong>{dealPrice(active)}</strong></div>
        <div className="deal-grid">
          <div className="deal-item-card">
            <div className="deal-item-heading">
              <div className={`safe ${active.sellerContactVerified?'':'pending'}`}>{active.sellerContactVerified?<MailCheck/>:<Clock3/>} {t(active.sellerContactVerified?'Seller contact verified':'Seller contact verification pending')}</div>
              <div className="deal-item-title"><p className="eyebrow">{t('Deal')} {active.publicId}</p><h1>{active.title}</h1></div>
              <div className="price">{dealPrice(active)}</div>
            </div>
            <div className={`deal-item-body ${active.mediaUrls?.length?'has-media':'no-media'}`}>
              <DealMedia deal={active}/>
              <div className="deal-item-details">
                <h2>{t('Item details')}</h2>
                <p>{active.description}</p>
                <div className="facts"><div><span>{t('Condition')}</span><b>{t(active.condition)}</b></div><div><span>{t('Handoff')}</span><b>{t(active.deliveryMethod)}</b></div><div><span>{t('Serial')}</span><b>{active.serialNumber||t('Not provided')}</b></div></div>
              </div>
            </div>
          </div>
          {demoFlowCompleted&&<aside className="demo-completion-aside"><div className="agreement"><DemoAgreementComplete buyerName={buyer.trim()} onStart={openCreate} onReviewAgain={resetDemoFlow}/></div></aside>}
          <aside><div className="agreement"><FileSignature/><h2>{t(active.status==='draft'?'Private draft':'Deal agreement')}</h2>{active.status==='draft'?<div className="draft-agreement-notice"><LockKeyhole/><div><b>{t('Not published')}</b><span>{t('This draft is not shared through a Deal Link until you publish it.')}</span></div></div>:<><p>{t('Version')} {active.agreementVersion} · {t('The buyer agrees to the stated price, condition disclosures, and handoff method.')}</p>{active.status==='published'&&!activeExpired?(active.viewerRole==='seller'?<><ul><li><Check/>{t('Item and defects reviewed')}</li><li><Check/>{t('Price confirmed')}</li><li><Check/>{t('Handoff terms confirmed')}</li></ul><div className="waiting-buyer"><Clock3/><div><b>{t('Waiting for buyer')}</b><span>{t('The buyer must review and accept this agreement from their own account.')}</span></div></div></>:<><p className="agreement-instruction">{t('Review agreement')}</p><ul className="agreement-confirm-list"><li className={agreementChecks.item?'checked':''}><label><input type="checkbox" checked={agreementChecks.item} onChange={event=>setAgreementChecks(current=>({...current,item:event.target.checked}))}/><span>{t('Item and defects reviewed')}</span></label></li><li className={agreementChecks.price?'checked':''}><label><input type="checkbox" checked={agreementChecks.price} onChange={event=>setAgreementChecks(current=>({...current,price:event.target.checked}))}/><span>{t('Price confirmed')}</span></label></li><li className={agreementChecks.handoff?'checked':''}><label><input type="checkbox" checked={agreementChecks.handoff} onChange={event=>setAgreementChecks(current=>({...current,handoff:event.target.checked}))}/><span>{t('Handoff terms confirmed')}</span></label></li></ul><label>{t('Your full name')}<input placeholder={t('Buyer name')} value={buyer} onChange={e=>setBuyer(e.target.value)}/></label>{authMessage&&<div className="notice" role="status">{t(authMessage)}</div>}<button className="primary full" disabled={!agreementActionReady} onClick={accept}>{t('Accept these terms')}</button><small>{t(agreementActionReady?'Your name records consent to this agreement version.':'Complete all three confirmations and enter your full name.')}</small></>):activeExpired?<AgreementExpiredNotice/>:<><ul><li><Check/>{t('Item and defects reviewed')}</li><li><Check/>{t('Price confirmed')}</li><li><Check/>{t('Handoff terms confirmed')}</li></ul><div className="accepted"><BadgeCheck/><div><b>{t('Terms accepted')}</b><span>{active.buyerName||t('Buyer')} · {t('verification pending')}</span></div></div></>}</>}</div>{active.status!=='draft'&&!isDemoActive&&<><DealCopyLinkButton deal={active}/><DealQrCode deal={active}/></>}</aside>
        </div>
        {active.status!=='draft'&&<AgreementPrintDocument deal={active}/>}
      </section>}
      {view==='deal'&&active&&dealPrimaryAction&&<div className="deal-primary-dock" role="region" aria-live="polite" aria-label={t('Primary deal action')}><div><small>{t('Next step')}</small><strong>{t(dealPrimaryAction.label)}</strong><span>{t(dealPrimaryAction.detail)}</span></div><em>{dealPrice(active)}</em><button type="button" className="primary" onClick={runDealPrimaryAction}>{t(dealPrimaryAction.label)}<ArrowRight size={17}/></button></div>}
    </main><footer><div><BrandLogo className="footer-brand-logo"/><span>Global vision · U.S. launch · English (US) · USD</span></div><nav aria-label={t('Legal and protection')}><a href={publicInfoPaths['buyer-protection']} onClick={event=>{event.preventDefault();openInfo('buyer-protection')}}>{t('Buyer protection')}</a><a href={publicInfoPaths['seller-protection']} onClick={event=>{event.preventDefault();openInfo('seller-protection')}}>{t('Seller protection')}</a><a href={publicInfoPaths.fees} onClick={event=>{event.preventDefault();openInfo('fees')}}>{t('Fees')}</a><a href={publicInfoPaths.disputes} onClick={event=>{event.preventDefault();openInfo('disputes')}}>{t('Disputes')}</a><a href={verifyPath} onClick={event=>{event.preventDefault();openVerify()}}>{t('Verify agreement')}</a><a href={publicInfoPaths.terms} onClick={event=>{event.preventDefault();openInfo('terms')}}>{t('Terms')}</a><a href={publicInfoPaths.privacy} onClick={event=>{event.preventDefault();openInfo('privacy')}}>{t('Privacy')}</a></nav></footer>
  </div>
}
