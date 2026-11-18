import type React from 'react';

export type ColorModePreference = 'system' | 'light' | 'dark';

export interface PersonalAppearance {
  colorTheme: string;
  colorMode: ColorModePreference;
  appBackground: string;
  bannerBackground: string;
}

export const DEFAULT_PERSONAL_APPEARANCE: PersonalAppearance = {
  colorTheme: 'default',
  colorMode: 'system',
  appBackground: 'default',
  bannerBackground: 'theme',
};

export interface BackgroundPreset {
  id: string;
  label: string;
  description: string;
  previewStyle: React.CSSProperties;
}

export interface ColorThemePreset {
  id: string;
  label: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
}

export const VALID_COLOR_THEME_REGEX =
  /^(default|emerald|violet|coral|ocean|rose|amber|indigo|custom:#[0-9A-Fa-f]{6}|dual:#[0-9A-Fa-f]{6}:#[0-9A-Fa-f]{6})$/;

export const VALID_COLOR_MODE_REGEX = /^(system|light|dark)$/;

export const VALID_BACKGROUND_REGEX =
  /^(theme|default|ocean-mist|emerald-grove|sunset-warmth|lavender-studio|midnight-canvas|dot-grid|diagonal-weave|emerald|sunset|midnight|royal|teal-ocean|solid:#[0-9A-Fa-f]{6}|gradient:#[0-9A-Fa-f]{6}:#[0-9A-Fa-f]{6})$/;

export const COLOR_THEME_PRESETS: ColorThemePreset[] = [
  {
    id: 'default',
    label: 'Rally Cobalt',
    description: 'Signature cobalt & coral',
    primaryHex: '#1B4DFF',
    secondaryHex: '#FF5A36',
  },
  {
    id: 'emerald',
    label: 'Emerald Forest',
    description: 'Botanical green & warm amber',
    primaryHex: '#0F9D76',
    secondaryHex: '#D97706',
  },
  {
    id: 'violet',
    label: 'Royal Violet',
    description: 'Deep violet & berry rose',
    primaryHex: '#6D28D9',
    secondaryHex: '#E11D48',
  },
  {
    id: 'coral',
    label: 'Sunset Terracotta',
    description: 'Warm sunset & ocean blue',
    primaryHex: '#EA580C',
    secondaryHex: '#0284C7',
  },
  {
    id: 'ocean',
    label: 'Ocean Cerulean',
    description: 'Crisp sea blue & jade',
    primaryHex: '#0284C7',
    secondaryHex: '#0D9488',
  },
  {
    id: 'rose',
    label: 'Crimson Rose',
    description: 'Vibrant rose & indigo',
    primaryHex: '#E11D48',
    secondaryHex: '#4F46E5',
  },
  {
    id: 'amber',
    label: 'Golden Ochre',
    description: 'Rich gold & forest teal',
    primaryHex: '#B45309',
    secondaryHex: '#0F766E',
  },
  {
    id: 'indigo',
    label: 'Midnight Indigo',
    description: 'Architectural indigo & cyan',
    primaryHex: '#4338CA',
    secondaryHex: '#0891B2',
  },
];

export const APP_BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'default',
    label: 'Rally Slate',
    description: 'Clean neutral workspace',
    previewStyle: { background: 'linear-gradient(135deg, #F5F7FB 0%, #E9EEF7 100%)' },
  },
  {
    id: 'ocean-mist',
    label: 'Ocean Mist',
    description: 'Cool sky & slate wash',
    previewStyle: { background: 'linear-gradient(135deg, #EEF4FF 0%, #DFF1FF 100%)' },
  },
  {
    id: 'emerald-grove',
    label: 'Emerald Grove',
    description: 'Fresh mint backdrop',
    previewStyle: { background: 'linear-gradient(135deg, #ECFDF5 0%, #DCF7EE 100%)' },
  },
  {
    id: 'sunset-warmth',
    label: 'Sunset Warmth',
    description: 'Warm amber & peach tint',
    previewStyle: { background: 'linear-gradient(135deg, #FFF3EC 0%, #FEF3DB 100%)' },
  },
  {
    id: 'lavender-studio',
    label: 'Lavender Studio',
    description: 'Soft indigo studio wash',
    previewStyle: { background: 'linear-gradient(135deg, #F3F0FF 0%, #E7EEFF 100%)' },
  },
  {
    id: 'midnight-canvas',
    label: 'Midnight Canvas',
    description: 'Deep obsidian slate',
    previewStyle: { background: 'linear-gradient(135deg, #0B1120 0%, #162033 100%)' },
  },
  {
    id: 'dot-grid',
    label: 'Dot Matrix',
    description: 'Crisp drafting dots',
    previewStyle: {
      backgroundColor: '#F5F7FB',
      backgroundImage: 'radial-gradient(rgba(27, 77, 255, 0.18) 1.25px, transparent 1.25px)',
      backgroundSize: '14px 14px',
    },
  },
  {
    id: 'diagonal-weave',
    label: 'Atelier Grid',
    description: 'Subtle architectural lines',
    previewStyle: {
      backgroundColor: '#F4F6FA',
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(27, 77, 255, 0.06) 0px, rgba(27, 77, 255, 0.06) 1px, transparent 1px, transparent 14px)',
    },
  },
];

