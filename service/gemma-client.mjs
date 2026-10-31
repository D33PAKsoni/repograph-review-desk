// Minimal Gemma client for the Gemini API. The API key never leaves this module.
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com';
const MAX_RESPONSE_BYTES = 256 * 1024;

export class GemmaError extends Error {
  // kind: CREDENTIALS | REJECTED | RATE_LIMITED | TIMEOUT | TRANSIENT | INVALID_OUTPUT
  constructor(kind, detail = '') {
    super(kind);
    this.name = 'GemmaError';
    this.kind = kind;
    this.detail = detail;
  }
}

async function readCapped(res, limit) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new GemmaError('INVALID_OUTPUT', 'Provider response too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createGemmaClient({ apiKey, model, fetchImpl = globalThis.fetch, baseUrl = DEFAULT_BASE }) {
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  return {
    async generate(prompt, timeoutMs) {
      if (typeof apiKey !== 'string' || !/^[\x21-\x7E]{8,}$/.test(apiKey)) throw new GemmaError('CREDENTIALS');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
      try {
        let res;
        try {
          res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            // One user text only: Gemma on the Gemini API is not assumed to support system
            // instructions, JSON mode, tools or thinking config.
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
            }),
            signal: controller.signal,
            redirect: 'error',
          });
        } catch {
          throw new GemmaError(controller.signal.aborted ? 'TIMEOUT' : 'TRANSIENT');
        }
        try {
          if (!res.ok) {
            const body = await readCapped(res, 8 * 1024).catch(() => '');
            if (res.status === 429) throw new GemmaError('RATE_LIMITED');
            if (res.status === 401 || res.status === 403 || /API[_ ]KEY/i.test(body)) throw new GemmaError('CREDENTIALS');
            if (res.status === 408 || res.status >= 500) throw new GemmaError('TRANSIENT');
            throw new GemmaError('REJECTED');
          }
          const raw = await readCapped(res, MAX_RESPONSE_BYTES);
          let data;
          try { data = JSON.parse(raw); } catch { throw new GemmaError('INVALID_OUTPUT', 'Provider returned invalid JSON'); }
          const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : undefined;
          if (!candidate) throw new GemmaError('INVALID_OUTPUT', 'No candidate returned');
          if (candidate.finishReason === 'MAX_TOKENS') throw new GemmaError('INVALID_OUTPUT', 'Output was truncated');
          if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new GemmaError('INVALID_OUTPUT', 'Generation did not finish normally');
          const parts = Array.isArray(candidate.content?.parts) ? candidate.content.parts : [];
          const text = parts.filter(p => p && typeof p.text === 'string' && p.thought !== true).map(p => p.text).join('').trim();
          if (!text) throw new GemmaError('INVALID_OUTPUT', 'Empty response');
          return text;
        } catch (error) {
          if (error instanceof GemmaError) throw error;
          throw new GemmaError(controller.signal.aborted ? 'TIMEOUT' : 'TRANSIENT');
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
