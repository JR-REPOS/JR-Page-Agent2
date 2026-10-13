export function attachPanelGeometry(panel: HTMLElement) {
  const header = panel.querySelector<HTMLElement>('[class*="_header_"]');
  if (!header) return () => {};
  panel.classList.add('movable-agent-panel');
  const style = document.createElement('style');
  style.textContent = `
    #page-agent-runtime_agent-panel.movable-agent-panel {
      left: var(--panel-left, 50%) !important;
      top: var(--panel-top, auto) !important;
      bottom: var(--panel-bottom, 100px) !important;
      transform: var(--panel-transform, translateX(-50%)) !important;
      width: var(--panel-width, min(360px, calc(100vw - 24px))) !important;
      --width: var(--panel-width, min(360px, calc(100vw - 24px)));
      height: 92px;
      max-width: calc(100vw - 24px);
      transition: opacity .2s;
    }
    #page-agent-runtime_agent-panel.movable-agent-panel[class*="_expanded_"] {
      height: min(var(--panel-height, 320px), calc(100dvh - 24px));
    }
    .movable-agent-panel > [class*="_header_"] { inset: 0 0 auto; height: 44px; cursor: grab; touch-action: none; }
    .movable-agent-panel > [class*="_historySectionWrapper_"] { top: 44px; bottom: 48px; width: calc(100% - 24px); z-index: 0; }
    .movable-agent-panel[class*="_expanded_"] [class*="_historySection_"] { max-height: none; height: 100%; }
    .movable-agent-panel > [class*="_inputSectionWrapper_"] { top: auto; bottom: 0; width: calc(100% - 24px); z-index: 0; }
    .movable-agent-panel input { min-width: 0; width: 100%; }
    .agent-panel-resize { position: absolute; right: -3px; bottom: -3px; width: 24px; height: 24px; z-index: 3; cursor: nwse-resize; touch-action: none; color: white; background: #28223f; border: 1px solid #aaa6cc; border-radius: 5px; font-size: 16px; line-height: 20px; }
    .agent-panel-resize:focus-visible { outline: 2px solid #39b6ff; outline-offset: 2px; }
  `;
  document.head.appendChild(style);
  const handle = document.createElement('button');
  handle.className = 'agent-panel-resize';
  handle.type = 'button';
  handle.textContent = '◢';
  handle.title = 'Drag to resize; arrow keys resize when focused';
  handle.setAttribute('aria-label', 'Resize Page Agent panel');
  panel.appendChild(handle);
  header.title = 'Drag to move Page Agent panel';
  let active: { id: number; x: number; y: number; left: number; top: number; width: number; height: number; resize: boolean; moved: boolean } | null = null;
  let suppressClick = false;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
  const place = (left: number, top: number, width: number, height: number) => {
    panel.style.setProperty('--panel-width', `${clamp(width, Math.min(260, innerWidth - 24), innerWidth - 24)}px`);
    panel.style.setProperty('--panel-height', `${clamp(height, Math.min(180, innerHeight - 24), innerHeight - 24)}px`);
    panel.style.setProperty('--panel-left', `${clamp(left, 12, innerWidth - panel.offsetWidth - 12)}px`);
    panel.style.setProperty('--panel-top', `${clamp(top, 12, innerHeight - panel.offsetHeight - 12)}px`);
    panel.style.setProperty('--panel-bottom', 'auto');
    panel.style.setProperty('--panel-transform', 'none');
  };
  const start = (event: PointerEvent) => {
    const resize = event.currentTarget === handle;
    if (event.button !== 0 || (!resize && (event.target as Element).closest('button,input'))) return;
    const rect = panel.getBoundingClientRect();
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, resize, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (resize) event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.id) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (!active.moved && Math.hypot(dx, dy) < 4) return;
    active.moved = true;
    if (active.resize) {
      const expanded = [...panel.classList].some(name => name.includes('_expanded_'));
      if (!expanded) header.querySelector<HTMLButtonElement>('[class*="_expandButton_"]')?.click();
      place(active.left, active.top, active.width + dx, Math.max(180, active.height + dy));
    } else place(active.left + dx, active.top + dy, active.width, active.height);
    event.preventDefault();
  };
  const end = (event: PointerEvent) => {
    if (!active || active.id !== event.pointerId) return;
    suppressClick = active.moved;
    active = null;
    setTimeout(() => { suppressClick = false; }, 0);
  };
  const click = (event: MouseEvent) => {
    if (suppressClick || event.target === handle) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const fit = () => {
    if (!panel.style.getPropertyValue('--panel-left')) return;
    const rect = panel.getBoundingClientRect();
    place(rect.left, rect.top, rect.width, parseFloat(panel.style.getPropertyValue('--panel-height')) || 320);
  };
  const key = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    if (![...panel.classList].some(name => name.includes('_expanded_'))) header.querySelector<HTMLButtonElement>('[class*="_expandButton_"]')?.click();
    place(rect.left, rect.top, rect.width + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0), Math.max(180, rect.height + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0)));
  };
  for (const target of [header, handle]) {
    target.addEventListener('pointerdown', start);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }
  panel.addEventListener('click', click, true);
  handle.addEventListener('keydown', key);
  window.addEventListener('resize', fit);
  const observer = new MutationObserver(fit);
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', fit);
    panel.removeEventListener('click', click, true);
    handle.removeEventListener('keydown', key);
    for (const target of [header, handle]) {
      target.removeEventListener('pointerdown', start);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    }
    handle.remove();
    style.remove();
    panel.classList.remove('movable-agent-panel');
  };
}