export const GROUP_BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'default',
    label: 'Rally Cobalt',
    description: 'Signature blue gradient',
    previewStyle: { background: 'linear-gradient(135deg, #1B4DFF 0%, #1034B8 100%)' },
  },
  {
    id: 'emerald',
    label: 'Emerald Summit',
    description: 'Deep forest green',
    previewStyle: { background: 'linear-gradient(135deg, #0F9D76 0%, #07694E 100%)' },
  },
  {
    id: 'sunset',
    label: 'Sunset Coral',
    description: 'Energetic coral & crimson',
    previewStyle: { background: 'linear-gradient(135deg, #FF5A36 0%, #C83214 100%)' },
  },
  {
    id: 'midnight',
    label: 'Midnight Slate',
    description: 'High-contrast charcoal',
    previewStyle: { background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' },
  },
  {
    id: 'royal',
    label: 'Royal Violet',
    description: 'Vivid violet to indigo',
    previewStyle: { background: 'linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)' },
  },
  {
    id: 'teal-ocean',
    label: 'Deep Lagoon',
    description: 'Cerulean to sea teal',
    previewStyle: { background: 'linear-gradient(135deg, #0284C7 0%, #0F766E 100%)' },
  },
];

export function isValidColorTheme(raw?: string | null): boolean {
  if (!raw) return false;
  return raw.length <= 24 && VALID_COLOR_THEME_REGEX.test(raw);
}

export function isValidColorMode(raw?: string | null): raw is ColorModePreference {
  if (!raw) return false;
  return raw.length <= 10 && VALID_COLOR_MODE_REGEX.test(raw);
}

export function isValidBackgroundSpec(raw?: string | null): boolean {
  if (!raw) return false;
  return raw.length <= 40 && VALID_BACKGROUND_REGEX.test(raw);
}

export function sanitizePersonalAppearance(
  raw?: Partial<PersonalAppearance> | null
): PersonalAppearance {
  return {
    colorTheme:
      raw?.colorTheme && isValidColorTheme(raw.colorTheme)
        ? raw.colorTheme
        : DEFAULT_PERSONAL_APPEARANCE.colorTheme,
    colorMode:
      raw?.colorMode && isValidColorMode(raw.colorMode)
        ? raw.colorMode
        : DEFAULT_PERSONAL_APPEARANCE.colorMode,
    appBackground:
      raw?.appBackground && isValidBackgroundSpec(raw.appBackground)
        ? raw.appBackground
        : DEFAULT_PERSONAL_APPEARANCE.appBackground,
    bannerBackground:
      raw?.bannerBackground && isValidBackgroundSpec(raw.bannerBackground)
        ? raw.bannerBackground
        : DEFAULT_PERSONAL_APPEARANCE.bannerBackground,
  };
}

interface RgbTuple {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RgbTuple {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { r: 27, g: 77, b: 255 };
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RgbTuple): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return rgbToHex({
    r: a.r * (1 - w) + b.r * w,
    g: a.g * (1 - w) + b.g * w,
    b: a.b * (1 - w) + b.b * w,
  });
}

function hexLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * Ensures sufficient button contrast for white text in light mode or readable pastel in dark mode.
 */
function ensureAccessibleButtonHex(hex: string): string {
  const lum = hexLuminance(hex);
  if (lum > 0.45) {
    return mixHex(hex, '#0F172A', 0.35);
  }
  return hex.toUpperCase();
}

export function resolveColorThemeHexPair(colorTheme: string | null | undefined): {
  primaryHex: string;
  secondaryHex: string;
} {
  const clean = colorTheme && isValidColorTheme(colorTheme) ? colorTheme : 'default';
  if (clean.startsWith('dual:#')) {
    const [, p, s] = clean.split(':');
    return {
      primaryHex: p.toUpperCase(),
      secondaryHex: s.toUpperCase(),
    };
  }
  if (clean.startsWith('custom:#')) {
    const p = clean.slice('custom:'.length).toUpperCase();
    return {
      primaryHex: p,
      secondaryHex: mixHex(p, '#FF5A36', 0.55),
    };
  }
  const preset = COLOR_THEME_PRESETS.find((item) => item.id === clean) ?? COLOR_THEME_PRESETS[0];
  return {
    primaryHex: preset.primaryHex,
    secondaryHex: preset.secondaryHex,
  };
}

export function getThemeCssVariables(
  colorTheme: string | null | undefined,
  isDarkMode: boolean
): Record<string, string> {
  const { primaryHex, secondaryHex } = resolveColorThemeHexPair(colorTheme);
  const basePrimary = ensureAccessibleButtonHex(primaryHex);
  const baseSecondary = ensureAccessibleButtonHex(secondaryHex);

  if (!isDarkMode) {
    return {
      '--rally-primary': basePrimary,
      '--rally-primary-dark': mixHex(basePrimary, '#090D16', 0.28),
      '--rally-primary-container': mixHex(basePrimary, '#FFFFFF', 0.86),
      '--rally-on-primary-container': mixHex(basePrimary, '#090D16', 0.52),
      '--rally-secondary': baseSecondary,
      '--rally-secondary-container': mixHex(baseSecondary, '#FFFFFF', 0.86),
      '--rally-on-secondary-container': mixHex(baseSecondary, '#090D16', 0.52),
    };
  }

  return {
    '--rally-primary': mixHex(basePrimary, '#FFFFFF', 0.38),
    '--rally-primary-dark': mixHex(basePrimary, '#090D16', 0.25),
    '--rally-primary-container': mixHex(basePrimary, '#0D1118', 0.58),
    '--rally-on-primary-container': mixHex(basePrimary, '#FFFFFF', 0.82),
    '--rally-secondary': mixHex(baseSecondary, '#FFFFFF', 0.34),
    '--rally-secondary-container': mixHex(baseSecondary, '#0D1118', 0.58),
    '--rally-on-secondary-container': mixHex(baseSecondary, '#FFFFFF', 0.82),
  };
}

