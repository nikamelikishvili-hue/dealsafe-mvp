export const publicInfoPaths = {
  'buyer-protection': '/buyer-protection',
  'seller-protection': '/seller-protection',
  fees: '/fees',
  disputes: '/disputes',
  terms: '/terms',
  privacy: '/privacy',
} as const;

export type PublicInfoView = keyof typeof publicInfoPaths;
export const verifyPath = '/verify';
export const createPath = '/create';
export const forgotPasswordPath = '/forgot-password';
export const authPath = (mode: 'signin' | 'signup') => `/${mode}`;
export const dealPath = (publicId: string, documentMode = false) =>
  `/deal/${encodeURIComponent(publicId)}${documentMode ? '?document=1' : ''}`;
export const trustPassportPath = (publicId: string) =>
  `/trust/${encodeURIComponent(publicId)}`;

export type BrowserRouteView =
  | 'home'
  | 'create'
  | 'auth'
  | 'forgot'
  | 'reset'
  | 'passport'
  | 'deal'
  | 'verify'
  | 'not-found'
  | PublicInfoView;

export type BrowserRoute = {
  view: BrowserRouteView;
  authMode?: 'signin' | 'signup';
  recoveryToken?: string;
  publicDealId?: string;
  trustId?: string;
  documentMode?: boolean;
};

const normalizePathname = (pathname: string) => {
  if (pathname === '/') return '/';
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
};

export function resolveBrowserRoute(input: string | URL): BrowserRoute {
  const url = input instanceof URL ? input : new URL(input, 'https://dealivra.com');
  const pathname = normalizePathname(url.pathname);

  const recoveryParams = new URLSearchParams(url.hash.slice(1));
  const recoveryToken = recoveryParams.get('type') === 'recovery'
    ? recoveryParams.get('access_token') || ''
    : '';
  if (recoveryToken) return { view: 'reset', recoveryToken };

  if (pathname === createPath) return { view: 'create' };
  if (pathname === forgotPasswordPath) return { view: 'forgot' };
  if (pathname === authPath('signin')) return { view: 'auth', authMode: 'signin' };
  if (pathname === authPath('signup')) return { view: 'auth', authMode: 'signup' };

  const dealMatch = pathname.match(/^\/deal\/(.+)$/);
  if (dealMatch) {
    try {
      return {
        view: 'deal',
        publicDealId: decodeURIComponent(dealMatch[1]),
        documentMode: url.searchParams.get('document') === '1',
      };
    } catch {
      return { view: 'not-found' };
    }
  }

  const trustMatch = pathname.match(/^\/trust\/(.+)$/);
  if (trustMatch) {
    try {
      return { view: 'passport', trustId: decodeURIComponent(trustMatch[1]) };
    } catch {
      return { view: 'not-found' };
    }
  }

  if (pathname === '/') {
    const trustId = url.searchParams.get('trust')?.trim();
    if (trustId) return { view: 'passport', trustId };

    const publicDealId = url.searchParams.get('deal')?.trim();
    if (publicDealId) {
      return {
        view: 'deal',
        publicDealId,
        documentMode: url.searchParams.get('document') === '1',
      };
    }

    const start = url.searchParams.get('start');
    if (start === 'create') return { view: 'create' };
    if (start === 'forgot') return { view: 'forgot' };
    if (start === 'signin' || start === 'signup') {
      return { view: 'auth', authMode: start };
    }
    return { view: 'home' };
  }

  if (pathname === verifyPath) return { view: 'verify' };
  const publicInfoView = Object.entries(publicInfoPaths)
    .find(([, path]) => pathname === path)?.[0] as PublicInfoView | undefined;
  return publicInfoView ? { view: publicInfoView } : { view: 'not-found' };
}

export const isPublicInfoView = (view: string): view is PublicInfoView =>
  Object.hasOwn(publicInfoPaths, view);
