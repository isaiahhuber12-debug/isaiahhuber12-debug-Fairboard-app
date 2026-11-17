import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
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
import { getAppBackgroundPresentation } from './lib/backgrounds';
import { useAiCoordinator } from './hooks/useAiCoordinator';
import { useRallyWorkspace } from './hooks/useRallyWorkspace';
import { type HubTab, ROLE_META } from './types/rally';
import { GroupAvatar, OfflineStatusBadge, RoleBadge } from './components/RallyComponents';
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

function readStoredPendingJoin(): { code: string; displayName: string | null } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_JOIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; displayName?: unknown };
    if (typeof parsed.code === 'string' && parsed.code.trim()) {
      return {
        code: parsed.code.trim(),
        displayName:
          typeof parsed.displayName === 'string' && parsed.displayName.trim()
            ? parsed.displayName.trim()
            : null,
      };
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function writeStoredPendingJoin(join: { code: string; displayName: string | null } | null): void {
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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showApkAuthHelp, setShowApkAuthHelp] = useState(() => isEmbeddedWebView());
  const [pendingJoin, setPendingJoin] = useState<{
    code: string;
    displayName: string | null;
  } | null>(() => readStoredPendingJoin());

  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Sync Tailwind dark class with system preference
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.classList.toggle('dark', media.matches);
    const onChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
      setIsDarkMode(e.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          const restored = readStoredPendingJoin();
          if (restored) setPendingJoin(restored);
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
    async (nextPendingJoin: { code: string; displayName: string | null } | null) => {
      setAuthError(null);
      if (isUnsupportedSchemeForFirebaseAuth()) {
        setShowApkAuthHelp(true);
        setAuthError(
          'Google Sign-In cannot run from a local file:// or custom APK scheme. Load the hosted HTTPS app URL in Chrome or package the app as a Trusted Web Activity (TWA).'
        );
        return;
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
    async (nextPendingJoin: { code: string; displayName: string | null } | null) => {
      setAuthError(null);
      if (isUnsupportedSchemeForFirebaseAuth()) {
        setShowApkAuthHelp(true);
        setAuthError(
          'Google Sign-In cannot run from a local file:// or custom APK scheme. Load the hosted HTTPS app URL in Chrome or package the app as a Trusted Web Activity (TWA).'
        );
        return;
      }

      if (isEmbeddedWebView()) {
        setShowApkAuthHelp(true);
        await triggerRedirectSignIn(nextPendingJoin);
        return;
      }

      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
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
          await triggerRedirectSignIn(nextPendingJoin);
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

  const handleJoinWithCodeWithGoogle = useCallback(
    async (code: string, displayName: string) => {
      const nextJoin = {
        code,
        displayName: displayName.trim() || null,
      };
      setPendingJoin(nextJoin);
      await handleGoogleSignIn(nextJoin);
    },
    [handleGoogleSignIn]
  );

  const handleStandardGoogleSignIn = useCallback(async () => {
    setPendingJoin(null);
    writeStoredPendingJoin(null);
    await handleGoogleSignIn(null);
  }, [handleGoogleSignIn]);

  const handleRedirectGoogleSignIn = useCallback(async () => {
    await triggerRedirectSignIn(pendingJoin);
  }, [pendingJoin, triggerRedirectSignIn]);

  const handleSignOut = useCallback(async () => {
    setPendingJoin(null);
    writeStoredPendingJoin(null);
    setAuthError(null);
    await signOut(auth);
  }, []);

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

  if (!user) {
    return (
      <AuthAndJoinScreen
        onJoinWithCodeWithGoogle={handleJoinWithCodeWithGoogle}
        onStandardGoogleSignIn={handleStandardGoogleSignIn}
        onRedirectGoogleSignIn={handleRedirectGoogleSignIn}
        showApkHelp={showApkAuthHelp}
        authError={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  return (
    <CloudWorkspaceHost
      key={user.uid}
      user={user}
      isDarkMode={isDarkMode}
      pendingJoin={pendingJoin}
      onPendingJoinConsumed={() => {
        writeStoredPendingJoin(null);
        setPendingJoin(null);
      }}
      onSignOut={() => void handleSignOut()}
    />
  );
}

function CloudWorkspaceHost({
  user,
  isDarkMode,
  pendingJoin,
  onPendingJoinConsumed,
  onSignOut,
}: {
  user: User;
  isDarkMode: boolean;
  pendingJoin: { code: string; displayName: string | null } | null;
  onPendingJoinConsumed: () => void;
  onSignOut: () => void;
}) {
  const { state, actions } = useRallyWorkspace(user, pendingJoin, onPendingJoinConsumed);
  const ai = useAiCoordinator();

  const [selectedTab, setSelectedTab] = useState<HubTab>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<AdminPanelSubTab>('controls');
  const [showAiSheet, setShowAiSheet] = useState(false);

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

  const appBg = useMemo(
    () => getAppBackgroundPresentation(state.appBackground, isDarkMode),
    [state.appBackground, isDarkMode]
  );

  const rootStyle = useMemo(
    () =>
      ({
        ...appBg.style,
        '--rally-canvas-text': appBg.isDarkCanvas ? '#F1F5F9' : '#111827',
        '--rally-canvas-text-muted': appBg.isDarkCanvas ? '#CBD5E1' : '#4B5565',
      }) as React.CSSProperties,
    [appBg]
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
          className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-slate-800 md:bottom-6"
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

export default App;
