import express from 'express';
import type { Request, Response } from 'express';
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

interface SmsSubscriberRecord {
  phone: string;
  role: string;
  forMessages: boolean;
  forEvents: boolean;
  updatedAt: number;
}

type SmsSubscriptionStore = Record<string, Record<string, SmsSubscriberRecord>>;

function loadFirebaseWebApiKey(): string {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey ?? '';
  } catch {
    return '';
  }
}

const FIREBASE_WEB_API_KEY = loadFirebaseWebApiKey();

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

function getTwilioConfig(): { accountSid: string; authToken: string; fromNumber: string } | null {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim();
  const fromNumber = (process.env.TWILIO_FROM_NUMBER ?? '').trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

async function verifyFirebaseBearerUid(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const idToken = match?.[1]?.trim();
  if (!idToken || !FIREBASE_WEB_API_KEY) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { users?: Array<{ localId?: string }> };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
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
  const cfg = getTwilioConfig();
  if (!cfg) {
    return {
      ok: false,
      error: 'Twilio SMS credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are not configured on the server.',
    };
  }
  const params = new URLSearchParams({
    To: to,
    From: cfg.fromNumber,
    Body: body.slice(0, 1400),
  });
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
  const payload = (await resp.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!resp.ok) {
    return { ok: false, error: payload.message || `Twilio API error (${resp.status})` };
  }
  return { ok: true, sid: payload.sid };
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

  app.get('/api/sms/status', (_req: Request, res: Response) => {
    res.json({ configured: getTwilioConfig() !== null });
  });

  app.post('/api/sms/subscriptions', async (req: Request, res: Response) => {
    const uid = await verifyFirebaseBearerUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Valid Firebase authentication token is required.' });
      return;
    }

    const { groupMemberships, phone, enabled, forMessages, forEvents } = req.body as {
      groupMemberships?: Array<{ groupId?: string; role?: string }>;
      phone?: string | null;
      enabled?: boolean;
      forMessages?: boolean;
      forEvents?: boolean;
    };

    const cleanPhone = (phone ?? '').trim();
    if (enabled && !E164_PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({ error: 'Enter a valid E.164 phone number (e.g. +15551234567).' });
      return;
    }

    const store = loadSmsSubscriptions();
    // Clear existing entries for uid so deactivated groups stay clean
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
    res.json({ ok: true, configured: getTwilioConfig() !== null });
  });

  app.post('/api/sms/test', async (req: Request, res: Response) => {
    const uid = await verifyFirebaseBearerUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Valid Firebase authentication token is required.' });
      return;
    }

    const { phone, groupName } = req.body as { phone?: string; groupName?: string };
    const cleanPhone = (phone ?? '').trim();
    if (!E164_PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({ error: 'Enter a valid E.164 phone number (e.g. +15551234567).' });
      return;
    }

    const cfg = getTwilioConfig();
    if (!cfg) {
      res.status(503).json({
        configured: false,
        error:
          'Twilio SMS credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are not configured on the server.',
      });
      return;
    }

    const result = await sendTwilioSms(
      cleanPhone,
      `RallyHub SMS alerts are active${groupName ? ` for ${groupName}` : ''}! You will receive text updates for messages and events based on your preferences.`
    );
    if (!result.ok) {
      res.status(502).json({ configured: true, error: result.error });
      return;
    }
    res.json({ ok: true, configured: true, sid: result.sid });
  });

  app.post('/api/sms/dispatch', async (req: Request, res: Response) => {
    const senderUid = await verifyFirebaseBearerUid(req);
    if (!senderUid) {
      res.status(401).json({ error: 'Valid Firebase authentication token is required.' });
      return;
    }

    const { groupId, groupName, kind, title, body, senderName, channelAccessLevel } = req.body as {
      groupId?: string;
      groupName?: string;
      kind?: 'message' | 'event';
      title?: string;
      body?: string;
      senderName?: string;
      channelAccessLevel?: string;
    };

    if (!groupId || (kind !== 'message' && kind !== 'event') || !title?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'groupId, kind, title, and body are required.' });
      return;
    }

    const store = loadSmsSubscriptions();
    const groupSubs = store[groupId] ?? {};
    const recipients: SmsSubscriberRecord[] = [];
    for (const [subUid, rec] of Object.entries(groupSubs)) {
      if (subUid === senderUid) continue;
      if (kind === 'message') {
        if (!rec.forMessages) continue;
        if (!roleCanAccessChannelLevel(rec.role, channelAccessLevel)) continue;
      } else if (!rec.forEvents) {
        continue;
      }
      recipients.push(rec);
    }

    const configured = getTwilioConfig() !== null;
    if (recipients.length === 0 || !configured) {
      res.json({ ok: true, configured, eligibleCount: recipients.length, sentCount: 0 });
      return;
    }

    const prefix = groupName ? `[${groupName}] ` : '[RallyHub] ';
    const smsText = `${prefix}${title.trim()}: ${body.trim()}${senderName ? ` — ${senderName.trim()}` : ''}`.slice(0, 320);

    const results = await Promise.allSettled(
      recipients.map((rec) => sendTwilioSms(rec.phone, smsText))
    );
    const sentCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.ok
    ).length;

    res.json({
      ok: true,
      configured,
      eligibleCount: recipients.length,
      sentCount,
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
