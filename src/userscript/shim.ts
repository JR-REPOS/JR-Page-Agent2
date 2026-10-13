// Browser polyfill for Userscript GM_* APIs when running in standard browser/preview
export interface GMXmlHttpResponse {
  status: number;
  statusText: string;
  response: ArrayBuffer;
  responseHeaders: string;
  finalUrl: string;
}

export interface GMXmlHttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  data?: string | ArrayBuffer;
  responseType: 'arraybuffer';
  onload: (response: GMXmlHttpResponse) => void;
  onerror: () => void;
  ontimeout: () => void;
}

const g = (typeof globalThis !== 'undefined' ? globalThis : window) as Record<string, unknown>;

if (typeof g.GM_getValue === 'undefined') {
  g.GM_getValue = function <T>(key: string, fallback: T): T {
    try {
      const val = localStorage.getItem(`GM_${key}`);
      return val !== null ? (JSON.parse(val) as T) : fallback;
    } catch {
      return fallback;
    }
  };
}

if (typeof g.GM_setValue === 'undefined') {
  g.GM_setValue = function <T>(key: string, value: T): void {
    try {
      localStorage.setItem(`GM_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('GM_setValue failed:', e);
    }
  };
}

if (typeof g.GM_deleteValue === 'undefined') {
  g.GM_deleteValue = function (key: string): void {
    try {
      localStorage.removeItem(`GM_${key}`);
    } catch (e) {
      console.warn('GM_deleteValue failed:', e);
    }
  };
}

if (typeof g.GM_registerMenuCommand === 'undefined') {
  g.GM_registerMenuCommand = function (name: string, callback: () => void): void {
    const commands = ((g.__GM_MENU_COMMANDS__ as Record<string, () => void>) || {});
    commands[name] = callback;
    g.__GM_MENU_COMMANDS__ = commands;
  };
}

if (typeof g.GM_setClipboard === 'undefined') {
  g.GM_setClipboard = function (data: string): void {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(data).catch(() => {});
      }
    } catch {
      // fallback
    }
  };
}

if (typeof g.unsafeWindow === 'undefined') {
  g.unsafeWindow = window;
}

if (typeof g.GM_info === 'undefined') {
  g.GM_info = {
    scriptHandler: 'Page Agent Web Environment',
    version: '0.6.0',
    script: { version: '0.6.0' },
  };
}

if (typeof g.GM_xmlhttpRequest === 'undefined') {
  g.GM_xmlhttpRequest = function (options: GMXmlHttpRequestOptions) {
    const controller = new AbortController();
    fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.data,
      signal: controller.signal,
    })
      .then(async res => {
        const buffer = await res.arrayBuffer();
        const headersArr: string[] = [];
        res.headers.forEach((val, key) => headersArr.push(`${key}: ${val}`));
        options.onload({
          status: res.status,
          statusText: res.statusText,
          response: buffer,
          responseHeaders: headersArr.join('\r\n'),
          finalUrl: res.url,
        });
      })
      .catch(err => {
        if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') return;
        options.onerror();
      });

    return {
      abort() {
        controller.abort();
      },
    };
  };
}

export function safeConfirm(message: string): boolean {
  try {
    return window.confirm(message);
  } catch {
    return true;
  }
}
