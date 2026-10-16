"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  FileText,
  Building2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Mic,
  Database,
  Users,
  Eye,
  Mail,
  Phone,
  Printer,
  ChevronRight,
  Scale,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function TermsAndPrivacyPage() {
  const { isFrench } = useLanguage();
  const [activeTab, setActiveTab] = useState<"cgu" | "privacy">("cgu");
  const [searchQuery, setSearchQuery] = useState("");

  const lastUpdated = isFrench ? "16 Octobre 2026" : "October 16, 2026";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isFrench ? "Retour à l'accueil" : "Back to Home"}</span>
            </Link>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-base tracking-tight hidden md:inline-block">
                Lease<span className="text-blue-600 dark:text-blue-500">Link</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={isFrench ? "Imprimer ou exporter en PDF" : "Print or save as PDF"}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isFrench ? "Imprimer / PDF" : "Print / PDF"}</span>
            </button>

            <LanguageSwitcher variant="pill" />
            <ThemeSwitcher variant="pill" />

            <Link
              href="/register"
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-xl shadow-xs transition"
            >
              {isFrench ? "S'inscrire" : "Sign Up"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-blue-900/10 via-transparent to-transparent border-b border-slate-200 dark:border-slate-800/60 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
            <Scale className="w-3.5 h-3.5" />
            <span>{isFrench ? "Cadre Juridique & Protection des Données" : "Legal Framework & Data Protection"}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            {isFrench
              ? "Conditions Générales & Politique de Confidentialité"
              : "Terms of Service & Privacy Policy"}
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            {isFrench
              ? "Transparence absolue, respect strict de la confidentialité et sécurité cryptographique de vos données de gestion immobilière."
              : "Absolute transparency, strict confidentiality protection, and cryptographic security for your real estate operations."}
          </p>

          <div className="pt-2 flex items-center justify-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{isFrench ? `Dernière mise à jour : ${lastUpdated}` : `Last Updated: ${lastUpdated}`}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              {isFrench ? "Conforme RGPD & Actes Uniformes OHADA" : "GDPR & OHADA Compliant"}
            </span>
          </div>

          {/* Interactive Document Switcher */}
          <div className="pt-6 flex justify-center">
            <div className="inline-flex p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-md w-full">
              <button
                type="button"
                onClick={() => setActiveTab("cgu")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "cgu"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{isFrench ? "Conditions Générales (CGU)" : "Terms of Service"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("privacy")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "privacy"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{isFrench ? "Confidentialité & Vie Privée" : "Privacy Policy"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex-1 w-full">
        {activeTab === "cgu" ? (
          /* ========================================================================= */
          /* SECTION 1: CONDITIONS GÉNÉRALES D'UTILISATION (TERMS OF SERVICE)         */
          /* ========================================================================= */
          <article className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 lg:p-12 border border-slate-200 dark:border-slate-800 shadow-sm space-y-10 leading-relaxed text-slate-700 dark:text-slate-300 text-sm sm:text-base">
            
            {/* Preamble */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-8 space-y-4">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <FileText className="w-6 h-6" />
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isFrench ? "Préambule & Présentation de la Plateforme" : "Preamble & Platform Overview"}
                </h2>
              </div>
              <p>
                {isFrench
                  ? "Bienvenue sur LeaseLink, la solution logicielle en mode SaaS (Software-as-a-Service) et Progressive Web App (PWA) dédiée à la gestion locative moderne, à la digitalisation des registres immobiliers, au suivi des loyers et à la simplification des interactions entre Bailleurs, Gestionnaires Délégués et Locataires."
                  : "Welcome to LeaseLink, the cloud-based Software-as-a-Service (SaaS) and Progressive Web App (PWA) property management platform engineered to transition property owners from paper ledgers to verified digital tracking, automated receipts, rent monitoring, and seamless communication between Landlords, Property Managers, and Tenants."}
              </p>
              <p>
                {isFrench
                  ? "Les présentes Conditions Générales d'Utilisation (ci-après désignées les « CGU ») constituent un contrat juridique ayant force obligatoire entre vous (qu'il s'agisse d'une personne physique ou d'une personne morale, agissant en qualité de Bailleur propriétaire, Gestionnaire de patrimoine ou Locataire) et LeaseLink Inc. (ci-après « LeaseLink », « Nous » ou « La Plateforme »)."
                  : "These Terms of Service (hereinafter the 'Terms') constitute a legally binding agreement between you (whether an individual or legal corporate entity acting as a Landlord, Property Manager, or Tenant) and LeaseLink Inc. (hereinafter 'LeaseLink', 'We', 'Our', or 'The Platform')."}
              </p>
            </div>

            {/* Article 1: Définitions */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">1.</span>
                <span>{isFrench ? "Définitions et Terminologie" : "Definitions & Terminology"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Pour l'interprétation des présentes CGU, les termes ci-après auront la signification suivante :"
                  : "For the purposes of these Terms, the following definitions shall strictly apply:"}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong className="text-slate-900 dark:text-white">« Bailleur » (Landlord) :</strong>{" "}
                  {isFrench
                    ? "Toute personne physique ou entité morale propriétaire d'un ou plusieurs immeubles ou logements, créant un compte administrateur sur LeaseLink pour piloter son patrimoine locatif."
                    : "Any individual or legal entity owning one or multiple residential or commercial rental buildings/units, registering an account on LeaseLink to manage their real estate portfolio."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">« Gestionnaire Délégué » (Property Manager) :</strong>{" "}
                  {isFrench
                    ? "Toute personne mandatée par un Bailleur pour superviser un ensemble d'immeubles, enregistrer les paiements de loyers, gérer les pannes et éditer les quittances."
                    : "Any designated agent empowered by a Landlord to supervise assigned buildings, record rent payments, handle repairs, and issue official receipts."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">« Locataire » (Tenant) :</strong>{" "}
                  {isFrench
                    ? "Tout occupant occupant un logement assigné, accédant à l'Espace Locataire pour payer son loyer, consulter ses quittances certifiées et signaler des pannes."
                    : "Any resident occupant assigned to a rental unit, accessing the Tenant Portal to submit payments, view tamper-proof certified receipts, and submit maintenance reports."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">« Quittance Numérique Certifiée » :</strong>{" "}
                  {isFrench
                    ? "Document officiel généré automatiquement par LeaseLink, doté d'un numéro d'enregistrement unique, d'un sceau cryptographique et d'un QR code infalsifiable."
                    : "An official digital receipt automatically produced by LeaseLink bearing a unique ledger serial, cryptographic security stamp, and verifiable QR code."}
                </li>
              </ul>
            </div>

            {/* Article 2: Inscription et Acceptation Obligatoire */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">2.</span>
                <span>{isFrench ? "Inscription, Compte & Consentement Obligatoire" : "Registration, Account & Mandatory Consent"}</span>
              </h3>
              <p>
                {isFrench
                  ? "La création de tout compte sur LeaseLink (qu'il s'agisse d'un compte Bailleur ou Gestionnaire) requiert la saisie d'informations exactes, vérifiables et à jour. Conformément à la réglementation sur la signature électronique, le fait de cocher la case d'acceptation des présentes CGU lors de la création du compte matérialise votre consentement plein, entier et irrévocable."
                  : "Registering an account on LeaseLink requires providing accurate, complete, and verifiable information. Checking the terms acceptance box during registration serves as an enforceable digital signature and confirms your irrevocable agreement to be bound by these Terms."}
              </p>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p>
                  {isFrench
                    ? "Règle stricte d'unicité de l'adresse e-mail : Une adresse e-mail ne peut être rattachée qu'à un seul et unique compte sur la plateforme LeaseLink. Toute tentative de double inscription ou de manipulation d'identité entraîne la suspension immédiate du compte concerné."
                    : "Strict Single-Use Email Enforceability: An email address may only be registered once across the entire LeaseLink ecosystem. Duplicate registrations or identity spoofing result in immediate account suspension."}
                </p>
              </div>
            </div>

            {/* Article 3: Abonnements, Formules & Facturation */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">3.</span>
                <span>{isFrench ? "Abonnements, Formules Tarifaires & Paiements" : "Subscription Tiers, Billing & Payment Terms"}</span>
              </h3>
              <p>
                {isFrench
                  ? "LeaseLink propose un modèle d'accès structuré en plusieurs formules tarifaires adaptées au volume de logements sous gestion :"
                  : "LeaseLink provides structured access tiers scaled to the unit capacity under management:"}
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-600 dark:text-slate-300">
                <li>
                  <strong className="text-slate-900 dark:text-white">Essai Gratuit 30 Jours (Free Trial) :</strong>{" "}
                  {isFrench ? "Jusqu'à 5 logements, sans aucune carte bancaire requise." : "Up to 5 units, zero credit card required."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Formule Starter (1 à 30 Logements) :</strong>{" "}
                  {isFrench ? "Idéale pour les petits propriétaires indépendants." : "Designed for independent private landlords."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Formule Pro (31 à 70 Logements) :</strong>{" "}
                  {isFrench ? "Pour patrimoines résidentiels en expansion." : "For growing multi-unit residential portfolios."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Formule Business (71 à 150 Logements) :</strong>{" "}
                  {isFrench ? "Gestion multi-immeubles et délégation gestionnaire." : "Multi-property management with manager delegation."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Formule Ultimate (151 à 300 Logements) :</strong>{" "}
                  {isFrench ? "Plafond standard de la plateforme pour syndics et grands parcs." : "Maximum self-serve platform capacity for large estates."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Grands Comptes & Enterprise (300+ Logements) :</strong>{" "}
                  {isFrench ? "Sur devis personnalisé avec intégrations sur-mesure et support WhatsApp dédié." : "Custom quote with dedicated onboarding and bespoke integrations."}
                </li>
              </ul>
              <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
                {isFrench
                  ? "Les paiements d'abonnements peuvent être effectués mensuellement (30 jours) ou annuellement (365 jours avec réduction). Les règlements s'effectuent exclusivement via Mobile Money (MTN MoMo et Orange Money) de manière sécurisée sans aucune conservation de codes secrets."
                  : "Subscriptions may be billed on a monthly (30-day) or discounted annual (365-day) cycle. Payments are conducted exclusively via Mobile Money (MTN MoMo and Orange Money) through secure digital protocols without storing user PINs."}
              </p>
            </div>

            {/* Article 4: Quittances de Loyer & Responsabilité Juridique */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">4.</span>
                <span>{isFrench ? "Quittances de Loyer & Valeur Probante" : "Certified Receipts & Legal Evidentiary Value"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Les quittances générées par LeaseLink ont valeur de reçu libératoire pour les montants effectivement perçus et confirmés par le Bailleur ou son Gestionnaire Délégué. Le Bailleur est seul responsable de l'exactitude des sommes déclarées perçues en espèces ou par virement bancaire externe. LeaseLink n'intervient pas comme partie au bail d'habitation ou commercial liant le Bailleur à son Locataire."
                  : "Receipts generated by LeaseLink act as legal proof of payment for amounts certified as received by the Landlord or their designated Manager. The Landlord remains solely liable for the factual accuracy of amounts recorded for cash or external bank settlements. LeaseLink is not a party to the underlying tenancy agreement."}
              </p>
            </div>

            {/* Article 5: Signalement des Pannes & Enregistrements Vocaux */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">5.</span>
                <span>{isFrench ? "Gestion des Pannes & Notes Vocales" : "Maintenance Requests & Voice Recordings"}</span>
              </h3>
              <p>
                {isFrench
                  ? "LeaseLink met à disposition des locataires un outil d'enregistrement audio permettant de décrire oralement les pannes et dysfonctionnements (plomberie, électricité, toiture). L'utilisation de cet enregistreur vocal constitue un consentement exprès à l'enregistrement et au stockage chiffré de la note vocale sur les serveurs sécurisés de LeaseLink à la seule fin de traitement de l'incident par le Bailleur et ses techniciens."
                  : "LeaseLink enables tenants to record and transmit voice notes detailing repair requests (e.g., plumbing leaks, electrical failures). Using the voice recorder constitutes explicit consent to the temporary encrypted storage of the audio file strictly for the resolution of the incident by the Landlord and designated contractors."}
              </p>
            </div>

            {/* Article 6: Résiliation & Suspension */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">6.</span>
                <span>{isFrench ? "Résiliation, Désactivation & Suspension" : "Termination, Cancellation & Account Suspension"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Chaque utilisateur peut à tout moment demander la clôture de son compte. En cas de non-renouvellement de l'abonnement à son échéance, le compte bascule en mode consultation restreinte. LeaseLink conserve les historiques comptables pendant la durée légale obligatoire avant suppression définitive."
                  : "Users may request account closure at any time. If a subscription is not renewed upon expiration, the account enters restricted read-only mode. LeaseLink preserves accounting history for statutory audit retention periods before permanent purging."}
              </p>
            </div>

            {/* Article 7: Droit Applicable */}
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">7.</span>
                <span>{isFrench ? "Droit Applicable & Règlement des Litiges" : "Governing Law & Dispute Resolution"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Les présentes CGU sont régies par le droit des affaires applicable (notamment les Actes Uniformes de l'OHADA relatifs au droit commercial général) ainsi que les standards internationaux de conformité numérique. En cas de différend relatif à l'interprétation ou à l'exécution des présentes, les parties s'engagent à rechercher préalablement une solution amiable par voie de conciliation écrite."
                  : "These Terms are governed by applicable commercial laws (including OHADA Uniform Acts) and international digital service regulations. In the event of any controversy arising under these Terms, the parties agree to first pursue amicable settlement through good-faith written conciliation."}
              </p>
            </div>

          </article>
        ) : (
          /* ========================================================================= */
          /* SECTION 2: POLITIQUE DE CONFIDENTIALITÉ (PRIVACY POLICY)                  */
          /* ========================================================================= */
          <article className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 lg:p-12 border border-slate-200 dark:border-slate-800 shadow-sm space-y-10 leading-relaxed text-slate-700 dark:text-slate-300 text-sm sm:text-base">
            
            {/* Privacy Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-8 space-y-4">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isFrench
                    ? "Politique de Confidentialité & Protection des Données Personnelles"
                    : "Privacy & Personal Data Protection Policy"}
                </h2>
              </div>
              <p>
                {isFrench
                  ? "La protection de votre vie privée, de vos secrets d'affaires et des données personnelles de vos locataires est au cœur de l'architecture technologique de LeaseLink. Cette Politique détaille de manière exhaustive quelles données sont collectées, pourquoi elles le sont, comment elles sont protégées et quels sont vos droits inaliénables."
                  : "Protecting your privacy, business trade secrets, and the personal identity of your tenants is paramount to LeaseLink's architectural engineering. This Privacy Policy details what data we collect, why we process it, how we safeguard it, and your statutory data rights."}
              </p>
            </div>

            {/* Section 1: Données Collectées */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">1.</span>
                <span>{isFrench ? "Catégories de Données Collectées" : "Categories of Data We Collect"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Dans le cadre de l'exploitation de la plateforme, LeaseLink traite les catégories de données suivantes :"
                  : "In operating the platform, LeaseLink processes the following data categories:"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>{isFrench ? "Données du Bailleur & Gestionnaire" : "Landlord & Manager Data"}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isFrench
                      ? "Nom complet, adresse e-mail unique vérifiée, numéro de téléphone WhatsApp, mot de passe chiffré (hash bcrypt), nom des immeubles et adresse des biens."
                      : "Full legal name, verified email, telephone/WhatsApp contact, cryptographically hashed passwords, building names, and property location addresses."}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <span>{isFrench ? "Données des Locataires & Baux" : "Tenant & Tenancy Data"}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isFrench
                      ? "Nom du locataire, numéro de téléphone, numéro du logement assigné, loyer mensuel convenu, date de début de bail, jour d'échéance du loyer et historique des paiements."
                      : "Tenant name, telephone number, assigned unit number, agreed monthly rent price, lease start date, recurring rent due day, and ledger payment history."}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                    <Smartphone className="w-4 h-4 text-purple-500" />
                    <span>{isFrench ? "Données Financières & Quittances" : "Financial & Receipt Records"}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isFrench
                      ? "Montants encaissés, mode de paiement (MTN MoMo, Orange Money, Espèces), date et heure de transaction, numéros de quittances générées et soldes d'impayés."
                      : "Collected amounts, payment tender method (MTN MoMo, Orange Money, Cash), transaction timestamp, receipt reference codes, and delinquency balances."}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                    <Mic className="w-4 h-4 text-rose-500" />
                    <span>{isFrench ? "Notes Vocales & Signalements Pannes" : "Voice Recordings & Incident Reports"}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isFrench
                      ? "Fichiers audio enregistrés par le locataire pour expliciter une panne, statuts de réparation, devis d'intervention et commentaires de clôture."
                      : "Voice recordings captured by tenants describing property defects, repair progress status, repair invoices, and technician sign-offs."}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Finalités */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">2.</span>
                <span>{isFrench ? "Finalités Légitimes du Traitement" : "Legitimate Purposes of Processing"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Vos données personnelles et celles de vos locataires ne sont traitées que pour des finalités strictes et légitimes :"
                  : "Your personal data and tenant records are processed solely for the following legitimate business purposes:"}
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-600 dark:text-slate-300">
                <li>{isFrench ? "Génération et délivrance des quittances de loyer numériques certifiées avec QR code." : "Generation and delivery of certified rent receipts with tamper-proof QR codes."}</li>
                <li>{isFrench ? "Envoi de rappels d'échéance de loyer et notifications d'impayés par WhatsApp et alertes intégrées." : "Transmission of rent due date reminders and overdue delinquency notices via WhatsApp and in-app alerts."}</li>
                <li>{isFrench ? "Annonce communautaire sécurisée des arrivées et départs de locataires au sein de chaque immeuble." : "Safe community notification of tenant arrivals and departures within each specific building."}</li>
                <li>{isFrench ? "Transmission des fiches de pannes et enregistrements vocaux aux prestataires de maintenance." : "Routing repair tickets and voice memos to property managers and maintenance technicians."}</li>
                <li>{isFrench ? "Prévention de la fraude, vérification de l'unicité de compte et sécurité de l'infrastructure." : "Fraud prevention, single-account email verification, and infrastructure security monitoring."}</li>
              </ul>
            </div>

            {/* Section 3: Non-Commercialisation Garantie */}
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>{isFrench ? "Engagement Solennel : Zéro Vente de Vos Données" : "Solemn Guarantee: Zero Data Commercialization"}</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">
                {isFrench
                  ? "LeaseLink s'interdit formellement et perpétuellement de vendre, louer, céder ou monétiser vos données personnelles, les coordonnées de vos locataires ou vos données financières à des régies publicitaires, des courtiers en données ou des tiers à des fins de prospection commerciale."
                  : "LeaseLink strictly and perpetually refuses to sell, rent, license, or monetize your personal information, tenant rosters, or financial ledger data to third-party advertisers, data brokers, or marketing networks."}
              </p>
            </div>

            {/* Section 4: Sécurité & Chiffrement */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">3.</span>
                <span>{isFrench ? "Sécurité Cryptographique & Isolation des Données" : "Cryptographic Security & Portfolio Isolation"}</span>
              </h3>
              <p>
                {isFrench
                  ? "La sécurité de vos données repose sur une architecture de pointe garantissant une étanchéité absolue entre les comptes bailleurs :"
                  : "Data protection is enforced through architectural security guarantees providing absolute isolation between landlord accounts:"}
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong className="text-slate-900 dark:text-white">{isFrench ? "Chiffrement en Transit :" : "In-Transit Encryption:"}</strong>{" "}
                  {isFrench
                    ? "Toutes les connexions sont obligatoirement chiffrées via TLS 1.3 avec clés de haute sécurité (HTTPS)."
                    : "All network traffic is encrypted via TLS 1.3 using modern high-entropy cipher suites (HTTPS)."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">{isFrench ? "Chiffrement au Repos :" : "At-Rest Encryption:"}</strong>{" "}
                  {isFrench
                    ? "Les bases de données et les fichiers audio sont protégés par chiffrement fort AES-256."
                    : "Database storage volumes and stored audio files are encrypted using industry-standard AES-256."}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">{isFrench ? "Contrôle d'Accès par Ligne (Row-Level Security - RLS) :" : "Row-Level Security (RLS) Isolation:"}</strong>{" "}
                  {isFrench
                    ? "Aucun bailleur ne peut voir, modifier ou accéder aux immeubles, locataires ou registres d'un autre bailleur au niveau du moteur de base de données."
                    : "Database-level security rules guarantee that no landlord can view, edit, or access another landlord's buildings, tenants, or financial ledgers."}
                </li>
              </ul>
            </div>

            {/* Section 5: Droits des Utilisateurs */}
            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">4.</span>
                <span>{isFrench ? "Vos Droits et Modalités d'Exercice" : "Your Rights & How to Exercise Them"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Conformément aux législations sur la protection de la vie privée, tout utilisateur (Bailleur ou Locataire) dispose des droits fondamentaux suivants :"
                  : "In accordance with data protection regulations, every user (Landlord, Manager, or Tenant) enjoys the following statutory rights:"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <strong className="text-slate-900 dark:text-white block mb-1">{isFrench ? "Droit d'Accès & d'Exportation" : "Right of Access & Portability"}</strong>
                  <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Exportez vos registres locatifs et quittances au format PDF et tableur à tout moment." : "Download your tenancy records and certified receipts anytime in PDF and spreadsheet format."}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <strong className="text-slate-900 dark:text-white block mb-1">{isFrench ? "Droit de Rectification" : "Right to Rectification"}</strong>
                  <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Corrigez directement dans votre espace toute information erronée relative à vos logements ou locataires." : "Update any inaccurate tenant contact details or property specifications directly in your dashboard."}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <strong className="text-slate-900 dark:text-white block mb-1">{isFrench ? "Droit à l'Effacement (Oubli)" : "Right to Erasure (To Be Forgotten)"}</strong>
                  <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Demandez la suppression complète de votre compte et des données associées dès clôture des baux." : "Request complete account deletion and data wiping subject to statutory tax audit requirements."}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <strong className="text-slate-900 dark:text-white block mb-1">{isFrench ? "Droit de Réclamation" : "Right to Lodge a Complaint"}</strong>
                  <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Contactez directement notre Délégué à la Protection des Données pour toute question relative à votre vie privée." : "Directly contact our Data Protection Officer regarding any inquiry concerning your privacy."}</span>
                </div>
              </div>
            </div>

            {/* Section 6: Contact & DPO */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">5.</span>
                <span>{isFrench ? "Délégué à la Protection des Données & Contact" : "Data Protection Officer & Privacy Inquiries"}</span>
              </h3>
              <p>
                {isFrench
                  ? "Pour exercer vos droits ou pour toute question relative à cette politique de confidentialité, vous pouvez joindre notre équipe dédiée aux coordonnées officielles suivantes :"
                  : "To exercise your statutory rights or ask questions regarding this privacy policy, please contact our designated privacy team directly:"}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a
                  href="mailto:nanakamdomraoulrusselalvares@gmail.com"
                  className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center gap-3 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition"
                >
                  <Mail className="w-5 h-5 shrink-0" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold">{isFrench ? "Email DPO & Confidentialité" : "DPO & Privacy Email"}</p>
                    <p className="text-slate-600 dark:text-slate-400 font-mono mt-0.5">nanakamdomraoulrusselalvares@gmail.com</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/237675993378"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
                >
                  <Phone className="w-5 h-5 shrink-0" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold">{isFrench ? "Ligne d'Assistance Directe" : "Direct Support Line"}</p>
                    <p className="text-slate-600 dark:text-slate-400 font-mono mt-0.5">+237 675 993 378</p>
                  </div>
                </a>
              </div>
            </div>

          </article>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 bg-white dark:bg-slate-950 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; 2026 LeaseLink Inc. {isFrench ? "Tous droits réservés." : "All rights reserved."}</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-white transition">
              {isFrench ? "Accueil" : "Home"}
            </Link>
            <Link href="/register" className="hover:text-blue-600 dark:hover:text-white transition">
              {isFrench ? "Créer un compte" : "Register"}
            </Link>
            <Link href="/login" className="hover:text-blue-600 dark:hover:text-white transition">
              {isFrench ? "Connexion" : "Sign In"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
