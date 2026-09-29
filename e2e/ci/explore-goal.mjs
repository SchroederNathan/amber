// Writes the `e2e explore` goal for a pull request: what changed, in words
// the explorer can act on. Reads MANUAL_GOAL (a JSON string from a manual
// run's `goal` input), PR_JSON (see pr.mjs), and CHANGED_FILES (one path per
// line) from the environment.
import { readPullRequest } from './pr.mjs';

const manualGoal = (() => {
  try {
    return String(JSON.parse(process.env.MANUAL_GOAL || '""') ?? '').trim();
  } catch {
    return '';
  }
})();
const pr = readPullRequest();
const title = (pr.title ?? '').trim();
const body = (pr.body ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
const screens = (process.env.CHANGED_FILES ?? '')
  .split('\n')
  .map((path) => path.trim())
  .filter((path) => /^src\/(app|components)\//.test(path))
  .slice(0, 15);

if (manualGoal) {
  process.stdout.write(manualGoal);
} else if (!title) {
  process.stdout.write('Explore the app like a first-time user and report anything broken.');
} else {
  const parts = [`This pull request is "${title}".`];
  if (body) parts.push(`Its description: ${/[.!?]$/.test(body) ? body : `${body}.`}`);
  if (screens.length > 0) parts.push(`It changes these files: ${screens.join(', ')}.`);
  parts.push('Exercise the screens and flows it touches like a first-time user and report anything broken or wrong.');
  process.stdout.write(parts.join(' '));
}
