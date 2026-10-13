import { addLog } from './logger';
import type { AgentSettings } from './settings';

const NO_API_KEY_SENTINEL = '__PAGE_AGENT_NO_API_KEY__';

function parseHeaders(rawHeaders: string): Headers {
  const headers = new Headers();
  for (const line of rawHeaders.trim().split(/[\r\n]+/)) {
    const separator = line.indexOf(':');
    if (separator > 0) headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return headers;
}

function safeErrorBody(buffer: ArrayBuffer): string | undefined {
  if (!buffer.byteLength) return undefined;
  return redact(new TextDecoder().decode(buffer).slice(0, 2000));
}

function redact(text: string): string {
  return text
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/("?(?:api[_-]?key|authorization)"?\s*[:=]\s*")[^"]+/gi, '$1[REDACTED]');
}

async function errorBodyFromResponse(response: Response): Promise<string | undefined> {
  if (response.ok) return undefined;
  try { return redact((await response.clone().text()).slice(0, 2000)); }
  catch { return undefined; }
}

export const createProviderFetch = (settings: AgentSettings): typeof fetch => async (input, init = {}) => {
  const request = new Request(input, init);
  const effectiveUrl = settings.appendChatCompletions ? request.url : settings.baseURL;
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  const apiKeyConfigured = Boolean(settings.apiKey);
  if (!apiKeyConfigured || headers.authorization === `Bearer ${NO_API_KEY_SENTINEL}`) delete headers.authorization;
  const authorizationSent = Boolean(headers.authorization);
  const data = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.clone().arrayBuffer();
  const requestDetails = {
    method: request.method,
    requestedUrl: request.url,
    effectiveUrl,
    baseURL: settings.baseURL,
    model: settings.model,
    transport: settings.transport,
    pageOrigin: window.location.origin,
    requestHeaderNames: Object.keys(headers).sort(),
    requestBodyBytes: data?.byteLength ?? 0,
    apiKeyConfigured,
    authorizationHeaderSent: authorizationSent,
    appendChatCompletions: settings.appendChatCompletions,
  };
  addLog('request', 'Sending request to provider/cloud', requestDetails);
  const startedAt = performance.now();

  if (settings.transport === 'native') {
    try {
      const pageFetch = typeof unsafeWindow?.fetch === 'function'
        ? unsafeWindow.fetch.bind(unsafeWindow)
        : window.fetch.bind(window);
      const response = await pageFetch(effectiveUrl, {
        method: request.method,
        headers,
        body: data,
        signal: request.signal,
        credentials: 'omit',
      });
      const details = {
        requestedUrl: request.url,
        effectiveUrl,
        finalUrl: response.url,
        status: response.status,
        statusText: response.statusText,
        durationMs: Math.round(performance.now() - startedAt),
        transport: settings.transport,
        pageOrigin: window.location.origin,
        responseType: response.headers.get('content-type') ?? 'unknown',
        requestId: response.headers.get('x-fc-request-id') ?? undefined,
        allowedOrigin: response.headers.get('access-control-allow-origin') ?? 'not exposed',
        ...(response.ok ? {} : { providerError: await errorBodyFromResponse(response) }),
      };
      addLog('response', 'Received response from provider/cloud', details);
      if (!response.ok) addLog('error', `Provider returned HTTP ${response.status}`, details);
      return response;
    } catch (error) {
      const details = {
        requestedUrl: request.url,
        effectiveUrl,
        transport: settings.transport,
        pageOrigin: window.location.origin,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        hint: 'Check the browser Network tab for CORS/preflight details and confirm Native page fetch is selected.',
      };
      addLog('error', 'Native page fetch failed', details);
      throw error;
    }
  }

  return new Promise<Response>((resolve, reject) => {
    const xhr = GM_xmlhttpRequest({
      method: request.method,
      url: effectiveUrl,
      headers,
      data,
      responseType: 'arraybuffer',
      onload: response => {
        const details = {
          requestedUrl: request.url,
          effectiveUrl,
          finalUrl: response.finalUrl,
          status: response.status,
          statusText: response.statusText,
          durationMs: Math.round(performance.now() - startedAt),
          transport: settings.transport,
          pageOrigin: window.location.origin,
          ...(response.status >= 400 ? { providerError: safeErrorBody(response.response) } : {}),
        };
        addLog('response', 'Received response from provider/cloud', details);
        if (response.status >= 400) addLog('error', `Provider returned HTTP ${response.status}`, details);
        resolve(new Response(response.response, {
          status: response.status,
          statusText: response.statusText,
          headers: parseHeaders(response.responseHeaders),
        }));
      },
      onerror: () => {
        addLog('error', 'Userscript network request failed', { ...requestDetails });
        reject(new TypeError(`Network request failed for ${effectiveUrl}`));
      },
      ontimeout: () => {
        addLog('error', 'Userscript network request timed out', { ...requestDetails });
        reject(new DOMException('The request timed out.', 'TimeoutError'));
      },
    });
    if (request.signal.aborted) xhr.abort();
    request.signal.addEventListener('abort', () => xhr.abort(), { once: true });
  });
};

export { NO_API_KEY_SENTINEL };
