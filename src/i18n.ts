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

const languageKey = 'dealsafe_language';
const languageCodes = new Set<string>(supportedLanguages.map(language => language.code));
const resolveLanguage = (value: string | null): AppLanguage => {
  const normalized = (value || '').toLowerCase();
  const exact = supportedLanguages.find(language => language.code === normalized);
  if (exact) return exact.code;
  const base = normalized.split('-')[0];
  return languageCodes.has(base) ? (base as AppLanguage) : 'en';
};

const storedLanguage = localStorage.getItem(languageKey);
let activeLanguage: AppLanguage =
  storedLanguage && languageCodes.has(storedLanguage)
    ? (storedLanguage as AppLanguage)
    : resolveLanguage(navigator.languages?.[0] || navigator.language);

let translate: (text: string) => string = text => text;
let fullTranslations: Promise<typeof import('./i18nFull')> | null = null;

const applyDocumentLanguage = (language: AppLanguage) => {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' || language === 'he' ? 'rtl' : 'ltr';
};

const loadTranslations = async (language: AppLanguage) => {
  if (language === 'en') {
    translate = text => text;
    return;
  }

  fullTranslations ??= import('./i18nFull');
  const module = await fullTranslations;
  module.setAppLanguage(language);
  translate = module.t;
};

applyDocumentLanguage(activeLanguage);

export async function initializeI18n() {
  await loadTranslations(activeLanguage);
}

export function getAppLanguage() {
  return activeLanguage;
}

export async function setAppLanguage(language: AppLanguage) {
  activeLanguage = language;
  localStorage.setItem(languageKey, language);
  applyDocumentLanguage(language);
  await loadTranslations(language);
}

export function t(text: string) {
  return translate(text);
}
