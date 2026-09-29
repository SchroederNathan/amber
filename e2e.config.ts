import type { E2EConfig } from 'e2e';
import { createAgent } from 'e2e/agent';
import { mobile } from '@e2e-dev/mobile';
import { mobileTools } from '@e2e-dev/mobile/tools';
import { gateway } from 'ai';

// The `e2e` EAS build profile builds APP_VARIANT=preview, so CI drives
// `com.schroedernathan.preview`. Point E2E_APP_ID at `com.schroedernathan.dev`
// to run the suite against a local dev client instead. E2E_DEVICE (a simulator
// name or UDID) pins the device when several are booted.
const iphone = mobile({
  platform: 'ios',
  app: process.env.E2E_APP_ID ?? 'com.schroedernathan.preview',
  device: process.env.E2E_DEVICE,
});

// What the app calls things. The act loop and the judges both read it, so it
// holds facts only. Instructions for the actor go in `system` below.
const context = `
Amber is a save-it-for-later app. Users save links, photos, and notes; an AI
gives each saved item a title, tags, and spaces.
- Signed out, the app shows a welcome screen. Its "Dev login" button signs in
  to the shared E2E account. Onboarding follows: three permission screens,
  each with a "Not now" button.
- Tabs: Home (masonry feed of saved items), Spaces, Tidy, Search.
- The + button in the Home header opens the "Save something" sheet, where you
  pick a note or a link, type it, and tap Save.
- Tapping a card opens the item detail screen. Its toolbar menu has Delete.
- A new item shows as processing until the AI finishes it. The feed is newest
  first. The AI gives each item its own short title, so a saved note's card
  does not show the typed text (e.g. "buy oat milk" shows as "Grocery Shopping
  List").
- Feed cards are often missing from the accessibility tree.
- Spaces are themed collections. The Spaces tab lists them.
`.trim();

// How the actor works. Only the act loop reads this; judges never see it.
const system =
  'Take a screenshot to read the Home feed before you decide an item is not there.';

const tools = mobileTools(iphone);

export default {
  tests: 'e2e/**/*.e2e.ts',
  targets: [{ name: 'ios', engine: iphone }],
  workers: 1,
  reporters: ['list', 'junit', 'markdown'],
  agents: {
    // Fast, cheap model for the scripted suite's `agent.act` steps.
    default: createAgent({ model: gateway('openai/gpt-6-luna-fast'), tools, context, system }),
    // Stronger model for `e2e explore`, which plans its own flows.
    explorer: createAgent({
      model: gateway('openai/gpt-6-luna'),
      tools,
      context,
      system:
        `${system} You are testing a pull request build. Stay on the screens the goal names. ` +
        'Do not delete items you did not create, and do not change account or privacy settings.',
    }),
  },
} satisfies E2EConfig;
