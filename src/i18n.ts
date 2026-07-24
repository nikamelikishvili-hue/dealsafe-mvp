export const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'ka', name: 'ქართული' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'zh', name: '简体中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'he', name: 'עברית' },
  { code: 'hi', name: 'हिन्दी' },
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
