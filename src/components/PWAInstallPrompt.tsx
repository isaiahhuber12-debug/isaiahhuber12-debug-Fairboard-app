import React, { useState } from 'react';
import {
  BellRing,
  Check,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { type PwaPlatform, usePWAInstall } from '../hooks/usePWAInstall';
import { ModalDialog } from './RallyComponents';

export function HomeScreenPushBanner() {
  const {
    platform,
    isIOS,
    isAndroid,
    isInstallable,
    isInstalled,
    notifPermission,
    showWebsiteBanner,
    install,
    dismissBanner,
    triggerHomeScreenPushNotification,
  } = usePWAInstall();

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  if (isInstalled) {
    return null;
  }

  const handlePrimaryInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    setShowGuideModal(true);
  };

  const handleSendPush = async () => {
    const res = await triggerHomeScreenPushNotification();
    if (res.sent) {
      setPushFeedback('Push notification sent! Follow it to add RallyHub to your home screen.');
    } else if (res.permission === 'denied') {
      setPushFeedback('Browser notifications are blocked—use the step-by-step guide below.');
    } else if (res.permission === 'unsupported') {
      setPushFeedback(
        isIOS
          ? 'On iOS Safari, tap Share -> Add to Home Screen first to enable iOS push alerts.'
          : 'Notifications are not available in this browser—follow the steps below.'
      );
    }
  };

  const platformBadge = isIOS ? 'iPhone / iPad' : isAndroid ? 'Android' : 'App Ready';
  const subtitle = isIOS
    ? 'Tap Share and "Add to Home Screen" in Safari for full-screen access & push alerts.'
    : isAndroid
      ? isInstallable
        ? 'Install RallyHub on your home screen for one-tap launch and push notifications.'
        : 'Add RallyHub to your Android home screen via Chrome menu (⋮) -> Add to Home screen.'
      : 'Install RallyHub to your device for fast, standalone launch and push notifications.';

  return (
    <>
      {showWebsiteBanner && (
        <div
          role="region"
          aria-label="Add RallyHub to Home Screen notification"
          data-testid="homescreen_push_banner"
          className="fixed bottom-16 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--rally-primary)]/40 bg-[var(--rally-surface)]/95 p-3.5 text-[var(--rally-on-surface)] shadow-2xl ring-1 ring-black/10 backdrop-blur md:bottom-5 md:left-auto md:right-5 md:translate-x-0"
        >
          <div className="flex items-start gap-3">
            <img
              src="/pwa-192x192.png"
              alt="RallyHub app icon"
              className="h-11 w-11 shrink-0 rounded-xl border border-[var(--rally-outline)]/40 object-cover shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-sm font-bold leading-tight">
                  Add RallyHub to Home Screen
                </span>
                <span className="rounded-md bg-[var(--rally-primary-container)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--rally-on-primary-container)]">
                  {platformBadge}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                {subtitle}
              </p>

              {pushFeedback && (
                <p
                  data-testid="homescreen_push_feedback"
                  className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[var(--rally-primary)]"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>{pushFeedback}</span>
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handlePrimaryInstallClick()}
                  data-testid="homescreen_banner_install_button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{isInstallable ? 'Add to Home Screen' : 'How to Add'}</span>
                </button>

                {notifPermission !== 'unsupported' && notifPermission !== 'denied' && (
                  <button
                    type="button"
                    onClick={() => void handleSendPush()}
                    data-testid="homescreen_banner_notify_button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-primary)]/35 bg-[var(--rally-primary-container)]/50 px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    <span>{notifPermission === 'granted' ? 'Send Push Alert' : 'Notify Me'}</span>
                  </button>
                )}

                {isInstallable && (
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="rounded-xl border border-[var(--rally-outline)] px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                  >
                    iOS / Android Steps
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss add to home screen notification"
              data-testid="homescreen_banner_dismiss_button"
              className="rounded-lg p-1 text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <HomeScreenInstallGuideModal
        open={showGuideModal}
        platform={platform}
        isInstallable={isInstallable}
        notifPermission={notifPermission}
        pushFeedback={pushFeedback}
        onInstallNative={() => void install()}
        onSendPush={() => void handleSendPush()}
        onClose={() => setShowGuideModal(false)}
      />
    </>
  );
}

export function PWAInstallButton({
  variant = 'default',
  onLightHeader = false,
}: {
  variant?: 'default' | 'hero';
  onLightHeader?: boolean;
}) {
  const {
    platform,
    isInstallable,
    isInstalled,
    notifPermission,
    install,
    triggerHomeScreenPushNotification,
  } = usePWAInstall();

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    setShowGuideModal(true);
  };

  const handleSendPush = async () => {
    const res = await triggerHomeScreenPushNotification();
    if (res.sent) {
      setPushFeedback('Push notification sent! Check your notifications to add RallyHub.');
    } else if (res.permission === 'denied') {
      setPushFeedback('Notifications are blocked in browser settings—follow the steps below.');
    } else if (res.permission === 'unsupported') {
      setPushFeedback(
        platform === 'ios'
          ? 'On iOS Safari, add RallyHub to your Home Screen first to enable Web Push alerts.'
          : 'Follow the installation steps below to add RallyHub to your Home Screen.'
      );
    }
  };

  const buttonClass =
    variant === 'hero'
      ? onLightHeader
        ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900/10 px-2.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-900/20'
        : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25'
      : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--rally-primary)]/40 bg-[var(--rally-primary-container)]/50 px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95';

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        data-testid="pwa_install_button"
        title="Add RallyHub to your iOS or Android home screen"
        className={buttonClass}
      >
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        <span className={variant === 'hero' ? 'inline' : 'hidden sm:inline'}>
          {isInstallable ? 'Install App' : 'Add App'}
        </span>
      </button>

      <HomeScreenInstallGuideModal
        open={showGuideModal}
        platform={platform}
        isInstallable={isInstallable}
        notifPermission={notifPermission}
        pushFeedback={pushFeedback}
        onInstallNative={() => void install()}
        onSendPush={() => void handleSendPush()}
        onClose={() => setShowGuideModal(false)}
      />
    </>
  );
}

function HomeScreenInstallGuideModal({
  open,
  platform,
  isInstallable,
  notifPermission,
  pushFeedback,
  onInstallNative,
  onSendPush,
  onClose,
}: {
  open: boolean;
  platform: PwaPlatform;
  isInstallable: boolean;
  notifPermission: NotificationPermission | 'unsupported';
  pushFeedback: string | null;
  onInstallNative: () => void;
  onSendPush: () => void;
  onClose: () => void;
}) {
  const [selectedTab, setSelectedTab] = useState<'ios' | 'android'>(
    platform === 'ios' ? 'ios' : 'android'
  );

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Add RallyHub to Home Screen"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {notifPermission !== 'unsupported' && notifPermission !== 'denied' ? (
            <button
              type="button"
              onClick={onSendPush}
              data-testid="modal_send_homescreen_push_button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-primary)]/40 bg-[var(--rally-primary-container)]/50 px-3 py-2 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Send Push Reminder</span>
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {isInstallable && (
              <button
                type="button"
                onClick={onInstallNative}
                data-testid="modal_native_install_button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-secondary)] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install Now</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              Done
            </button>
          </div>
        </div>
      }
    >
      <div data-testid="homescreen_install_guide_modal" className="space-y-3.5">
        <div className="flex gap-2 rounded-xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/35 p-1">
          <button
            type="button"
            onClick={() => setSelectedTab('ios')}
            data-testid="guide_tab_ios"
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedTab === 'ios'
                ? 'bg-[var(--rally-primary)] text-white shadow-sm'
                : 'text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface)]'
            }`}
          >
            iPhone / iPad (iOS)
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('android')}
            data-testid="guide_tab_android"
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedTab === 'android'
                ? 'bg-[var(--rally-primary)] text-white shadow-sm'
                : 'text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface)]'
            }`}
          >
            Android (Chrome)
          </button>
        </div>

        {pushFeedback && (
          <div className="rounded-xl border border-[var(--rally-primary)]/30 bg-[var(--rally-primary-container)]/40 px-3 py-2 text-xs font-semibold text-[var(--rally-on-primary-container)]">
            {pushFeedback}
          </div>
        )}

        {selectedTab === 'ios' ? (
          <ol className="space-y-2.5">
            <li className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                1
              </span>
              <div className="space-y-0.5">
                <div className="font-display text-xs font-bold">Open this site in Safari</div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  Apple only supports Home Screen installation and Web Push notifications from Safari
                  on iPhone &amp; iPad.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                2
              </span>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold">
                  <span>Tap the Share button</span>
                  <Share className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
                </div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  Tap the Share icon at the bottom (iPhone) or top-right (iPad) of the Safari
                  toolbar.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                3
              </span>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold">
                  <span>Tap &quot;Add to Home Screen&quot;</span>
                  <PlusSquare className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
                </div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  Scroll down the Share sheet, choose <strong>Add to Home Screen</strong>, then tap{' '}
                  <strong>Add</strong>. Launch RallyHub from your home screen for full app mode and
                  push alerts.
                </p>
              </div>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2.5">
            <li className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                1
              </span>
              <div className="space-y-0.5">
                <div className="font-display text-xs font-bold">Open in Google Chrome</div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  {isInstallable
                    ? 'Tap "Install Now" below for instant one-tap installation, or use the Chrome menu.'
                    : 'Make sure you are viewing RallyHub in Chrome on your Android device.'}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                2
              </span>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-display text-xs font-bold">
                  <span>Tap the Chrome menu</span>
                  <MoreVertical className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
                </div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  Tap the three-dot menu in the top-right corner of Chrome.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-bg)]/50 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary)] text-xs font-bold text-white">
                3
              </span>
              <div className="space-y-0.5">
                <div className="font-display text-xs font-bold">
                  Select &quot;Add to Home screen&quot; or &quot;Install app&quot;
                </div>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  Confirm the prompt to place RallyHub on your home screen with Google Sign-In and
                  push notifications ready.
                </p>
              </div>
            </li>
          </ol>
        )}
      </div>
    </ModalDialog>
  );
}