export function getAppBackgroundPresentation(
  spec: string | null | undefined,
  isDarkMode: boolean,
  colorTheme?: string | null
): {
  style: React.CSSProperties;
  isDarkCanvas: boolean;
} {
  const key = spec && isValidBackgroundSpec(spec) ? spec : 'default';
  const { primaryHex } = resolveColorThemeHexPair(colorTheme);
  const primaryRgb = hexToRgb(primaryHex);

  if (key.startsWith('solid:#')) {
    const hex = key.slice('solid:'.length);
    return {
      style: { backgroundColor: hex },
      isDarkCanvas: hexLuminance(hex) < 0.42,
    };
  }

  if (key.startsWith('gradient:#')) {
    const [, hex1, hex2] = key.split(':');
    const avgLum = (hexLuminance(hex1) + hexLuminance(hex2)) / 2;
    return {
      style: { background: `linear-gradient(135deg, ${hex1} 0%, ${hex2} 100%)` },
      isDarkCanvas: avgLum < 0.42,
    };
  }

  if (key === 'theme') {
    const tintStart = isDarkMode ? mixHex(primaryHex, '#0B101B', 0.86) : mixHex(primaryHex, '#FFFFFF', 0.92);
    const tintEnd = isDarkMode ? mixHex(primaryHex, '#111827', 0.82) : mixHex(primaryHex, '#F8FAFC', 0.88);
    return {
      style: { background: `linear-gradient(135deg, ${tintStart} 0%, ${tintEnd} 100%)` },
      isDarkCanvas: isDarkMode,
    };
  }

  switch (key) {
    case 'ocean-mist':
      return {
        style: {
          background: isDarkMode
            ? 'linear-gradient(135deg, #0B1528 0%, #0E233A 100%)'
            : 'linear-gradient(135deg, #EEF4FF 0%, #DFF1FF 100%)',
        },
        isDarkCanvas: isDarkMode,
      };
    case 'emerald-grove':
      return {
        style: {
          background: isDarkMode
            ? 'linear-gradient(135deg, #081C17 0%, #0D2922 100%)'
            : 'linear-gradient(135deg, #ECFDF5 0%, #DCF7EE 100%)',
        },
        isDarkCanvas: isDarkMode,
      };
    case 'sunset-warmth':
      return {
        style: {
          background: isDarkMode
            ? 'linear-gradient(135deg, #1E1210 0%, #271913 100%)'
            : 'linear-gradient(135deg, #FFF3EC 0%, #FEF3DB 100%)',
        },
        isDarkCanvas: isDarkMode,
      };
    case 'lavender-studio':
      return {
        style: {
          background: isDarkMode
            ? 'linear-gradient(135deg, #141226 0%, #1C1938 100%)'
            : 'linear-gradient(135deg, #F3F0FF 0%, #E7EEFF 100%)',
        },
        isDarkCanvas: isDarkMode,
      };
    case 'midnight-canvas':
      return {
        style: {
          background: 'linear-gradient(135deg, #0B1120 0%, #162033 100%)',
        },
        isDarkCanvas: true,
      };
    case 'dot-grid':
      return {
        style: {
          backgroundColor: isDarkMode ? '#0D1118' : '#F5F7FB',
          backgroundImage: `radial-gradient(rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${isDarkMode ? 0.22 : 0.16}) 1.25px, transparent 1.25px)`,
          backgroundSize: '20px 20px',
        },
        isDarkCanvas: isDarkMode,
      };
    case 'diagonal-weave':
      return {
        style: {
          backgroundColor: isDarkMode ? '#0D1118' : '#F4F6FA',
          backgroundImage: `repeating-linear-gradient(135deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${isDarkMode ? 0.09 : 0.07}) 0px, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${isDarkMode ? 0.09 : 0.07}) 1px, transparent 1px, transparent 18px)`,
        },
        isDarkCanvas: isDarkMode,
      };
    default:
      return {
        style: { backgroundColor: 'var(--rally-bg)' },
        isDarkCanvas: isDarkMode,
      };
  }
}

export function getGroupBackgroundPresentation(
  spec: string | null | undefined,
  colorTheme?: string | null
): {
  style: React.CSSProperties;
  isLightBg: boolean;
} {
  const key = spec && isValidBackgroundSpec(spec) ? spec : 'theme';

  if (key === 'theme') {
    const { primaryHex } = resolveColorThemeHexPair(colorTheme);
    const startHex = ensureAccessibleButtonHex(primaryHex);
    const endHex = mixHex(startHex, '#090D16', 0.32);
    const avgLum = (hexLuminance(startHex) + hexLuminance(endHex)) / 2;
    return {
      style: { background: `linear-gradient(135deg, ${startHex} 0%, ${endHex} 100%)` },
      isLightBg: avgLum > 0.52,
    };
  }

  if (key.startsWith('solid:#')) {
    const hex = key.slice('solid:'.length);
    return {
      style: { backgroundColor: hex },
      isLightBg: hexLuminance(hex) > 0.52,
    };
  }

  if (key.startsWith('gradient:#')) {
    const [, hex1, hex2] = key.split(':');
    const avgLum = (hexLuminance(hex1) + hexLuminance(hex2)) / 2;
    return {
      style: { background: `linear-gradient(135deg, ${hex1} 0%, ${hex2} 100%)` },
      isLightBg: avgLum > 0.52,
    };
  }

  const preset = GROUP_BACKGROUND_PRESETS.find((p) => p.id === key);
  if (preset) {
    return { style: preset.previewStyle, isLightBg: false };
  }

  return {
    style: { background: 'linear-gradient(135deg, #1B4DFF 0%, #1034B8 100%)' },
    isLightBg: false,
  };
}

