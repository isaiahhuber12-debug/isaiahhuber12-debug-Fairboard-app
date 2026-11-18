import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_MODEL_NAME = 'gemini-4-hydrogen';
const SMS_DATA_DIR = path.resolve(__dirname, '.data');
const SMS_SUBS_FILE = path.join(SMS_DATA_DIR, 'sms-subscriptions.json');
const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const TWILIO_ACCOUNT_SID_REGEX = /^AC[a-fA-F0-9]{32}$/;
const TWILIO_MESSAGING_SERVICE_SID_REGEX = /^MG[a-fA-F0-9]{32}$/;

interface SmsSubscriberRecord {
  phone: string;
  role: string;
  forMessages: boolean;
  forEvents: boolean;
  updatedAt: number;
}

type SmsSubscriptionStore = Record<string, Record<string, SmsSubscriberRecord>>;

function loadFirebaseAppletConfig(): { apiKey: string; projectId: string } {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { apiKey?: string; projectId?: string };
    return {
      apiKey: (parsed.apiKey ?? '').trim(),
      projectId: (parsed.projectId ?? '').trim(),
    };
  } catch {
    return { apiKey: '', projectId: '' };
  }
}

const FIREBASE_APPLET_CONFIG = loadFirebaseAppletConfig();
const FIREBASE_WEB_API_KEY = FIREBASE_APPLET_CONFIG.apiKey;
const FIREBASE_PROJECT_ID = FIREBASE_APPLET_CONFIG.projectId;

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Firebase public certs (${resp.status})`);
  }
  const certs = (await resp.json()) as Record<string, string>;
  cachedGoogleCerts = {
    certs,
    expiresAt: now + 30 * 60 * 1000,
  };
  return certs;
}

async function verifyFirebaseJwtFallback(idToken: string): Promise<string | null> {
  if (!FIREBASE_PROJECT_ID) return null;
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.aud !== FIREBASE_PROJECT_ID ||
      payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      !payload.sub ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec
    ) {
      return null;
    }
    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const valid = verifier.verify(cert, Buffer.from(signatureB64, 'base64url'));
    return valid ? payload.sub : null;
  } catch {
    return null;
  }
}

function loadSmsSubscriptions(): SmsSubscriptionStore {
  try {
    if (!fs.existsSync(SMS_SUBS_FILE)) return {};
    const raw = fs.readFileSync(SMS_SUBS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SmsSubscriptionStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSmsSubscriptions(store: SmsSubscriptionStore): void {
  try {
    if (!fs.existsSync(SMS_DATA_DIR)) {
      fs.mkdirSync(SMS_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SMS_SUBS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist SMS subscriptions:', err);
  }
}

function cleanSecretValue(raw: string | undefined, envKeyName: string): string {
  let val = (raw ?? '').trim();
  if (!val) return '';
  const keyPrefix = new RegExp(`^(?:export\\s+)?${envKeyName}\\s*=\\s*`, 'i');
  val = val.replace(keyPrefix, '').trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'")) ||
    (val.startsWith('`') && val.endsWith('`'))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function normalizeServerPhoneInput(raw: string): string {
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

interface ParsedTwilioConfig {
  secretsPresent: boolean;
  accountSid: string;
  authToken: string;
  senderValue: string;
  senderType: 'phone' | 'messaging_service' | 'invalid' | 'missing';
  senderDisplay: string;
  formatIssue?: string;
}

function parseTwilioConfig(): ParsedTwilioConfig {
  let rawSid = cleanSecretValue(process.env.TWILIO_ACCOUNT_SID, 'TWILIO_ACCOUNT_SID').replace(
    /\s+/g,
    ''
  );
  let rawToken = cleanSecretValue(process.env.TWILIO_AUTH_TOKEN, 'TWILIO_AUTH_TOKEN').replace(
    /\s+/g,
    ''
  );
  const rawFrom = cleanSecretValue(process.env.TWILIO_FROM_NUMBER, 'TWILIO_FROM_NUMBER');
  const rawMsgSid = cleanSecretValue(
    process.env.TWILIO_MESSAGING_SERVICE_SID,
    'TWILIO_MESSAGING_SERVICE_SID'
  ).replace(/\s+/g, '');

  const secretsPresent = Boolean(rawSid || rawToken || rawFrom || rawMsgSid);
  if (!secretsPresent) {
    return {
      secretsPresent: false,
      accountSid: '',
      authToken: '',
      senderValue: '',
      senderType: 'missing',
      senderDisplay: '',
    };
  }

  // Extract embedded AC... if pasted inside larger snippet
  const embeddedAcInSid = /(AC[a-fA-F0-9]{32})/.exec(rawSid);
  if (embeddedAcInSid) {
    rawSid = embeddedAcInSid[1];
  }

  // Auto-heal if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN were swapped
  if (!TWILIO_ACCOUNT_SID_REGEX.test(rawSid) && TWILIO_ACCOUNT_SID_REGEX.test(rawToken)) {
    const tmp = rawSid;
    rawSid = rawToken;
    rawToken = tmp;
  }

  // Determine sender (Messaging Service SID MG... or E.164 phone number)
  const cleanFromCompact = rawFrom.replace(/\s+/g, '');
  let senderValue = '';
  let senderType: ParsedTwilioConfig['senderType'] = 'missing';
  let senderDisplay = '';

  if (TWILIO_MESSAGING_SERVICE_SID_REGEX.test(rawMsgSid)) {
    senderValue = rawMsgSid;
    senderType = 'messaging_service';
    senderDisplay = `Messaging Service (${rawMsgSid.slice(0, 6)}…${rawMsgSid.slice(-4)})`;
  } else if (TWILIO_MESSAGING_SERVICE_SID_REGEX.test(cleanFromCompact)) {
    senderValue = cleanFromCompact;
    senderType = 'messaging_service';
    senderDisplay = `Messaging Service (${cleanFromCompact.slice(0, 6)}…${cleanFromCompact.slice(-4)})`;
  } else if (rawFrom) {
    const normalizedFrom = normalizeServerPhoneInput(rawFrom);
    if (E164_PHONE_REGEX.test(normalizedFrom)) {
      senderValue = normalizedFrom;
      senderType = 'phone';
      senderDisplay =
        normalizedFrom.length >= 8
          ? `${normalizedFrom.slice(0, 2)} ***-***-${normalizedFrom.slice(-4)}`
          : normalizedFrom;
    } else {
      senderValue = rawFrom;
      senderType = 'invalid';
    }
  }

  const missingVars: string[] = [];
  if (!rawSid) missingVars.push('TWILIO_ACCOUNT_SID');
  if (!rawToken) missingVars.push('TWILIO_AUTH_TOKEN');
  if (!rawFrom && !rawMsgSid) missingVars.push('TWILIO_FROM_NUMBER');

  let formatIssue: string | undefined;
  if (missingVars.length > 0) {
    formatIssue = `Missing ${missingVars.join(', ')} in AI Studio Settings > Secrets.`;
  } else if (/^SK[a-fA-F0-9]{32}$/i.test(rawSid)) {
    formatIssue =
      'TWILIO_ACCOUNT_SID in Settings > Secrets is set to an API Key SID (starts with "SK…"). Twilio requires your main 34-character Account SID (starts with "AC…") from the Twilio Console Account Info panel.';
  } else if (/^(MG|VA|PN|IS|US)[a-fA-F0-9]{32}$/i.test(rawSid)) {
    const prefix = rawSid.slice(0, 2).toUpperCase();
    formatIssue = `TWILIO_ACCOUNT_SID in Settings > Secrets starts with "${prefix}…" instead of "AC…". Copy your 34-character Account SID (starting with "AC") from the Twilio Console dashboard.`;
  } else if (rawSid.includes('@')) {
    formatIssue =
      'TWILIO_ACCOUNT_SID in Settings > Secrets contains an email address instead of your Twilio Account SID. Copy the 34-character Account SID (starting with "AC…") from the Twilio Console dashboard.';
  } else if (/^\+?\d{7,15}$/.test(rawSid)) {
    formatIssue =
      'TWILIO_ACCOUNT_SID in Settings > Secrets contains a phone number instead of your Account SID. Put your Twilio phone number in TWILIO_FROM_NUMBER and your "AC…" Account SID in TWILIO_ACCOUNT_SID.';
  } else if (!TWILIO_ACCOUNT_SID_REGEX.test(rawSid)) {
    formatIssue = `TWILIO_ACCOUNT_SID in Settings > Secrets is not a valid 34-character Twilio Account SID (must start with "AC" followed by 32 hex characters; current length is ${rawSid.length}). Update it in Settings > Secrets and restart.`;
  } else if (senderType === 'invalid') {
    formatIssue =
      'TWILIO_FROM_NUMBER in Settings > Secrets is not a valid phone number or Messaging Service SID. Set it to your Twilio number in E.164 format (e.g. +18551234567) or a Messaging Service SID (MG…).';
  }

  return {
    secretsPresent,
    accountSid: rawSid,
    authToken: rawToken,
    senderValue,
    senderType,
    senderDisplay,
    formatIssue,
  };
}

function formatActionableTwilioError(
  rawMessage: string | undefined,
  code: number | undefined,
  status: number,
  parsedCfg: ParsedTwilioConfig
): string {
  if (parsedCfg.formatIssue) {
    return parsedCfg.formatIssue;
  }
  const msg = (rawMessage ?? '').trim();
  const lower = msg.toLowerCase();

  if (
    code === 20003 ||
    status === 401 ||
    lower.includes('authentication error') ||
    lower.includes('invalid username') ||
    lower.includes('authenticate')
  ) {
    return 'Twilio rejected TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN ("Authentication Error"). In AI Studio Settings > Secrets, verify TWILIO_ACCOUNT_SID is your active "AC…" Account SID and TWILIO_AUTH_TOKEN is your current Auth Token from console.twilio.com.';
  }
  if (code === 21608 || lower.includes('unverified')) {
    return `Twilio Trial Account restriction: ${msg} Verify the recipient phone number under Twilio Console > Phone Numbers > Verified Caller IDs, or upgrade your Twilio account to text any number.`;
  }
  if (code === 21211) {
    return `Invalid recipient phone number: ${msg}`;
  }
  if (code === 21212 || code === 21606 || lower.includes("'from' number")) {
    return `Invalid TWILIO_FROM_NUMBER in Settings > Secrets: ${msg} Make sure TWILIO_FROM_NUMBER matches an active SMS-capable Twilio phone number on your Twilio account (e.g. +18551234567).`;
  }
  if (code === 21610) {
    return 'Recipient has opted out of SMS from this Twilio number (replied STOP). They must text START to your Twilio number to re-enable messages.';
  }
  return msg || `Twilio API error (${status})`;
}

interface SmsHealthStatus {
  configured: boolean;
  secretsPresent: boolean;
  ready: boolean;
  accountType?: string;
  senderDisplay?: string;
  configIssue?: string;
}

let cachedSmsHealth: { key: string; value: SmsHealthStatus; expiresAt: number } | null = null;

async function checkTwilioHealth(force = false): Promise<SmsHealthStatus> {
  const cfg = parseTwilioConfig();
  if (!cfg.secretsPresent) {
    return {
      configured: false,
      secretsPresent: false,
      ready: false,
    };
  }
  if (cfg.formatIssue) {
    return {
      configured: true,
      secretsPresent: true,
      ready: false,
      senderDisplay: cfg.senderDisplay || undefined,
      configIssue: cfg.formatIssue,
    };
  }

  const cacheKey = `${cfg.accountSid}:${cfg.authToken.slice(0, 4)}:${cfg.senderValue}`;
  const now = Date.now();
  if (!force && cachedSmsHealth && cachedSmsHealth.key === cacheKey && cachedSmsHealth.expiresAt > now) {
    return cachedSmsHealth.value;
  }

  try {
    const credentials = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}.json`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );
    const payload = (await resp.json().catch(() => ({}))) as {
      status?: string;
      type?: string;
      message?: string;
      code?: number;
    };

    if (!resp.ok) {
      const issue = formatActionableTwilioError(payload.message, payload.code, resp.status, cfg);
      const result: SmsHealthStatus = {
        configured: true,
        secretsPresent: true,
        ready: false,
        senderDisplay: cfg.senderDisplay || undefined,
        configIssue: issue,
      };
      cachedSmsHealth = { key: cacheKey, value: result, expiresAt: now + 15_000 };
      return result;
    }

    if (payload.status && payload.status.toLowerCase() !== 'active') {
      const result: SmsHealthStatus = {
        configured: true,
        secretsPresent: true,
        ready: false,
        accountType: payload.type,
        senderDisplay: cfg.senderDisplay || undefined,
        configIssue: `Your Twilio account status is "${payload.status}". Activate your Twilio account at console.twilio.com to send Cloud SMS.`,
      };
      cachedSmsHealth = { key: cacheKey, value: result, expiresAt: now + 15_000 };
      return result;
    }

    const result: SmsHealthStatus = {
      configured: true,
      secretsPresent: true,
      ready: true,
      accountType: payload.type,
      senderDisplay: cfg.senderDisplay || undefined,
    };
    cachedSmsHealth = { key: cacheKey, value: result, expiresAt: now + 60_000 };
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      secretsPresent: true,
      ready: false,
      senderDisplay: cfg.senderDisplay || undefined,
      configIssue: `Could not reach Twilio API (${msg}). Check network connectivity or retry.`,
    };
  }
}

