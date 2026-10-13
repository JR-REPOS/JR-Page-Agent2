import './userscript/shim';
import './userscript/main';
import { getSettings } from './userscript/settings';
import { exportLogsJSON, exportGitHubIssueMarkdown, getLogs, subscribeLogs } from './userscript/logger';

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-msg');
  if (toast && msg) {
    msg.textContent = message;
    toast.style.display = 'flex';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3200);
  }
}

// Wire header & hero launch buttons to the userscript launcher
function triggerLauncher(): void {
  const host = document.getElementById('page-agent-userscript-ui');
  if (host && host.shadowRoot) {
    const launcher = host.shadowRoot.getElementById('launcher');
    launcher?.click();
  }
}

function triggerSettings(): void {
  const g = globalThis as unknown as { __GM_MENU_COMMANDS__?: Record<string, () => void> };
  if (g.__GM_MENU_COMMANDS__?.['Open Page Agent settings']) {
    g.__GM_MENU_COMMANDS__['Open Page Agent settings']();
  } else {
    triggerLauncher();
  }
}

document.getElementById('nav-toggle-agent')?.addEventListener('click', triggerLauncher);
document.getElementById('hero-launch-btn')?.addEventListener('click', triggerLauncher);
document.getElementById('nav-open-settings')?.addEventListener('click', triggerSettings);
document.getElementById('hero-settings-btn')?.addEventListener('click', triggerSettings);

// Wire playground counter
let counter = 0;
const counterDisplay = document.getElementById('counter-val');
document.getElementById('counter-inc')?.addEventListener('click', () => {
  counter += 1;
  if (counterDisplay) counterDisplay.textContent = String(counter);
});
document.getElementById('counter-dec')?.addEventListener('click', () => {
  counter -= 1;
  if (counterDisplay) counterDisplay.textContent = String(counter);
});
document.getElementById('counter-reset')?.addEventListener('click', () => {
  counter = 0;
  if (counterDisplay) counterDisplay.textContent = '0';
});

// Wire sample form
const sampleForm = document.getElementById('sample-form') as HTMLFormElement | null;
const formFeedback = document.getElementById('form-feedback');
sampleForm?.addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(sampleForm);
  const name = formData.get('fullname') || 'Anonymous';
  const email = formData.get('email') || 'no email';
  if (formFeedback) {
    formFeedback.style.display = 'block';
    formFeedback.textContent = `Form successfully submitted for ${name} (${email})!`;
  }
  showToast('Sample form submitted successfully!');
});

// Wire task manager
const newTaskInput = document.getElementById('new-task-input') as HTMLInputElement | null;
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

function attachTaskDeleteListeners(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.todo-item')?.remove();
      showToast('Task removed');
    };
  });
  document.querySelectorAll<HTMLInputElement>('.todo-item input[type="checkbox"]').forEach(box => {
    box.onchange = () => {
      box.closest('.todo-item')?.classList.toggle('completed', box.checked);
    };
  });
}
attachTaskDeleteListeners();

addTaskBtn?.addEventListener('click', () => {
  if (!newTaskInput || !newTaskInput.value.trim() || !taskList) return;
  const text = newTaskInput.value.trim();
  const id = Date.now();
  const li = document.createElement('li');
  li.className = 'todo-item';
  li.innerHTML = `
    <div class="todo-item-left">
      <input type="checkbox" id="task-${id}" />
      <span>${text}</span>
    </div>
    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" data-del="${id}">✕</button>
  `;
  taskList.appendChild(li);
  newTaskInput.value = '';
  attachTaskDeleteListeners();
  showToast(`Task added: "${text}"`);
});

// Wire search filter
const searchInput = document.getElementById('playground-search') as HTMLInputElement | null;
const searchStatus = document.getElementById('search-status');
searchInput?.addEventListener('input', () => {
  const val = searchInput.value.trim();
  if (searchStatus) {
    searchStatus.textContent = val ? `Filtering for: "${val}" (0 items hidden)` : '';
  }
});

// Wire copy userscript
document.getElementById('copy-script-btn')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/page-agent.user.js');
    if (res.ok) {
      const code = await res.text();
      await navigator.clipboard.writeText(code);
      showToast('Userscript code copied to clipboard!');
      return;
    }
  } catch {
    // fallback
  }
  showToast('Userscript downloaded or available at /page-agent.user.js');
});

// 1. Endpoint Tester & Latency Ping
function updateTesterDisplay(): void {
  const settings = getSettings();
  const urlEl = document.getElementById('test-baseurl');
  const modelEl = document.getElementById('test-model');
  const transEl = document.getElementById('test-transport');
  if (urlEl) urlEl.textContent = settings.baseURL;
  if (modelEl) modelEl.textContent = settings.model;
  if (transEl) transEl.textContent = settings.transport === 'userscript' ? 'Userscript GM' : 'Native Page Fetch';
}
updateTesterDisplay();

document.getElementById('btn-sync-settings')?.addEventListener('click', () => {
  updateTesterDisplay();
  showToast('Synced with latest saved settings!');
});

