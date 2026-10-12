"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Language, Translations, translations } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof Translations | string, fallback?: string) => string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  isFrench: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "leaselink_preferred_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (savedLang === "en" || savedLang === "fr") {
        setLanguageState(savedLang);
      } else {
        // Detect browser preference
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith("fr")) {
          setLanguageState("fr");
        }
      }
    } catch {
      // Fallback silently if localStorage not available
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    const nextLang: Language = language === "en" ? "fr" : "en";
    setLanguage(nextLang);
  };

  const t = useMemo(() => {
    const currentDict = translations[language] || translations.en;
    const fallbackDict = translations.en;

    return (key: keyof Translations | string, fallback?: string): string => {
      if (key in currentDict) {
        return (currentDict as any)[key] ?? (fallbackDict as any)[key] ?? fallback ?? key;
      }
      return (fallbackDict as any)[key] ?? fallback ?? key;
    };
  }, [language]);

  const formatCurrency = (amount: number): string => {
    const num = Number(amount || 0);
    return `${num.toLocaleString(language === "fr" ? "fr-FR" : "en-US")} XAF`;
  };

  const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      const locale = language === "fr" ? "fr-FR" : "en-US";
      return d.toLocaleDateString(locale, options || { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return String(date);
    }
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t,
    formatCurrency,
    formatDate,
    isFrench: language === "fr",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback for non-provider renders
    return {
      language: "en" as Language,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: string, fallback?: string) =>
        (translations.en as any)[key] || fallback || key,
      formatCurrency: (amount: number) => `${Number(amount || 0).toLocaleString()} XAF`,
      formatDate: (date: string | Date) => new Date(date).toLocaleDateString(),
      isFrench: false,
    };
  }
  return context;
}
