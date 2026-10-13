export interface AgentSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  appendChatCompletions: boolean;
  transport: 'native' | 'userscript';
}

const LEGACY_SETTINGS_KEY = 'page-agent-settings-v1';
const BASE_URL_KEY = 'VITE_LLM_BASE_URL';
const API_KEY_KEY = 'VITE_LLM_API_KEY';
const MODEL_KEY = 'VITE_LLM_MODEL';
const APPEND_PATH_KEY = 'VITE_LLM_APPEND_CHAT_COMPLETIONS';
const TRANSPORT_KEY = 'VITE_LLM_TRANSPORT';

export const DEFAULT_SETTINGS: AgentSettings = {
  baseURL: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
  apiKey: '',
  model: 'qwen3.5-plus',
  appendChatCompletions: true,
  transport: 'native',
};

export interface ProviderPreset {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  appendChatCompletions: boolean;
  notes: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gemini',
    name: 'Google Gemini (OpenAI Compat)',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    appendChatCompletions: true,
    notes: 'Google AI Studio key',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    appendChatCompletions: true,
    notes: 'Official OpenAI key',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    appendChatCompletions: true,
    notes: 'DeepSeek API key',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    appendChatCompletions: true,
    notes: 'Groq API key',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3.2',
    appendChatCompletions: true,
    notes: 'Keyless local model',
  },
  {
    id: 'qwen',
    name: 'Qwen Testing Server',
    baseURL: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
    model: 'qwen3.5-plus',
    appendChatCompletions: true,
    notes: 'Default demo endpoint',
  },
];

const SITE_RULES_KEY = 'PAGE_AGENT_SITE_RULES_V1';

export function getAllSiteInstructions(): Record<string, string> {
  try {
    return GM_getValue<Record<string, string>>(SITE_RULES_KEY, {});
  } catch {
    return {};
  }
}

export function getSiteInstructions(domain: string = window.location.hostname): string {
  const all = getAllSiteInstructions();
  return all[domain] || '';
}

export function saveSiteInstructions(domain: string, instructions: string): void {
  const all = getAllSiteInstructions();
  if (!instructions.trim()) {
    delete all[domain];
  } else {
    all[domain] = instructions.trim();
  }
  GM_setValue(SITE_RULES_KEY, all);
}

export function clearSiteInstructions(domain: string): void {
  const all = getAllSiteInstructions();
  delete all[domain];
  GM_setValue(SITE_RULES_KEY, all);
}

export function getSettings(): AgentSettings {
  try {
    const baseURL = GM_getValue<string | null>(BASE_URL_KEY, null);
    const apiKey = GM_getValue<string | null>(API_KEY_KEY, null);
    const model = GM_getValue<string | null>(MODEL_KEY, null);
    const appendChatCompletions = GM_getValue<boolean | null>(APPEND_PATH_KEY, null);
    const transport = GM_getValue<'native' | 'userscript' | null>(TRANSPORT_KEY, null);
    if (baseURL !== null || apiKey !== null || model !== null || appendChatCompletions !== null || transport !== null) {
      return normalizeSettings({
        baseURL: baseURL ?? DEFAULT_SETTINGS.baseURL,
        apiKey: apiKey ?? DEFAULT_SETTINGS.apiKey,
        model: model ?? DEFAULT_SETTINGS.model,
        appendChatCompletions: appendChatCompletions ?? DEFAULT_SETTINGS.appendChatCompletions,
        transport: transport ?? DEFAULT_SETTINGS.transport,
      });
    }

    const legacy = GM_getValue<Partial<AgentSettings> | null>(LEGACY_SETTINGS_KEY, null);
    if (legacy) {
      const migrated = normalizeSettings({ ...DEFAULT_SETTINGS, ...legacy });
      saveSettings(migrated);
      GM_deleteValue(LEGACY_SETTINGS_KEY);
      return migrated;
    }
    return { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AgentSettings): void {
  const normalized = normalizeSettings(settings);
  GM_setValue(BASE_URL_KEY, normalized.baseURL);
  GM_setValue(API_KEY_KEY, normalized.apiKey);
  GM_setValue(MODEL_KEY, normalized.model);
  GM_setValue(APPEND_PATH_KEY, normalized.appendChatCompletions);
  GM_setValue(TRANSPORT_KEY, normalized.transport);
  GM_deleteValue(LEGACY_SETTINGS_KEY);
}

export function clearSettings(): AgentSettings {
  GM_deleteValue(BASE_URL_KEY);
  GM_deleteValue(API_KEY_KEY);
  GM_deleteValue(MODEL_KEY);
  GM_deleteValue(APPEND_PATH_KEY);
  GM_deleteValue(TRANSPORT_KEY);
  GM_deleteValue(LEGACY_SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS };
}

export function normalizeSettings(settings: AgentSettings): AgentSettings {
  const baseURL = settings.baseURL.trim().replace(/\/+$/, '');
  return {
    baseURL,
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    appendChatCompletions: Boolean(settings.appendChatCompletions),
    transport: settings.transport === 'userscript' ? 'userscript' : 'native',
  };
}

export function validateSettings(settings: AgentSettings): string | null {
  let endpoint: URL;
  try {
    endpoint = new URL(settings.baseURL);
  } catch {
    return 'Enter a valid endpoint URL.';
  }
  if (!['https:', 'http:'].includes(endpoint.protocol)) return 'Use an HTTP or HTTPS endpoint.';
  if (!settings.model.trim()) return 'Enter a model name.';
  if (settings.apiKey.trim().toLowerCase() === 'your-api-key') {
    return 'Leave the API key empty, use NA if the provider accepts it, or enter a real key.';
  }
  return null;
}
