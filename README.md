# Page Agent Everywhere

A standalone userscript that adds a configurable [Page Agent](https://github.com/alibaba/page-agent) assistant to ordinary webpages. It builds as one installable file and does not include the original conference demo website.

## Build

```bash
npm install
npm run build
```

Install `dist/page-agent.user.js` with ScriptCat, Tampermonkey, or Violentmonkey. Open the launcher and save settings in this format:

```dotenv
VITE_LLM_BASE_URL=https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run
VITE_LLM_API_KEY=your-api-key
VITE_LLM_MODEL=qwen3.5-plus
```

The API key is optional. Leave it empty for a keyless provider, or use `NA` when a provider explicitly expects that sentinel. Placeholder `your-api-key` is rejected. Settings appear as separate records in userscript storage. Version 0.2+ automatically migrates the earlier `page-agent-settings-v1` JSON object.

The “Append `/chat/completions`” option is on by default for OpenAI-compatible base URLs. Disable it only when the entered URL is already the complete provider endpoint.

Use **Native page fetch** for providers that authorize the current webpage origin. It is the default and matches normal browser requests. **Userscript GM request** remains available for providers that allow the userscript manager's extension transport.

The configuration popup includes Settings, Details, and live Logs tabs. Details stores an optional local user profile that the agent can use when relevant; never store passwords, payment data, or security answers there. Logs show the userscript version, transport, page origin, request/response metadata, runtime diagnostics, and errors. Routes can be enabled independently, and logs can be copied, cleared, or supplemented with a diagnostic snapshot. API keys and authorization values are never logged.

Use the **+** button in the agent header to clear chat/context and start a fresh session.

## Development

```bash
npm run watch
npm run lint
```

The source is isolated under `src/userscript/`:

- `main.ts` — lifecycle and Page Agent integration
- `agent.ts` — generic assistant configuration
- `ui.ts` — isolated launcher and Settings, Details, and Logs dialog
- `profile.ts` — optional userscript-local user details
- `panelGeometry.ts` — draggable and resizable popup behavior
- `settings.ts` — userscript-manager settings storage
- `network.ts` — cross-origin request adapter

See [docs/USERSCRIPT-MIGRATION.md](docs/USERSCRIPT-MIGRATION.md) for the implementation roadmap, acceptance criteria, security work, and distribution plan.

## Security

The current development build stores the API key in userscript-manager storage and requests `@connect *` so users can configure arbitrary endpoints. Treat that storage as plain text. Narrow network permissions, add sensitive-field masking, and add per-domain controls before broad distribution.

## License

MIT
