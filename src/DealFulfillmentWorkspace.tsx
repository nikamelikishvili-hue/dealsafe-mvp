import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  LockKeyhole,
  MapPinned,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { focusPageDestination } from './accessibleNavigation';
import { AsyncStatePanel } from './AsyncStatePanel';
import { copyTextToClipboard } from './clipboard';
import { useConfirmAction } from './ConfirmActionDialog';
import type { Deal } from './domain';
import { getAppLanguage, t } from './i18n';
import {
  isUsPostalCode,
  parseStoredUsAddress,
  serializeUsAddress,
  US_STATE_OPTIONS,
} from './usAddress';
import {
  completeHandoff,
  confirmMeeting,
  confirmShipmentDelivery,
  createDealShipment,
  generateHandoffPin,
  getDealDeliveryDetails,
  getDealInspection,
  getDealMeeting,
  getDealShipment,
  getSellerShippingEvidenceReadiness,
  markArrived,
  proposeMeeting,
  recordDealInspection,
  saveDealDeliveryDetails,
  type DealDeliveryDetails,
  type DealInspection,
  type DealMeeting,
  type DealShipment,
  type SellerShippingEvidenceReadiness,
  type StoredSession,
} from './services/supabaseRest';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

type ValidationError = { fieldId: string; message: string };

