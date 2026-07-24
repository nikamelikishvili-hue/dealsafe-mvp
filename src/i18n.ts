export const supportedLanguages = [
  { code: 'en', name: 'English (US)' },
] as const;

export type AppLanguage = (typeof supportedLanguages)[number]['code'];

const launchLocale = 'en-US';

const applyLaunchLanguage = () => {
  document.documentElement.lang = launchLocale;
  document.documentElement.dir = 'ltr';
};

applyLaunchLanguage();

// Translation files stay in the codebase for a future international launch,
// but the first public release is intentionally English-only.
export async function initializeI18n() {
  applyLaunchLanguage();
}

export function getAppLanguage() {
  return launchLocale;
}

export async function setAppLanguage(_language: AppLanguage) {
  applyLaunchLanguage();
}

export function t(text: string) {
  return text;
}
