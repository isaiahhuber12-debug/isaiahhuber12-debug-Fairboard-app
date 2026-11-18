import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  MoreVertical,
  Palette,
  Phone,
  PlusSquare,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_PERSONAL_APPEARANCE,
  getAppBackgroundPresentation,
  getPersonalBannerPresentation,
  type PersonalAppearance,
} from '../../lib/backgrounds';
import { readInviteCodeFromWindowLocation } from '../../lib/qrInvite';
import { E164_PHONE_REGEX, normalizePhoneInput } from '../../services/smsService';
import { PersonalAppearanceModal } from '../BackgroundCustomizerCard';
import { ModalDialog, OfflineStatusBadge } from '../RallyComponents';
import { QrScannerModal } from '../QrScannerModal';

interface AuthAndJoinScreenProps {
  onJoinWithCodeDirect: (
    code: string,
    displayName: string,
    phoneNumber: string
  ) => Promise<void>;
  onJoinWithCodeWithGoogle: (
    code: string,
    displayName: string,
    phoneNumber?: string
  ) => Promise<void>;
  onStandardGoogleSignIn: (phoneNumber?: string) => Promise<void>;
  onRedirectGoogleSignIn: (phoneNumber?: string) => Promise<void>;
  showApkHelp: boolean;
  authError: string | null;
  onClearError: () => void;
  appearance?: PersonalAppearance;
  isDarkMode?: boolean;
  onUpdateAppearance?: (patch: Partial<PersonalAppearance>) => void;
  onResetAppearance?: () => void;
}

