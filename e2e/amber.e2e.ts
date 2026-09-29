import { test } from '@e2e-dev/mobile';
import { expect, unique } from 'e2e';
import { z } from 'zod';

// A pronounceable made-up name, different on every run (e.g. "Morvelin").
function bakeryName() {
  const pick = (options: string[]) => options[Math.floor(Math.random() * options.length)];
  const name = pick(['Mor', 'Zan', 'Quil', 'Brav', 'Tesk', 'Lum']) + pick(['ve', 'da', 'ro', 'ki', 'na']) + pick(['lin', 'thor', 'vek', 'bry', 'sant']);
  return name;
}

// Taps the middle of a node by position, which skips agent-device's "covered
// by another element" check (see the note test).
async function tapCenter(locator: { boundingBox(): Promise<{ width: number; height: number } | null>; tap(options?: { position?: { x: number; y: number } }): Promise<void> }) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('The node to tap has no bounding box.');
  await locator.tap({ position: { x: box.width / 2, y: box.height / 2 } });
}

// One serial group: the members share one signed-in app, in order. CI starts
// every run on a fresh EAS Simulator device, so the first test always meets
// the sign-in screen and onboarding.
test.describe('amber', { serial: true }, () => {
  test('signs in with the E2E account and finishes onboarding', async ({ app, device, screen }) => {
    // Clerk keeps its session in the keychain, which survives a reinstall.
    await device.clearKeychain();
    await app.open();

    // Select buttons by test ID. A gesture handler Pressable shows as two
    // nested "button" nodes with the same name, so role + name is ambiguous;
    // only the inner node carries the test ID.
    // Dev login shows in dev builds and in the `e2e` profile (EXPO_PUBLIC_E2E=1).
    await screen.getByTestId('dev-login-button').tap();

    for (const step of ['camera', 'photos', 'biometrics']) {
      await screen.getByTestId(`onboarding-${step}-skip`).tap();
    }

    await expect(screen.getByText('Spaces').first()).toBeVisible();
    await expect(screen.getByText('Search').first()).toBeVisible();
  });

  test('the tab bar reaches Spaces and Search', async ({ agent, screen }) => {
    await agent.act('open the Spaces tab');
    await expect(screen.getByText('spaces').first()).toBeVisible();

    await agent.act('open the Search tab');
    await expect(screen.getByText('search').first()).toBeVisible();
  });

  test('saves a note, the AI files it, and it can be deleted', { timeout: 300_000 }, async ({ agent, app, screen }) => {
    // The AI replaces a note's text with its own title, and may drop any
    // word ("buy oat milk" became "Grocery Shopping List"; a note naming a
    // made-up bakery became "Bakery To-Do"). So the checks go by position:
    // the feed is newest first, so the new note is the first card (top left).
    const bakery = bakeryName();

    // Relaunch onto Home: the previous test ends on Search, where iOS
    // collapses the tab bar and the Home tab is not on screen. The Clerk
    // session survives the relaunch.
    await app.open();

    // The Add sheet is in the accessibility tree: exact steps, no model calls.
    await screen.getByRole('button', { name: 'Add' }).tap();
    // agent-device reports every control in the form sheet as covered (by
    // the sheet's full-screen dismiss region), so plain taps and fills are
    // refused. tapCenter taps at a position, which goes to that point directly.
    // A tap that lands while the sheet is still sliding up can be lost (1 of
    // 2 local runs), and a position tap does not wait for the sheet to settle.
    // Tap again until the composer opens.
    const input = screen.getByTestId('add-input');
    for (let taps = 0; !(await input.isVisible()); taps++) {
      if (taps === 3) throw new Error('The note composer did not open after 3 taps on Note.');
      await tapCenter(screen.getByTestId('add-note'));
      await input.waitFor({ timeout: 3_000 }).catch(() => {});
    }
    await expect(input).toBeVisible();

    // The composer focuses its field on open. The locator fill is refused
    // too, but the agent can type into the focused field.
    // unique() marks the value as different on every run, so the trace cache
    // can still replay this step with the new value.
    const text = `Try the rye loaf at ${bakery} bakery on Saturday`;
    await agent.act('type {text} into the focused note field. Do not tap anything.', { params: { text: unique(text) } });
    await tapCenter(screen.getByRole('button', { name: 'Save' }));

    // Feed cards are missing from the external accessibility snapshot that
    // agent-device reads (the in-app tree has them), so judge the feed from
    // pixels.
    await agent.waitFor(
      'the first card in the Home feed (top left) is a note about a bakery or bread, and it shows no loading spinner',
      { vision: 'only', timeout: 120_000, interval: 5_000 },
    );
    const title = await agent.extract('the title text on the first card in the Home feed (top left)', {
      schema: z.string().min(1),
      vision: 'only',
    });

    // Clean up so the shared test account does not fill with E2E notes. The
    // act loop cannot see feed cards in the tree and must tap ⋯ from a
    // screenshot, so this uses the stronger explorer model and stops at
    // Delete. Cleanup is best effort: a miss leaves one note behind but does
    // not fail the suite.
    try {
      await agent.act(
        'take a screenshot, tap the ⋯ button under the first card in the Home feed (top left, titled {title}), ' +
          'then choose Delete. Stop as soon as you have tapped Delete; do not check the feed afterwards.',
        { agent: 'explorer', params: { title: unique(title) } },
      );
      await agent.waitFor(`the first card in the Home feed (top left) is no longer titled "${title}"`, {
        vision: 'only',
        timeout: 15_000,
      });
    } catch (error) {
      console.warn(`Cleanup: could not delete the "${title}" note.`, error);
    }
  });
});
