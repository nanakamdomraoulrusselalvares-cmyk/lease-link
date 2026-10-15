"use client";

import React, { useState, useMemo } from "react";
import {
  Bell,
  X,
  Send,
  AlertTriangle,
  Users,
  CheckCircle2,
  Building2,
  DoorOpen,
  DollarSign,
  Sparkles,
  MessageCircle,
  RefreshCw,
  Info,
  Check,
} from "lucide-react";
import { TenantRentStatus } from "@/types/database";
import {
  broadcastRentReminderToUnpaidTenants,
  UnpaidTenantTarget,
} from "@/lib/services/notificationService";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BroadcastReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  landlordId: string;
  landlordName?: string;
  unpaidTenants: TenantRentStatus[];
  currentMonth: string;
  onBroadcastSuccess?: (sentCount: number) => void;
}

export default function BroadcastReminderModal({
  isOpen,
  onClose,
  landlordId,
  landlordName = "Bailleur",
  unpaidTenants,
  currentMonth,
  onBroadcastSuccess,
}: BroadcastReminderModalProps) {
  const { isFrench, formatCurrency } = useLanguage();

  // Filter only tenants with balance owing
  const owingTenants = useMemo(() => {
    return unpaidTenants.filter((t) => (t.balance_owing_current_month || 0) > 0);
  }, [unpaidTenants]);

  // Selected unit IDs (default to all owing tenants)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(() =>
    owingTenants.map((t) => t.unit_id)
  );

  // Template message
  const defaultTemplateFr =
    "Bonjour {tenant}, rappel amical de votre bailleur : votre loyer pour le logement {unit} ({building}) présente un solde impayé de {amount} FCFA pour le mois de {month}. Merci de régulariser rapidement par Mobile Money ou auprès du gestionnaire.";

  const defaultTemplateEn =
    "Hello {tenant}, friendly reminder from your landlord: your rent for unit {unit} ({building}) has an unpaid balance of {amount} FCFA for {month}. Please settle promptly via Mobile Money or with property management.";

  const [messageTemplate, setMessageTemplate] = useState<string>(
    isFrench ? defaultTemplateFr : defaultTemplateEn
  );

  const [customTitle, setCustomTitle] = useState<string>(
    isFrench
      ? "📢 Rappel de loyer : Solde en attente"
      : "📢 Rent Reminder: Pending Balance"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    sentCount: number;
  } | null>(null);

  if (!isOpen) return null;

  // Toggle unit selection
  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId]
    );
  };

  const selectAll = () => {
    setSelectedUnitIds(owingTenants.map((t) => t.unit_id));
  };

  const deselectAll = () => {
    setSelectedUnitIds([]);
  };

  // Selected tenants list
  const targetedTenants = owingTenants.filter((t) =>
    selectedUnitIds.includes(t.unit_id)
  );

  const totalTargetedOwing = targetedTenants.reduce(
    (sum, t) => sum + (t.balance_owing_current_month || 0),
    0
  );

  // Live preview tenant (first selected, or first owing)
  const previewTenant = targetedTenants[0] || owingTenants[0];

  const previewMessage = previewTenant
    ? messageTemplate
        .replace(/\{tenant\}/gi, previewTenant.tenant_name || "Locataire")
        .replace(/\{unit\}/gi, previewTenant.unit_number || "A1")
        .replace(/\{building\}/gi, previewTenant.building_name || "Immeuble")
        .replace(
          /\{amount\}/gi,
          (previewTenant.balance_owing_current_month || 0).toLocaleString()
        )
        .replace(/\{month\}/gi, currentMonth)
    : "";

  const insertVariable = (varName: string) => {
    setMessageTemplate((prev) => `${prev} {${varName}}`);
  };

  // Handle broadcast send
  const handleSendBroadcast = async () => {
    if (targetedTenants.length === 0) return;

    setIsSubmitting(true);
    try {
      const targets: UnpaidTenantTarget[] = targetedTenants.map((t) => ({
        unitId: t.unit_id,
        unitNumber: t.unit_number,
        buildingId: t.building_id,
        buildingName: t.building_name,
        tenantName: t.tenant_name,
        tenantPhone: t.tenant_phone,
        balanceOwing: t.balance_owing_current_month,
        currentMonth: currentMonth,
      }));

      const res = await broadcastRentReminderToUnpaidTenants({
        landlordId,
        landlordName,
        customMessage: messageTemplate,
        customTitle,
        tenants: targets,
      });

      if (res.success) {
        setSuccessResult({ sentCount: res.sentCount });
        if (onBroadcastSuccess) {
          onBroadcastSuccess(res.sentCount);
        }
      }
    } catch (err) {
      console.error("Error sending broadcast reminder:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 mb-2.5">
            <Bell className="w-3.5 h-3.5" />
            <span>
              {isFrench
                ? "Diffusion Directe de Rappel"
                : "Instant Broadcast Reminder"}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isFrench
              ? "Diffuser un Rappel aux Locataires Débiteurs"
              : "Broadcast Rent Reminder to Unpaid Tenants"}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isFrench
              ? "Envoyez une alerte instantanée à tous les locataires ayant des arriérés. La notification apparaîtra en temps réel sous forme de bannière flottante de style WhatsApp sur leur écran."
              : "Send an instant payment reminder to all tenants owing rent. It will trigger a real-time WhatsApp-style floating heads-up banner on their screens."}
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {successResult ? (
            /* Celebratory Success View */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  {isFrench
                    ? "Rappel Diffusé avec Succès !"
                    : "Broadcast Dispatched Successfully!"}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  {isFrench
                    ? `${successResult.sentCount} locataire(s) ont reçu la notification push en direct sur leur application.`
                    : `${successResult.sentCount} tenant(s) have received the real-time push notification banner on their app.`}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-semibold max-w-sm mx-auto">
                {isFrench
                  ? "✓ Notification enregistrée dans leur centre d'alertes avec l'option « Voir plus » et lien de règlement direct."
                  : "✓ Notification stored in their notification center with 'View more' and direct payment link."}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                {isFrench ? "Terminer & Fermer" : "Done & Close"}
              </button>
            </div>
          ) : (
            <>
              {/* Target summary bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                      {isFrench
                        ? `${targetedTenants.length} sur ${owingTenants.length} locataires sélectionnés`
                        : `${targetedTenants.length} of ${owingTenants.length} tenants targeted`}
                    </span>
                    <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                      {isFrench ? "Total arriérés :" : "Total Owing:"}{" "}
                      {formatCurrency(totalTargetedOwing)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 transition"
                  >
                    {isFrench ? "Tout cocher" : "Select all"}
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 transition"
                  >
                    {isFrench ? "Tout décocher" : "Deselect all"}
                  </button>
                </div>
              </div>

              {/* Tenants list selector */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {isFrench
                    ? "Locataires débiteurs concernés :"
                    : "Owing Tenants to Notify:"}
                </span>

                <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50">
                  {owingTenants.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {isFrench
                        ? "Aucun locataire avec solde impayé ce mois-ci."
                        : "No tenants currently owing rent for this month."}
                    </div>
                  ) : (
                    owingTenants.map((tenant) => {
                      const isChecked = selectedUnitIds.includes(tenant.unit_id);
                      return (
                        <label
                          key={tenant.unit_id}
                          className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleUnit(tenant.unit_id)}
                              className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                                {tenant.tenant_name}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{tenant.building_name}</span>
                                <span>•</span>
                                <span>
                                  {isFrench ? "Logement" : "Unit"}{" "}
                                  {tenant.unit_number}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono block">
                              {formatCurrency(tenant.balance_owing_current_month || 0)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {currentMonth}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Message customization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isFrench ? "Titre de l'alerte :" : "Notice Title:"}
                  </label>
                </div>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isFrench
                      ? "Modèle de message personnalisé :"
                      : "Custom Message Template:"}
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isFrench
                      ? "Variables dynamiques disponibles :"
                      : "Available dynamic variables:"}
                  </span>
                </div>

                {/* Variable insertion chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => insertVariable("tenant")}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer"
                  >
                    + {"{tenant}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("unit")}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer"
                  >
                    + {"{unit}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("building")}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer"
                  >
                    + {"{building}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("amount")}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                  >
                    + {"{amount}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("month")}
                    className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold hover:bg-amber-100 transition cursor-pointer"
                  >
                    + {"{month}"}
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:border-amber-500 resize-none font-medium"
                />
              </div>

              {/* Live Preview of the WhatsApp Heads-Up Notification */}
              {previewTenant && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {isFrench
                          ? "Aperçu en direct (Ce que verra le locataire) :"
                          : "Live Preview (What tenant will see):"}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {isFrench
                        ? `Exemple pour : ${previewTenant.tenant_name}`
                        : `Preview for: ${previewTenant.tenant_name}`}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-slate-950 text-white p-4 border border-emerald-500/40 shadow-xl space-y-2 ring-1 ring-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <MessageCircle className="w-3.5 h-3.5 fill-white text-emerald-500" />
                        </div>
                        <span className="text-xs font-bold text-white">
                          {landlordName} (Bailleur)
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          • {isFrench ? "à l'instant" : "now"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">WhatsApp Push</span>
                    </div>

                    <h5 className="text-xs font-bold text-emerald-300">
                      {customTitle}
                    </h5>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {previewMessage}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                      <span className="text-emerald-400 font-bold font-mono">
                        {isFrench ? "Solde dû :" : "Due:"}{" "}
                        {formatCurrency(previewTenant.balance_owing_current_month || 0)}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
                        {isFrench ? "Voir plus →" : "View more →"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successResult && (
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {targetedTenants.length === 0
                ? isFrench
                  ? "Aucun locataire sélectionné."
                  : "No tenants selected."
                : isFrench
                ? `Prêt à notifier ${targetedTenants.length} locataire(s).`
                : `Ready to notify ${targetedTenants.length} tenant(s).`}
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={isSubmitting || targetedTenants.length === 0}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                  targetedTenants.length > 0 && !isSubmitting
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/25 active:scale-95"
                    : "bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isFrench ? "Diffusion en cours..." : "Dispatching..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {isFrench
                        ? `Diffuser à tous (${targetedTenants.length})`
                        : `Broadcast to All (${targetedTenants.length})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
