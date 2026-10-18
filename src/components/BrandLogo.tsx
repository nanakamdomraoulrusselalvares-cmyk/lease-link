"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BrandLogoProps {
  href?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
  layout?: "horizontal" | "vertical";
}

export default function BrandLogo({
  href,
  size = "md",
  showText = true,
  showSubtitle = false,
  className = "",
  layout = "horizontal",
}: BrandLogoProps) {
  const { isFrench } = useLanguage();

  const sizeMap = {
    xs: { px: 24, text: "text-xs", sub: "text-[9px]" },
    sm: { px: 32, text: "text-sm", sub: "text-[10px]" },
    md: { px: 40, text: "text-base", sub: "text-[11px]" },
    lg: { px: 48, text: "text-lg", sub: "text-xs" },
    xl: { px: 64, text: "text-2xl", sub: "text-sm" },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const isVertical = layout === "vertical";

  const content = (
    <div
      className={`inline-flex ${
        isVertical ? "flex-col items-center text-center gap-2" : "items-center gap-2.5"
      } group ${className}`}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        <Image
          src="/brand/leaselink-symbol.png"
          alt="LeaseLink"
          width={currentSize.px}
          height={currentSize.px}
          className="object-contain group-hover:scale-105 transition-transform"
          style={{ width: currentSize.px, height: currentSize.px }}
          priority
        />
      </div>

      {showText && (
        <div className={`flex flex-col leading-tight ${isVertical ? "items-center" : ""}`}>
          <span
            className={`font-black tracking-tight text-slate-900 dark:text-white ${currentSize.text}`}
          >
            Lease
            <span className="text-emerald-500 dark:text-emerald-400">
              Link
            </span>
          </span>
          {showSubtitle && (
            <span
              className={`font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 ${
                isVertical ? "mt-0.5" : "mt-0.5"
              } ${currentSize.sub}`}
            >
              {isFrench ? "Gestion Locative" : "Smart Rentals"}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex cursor-pointer focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
