"use client";

import { createClient } from "@/lib/supabase/client";
import { uploadReceiptToStorage } from "./storageService";

export interface SubscriptionReceiptData {
  receipt_number: string;
  landlord_name: string;
  landlord_phone?: string;
  landlord_email?: string;
  payer_phone?: string;
  plan_id: string;
  plan_name: string;
  plan_unit_limit?: number;
  billing_cycle: string;
  amount_paid: number;
  payment_method?: string;
  transaction_ref?: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
  notes?: string;
}

/**
 * Creates a high-resolution canvas element rendering the official LeaseLink Subscription Receipt.
 */
export function renderSubscriptionReceiptCanvas(
  data: SubscriptionReceiptData,
  isFrench: boolean
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1620;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const formattedDate = new Date(data.created_at || Date.now()).toLocaleDateString(
    isFrench ? "fr-FR" : "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  const startDate = new Date(data.starts_at || Date.now()).toLocaleDateString(
    isFrench ? "fr-FR" : "en-US"
  );
  const endDate = new Date(data.expires_at || Date.now()).toLocaleDateString(
    isFrench ? "fr-FR" : "en-US"
  );

  const formattedAmount = data.amount_paid.toLocaleString();
  const maxUnits = data.plan_unit_limit || (data.plan_id === "starter" ? 30 : data.plan_id === "pro" ? 100 : 5);
  const cycleLabel =
    data.billing_cycle === "annual"
      ? isFrench
        ? "Annuel (365 Jours)"
        : "Annual (365 Days)"
      : isFrench
      ? "Mensuel (30 Jours)"
      : "Monthly (30 Days)";

  // 1. Background Paper
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1200, 1620);

  // Outer Border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 1160, 1580);

  // Inner Border
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, 1144, 1564);

  // 2. Top Header Bar (Navy #0f172a with subtle brand accent)
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(20, 20, 1160, 145);

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
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(
    isFrench
      ? "QUITTANCE OFFICIELLE D'ABONNEMENT BAILLEUR"
      : "OFFICIAL LANDLORD SUBSCRIPTION RECEIPT",
    150,
    110
  );

  // Receipt Number & Date (Top Right)
  ctx.textAlign = "right";
  ctx.fillStyle = "#10b981";
  ctx.font = "bold 22px monospace";
  ctx.fillText(data.receipt_number, 1130, 75);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px sans-serif";
  ctx.fillText(formattedDate, 1130, 105);
  ctx.textAlign = "left";

  // 3. Status Banner
  ctx.fillStyle = "#ecfdf5";
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 195, 1100, 115, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#065f46";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(
    isFrench
      ? "✓ ABONNEMENT ACTIVÉ & ENREGISTRÉ (PAYÉ)"
      : "✓ SUBSCRIPTION ACTIVATED & RECORDED (PAID)",
    80,
    245
  );

  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#047857";
  ctx.fillText(
    isFrench
      ? `Formule ${data.plan_name} • ${cycleLabel} • Capacité : ${maxUnits} Logements`
      : `${data.plan_name} Plan • ${cycleLabel} • Capacity: ${maxUnits} Units`,
    80,
    280
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#047857";
  ctx.font = "bold 34px monospace";
  ctx.fillText(`${formattedAmount} XAF`, 1120, 260);
  ctx.textAlign = "left";

  // 4. Details Box (Subscriber vs Subscription Specs)
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(50, 340, 1100, 225, 16);
  ctx.fill();
  ctx.stroke();

  // Vertical Divider Line
  ctx.beginPath();
  ctx.moveTo(600, 355);
  ctx.lineTo(600, 550);
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  // Left Column: Subscriber / Landlord
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(
    isFrench ? "BAILLEUR / SOUSCRIPTEUR" : "SUBSCRIBER / LANDLORD",
    80,
    375
  );

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(data.landlord_name || "Bailleur LeaseLink", 80, 410);

  ctx.fillStyle = "#334155";
  ctx.font = "17px sans-serif";
  const contactPhone = data.payer_phone || data.landlord_phone;
  if (contactPhone) {
    ctx.fillText(
      isFrench ? `Téléphone : ${contactPhone}` : `Phone: ${contactPhone}`,
      80,
      445
    );
  }

  if (data.landlord_email) {
    ctx.fillText(`Email : ${data.landlord_email}`, 80, 478);
  }

  ctx.fillStyle = "#059669";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(
    isFrench ? "Compte bailleur vérifié & actif" : "Verified & Active Landlord Account",
    80,
    512
  );

  // Right Column: Plan & Validity Specs
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(
    isFrench ? "FORMULE & QUOTA AUTORISÉ" : "SUBSCRIPTION TIER & ALLOWANCE",
    630,
    375
  );

  ctx.fillStyle = "#2563eb";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(
    isFrench ? `Formule ${data.plan_name.toUpperCase()}` : `${data.plan_name.toUpperCase()} TIER`,
    630,
    410
  );

  ctx.fillStyle = "#334155";
  ctx.font = "17px sans-serif";
  ctx.fillText(
    isFrench ? `Capacité autorisée : ${maxUnits} logements` : `Capacity Allowance: ${maxUnits} units`,
    630,
    445
  );
  ctx.fillText(
    isFrench ? `Cycle : ${cycleLabel}` : `Cycle: ${cycleLabel}`,
    630,
    478
  );

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(
    isFrench ? `Période valide : ${startDate} au ${endDate}` : `Valid: ${startDate} to ${endDate}`,
    630,
    512
  );

  // 5. Payment Breakdown Table
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(
    isFrench ? "DÉTAIL DU RÈGLEMENT" : "PAYMENT BREAKDOWN",
    50,
    605
  );

  const tableY = 625;
  const rowHeight = 60;
  const rows: [string, string, string, boolean][] = [
    [
      isFrench ? "Formule d'abonnement LeaseLink" : "LeaseLink Subscription Plan",
      `${formattedAmount} XAF`,
      "#0f172a",
      false,
    ],
    [
      isFrench ? "Capacité de gestion locative incluse" : "Included Management Capacity",
      `${maxUnits} ${isFrench ? "Logements" : "Units"}`,
      "#2563eb",
      true,
    ],
    [
      isFrench ? "Mode de paiement" : "Payment Method",
      data.payment_method?.toUpperCase() === "ORANGE"
        ? "Orange Money"
        : "MTN Mobile Money",
      "#1e293b",
      false,
    ],
    [
      isFrench ? "Référence de transaction" : "Transaction Reference",
      data.transaction_ref || data.receipt_number,
      "#475569",
      false,
    ],
    [
      isFrench ? "Statut du règlement" : "Payment Status",
      isFrench ? "RÉGLÉ INTÉGRALEMENT (SOLDE : 0 XAF)" : "FULLY SETTLED (BALANCE: 0 XAF)",
      "#059669",
      true,
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

  // Total Summary Bar (Navy dark bar)
  const totalY = tableY + rows.length * rowHeight + 15;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(50, totalY, 1100, 75, 14);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(isFrench ? "TOTAL PAYÉ EN LIGNE" : "TOTAL PAID ONLINE", 80, totalY + 45);

  ctx.textAlign = "right";
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 32px monospace";
  ctx.fillText(`${formattedAmount} XAF`, 1120, totalY + 48);
  ctx.textAlign = "left";

  // 6. OFFICIAL DIGITAL STAMP (Bottom Right)
  const stampX = 900;
  const stampY = 1240;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.08); // Slight realistic tilt

  const stampColor = "#059669";
  ctx.strokeStyle = stampColor;
  ctx.fillStyle = stampColor;

  // Outer Dashed Circle
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 155, 0, Math.PI * 2);
  ctx.stroke();

  // Inner Solid Circle
  ctx.setLineDash([]);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 142, 0, Math.PI * 2);
  ctx.stroke();

  // Stamp header
  ctx.textAlign = "center";
  ctx.font = "bold 13px serif";
  ctx.fillText(
    isFrench ? "★ SCEAU OFFICIEL LEASELINK ★" : "★ LEASELINK OFFICIAL SEAL ★",
    0,
    -108
  );

  // Platform brand text
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("LEASELINK CLOUD", 0, -65);

  // Boxed status
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(-110, -35, 220, 42);
  ctx.font = "bold 18px monospace";
  ctx.fillText(isFrench ? "✓ PAIEMENT CERTIFIÉ" : "✓ VERIFIED PAYMENT", 0, -8);

  ctx.font = "bold 14px monospace";
  ctx.fillText(data.receipt_number.slice(0, 18), 0, 35);

  ctx.font = "12px sans-serif";
  ctx.fillText(
    isFrench ? "ABONNEMENT BAILLEUR ACTIF" : "ACTIVE LANDLORD LICENSE",
    0,
    70
  );
  ctx.fillText(formattedDate, 0, 95);
  ctx.fillText("★ ★ ★", 0, 120);

  ctx.restore();

  // 7. Security Verification Box (Bottom Left)
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(50, 1080, 680, 230, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(
    isFrench ? "AUTHENTICITÉ & CONTRÔLE NUMÉRIQUE" : "DIGITAL AUTHENTICITY & CONTROL",
    75,
    1115
  );

  ctx.fillStyle = "#64748b";
  ctx.font = "14px sans-serif";
  ctx.fillText(
    isFrench
      ? "Cette quittance numérique constitue une preuve légale et comptable incontestable."
      : "This digital receipt serves as indisputable legal and accounting proof of payment.",
    75,
    1148
  );
  ctx.fillText(
    isFrench
      ? "Validée par l'infrastructure financière LeaseLink et hébergée sur le registre sécurisé."
      : "Validated by LeaseLink financial rails and hosted on the secure property ledger.",
    75,
    1175
  );

  // Verification URL & Barcode Simulation
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 13px monospace";
  ctx.fillText(`URL : https://leaselink.cm/verify/${data.receipt_number}`, 75, 1220);

  // Barcode lines
  ctx.fillStyle = "#334155";
  for (let i = 0; i < 48; i++) {
    const bw = (i % 3 === 0 ? 4 : i % 2 === 0 ? 2 : 1);
    ctx.fillRect(75 + i * 13, 1240, bw, 40);
  }

  // 8. Security Footnote (Bottom)
  ctx.fillStyle = "#64748b";
  ctx.font = "13px sans-serif";
  ctx.fillText(
    isFrench
      ? "Document généré automatiquement par LeaseLink. Pour toute réclamation, contactez support@leaselink.cm."
      : "Document automatically generated by LeaseLink. For inquiries, contact support@leaselink.cm.",
    50,
    1550
  );
  ctx.fillText(
    `Quittance N° : ${data.receipt_number} • Horodatage certifié : ${new Date().toISOString()}`,
    50,
    1575
  );

  return canvas;
}

