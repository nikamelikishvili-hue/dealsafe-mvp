import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Deal } from './domain';
import { t } from './i18n';
import type { DealActionPlan } from './services/supabaseRest';

export type DealPrimaryAction = {
  label: string;
  detail: string;
  targetId: string;
  kind: 'scroll' | 'create' | 'accept' | 'signin' | 'retry-shipping';
};

export type ShippingNavigationReadiness = {
  status: 'loading' | 'ready' | 'error';
  ready: boolean;
};

function getShippingPrimaryAction(
  deal: Deal,
  plan: DealActionPlan | undefined,
  readiness: ShippingNavigationReadiness | undefined,
): DealPrimaryAction {
  if (deal.viewerRole === 'seller') {
    if (!plan) {
      return {
        label: 'Review delivery',
        detail: 'Checking the latest payment and shipping status.',
        targetId: 'deal-actions',
        kind: 'scroll',
      };
    }
    if (readiness?.status === 'error') {
      return {
        label: 'Retry shipping check',
        detail: 'Shipping readiness is unavailable. Retry before continuing.',
        targetId: 'shipping-panel',
        kind: 'retry-shipping',
      };
    }
    if (!readiness || readiness.status === 'loading') {
      return {
        label: 'Check package evidence',
        detail: 'Checking the required evidence before shipping.',
        targetId: 'deal-evidence-vault',
        kind: 'scroll',
      };
    }
    if (!readiness.ready) {
      return {
        label: 'Add package evidence',
        detail: 'Step 1 of 2: document the item and sealed package.',
        targetId: 'deal-evidence-vault',
        kind: 'scroll',
      };
    }
    if (!plan.delivery_address_ready) {
      return {
        label: 'View address status',
        detail: 'Package evidence is complete. The buyer must add a delivery address.',
        targetId: 'shipping-panel',
        kind: 'scroll',
      };
    }
    if (!plan.shipment_status) {
      return {
        label: 'Add tracking',
        detail: 'Step 2 of 2: choose the carrier and save tracking.',
        targetId: 'shipping-panel',
        kind: 'scroll',
      };
    }
    if (plan.shipment_status === 'shipped') {
      return {
        label: 'View shipment',
        detail: 'Tracking is saved. Waiting for buyer inspection and receipt.',
        targetId: 'shipping-panel',
        kind: 'scroll',
      };
    }
    return {
      label: 'Review receipt',
      detail: 'Delivery is recorded. Review the completed transaction.',
      targetId: 'shipping-panel',
      kind: 'scroll',
    };
  }

  if (!plan) {
    return {
      label: 'Review delivery',
      detail: 'Checking the latest delivery status.',
      targetId: 'deal-actions',
      kind: 'scroll',
    };
  }
  if (!plan.delivery_address_ready) {
    return {
      label: 'Add delivery address',
      detail: 'Add the private address the seller should ship to.',
      targetId: 'shipping-panel',
      kind: 'scroll',
    };
  }
  if (!plan.shipment_status) {
    return {
      label: 'View delivery status',
      detail: 'Your address is saved. Waiting for the seller to ship.',
      targetId: 'shipping-panel',
      kind: 'scroll',
    };
  }
  if (!plan.inspection_recorded) {
    return {
      label: 'Record inspection',
      detail: 'Inspect the delivered item before confirming receipt.',
      targetId: 'shipping-panel',
      kind: 'scroll',
    };
  }
  if (plan.shipment_status === 'shipped') {
    return {
      label: 'Confirm delivery',
      detail: 'Your inspection is saved. Confirm that the item was received.',
      targetId: 'shipping-panel',
      kind: 'scroll',
    };
  }
  return {
    label: 'Review receipt',
    detail: 'Delivery is recorded. Review the completed transaction.',
    targetId: 'shipping-panel',
    kind: 'scroll',
  };
}

interface ResolveDealPrimaryActionInput {
  deal: Deal;
  demoCompleted: boolean;
  expired: boolean;
  agreementActionReady: boolean;
  signedIn: boolean;
  paymentReady: boolean;
  actionPlan: DealActionPlan | undefined;
  shippingReadiness: ShippingNavigationReadiness | undefined;
}

