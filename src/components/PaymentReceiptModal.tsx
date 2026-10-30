"use client";

import { useEffect, useRef, useState } from "react";
import { RentPayment } from "@/types/database";
import {
  PAYMENT_METHOD_LABELS,
  buildPaymentConfirmationWhatsAppUrl,
} from "@/lib/services/paymentService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { uploadReceiptToStorage } from "@/lib/services/storageService";
import {
  Download,
  X,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Receipt,
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface PaymentReceiptModalProps {
  payment: RentPayment | null;
  isOpen: boolean;
  onClose: () => void;
  landlordPhone?: string;
  landlordName?: string;
}

/**
 * Computes deterministic unique stamp attributes based on landlord and residence name
 */
function getLandlordStampMeta(landlordName: string, buildingName: string) {
  const cleanLandlord = (landlordName || "Official Landlord").trim();
  const cleanBuilding = (buildingName || "Residence").trim();

  // Deterministic seed / code based on landlord + building
  const combined = `${cleanLandlord}:::${cleanBuilding}`.toUpperCase();
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const stampCode = `LL-STAMP-${positiveHash
    .toString(36)
    .toUpperCase()
    .padStart(5, "0")
    .slice(-5)}`;

  return {
    landlordName: cleanLandlord,
    residenceName: cleanBuilding,
    stampCode,
  };
}

export default function PaymentReceiptModal({
  payment,
  isOpen,
  onClose,
  landlordPhone,
  landlordName,
}: PaymentReceiptModalProps) {
  const { language, isFrench, t, formatDate } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !payment) return null;

  const effectiveLandlordName =
    landlordName || payment.landlord_name || (isFrench ? "Gestion Immobilière" : "Official Landlord Management");
  const effectiveResidenceName = payment.building_name || (isFrench ? "Résidence" : "Residence");

  const stampMeta = getLandlordStampMeta(
    effectiveLandlordName,
    effectiveResidenceName
  );

  const methodMeta =
    PAYMENT_METHOD_LABELS[payment.payment_method] ||
    PAYMENT_METHOD_LABELS.momo;

  const isFullPayment = payment.payment_type === "full";
  const formattedPaid = Number(payment.amount_paid || 0).toLocaleString(
    isFrench ? "fr-FR" : "en-US"
  );
  const formattedRent = Number(
    payment.monthly_rent_amount || 0
  ).toLocaleString(isFrench ? "fr-FR" : "en-US");
  const formattedBalance = Number(
    payment.balance_remaining || 0
  ).toLocaleString(isFrench ? "fr-FR" : "en-US");
  const formattedDate = new Date(payment.created_at).toLocaleString(
    isFrench ? "fr-FR" : "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const handleCopyReceipt = () => {
    const text = isFrench
      ? `🧾 QUITTANCE DE LOYER OFFICIELLE LEASELINK
N° de Quittance : ${payment.receipt_number}
Sceau Bailleur : ${stampMeta.stampCode} (${effectiveLandlordName} - ${effectiveResidenceName})
Locataire : ${payment.tenant_name}
Logement : Logement ${payment.unit_number} (${payment.building_name})
Mois : ${payment.rent_month}
Montant Payé : ${formattedPaid} XAF
Solde Restant : ${formattedBalance} XAF
Mode de Paiement : ${methodMeta.label}
Réf. Transaction : ${payment.transaction_ref}
Date : ${formattedDate}`
      : `🧾 LEASELINK OFFICIAL RENT RECEIPT
Receipt #: ${payment.receipt_number}
Landlord Stamp: ${stampMeta.stampCode} (${effectiveLandlordName} - ${effectiveResidenceName})
Tenant: ${payment.tenant_name}
Unit: ${payment.unit_number} (${payment.building_name})
Month: ${payment.rent_month}
Amount Paid: ${formattedPaid} XAF
Remaining Balance: ${formattedBalance} XAF
Payment Method: ${methodMeta.label}
Ref: ${payment.transaction_ref}
Date: ${formattedDate}`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * Generates a high-resolution, pixel-perfect official receipt image with the unique stamp
   * and triggers direct download to user's device (no print dialog).
   */
  const handleDownloadReceipt = async () => {
    setIsDownloading(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1520;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      // 1. Background Paper
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1200, 1520);

      // Outer Decorative Border
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 1160, 1480);

      // Inner Border
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(28, 28, 1144, 1464);

      // 2. Top Header Bar
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(20, 20, 1160, 140);

      // Brand Logo Box
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.roundRect(50, 45, 80, 80, 16);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText("LL", 70, 98);

      // Header Titles
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 34px sans-serif";
      ctx.fillText("LeaseLink", 150, 80);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        isFrench
          ? "QUITTANCE NUMÉRIQUE OFFICIELLE DE LOYER"
          : "OFFICIAL DIGITAL RENT RECEIPT • QUITTANCE DE LOYER",
        150,
        110
      );

      // Receipt Number & Date (Top Right)
      ctx.textAlign = "right";
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 22px monospace";
      ctx.fillText(payment.receipt_number, 1130, 75);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px sans-serif";
      ctx.fillText(formattedDate, 1130, 105);
      ctx.textAlign = "left";

      // 3. Status Banner
      ctx.fillStyle = isFullPayment ? "#ecfdf5" : "#fffbeb";
      ctx.strokeStyle = isFullPayment ? "#059669" : "#d97706";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(50, 190, 1100, 110, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isFullPayment ? "#065f46" : "#92400e";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(
        isFrench
          ? isFullPayment
            ? "✓ LOYER INTÉGRALEMENT PAYÉ (100% SOLDÉ)"
            : "⚠ PAIEMENT PARTIEL (SOLDE RESTANT DÛ)"
          : isFullPayment
          ? "✓ RENT FULLY PAID (100% SETTLED)"
          : "⚠ PARTIAL RENT PAYMENT (BALANCE OWING)",
        80,
        240
      );

      ctx.font = "18px sans-serif";
      ctx.fillText(
        isFrench
          ? `Période : ${payment.rent_month} • Confirmé & Légalement Validé`
          : `Period: ${payment.rent_month} • Confirmed & Legally Validated`,
        80,
        275
      );

      ctx.textAlign = "right";
      ctx.fillStyle = isFullPayment ? "#047857" : "#b45309";
      ctx.font = "bold 36px monospace";
      ctx.fillText(`${formattedPaid} XAF`, 1120, 255);
      ctx.textAlign = "left";

      // 4. Details Box (Landlord & Residence vs Tenant)
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(50, 330, 1100, 210, 16);
      ctx.fill();
      ctx.stroke();

      // Divider Line
      ctx.beginPath();
      ctx.moveTo(600, 345);
      ctx.lineTo(600, 525);
      ctx.strokeStyle = "#e2e8f0";
      ctx.stroke();

      // Left Column: Landlord & Residence
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(
        isFrench ? "BAILLEUR & GESTION IMMOBILIÈRE" : "LANDLORD & PROPERTY MANAGEMENT",
        80,
        365
      );

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(effectiveLandlordName, 80, 400);

      ctx.fillStyle = "#334155";
      ctx.font = "18px sans-serif";
      ctx.fillText(
        isFrench ? `Résidence : ${effectiveResidenceName}` : `Residence: ${effectiveResidenceName}`,
        80,
        435
      );
      ctx.fillText(
        isFrench
          ? `Logement attribué : Logement ${payment.unit_number}`
          : `Allocated Unit: Unit ${payment.unit_number}`,
        80,
        468
      );

      ctx.fillStyle = "#64748b";
      ctx.font = "16px monospace";
      ctx.fillText(
        isFrench ? `Loyer mensuel : ${formattedRent} XAF` : `Monthly Rent: ${formattedRent} XAF`,
        80,
        502
      );

      // Right Column: Tenant
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(isFrench ? "LOCATAIRE (PAYEUR)" : "TENANT (LOCATAIRE)", 630, 365);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(payment.tenant_name, 630, 400);

      ctx.fillStyle = "#334155";
      ctx.font = "18px monospace";
      ctx.fillText(
        isFrench ? `Téléphone : ${payment.tenant_phone}` : `Phone: ${payment.tenant_phone}`,
        630,
        435
      );

      if (payment.tenant_email) {
        ctx.font = "16px sans-serif";
        ctx.fillText(`Email: ${payment.tenant_email}`, 630, 468);
      }

      ctx.fillStyle = "#059669";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(
        isFrench ? "Statut : Bail actif vérifié" : "Status: Active Tenancy Verified",
        630,
        502
      );

      // 5. Payment Breakdown Table
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(
        isFrench ? "DÉTAIL DU PAIEMENT" : "PAYMENT BREAKDOWN",
        50,
        580
      );

      const tableY = 600;
      const rowHeight = 60;
      const rows: [string, string, string, boolean][] = [
        [
          isFrench ? "Loyer convenu pour la période" : "Agreed Rent for Period",
          `${formattedRent} XAF`,
          "#0f172a",
          false,
        ],
        [
          isFrench ? "Montant reçu & confirmé" : "Amount Received & Confirmed",
          `+ ${formattedPaid} XAF`,
          "#047857",
          true,
        ],
        [
          isFrench
            ? "Solde restant (Arriérés / Dû)"
            : "Remaining Balance (Arrears / Owing)",
          payment.balance_remaining > 0
            ? `${formattedBalance} XAF`
            : isFrench
            ? "0 XAF (Intégralement soldé)"
            : "0 XAF (Fully Settled)",
          payment.balance_remaining > 0 ? "#b45309" : "#047857",
          true,
        ],
        [isFrench ? "Mode de paiement" : "Payment Method", methodMeta.label, "#1e293b", false],
        [
          isFrench ? "Référence de transaction" : "Transaction Reference",
          payment.transaction_ref,
          "#475569",
          false,
        ],
      ];

      rows.forEach(([label, val, color, isBold], idx) => {
        const currentY = tableY + idx * rowHeight;
        ctx.fillStyle = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
        ctx.fillRect(50, currentY, 1100, rowHeight);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(50, currentY, 1100, rowHeight);

        ctx.fillStyle = "#475569";
        ctx.font = "18px sans-serif";
        ctx.fillText(label, 75, currentY + 38);

        ctx.textAlign = "right";
        ctx.fillStyle = color;
        ctx.font = isBold ? "bold 20px monospace" : "18px monospace";
        ctx.fillText(val, 1125, currentY + 38);
        ctx.textAlign = "left";
      });

      // 6. DRAW THE UNIQUE OFFICIAL LANDLORD STAMP (Bottom Right)
      const stampX = 890;
      const stampY = 1140;
      ctx.save();
      ctx.translate(stampX, stampY);
      ctx.rotate(-0.09); // Authentic physical tilt

      const stampColor = "#dc2626";
      ctx.strokeStyle = stampColor;
      ctx.fillStyle = stampColor;

      // Outer Dashed Circle
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 160, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Solid Circle
      ctx.setLineDash([]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 146, 0, Math.PI * 2);
      ctx.stroke();

      // Top arc header
      ctx.textAlign = "center";
      ctx.font = "bold 13px serif";
      ctx.fillText(
        isFrench ? "★ SCEAU OFFICIEL DE GESTION ★" : "★ OFFICIAL MANAGEMENT SEAL ★",
        0,
        -112
      );

      // Landlord Name in Stamp
      ctx.font = "bold 20px sans-serif";
      const displayLandlord =
        effectiveLandlordName.length > 20
          ? effectiveLandlordName.substring(0, 18).toUpperCase() + ".."
          : effectiveLandlordName.toUpperCase();
      ctx.fillText(displayLandlord, 0, -65);

      // Residence Name in Stamp
      ctx.font = "bold 15px sans-serif";
      const displayResidence =
        effectiveResidenceName.length > 22
          ? effectiveResidenceName.substring(0, 20).toUpperCase() + ".."
          : effectiveResidenceName.toUpperCase();
      ctx.fillText(displayResidence, 0, -35);

      // Boxed status
      ctx.strokeStyle = stampColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-110, -10, 220, 42);
      ctx.font = "bold 18px monospace";
      ctx.fillText(isFrench ? "✓ PAYÉ & VALIDÉ" : "✓ PAID & VALIDATED", 0, 18);

      // Stamp Serial Ref
      ctx.font = "bold 13px monospace";
      ctx.fillText(stampMeta.stampCode, 0, 60);

      ctx.font = "12px sans-serif";
      ctx.fillText(
        isFrench ? "PROPRIÉTÉ VÉRIFIÉE LEASELINK" : "LEASELINK VERIFIED PROPERTY",
        0,
        95
      );
      ctx.fillText("★ ★ ★", 0, 122);

      ctx.restore();

      // 7. Security Footnote
      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        isFrench
          ? "Authentifié numériquement et conservé sur le registre LeaseLink Cloud."
          : "Digitally authenticated and stored on LeaseLink Property Cloud Ledger.",
        50,
        1400
      );
      ctx.fillText(
        isFrench
          ? `Réf. Sceau unique : ${stampMeta.stampCode} • Preuve de bail légalement valide.`
          : `Unique Stamp Ref: ${stampMeta.stampCode} • Valid tenancy proof.`,
        50,
        1425
      );

      ctx.textAlign = "right";
      ctx.fillStyle = "#059669";
      ctx.font = "bold 15px monospace";
      ctx.fillText(
        isFrench ? "STATUT : TERMINÉ & VÉRIFIÉ" : "STATUS: COMPLETED & VERIFIED",
        1150,
        1425
      );
      ctx.textAlign = "left";

      // 8. Convert to PNG Blob and Trigger Automatic Download
      canvas.toBlob((blob) => {
        if (!blob) throw new Error("Failed to generate image blob");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Receipt-${payment.receipt_number}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDownloading(false);

        // Auto-archive rent receipt to private receipts bucket
        uploadReceiptToStorage(blob, "rent", payment.landlord_id, payment.receipt_number, "png")
          .then(async (uploadRes) => {
            if (uploadRes.path) {
              try {
                const supabase = createClient();
                await supabase
                  .from("rent_payments")
                  .update({ receipt_url: uploadRes.path })
                  .eq("receipt_number", payment.receipt_number);
              } catch (_) {}
            }
          })
          .catch((err) => console.warn("Rent receipt auto-archive notice:", err));
      }, "image/png");
    } catch (err) {
      console.error("Receipt download error:", err);
      setIsDownloading(false);
      alert(
        isFrench
          ? "Impossible de générer l'image du reçu. Veuillez réessayer."
          : "Could not generate receipt image. Please try again."
      );
    }
  };

  const whatsAppUrl = landlordPhone
    ? buildPaymentConfirmationWhatsAppUrl({
        recipientPhone: landlordPhone,
        recipientName: landlordName || (isFrench ? "Bailleur" : "Landlord"),
        senderRole: "tenant",
        tenantName: payment.tenant_name,
        unitNumber: payment.unit_number,
        buildingName: payment.building_name,
        amountPaid: payment.amount_paid,
        rentMonth: payment.rent_month,
        receiptNumber: payment.receipt_number,
        balanceRemaining: payment.balance_remaining,
        paymentMethod: payment.payment_method,
        language: language,
      }).url
    : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
        {/* Modal Card */}
        <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] select-text">
          {/* Modal Top Bar */}
          <div className="sticky top-0 z-10 shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {isFrench ? "Quittance de Paiement Officielle" : "Official Payment Receipt"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadReceipt}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
              title={isFrench ? "Télécharger la quittance" : "Download official receipt image"}
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isFrench ? "Génération..." : "Generating..."}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{isFrench ? "Télécharger le reçu" : "Download Receipt"}</span>
                </>
              )}
            </button>

            {whatsAppUrl && (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30 transition cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-emerald-500/30 text-emerald-600 dark:text-emerald-400" />
                <span>{isFrench ? "Notifier le bailleur" : "Notify Landlord"}</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              title={isFrench ? "Fermer" : "Close Modal"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div
          ref={receiptRef}
          className="p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto flex-1 min-h-0 overscroll-contain"
        >
          {/* Receipt Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  LL
                </div>
                <div>
                  <h1 className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
                    Lease<span className="text-blue-600 dark:text-blue-500">Link</span>
                  </h1>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    {isFrench
                      ? "Gestion Immobilière & Quittances Numériques"
                      : "Property Management & Digital Receipts"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 pt-2 font-medium">
                {isFrench ? "Résidence :" : "Residence:"}{" "}
                <strong className="text-slate-900 dark:text-white">{effectiveResidenceName}</strong>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isFrench ? "Bailleur / Gestionnaire :" : "Landlord / Manager:"}{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {effectiveLandlordName}
                </strong>
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                {payment.receipt_number}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center sm:justify-end gap-1">
                <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isFullPayment
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isFullPayment
                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider block">
                  {isFrench
                    ? isFullPayment
                      ? "Loyer Intégralement Payé"
                      : "Paiement Partiel du Loyer"
                    : isFullPayment
                    ? "Rent Fully Paid"
                    : "Partial Rent Payment"}
                </span>
                <span className="text-xs opacity-90 block">
                  {isFrench ? "Période :" : "Period:"}{" "}
                  <strong>{payment.rent_month}</strong>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase block opacity-80 font-medium">
                {isFrench ? "Montant Payé" : "Amount Paid"}
              </span>
              <span className="text-lg sm:text-xl font-black font-mono">
                {formattedPaid} XAF
              </span>
            </div>
          </div>

          {/* Tenant & Apartment Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                {isFrench ? "Locataire (Payeur)" : "Tenant (Payer)"}
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {payment.tenant_name}
              </p>
              <p className="text-slate-600 dark:text-slate-400 font-mono">{payment.tenant_phone}</p>
              {payment.tenant_email && (
                <p className="text-slate-600 dark:text-slate-400">{payment.tenant_email}</p>
              )}
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                {isFrench ? "Logement Attribué" : "Unit Allocated"}
              </span>
              <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                {isFrench ? `Logement ${payment.unit_number}` : `Unit ${payment.unit_number}`}
              </p>
              <p className="text-slate-600 dark:text-slate-400">{effectiveResidenceName}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                {isFrench ? "Loyer mensuel :" : "Monthly Rate:"} {formattedRent} XAF
              </p>
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isFrench ? "Détail du Paiement" : "Payment Breakdown"}
            </span>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <div className="flex justify-between p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <span className="text-slate-600 dark:text-slate-400">
                  {isFrench
                    ? `Loyer convenu pour ${payment.rent_month}`
                    : `Agreed Rent for ${payment.rent_month}`}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">
                  {formattedRent} XAF
                </span>
              </div>

              <div className="flex justify-between p-3 bg-white dark:bg-slate-950/60">
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {isFrench ? "Montant Reçu & Confirmé" : "Amount Received & Confirmed"}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  + {formattedPaid} XAF
                </span>
              </div>

              <div className="flex justify-between p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <span className="text-slate-600 dark:text-slate-400">
                  {isFrench
                    ? "Solde Restant (Arriérés / Dû)"
                    : "Remaining Balance (Arrears / Owing)"}
                </span>
                <span
                  className={`font-bold font-mono ${
                    payment.balance_remaining > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {payment.balance_remaining > 0
                    ? `${formattedBalance} XAF`
                    : isFrench
                    ? "0 XAF (Intégralement Soldé)"
                    : "0 XAF (Fully Settled)"}
                </span>
              </div>

              <div className="flex justify-between p-3 bg-white dark:bg-slate-950/60">
                <span className="text-slate-600 dark:text-slate-400">
                  {isFrench ? "Mode de Paiement" : "Payment Method"}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {methodMeta.label}
                </span>
              </div>

              <div className="flex justify-between p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <span className="text-slate-600 dark:text-slate-400">
                  {isFrench ? "Référence de Transaction" : "Transaction Reference"}
                </span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                  {payment.transaction_ref}
                </span>
              </div>
            </div>
          </div>

          {/* UNIQUE PHYSICAL STAMP DISPLAY (Based on Landlord & Residence Name) */}
          <div className="pt-2 pb-1 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80">
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isFrench ? "Quittance Officielle Certifiée" : "Certified Official Receipt"}</span>
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                {isFrench ? (
                  <>
                    Cette quittance porte le sceau authentique officiel de{" "}
                    <strong className="text-slate-900 dark:text-white">{effectiveLandlordName}</strong>{" "}
                    pour{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {effectiveResidenceName}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    This receipt carries the authentic official seal of{" "}
                    <strong className="text-slate-900 dark:text-white">{effectiveLandlordName}</strong>{" "}
                    for{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {effectiveResidenceName}
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>

            {/* Official Ink Rubber Stamp Component */}
            <div className="relative select-none transform -rotate-6 hover:rotate-0 transition duration-300 shrink-0">
              <div className="w-44 h-44 rounded-full border-4 border-dashed border-rose-600/80 p-1 flex items-center justify-center bg-rose-50 dark:bg-rose-500/5 shadow-lg shadow-rose-900/10 dark:shadow-rose-950/40">
                <div className="w-full h-full rounded-full border-2 border-rose-600 flex flex-col items-center justify-center text-center p-2 text-rose-500 font-serif relative">
                  <span className="text-[8px] font-black tracking-widest uppercase border-b border-rose-600/40 pb-0.5 w-full block">
                    {isFrench ? "★ SCEAU OFFICIEL ★" : "★ OFFICIAL SEAL ★"}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-tight text-rose-500 mt-1 line-clamp-1 max-w-[130px]">
                    {effectiveLandlordName}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-tight text-rose-400 line-clamp-1 max-w-[130px]">
                    {effectiveResidenceName}
                  </span>
                  <div className="my-0.5 px-2 py-0.5 rounded bg-rose-600/10 border border-rose-600/50 text-[9px] font-mono font-black tracking-wider text-rose-600">
                    {isFrench ? "✓ PAYÉ & VALIDÉ" : "✓ PAID & VALIDATED"}
                  </div>
                  <span className="text-[8px] font-mono font-bold text-rose-500">
                    {stampMeta.stampCode}
                  </span>
                  <span className="text-[7px] tracking-wider uppercase opacity-80 border-t border-rose-600/40 pt-0.5 w-full block mt-0.5">
                    {isFrench ? "PROPRIÉTÉ VÉRIFIÉE" : "LEASELINK VERIFIED"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="sticky bottom-0 z-10 shrink-0 p-4 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleCopyReceipt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">{isFrench ? "Copié !" : "Copied!"}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{isFrench ? "Copier le résumé" : "Copy Summary"}</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadReceipt}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {isFrench ? "Génération de la quittance..." : "Generating Stamped Receipt..."}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isFrench ? "Télécharger la Quittance avec Sceau" : "Download Stamped Receipt"}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent transition cursor-pointer"
            >
              {isFrench ? "Fermer" : "Close"}
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
