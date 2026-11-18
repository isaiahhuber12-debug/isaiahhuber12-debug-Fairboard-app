import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Palette,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  auth,
  getAuthFriendlyError,
  googleProvider,
  isEmbeddedWebView,
  isUnsupportedSchemeForFirebaseAuth,
} from './lib/firebase';
import { getFriendlyErrorMessage } from './lib/firestoreError';
import {
  clearGuestSession,
  ensureGuestSession,
  getStoredGuestSession,
  type GuestSession,
  subscribeGuestSession,
} from './lib/guestSession';
import {
  DEFAULT_PERSONAL_APPEARANCE,
  getAppBackgroundPresentation,
  getThemeCssVariables,
  type PersonalAppearance,
  readStoredPersonalAppearance,
  sanitizePersonalAppearance,
  subscribeStoredPersonalAppearance,
  writeStoredPersonalAppearance,
} from './lib/backgrounds';
import * as repo from './services/rallyRepository';
import { E164_PHONE_REGEX, normalizePhoneInput } from './services/smsService';
import { useAiCoordinator } from './hooks/useAiCoordinator';
import { type PendingJoinRequest, useRallyWorkspace } from './hooks/useRallyWorkspace';
import { type HubTab, ROLE_META, type WorkspaceIdentity } from './types/rally';
import { PersonalAppearanceModal } from './components/BackgroundCustomizerCard';
import {
  GroupAvatar,
  ModalDialog,
  OfflineStatusBadge,
  RoleBadge,
} from './components/RallyComponents';
import { HomeScreenPushBanner, PWAInstallButton } from './components/PWAInstallPrompt';
import { AuthAndJoinScreen } from './components/screens/AuthAndJoinScreen';
import { CloudGroupHubScreen } from './components/screens/CloudGroupHubScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { CalendarScreen } from './components/screens/CalendarScreen';
import { ChatsScreen } from './components/screens/ChatsScreen';
import { NotificationsScreen } from './components/screens/NotificationsScreen';
import { AdminPanelScreen, type AdminPanelSubTab } from './components/screens/AdminPanelScreen';
import { AiCoordinatorSheet } from './components/screens/AiCoordinatorSheet';

