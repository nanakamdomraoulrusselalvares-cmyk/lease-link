"use client";

import React from "react";
import { useTheme } from "@/lib/theme/ThemeContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Sun, Moon } from "lucide-react";

interface ThemeSwitcherProps {
  className?: string;
  variant?: "pill" | "minimal";
}

export default function ThemeSwitcher({
  className = "",
  variant = "pill",
}: ThemeSwitcherProps) {
  const { theme, setTheme, toggleTheme, isDark } = useTheme();
  const { isFrench } = useLanguage();

    if (variant === "minimal") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 transition cursor-pointer shadow-xs ${className}`}
        title={
          isDark
            ? isFrench
              ? "Passer au mode clair"
              : "Switch to bright mode"
            : isFrench
            ? "Passer au mode sombre"
            : "Switch to dark mode"
        }
        aria-label={isDark ? "Switch to bright mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-blue-600 transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>
    );
  }

  // Default Pill Variant for Top Navbars / Headers
  return (
    <div
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 text-xs font-bold shadow-xs ${className}`}
      role="group"
      aria-label="Theme selection"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
          theme === "light"
            ? "bg-white text-amber-700 shadow-sm border border-slate-200/80 font-bold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
        }`}
        title={isFrench ? "Mode Clair / Lumineux" : "Bright / Light Mode"}
      >
        <Sun
          className={`w-3.5 h-3.5 ${
            theme === "light"
              ? "text-amber-500 fill-amber-500"
              : "text-amber-500"
          }`}
        />
        <span className="text-[11px] font-semibold">
          {isFrench ? "Clair" : "Light"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
          theme === "dark"
            ? "bg-slate-800 text-white font-bold shadow-sm ring-1 ring-slate-700"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
        }`}
        title={isFrench ? "Mode Sombre" : "Dark Mode"}
      >
        <Moon
          className={`w-3.5 h-3.5 ${
            theme === "dark"
              ? "text-white fill-white"
              : "text-slate-500 dark:text-blue-400"
          }`}
        />
        <span className="text-[11px] font-semibold">
          {isFrench ? "Sombre" : "Dark"}
        </span>
      </button>
    </div>
  );
}
