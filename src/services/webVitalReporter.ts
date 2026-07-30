import { sendBoundedDiagnostic } from './diagnosticTransport.ts';

export type WebVitalMetric = 'lcp' | 'cls' | 'inp';
export type WebVitalRating = 'good' | 'needs_improvement' | 'poor';
export type WebVitalBucket =
  | 'under_2500'
  | '2500_4000'
  | 'over_4000'
  | 'under_0_1'
  | '0_1_0_25'
  | 'over_0_25'
  | 'under_200'
  | '200_500'
  | 'over_500';

export type WebVitalEvent = {
  schema: 'dealivra.web-vital.v1';
  metric: WebVitalMetric;
  rating: WebVitalRating;
  bucket: WebVitalBucket;
};

type LayoutShiftEntry = PerformanceEntry & {
  value?: number;
  hadRecentInput?: boolean;
};
type ExtendedPerformanceObserverInit = PerformanceObserverInit & {
  durationThreshold?: number;
};

const validEvents = new Set([
  'lcp:good:under_2500',
  'lcp:needs_improvement:2500_4000',
  'lcp:poor:over_4000',
  'cls:good:under_0_1',
  'cls:needs_improvement:0_1_0_25',
  'cls:poor:over_0_25',
  'inp:good:under_200',
  'inp:needs_improvement:200_500',
  'inp:poor:over_500',
]);

let monitoringStarted = false;

export function classifyWebVital(
  metric: WebVitalMetric,
  value: number,
): WebVitalEvent | null {
  if (!Number.isFinite(value) || value < 0) return null;

  let rating: WebVitalRating;
  let bucket: WebVitalBucket;
  if (metric === 'lcp') {
    [rating, bucket] = value <= 2_500
      ? ['good', 'under_2500']
      : value <= 4_000
        ? ['needs_improvement', '2500_4000']
        : ['poor', 'over_4000'];
  } else if (metric === 'cls') {
    [rating, bucket] = value <= 0.1
      ? ['good', 'under_0_1']
      : value <= 0.25
        ? ['needs_improvement', '0_1_0_25']
        : ['poor', 'over_0_25'];
  } else {
    [rating, bucket] = value <= 200
      ? ['good', 'under_200']
      : value <= 500
        ? ['needs_improvement', '200_500']
        : ['poor', 'over_500'];
  }

  return {
    schema: 'dealivra.web-vital.v1',
    metric,
    rating,
    bucket,
  };
}

export function normalizeWebVital(value: unknown): WebVitalEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== 4
    || source.schema !== 'dealivra.web-vital.v1'
    || typeof source.metric !== 'string'
    || typeof source.rating !== 'string'
    || typeof source.bucket !== 'string'
    || !validEvents.has(`${source.metric}:${source.rating}:${source.bucket}`)
  ) {
    return null;
  }
  return source as WebVitalEvent;
}

export function reportWebVital(value: unknown): void {
  const event = normalizeWebVital(value);
  if (
    !event
    || import.meta.env?.PROD !== true
    || typeof window === 'undefined'
  ) {
    return;
  }

  sendBoundedDiagnostic('/api/security/web-vital', {
    ...event,
    occurrence_count: 1,
  });
}

export function startWebVitalMonitoring(): void {
  if (
    monitoringStarted
    || import.meta.env?.PROD !== true
    || typeof window === 'undefined'
    || typeof PerformanceObserver !== 'function'
  ) {
    return;
  }
  monitoringStarted = true;

  let lcp: number | null = null;
  let cls = 0;
  let inp: number | null = null;
  const observers: PerformanceObserver[] = [];

  const observe = (
    entryType: string,
    callback: PerformanceObserverCallback,
    options?: ExtendedPerformanceObserverInit,
  ) => {
    if (!PerformanceObserver.supportedEntryTypes.includes(entryType)) return;
    try {
      const observer = new PerformanceObserver(callback);
      observer.observe(options ?? { type: entryType, buffered: true });
      observers.push(observer);
    } catch {
      // Unsupported observers must not affect the application.
    }
  };

  observe('largest-contentful-paint', list => {
    const entries = list.getEntries();
    const latest = entries.at(-1);
    if (latest) lcp = latest.startTime;
  });

  observe('layout-shift', list => {
    for (const rawEntry of list.getEntries()) {
      const entry = rawEntry as LayoutShiftEntry;
      if (!entry.hadRecentInput && typeof entry.value === 'number') {
        cls += entry.value;
      }
    }
  });

  observe(
    'event',
    list => {
      for (const entry of list.getEntries()) {
        if (Number.isFinite(entry.duration)) {
          inp = Math.max(inp ?? 0, entry.duration);
        }
      }
    },
    { type: 'event', buffered: true, durationThreshold: 40 },
  );

  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    observers.forEach(observer => {
      observer.disconnect();
    });
    if (lcp !== null) reportWebVital(classifyWebVital('lcp', lcp));
    reportWebVital(classifyWebVital('cls', cls));
    if (inp !== null) reportWebVital(classifyWebVital('inp', inp));
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalize();
  }, { once: true });
  window.addEventListener('pagehide', finalize, { once: true });
}