interface NavTabItem {
  id: HubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_TABS: NavTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

const PENDING_JOIN_STORAGE_KEY = 'rallyhub_pending_join_v1';
const PENDING_GOOGLE_PHONE_KEY = 'rallyhub_pending_google_phone_v1';

function readStoredPendingJoin(): PendingJoinRequest | null {
  try {
    const raw = sessionStorage.getItem(PENDING_JOIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      code?: unknown;
      displayName?: unknown;
      phoneNumber?: unknown;
      switchGroupId?: unknown;
    };
    if (typeof parsed.code === 'string' && parsed.code.trim()) {
      return {
        code: parsed.code.trim(),
        displayName:
          typeof parsed.displayName === 'string' && parsed.displayName.trim()
            ? parsed.displayName.trim()
            : null,
        phoneNumber:
          typeof parsed.phoneNumber === 'string' && parsed.phoneNumber.trim()
            ? parsed.phoneNumber.trim()
            : null,
        switchGroupId:
          typeof parsed.switchGroupId === 'string' && parsed.switchGroupId.trim()
            ? parsed.switchGroupId.trim()
            : null,
      };
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function writeStoredPendingJoin(join: PendingJoinRequest | null): void {
  try {
    if (!join) {
      sessionStorage.removeItem(PENDING_JOIN_STORAGE_KEY);
    } else {
      sessionStorage.setItem(PENDING_JOIN_STORAGE_KEY, JSON.stringify(join));
    }
  } catch {
    // Ignore storage access errors
  }
}

function readStoredPendingGooglePhone(): string | null {
  try {
    const val = sessionStorage.getItem(PENDING_GOOGLE_PHONE_KEY);
    return val && E164_PHONE_REGEX.test(val) ? val : null;
  } catch {
    return null;
  }
}

function writeStoredPendingGooglePhone(phone: string | null): void {
  try {
    if (!phone) {
      sessionStorage.removeItem(PENDING_GOOGLE_PHONE_KEY);
    } else {
      sessionStorage.setItem(PENDING_GOOGLE_PHONE_KEY, phone);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(() =>
    getStoredGuestSession()
  );
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showApkAuthHelp, setShowApkAuthHelp] = useState(() => isEmbeddedWebView());
  const [pendingJoin, setPendingJoin] = useState<PendingJoinRequest | null>(() =>
    readStoredPendingJoin()
  );
  const [pendingGooglePhone, setPendingGooglePhone] = useState<string | null>(() =>
    readStoredPendingGooglePhone()
  );

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [deviceAppearance, setDeviceAppearance] = useState<PersonalAppearance>(() =>
    readStoredPersonalAppearance(null)
  );

  // Track OS dark mode preference
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    return subscribeStoredPersonalAppearance(null, (next) => {
      setDeviceAppearance(next);
    });
  }, []);

  // Keep guest session reactive across tabs & storage updates
  useEffect(() => {
    return subscribeGuestSession((nextSession) => {
      setGuestSession(nextSession);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          const restored = readStoredPendingJoin();
          if (restored) setPendingJoin(restored);
          const restoredPhone = readStoredPendingGooglePhone();
          if (restoredPhone) setPendingGooglePhone(restoredPhone);
        }
      })
      .catch((err) => {
        if (!active) return;
        writeStoredPendingJoin(null);
        setPendingJoin(null);
        const friendly = getAuthFriendlyError(err);
        setAuthError(friendly.message);
        if (friendly.showApkHelp) setShowApkAuthHelp(true);
      });

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const triggerRedirectSignIn = useCallback(
    async (nextPendingJoin: PendingJoinRequest | null, phoneNumber?: string) => {
      setAuthError(null);
      if (isUnsupportedSchemeForFirebaseAuth()) {
        setShowApkAuthHelp(true);
        setAuthError(
          'Google Sign-In cannot run from a local file:// or custom APK scheme. Join with a Group Code + Name + Cell Phone above, or open the hosted HTTPS app URL in Chrome.'
        );
        return;
      }
      if (phoneNumber && E164_PHONE_REGEX.test(phoneNumber)) {
        writeStoredPendingGooglePhone(phoneNumber);
        setPendingGooglePhone(phoneNumber);
      }
      writeStoredPendingJoin(nextPendingJoin);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (err) {
        writeStoredPendingJoin(null);
        setPendingJoin(null);
        const friendly = getAuthFriendlyError(err);
        setAuthError(friendly.message);
        if (friendly.showApkHelp) setShowApkAuthHelp(true);
      }
    },
    []
  );

  const handleGoogleSignIn = useCallback(
    async (nextPendingJoin: PendingJoinRequest | null, phoneNumber?: string) => {
      setAuthError(null);
      const validPhone =
        phoneNumber && E164_PHONE_REGEX.test(phoneNumber) ? phoneNumber : undefined;
      if (validPhone) {
        writeStoredPendingGooglePhone(validPhone);
        setPendingGooglePhone(validPhone);
      }

      if (isUnsupportedSchemeForFirebaseAuth()) {
        setShowApkAuthHelp(true);
        setAuthError(
          'Google Sign-In cannot run from a local file:// or custom APK scheme. Join with a Group Code + Name + Cell Phone above, or load the hosted HTTPS URL in Chrome.'
        );
        return;
      }

      if (isEmbeddedWebView()) {
        setShowApkAuthHelp(true);
        await triggerRedirectSignIn(nextPendingJoin, validPhone);
        return;
      }

      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setPendingJoin(null);
          writeStoredPendingJoin(null);
          return;
        }
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          setShowApkAuthHelp(true);
          await triggerRedirectSignIn(nextPendingJoin, validPhone);
          return;
        }
        setPendingJoin(null);
        writeStoredPendingJoin(null);
        const friendly = getAuthFriendlyError(err);
        setAuthError(friendly.message);
        if (friendly.showApkHelp) setShowApkAuthHelp(true);
      }
    },
    [triggerRedirectSignIn]
  );

  const handleJoinWithCodeDirect = useCallback(
    async (code: string, displayName: string, phoneNumber: string) => {
      setAuthError(null);
      const normalizedPhone = normalizePhoneInput(phoneNumber);
      const existingGuest = getStoredGuestSession();
      const hadExistingGroups = Boolean(existingGuest && existingGuest.joinedGroups.length > 0);

      ensureGuestSession(displayName.trim(), normalizedPhone);
      try {
        const groupId = await repo.joinGroupByCode(code, displayName.trim(), normalizedPhone);
        setGuestSession(getStoredGuestSession());
        setPendingJoin({
          code,
          displayName: displayName.trim(),
          phoneNumber: normalizedPhone,
          switchGroupId: groupId,
        });
      } catch (err) {
        if (!hadExistingGroups && !auth.currentUser) {
          clearGuestSession();
          setGuestSession(null);
        }
        setAuthError(getFriendlyErrorMessage(err, 'Could not join group with that code'));
      }
    },
    []
  );

  const handleJoinWithCodeWithGoogle = useCallback(
    async (code: string, displayName: string, phoneNumber?: string) => {
      const nextJoin: PendingJoinRequest = {
        code,
        displayName: displayName.trim() || null,
        phoneNumber: phoneNumber ?? null,
      };
      setPendingJoin(nextJoin);
      await handleGoogleSignIn(nextJoin, phoneNumber);
    },
    [handleGoogleSignIn]
  );

  const handleStandardGoogleSignIn = useCallback(
    async (phoneNumber?: string) => {
      setPendingJoin(null);
      writeStoredPendingJoin(null);
      await handleGoogleSignIn(null, phoneNumber);
    },
    [handleGoogleSignIn]
  );

  const handleRedirectGoogleSignIn = useCallback(
    async (phoneNumber?: string) => {
      await triggerRedirectSignIn(pendingJoin, phoneNumber);
    },
    [pendingJoin, triggerRedirectSignIn]
  );

  const handleSignOut = useCallback(async () => {
    setPendingJoin(null);
    writeStoredPendingJoin(null);
    setPendingGooglePhone(null);
    writeStoredPendingGooglePhone(null);
    setAuthError(null);
    clearGuestSession();
    setGuestSession(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const identity: WorkspaceIdentity | null = useMemo(() => {
    if (user) {
      return {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        isGuest: false,
      };
    }
    if (guestSession) {
      return {
        uid: guestSession.uid,
        displayName: guestSession.displayName,
        email: null,
        isGuest: true,
        phoneNumber: guestSession.phoneNumber,
      };
    }
    return null;
  }, [user, guestSession]);

  const unauthEffectiveDark =
    deviceAppearance.colorMode === 'dark'
      ? true
      : deviceAppearance.colorMode === 'light'
        ? false
        : systemDark;

  useEffect(() => {
    if (identity) return;
    document.documentElement.classList.toggle('dark', unauthEffectiveDark);
    const vars = getThemeCssVariables(deviceAppearance.colorTheme, unauthEffectiveDark);
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
  }, [identity, deviceAppearance.colorTheme, unauthEffectiveDark]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--rally-bg)] text-[var(--rally-on-surface)]">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--rally-primary)]" />
          <span className="font-display text-sm font-semibold">Loading RallyHub...</span>
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <>
        <AuthAndJoinScreen
          onJoinWithCodeDirect={handleJoinWithCodeDirect}
          onJoinWithCodeWithGoogle={handleJoinWithCodeWithGoogle}
          onStandardGoogleSignIn={handleStandardGoogleSignIn}
          onRedirectGoogleSignIn={handleRedirectGoogleSignIn}
          showApkHelp={showApkAuthHelp}
          authError={authError}
          onClearError={() => setAuthError(null)}
          appearance={deviceAppearance}
          isDarkMode={unauthEffectiveDark}
          onUpdateAppearance={(patch) => {
            const next = sanitizePersonalAppearance({ ...deviceAppearance, ...patch });
            setDeviceAppearance(writeStoredPersonalAppearance(null, next));
          }}
          onResetAppearance={() => {
            setDeviceAppearance(writeStoredPersonalAppearance(null, DEFAULT_PERSONAL_APPEARANCE));
          }}
        />
        <HomeScreenPushBanner />
      </>
    );
  }

  return (
    <>
      <CloudWorkspaceHost
        key={identity.uid}
        identity={identity}
        systemDark={systemDark}
        pendingJoin={pendingJoin}
        pendingGooglePhone={pendingGooglePhone}
        onPendingJoinConsumed={() => {
          writeStoredPendingJoin(null);
          setPendingJoin(null);
        }}
        onPendingGooglePhoneConsumed={() => {
          writeStoredPendingGooglePhone(null);
          setPendingGooglePhone(null);
        }}
        onRequestGoogleSignIn={(carryPhone?: string) => {
          void handleStandardGoogleSignIn(carryPhone);
        }}
        onSignOut={() => void handleSignOut()}
      />
      <HomeScreenPushBanner />
    </>
  );
}

function CloudWorkspaceHost({
  identity,
  systemDark,
  pendingJoin,
  pendingGooglePhone,
  onPendingJoinConsumed,
  onPendingGooglePhoneConsumed,
  onRequestGoogleSignIn,
  onSignOut,
}: {
  identity: WorkspaceIdentity;
  systemDark: boolean;
  pendingJoin: PendingJoinRequest | null;
  pendingGooglePhone: string | null;
  onPendingJoinConsumed: () => void;
  onPendingGooglePhoneConsumed: () => void;
  onRequestGoogleSignIn: (carryPhone?: string) => void;
  onSignOut: () => void;
}) {
  const handleUpgradeToGoogle = useCallback(() => {
    const carryPhone = getStoredGuestSession()?.phoneNumber || identity.phoneNumber || undefined;
    onRequestGoogleSignIn(carryPhone);
  }, [identity.phoneNumber, onRequestGoogleSignIn]);

  const { state, actions } = useRallyWorkspace(
    identity,
    pendingJoin,
    onPendingJoinConsumed,
    handleUpgradeToGoogle
  );
  const ai = useAiCoordinator();

  const [selectedTab, setSelectedTab] = useState<HubTab>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<AdminPanelSubTab>('controls');
  const [showAiSheet, setShowAiSheet] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);

