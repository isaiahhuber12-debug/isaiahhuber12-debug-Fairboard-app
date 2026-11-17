import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_MODEL_NAME = 'gemini-4-hydrogen';

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