async function verifyFirebaseBearerUid(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const idToken = match?.[1]?.trim();
  if (!idToken) return null;

  if (FIREBASE_WEB_API_KEY) {
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as { users?: Array<{ localId?: string }> };
        const uid = data.users?.[0]?.localId ?? null;
        if (uid) return uid;
      }
    } catch {
      // Fall through to cryptographic JWT verification
    }
  }

  return verifyFirebaseJwtFallback(idToken);
}

async function verifySmsActorUid(req: Request): Promise<string | null> {
  const firebaseUid = await verifyFirebaseBearerUid(req);
  if (firebaseUid) return firebaseUid;
  const guestHeader = req.headers['x-guest-uid'];
  const guestUid = typeof guestHeader === 'string' ? guestHeader.trim() : '';
  if (/^guest_[a-zA-Z0-9]{16,40}$/.test(guestUid)) {
    return guestUid;
  }
  return null;
}

function roleCanAccessChannelLevel(role: string, channelAccessLevel?: string): boolean {
  const level = (channelAccessLevel ?? 'ALL').toUpperCase();
  const upperRole = role.toUpperCase();
  if (level === 'ALL') return true;
  if (level === 'ORGANIZER') {
    return upperRole === 'ORGANIZER' || upperRole === 'ADMIN' || upperRole === 'CREATOR';
  }
  if (level === 'ADMIN') {
    return upperRole === 'ADMIN' || upperRole === 'CREATOR';
  }
  return true;
}

