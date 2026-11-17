import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Loader2,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  Zap,
} from 'lucide-react';
import { OfflineStatusBadge } from '../RallyComponents';

interface AuthAndJoinScreenProps {
  onJoinWithCodeWithGoogle: (code: string, displayName: string) => Promise<void>;
  onStandardGoogleSignIn: () => Promise<void>;
  onRedirectGoogleSignIn: () => Promise<void>;
  showApkHelp: boolean;
  authError: string | null;
  onClearError: () => void;
}

export function AuthAndJoinScreen({
  onJoinWithCodeWithGoogle,
  onStandardGoogleSignIn,
  onRedirectGoogleSignIn,
  showApkHelp,
  authError,
  onClearError,
}: AuthAndJoinScreenProps) {
  const [groupCode, setGroupCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isJoiningWithCode, setIsJoiningWithCode] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const anyBusy = isJoiningWithCode || isGoogleSigningIn || isRedirecting;
  const displayedError = localError || authError;
  const currentUrl =
    typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.href
      : null;

  const handleJoinClick = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = groupCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9_-]{4,24}$/.test(normalized)) {
      setLocalError('Enter a 4–24 character Group Code (letters, numbers, - or _).');
      return;
    }
    setLocalError(null);
    onClearError();
    setIsJoiningWithCode(true);
    try {
      await onJoinWithCodeWithGoogle(normalized, displayName.trim());
    } finally {
      setIsJoiningWithCode(false);
    }
  };

  const handleStandardSignIn = async () => {
    setLocalError(null);
    onClearError();
    setIsGoogleSigningIn(true);
    try {
      await onStandardGoogleSignIn();
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setLocalError(null);
    onClearError();
    setIsRedirecting(true);
    try {
      await onRedirectGoogleSignIn();
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--rally-bg)] px-4 py-8 text-[var(--rally-on-surface)] sm:px-6">
      <div className="mx-auto max-w-[560px] space-y-5">
        {/* Hero Header */}
        <div
          className="rounded-3xl p-6 text-white shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #1B4DFF 0%, #1034B8 100%)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF5A36] shadow-sm">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  RallyHub
                </h1>
                <p className="text-xs font-medium text-white/85 sm:text-sm">
                  Live Events • Tasks • Group Chats
                </p>
              </div>
            </div>
            <OfflineStatusBadge />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Calendar className="h-3.5 w-3.5" />
              Event Calendar
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <MessageSquare className="h-3.5 w-3.5" />
              Role Chats
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Task Shifts
            </span>
          </div>
        </div>

        {displayedError && (
          <div className="rounded-2xl border border-[var(--rally-secondary)]/30 bg-[var(--rally-secondary-container)] px-4 py-3 text-sm font-medium text-[var(--rally-on-secondary-container)]">
            {displayedError}
          </div>
        )}

        {/* Card 1: Join a Live Cloud Group via Group Code + Display Name */}
        <form
          onSubmit={(e) => void handleJoinClick(e)}
          className="rounded-3xl border border-[var(--rally-outline)]/70 bg-[var(--rally-surface)] p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-primary)]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Join a Group</h2>
              <p className="text-xs text-[var(--rally-on-surface-variant)]">
                Enter your community Group Code and sign in with Google to sync live.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Group Code
              </label>
              <input
                type="text"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value.toUpperCase().slice(0, 24))}
                placeholder="e.g. RALLY26"
                data-testid="group_code_input"
                className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 font-mono-code text-sm uppercase tracking-wider focus:border-[var(--rally-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Your Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
                placeholder="Optional (defaults to your Google name)"
                data-testid="guest_name_input"
                className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={anyBusy}
              data-testid="join_with_code_button"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isJoiningWithCode ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in to join...</span>
                </>
              ) : (
                <span>Join Group with Google</span>
              )}
            </button>
          </div>
        </form>

        {/* Card 2: Admin & Cloud Organizer Sign-In */}
        <div className="rounded-3xl border border-[var(--rally-outline)]/70 bg-[var(--rally-surface)] p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-secondary-container)] text-[#FF5A36]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Organizers & Group Hub</h2>
              <p className="text-xs text-[var(--rally-on-surface-variant)]">
                Create a new RallyHub group, manage admins, or resume your synced groups.
              </p>
            </div>
          </div>

          <hr className="my-4 border-[var(--rally-outline)]/40" />

          <button
            type="button"
            disabled={anyBusy}
            onClick={() => void handleStandardSignIn()}
            data-testid="google_sign_in_button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--rally-primary)]/40 bg-transparent px-4 text-sm font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/50 disabled:cursor-not-allowed disabled:opacity-55"
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
                  Signing in from an Android APK or WebView?
                </div>
                <p>
                  Google blocks OAuth popups and standard Android WebViews (
                  <code className="font-mono-code">403 disallowed_useragent</code>). Use Redirect
                  Sign-In, open RallyHub in Chrome, or package your APK as a Trusted Web Activity
                  (TWA) / Chrome Custom Tabs.
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
