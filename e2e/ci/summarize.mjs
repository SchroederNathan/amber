// Turns the suite and explore reports into the markdown for the PR comment.
// Usage: node e2e/ci/summarize.mjs <suite report.json> <explore report.json>
import { existsSync, readFileSync } from 'node:fs';

const [suitePath, explorePath] = process.argv.slice(2);
const read = (path) => (path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).run : undefined);
const oneLine = (text, max = 200) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const severity = ['', 'trivial', 'low', 'medium', 'high', 'critical'];

const lines = ['## TesterArmy E2E on EAS Simulator', ''];

const suite = read(suitePath);
if (!suite) {
  lines.push('**Suite:** no report. The run failed before any test ran. See the workflow logs.');
} else {
  const { passed, failed, flaky, skipped } = suite.summary;
  const icon = failed > 0 ? '❌' : '✅';
  lines.push(`**Suite:** ${icon} ${passed} passed, ${failed} failed, ${flaky} flaky, ${skipped} skipped`);
  // Members of a serial group have no attempts of their own; the group keeps them.
  const groups = new Map((suite.serialGroups ?? []).map((group) => [group.id, group]));
  for (const result of suite.results.filter((r) => ['failed', 'timed-out', 'interrupted'].includes(r.status))) {
    const attempts = result.attempts.length > 0 ? result.attempts : groups.get(result.serialGroupId)?.attempts ?? [];
    const error = attempts.at(-1)?.error;
    lines.push(`- **${result.titlePath.join(' › ')}**: \`${error?.code ?? result.status}\` ${oneLine(error?.message)}`);
  }
  for (const error of suite.errors ?? []) {
    lines.push(`- Run error: \`${error.code}\` ${oneLine(error.message)}`);
  }
}

lines.push('');
const explore = read(explorePath)?.explore;
if (!explore) {
  lines.push('**Explore:** skipped or did not produce a report.');
} else {
  const issues = explore.findings.filter((f) => f.kind === 'issue');
  const warnings = explore.findings.filter((f) => f.kind !== 'issue');
  const icon = issues.length > 0 ? '⚠️' : '✅';
  lines.push(`**Explore (agent, non-blocking):** ${icon} ${issues.length} issues, ${warnings.length} warnings in ${explore.steps.length} steps`);
  lines.push(`> Goal: ${oneLine(explore.goal, 300)}`);
  for (const finding of [...issues, ...warnings].sort((a, b) => b.severity - a.severity).slice(0, 8)) {
    lines.push(`- ${finding.kind === 'issue' ? '⚑' : '·'} **${severity[finding.severity] ?? finding.severity} ${finding.kind}**: ${oneLine(finding.title, 120)}`);
    lines.push(`  - Expected: ${oneLine(finding.expected)}`);
    lines.push(`  - Actual: ${oneLine(finding.actual)}`);
  }
  if (explore.summary) lines.push('', oneLine(explore.summary, 600));
}

lines.push('', 'Screenshots, videos, and full reports are in the workflow run artifacts.');
process.stdout.write(`${lines.join('\n')}\n`);
