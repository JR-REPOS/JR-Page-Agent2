export type LogRoute = 'lifecycle' | 'navigation' | 'diagnostic' | 'request' | 'response' | 'error';

export interface LogEntry {
  id: number;
  timestamp: string;
  route: LogRoute;
  message: string;
  details?: Record<string, unknown>;
}

export type LogRoutePreferences = Record<LogRoute, boolean>;

const LOGS_KEY = 'PAGE_AGENT_LOGS_V1';
const ROUTES_KEY = 'PAGE_AGENT_LOG_ROUTES';
const MAX_LOGS = 250;
const DEFAULT_ROUTES: LogRoutePreferences = {
  lifecycle: true,
  navigation: true,
  diagnostic: true,
  request: true,
  response: true,
  error: true,
};

let entries = readValue<LogEntry[]>(LOGS_KEY, []);
let routes = { ...DEFAULT_ROUTES, ...readValue<Partial<LogRoutePreferences>>(ROUTES_KEY, {}) };
const listeners = new Set<() => void>();

function readValue<T>(key: string, fallback: T): T {
  try { return GM_getValue<T>(key, fallback); }
  catch { return fallback; }
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function addLog(route: LogRoute, message: string, details?: Record<string, unknown>): void {
  if (!routes[route]) return;
  entries = [...entries, {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    route,
    message,
    details,
  }].slice(-MAX_LOGS);
  GM_setValue(LOGS_KEY, entries);
  notify();
}

export function clearLogs(): void {
  entries = [];
  GM_deleteValue(LOGS_KEY);
  notify();
}

export function getLogs(): readonly LogEntry[] {
  return entries;
}

export function getLogRoutes(): LogRoutePreferences {
  return { ...routes };
}

export function setLogRoute(route: LogRoute, enabled: boolean): void {
  routes = { ...routes, [route]: enabled };
  GM_setValue(ROUTES_KEY, routes);
  notify();
}

export function subscribeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatLogs(): string {
  if (!entries.length) return 'No Page Agent logs recorded.';
  return entries.map(entry => {
    const details = entry.details ? `\n${JSON.stringify(entry.details, null, 2)}` : '';
    return `[${entry.timestamp}] [${entry.route.toUpperCase()}] ${entry.message}${details}`;
  }).join('\n\n');
}

export function diagnosticSnapshot(version: string): Record<string, unknown> {
  return {
    version,
    pageUrl: window.location.href,
    pageOrigin: window.location.origin,
    secureContext: window.isSecureContext,
    online: navigator.onLine,
    language: navigator.language,
    userAgent: navigator.userAgent,
    userscriptManager: typeof GM_info === 'undefined' ? 'unknown' : GM_info.scriptHandler,
    userscriptEngineVersion: typeof GM_info === 'undefined' ? 'unknown' : GM_info.version,
  };
}

export function exportLogsJSON(version = '0.6.0'): string {
  const data = {
    generatedAt: new Date().toISOString(),
    environment: diagnosticSnapshot(version),
    activeRoutes: routes,
    logCount: entries.length,
    logs: entries,
  };
  return JSON.stringify(data, null, 2);
}

export function exportGitHubIssueMarkdown(version = '0.6.0'): string {
  const env = diagnosticSnapshot(version);
  const errorLogs = entries.filter(e => e.route === 'error');
  const recentLogs = entries.slice(-15);

  return `### Page Agent Everywhere Diagnostic Report

**Environment Info:**
- Version: \`${version}\`
- URL: \`${env.pageUrl}\`
- User Agent: \`${env.userAgent}\`
- Userscript Manager: \`${env.userscriptManager}\` (Engine: \`${env.userscriptEngineVersion}\`)
- Secure Context: \`${env.secureContext}\` | Online: \`${env.online}\`

**Recorded Errors (${errorLogs.length}):**
${errorLogs.length ? errorLogs.map(e => `- [${e.timestamp}] **${e.message}** ${e.details ? '`' + JSON.stringify(e.details) + '`' : ''}`).join('\n') : '_No errors recorded._'}

<details>
<summary>Recent Logs (${recentLogs.length} of ${entries.length})</summary>

\`\`\`
${formatLogs()}
\`\`\`

</details>
`;
}
