import type React from 'react';

export interface BackgroundPreset {
  id: string;
  label: string;
  description: string;
  previewStyle: React.CSSProperties;
}

export const VALID_BACKGROUND_REGEX =
  /^(default|ocean-mist|emerald-grove|sunset-warmth|lavender-studio|dot-grid|diagonal-weave|emerald|sunset|midnight|royal|teal-ocean|solid:#[0-9A-Fa-f]{6}|gradient:#[0-9A-Fa-f]{6}:#[0-9A-Fa-f]{6})$/;

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
    description: 'Warm amber & coral tint',
    previewStyle: { background: 'linear-gradient(135deg, #FFF3EC 0%, #FEF3DB 100%)' },
  },
  {
    id: 'lavender-studio',
    label: 'Lavender Studio',
    description: 'Soft indigo studio wash',
    previewStyle: { background: 'linear-gradient(135deg, #F3F0FF 0%, #E7EEFF 100%)' },
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

export function isValidBackgroundSpec(raw?: string | null): boolean {
  if (!raw) return false;
  return raw.length <= 40 && VALID_BACKGROUND_REGEX.test(raw);
}

function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0.5;
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function getAppBackgroundPresentation(
  spec: string | null | undefined,
  isDarkMode: boolean
): {
  style: React.CSSProperties;
  isDarkCanvas: boolean;
} {
  const key = spec && isValidBackgroundSpec(spec) ? spec : 'default';

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
    case 'dot-grid':
      return {
        style: {
          backgroundColor: isDarkMode ? '#0D1118' : '#F5F7FB',
          backgroundImage: isDarkMode
            ? 'radial-gradient(rgba(127, 161, 255, 0.16) 1.25px, transparent 1.25px)'
            : 'radial-gradient(rgba(27, 77, 255, 0.15) 1.25px, transparent 1.25px)',
          backgroundSize: '20px 20px',
        },
        isDarkCanvas: isDarkMode,
      };
    case 'diagonal-weave':
      return {
        style: {
          backgroundColor: isDarkMode ? '#0D1118' : '#F4F6FA',
          backgroundImage: isDarkMode
            ? 'repeating-linear-gradient(135deg, rgba(127, 161, 255, 0.07) 0px, rgba(127, 161, 255, 0.07) 1px, transparent 1px, transparent 18px)'
            : 'repeating-linear-gradient(135deg, rgba(27, 77, 255, 0.06) 0px, rgba(27, 77, 255, 0.06) 1px, transparent 1px, transparent 18px)',
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

export function getGroupBackgroundPresentation(spec: string | null | undefined): {
  style: React.CSSProperties;
  isLightBg: boolean;
} {
  const key = spec && isValidBackgroundSpec(spec) ? spec : 'default';

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

export function describeBackgroundSpec(spec: string | null | undefined): string {
  if (!spec || spec === 'default') return 'Default';
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
