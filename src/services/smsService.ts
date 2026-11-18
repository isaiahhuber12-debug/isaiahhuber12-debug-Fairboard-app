export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const digitsOnly = trimmed.replace(/[^\d+]/g, '');
  if (digitsOnly.startsWith('+')) {
    return `+${digitsOnly.slice(1).replace(/\+/g, '').slice(0, 15)}`;
  }
  const plainDigits = digitsOnly.replace(/\+/g, '');
  if (plainDigits.length === 10) {
    return `+1${plainDigits}`;
  }
  if (plainDigits.length === 11 && plainDigits.startsWith('1')) {
    return `+${plainDigits}`;
  }
  if (plainDigits.length >= 8 && plainDigits.length <= 15) {
    return `+${plainDigits}`;
  }
  return plainDigits ? `+${plainDigits.slice(0, 15)}` : '';
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhoneInput(phone);
  const usMatch = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(normalized);
  if (usMatch) {
    return `+1 (${usMatch[1]}) ${usMatch[2]}-${usMatch[3]}`;
  }
  return normalized || phone;
}

export function parsePhoneListInput(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts = raw
    .split(/[\n,;]+/)
    .map((segment) => normalizePhoneInput(segment))
    .filter((p) => E164_PHONE_REGEX.test(p));
  return Array.from(new Set(parts));
}

/**
 * Builds a cross-platform `sms:` URI that opens the device's native Messages / SMS app
 * with one or multiple recipient phone numbers and message body pre-populated.
 */
export function buildDeviceSmsUri(phones: string[], body = ''): string {
  const validPhones = Array.from(
    new Set(
      phones
        .map((p) => normalizePhoneInput(p))
        .filter((p) => E164_PHONE_REGEX.test(p))
    )
  );
  if (validPhones.length === 0) return '';

  const isIos =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
  const encodedBody = body.trim() ? encodeURIComponent(body.trim()) : '';

  if (validPhones.length === 1) {
    const phone = validPhones[0];
    if (!encodedBody) return `sms:${phone}`;
    return isIos ? `sms:${phone}&body=${encodedBody}` : `sms:${phone}?body=${encodedBody}`;
  }

  const joined = validPhones.join(',');
  if (isIos) {
    return encodedBody
      ? `sms://open?addresses=${joined}&body=${encodedBody}`
      : `sms://open?addresses=${joined}`;
  }
  return encodedBody ? `sms:${joined}?body=${encodedBody}` : `sms:${joined}`;
}
