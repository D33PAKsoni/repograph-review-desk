export class ApiError extends Error {
  constructor(public code: string, public retryable: boolean, public status: number) {
    super(friendlyErrors[code] ?? 'The request could not be completed. Please check the service connection.');
  }
}
const friendlyErrors: Record<string, string> = {
  INSUFFICIENT_EVIDENCE: 'This scenario has no usable evidence. No briefing was generated. Empty results do not establish that a change is safe.',
  RATE_LIMITED: 'The briefing service is receiving too many requests. Wait a moment, then retry.',
  INVALID_MODEL_OUTPUT: 'The model response could not be validated. No briefing was accepted. You can retry.',
  MODEL_UNAVAILABLE: 'The model service is unavailable or is not configured. You can retry once the service is available.',
  MODEL_TIMEOUT: 'The model took too long to respond. No briefing was generated. You can retry.',
  INVALID_REQUEST: 'The request was not accepted. Check the selected scenario and the 500-character intention limit.',
  NOT_FOUND: 'This scenario or endpoint is no longer available. Reload the catalog.',
  NETWORK_ERROR: 'The service could not be reached. Check your connection and retry.',
  INVALID_RESPONSE: 'The service returned an unexpected response. Reload or contact the team.',
};
export async function request<T>(path: string, signal: AbortSignal, body?: object): Promise<T> {
  try {
    const response = await fetch(`/api/v1/${path}`, {
      signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => { throw new ApiError('INVALID_RESPONSE', false, response.status); });
    if (payload?.schemaVersion !== '1.0.0') throw new ApiError('INVALID_RESPONSE', false, response.status);
    if (!response.ok) throw new ApiError(payload.error?.code ?? 'INVALID_RESPONSE', payload.error?.retryable === true, response.status);
    if (!payload.data || typeof payload.data !== 'object') throw new ApiError('INVALID_RESPONSE', false, response.status);
    return payload.data as T;
  } catch (error) {
    if (signal.aborted || error instanceof ApiError) throw error;
    throw new ApiError('NETWORK_ERROR', true, 0);
  }
}
export function safeSource(value: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : undefined; }
  catch { return undefined; }
}