  // Auto-apply phone number entered prior to Google Sign-In
  const appliedGooglePhoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.isGuest || !pendingGooglePhone) return;
    if (appliedGooglePhoneRef.current === pendingGooglePhone) return;
    appliedGooglePhoneRef.current = pendingGooglePhone;
    void actions
      .saveSmsPreferences({
        phone: pendingGooglePhone,
        enabled: true,
        forMessages: true,
        forEvents: true,
      })
      .finally(() => {
        onPendingGooglePhoneConsumed();
      });
  }, [state.isGuest, pendingGooglePhone, actions, onPendingGooglePhoneConsumed]);

  const needsGooglePhoneOnboarding =
    !state.isGuest &&
    state.smsPrefsLoaded &&
    !state.smsPreferences.phone &&
    !pendingGooglePhone &&
    !pendingJoin?.phoneNumber;

  const visibleTabs = useMemo(() => {
    if (ROLE_META[state.currentRole].canAccessAdminPanel) {
      return ALL_TABS;
    }
    return ALL_TABS.filter((t) => t.id !== 'admin');
  }, [state.currentRole]);

  const activeTab: HubTab = visibleTabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : 'dashboard';

  useEffect(() => {
    if (!state.bannerMessage) return;
    const timer = window.setTimeout(() => {
      actions.clearBanner();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [state.bannerMessage, actions]);

  const effectiveDark =
    state.personalAppearance.colorMode === 'dark'
      ? true
      : state.personalAppearance.colorMode === 'light'
        ? false
        : systemDark;

  const themeVars = useMemo(
    () => getThemeCssVariables(state.personalAppearance.colorTheme, effectiveDark),
    [state.personalAppearance.colorTheme, effectiveDark]
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveDark);
    for (const [k, v] of Object.entries(themeVars)) {
      document.documentElement.style.setProperty(k, v);
    }
  }, [effectiveDark, themeVars]);

  const appBg = useMemo(
    () =>
      getAppBackgroundPresentation(
        state.personalAppearance.appBackground,
        effectiveDark,
        state.personalAppearance.colorTheme
      ),
    [
      state.personalAppearance.appBackground,
      effectiveDark,
      state.personalAppearance.colorTheme,
    ]
  );

  const rootStyle = useMemo(
    () =>
      ({
        ...themeVars,
        ...appBg.style,
        '--rally-canvas-text': appBg.isDarkCanvas ? '#F1F5F9' : '#111827',
        '--rally-canvas-text-muted': appBg.isDarkCanvas ? '#CBD5E1' : '#4B5565',
      }) as React.CSSProperties,
    [themeVars, appBg]
  );

  return (
    <div
      data-testid="app_workspace_canvas"
      style={rootStyle}
      className="min-h-screen bg-[var(--rally-bg)] text-[var(--rally-on-surface)] transition-[background] duration-300"
    >
      {state.activeGroup === null ? (
        <div className="min-h-screen pb-10">
          <CloudGroupHubScreen state={state} actions={actions} onSignOut={onSignOut} />
        </div>
      ) : (
        <div className="flex min-h-screen flex-col">
          {/* Top App Bar */}
          <header className="sticky top-0 z-30 border-b border-[var(--rally-outline)]/65 bg-[var(--rally-surface)]/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <GroupAvatar
                  groupName={state.activeGroup.name}
                  imageUrl={
                    state.activeGroup.groupImageUrl ??
                    state.groupImagesById[state.activeGroup.id] ??
                    null
                  }
                  size="sm"
                  testId="topbar_group_avatar"
                />
                <span className="truncate font-display text-lg font-bold tracking-tight">
                  {state.activeGroup.name}
                </span>
                <RoleBadge role={state.currentRole} />
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <OfflineStatusBadge />
                <PWAInstallButton />
                {state.isGuest && (
                  <button
                    type="button"
                    onClick={() => actions.requestGoogleSignIn()}
                    data-testid="topbar_google_signin_button"
                    title="Sign in with Google to unlock organizer/admin features"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-primary)]/40 bg-[var(--rally-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/45"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Google Sign-In</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAppearanceModal(true)}
                  data-testid="topbar_appearance_button"
                  title="Customize your personal colors and background"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
                >
                  <Palette className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
                  <span className="hidden sm:inline">My Theme</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiSheet(true)}
                  data-testid="open_ai_coordinator_button"
                  title="Open Gemini AI Coordinator"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary-container)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Coordinator</span>
                </button>
                <button
                  type="button"
                  onClick={actions.leaveSession}
                  data-testid="switch_group_button"
                  title="Switch group"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-2.5 py-1.5 text-xs font-semibold transition hover:bg-[var(--rally-surface-variant)]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Switch Group</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  data-testid="sign_out_button"
                  title="Sign out"
                  className="rounded-xl p-2 text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)] hover:text-[var(--rally-on-surface)]"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Body: NavigationRail (>=768px) + Content */}
          <div className="flex flex-1">
            <aside className="hidden w-24 shrink-0 flex-col items-center gap-2 border-r border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] py-4 md:flex">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTab(tab.id)}
                    data-testid={`rail_${tab.id}`}
                    className={`flex w-20 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                        : 'text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/60'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </aside>

            <main className="min-w-0 flex-1 pb-20 md:pb-6">
              {activeTab === 'dashboard' && (
                <DashboardScreen
                  state={state}
                  actions={actions}
                  onOpenEvent={(eventId) => {
                    actions.selectEvent(eventId);
                    setSelectedTab('calendar');
                  }}
                  onOpenNotifications={() => setSelectedTab('alerts')}
                  onOpenAiCoordinator={() => setShowAiSheet(true)}
                  onOpenAdminPanel={() => {
                    setAdminSubTab('audit');
                    setSelectedTab('admin');
                  }}
                  onCopiedCode={() => actions.showBanner('Group invite code copied to clipboard')}
                />
              )}
              {activeTab === 'calendar' && <CalendarScreen state={state} actions={actions} />}
              {activeTab === 'chats' && <ChatsScreen state={state} actions={actions} />}
              {activeTab === 'alerts' && (
                <NotificationsScreen state={state} actions={actions} />
              )}
              {activeTab === 'admin' && (
                <AdminPanelScreen
                  state={state}
                  actions={actions}
                  activeSubTab={adminSubTab}
                  onSubTabChange={setAdminSubTab}
                  onCopiedCode={() => actions.showBanner('Group invite code copied to clipboard')}
                />
              )}
            </main>
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[var(--rally-outline)]/65 bg-[var(--rally-surface)]/95 px-2 py-1.5 backdrop-blur md:hidden">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTab(tab.id)}
                  data-testid={`nav_${tab.id}`}
                  className={`flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                      : 'text-[var(--rally-on-surface-variant)]'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* AI Coordinator Slide-over Drawer */}
          <AiCoordinatorSheet
            open={showAiSheet}
            onClose={() => setShowAiSheet(false)}
            ai={ai}
            workspaceState={state}
            workspaceActions={actions}
          />
        </div>
      )}

      {/* Personal Colors & Background Modal (Accessible to Every User) */}
      <PersonalAppearanceModal
        open={showAppearanceModal}
        onClose={() => setShowAppearanceModal(false)}
        appearance={state.personalAppearance}
        isBusy={state.isBusy}
        onUpdate={(patch) => void actions.updatePersonalAppearance(patch)}
        onReset={() => void actions.resetPersonalAppearance()}
      />

      {/* Required Contact Info Onboarding Modal for Google Users Missing Cell Phone */}
      {needsGooglePhoneOnboarding && (
        <GooglePhoneOnboardingModal
          defaultName={state.currentUserName}
          email={state.currentUserEmail}
          isBusy={state.isBusy}
          onSave={async (name, phone, smsEnabled) => {
            await actions.saveSmsPreferences(
              {
                phone,
                enabled: smsEnabled,
                forMessages: true,
                forEvents: true,
              },
              name
            );
          }}
          onSignOut={onSignOut}
        />
      )}

      {/* In-App Event Reminder Notifications */}
      {state.inAppNotifications.length > 0 && (
        <div
          data-testid="in_app_notification_container"
          aria-live="polite"
          className="fixed right-4 top-16 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5"
        >
          {state.inAppNotifications.map((notif) => (
            <div
              key={notif.id}
              role="alert"
              data-testid={`in_app_reminder_toast_${notif.itemId}`}
              className="rounded-2xl border border-[var(--rally-secondary)]/45 bg-[var(--rally-surface)] p-3.5 text-[var(--rally-on-surface)] shadow-xl ring-1 ring-black/5 backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-secondary-container)] text-[var(--rally-secondary)]">
                  <BellRing className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold leading-snug">
                    {notif.title}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--rally-on-surface-variant)]">
                    {notif.body}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {notif.eventId && state.activeGroup && (
                      <button
                        type="button"
                        onClick={() => {
                          actions.selectEvent(notif.eventId);
                          setSelectedTab('calendar');
                          actions.dismissInAppNotification(notif.id);
                        }}
                        data-testid={`open_event_from_notif_${notif.itemId}`}
                        className="rounded-lg bg-[var(--rally-secondary)] px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110"
                      >
                        Open Event
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => actions.dismissInAppNotification(notif.id)}
                      data-testid={`dismiss_in_app_notif_${notif.itemId}`}
                      className="rounded-lg border border-[var(--rally-outline)] px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => actions.dismissInAppNotification(notif.id)}
                  aria-label="Dismiss reminder alert"
                  className="rounded-lg p-1 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snackbar / Toast Banner */}
      {state.bannerMessage && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-slate-800 md:bottom-6"
        >
          <span>{state.bannerMessage}</span>
          <button
            type="button"
            onClick={actions.clearBanner}
            aria-label="Dismiss notification"
            className="rounded-lg p-1 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function GooglePhoneOnboardingModal({
  defaultName,
  email,
  isBusy,
  onSave,
  onSignOut,
}: {
  defaultName: string;
  email: string | null;
  isBusy: boolean;
  onSave: (name: string, phone: string, smsEnabled: boolean) => Promise<void>;
  onSignOut: () => void;
}) {
  const [nameInput, setNameInput] = useState(defaultName);
  const [phoneInput, setPhoneInput] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const normalizedPhone = phoneInput.trim() ? normalizePhoneInput(phoneInput) : '';
  const isPhoneValid = E164_PHONE_REGEX.test(normalizedPhone);
  const canSubmit = !isBusy && nameInput.trim().length >= 2 && isPhoneValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!isPhoneValid) {
      setErrorMsg('Please enter a valid cell phone number (e.g. (555) 123-4567).');
      return;
    }
    setErrorMsg(null);
    await onSave(nameInput.trim(), normalizedPhone, smsEnabled);
  };

  return (
    <ModalDialog
      open
      onClose={() => {}}
      title="Complete Your Contact Info"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            Sign Out
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={(e) => void handleSubmit(e)}
            data-testid="onboarding_save_phone_button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Save &amp; Continue</span>
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
        <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
          Add your cell phone number so your group&apos;s Creator and Admins can see your contact
          information and send SMS updates.
          {email && (
            <span className="mt-1 block font-medium text-[var(--rally-on-surface)]">
              Signed in as {email}
            </span>
          )}
        </p>

        {errorMsg && (
          <div className="rounded-xl bg-[var(--rally-secondary-container)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-secondary-container)]">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Your Full Name <span className="text-[var(--rally-secondary)]">*</span>
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value.slice(0, 50))}
            placeholder="Your full name"
            data-testid="onboarding_name_input"
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
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.slice(0, 24))}
              placeholder="(555) 123-4567"
              data-testid="onboarding_phone_input"
              className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2.5 pl-9 pr-3.5 font-mono-code text-sm focus:border-[var(--rally-primary)] focus:outline-none"
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--rally-on-surface-variant)]">
            10-digit US numbers auto-format to +1; international numbers start with +.
          </p>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/30 p-3 text-xs font-semibold">
          <span>Enable SMS text updates for events &amp; announcements</span>
          <input
            type="checkbox"
            checked={smsEnabled}
            onChange={(e) => setSmsEnabled(e.target.checked)}
            data-testid="onboarding_sms_toggle"
            className="h-4 w-4 accent-[var(--rally-primary)]"
          />
        </label>
      </form>
    </ModalDialog>
  );
}

export default App;
