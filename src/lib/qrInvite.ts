import jsQR from 'jsqr';

export const GROUP_CODE_PATTERN = /^[A-Z0-9_-]{4,24}$/;

export function normalizeInviteCodeCandidate(raw: string): string | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '-');
  return GROUP_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function parseGroupInviteFromQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Direct group code (e.g. RALLY26 or RH-ABC12)
  const direct = normalizeInviteCodeCandidate(trimmed);
  if (direct) return direct;

  // 2. JSON payload (e.g. {"code":"RALLY26"} or {"groupCode":"RALLY26"})
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        code?: unknown;
        groupCode?: unknown;
        invite?: unknown;
      };
      for (const candidate of [parsed.code, parsed.groupCode, parsed.invite]) {
        if (typeof candidate === 'string') {
          const valid = normalizeInviteCodeCandidate(candidate);
          if (valid) return valid;
        }
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  // 3. URL or custom scheme (e.g. https://.../join?code=RALLY26, rallyhub://join?code=RALLY26)
  try {
    const normalizedForUrl =
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.includes('://')
        ? trimmed
        : trimmed.startsWith('?')
          ? `https://rallyhub.local/${trimmed}`
          : null;
    if (normalizedForUrl) {
      const url = new URL(normalizedForUrl);
      for (const param of ['code', 'groupCode', 'invite', 'join']) {
        const val = url.searchParams.get(param);
        if (val) {
          const valid = normalizeInviteCodeCandidate(val);
          if (valid) return valid;
        }
      }
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        for (const param of ['code', 'groupCode', 'invite', 'join']) {
          const val = hashParams.get(param);
          if (val) {
            const valid = normalizeInviteCodeCandidate(val);
            if (valid) return valid;
          }
        }
      }
      const lastSegment = url.pathname.split('/').filter(Boolean).pop();
      if (lastSegment && lastSegment.toLowerCase() !== 'join') {
        const valid = normalizeInviteCodeCandidate(lastSegment);
        if (valid) return valid;
      }
    }
  } catch {
    // Ignore URL parse errors
  }

  // 4. Key-value prefix (e.g. rallyhub:RALLY26 or code=RALLY26)
  const prefixMatch = /(?:rallyhub:|code=|groupCode=|invite=)([A-Za-z0-9_-]{4,24})/i.exec(trimmed);
  if (prefixMatch?.[1]) {
    return normalizeInviteCodeCandidate(prefixMatch[1]);
  }

  return null;
}

export function readInviteCodeFromWindowLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of ['code', 'groupCode', 'invite', 'join']) {
      const raw = params.get(key);
      if (raw) {
        const valid = normalizeInviteCodeCandidate(raw);
        if (valid) return valid;
      }
    }
  } catch {
    // Ignore URL errors
  }
  return null;
}

export function buildGroupInviteQrValue(groupCode: string): string {
  const normalized = normalizeInviteCodeCandidate(groupCode) ?? groupCode.trim().toUpperCase();
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return `${window.location.origin}/?code=${encodeURIComponent(normalized)}`;
  }
  return `rallyhub://join?code=${encodeURIComponent(normalized)}`;
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image file.'));
      el.src = objectUrl;
    });

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const decoded = jsQR(imageData.data, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    return decoded?.data ?? null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