export function resolveDealPrimaryAction({
  deal,
  demoCompleted,
  expired,
  agreementActionReady,
  signedIn,
  paymentReady,
  actionPlan,
  shippingReadiness,
}: ResolveDealPrimaryActionInput): DealPrimaryAction {
  if (demoCompleted) {
    return {
      label: 'Start a deal',
      detail: 'Create your own private Deal Link.',
      targetId: 'deal-overview',
      kind: 'create',
    };
  }
  if (expired) {
    return {
      label: 'Review status',
      detail: 'This offer has expired.',
      targetId: 'deal-safety',
      kind: 'scroll',
    };
  }
  if (deal.status === 'draft') {
    return {
      label: 'Finish draft',
      detail: 'Complete the details and publish when ready.',
      targetId: 'deal-manage',
      kind: 'scroll',
    };
  }
  if (deal.status === 'published' && deal.viewerRole !== 'seller') {
    return {
      label: agreementActionReady ? 'Accept terms' : 'Review agreement',
      detail: agreementActionReady
        ? 'Your confirmations are complete.'
        : 'Confirm the item, price, handoff, and your name.',
      targetId: 'deal-agreement',
      kind: agreementActionReady ? 'accept' : 'scroll',
    };
  }
  if (deal.status === 'published') {
    return {
      label: 'Share with buyer',
      detail: 'Copy the Deal Link or invite the buyer.',
      targetId: 'deal-actions',
      kind: 'scroll',
    };
  }
  if (deal.status === 'accepted' && (!signedIn || deal.viewerRole === 'visitor')) {
    return {
      label: 'Sign in to continue',
      detail: 'Sign in to access payment and delivery actions.',
      targetId: 'deal-actions',
      kind: 'signin',
    };
  }
  if (deal.status === 'accepted' && !paymentReady) {
    return {
      label: deal.viewerRole === 'seller' ? 'Set up payment' : 'Continue payment',
      detail:
        deal.viewerRole === 'seller'
          ? 'Connect payouts so the buyer can pay.'
          : 'Open the Stripe Sandbox payment step.',
      targetId: 'payment-status-panel',
      kind: 'scroll',
    };
  }
  if (deal.status === 'accepted' && deal.deliveryMethod === 'Ship to buyer') {
    return getShippingPrimaryAction(deal, actionPlan, shippingReadiness);
  }
  if (deal.status === 'accepted') {
    return {
      label: 'Plan handoff',
      detail: 'Arrange and complete the in-person exchange.',
      targetId: 'meeting-panel',
      kind: 'scroll',
    };
  }
  if (deal.status === 'completed' && signedIn && deal.viewerRole !== 'visitor') {
    return {
      label: 'Finish deal',
      detail: 'Review the receipt or rate the other party.',
      targetId: 'rating-panel',
      kind: 'scroll',
    };
  }
  return {
    label: 'Review status',
    detail: 'See the current record and safety actions.',
    targetId:
      deal.status === 'disputed' || deal.status === 'cancelled'
        ? 'deal-safety'
        : 'deal-records',
    kind: 'scroll',
  };
}

export function DealWorkspaceGroup({
  id,
  icon: Icon,
  kicker,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      id={id}
      className="deal-workspace-group"
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="deal-workspace-group-icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="deal-workspace-group-copy">
          <small>{t(kicker)}</small>
          <strong>{t(title)}</strong>
          <em>{t(summary)}</em>
        </span>
        <ChevronDown className="deal-workspace-chevron" aria-hidden="true" />
      </summary>
      <div className="deal-workspace-group-content">{children}</div>
    </details>
  );
}

export function DealWorkspaceNavigation({
  deal,
  expired,
  homeLabel,
  nextStep,
  demo,
  primaryAction,
  onBack,
  onOpenActions,
  onOpenProtection,
  onOpenRecords,
  onPrimaryAction,
}: {
  deal: Pick<Deal, 'publicId' | 'status'>;
  expired: boolean;
  homeLabel: string;
  nextStep: string;
  demo: boolean;
  primaryAction: DealPrimaryAction;
  onBack: () => void;
  onOpenActions: () => void;
  onOpenProtection: () => void;
  onOpenRecords: () => void;
  onPrimaryAction: () => void;
}) {
  return (
    <div className="deal-workspace-bar">
      <button type="button" className="back" onClick={onBack}>
        ← {t(homeLabel)}
      </button>
      <div className="deal-workspace-id">
        <span className={`status ${expired ? 'expired' : deal.status}`}>
          {t(expired ? 'expired' : deal.status)}
        </span>
        <b>{deal.publicId}</b>
      </div>
      <nav aria-label={t('Deal page navigation')}>
        <span className="deal-workspace-next">
          <small>{t('Next step')}</small>
          <b>{t(nextStep)}</b>
        </span>
        {!demo && (
          <>
            <button type="button" className="deal-nav-actions" onClick={onOpenActions}>
              {t('Actions')}
            </button>
            <button
              type="button"
              className="deal-nav-protection"
              onClick={onOpenProtection}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              <span>{t('Protection')}</span>
            </button>
            <button type="button" className="deal-nav-records" onClick={onOpenRecords}>
              {t('Records')}
            </button>
          </>
        )}
        <button type="button" className="deal-action-link" onClick={onPrimaryAction}>
          {t(primaryAction.label)}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

export function DealPrimaryActionDock({
  action,
  price,
  onPrimaryAction,
}: {
  action: DealPrimaryAction;
  price: string;
  onPrimaryAction: () => void;
}) {
  return (
    <div
      className="deal-primary-dock"
      role="region"
      aria-live="polite"
      aria-label={t('Primary deal action')}
    >
      <div>
        <small>{t('Next step')}</small>
        <strong>{t(action.label)}</strong>
        <span>{t(action.detail)}</span>
      </div>
      <em>{price}</em>
      <button type="button" className="primary" onClick={onPrimaryAction}>
        {t(action.label)}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
