import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import * as webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_MODEL_NAME = 'gemini-4-hydrogen';
const PUSH_DATA_DIR = path.resolve(__dirname, '.data');
const VAPID_KEYS_FILE = path.join(PUSH_DATA_DIR, 'vapid-keys.json');
const PUSH_SUBS_FILE = path.join(PUSH_DATA_DIR, 'push-subscriptions.json');

interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

interface StoredPushSubscription {
  uid: string;
  groupIds: string[];
  subscription: webpush.PushSubscription;
  updatedAt: number;
}

type PushSubscriptionStore = Record<string, StoredPushSubscription>;

function ensurePushDataDir(): void {
  if (!fs.existsSync(PUSH_DATA_DIR)) {
    fs.mkdirSync(PUSH_DATA_DIR, { recursive: true });
  }
}

function loadOrCreateVapidKeys(): VapidKeyPair {
  const envPub = (process.env.VAPID_PUBLIC_KEY ?? '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY ?? '').trim();
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv };
  }
  try {
    if (fs.existsSync(VAPID_KEYS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf-8')) as Partial<VapidKeyPair>;
      if (parsed.publicKey && parsed.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
      }
    }
  } catch {
    // Regenerate keys if file cannot be read
  }
  const generated = webpush.generateVAPIDKeys();
  try {
    ensurePushDataDir();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(generated, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist generated VAPID keys:', err);
  }
  return generated;
}

const VAPID_KEYS = loadOrCreateVapidKeys();
webpush.setVapidDetails('mailto:notifications@rallyhub.app', VAPID_KEYS.publicKey, VAPID_KEYS.privateKey);

function loadPushSubscriptions(): PushSubscriptionStore {
  try {
    if (!fs.existsSync(PUSH_SUBS_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf-8')) as PushSubscriptionStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePushSubscriptions(store: PushSubscriptionStore): void {
  try {
    ensurePushDataDir();
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist push subscriptions:', err);
  }
}

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
      // Fall through to JWT verification
    }
  }

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

async function verifyPushActorUid(req: Request): Promise<string | null> {
  const firebaseUid = await verifyFirebaseBearerUid(req);
  if (firebaseUid) return firebaseUid;
  const guestHeader = req.headers['x-guest-uid'];
  const guestUid = typeof guestHeader === 'string' ? guestHeader.trim() : '';
  if (/^guest_[a-zA-Z0-9]{16,40}$/.test(guestUid)) {
    return guestUid;
  }
  return null;
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

  app.get('/api/push/public-key', (_req: Request, res: Response) => {
    res.json({ publicKey: VAPID_KEYS.publicKey });
  });

  app.post('/api/push/subscribe', async (req: Request, res: Response) => {
    const uid = await verifyPushActorUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Valid session authentication is required.' });
      return;
    }

    const { groupIds, subscription } = req.body as {
      groupIds?: unknown;
      subscription?: webpush.PushSubscription;
    };

    if (
      !subscription ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.endpoint.startsWith('https://') ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      res.status(400).json({ error: 'Valid PushSubscription object is required.' });
      return;
    }

    const cleanGroupIds = Array.isArray(groupIds)
      ? Array.from(
          new Set(
            groupIds.filter(
              (g): g is string => typeof g === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(g)
            )
          )
        ).slice(0, 100)
      : [];

    const store = loadPushSubscriptions();
    store[subscription.endpoint] = {
      uid,
      groupIds: cleanGroupIds,
      subscription,
      updatedAt: Date.now(),
    };
    savePushSubscriptions(store);
    res.json({ ok: true });
  });

  app.post('/api/push/unsubscribe', async (req: Request, res: Response) => {
    const uid = await verifyPushActorUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Valid session authentication is required.' });
      return;
    }
    const { endpoint } = req.body as { endpoint?: string };
    if (typeof endpoint === 'string' && endpoint) {
      const store = loadPushSubscriptions();
      if (store[endpoint]?.uid === uid) {
        delete store[endpoint];
        savePushSubscriptions(store);
      }
    }
    res.json({ ok: true });
  });

  app.post('/api/push/broadcast', async (req: Request, res: Response) => {
    const senderUid = await verifyPushActorUid(req);
    if (!senderUid) {
      res.status(401).json({ error: 'Valid session authentication is required.' });
      return;
    }

    const { groupId, groupName, notificationId, title, body, senderName } = req.body as {
      groupId?: string;
      groupName?: string | null;
      notificationId?: string | null;
      title?: string;
      body?: string;
      senderName?: string | null;
    };

    if (!groupId || !title?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'groupId, title, and body are required.' });
      return;
    }

    const store = loadPushSubscriptions();
    const targets = Object.entries(store).filter(
      ([, entry]) => entry.uid !== senderUid && entry.groupIds.includes(groupId)
    );

    if (targets.length === 0) {
      res.json({ ok: true, sentCount: 0 });
      return;
    }

    const displayTitle = groupName?.trim()
      ? `${groupName.trim()}: ${title.trim()}`
      : title.trim();
    const displayBody = senderName?.trim()
      ? `${body.trim()} — ${senderName.trim()}`
      : body.trim();
    const payload = JSON.stringify({
      title: displayTitle.slice(0, 120),
      body: displayBody.slice(0, 300),
      tag: notificationId ? `rallyhub-alert-${notificationId}` : undefined,
      groupId,
      notificationId: notificationId ?? null,
      url: '/?tab=alerts',
    });

    let sentCount = 0;
    let storeDirty = false;
    await Promise.allSettled(
      targets.map(async ([endpoint, entry]) => {
        try {
          await webpush.sendNotification(entry.subscription, payload, { TTL: 3600 });
          sentCount += 1;
        } catch (err: unknown) {
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            delete store[endpoint];
            storeDirty = true;
          }
        }
      })
    );

    if (storeDirty) {
      savePushSubscriptions(store);
    }

    res.json({ ok: true, sentCount });
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
      server: { middlewareMode: true, hmr: false },
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
