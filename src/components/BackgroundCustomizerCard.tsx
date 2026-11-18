import React, { useMemo, useState } from 'react';
import { Check, Monitor, Moon, Palette, RotateCcw, Sun, UserCheck } from 'lucide-react';
import {
  APP_BACKGROUND_PRESETS,
  COLOR_THEME_PRESETS,
  type ColorModePreference,
  DEFAULT_PERSONAL_APPEARANCE,
  describeBackgroundSpec,
  describeColorTheme,
  getPersonalBannerPresentation,
  GROUP_BACKGROUND_PRESETS,
  type PersonalAppearance,
  resolveColorThemeHexPair,
} from '../lib/backgrounds';
import { ModalDialog } from './RallyComponents';

interface PersonalAppearanceControlsProps {
  appearance: PersonalAppearance;
  isBusy?: boolean;
  onUpdate: (patch: Partial<PersonalAppearance>) => void;
  onReset: () => void;
}

function PersonalAppearanceControls({
  appearance,
  isBusy = false,
  onUpdate,
  onReset,
}: PersonalAppearanceControlsProps) {
  const [activeTab, setActiveTab] = useState<'colors' | 'backdrop' | 'banner'>('colors');

  const currentHexPair = useMemo(
    () => resolveColorThemeHexPair(appearance.colorTheme),
    [appearance.colorTheme]
  );

  const [customPrimary, setCustomPrimary] = useState<string>(currentHexPair.primaryHex);
  const [customSecondary, setCustomSecondary] = useState<string>(currentHexPair.secondaryHex);

  const [appSolidColor, setAppSolidColor] = useState('#EEF4FF');
  const [appGradStart, setAppGradStart] = useState('#EEF4FF');
  const [appGradEnd, setAppGradEnd] = useState('#FDF2F8');

  const [bannerSolidColor, setBannerSolidColor] = useState(currentHexPair.primaryHex);
  const [bannerGradStart, setBannerGradStart] = useState(currentHexPair.primaryHex);
  const [bannerGradEnd, setBannerGradEnd] = useState(currentHexPair.secondaryHex);

  const bannerPreview = useMemo(
    () => getPersonalBannerPresentation(appearance),
    [appearance]
  );

  const isCustomized =
    appearance.colorTheme !== DEFAULT_PERSONAL_APPEARANCE.colorTheme ||
    appearance.colorMode !== DEFAULT_PERSONAL_APPEARANCE.colorMode ||
    appearance.appBackground !== DEFAULT_PERSONAL_APPEARANCE.appBackground ||
    appearance.bannerBackground !== DEFAULT_PERSONAL_APPEARANCE.bannerBackground;

  const modeOptions: Array<{
    id: ColorModePreference;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'system', label: 'System', icon: Monitor },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div className="space-y-4" data-testid="personal_appearance_controls">
      {/* Personal Isolation Notice + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/35 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[var(--rally-on-surface-variant)]">
          <UserCheck className="h-4 w-4 shrink-0 text-[var(--rally-primary)]" />
          <span>
            Personal to you — changes only your colors and background, never other members&apos; apps.
          </span>
        </div>
        {isCustomized && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onReset}
            data-testid="reset_personal_appearance_button"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/60 disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset My Theme</span>
          </button>
        )}
      </div>

      {/* Live Personal Preview */}
      <div
        data-testid="personal_banner_preview"
        style={bannerPreview.style}
        className={`rounded-2xl p-4 shadow-xs ${
          bannerPreview.isLightBg ? 'text-slate-900' : 'text-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-90">
          <span>
            Colors: <strong>{describeColorTheme(appearance.colorTheme)}</strong> · Backdrop:{' '}
            <strong>{describeBackgroundSpec(appearance.appBackground)}</strong>
          </span>
          <span className="capitalize">{appearance.colorMode} mode</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-base font-bold">Your Personal RallyHub Theme</div>
            <div className="text-xs opacity-85">
              Banner: {describeBackgroundSpec(appearance.bannerBackground)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
              style={{ backgroundColor: currentHexPair.primaryHex }}
            >
              Primary Button
            </span>
            <span
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
              style={{ backgroundColor: currentHexPair.secondaryHex }}
            >
              Accent
            </span>
          </div>
        </div>
      </div>

      {/* Display Mode Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface)] p-3">
        <div>
          <div className="text-xs font-bold text-[var(--rally-on-surface)]">Display Mode</div>
          <div className="text-[11px] text-[var(--rally-on-surface-variant)]">
            Choose light, dark, or match your device setting
          </div>
        </div>
        <div className="flex rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/45 p-0.5">
          {modeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = appearance.colorMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isBusy}
                onClick={() => onUpdate({ colorMode: opt.id })}
                data-testid={`color_mode_${opt.id}`}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--rally-primary)] text-white shadow-2xs'
                    : 'text-[var(--rally-on-surface-variant)] hover:text-[var(--rally-on-surface)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Switcher: Accent Colors | App Backdrop | Banner Style */}
      <div className="flex rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/45 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('colors')}
          data-testid="personal_tab_colors"
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeTab === 'colors'
              ? 'bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-2xs'
              : 'text-[var(--rally-on-surface-variant)] hover:text-[var(--rally-on-surface)]'
          }`}
        >
          My Colors
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backdrop')}
          data-testid="personal_tab_backdrop"
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeTab === 'backdrop'
              ? 'bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-2xs'
              : 'text-[var(--rally-on-surface-variant)] hover:text-[var(--rally-on-surface)]'
          }`}
        >
          App Background
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          data-testid="personal_tab_banner"
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeTab === 'banner'
              ? 'bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-2xs'
              : 'text-[var(--rally-on-surface-variant)] hover:text-[var(--rally-on-surface)]'
          }`}
        >
          Banner Style
        </button>
      </div>

      {/* TAB 1: MY COLORS */}
      {activeTab === 'colors' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {COLOR_THEME_PRESETS.map((preset) => {
              const selected = appearance.colorTheme === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setCustomPrimary(preset.primaryHex);
                    setCustomSecondary(preset.secondaryHex);
                    onUpdate({ colorTheme: preset.id });
                  }}
                  data-testid={`color_theme_preset_${preset.id}`}
                  className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition ${
                    selected
                      ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)]/35 ring-1 ring-[var(--rally-primary)]'
                      : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-6 w-6 rounded-lg border border-black/10 shadow-2xs"
                        style={{ backgroundColor: preset.primaryHex }}
                      />
                      <span
                        className="h-5 w-5 rounded-md border border-black/10 shadow-2xs"
                        style={{ backgroundColor: preset.secondaryHex }}
                      />
                    </div>
                    {selected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--rally-primary)] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="truncate text-xs font-bold text-[var(--rally-on-surface)]">
                      {preset.label}
                    </div>
                    <div className="truncate text-[11px] text-[var(--rally-on-surface-variant)]">
                      {preset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Primary & Secondary Color Pickers */}
          <div className="rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/25 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[var(--rally-on-surface)]">
                  Custom Personal Colors
                </div>
                <div className="text-[11px] text-[var(--rally-on-surface-variant)]">
                  Pick your own primary button color and secondary highlight color
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--rally-on-surface)]">
                  <span>Primary</span>
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    aria-label="Custom primary accent color"
                    data-testid="personal_primary_color_input"
                    className="h-9 w-11 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--rally-on-surface)]">
                  <span>Secondary</span>
                  <input
                    type="color"
                    value={customSecondary}
                    onChange={(e) => setCustomSecondary(e.target.value)}
                    aria-label="Custom secondary accent color"
                    data-testid="personal_secondary_color_input"
                    className="h-9 w-11 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                  />
                </label>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdate({
                      colorTheme: `dual:${customPrimary.toUpperCase()}:${customSecondary.toUpperCase()}`,
                    })
                  }
                  data-testid="apply_custom_colors_button"
                  className="whitespace-nowrap rounded-xl bg-[var(--rally-primary)] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
                >
                  Apply Colors
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APP BACKGROUND */}
      {activeTab === 'backdrop' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {/* Dynamic Theme Tint Option */}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onUpdate({ appBackground: 'theme' })}
              data-testid="app_bg_preset_theme"
              className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                appearance.appBackground === 'theme'
                  ? 'border-[var(--rally-primary)] ring-2 ring-[var(--rally-primary)]/30'
                  : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
              }`}
            >
              <div
                className="relative h-12 w-full border-b border-[var(--rally-outline)]/40"
                style={{
                  background: `linear-gradient(135deg, ${currentHexPair.primaryHex}22 0%, ${currentHexPair.secondaryHex}22 100%)`,
                }}
              >
                {appearance.appBackground === 'theme' && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--rally-primary)] text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <div className="truncate text-xs font-bold text-[var(--rally-on-surface)]">
                  Match My Accent
                </div>
                <div className="truncate text-[11px] text-[var(--rally-on-surface-variant)]">
                  Soft tint from your colors
                </div>
              </div>
            </button>

            {APP_BACKGROUND_PRESETS.map((preset) => {
              const selected = appearance.appBackground === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onUpdate({ appBackground: preset.id })}
                  data-testid={`app_bg_preset_${preset.id}`}
                  className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                    selected
                      ? 'border-[var(--rally-primary)] ring-2 ring-[var(--rally-primary)]/30'
                      : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
                  }`}
                >
                  <div
                    className="relative h-12 w-full border-b border-[var(--rally-outline)]/40"
                    style={preset.previewStyle}
                  >
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--rally-primary)] text-white shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-xs font-bold text-[var(--rally-on-surface)]">
                      {preset.label}
                    </div>
                    <div className="truncate text-[11px] text-[var(--rally-on-surface-variant)]">
                      {preset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Solid & Gradient App Backdrop */}
          <div className="grid gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/25 p-3.5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--rally-on-surface)]">
                Custom Solid Background
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={appSolidColor}
                  onChange={(e) => setAppSolidColor(e.target.value)}
                  aria-label="Custom solid app background color"
                  data-testid="app_bg_solid_color_input"
                  className="h-9 w-11 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="font-mono-code text-xs text-[var(--rally-on-surface-variant)]">
                  {appSolidColor.toUpperCase()}
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onUpdate({ appBackground: `solid:${appSolidColor.toUpperCase()}` })}
                  data-testid="apply_app_solid_bg_button"
                  className="ml-auto whitespace-nowrap rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-45"
                >
                  Apply Solid
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--rally-on-surface)]">
                Custom Gradient Background
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={appGradStart}
                  onChange={(e) => setAppGradStart(e.target.value)}
                  aria-label="App background gradient start color"
                  className="h-9 w-10 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="text-xs text-[var(--rally-on-surface-variant)]">→</span>
                <input
                  type="color"
                  value={appGradEnd}
                  onChange={(e) => setAppGradEnd(e.target.value)}
                  aria-label="App background gradient end color"
                  className="h-9 w-10 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdate({
                      appBackground: `gradient:${appGradStart.toUpperCase()}:${appGradEnd.toUpperCase()}`,
                    })
                  }
                  data-testid="apply_app_gradient_bg_button"
                  className="ml-auto whitespace-nowrap rounded-xl border border-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50 disabled:opacity-45"
                >
                  Apply Gradient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BANNER & CARD STYLE */}
      {activeTab === 'banner' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {/* Match Personal Accent Option */}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onUpdate({ bannerBackground: 'theme' })}
              data-testid="banner_bg_preset_theme"
              className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                appearance.bannerBackground === 'theme'
                  ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)]/35 ring-1 ring-[var(--rally-primary)]'
                  : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
              }`}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
                style={{
                  background: `linear-gradient(135deg, ${currentHexPair.primaryHex} 0%, ${currentHexPair.secondaryHex} 100%)`,
                }}
              >
                {appearance.bannerBackground === 'theme' && <Check className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-[var(--rally-on-surface)]">
                  Match My Accent
                </div>
                <div className="truncate text-[11px] text-[var(--rally-on-surface-variant)]">
                  Follows your color theme
                </div>
              </div>
            </button>

            {GROUP_BACKGROUND_PRESETS.map((preset) => {
              const selected = appearance.bannerBackground === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onUpdate({ bannerBackground: preset.id })}
                  data-testid={`group_bg_preset_${preset.id}`}
                  className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                    selected
                      ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)]/35 ring-1 ring-[var(--rally-primary)]'
                      : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
                  }`}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
                    style={preset.previewStyle}
                  >
                    {selected && <Check className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-[var(--rally-on-surface)]">
                      {preset.label}
                    </div>
                    <div className="truncate text-[11px] text-[var(--rally-on-surface-variant)]">
                      {preset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/25 p-3.5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--rally-on-surface)]">
                Custom Solid Banner
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bannerSolidColor}
                  onChange={(e) => setBannerSolidColor(e.target.value)}
                  aria-label="Custom solid banner color"
                  data-testid="group_bg_solid_color_input"
                  className="h-9 w-11 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="font-mono-code text-xs text-[var(--rally-on-surface-variant)]">
                  {bannerSolidColor.toUpperCase()}
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdate({ bannerBackground: `solid:${bannerSolidColor.toUpperCase()}` })
                  }
                  data-testid="apply_group_solid_bg_button"
                  className="ml-auto whitespace-nowrap rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-45"
                >
                  Apply Solid
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[var(--rally-on-surface)]">
                Custom Gradient Banner
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bannerGradStart}
                  onChange={(e) => setBannerGradStart(e.target.value)}
                  aria-label="Banner gradient start color"
                  className="h-9 w-10 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="text-xs text-[var(--rally-on-surface-variant)]">→</span>
                <input
                  type="color"
                  value={bannerGradEnd}
                  onChange={(e) => setBannerGradEnd(e.target.value)}
                  aria-label="Banner gradient end color"
                  className="h-9 w-10 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdate({
                      bannerBackground: `gradient:${bannerGradStart.toUpperCase()}:${bannerGradEnd.toUpperCase()}`,
                    })
                  }
                  data-testid="apply_group_gradient_bg_button"
                  className="ml-auto whitespace-nowrap rounded-xl border border-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50 disabled:opacity-45"
                >
                  Apply Gradient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface PersonalAppearanceCardProps {
  appearance: PersonalAppearance;
  isBusy?: boolean;
  onUpdate: (patch: Partial<PersonalAppearance>) => void;
  onReset: () => void;
}

export function PersonalAppearanceCard({
  appearance,
  isBusy,
  onUpdate,
  onReset,
}: PersonalAppearanceCardProps) {
  return (
    <section
      data-testid="personal_appearance_card"
      className="space-y-4 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">Your Colors &amp; Background</h2>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            Customize how RallyHub looks on your account without changing any other member&apos;s
            view.
          </p>
        </div>
      </div>

      <PersonalAppearanceControls
        appearance={appearance}
        isBusy={isBusy}
        onUpdate={onUpdate}
        onReset={onReset}
      />
    </section>
  );
}

export function PersonalAppearanceModal({
  open,
  onClose,
  appearance,
  isBusy,
  onUpdate,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  appearance: PersonalAppearance;
  isBusy?: boolean;
  onUpdate: (patch: Partial<PersonalAppearance>) => void;
  onReset: () => void;
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Your Colors & Background"
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            data-testid="close_personal_appearance_modal_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            Done
          </button>
        </div>
      }
    >
      <PersonalAppearanceControls
        appearance={appearance}
        isBusy={isBusy}
        onUpdate={onUpdate}
        onReset={onReset}
      />
    </ModalDialog>
  );
}
