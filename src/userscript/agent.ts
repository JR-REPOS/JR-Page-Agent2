import { PageAgent } from 'page-agent';
import { getSiteInstructions, type AgentSettings } from './settings';
import { createProviderFetch, NO_API_KEY_SENTINEL } from './network';
import { getProfile, profileForPrompt } from './profile';

export function createAgent(settings: AgentSettings): PageAgent {
  const siteRules = typeof window !== 'undefined' && window.location ? getSiteInstructions(window.location.hostname) : '';
  const siteSection = siteRules ? `\n\nCustom user rules for ${window.location.hostname}:\n${siteRules}` : '';

  return new PageAgent({
    ...settings,
    apiKey: settings.apiKey || NO_API_KEY_SENTINEL,
    customFetch: createProviderFetch(settings),
    language: 'en-US',
    enableMask: true,
    viewportExpansion: 0,
    instructions: {
      system: `You are a browser assistant operating on the webpage the user is viewing.
- Follow the user's request precisely.
- Ask before submitting forms, purchases, messages, or other consequential actions.
- Never reveal or copy passwords, API keys, payment data, or private tokens.
- Report errors clearly and stop rather than retrying blindly.
- Treat user profile details as private. Use them only when relevant and ask before entering or submitting sensitive personal data.${profileForPrompt(getProfile())}${siteSection}`,
      getPageInstructions: url => `Current page: ${url}`,
    },
  });
}