function WorkflowValidationSummary({
  id,
  title,
  errors,
}: {
  id: string;
  title: string;
  errors: ValidationError[];
}) {
  return (
    <div
      id={id}
      className="workflow-validation-summary"
      role="alert"
      tabIndex={-1}
    >
      <div>
        <h3>{t(title)}</h3>
        <ul>
          {errors.map((error) => (
            <li key={error.fieldId}>
              <button
                type="button"
                onClick={() => document.getElementById(error.fieldId)?.focus()}
              >
                {t(error.message)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MeetingPanel({
  deal,
  session,
}: {
  deal: Deal;
  session: StoredSession;
}) {
  const [meeting, setMeeting] = useState<DealMeeting | null>(null);
  const [form, setForm] = useState({
    locationName: '',
    streetAddress: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    scheduledAt: '',
  });
  const [message, setMessage] = useState('');
  const [actionFailed, setActionFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [validationVisible, setValidationVisible] = useState(false);
  const actionInFlight = useRef(false);

  useEffect(() => {
    let current = true;
    setLoaded(false);
    setLoadFailed(false);
    setMessage('');
    void getDealMeeting(session, deal.id)
      .then((next) => {
        if (current) setMeeting(next);
      })
      .catch((error) => {
        if (current) {
          setLoadFailed(true);
          setMessage(
            error instanceof Error ? error.message : 'Could not load meeting details',
          );
        }
      })
      .finally(() => {
        if (current) setLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [deal.id, session.accessToken, loadVersion]);

  const completeAddress = [
    form.streetAddress.trim(),
    form.addressLine2.trim(),
    `${form.city.trim()}, ${form.state} ${form.postalCode.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');
  const meetingErrors = [
    form.locationName.trim().length < 2 && {
      fieldId: 'meeting-location-name',
      message: 'Enter the name of a public meeting place.',
    },
    form.streetAddress.trim().length < 3 && {
      fieldId: 'meeting-street-address',
      message: 'Enter the street address.',
    },
    form.city.trim().length < 2 && {
      fieldId: 'meeting-city',
      message: 'Enter the city.',
    },
    !form.state && {
      fieldId: 'meeting-state',
      message: 'Select the state.',
    },
    !isUsPostalCode(form.postalCode) && {
      fieldId: 'meeting-postal-code',
      message: 'Enter a valid 5-digit ZIP code or ZIP+4.',
    },
    !form.scheduledAt && {
      fieldId: 'meeting-scheduled-at',
      message: 'Choose the meeting date and time.',
    },
  ].filter((error): error is ValidationError => Boolean(error));

  const propose = async (event: FormEvent) => {
    event.preventDefault();
    if (meetingErrors.length > 0) {
      setValidationVisible(true);
      window.requestAnimationFrame(() =>
        document.getElementById('meeting-validation-summary')?.focus(),
      );
      return;
    }
    if (actionInFlight.current) return;
    setValidationVisible(false);
    actionInFlight.current = true;
    setBusy(true);
    setMessage('');
    setActionFailed(false);
    try {
      await proposeMeeting(
        session,
        deal.id,
        form.locationName.trim(),
        completeAddress,
        form.scheduledAt,
      );
      setMeeting(await getDealMeeting(session, deal.id));
      setMessage('Meeting proposal sent to the other party.');
    } catch (error) {
      setActionFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not propose meeting',
      );
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setMessage('');
    setActionFailed(false);
    try {
      await confirmMeeting(session, deal.id);
      setMeeting(await getDealMeeting(session, deal.id));
      setMessage('Meeting confirmed.');
    } catch (error) {
      setActionFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not confirm meeting',
      );
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section
      className="meeting-panel"
      aria-labelledby="meeting-panel-title"
    >
      <div className="meeting-title">
        <span className="workflow-icon">
          <MapPinned />
        </span>
        <div>
          <p className="eyebrow">{t('Safe handoff')}</p>
          <h2 id="meeting-panel-title">{t('Plan the meeting')}</h2>
          <span>
            {t('Set one verified public location and a clear meeting time.')}
          </span>
        </div>
      </div>
      {!loaded ? (
        <AsyncStatePanel
          state="loading"
          title="Loading meeting details…"
          message="Checking the latest handoff plan."
        />
      ) : loadFailed ? (
        <AsyncStatePanel
          state="error"
          title="Meeting details are temporarily unavailable"
          message={message || 'Could not load meeting details'}
          onAction={() => setLoadVersion((version) => version + 1)}
        />
      ) : meeting ? (
        <div className="meeting-summary">
          <div>
            <MapPinned />
            <span>
              <b>{meeting.location_name}</b>
              <small className="meeting-address">{meeting.address}</small>
            </span>
          </div>
          <div>
            <CalendarClock />
            <span>
              <b>{formatDateTime(meeting.scheduled_at)}</b>
              <small className={`meeting-status ${meeting.status}`}>
                {t(meeting.status)}
              </small>
            </span>
          </div>
          {meeting.status === 'proposed' &&
            meeting.proposed_by !== session.user.id && (
              <button
                type="button"
                className="primary"
                disabled={busy}
                aria-busy={busy}
                onClick={confirm}
              >
                {t(busy ? 'Confirming…' : 'Confirm meeting')}
              </button>
            )}
          {meeting.status === 'proposed' &&
            meeting.proposed_by === session.user.id && (
              <p>{t('Waiting for the other party to confirm.')}</p>
            )}
        </div>
      ) : (
        <form
          className="meeting-form"
          onSubmit={propose}
          noValidate
        >
          {validationVisible && meetingErrors.length > 0 && (
            <WorkflowValidationSummary
              id="meeting-validation-summary"
              title="Complete the meeting details"
              errors={meetingErrors}
            />
          )}
          <label className="meeting-field meeting-field-place">
            {t('Public meeting place')}
            <input
              id="meeting-location-name"
              required
              minLength={2}
              maxLength={120}
              placeholder={t('Police safe exchange zone or busy café')}
              value={form.locationName}
              onChange={(event) =>
                setForm({ ...form, locationName: event.target.value })
              }
            />
          </label>
          <label className="meeting-field meeting-field-street">
            {t('Street address')}
            <AddressAutocomplete
              inputId="meeting-street-address"
              streetAddressOnly
              placeholder={t('123 Main St')}
              value={form.streetAddress}
              onChange={(streetAddress) =>
                setForm((current) => ({ ...current, streetAddress }))
              }
              onAddressParts={(parts) =>
                setForm((current) => ({
                  ...current,
                  streetAddress:
                    parts.streetAddress || current.streetAddress,
                  addressLine2:
                    parts.addressLine2 || current.addressLine2,
                  city: parts.city || current.city,
                  state: parts.state || current.state,
                  postalCode: parts.postalCode || current.postalCode,
                }))
              }
            />
            <small className="field-help">
              {t(
                'If needed, add an apartment, suite, unit, building, or floor.',
              )}
            </small>
          </label>
          <label className="meeting-field meeting-field-line-two">
            {t('Address line 2 (optional)')}
            <input
              maxLength={100}
              autoComplete="address-line2"
              placeholder={t('Apartment, suite, unit, building, or floor')}
              value={form.addressLine2}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine2: event.target.value,
                }))
              }
            />
          </label>
          <label className="meeting-field meeting-field-city">
            {t('City')}
            <input
              id="meeting-city"
              required
              minLength={2}
              maxLength={100}
              autoComplete="address-level2"
              placeholder={t('New York')}
              value={form.city}
              onChange={(event) =>
                setForm({ ...form, city: event.target.value })
              }
            />
          </label>
          <label className="meeting-field meeting-field-state">
            {t('State')}
            <select
              id="meeting-state"
              required
              autoComplete="address-level1"
              value={form.state}
              onChange={(event) =>
                setForm({ ...form, state: event.target.value })
              }
            >
              <option value="">{t('Select state')}</option>
              {US_STATE_OPTIONS.map(([code, name]) => (
                <option
                  key={code}
                  value={code}
                >
                  {code} — {name}
                </option>
              ))}
            </select>
          </label>
          <label className="meeting-field meeting-field-zip">
            {t('ZIP code')}
            <input
              id="meeting-postal-code"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="[0-9]{5}(-[0-9]{4})?"
              maxLength={10}
              aria-describedby="meeting-zip-help"
              placeholder="10001"
              value={form.postalCode}
              onChange={(event) =>
                setForm({ ...form, postalCode: event.target.value })
              }
            />
            <small
              id="meeting-zip-help"
              className={
                form.postalCode && !isUsPostalCode(form.postalCode)
                  ? 'field-help invalid'
                  : 'field-help'
              }
            >
              {t(
                form.postalCode && !isUsPostalCode(form.postalCode)
                  ? 'Enter a valid 5-digit ZIP code or ZIP+4.'
                  : '5 digits or ZIP+4',
              )}
            </small>
          </label>
          <label className="meeting-field meeting-field-date">
            {t('Date and time')}
            <input
              id="meeting-scheduled-at"
              required
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) =>
                setForm({ ...form, scheduledAt: event.target.value })
              }
            />
          </label>
          <button
            type="submit"
            className="primary meeting-submit"
            disabled={busy}
            aria-busy={busy}
          >
            <CalendarClock size={18} />
            {t(busy ? 'Sending…' : 'Propose meeting')}
          </button>
        </form>
      )}
      {message && (
        <div
          className="notice"
          role={actionFailed ? 'alert' : 'status'}
          aria-live={actionFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      <p className="meeting-safety">
        <ShieldCheck />{' '}
        {t(
          'Prefer a staffed, well-lit public location. Never share a home address by default.',
        )}
      </p>
    </section>
  );
}

export function InspectionRecorder({
  deal,
  session,
  onRecorded,
}: {
  deal: Deal;
  session: StoredSession;
  onRecorded: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState<DealInspection | null>(null);
  const [checks, setChecks] = useState({
    item: false,
    price: false,
    handoff: false,
    reference: false,
  });
  const [message, setMessage] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);

  useEffect(() => {
    let current = true;
    void getDealInspection(session, deal.id)
      .then((receipt) => {
        if (!current) return;
        setSaved(receipt);
        onRecorded(Boolean(receipt));
      })
      .catch(() => {
        if (current) onRecorded(false);
      });
    return () => {
      current = false;
    };
  }, [deal.id, session.accessToken]);

  const complete = Object.values(checks).every(Boolean);
  const items = [
    { key: 'item' as const, label: 'Item and defects reviewed' },
    { key: 'price' as const, label: 'Price confirmed' },
    { key: 'handoff' as const, label: 'Handoff terms confirmed' },
    {
      key: 'reference' as const,
      label: deal.serialNumber ? 'Serial' : 'Condition',
    },
  ];
  const save = async () => {
    if (!complete) {
      setSaveFailed(true);
      setMessage('Complete every inspection check before saving the receipt.');
      const firstIncomplete = items.find((item) => !checks[item.key]);
      window.requestAnimationFrame(() =>
        document.getElementById(`inspection-${firstIncomplete?.key}`)?.focus(),
      );
      return;
    }
    if (saveInFlight.current) return;
    setMessage('');
    setSaveFailed(false);
    saveInFlight.current = true;
    setSaving(true);
    setMessage('');
    try {
      await recordDealInspection(session, deal.id);
      const receipt = await getDealInspection(session, deal.id);
      setSaved(receipt);
      onRecorded(true);
      setMessage('Inspection receipt saved.');
    } catch (error) {
      setSaveFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save inspection receipt',
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  if (saved)
    return (
      <div className="inspection-receipt">
        <BadgeCheck />
        <div>
          <b>{t('Buyer inspection recorded')}</b>
          <span>
            {saved.buyer_name} · {t('Version')} {saved.agreement_version} ·{' '}
            {formatDateTime(saved.inspected_at)}
          </span>
          <small>{t('This checklist is stored with the deal record.')}</small>
        </div>
      </div>
    );
  if (deal.viewerRole !== 'buyer')
    return (
      <div className="inspection-wait">
        <Clock3 />
        <span>{t('Waiting for buyer inspection.')}</span>
      </div>
    );

  return (
    <div className="inspection-checklist">
      <p className="eyebrow">{t('Buyer inspection receipt')}</p>
      <h3>{t('Inspect the item before sharing or entering the PIN.')}</h3>
      <div className="inspection-items">
        {items.map((item) => (
          <label
            key={item.key}
            className={checks[item.key] ? 'checked' : ''}
          >
            <input
              id={`inspection-${item.key}`}
              type="checkbox"
              checked={checks[item.key]}
              onChange={(event) =>
                {
                  setChecks((current) => ({
                    ...current,
                    [item.key]: event.target.checked,
                  }));
                  setMessage('');
                  setSaveFailed(false);
                }
              }
            />
            <span>{t(item.label)}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="primary inspection-save"
        disabled={saving}
        aria-busy={saving}
        onClick={save}
      >
        {t(saving ? 'Saving…' : 'Save inspection receipt')}
      </button>
      {message && (
        <div
          className="notice"
          role={saveFailed ? 'alert' : 'status'}
          aria-live={saveFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      <small className="inspection-help">
        {t('This checklist is stored with the deal record.')}
      </small>
    </div>
  );
}

export function HandoffPanel({
  deal,
  session,
  paymentReady,
  onComplete,
}: {
  deal: Deal;
  session: StoredSession;
  paymentReady: boolean;
  onComplete: () => void;
}) {
  const [meeting, setMeeting] = useState<DealMeeting | null>(null);
  const [pin, setPin] = useState('');
  const [sellerPin, setSellerPin] = useState('');
  const [message, setMessage] = useState('');
  const [actionFailed, setActionFailed] = useState(false);
  const [inspectionRecorded, setInspectionRecorded] = useState(false);
  const [busy, setBusy] = useState<'arrive' | 'pin' | 'finish' | ''>('');
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const actionInFlight = useRef(false);

  const reload = async () => {
    const next = await getDealMeeting(session, deal.id);
    setMeeting(next);
    return next;
  };
  useEffect(() => {
    let current = true;
    setLoadError('');
    void getDealMeeting(session, deal.id)
      .then((next) => {
        if (current) setMeeting(next);
      })
      .catch((error) => {
        if (current) {
          setLoadError(
            error instanceof Error ? error.message : 'Could not load handoff status',
          );
        }
      });
    return () => {
      current = false;
    };
  }, [deal.id, session.accessToken, loadVersion]);

  if (loadError) {
    return (
      <section className="handoff-panel">
        <div className="notice" role="alert">{t(loadError)}</div>
        <button
          type="button"
          className="secondary"
          onClick={() => setLoadVersion((version) => version + 1)}
        >
          {t('Try again')}
        </button>
      </section>
    );
  }
  if (!meeting || meeting.status !== 'confirmed') return null;
  const myArrived =
    deal.viewerRole === 'seller'
      ? meeting.seller_arrived
      : meeting.buyer_arrived;
  const arrive = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy('arrive');
    setMessage('');
    setActionFailed(false);
    try {
      await markArrived(session, deal.id);
      await reload();
      setMessage('Arrival recorded.');
    } catch (error) {
      setActionFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not record arrival',
      );
    } finally {
      actionInFlight.current = false;
      setBusy('');
    }
  };
  const makePin = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy('pin');
    setMessage('');
    setActionFailed(false);
    try {
      setSellerPin(await generateHandoffPin(session, deal.id));
      setMessage('Show this PIN only after the buyer inspects the item.');
    } catch (error) {
      setActionFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not generate PIN',
      );
    } finally {
      actionInFlight.current = false;
      setBusy('');
    }
  };
  const finish = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy('finish');
    setMessage('');
    setActionFailed(false);
    try {
      await completeHandoff(session, deal.id, pin);
      setMessage('Item receipt confirmed. Deal completed.');
      onComplete();
    } catch (error) {
      setActionFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not complete deal',
      );
    } finally {
      actionInFlight.current = false;
      setBusy('');
    }
  };

  return (
    <section className="handoff-panel">
      <p className="eyebrow">{t('In-person handoff')}</p>
      <h2>{t('Complete the exchange safely')}</h2>
      <div className="arrival-grid">
        <div className={meeting.seller_arrived ? 'done' : ''}>
          <Check />
          <span>{t('Seller arrived')}</span>
        </div>
        <div className={meeting.buyer_arrived ? 'done' : ''}>
          <Check />
          <span>{t('Buyer arrived')}</span>
        </div>
      </div>
      {!myArrived && (
        <button
          type="button"
          className="primary"
          disabled={Boolean(busy)}
          aria-busy={busy === 'arrive'}
          onClick={arrive}
        >
          {t(busy === 'arrive' ? 'Saving…' : 'I arrived')}
        </button>
      )}
      {meeting.seller_arrived && meeting.buyer_arrived && (
        <InspectionRecorder
          deal={deal}
          session={session}
          onRecorded={setInspectionRecorded}
        />
      )}
      {meeting.seller_arrived &&
        meeting.buyer_arrived &&
        !paymentReady && (
          <div className="payment-wait">
            <Clock3 />
            {t('Waiting for seller to confirm payment received')}
          </div>
        )}
      {meeting.seller_arrived &&
        meeting.buyer_arrived &&
        deal.viewerRole === 'seller' && (
          <div className="pin-box">
            {sellerPin ? (
              <>
                <small>{t('One-time handoff PIN')}</small>
                <strong>{sellerPin}</strong>
              </>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={!paymentReady || Boolean(busy)}
                aria-busy={busy === 'pin'}
                onClick={makePin}
              >
                {t(busy === 'pin' ? 'Generating…' : 'Generate handoff PIN')}
              </button>
            )}
          </div>
        )}
      {meeting.seller_arrived &&
        meeting.buyer_arrived &&
        deal.viewerRole === 'buyer' && (
          <div
            className={`pin-entry ${inspectionRecorded && paymentReady ? '' : 'locked'}`}
          >
            <label>
              {t('Enter seller’s 6-digit PIN')}
              <input
                disabled={!inspectionRecorded || !paymentReady}
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, ''))
                }
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={
                !inspectionRecorded ||
                !paymentReady ||
                pin.length !== 6 ||
                Boolean(busy)
              }
              aria-busy={busy === 'finish'}
              onClick={finish}
            >
              {t(
                busy === 'finish'
                  ? 'Completing…'
                  : 'Confirm item received',
              )}
            </button>
          </div>
        )}
      {message && (
        <div
          className="notice"
          role={actionFailed ? 'alert' : 'status'}
          aria-live={actionFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      <p className="meeting-safety">
        <ShieldCheck />{' '}
        {t('Inspect the item before sharing or entering the PIN.')}
      </p>
    </section>
  );
}

export function ShippingPanel({
  deal,
  session,
  paymentReady,
  evidenceRevision,
  onProgressChanged,
  onDelivered,
}: {
  deal: Deal;
  session: StoredSession;
  paymentReady: boolean;
  evidenceRevision: number;
  onProgressChanged?: () => void;
  onDelivered: () => void;
}) {
  const { confirmAction, confirmDialog } = useConfirmAction();
  const [shipment, setShipment] = useState<DealShipment | null>(null);
  const [delivery, setDelivery] = useState<DealDeliveryDetails | null>(null);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [message, setMessage] = useState('');
  const [inspectionRecorded, setInspectionRecorded] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [shipmentBusy, setShipmentBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [readiness, setReadiness] =
    useState<SellerShippingEvidenceReadiness | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [address, setAddress] = useState({
    recipientName: session.user.displayName,
    streetAddress: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    instructions: '',
  });

  const loadShipment = async (isCurrent = () => true) => {
    try {
      const next = await getDealShipment(session, deal.id);
      if (isCurrent()) setShipment(next);
    } catch {
      if (isCurrent()) {
        setMessage('Shipment status could not be loaded. Try again.');
      }
    }
  };
  const loadDelivery = async (isCurrent = () => true) => {
    try {
      const details = await getDealDeliveryDetails(session, deal.id);
      if (!isCurrent()) return;
      setDelivery(details);
      if (details) {
        const parsed = parseStoredUsAddress(details.full_address);
        setAddress({
          recipientName: details.recipient_name,
          streetAddress: parsed.streetAddress,
          addressLine2: parsed.addressLine2,
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.postalCode,
          country: details.country || 'United States',
          instructions: details.instructions || '',
        });
      }
    } catch {
      if (isCurrent()) {
        setMessage('Delivery address could not be loaded. Try again.');
      }
    }
  };
  const loadReadiness = async (isCurrent = () => true) => {
    if (deal.viewerRole !== 'seller') return;
    if (isCurrent()) {
      setCheckingReadiness(true);
      setReadinessError('');
    }
    try {
      const next = await getSellerShippingEvidenceReadiness(session, deal.id);
      if (isCurrent()) setReadiness(next);
    } catch {
      if (isCurrent()) {
        setReadiness(null);
        setReadinessError('Shipping readiness could not be verified.');
      }
    } finally {
      if (isCurrent()) setCheckingReadiness(false);
    }
  };

  useEffect(() => {
    let current = true;
    const isCurrent = () => current;
    void loadShipment(isCurrent);
    void loadDelivery(isCurrent);
    return () => {
      current = false;
    };
  }, [deal.id, session.accessToken]);
  useEffect(() => {
    let current = true;
    void loadReadiness(() => current);
    return () => {
      current = false;
    };
  }, [deal.id, session.accessToken, deal.viewerRole, evidenceRevision]);

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault();
    if (addressErrors.length > 0) {
      setAddressValidationVisible(true);
      window.requestAnimationFrame(() =>
        document.getElementById('shipping-validation-summary')?.focus(),
      );
      return;
    }
    if (mutationInFlight.current) return;
    setAddressValidationVisible(false);
    mutationInFlight.current = true;
    setSavingAddress(true);
    setMessage('');
    try {
      const storedAddress = serializeUsAddress(address);
      await saveDealDeliveryDetails(
        session,
        deal.id,
        address.recipientName,
        storedAddress,
        'United States',
        address.instructions,
      );
      await loadDelivery();
      onProgressChanged?.();
      setEditingAddress(false);
      setMessage('Address saved. The seller can now prepare the shipment.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save delivery address',
      );
    } finally {
      mutationInFlight.current = false;
      setSavingAddress(false);
    }
  };
  const copyAddress = async () => {
    if (!delivery) return;
    try {
      await copyTextToClipboard(
        `${delivery.recipient_name}\n${delivery.full_address}\n${delivery.country}${
          delivery.instructions ? `\n${delivery.instructions}` : ''
        }`,
      );
      setMessage('Address copied.');
    } catch {
      setMessage('Address could not be copied. Select and copy it manually.');
    }
  };

  const evidenceReady = readiness?.ready === true;
  const readyToShip = paymentReady && Boolean(delivery) && evidenceReady;
  const serialRequired =
    readiness?.serial_required ?? Boolean(deal.serialNumber);
  const readinessSteps = [
    { label: 'Payment confirmed', ready: paymentReady },
    { label: 'Delivery address saved', ready: Boolean(delivery) },
    {
      label: 'Item condition photo',
      ready: Boolean(readiness?.item_photo_ready),
    },
    {
      label: 'Packing video',
      ready: Boolean(readiness?.packing_video_ready),
    },
    {
      label: 'Package weight photo',
      ready: Boolean(readiness?.package_weight_ready),
    },
    {
      label: 'Serial / IMEI photo',
      ready: serialRequired ? Boolean(readiness?.serial_photo_ready) : true,
      optional: !serialRequired,
    },
  ];
  const completedReadinessSteps = readinessSteps.filter(
    (step) => step.ready,
  ).length;
  const saveShipment = async (event: FormEvent) => {
    event.preventDefault();
    if (mutationInFlight.current) return;
    setMessage('');
    if (!readyToShip) {
      setMessage('Complete the shipping readiness checklist first.');
      return;
    }
    mutationInFlight.current = true;
    setShipmentBusy(true);
    try {
      await createDealShipment(session, deal.id, carrier, tracking);
      setMessage('Shipment details saved.');
      await loadShipment();
      await loadDelivery();
      await loadReadiness();
      onProgressChanged?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not save shipment',
      );
    } finally {
      mutationInFlight.current = false;
      setShipmentBusy(false);
    }
  };
  const delivered = async () => {
    const confirmed = await confirmAction({
      title: t('Confirm delivery?'),
      description: t(
        'Confirm only after you received and inspected the item. This completes the deal record.',
      ),
      confirmLabel: t('Confirm delivery'),
    });
    if (!confirmed) return;
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setShipmentBusy(true);
    setMessage('');
    try {
      await confirmShipmentDelivery(session, deal.id);
      setMessage('Delivery confirmed. Deal completed.');
      await loadShipment();
      await loadDelivery();
      onProgressChanged?.();
      onDelivered();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not confirm delivery',
      );
    } finally {
      mutationInFlight.current = false;
      setShipmentBusy(false);
    }
  };

  const streetNumberMissing =
    address.streetAddress.trim().length > 0 &&
    !/\d/.test(address.streetAddress);
  const [addressValidationVisible, setAddressValidationVisible] = useState(false);
  const addressErrors = [
    address.recipientName.trim().length < 2 && {
      fieldId: 'shipping-recipient-name',
      message: 'Enter the recipient name.',
    },
    (address.streetAddress.trim().length < 3 || streetNumberMissing) && {
      fieldId: 'shipping-street-address',
      message: streetNumberMissing
        ? 'Enter a specific address that includes a street number.'
        : 'Enter the street address.',
    },
    address.city.trim().length < 2 && {
      fieldId: 'shipping-city',
      message: 'Enter the city.',
    },
    !address.state && {
      fieldId: 'shipping-state',
      message: 'Select the state.',
    },
    !isUsPostalCode(address.postalCode) && {
      fieldId: 'shipping-postal-code',
      message: 'Enter a valid 5-digit ZIP code or ZIP+4.',
    },
  ].filter((error): error is ValidationError => Boolean(error));
  const shippingState =
    shipment?.status === 'delivered'
      ? 'Delivered'
      : shipment
        ? 'In transit'
        : readyToShip
          ? 'Ready to ship'
          : delivery
            ? 'Preparing shipment'
            : 'Address needed';

  return (
    <>
    <section className="shipping-panel no-print">
      <div className="shipping-heading">
        <span className="workflow-icon">
          <Truck />
        </span>
        <div>
          <p className="eyebrow">{t('Tracked delivery')}</p>
          <h2>{t('Shipping & receipt')}</h2>
          <span>
            {t('Address, tracking, inspection, and receipt in one place.')}
          </span>
        </div>
        <strong
          className={`shipping-state ${
            shipment?.status === 'delivered' ? 'complete' : ''
          }`}
        >
          {t(shippingState)}
        </strong>
      </div>
      <div className="delivery-address-section">
        <div className="delivery-address-heading">
          <span className="workflow-icon">
            <MapPinned />
          </span>
          <div>
            <p className="eyebrow">{t('Protected delivery')}</p>
            <h3>{t('Delivery address')}</h3>
            <span>{t('Only the buyer and seller can view this address.')}</span>
          </div>
        </div>
        {delivery && !editingAddress && (
          <div className="delivery-address-card">
            <div>
              <span>{t('Recipient name')}</span>
              <strong>{delivery.recipient_name}</strong>
              <address>
                {delivery.full_address}
                <br />
                {delivery.country}
              </address>
              {delivery.instructions && (
                <small>
                  {t('Delivery instructions')}: {delivery.instructions}
                </small>
              )}
            </div>
            <div className="delivery-address-actions">
              {delivery.locked && (
                <em>
                  <LockKeyhole size={14} />
                  {t('Locked after shipping')}
                </em>
              )}
              <button
                type="button"
                className="secondary"
                onClick={copyAddress}
              >
                <Copy size={16} />
                {t('Copy address')}
              </button>
              {deal.viewerRole === 'buyer' && !delivery.locked && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingAddress(true)}
                >
                  {t('Edit address')}
                </button>
              )}
            </div>
          </div>
        )}
        {deal.viewerRole === 'buyer' && (!delivery || editingAddress) && (
          <form
            className="delivery-address-form"
            onSubmit={saveAddress}
            noValidate
          >
            {addressValidationVisible && addressErrors.length > 0 && (
              <WorkflowValidationSummary
                id="shipping-validation-summary"
                title="Complete the delivery address"
                errors={addressErrors}
              />
            )}
            <label>
              {t('Recipient name')}
              <input
                id="shipping-recipient-name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={address.recipientName}
                onChange={(event) =>
                  setAddress({
                    ...address,
                    recipientName: event.target.value,
                  })
                }
              />
            </label>
            <label className="address-field-wide">
              {t('Street address (number and name)')}
              <AddressAutocomplete
                inputId="shipping-street-address"
                streetAddressOnly
                placeholder={t('123 Main St')}
                value={address.streetAddress}
                onChange={(streetAddress) =>
                  setAddress((current) => ({ ...current, streetAddress }))
                }
                onAddressParts={(parts) =>
                  setAddress((current) => ({
                    ...current,
                    streetAddress:
                      parts.streetAddress || current.streetAddress,
                    addressLine2:
                      parts.addressLine2 || current.addressLine2,
                    city: parts.city || current.city,
                    state: parts.state || current.state,
                    postalCode: parts.postalCode || current.postalCode,
                    country: 'United States',
                  }))
                }
              />
            </label>
            <label className="address-field-wide address-field-line-two">
              {t('Address line 2 (optional)')}
              <input
                  maxLength={100}
                autoComplete="address-line2"
                value={address.addressLine2}
                onChange={(event) =>
                  setAddress({ ...address, addressLine2: event.target.value })
                }
                placeholder={t(
                  'Apartment, suite, unit, building, or floor',
                )}
              />
              <small className="field-help">
                {t(
                  'Add apartment, suite, unit, building, floor, or mailbox details.',
                )}
              </small>
            </label>
              <label>
                {t('City')}
                <input
                  id="shipping-city"
                required
                minLength={2}
                maxLength={100}
                autoComplete="address-level2"
                value={address.city}
                onChange={(event) =>
                  setAddress({ ...address, city: event.target.value })
                }
                placeholder={t('New York')}
              />
            </label>
            <label>
              {t('State')}
              <select
                id="shipping-state"
                required
                autoComplete="address-level1"
                value={address.state}
                onChange={(event) =>
                  setAddress({ ...address, state: event.target.value })
                }
              >
                <option value="">{t('Select state')}</option>
                {US_STATE_OPTIONS.map(([code, name]) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {code} — {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('ZIP code')}
              <input
                id="shipping-postal-code"
                required
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[0-9]{5}(-[0-9]{4})?"
                maxLength={10}
                aria-describedby="shipping-zip-help"
                placeholder="10001"
                value={address.postalCode}
                onChange={(event) =>
                  setAddress({
                    ...address,
                    postalCode: event.target.value,
                  })
                }
              />
              <small
                id="shipping-zip-help"
                className={
                  address.postalCode &&
                  !isUsPostalCode(address.postalCode)
                    ? 'field-help invalid'
                    : 'field-help'
                }
              >
                {t(
                  address.postalCode &&
                    !isUsPostalCode(address.postalCode)
                    ? 'Enter a valid 5-digit ZIP code or ZIP+4.'
                    : '5 digits or ZIP+4',
                )}
              </small>
            </label>
            <label className="address-field-country">
              {t('Country or region')}
              <input
                readOnly
                autoComplete="country-name"
                value="United States"
              />
            </label>
            <label className="address-field-wide">
              {t('Delivery instructions (optional)')}
              <textarea
                maxLength={500}
                value={address.instructions}
                onChange={(event) =>
                  setAddress({
                    ...address,
                    instructions: event.target.value,
                  })
                }
                placeholder={t('Apartment, access code, or safe delivery note')}
              />
            </label>
            <div className="delivery-form-actions">
              {delivery && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingAddress(false)}
                >
                  {t('Go back')}
                </button>
              )}
              <button
                type="submit"
                className="primary"
                disabled={savingAddress}
                aria-busy={savingAddress}
              >
                {t(savingAddress ? 'Saving…' : 'Save delivery address')}
              </button>
            </div>
          </form>
        )}
        {deal.viewerRole === 'seller' && !delivery && (
          <div className="shipping-wait">
            {t('Waiting for the buyer to add a delivery address.')}
          </div>
        )}
        <p className="delivery-privacy">
          <LockKeyhole size={15} />
          {t(
            'This address is used only for this deal and is never shown on the public Deal Link.',
          )}
        </p>
      </div>
      {deal.viewerRole === 'seller' && !shipment && (
        <details
          className={`shipping-readiness ${readyToShip ? 'is-ready' : ''}`}
          aria-busy={checkingReadiness}
        >
          <summary className="shipping-readiness-heading">
            <span className="shipping-readiness-icon">
              {readyToShip ? <Check /> : <ShieldCheck />}
            </span>
            <div>
              <p className="eyebrow">{t('Shipping readiness')}</p>
              <h3>
                {t(readyToShip ? 'Ready to ship' : 'Complete shipping checks')}
              </h3>
              <span>
                {completedReadinessSteps}/{readinessSteps.length}{' '}
                {t('steps complete')}
              </span>
            </div>
            <ChevronDown className="shipping-readiness-chevron" />
          </summary>
          <div className="shipping-readiness-body">
            <div className="shipping-readiness-progress">
              <span
                style={{
                  width: `${(completedReadinessSteps / readinessSteps.length) * 100}%`,
                }}
              />
            </div>
            <div className="shipping-readiness-list">
              {readinessSteps.map((step) => (
                <div
                  key={step.label}
                  className={step.ready ? 'complete' : 'missing'}
                >
                  {step.ready ? <Check /> : <Clock3 />}
                  <span>{t(step.label)}</span>
                  <em>
                    {t(
                      step.optional
                        ? 'Not required'
                        : step.ready
                          ? 'Ready'
                          : 'Missing',
                    )}
                  </em>
                </div>
              ))}
            </div>
            {checkingReadiness && (
              <div className="shipping-readiness-status" role="status" aria-live="polite">
                {t('Checking shipping readiness…')}
              </div>
            )}
            {readinessError && (
              <div className="notice" role="alert">{t(readinessError)}</div>
            )}
            {!readyToShip && (
              <button
                type="button"
                className="secondary shipping-evidence-link"
                onClick={() => focusPageDestination('deal-evidence-vault')}
              >
                <ShieldCheck size={17} />
                {t('Upload required evidence')}
              </button>
            )}
          </div>
        </details>
      )}
      {shipment ? (
        <div className="shipment-card">
          <PackageCheck />
          <div>
            <b>{shipment.carrier}</b>
            <span>
              {t('Tracking number:')} {shipment.tracking_number}
            </span>
            <small>
              {t(shipment.status === 'delivered' ? 'Delivered' : 'Shipped')} ·{' '}
              {formatDateTime(shipment.shipped_at)}
            </small>
          </div>
        </div>
      ) : deal.viewerRole === 'seller' && delivery ? (
        <form onSubmit={saveShipment}>
          <label>
            {t('Carrier')}
            <input
              required
              minLength={2}
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder={t('UPS, FedEx, USPS…')}
            />
          </label>
          <label>
            {t('Tracking number')}
            <input
              required
              minLength={4}
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder={t('Enter tracking number')}
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={shipmentBusy}
            aria-busy={shipmentBusy}
          >
            {t(shipmentBusy ? 'Saving shipment…' : 'Mark as shipped')}
          </button>
        </form>
      ) : deal.viewerRole === 'buyer' && delivery ? (
        <div className="shipping-wait">
          {t('Waiting for the seller to add tracking information.')}
        </div>
      ) : null}
      {shipment?.status === 'shipped' && deal.status === 'accepted' && (
        <InspectionRecorder
          deal={deal}
          session={session}
          onRecorded={setInspectionRecorded}
        />
      )}
      {shipment?.status === 'shipped' &&
        deal.viewerRole === 'buyer' &&
        deal.status === 'accepted' && (
          <button
            type="button"
            className="primary confirm-delivery"
            disabled={!inspectionRecorded || shipmentBusy}
            aria-busy={shipmentBusy}
            onClick={delivered}
          >
            <PackageCheck size={18} />
            {t(shipmentBusy ? 'Confirming delivery…' : 'Confirm delivery')}
          </button>
        )}
      {message && (
        <div
          className="notice"
          role="status"
          aria-live="polite"
        >
          {t(message)}
        </div>
      )}
      <p className="shipping-note">
        <ShieldCheck />{' '}
        {t(
          inspectionRecorded
            ? 'Inspection recorded. Delivery can now be confirmed.'
            : 'Confirm delivery only after receiving and inspecting the item.',
        )}
      </p>
    </section>
    {confirmDialog}
    </>
  );
}