document.getElementById('btn-ping-endpoint')?.addEventListener('click', async () => {
  const settings = getSettings();
  const resultBox = document.getElementById('ping-result');
  const statusEl = document.getElementById('ping-status-text');
  const latencyEl = document.getElementById('ping-latency-text');
  const detailsEl = document.getElementById('ping-details-text');
  const badgeEl = document.getElementById('tester-status-badge');

  if (resultBox) resultBox.style.display = 'flex';
  if (statusEl) {
    statusEl.textContent = 'Pinging...';
    statusEl.style.color = '#fbbf24';
  }
  if (latencyEl) latencyEl.textContent = '...';
  if (detailsEl) detailsEl.textContent = `Connecting to ${settings.baseURL}`;

  const started = performance.now();
  try {
    const target = settings.baseURL.replace(/\/+$/, '');
    const headers: Record<string, string> = {};
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    // Ping endpoint
    const res = await fetch(target, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(6000),
      mode: 'cors',
    }).catch(async () => {
      // If GET fails or is blocked, try HEAD or options
      return await fetch(target, { method: 'HEAD', mode: 'no-cors' });
    });

    const elapsed = Math.round(performance.now() - started);

    if (latencyEl) {
      latencyEl.textContent = `${elapsed} ms`;
      latencyEl.className = elapsed < 400 ? 'card-badge badge-green' : 'card-badge badge-yellow';
    }

    const isHttpOk = res.status >= 200 && res.status < 400;
    const isAuthRequired = res.status === 401 || res.status === 403;

    if (isHttpOk) {
      if (statusEl) {
        statusEl.textContent = `Online (HTTP ${res.status})`;
        statusEl.style.color = '#34d399';
      }
      if (badgeEl) {
        badgeEl.textContent = 'Online';
        badgeEl.className = 'card-badge badge-green';
      }
      if (detailsEl) detailsEl.textContent = `Endpoint is live and responsive for ${settings.model}.`;
    } else if (isAuthRequired) {
      if (statusEl) {
        statusEl.textContent = `Reachable (HTTP ${res.status})`;
        statusEl.style.color = '#60a5fa';
      }
      if (badgeEl) {
        badgeEl.textContent = 'Reachable';
        badgeEl.className = 'card-badge';
      }
      if (detailsEl) detailsEl.textContent = 'Endpoint acknowledged connection (Key required for completions).';
    } else if (res.type === 'opaque') {
      if (statusEl) {
        statusEl.textContent = 'Reachable (Opaque/CORS)';
        statusEl.style.color = '#34d399';
      }
      if (badgeEl) badgeEl.textContent = 'Reachable';
      if (detailsEl) detailsEl.textContent = 'Server responded (Native fetch mode active).';
    } else {
      if (statusEl) {
        statusEl.textContent = `HTTP ${res.status || 'Active'}`;
        statusEl.style.color = '#fbbf24';
      }
      if (detailsEl) detailsEl.textContent = `Status ${res.statusText || 'responded'} in ${elapsed}ms.`;
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - started);
    if (statusEl) {
      statusEl.textContent = 'Check CORS or Transport';
      statusEl.style.color = '#f87171';
    }
    if (latencyEl) latencyEl.textContent = `${elapsed} ms`;
    if (detailsEl) detailsEl.textContent = `Note: Use 'Userscript GM request' in Settings if provider blocks browser page CORS. (${err instanceof Error ? err.message : String(err)})`;
  }
});

// 2. Userscript Manager Inspector
function inspectUserscriptManager(): void {
  const g = globalThis as unknown as { GM_info?: { scriptHandler?: string; version?: string } };
  const detectedManagerEl = document.getElementById('detected-manager');
  const detectedDomainEl = document.getElementById('detected-domain');
  if (detectedDomainEl) detectedDomainEl.textContent = window.location.hostname || 'localhost';
  if (detectedManagerEl) {
    if (g.GM_info?.scriptHandler && g.GM_info.scriptHandler !== 'Page Agent Web Environment') {
      detectedManagerEl.textContent = `${g.GM_info.scriptHandler} (v${g.GM_info.version || 'unknown'})`;
    } else {
      detectedManagerEl.textContent = 'Browser Dev Environment (Polyfilled)';
    }
  }
}
inspectUserscriptManager();

// 3. Automation Prompt Recipes
function loadRecipeIntoAgent(promptText: string): void {
  triggerLauncher();
  // Attempt to write into agent input if rendered
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('#page-agent-runtime_agent-panel input, .movable-agent-panel input, [class*="_inputSection_"] input');
    if (input) {
      input.value = promptText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      showToast('Loaded prompt into Page Agent! Press Enter or Submit.');
    } else {
      navigator.clipboard.writeText(promptText).catch(() => {});
      showToast('Page Agent opened & prompt copied to clipboard!');
    }
  }, 200);
}

document.querySelectorAll<HTMLButtonElement>('.btn-run-recipe').forEach(btn => {
  btn.addEventListener('click', () => {
    const recipe = btn.dataset.recipe || '';
    loadRecipeIntoAgent(recipe);
  });
});

document.querySelectorAll<HTMLButtonElement>('.btn-copy-recipe').forEach(btn => {
  btn.addEventListener('click', async () => {
    const recipe = btn.dataset.recipe || '';
    try {
      await navigator.clipboard.writeText(recipe);
      showToast('Recipe prompt copied to clipboard!');
    } catch {
      showToast(recipe);
    }
  });
});

// 4. Real-time Diagnostics Export & Share
function updateDiagCount(): void {
  const countEl = document.getElementById('diag-count');
  if (countEl) countEl.textContent = String(getLogs().length);
}
subscribeLogs(updateDiagCount);
updateDiagCount();

document.getElementById('btn-export-json')?.addEventListener('click', () => {
  const json = exportLogsJSON('0.6.0');
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `page-agent-diagnostics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Diagnostics JSON bundle downloaded!');
});

document.getElementById('btn-export-github')?.addEventListener('click', async () => {
  const report = exportGitHubIssueMarkdown('0.6.0');
  try {
    await navigator.clipboard.writeText(report);
    showToast('GitHub Issue Markdown report copied to clipboard!');
  } catch {
    showToast('Report generated');
  }
});
