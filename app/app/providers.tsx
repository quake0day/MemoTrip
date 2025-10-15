'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formatTranslation, translations, type Locale, type TranslationKey } from '@/lib/i18n/translations';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
};

const DEFAULT_LOCALE: Locale = 'en';

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key) => translations[DEFAULT_LOCALE][key],
});

const STORAGE_KEY = 'memotrip.locale';

function normalizeLocale(locale: string | null): Locale | null {
  if (!locale) return null;
  return locale === 'zh' ? 'zh' : locale === 'en' ? 'en' : null;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key, replacements) => {
      const template = translations[locale][key] ?? translations[DEFAULT_LOCALE][key];
      return formatTranslation(template, replacements);
    },
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            locale === 'en'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          onClick={() => setLocale('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            locale === 'zh'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          onClick={() => setLocale('zh')}
        >
          中文
        </button>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      {children}
      <LanguageSwitcher />
    </I18nProvider>
  );
}
