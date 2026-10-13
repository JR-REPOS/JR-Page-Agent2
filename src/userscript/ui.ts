import { safeConfirm } from './shim';
import {
  addLog,
  clearLogs,
  diagnosticSnapshot,
  formatLogs,
  exportLogsJSON,
  exportGitHubIssueMarkdown,
  getLogRoutes,
  getLogs,
  setLogRoute,
  subscribeLogs,
  type LogRoute,
} from './logger';
import type { UserProfile } from './profile';
import {
  PROVIDER_PRESETS,
  getSiteInstructions,
  saveSiteInstructions,
  clearSiteInstructions,
  type AgentSettings,
} from './settings';

const VERSION = '0.6.0';
const routes: LogRoute[] = ['lifecycle', 'navigation', 'diagnostic', 'request', 'response', 'error'];

export interface UserscriptUI {
  setOpen(open: boolean): void;
  openSettings(settings: AgentSettings, error?: string): void;
  openLogs(): void;
  close(): void;
}

export function createUI(
  onToggle: () => void,
  onSave: (settings: AgentSettings) => void,
  getUserProfile: () => UserProfile,
  onSaveProfile: (profile: UserProfile) => void,
  onClearProfile: () => void
): UserscriptUI {
  const host = document.createElement('div');
  host.id = 'page-agent-userscript-ui';
  const root = host.attachShadow({ mode: 'open' });
  const currentHost = typeof window !== 'undefined' && window.location ? window.location.hostname : 'current site';

  root.innerHTML = `<style>
    :host{all:initial;color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}button,input,select,textarea{font:inherit}
    button{color:#f8f7ff;background:#271c3b;border:1px solid #7557a7;border-radius:9px;padding:8px 12px;cursor:pointer}button:hover{background:#34244f;border-color:#9d78dd}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}
    #launcher{position:fixed;left:var(--launcher-left,14px);top:var(--launcher-top,12px);z-index:2147483647;font-weight:700;background:#151022;box-shadow:0 6px 22px #0008;cursor:grab;user-select:none;touch-action:none;transition:border-color .15s}
    #launcher:active{cursor:grabbing}
    dialog{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid #4f3b6c;border-radius:18px;background:#171122;color:#f8f7ff;box-shadow:0 28px 90px #000c;overflow:hidden}dialog::backdrop{background:#0b071399;backdrop-filter:blur(3px)}
    .shell{display:flex;flex-direction:column;max-height:calc(100dvh - 24px)}.head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 13px}.title{font-size:21px;font-weight:750}.version{font-size:11px;color:#a99abb;margin-left:8px}
    .tabs{display:flex;gap:5px;padding:0 22px;border-bottom:1px solid #3b304b;overflow-x:auto}.tab{border:0;border-radius:8px 8px 0 0;background:transparent;color:#bdb0cb;white-space:nowrap}.tab[aria-selected=true]{color:#fff;background:#2c2040;box-shadow:inset 0 -2px #9f7aea}
    .body{padding:20px 22px 22px;overflow:auto;scrollbar-width:none}.body::-webkit-scrollbar,.logbox::-webkit-scrollbar{display:none}.panel[hidden]{display:none}.muted{color:#b8aac8;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wide{grid-column:1/-1}
    label{display:block;color:#ddd4e8;font-size:13px}.field{display:block;width:100%;margin-top:6px;padding:10px 11px;color:#fff;background:#21182f;border:1px solid #56436e;border-radius:9px}.field::placeholder{color:#81758e}.check{display:flex;align-items:center;gap:8px;margin-top:10px}.check input{accent-color:#8b5cf6}
    .actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:9px;margin-top:18px}.primary{background:#6d3bd1;border-color:#8b5cf6}.danger{border-color:#ef4444;color:#fecaca}.status{min-height:20px;color:#c4b5fd}.error{color:#fda4af}
    fieldset{border:1px solid #453654;border-radius:10px;padding:10px 12px;margin:0 0 14px}.routes{display:flex;flex-wrap:wrap;gap:8px 16px}.routes label{display:flex;align-items:center;gap:5px}.loghead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.logbox{height:min(390px,45dvh);overflow:auto;margin-top:10px;padding:13px;border:1px solid #443552;border-radius:10px;background:#09070d;color:#d9f9df;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;scrollbar-width:none}
    @media(max-width:600px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.head,.body{padding-left:15px;padding-right:15px}.tabs{padding-left:15px}}
  </style><button id="launcher" type="button">Page Agent</button><dialog><div class="shell">
    <header class="head"><div><span class="title">Page Agent</span><span class="version">v${VERSION}</span></div><button data-close type="button">Close</button></header>
    <nav class="tabs" role="tablist">
      <button class="tab" data-tab="settings" type="button">Settings</button>
      <button class="tab" data-tab="siteRules" type="button">Site Memory</button>
      <button class="tab" data-tab="details" type="button">Details</button>
      <button class="tab" data-tab="logs" type="button">Logs <span data-log-count></span></button>
    </nav>
    <main class="body">
      <section class="panel" data-panel="settings">
        <form data-settings-form>
          <p class="muted">Provider configuration is saved in your userscript manager. API keys are optional.</p>
          <div style="margin-bottom:14px;">
            <label>⚡ Quick Provider Preset
              <select class="field" data-preset-select>
                <option value="">-- Choose a Preset (Gemini, OpenAI, DeepSeek, Ollama, Groq) --</option>
                ${PROVIDER_PRESETS.map(p => `<option value="${p.id}">${p.name} (${p.model})</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid">
            <label>Model<input class="field" name="model" placeholder="qwen3.5-plus" required></label>
            <label>Request transport<select class="field" name="transport"><option value="native">Native page fetch (recommended)</option><option value="userscript">Userscript GM request (fallback)</option></select></label>
            <label class="wide">Base URL<input class="field" name="baseURL" type="url" required></label>
            <label class="wide check"><input name="appendChatCompletions" type="checkbox"> Append <code>/chat/completions</code></label>
            <label class="wide">API key <span class="muted">(optional)</span><input class="field" name="apiKey" type="password" placeholder="Leave empty for keyless providers" autocomplete="off"></label>
          </div>
          <p class="status error" data-settings-error></p>
          <div class="actions"><button type="submit" class="primary">Save settings</button></div>
        </form>
      </section>

      <section class="panel" data-panel="siteRules" hidden>
        <form data-site-rules-form>
          <p class="muted">Custom instructions for <strong>${currentHost}</strong>. When configured, these rules are injected into Page Agent's prompt on this website only.</p>
          <label class="wide">Site-Specific Instructions
            <textarea class="field" name="siteRulesText" rows="6" placeholder="e.g. Always extract tables as CSV. Never click submit on checkout pages. Prefer concise bullet responses."></textarea>
          </label>
          <p class="status" data-site-rules-status></p>
          <div class="actions">
            <button data-clear-site-rules class="danger" type="button">Clear for this site</button>
            <button class="primary" type="submit">Save site rules</button>
          </div>
        </form>
      </section>

      <section class="panel" data-panel="details" hidden>
        <form data-profile-form>
          <p class="muted">Optional details the agent can use when relevant. Stored locally by your userscript manager. Do not enter passwords, API keys, payment details, or security answers.</p>
          <div class="grid">
            ${profileField('firstName','First name')}${profileField('middleName','Middle name')}${profileField('surname','Surname')}${profileField('nickname','Nickname')}${profileField('age','Age','number')}${profileField('gender','Gender / sex')}${profileField('pronouns','Pronouns')}${profileField('email','Email','email')}${profileField('phone','Phone','tel')}${profileField('website','Website','url')}${profileField('address','Street address','text',true)}${profileField('city','City')}${profileField('region','State / region')}${profileField('postalCode','Postal code')}${profileField('country','Country')}${profileField('occupation','Occupation')}${profileField('company','Company')}${profileArea('likes','Likes')}${profileArea('hobbies','Hobbies')}${profileArea('about','About me')}${profileArea('additionalNotes','Additional notes')}
          </div>
          <p class="status" data-profile-status></p>
          <div class="actions">
            <button data-clear-profile class="danger" type="button">Clear details</button>
            <button class="primary" type="submit">Save details</button>
          </div>
        </form>
      </section>

      <section class="panel" data-panel="logs" hidden>
        <p class="muted">Live diagnostics for v${VERSION}. Secrets and authorization values are never written to logs.</p>
        <fieldset><legend>Active log routes</legend><div class="routes">${routes.map(route => `<label><input type="checkbox" data-route="${route}"> ${route}</label>`).join('')}</div></fieldset>
        <div class="loghead">
          <span class="status" data-log-status></span>
          <div>
            <button data-snapshot type="button">Snapshot</button>
            <button data-copy type="button">Copy</button>
            <button data-export-json type="button">JSON</button>
            <button data-github-report type="button">GitHub Issue</button>
            <button data-clear class="danger" type="button">Clear</button>
          </div>
        </div>
        <pre class="logbox" data-log-output tabindex="0"></pre>
      </section>
    </main></div></dialog>`;

  document.documentElement.appendChild(host);
  const dialog = root.querySelector('dialog')!;
  const settingsForm = root.querySelector<HTMLFormElement>('[data-settings-form]')!;
  const profileForm = root.querySelector<HTMLFormElement>('[data-profile-form]')!;
  const siteRulesForm = root.querySelector<HTMLFormElement>('[data-site-rules-form]')!;
  const presetSelect = root.querySelector<HTMLSelectElement>('[data-preset-select]');
  const siteRulesText = siteRulesForm.querySelector<HTMLTextAreaElement>('textarea[name="siteRulesText"]')!;
  const siteRulesStatus = root.querySelector<HTMLElement>('[data-site-rules-status]')!;

  const sf = (name: string) => settingsForm.elements.namedItem(name) as HTMLInputElement;
  const pf = (name: string) => profileForm.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const output = root.querySelector<HTMLElement>('[data-log-output]')!;
  const logStatus = root.querySelector<HTMLElement>('[data-log-status]')!;
  const profileStatus = root.querySelector<HTMLElement>('[data-profile-status]')!;

  let activeTab = 'settings';
  const fillProfile = (profile: UserProfile) => Object.entries(profile).forEach(([key, value]) => { pf(key).value = value; });
  const fillSiteRules = () => { siteRulesText.value = getSiteInstructions(currentHost); };

  const showTab = (tab: string) => {
    activeTab = tab;
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    if (tab === 'logs') output.scrollTop = output.scrollHeight;
    if (tab === 'details') fillProfile(getUserProfile());
    if (tab === 'siteRules') fillSiteRules();
  };

  const renderLogs = () => {
    output.textContent = formatLogs();
    root.querySelector<HTMLElement>('[data-log-count]')!.textContent = `(${getLogs().length})`;
    const preferences = getLogRoutes();
    root.querySelectorAll<HTMLInputElement>('[data-route]').forEach(box => { box.checked = preferences[box.dataset.route as LogRoute]; });
    if (activeTab === 'logs') output.scrollTop = output.scrollHeight;
  };
  subscribeLogs(renderLogs);
  renderLogs();

  // Launcher draggable logic
  const launcher = root.querySelector<HTMLButtonElement>('#launcher')!;
  try {
    const pos = GM_getValue<{ left: number; top: number } | null>('PAGE_AGENT_LAUNCHER_POS', null);
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
      launcher.style.setProperty('--launcher-left', `${pos.left}px`);
      launcher.style.setProperty('--launcher-top', `${pos.top}px`);
    }
  } catch (err) {
    void err;
  }

  let isDragging = false, startX = 0, startY = 0, origLeft = 14, origTop = 12, didMove = false;
  launcher.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    isDragging = true; didMove = false; startX = e.clientX; startY = e.clientY;
    const rect = launcher.getBoundingClientRect();
    origLeft = rect.left; origTop = rect.top;
    launcher.setPointerCapture(e.pointerId);
  });

  launcher.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!didMove && Math.hypot(dx, dy) < 4) return;
    didMove = true;
    const maxL = Math.max(10, window.innerWidth - launcher.offsetWidth - 10);
    const maxT = Math.max(10, window.innerHeight - launcher.offsetHeight - 10);
    launcher.style.setProperty('--launcher-left', `${Math.max(10, Math.min(maxL, origLeft + dx))}px`);
    launcher.style.setProperty('--launcher-top', `${Math.max(10, Math.min(maxT, origTop + dy))}px`);
  });

  launcher.addEventListener('pointerup', e => {
    if (!isDragging) return;
    isDragging = false;
    try { launcher.releasePointerCapture(e.pointerId); } catch (err) { void err; }
    if (didMove) {
      const rect = launcher.getBoundingClientRect();
      GM_setValue('PAGE_AGENT_LAUNCHER_POS', { left: rect.left, top: rect.top });
    }
  });

  launcher.addEventListener('click', e => {
    if (didMove) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    onToggle();
  });

  // Preset selector
  presetSelect?.addEventListener('change', () => {
    const chosen = PROVIDER_PRESETS.find(p => p.id === presetSelect.value);
    if (!chosen) return;
    sf('model').value = chosen.model;
    sf('baseURL').value = chosen.baseURL;
    sf('appendChatCompletions').checked = chosen.appendChatCompletions;
    const errEl = root.querySelector<HTMLElement>('[data-settings-error]');
    if (errEl) errEl.textContent = `Applied ${chosen.name} preset (${chosen.notes})`;
  });

  // Tab switching
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.addEventListener('click', () => showTab(button.dataset.tab!)));
  root.querySelectorAll<HTMLInputElement>('[data-route]').forEach(box => box.addEventListener('change', () => setLogRoute(box.dataset.route as LogRoute, box.checked)));
  root.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());

  // Logs actions
  root.querySelector('[data-copy]')!.addEventListener('click', () => { GM_setClipboard(formatLogs(), 'text'); logStatus.textContent = 'Logs copied.'; });
  root.querySelector('[data-clear]')!.addEventListener('click', () => { clearLogs(); logStatus.textContent = 'Logs cleared.'; });
  root.querySelector('[data-snapshot]')!.addEventListener('click', () => addLog('diagnostic', 'Manual diagnostic snapshot', diagnosticSnapshot(VERSION)));
  root.querySelector('[data-export-json]')!.addEventListener('click', () => {
    const jsonStr = exportLogsJSON(VERSION);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page-agent-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logStatus.textContent = 'Diagnostics JSON downloaded.';
  });
  root.querySelector('[data-github-report]')!.addEventListener('click', () => {
    const report = exportGitHubIssueMarkdown(VERSION);
    GM_setClipboard(report, 'text');
    logStatus.textContent = 'GitHub Issue report copied to clipboard.';
  });

  // Site rules form
  siteRulesForm.addEventListener('submit', event => {
    event.preventDefault();
    saveSiteInstructions(currentHost, siteRulesText.value);
    siteRulesStatus.textContent = `Saved rules for ${currentHost}. Refresh/start session to apply.`;
    addLog('lifecycle', 'Site-specific instructions updated', { domain: currentHost });
  });
  root.querySelector('[data-clear-site-rules]')!.addEventListener('click', () => {
    if (!safeConfirm(`Clear custom rules for ${currentHost}?`)) return;
    clearSiteInstructions(currentHost);
    siteRulesText.value = '';
    siteRulesStatus.textContent = `Rules cleared for ${currentHost}.`;
    addLog('lifecycle', 'Site-specific instructions cleared', { domain: currentHost });
  });

  // Profile form
  root.querySelector('[data-clear-profile]')!.addEventListener('click', () => {
    if (!safeConfirm('Clear all saved personal details?')) return;
    onClearProfile();
    fillProfile(getUserProfile());
    profileStatus.textContent = 'Details cleared.';
  });
  profileForm.addEventListener('submit', event => {
    event.preventDefault();
    const profile = Object.fromEntries([...new FormData(profileForm)].map(([key, value]) => [key, String(value)])) as unknown as UserProfile;
    onSaveProfile({ ...getUserProfile(), ...profile });
    profileStatus.textContent = 'Details saved. Start a new session to refresh agent context.';
  });

  // Settings form
  settingsForm.addEventListener('submit', event => {
    event.preventDefault();
    onSave({
      model: sf('model').value,
      baseURL: sf('baseURL').value,
      apiKey: sf('apiKey').value,
      appendChatCompletions: sf('appendChatCompletions').checked,
      transport: sf('transport').value as AgentSettings['transport'],
    });
  });

  const open = (tab: string) => {
    showTab(tab);
    if (!dialog.open) dialog.showModal();
  };

  return {
    setOpen(opened) {
      const el = root.querySelector<HTMLButtonElement>('#launcher')!;
      el.setAttribute('aria-expanded', String(opened));
      el.style.borderColor = opened ? '#22c55e' : '#7557a7';
    },
    openSettings(s, message = '') {
      sf('model').value = s.model;
      sf('baseURL').value = s.baseURL;
      sf('apiKey').value = s.apiKey;
      sf('appendChatCompletions').checked = s.appendChatCompletions;
      sf('transport').value = s.transport;
      root.querySelector<HTMLElement>('[data-settings-error]')!.textContent = message;
      open('settings');
    },
    openLogs() {
      logStatus.textContent = '';
      open('logs');
    },
    close() {
      dialog.close();
    },
  };
}

function profileField(name: string, label: string, type = 'text', wide = false): string {
  return `<label class="${wide ? 'wide' : ''}">${label}<input class="field" name="${name}" type="${type}"></label>`;
}

function profileArea(name: string, label: string): string {
  return `<label class="wide">${label}<textarea class="field" name="${name}" rows="3"></textarea></label>`;
}
