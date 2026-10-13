import './shim';
import { safeConfirm } from './shim';
import type { PageAgent } from 'page-agent';
import { createAgent } from './agent';
import { attachPanelGeometry } from './panelGeometry';
import { createUI } from './ui';
import { clearSettings, getSettings, normalizeSettings, saveSettings, validateSettings, type AgentSettings } from './settings';
import { addLog } from './logger';
import { diagnosticSnapshot } from './logger';
import { clearProfile, getProfile, saveProfile } from './profile';

const VERSION = '0.6.0';

let agent: PageAgent | null = null;
let detachPanel: (() => void) | null = null;
let settings = getSettings();

const ui = createUI(togglePanel, applySettings, getProfile, profile => {
  saveProfile(profile);
  addLog('lifecycle', 'User details saved', { populatedFields: Object.values(profile).filter(Boolean).length });
}, () => {
  clearProfile();
  addLog('lifecycle', 'User details cleared');
});

addLog('lifecycle', 'Page Agent userscript started', { version: VERSION });
addLog('diagnostic', 'Runtime diagnostic snapshot', diagnosticSnapshot(VERSION));
addLog('navigation', 'Page loaded', { url: window.location.href });
window.addEventListener('hashchange', () => addLog('navigation', 'URL hash changed', { url: window.location.href }));
window.addEventListener('popstate', () => addLog('navigation', 'Browser history changed', { url: window.location.href }));

GM_registerMenuCommand('Open Page Agent settings', () => ui.openSettings(settings));
GM_registerMenuCommand('Open Page Agent logs', () => ui.openLogs());
GM_registerMenuCommand('Toggle Page Agent', togglePanel);
GM_registerMenuCommand('Clear saved Page Agent credentials', () => {
  if (!safeConfirm('Clear the saved Page Agent endpoint, model, and API key?')) return;
  detachPanel?.();
  agent?.dispose();
  agent = null;
  detachPanel = null;
  settings = clearSettings();
  addLog('lifecycle', 'Saved Page Agent credentials cleared');
  ui.setOpen(false);
  ui.openSettings(settings, 'Saved credentials were cleared.');
});

function mountAgent(nextSettings: AgentSettings, show = false): void {
  detachPanel?.();
  agent?.dispose();
  agent = createAgent(nextSettings);
  addLog('lifecycle', 'Page Agent initialized', {
    baseURL: nextSettings.baseURL,
    model: nextSettings.model,
    apiKeyConfigured: Boolean(nextSettings.apiKey),
    appendChatCompletions: nextSettings.appendChatCompletions,
    transport: nextSettings.transport,
  });
  let previousStatus = agent.status;
  agent.addEventListener('statuschange', () => {
    addLog('lifecycle', 'Agent status changed', { from: previousStatus, to: agent?.status });
    previousStatus = agent?.status ?? previousStatus;
  });
  agent.addEventListener('activity', event => {
    const activity = (event as CustomEvent<{ type: string; message?: string; attempt?: number; maxAttempts?: number }>).detail;
    if (activity.type === 'error') addLog('error', activity.message ?? 'Page Agent reported an error');
    if (activity.type === 'retrying') addLog('error', 'Page Agent is retrying the provider request', { attempt: activity.attempt, maxAttempts: activity.maxAttempts });
  });
  detachPanel = attachPanelGeometry(agent.panel.wrapper);
  const controls = agent.panel.wrapper.querySelector<HTMLElement>('[class*="_controls_"]');
  const templateButton = controls?.querySelector<HTMLButtonElement>('button');
  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.textContent = '⚙';
  settingsButton.title = 'Page Agent settings';
  settingsButton.setAttribute('aria-label', 'Page Agent settings');
  if (templateButton) settingsButton.className = templateButton.className.replace(/\S*expandButton\S*/g, '');
  settingsButton.addEventListener('click', event => {
    event.stopPropagation();
    ui.openSettings(settings);
  });
  controls?.prepend(settingsButton);
  const newSessionButton = document.createElement('button');
  newSessionButton.type = 'button';
  newSessionButton.textContent = '+';
  newSessionButton.title = 'Start a new session';
  newSessionButton.setAttribute('aria-label', 'Clear chat and start a new session');
  if (templateButton) newSessionButton.className = templateButton.className.replace(/\S*expandButton\S*/g, '');
  newSessionButton.addEventListener('click', event => {
    event.stopPropagation();
    startNewSession();
  });
  settingsButton.after(newSessionButton);
  const closeButton = controls?.querySelector<HTMLButtonElement>('[class*="_stopButton_"]');
  closeButton?.addEventListener('click', event => {
    if (agent?.status === 'running') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    agent?.panel.hide();
    ui.setOpen(false);
  }, true);
  if (show) {
    agent.panel.show();
    ui.setOpen(true);
  }
}

function startNewSession(): void {
  addLog('lifecycle', 'Starting a new agent session', { reason: 'user-requested' });
  mountAgent(settings, true);
}

function togglePanel(): void {
  const settingsError = validateSettings(settings);
  if (settingsError) {
    ui.openSettings(settings, settingsError);
    return;
  }
  if (!agent || agent.disposed) mountAgent(settings, true);
  else if (agent.panel.wrapper.style.display !== 'none' && agent.panel.wrapper.style.opacity === '1') {
    agent.panel.hide();
    ui.setOpen(false);
  } else {
    agent.panel.show();
    ui.setOpen(true);
  }
}

function applySettings(nextSettings: AgentSettings): void {
  const normalized = normalizeSettings(nextSettings);
  const error = validateSettings(normalized);
  if (error) {
    ui.openSettings(normalized, error);
    return;
  }
  settings = normalized;
  saveSettings(settings);
  addLog('lifecycle', 'Settings saved', {
    baseURL: settings.baseURL,
    model: settings.model,
    apiKeyConfigured: Boolean(settings.apiKey),
    appendChatCompletions: settings.appendChatCompletions,
    transport: settings.transport,
  });
  ui.close();
  mountAgent(settings, true);
}

if (!validateSettings(settings)) mountAgent(settings);
