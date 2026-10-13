# Page Agent userscript migration plan

## Goal

Deliver one installable `page-agent.user.js` file that adds Page Agent to ordinary HTTP and HTTPS pages without replacing or depending on the page's own application.

## Architecture

1. `main.ts` owns lifecycle: launcher, agent creation, show/hide, settings changes, and cleanup.
2. `agent.ts` contains generic browser-assistant behavior. It must not contain conference routes or site-specific copy.
3. `ui.ts` creates the launcher and settings dialog with DOM APIs so no React application or root element is required.
4. `panelGeometry.ts` owns drag and resize behavior.
5. `settings.ts` uses userscript-manager storage so configuration follows the script across sites.
6. `network.ts` adapts `GM_xmlhttpRequest` to `fetch`, allowing the configured LLM endpoint to work across origins.
7. Vite emits a single IIFE bundle with a userscript metadata header and no HTML application.

## Work plan

### Phase 1 — Extract the userscript shell

- [x] Remove the conference application, routes, pages, and app state from the build.
- [x] Replace the React entry point with a standalone userscript entry point.
- [x] Make Page Agent prompts generic for arbitrary websites.
- [x] Move model, endpoint, and API-key settings into userscript-owned storage using separate `VITE_LLM_*` records.
- [x] Add a cross-origin request adapter for OpenAI-compatible endpoints.
- [x] Support keyless providers without sending an `Authorization` header.
- [x] Let users choose whether `/chat/completions` is appended to the provider URL.
- [x] Add live, route-filtered diagnostics with copy and clear controls.
- [x] Configure a single-file `dist/page-agent.user.js` build.
- [x] Keep drag, resize, settings, hide, and reopen behavior.

### Phase 2 — Isolation and compatibility

- [x] Put launcher and settings UI in a Shadow DOM to prevent host-page CSS collisions.
- [ ] Replace selectors based on Page Agent's generated class names with stable hooks or an upstream extension API.
- [ ] Handle single-page-app navigation and pages that replace `document.body`.
- [ ] Detect duplicate installs and guarantee only one launcher and one agent instance.
- [ ] Define behavior for iframes; default to top-level pages only unless iframe support is explicitly enabled.
- [ ] Test restrictive CSP pages, dynamically rendered apps, long documents, and mobile layouts.

### Phase 3 — Security and permissions

- [ ] Replace broad `@connect *` with generated or documented endpoint-specific permissions where practical.
- [x] Add an explicit warning that userscript-manager storage is not a secure secret vault.
- [ ] Add an option to keep the API key in memory only and clear it when the tab closes.
- [ ] Mask password, payment, token, and private fields before page content is sent to the model.
- [ ] Require confirmation before submissions, purchases, messages, deletions, or other consequential actions.
- [ ] Add a per-domain allow/deny list and a global pause switch.

### ScriptCat integration

- Storage contains `VITE_LLM_BASE_URL`, `VITE_LLM_API_KEY`, `VITE_LLM_MODEL`, `VITE_LLM_APPEND_CHAT_COMPLETIONS`, and `VITE_LLM_TRANSPORT` as separate records.
- The legacy `page-agent-settings-v1` object is migrated automatically and removed.
- The script menu exposes settings, panel toggle, and credential clearing commands.
- Script Settings are driven by metadata for match rules, run timing, source, support, and permissions.
- Resources intentionally remain empty because the bundle is self-contained; adding a fake resource would add network and update failure points without providing functionality.

### Phase 4 — Distribution

- [ ] Add a release command that updates the metadata version and builds the script.
- [ ] Publish versioned release assets and a stable raw install URL.
- [ ] Document Tampermonkey, Violentmonkey, and browser requirements.
- [ ] Add upgrade notes and a rollback link for each release.
- [ ] Decide whether to submit to Greasy Fork/OpenUserJS after reviewing their remote-code and privacy policies.

## Acceptance criteria

- Installing one built file adds the launcher on unrelated HTTP and HTTPS sites.
- No conference UI, router, application root, or background page is bundled.
- The popup can open repeatedly, close, move, and resize.
- Settings survive navigation between sites through the userscript manager.
- LLM calls work when the endpoint permits the configured userscript connection.
- The script does not inject an API key at build time.
- The bundle is a single file with a valid userscript metadata block at byte zero.

## Known risks

- The Page Agent package directly inspects and changes the host DOM. Full Shadow DOM isolation is therefore possible for our launcher and settings, but not for the agent's page-control logic.
- Generated class-name selectors are brittle across Page Agent upgrades.
- `@connect *` is convenient for user-entered endpoints but grants broad network access. Distribution should narrow or clearly explain it.
- API keys stored by a userscript manager are locally retrievable by that manager and should be treated as plain-text secrets.
- Arbitrary-page automation can trigger consequential actions. Confirmation and sensitive-data masking are release blockers, not optional polish.
