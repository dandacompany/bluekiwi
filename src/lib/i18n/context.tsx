"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  type Locale,
  type TranslationKey,
  type TranslationParams,
  defaultLocale,
  getDictionary,
  getNestedValue,
  interpolate,
} from ".";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return defaultLocale;
    const saved = window.localStorage.getItem("locale") as Locale | null;
    return saved === "ko" || saved === "en" ? saved : defaultLocale;
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, params?: TranslationParams) =>
      interpolate(
        getNestedValue(
          getDictionary(locale) as unknown as Record<string, unknown>,
          key,
        ),
        params,
      ),
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}
