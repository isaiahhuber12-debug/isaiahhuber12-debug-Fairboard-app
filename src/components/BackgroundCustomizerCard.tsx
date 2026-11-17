import React, { useMemo, useState } from 'react';
import { Check, Palette, RotateCcw, Sparkles } from 'lucide-react';
import {
  APP_BACKGROUND_PRESETS,
  describeBackgroundSpec,
  getGroupBackgroundPresentation,
  GROUP_BACKGROUND_PRESETS,
} from '../lib/backgrounds';
import { type JoinedGroupRef, MemberRole, parseMemberRole, type RallyGroup } from '../types/rally';

interface BackgroundCustomizerCardProps {
  activeGroup: RallyGroup;
  joinedGroups: JoinedGroupRef[];
  appBackground: string;
  groupBackgroundsById: Record<string, string>;
  isBusy: boolean;
  onUpdateAppBackground: (spec: string) => void;
  onUpdateGroupBackground: (groupId: string, spec: string) => void;
}

export function BackgroundCustomizerCard({
  activeGroup,
  joinedGroups,
  appBackground,
  groupBackgroundsById,
  isBusy,
  onUpdateAppBackground,
  onUpdateGroupBackground,
}: BackgroundCustomizerCardProps) {
  const [section, setSection] = useState<'app' | 'group'>('app');

  // Groups this user administers (always includes activeGroup since they are in Admin Panel)
  const adminGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    map.set(activeGroup.id, {
      id: activeGroup.id,
      name: activeGroup.name,
      code: activeGroup.groupCode,
    });
    for (const g of joinedGroups) {
      const role = parseMemberRole(g.role);
      if ((role === MemberRole.CREATOR || role === MemberRole.ADMIN) && !map.has(g.groupId)) {
        map.set(g.groupId, {
          id: g.groupId,
          name: g.groupName,
          code: g.groupCode,
        });
      }
    }
    return Array.from(map.values());
  }, [activeGroup.id, activeGroup.name, activeGroup.groupCode, joinedGroups]);

  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>(activeGroup.id);
  const resolvedTargetGroup =
    adminGroups.find((g) => g.id === selectedTargetGroupId) ?? adminGroups[0];

  const currentGroupBgSpec =
    resolvedTargetGroup.id === activeGroup.id
      ? (activeGroup.groupBackground ?? groupBackgroundsById[activeGroup.id] ?? 'default')
      : (groupBackgroundsById[resolvedTargetGroup.id] ??
        joinedGroups.find((g) => g.groupId === resolvedTargetGroup.id)?.groupBackground ??
        'default');

  const [appSolidColor, setAppSolidColor] = useState('#EEF4FF');
  const [appGradStart, setAppGradStart] = useState('#EEF4FF');
  const [appGradEnd, setAppGradEnd] = useState('#FDF2F8');

  const [groupSolidColor, setGroupSolidColor] = useState('#1B4DFF');
  const [groupGradStart, setGroupGradStart] = useState('#1B4DFF');
  const [groupGradEnd, setGroupGradEnd] = useState('#7C3AED');

  const groupPreview = useMemo(
    () => getGroupBackgroundPresentation(currentGroupBgSpec),
    [currentGroupBgSpec]
  );

  return (
    <section
      data-testid="admin_background_customizer"
      className="space-y-4 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Background &amp; Appearance</h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Customize the main app interface backdrop and individual group banner themes.
            </p>
          </div>
        </div>

        <div className="flex rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/45 p-0.5">
          <button
            type="button"
            onClick={() => setSection('app')}
            data-testid="bg_tab_app"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              section === 'app'
                ? 'bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-xs'
                : 'text-[var(--rally-on-surface-variant)]'
            }`}
          >
            Main App Interface
          </button>
          <button
            type="button"
            onClick={() => setSection('group')}
            data-testid="bg_tab_group"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              section === 'group'
                ? 'bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-xs'
                : 'text-[var(--rally-on-surface-variant)]'
            }`}
          >
            Group Banners
          </button>
        </div>
      </div>

      {section === 'app' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-surface-variant)]/35 px-3.5 py-2.5">
            <div className="text-xs">
              <span className="text-[var(--rally-on-surface-variant)]">Active App Backdrop: </span>
              <span className="font-semibold text-[var(--rally-on-surface)]">
                {describeBackgroundSpec(appBackground)}
              </span>
            </div>
            {appBackground !== 'default' && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onUpdateAppBackground('default')}
                data-testid="reset_app_background_button"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/60 disabled:opacity-45"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Default</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {APP_BACKGROUND_PRESETS.map((preset) => {
              const selected = appBackground === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onUpdateAppBackground(preset.id)}
                  data-testid={`app_bg_preset_${preset.id}`}
                  className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                    selected
                      ? 'border-[var(--rally-primary)] ring-2 ring-[var(--rally-primary)]/30'
                      : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
                  }`}
                >
                  <div
                    className="relative h-14 w-full border-b border-[var(--rally-outline)]/40"
                    style={preset.previewStyle}
                  >
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--rally-primary)] text-white shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-[var(--rally-on-surface)]">
                      {preset.label}
                    </div>
                    <div className="line-clamp-1 text-[11px] text-[var(--rally-on-surface-variant)]">
                      {preset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Color & Gradient Controls */}
          <div className="grid gap-3 rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-surface-variant)]/25 p-3.5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Custom Solid Color
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={appSolidColor}
                  onChange={(e) => setAppSolidColor(e.target.value)}
                  aria-label="Custom solid app background color"
                  data-testid="app_bg_solid_color_input"
                  className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="font-mono-code text-xs text-[var(--rally-on-surface-variant)]">
                  {appSolidColor.toUpperCase()}
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onUpdateAppBackground(`solid:${appSolidColor.toUpperCase()}`)}
                  data-testid="apply_app_solid_bg_button"
                  className="ml-auto rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-45"
                >
                  Apply Solid
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Custom Gradient
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
                    onUpdateAppBackground(
                      `gradient:${appGradStart.toUpperCase()}:${appGradEnd.toUpperCase()}`
                    )
                  }
                  data-testid="apply_app_gradient_bg_button"
                  className="ml-auto rounded-xl border border-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50 disabled:opacity-45"
                >
                  Apply Gradient
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group Target Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-semibold text-[var(--rally-on-surface-variant)]">
                Target Group
              </label>
              <select
                value={resolvedTargetGroup.id}
                onChange={(e) => setSelectedTargetGroupId(e.target.value)}
                data-testid="bg_target_group_select"
                className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/40 px-3 py-2 text-sm font-medium focus:border-[var(--rally-primary)] focus:outline-none"
              >
                {adminGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code}){g.id === activeGroup.id ? ' — Current' : ''}
                  </option>
                ))}
              </select>
            </div>
            {currentGroupBgSpec !== 'default' && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onUpdateGroupBackground(resolvedTargetGroup.id, 'default')}
                data-testid="reset_group_background_button"
                className="mt-5 inline-flex items-center gap-1 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/40 disabled:opacity-45"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Group Theme</span>
              </button>
            )}
          </div>

          {/* Live Group Banner Preview */}
          <div
            data-testid="group_background_preview"
            style={groupPreview.style}
            className={`rounded-2xl p-4 shadow-sm ${
              groupPreview.isLightBg ? 'text-slate-900' : 'text-white'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold opacity-85">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Group Banner Preview
              </span>
              <span>{describeBackgroundSpec(currentGroupBgSpec)}</span>
            </div>
            <div className="mt-1 font-display text-lg font-bold">{resolvedTargetGroup.name}</div>
            <div className="text-xs opacity-85">Code: {resolvedTargetGroup.code}</div>
          </div>

          {/* Group Preset Themes */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {GROUP_BACKGROUND_PRESETS.map((preset) => {
              const selected = currentGroupBgSpec === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onUpdateGroupBackground(resolvedTargetGroup.id, preset.id)}
                  data-testid={`group_bg_preset_${preset.id}`}
                  className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                    selected
                      ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)]/35 ring-1 ring-[var(--rally-primary)]'
                      : 'border-[var(--rally-outline)]/70 hover:border-[var(--rally-primary)]/50'
                  }`}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
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

          {/* Custom Group Solid & Gradient Controls */}
          <div className="grid gap-3 rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-surface-variant)]/25 p-3.5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Custom Group Solid
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={groupSolidColor}
                  onChange={(e) => setGroupSolidColor(e.target.value)}
                  aria-label="Custom solid group background color"
                  data-testid="group_bg_solid_color_input"
                  className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="font-mono-code text-xs text-[var(--rally-on-surface-variant)]">
                  {groupSolidColor.toUpperCase()}
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdateGroupBackground(
                      resolvedTargetGroup.id,
                      `solid:${groupSolidColor.toUpperCase()}`
                    )
                  }
                  data-testid="apply_group_solid_bg_button"
                  className="ml-auto rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-45"
                >
                  Apply Solid
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                Custom Group Gradient
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={groupGradStart}
                  onChange={(e) => setGroupGradStart(e.target.value)}
                  aria-label="Group background gradient start color"
                  className="h-9 w-10 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <span className="text-xs text-[var(--rally-on-surface-variant)]">→</span>
                <input
                  type="color"
                  value={groupGradEnd}
                  onChange={(e) => setGroupGradEnd(e.target.value)}
                  aria-label="Group background gradient end color"
                  className="h-9 w-10 cursor-pointer rounded-lg border border-[var(--rally-outline)] bg-transparent p-0.5"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    onUpdateGroupBackground(
                      resolvedTargetGroup.id,
                      `gradient:${groupGradStart.toUpperCase()}:${groupGradEnd.toUpperCase()}`
                    )
                  }
                  data-testid="apply_group_gradient_bg_button"
                  className="ml-auto rounded-xl border border-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50 disabled:opacity-45"
                >
                  Apply Gradient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
