declare function GM_getValue<T>(key: string, fallback: T): T;
declare function GM_setValue<T>(key: string, value: T): void;
declare function GM_deleteValue(key: string): void;
declare function GM_registerMenuCommand(name: string, callback: () => void): void;
declare function GM_setClipboard(data: string, type?: string): void;
declare const unsafeWindow: Window & typeof globalThis;
declare const GM_info: { scriptHandler?: string; version?: string; script?: { version?: string } };

interface GMXmlHttpResponse {
  status: number;
  statusText: string;
  response: ArrayBuffer;
  responseHeaders: string;
  finalUrl: string;
}

interface GMXmlHttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  data?: string | ArrayBuffer;
  responseType: 'arraybuffer';
  onload: (response: GMXmlHttpResponse) => void;
  onerror: () => void;
  ontimeout: () => void;
}

declare function GM_xmlhttpRequest(options: GMXmlHttpRequestOptions): { abort(): void };