export function AuthAndJoinScreen({
  onJoinWithCodeDirect,
  onJoinWithCodeWithGoogle,
  onStandardGoogleSignIn,
  onRedirectGoogleSignIn,
  showApkHelp,
  authError,
  onClearError,
  appearance = DEFAULT_PERSONAL_APPEARANCE,
  isDarkMode = false,
  onUpdateAppearance,
  onResetAppearance,
}: AuthAndJoinScreenProps) {
  const [groupCode, setGroupCode] = useState(() => readInviteCodeFromWindowLocation() ?? '');
  const [displayName, setDisplayName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [scannedNotice, setScannedNotice] = useState<string | null>(null);
  const [isJoiningDirect, setIsJoiningDirect] = useState(false);
  const [isJoiningWithGoogle, setIsJoiningWithGoogle] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showAddToHomeModal, setShowAddToHomeModal] = useState(false);
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);

  const appBg = getAppBackgroundPresentation(
    appearance.appBackground,
    isDarkMode,
    appearance.colorTheme
  );
  const bannerBg = getPersonalBannerPresentation(appearance);

  const anyBusy =
    isJoiningDirect || isJoiningWithGoogle || isGoogleSigningIn || isRedirecting;
  const displayedError = localError || authError;
  const currentUrl =
    typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.href
      : null;

  const handleJoinDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = groupCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9_-]{4,24}$/.test(normalizedCode)) {
      setLocalError('Enter a 4–24 character Group Code (letters, numbers, - or _).');
      return;
    }
    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      setLocalError('Please enter your full name (at least 2 characters) to join.');
      return;
    }
    const normalizedPhone = normalizePhoneInput(guestPhone);
    if (!E164_PHONE_REGEX.test(normalizedPhone)) {
      setLocalError('Please enter a valid cell phone number (e.g. (555) 123-4567).');
      return;
    }

    setLocalError(null);
    onClearError();
    setIsJoiningDirect(true);
    try {
      await onJoinWithCodeDirect(normalizedCode, cleanName, normalizedPhone);
    } finally {
      setIsJoiningDirect(false);
    }
  };

  const handleJoinWithGoogleClick = async () => {
    const normalizedCode = groupCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9_-]{4,24}$/.test(normalizedCode)) {
      setLocalError('Enter a 4–24 character Group Code before joining with Google.');
      return;
    }
    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      setLocalError('Please enter your full name (at least 2 characters) to join.');
      return;
    }
    const normalizedPhone = guestPhone.trim() ? normalizePhoneInput(guestPhone) : '';
    if (guestPhone.trim() && !E164_PHONE_REGEX.test(normalizedPhone)) {
      setLocalError('Enter a valid cell phone number (e.g. (555) 123-4567).');
      return;
    }

    setLocalError(null);
    onClearError();
    setIsJoiningWithGoogle(true);
    try {
      await onJoinWithCodeWithGoogle(
        normalizedCode,
        cleanName,
        normalizedPhone || undefined
      );
    } finally {
      setIsJoiningWithGoogle(false);
    }
  };

  const handleStandardSignIn = async () => {
    const rawPhone = googlePhone.trim() || guestPhone.trim();
    const normalizedPhone = rawPhone ? normalizePhoneInput(rawPhone) : '';
    if (rawPhone && !E164_PHONE_REGEX.test(normalizedPhone)) {
      setLocalError('Enter a valid cell phone number (e.g. (555) 123-4567) or clear the field.');
      return;
    }

    setLocalError(null);
    onClearError();
    setIsGoogleSigningIn(true);
    try {
      await onStandardGoogleSignIn(normalizedPhone || undefined);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleRedirectSignIn = async () => {
    const rawPhone = googlePhone.trim() || guestPhone.trim();
    const normalizedPhone = rawPhone && E164_PHONE_REGEX.test(normalizePhoneInput(rawPhone))
      ? normalizePhoneInput(rawPhone)
      : undefined;

    setLocalError(null);
    onClearError();
    setIsRedirecting(true);
    try {
      await onRedirectGoogleSignIn(normalizedPhone);
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div
      style={appBg.style}
      className="min-h-screen bg-[var(--rally-bg)] px-4 py-8 text-[var(--rally-on-surface)] transition-[background] duration-300 sm:px-6"
    >
      <div className="mx-auto max-w-[560px] space-y-5">
        {/* Hero Header */}
        <div
          className={`rounded-3xl p-6 shadow-lg ${
            bannerBg.isLightBg ? 'text-slate-900' : 'text-white'
          }`}
          style={bannerBg.style}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-secondary)] shadow-sm">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  RallyHub
                </h1>
                <p
                  className={`text-xs font-medium sm:text-sm ${
                    bannerBg.isLightBg ? 'text-slate-700' : 'text-white/85'
                  }`}
                >
                  Live Events · Tasks · Group Chats · SMS Updates
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onUpdateAppearance && (
                <button
                  type="button"
                  onClick={() => setShowAppearanceModal(true)}
                  data-testid="auth_appearance_button"
                  title="Customize your personal colors and background"
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                    bannerBg.isLightBg
                      ? 'bg-slate-900/10 text-slate-900 hover:bg-slate-900/20'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span>My Theme</span>
                </button>
              )}
              <OfflineStatusBadge />
            </div>
          </div>

          <div
            className={`mt-5 flex flex-wrap items-center gap-2 text-xs font-medium ${
              bannerBg.isLightBg ? 'text-slate-800' : 'text-white/90'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Event Calendar
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Role Chats
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Task Shifts
            </span>
          </div>
        </div>

        {displayedError && (
          <div
            role="alert"
            data-testid="auth_error_banner"
            className="rounded-2xl border border-[var(--rally-secondary)]/30 bg-[var(--rally-secondary-container)] px-4 py-3 text-sm font-medium text-[var(--rally-on-secondary-container)]"
          >
            {displayedError}
          </div>
        )}

        {/* Card 1: Join a Live Group via Group Code + Name + Cell Phone (No Email Required) */}
        <form
          onSubmit={(e) => void handleJoinDirectSubmit(e)}
          className="rounded-3xl border border-[var(--rally-outline)]/70 bg-[var(--rally-surface)] p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-primary)]">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">
                  Join with Group Code
                </h2>
                <p className="text-xs text-[var(--rally-on-surface-variant)]">
                  No email required — enter your Group Code, full name, and cell phone number.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-[var(--rally-tertiary-container)] px-2.5 py-1 text-[11px] font-bold text-[var(--rally-on-tertiary-container)]">
              No Email Needed
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Group Code <span className="text-[var(--rally-secondary)]">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={groupCode}
                  onChange={(e) => {
                    setGroupCode(e.target.value.toUpperCase().slice(0, 24));
                    setScannedNotice(null);
                  }}
                  placeholder="e.g. RALLY26"
                  data-testid="group_code_input"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 font-mono-code text-sm uppercase tracking-wider focus:border-[var(--rally-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={anyBusy}
                  onClick={() => {
                    setLocalError(null);
                    onClearError();
                    setShowQrScannerModal(true);
                  }}
                  data-testid="auth_scan_qr_button"
                  title="Scan a host's QR code with your camera"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--rally-primary)]/40 bg-[var(--rally-primary-container)]/50 px-3.5 py-2.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95 disabled:opacity-55"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Scan QR</span>
                </button>
              </div>
              {scannedNotice && (
                <div
                  data-testid="auth_qr_scanned_notice"
                  className="mt-1.5 rounded-xl bg-[var(--rally-tertiary-container)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-tertiary-container)]"
                >
                  {scannedNotice}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                  Your Full Name <span className="text-[var(--rally-secondary)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  aria-required="true"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                  placeholder="e.g. Jordan Taylor"
                  data-testid="guest_name_input"
                  className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                  Cell Phone Number <span className="text-[var(--rally-secondary)]">*</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value.slice(0, 24))}
                    placeholder="(555) 123-4567"
                    data-testid="guest_phone_input"
                    className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2.5 pl-9 pr-3.5 font-mono-code text-sm focus:border-[var(--rally-primary)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[var(--rally-on-surface-variant)]">
              Your name and cell phone number are visible to the group&apos;s Creator and Admins for
              coordination and SMS updates.
            </p>

            <button
              type="submit"
              disabled={anyBusy}
              data-testid="join_with_code_button"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isJoiningDirect ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Joining group...</span>
                </>
              ) : (
                <span>Join Group</span>
              )}
            </button>

            <button
              type="button"
              disabled={anyBusy}
              onClick={() => void handleJoinWithGoogleClick()}
              data-testid="join_with_code_google_button"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-4 text-xs font-semibold text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)] hover:text-[var(--rally-on-surface)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isJoiningWithGoogle ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <span>Or Join Code &amp; Sign In with Google</span>
              )}
            </button>
          </div>
        </form>

        {/* Card 2: Sign In with Google (Creators, Admins, Organizers, or Google Members) */}
        <div className="rounded-3xl border border-[var(--rally-outline)]/70 bg-[var(--rally-surface)] p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-secondary-container)] text-[#FF5A36]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Sign In with Google</h2>
              <p className="text-xs text-[var(--rally-on-surface-variant)]">
                Create a new group, manage admins, or sign in with your Google account.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Your Cell Phone Number
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
                <input
                  type="tel"
                  value={googlePhone}
                  onChange={(e) => setGooglePhone(e.target.value.slice(0, 24))}
                  placeholder="(555) 123-4567 (required on first sign-in)"
                  data-testid="google_signin_phone_input"
                  className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2.5 pl-9 pr-3.5 font-mono-code text-sm focus:border-[var(--rally-primary)] focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--rally-on-surface-variant)]">
                Saved to your account and shared with your group&apos;s Creator &amp; Admins. If
                already saved, you can leave this blank.
              </p>
            </div>

            <button
              type="button"
              disabled={anyBusy}
              onClick={() => void handleStandardSignIn()}
              data-testid="google_sign_in_button"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--rally-primary)]/45 bg-[var(--rally-primary-container)]/40 px-4 text-sm font-semibold text-[var(--rally-on-primary-container)] transition hover:bg-[var(--rally-primary-container)]/75 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isGoogleSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In with Google</span>
              )}
            </button>
          </div>
        </div>

        {/* APK / Android WebView Sign-In Fallback & Help */}
        {showApkHelp && (
          <div
            data-testid="apk_auth_help_card"
            className="space-y-3 rounded-3xl border border-[var(--rally-outline)]/70 bg-[var(--rally-surface)] p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rally-secondary)]" />
              <div className="space-y-1 text-xs text-[var(--rally-on-surface-variant)]">
                <div className="font-display text-sm font-bold text-[var(--rally-on-surface)]">
                  Using an Android APK or WebView?
                </div>
                <p>
                  Participants can join immediately above using just a{' '}
                  <strong className="font-semibold text-[var(--rally-on-surface)]">
                    Group Code + Name + Cell Phone
                  </strong>{' '}
                  (works inside any APK!). For Google Sign-In, use Redirect Sign-In or install via
                  Chrome.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={anyBusy}
                onClick={() => void handleRedirectSignIn()}
                data-testid="google_redirect_sign_in_button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--rally-secondary)] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Redirecting...</span>
                  </>
                ) : (
                  <span>Use Redirect Sign-In</span>
                )}
              </button>
              {currentUrl && (
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in Browser</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowAddToHomeModal(true)}
                data-testid="apk_open_add_to_home_button"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--rally-primary)]/40 bg-[var(--rally-primary-container)]/55 px-3.5 py-2.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Add to Home Screen Guide</span>
              </button>
            </div>
          </div>
        )}

        {/* Info Card: Chrome 'Add to Home Screen' for Reliable Google Sign-In */}
        <div
          data-testid="add_to_home_screen_info_card"
          className="rounded-3xl border border-[var(--rally-outline)]/70 bg-[var(--rally-surface)] p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-tertiary-container)] text-[var(--rally-tertiary)]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-base font-bold">
                  Install App via Chrome for Reliable Google Sign-In
                </h2>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  Using{' '}
                  <strong className="font-semibold text-[var(--rally-on-surface)]">
                    Add to Home screen
                  </strong>{' '}
                  from the Google Chrome menu installs RallyHub with Chrome&apos;s trusted OAuth,
                  popup, and cookie permissions—avoiding the sign-in blocks common in standalone APK
                  WebViews.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddToHomeModal(true)}
              data-testid="open_add_to_home_screen_modal"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--rally-primary)]/40 bg-[var(--rally-primary-container)]/60 px-3.5 py-2 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
            >
              <PlusSquare className="h-3.5 w-3.5" />
              <span>View Chrome Steps</span>
            </button>
          </div>
        </div>
      </div>

      <AddToHomeScreenModal
        open={showAddToHomeModal}
        currentUrl={currentUrl}
        onClose={() => setShowAddToHomeModal(false)}
      />

      <QrScannerModal
        open={showQrScannerModal}
        onClose={() => setShowQrScannerModal(false)}
        onCodeScanned={(code) => {
          setGroupCode(code);
          setLocalError(null);
          setScannedNotice(
            `Scanned invite code "${code}" — enter your name and cell phone number below and tap Join Group.`
          );
        }}
      />

      {onUpdateAppearance && (
        <PersonalAppearanceModal
          open={showAppearanceModal}
          onClose={() => setShowAppearanceModal(false)}
          appearance={appearance}
          onUpdate={onUpdateAppearance}
          onReset={() => onResetAppearance?.()}
        />
      )}
    </div>
  );
}

function AddToHomeScreenModal({
  open,
  currentUrl,
  onClose,
}: {
  open: boolean;
  currentUrl: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    if (!currentUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const steps = [
    {
      title: '1. Open RallyHub in Google Chrome',
      description:
        'If you are viewing inside an APK wrapper or in-app browser, open this link in the full Google Chrome app first.',
    },
    {
      title: '2. Tap the Chrome menu (⋮)',
      description:
        'In the top-right corner of Chrome, tap the three-dot menu icon next to the address bar.',
    },
    {
      title: '3. Select "Add to Home screen" (or "Install app")',
      description:
        'Tap Add to Home screen -> Install (or Add) and confirm to place the RallyHub icon on your home screen.',
    },
    {
      title: '4. Open from Home Screen & Sign In with Google',
      description:
        'Launch RallyHub from your home screen. Chrome runs it with trusted browser permissions so Google Sign-In succeeds reliably.',
    },
  ];

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Add to Home Screen (Chrome)"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {currentUrl && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  data-testid="copy_app_url_button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[var(--rally-tertiary)]" />
                      <span>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy App Link</span>
                    </>
                  )}
                </button>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in Chrome</span>
                </a>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close_add_to_home_modal_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            Got It
          </button>
        </div>
      }
    >
      <div
        data-testid="add_to_home_screen_modal"
        className="space-y-3.5 text-sm text-[var(--rally-on-surface)]"
      >
        <div className="rounded-2xl border border-[var(--rally-primary)]/30 bg-[var(--rally-primary-container)]/50 p-3.5 text-xs leading-relaxed text-[var(--rally-on-primary-container)]">
          <strong className="font-semibold">Why this works better than an APK WebView:</strong>{' '}
          Google blocks OAuth inside embedded WebViews (
          <code className="font-mono-code">403 disallowed_useragent</code>) and many wrappers block
          sign-in popups. Installing via Chrome&apos;s{' '}
          <strong className="font-semibold">Add to Home screen</strong> keeps Chrome&apos;s trusted
          session, third-party auth cookies, and popup/redirect permissions intact so Google Sign-In
          works reliably.
        </div>

        <ol className="space-y-2.5">
          {steps.map((step, idx) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                {idx + 1}
              </span>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold text-[var(--rally-on-surface)]">
                  <span>{step.title.replace(/^\d+\.\s*/, '')}</span>
                  {idx === 1 && (
                    <MoreVertical className="inline h-3.5 w-3.5 text-[var(--rally-on-surface-variant)]" />
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </ModalDialog>
  );
}