export function getPersonalBannerPresentation(appearance: PersonalAppearance): {
  style: React.CSSProperties;
  isLightBg: boolean;
} {
  return getGroupBackgroundPresentation(appearance.bannerBackground, appearance.colorTheme);
}

export function describeColorTheme(colorTheme: string | null | undefined): string {
  if (!colorTheme || colorTheme === 'default') return 'Rally Cobalt';
  const preset = COLOR_THEME_PRESETS.find((p) => p.id === colorTheme);
  if (preset) return preset.label;
  if (colorTheme.startsWith('dual:#')) {
    const [, c1, c2] = colorTheme.split(':');
    return `Custom ${c1.toUpperCase()} + ${c2.toUpperCase()}`;
  }
  if (colorTheme.startsWith('custom:#')) {
    return `Custom ${colorTheme.slice('custom:'.length).toUpperCase()}`;
  }
  return colorTheme;
}

export function describeBackgroundSpec(spec: string | null | undefined): string {
  if (!spec || spec === 'default') return 'Rally Slate (Default)';
  if (spec === 'theme') return 'Match My Accent Color';
  const appMatch = APP_BACKGROUND_PRESETS.find((p) => p.id === spec);
  if (appMatch) return appMatch.label;
  const grpMatch = GROUP_BACKGROUND_PRESETS.find((p) => p.id === spec);
  if (grpMatch) return grpMatch.label;
  if (spec.startsWith('solid:#')) return `Solid ${spec.slice('solid:'.length).toUpperCase()}`;
  if (spec.startsWith('gradient:#')) {
    const [, c1, c2] = spec.split(':');
    return `Gradient ${c1.toUpperCase()} → ${c2.toUpperCase()}`;
  }
  return spec;
}

const DEVICE_APPEARANCE_KEY = 'rallyhub_personal_appearance_device_v1';

function appearanceStorageKey(uid?: string | null): string {
  return uid ? `rallyhub_personal_appearance_${uid}` : DEVICE_APPEARANCE_KEY;
}

type AppearanceListener = (uid: string | null, appearance: PersonalAppearance) => void;
const appearanceListeners = new Set<AppearanceListener>();

export function readStoredPersonalAppearance(uid?: string | null): PersonalAppearance {
  if (typeof window === 'undefined') return DEFAULT_PERSONAL_APPEARANCE;
  try {
    const raw = localStorage.getItem(appearanceStorageKey(uid));
    if (raw) {
      return sanitizePersonalAppearance(JSON.parse(raw) as Partial<PersonalAppearance>);
    }
    if (uid) {
      const deviceRaw = localStorage.getItem(DEVICE_APPEARANCE_KEY);
      if (deviceRaw) {
        return sanitizePersonalAppearance(JSON.parse(deviceRaw) as Partial<PersonalAppearance>);
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return DEFAULT_PERSONAL_APPEARANCE;
}

export function writeStoredPersonalAppearance(
  uid: string | null | undefined,
  appearance: PersonalAppearance
): PersonalAppearance {
  const clean = sanitizePersonalAppearance(appearance);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(appearanceStorageKey(uid), JSON.stringify(clean));
      if (!uid) {
        localStorage.setItem(DEVICE_APPEARANCE_KEY, JSON.stringify(clean));
      }
    } catch {
      // Ignore storage quota errors
    }
  }
  const normalizedUid = uid ?? null;
  for (const listener of appearanceListeners) {
    try {
      listener(normalizedUid, clean);
    } catch {
      // Ignore listener errors
    }
  }
  return clean;
}

export function subscribeStoredPersonalAppearance(
  uid: string | null | undefined,
  onChange: (appearance: PersonalAppearance) => void
): () => void {
  const targetUid = uid ?? null;
  const handler: AppearanceListener = (changedUid, next) => {
    if (changedUid === targetUid || (targetUid === null && changedUid === null)) {
      onChange(next);
    }
  };
  appearanceListeners.add(handler);
  return () => {
    appearanceListeners.delete(handler);
  };
}