async function sendTwilioSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const cfg = parseTwilioConfig();
  if (!cfg.secretsPresent) {
    return {
      ok: false,
      error:
        'Twilio SMS credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are not configured on the server.',
    };
  }
  if (cfg.formatIssue) {
    return {
      ok: false,
      error: cfg.formatIssue,
    };
  }

  const normalizedTo = normalizeServerPhoneInput(to);
  if (!E164_PHONE_REGEX.test(normalizedTo)) {
    return {
      ok: false,
      error: `Recipient number "${to}" is not a valid E.164 phone number.`,
    };
  }

  const params = new URLSearchParams({
    To: normalizedTo,
    Body: body.slice(0, 1400),
  });
  if (cfg.senderType === 'messaging_service') {
    params.set('MessagingServiceSid', cfg.senderValue);
  } else {
    params.set('From', cfg.senderValue);
  }

  try {
    const credentials = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
    const payload = (await resp.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };
    if (!resp.ok) {
      return {
        ok: false,
        error: formatActionableTwilioError(payload.message, payload.code, resp.status, cfg),
      };
    }
    return { ok: true, sid: payload.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Unable to reach Twilio API: ${msg}` };
  }
}

function createAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: 'Server Gemini API key is not configured. Check Settings > Secrets.' };
  }
  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    return { status: 403, message: 'Gemini API permission denied. Please check your API key in Settings > Secrets.' };
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    return { status: 429, message: 'Gemini API quota exceeded. Please try again later or check your API tier.' };
  }
  if (message.includes('API_KEY_INVALID') || message.includes('400')) {
    return { status: 400, message };
  }
  return { status: 502, message: message || 'Unable to reach Gemini right now.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/sms/status', async (req: Request, res: Response) => {
    const force = req.query.refresh === '1';
    const health = await checkTwilioHealth(force);
    res.json(health);
  });

  app.post('/api/sms/subscriptions', async (req: Request, res: Response) => {
    const uid = await verifySmsActorUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Valid session authentication is required.' });
      return;
    }

    const { groupMemberships, phone, enabled, forMessages, forEvents } = req.body as {
      groupMemberships?: Array<{ groupId?: string; role?: string }>;
      phone?: string | null;
      enabled?: boolean;
      forMessages?: boolean;
      forEvents?: boolean;
    };

    const cleanPhone = phone ? normalizeServerPhoneInput(phone) : '';
    if (enabled && !E164_PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({ error: 'Enter a valid E.164 phone number (e.g. +15551234567).' });
      return;
    }

    const store = loadSmsSubscriptions();
    for (const grpId of Object.keys(store)) {
      if (store[grpId]?.[uid]) {
        delete store[grpId][uid];
      }
    }

    if (enabled && cleanPhone && Array.isArray(groupMemberships)) {
      for (const item of groupMemberships.slice(0, 100)) {
        const gid = typeof item.groupId === 'string' ? item.groupId.trim() : '';
        if (!gid || !/^[a-zA-Z0-9_-]{1,128}$/.test(gid)) continue;
        if (!store[gid]) store[gid] = {};
        store[gid][uid] = {
          phone: cleanPhone,
          role: typeof item.role === 'string' ? item.role : 'PARTICIPANT',
          forMessages: Boolean(forMessages),
          forEvents: Boolean(forEvents),
          updatedAt: Date.now(),
        };
      }
    }

    saveSmsSubscriptions(store);
    const health = await checkTwilioHealth(false);
    res.json({ ok: true, ...health });
  });

  app.post('/api/sms/test', async (req: Request, res: Response) => {
    const uid = await verifySmsActorUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Valid session authentication is required.' });
      return;
    }

    const { phone, groupName } = req.body as { phone?: string; groupName?: string };
    const cleanPhone = phone ? normalizeServerPhoneInput(phone) : '';
    if (!E164_PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({ error: 'Enter a valid E.164 phone number (e.g. +15551234567).' });
      return;
    }

    const cfg = parseTwilioConfig();
    if (!cfg.secretsPresent) {
      res.status(503).json({
        configured: false,
        secretsPresent: false,
        ready: false,
        error:
          'Twilio SMS credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are not configured on the server. Use "Test via SMS App" to send via your phone.',
      });
      return;
    }

    const result = await sendTwilioSms(
      cleanPhone,
      `RallyHub SMS alerts are active${groupName ? ` for ${groupName}` : ''}! You will receive text updates for messages and events based on your preferences.`
    );
    if (!result.ok) {
      res.status(502).json({
        configured: true,
        secretsPresent: true,
        ready: false,
        error: result.error,
      });
      return;
    }
    res.json({ ok: true, configured: true, secretsPresent: true, ready: true, sid: result.sid });
  });

  app.post('/api/sms/send', async (req: Request, res: Response) => {
    const senderUid = await verifySmsActorUid(req);
    if (!senderUid) {
      res.status(401).json({ error: 'Sign in or join a group before sending SMS broadcasts.' });
      return;
    }

    const { phones, message, groupName } = req.body as {
      phones?: unknown;
      message?: string;
      groupName?: string;
    };

    const trimmedMsg = (message ?? '').trim();
    if (!trimmedMsg) {
      res.status(400).json({ error: 'SMS message body is required.' });
      return;
    }

    const rawList = Array.isArray(phones) ? phones : [];
    const uniquePhones = Array.from(
      new Set(
        rawList
          .filter((p): p is string => typeof p === 'string')
          .map((p) => normalizeServerPhoneInput(p))
          .filter((p) => E164_PHONE_REGEX.test(p))
      )
    ).slice(0, 250);

    if (uniquePhones.length === 0) {
      res.status(400).json({ error: 'Provide at least one valid phone number (e.g. +15551234567).' });
      return;
    }

    const cfg = parseTwilioConfig();
    if (!cfg.secretsPresent) {
      res.status(503).json({
        ok: false,
        configured: false,
        secretsPresent: false,
        ready: false,
        error:
          'Server carrier SMS (Twilio) is not configured. Tap "Open in SMS App" to send this text directly from your phone or Messages app.',
      });
      return;
    }

    const prefix = groupName?.trim() ? `[${groupName.trim()}] ` : '';
    const fullBody = (
      trimmedMsg.startsWith('[') ? trimmedMsg : `${prefix}${trimmedMsg}`
    ).slice(0, 1200);

    const results = await Promise.allSettled(
      uniquePhones.map((to) => sendTwilioSms(to, fullBody))
    );

    let sentCount = 0;
    let firstError: string | undefined;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        sentCount += 1;
      } else if (r.status === 'fulfilled' && !r.value.ok && !firstError) {
        firstError = r.value.error;
      } else if (r.status === 'rejected' && !firstError) {
        firstError = String(r.reason);
      }
    }

    const failedCount = uniquePhones.length - sentCount;
    if (sentCount === 0 && firstError) {
      res.status(502).json({
        ok: false,
        configured: true,
        secretsPresent: true,
        ready: false,
        sentCount: 0,
        failedCount,
        error: firstError,
      });
      return;
    }

    res.json({
      ok: true,
      configured: true,
      secretsPresent: true,
      ready: true,
      sentCount,
      failedCount,
      error: firstError,
    });
  });

  app.post('/api/sms/dispatch', async (req: Request, res: Response) => {
    const senderUid = await verifySmsActorUid(req);
    if (!senderUid) {
      res.status(401).json({ error: 'Valid session authentication is required.' });
      return;
    }

    const { groupId, groupName, kind, title, body, senderName, channelAccessLevel, extraPhones } =
      req.body as {
        groupId?: string;
        groupName?: string;
        kind?: 'message' | 'event';
        title?: string;
        body?: string;
        senderName?: string;
        channelAccessLevel?: string;
        extraPhones?: string[];
      };

    if (!groupId || (kind !== 'message' && kind !== 'event') || !title?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'groupId, kind, title, and body are required.' });
      return;
    }

    const store = loadSmsSubscriptions();
    const groupSubs = store[groupId] ?? {};
    const targetPhones = new Set<string>();

    for (const [subUid, rec] of Object.entries(groupSubs)) {
      if (subUid === senderUid) continue;
      if (kind === 'message') {
        if (!rec.forMessages) continue;
        if (!roleCanAccessChannelLevel(rec.role, channelAccessLevel)) continue;
      } else if (!rec.forEvents) {
        continue;
      }
      const normSubPhone = normalizeServerPhoneInput(rec.phone);
      if (E164_PHONE_REGEX.test(normSubPhone)) {
        targetPhones.add(normSubPhone);
      }
    }

    if (Array.isArray(extraPhones)) {
      for (const rawPhone of extraPhones.slice(0, 250)) {
        if (typeof rawPhone === 'string') {
          const normExtra = normalizeServerPhoneInput(rawPhone);
          if (E164_PHONE_REGEX.test(normExtra)) {
            targetPhones.add(normExtra);
          }
        }
      }
    }

    const phoneList = Array.from(targetPhones);
    const cfg = parseTwilioConfig();
    if (phoneList.length === 0 || !cfg.secretsPresent) {
      res.json({
        ok: true,
        configured: cfg.secretsPresent,
        eligibleCount: phoneList.length,
        sentCount: 0,
      });
      return;
    }

    const prefix = groupName ? `[${groupName}] ` : '[RallyHub] ';
    const smsText = `${prefix}${title.trim()}: ${body.trim()}${senderName ? ` — ${senderName.trim()}` : ''}`.slice(0, 320);

    const results = await Promise.allSettled(
      phoneList.map((phone) => sendTwilioSms(phone, smsText))
    );
    let sentCount = 0;
    let firstError: string | undefined;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        sentCount += 1;
      } else if (r.status === 'fulfilled' && !r.value.ok && !firstError) {
        firstError = r.value.error;
      } else if (r.status === 'rejected' && !firstError) {
        firstError = String(r.reason);
      }
    }

    res.json({
      ok: sentCount > 0 || !firstError,
      configured: true,
      eligibleCount: phoneList.length,
      sentCount,
      error: firstError,
    });
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { prompt, contextPrompt, history } = req.body as {
        prompt?: string;
        contextPrompt?: string;
        history?: Array<{ isUser: boolean; text: string }>;
      };

      const trimmed = (prompt ?? '').trim();
      if (!trimmed) {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }

      const ai = createAiClient();

      const historyText = Array.isArray(history) && history.length > 0
        ? `Recent conversation:\n${history
            .slice(-6)
            .map((m) => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`)
            .join('\n')}\n\n`
        : '';

      const fullPrompt = [
        contextPrompt ? `${contextPrompt}\n` : '',
        historyText,
        `User request: ${trimmed}`,
      ]
        .filter(Boolean)
        .join('\n');

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const stream = await ai.models.generateContentStream({
        model: AI_MODEL_NAME,
        contents: fullPrompt,
        config: {
          systemInstruction:
            'You are the RallyHub Event & Volunteer Coordination Assistant. ' +
            'Help event organizers, admins, and participants understand schedules, ' +
            'volunteer shift coverage, group channels, and announcements. ' +
            'Be concise, practical, accurate to the group snapshot provided, and never invent dates or shift counts not present in the context.',
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text ?? '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      } else {
        res.status(status).json({ error: message });
      }
    }
  });

  app.post('/api/ai/draft', async (req: Request, res: Response) => {
    try {
      const { topic, contextPrompt } = req.body as {
        topic?: string;
        contextPrompt?: string;
      };
      const trimmed = (topic ?? '').trim();
      if (!trimmed) {
        res.status(400).json({ error: 'Topic is required.' });
        return;
      }

      const ai = createAiClient();
      const fullPrompt = [
        contextPrompt ? `${contextPrompt}\n` : '',
        `Write a clear, engaging group announcement or alert based on this request: ${trimmed}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: AI_MODEL_NAME,
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Short, clear headline under 80 characters',
              },
              body: {
                type: Type.STRING,
                description: 'Helpful announcement or alert message body under 450 characters',
              },
              type: {
                type: Type.STRING,
                enum: ['ANNOUNCEMENT', 'TASK_UPDATE', 'DEADLINE_REMINDER'],
                description: 'Best matching notification category',
              },
            },
            required: ['title', 'body', 'type'],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        res.status(502).json({ error: 'Gemini returned an empty JSON response.' });
        return;
      }

      const parsed = JSON.parse(rawJson) as { title?: string; body?: string; type?: string };
      const title = (parsed.title ?? '').trim().slice(0, 100);
      const body = (parsed.body ?? '').trim().slice(0, 600);
      const type = ['ANNOUNCEMENT', 'TASK_UPDATE', 'DEADLINE_REMINDER'].includes(parsed.type ?? '')
        ? parsed.type
        : 'ANNOUNCEMENT';

      if (!title || !body) {
        res.status(502).json({ error: 'Generated draft was missing a title or body.' });
        return;
      }

      res.json({ title, body, type });
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RallyHub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RallyHub server:', err);
  process.exit(1);
});