/**
 * Downloads the subscription receipt directly as a high-resolution PNG image (no print dialog).
 */
export async function downloadSubscriptionReceiptPng(
  data: SubscriptionReceiptData,
  isFrench: boolean = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = renderSubscriptionReceiptCanvas(data, isFrench);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to generate receipt image blob"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Quittance-Abonnement-${data.receipt_number}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Downloads the subscription receipt directly as a standalone standard PDF file (no print dialog).
 */
export async function downloadSubscriptionReceiptPdf(
  data: SubscriptionReceiptData,
  isFrench: boolean = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = renderSubscriptionReceiptCanvas(data, isFrench);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const base64Data = jpegDataUrl.split(",")[1];
      const binaryString = atob(base64Data);
      const jpegBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        jpegBytes[i] = binaryString.charCodeAt(i);
      }

      const pdfWidth = 595.28;
      const pdfHeight = 841.89; // Standard A4 points

      // Construct a valid standalone PDF 1.4 document
      const header = `%PDF-1.4\n`;
      const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
      const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
      const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
      const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
      const obj4Trailer = `\nendstream\nendobj\n`;
      const contentStream = `q ${pdfWidth} 0 0 ${pdfHeight} 0 0 cm /Im1 Do Q`;
      const obj5 = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`;

      const enc = new TextEncoder();
      const part1 = enc.encode(header + obj1 + obj2 + obj3 + obj4Header);
      const part2 = jpegBytes;
      const part3 = enc.encode(obj4Trailer + obj5);

      const offset1 = header.length;
      const offset2 = offset1 + obj1.length;
      const offset3 = offset2 + obj2.length;
      const offset4 = offset3 + obj3.length;
      const offset5 = offset4 + obj4Header.length + jpegBytes.length + obj4Trailer.length;
      const startXref = offset5 + obj5.length;

      const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, "0")} 00000 n \n${String(offset2).padStart(10, "0")} 00000 n \n${String(offset3).padStart(10, "0")} 00000 n \n${String(offset4).padStart(10, "0")} 00000 n \n${String(offset5).padStart(10, "0")} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
      const part4 = enc.encode(xref);

      const blob = new Blob([part1, part2, part3, part4], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Quittance-Abonnement-${data.receipt_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Renders and archives an official Subscription Receipt in the private receipts bucket.
 * Also updates the database record with the resulting receipt_url.
 */
export async function archiveSubscriptionReceiptToStorage(
  data: SubscriptionReceiptData,
  landlordId: string,
  isFrench: boolean = false
): Promise<{ url: string | null; path: string | null; error: string | null }> {
  try {
    const canvas = renderSubscriptionReceiptCanvas(data, isFrench);
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve({ url: null, path: null, error: "Canvas blob creation failed" });
          return;
        }
        const uploadRes = await uploadReceiptToStorage(
          blob,
          "subscriptions",
          landlordId,
          data.receipt_number,
          "png"
        );
        if (uploadRes.url) {
          try {
            const supabase = createClient();
            await supabase
              .from("subscriptions")
              .update({ receipt_url: uploadRes.path || uploadRes.url })
              .eq("receipt_number", data.receipt_number);
          } catch (_) {}
        }
        resolve(uploadRes);
      }, "image/png");
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Archive subscription receipt error";
    return { url: null, path: null, error: msg };
  }
}

