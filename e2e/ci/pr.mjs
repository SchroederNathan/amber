// The pull request the workflow runs for, from PR_JSON (the workflow's
// `toJSON(github.event.pull_request || '')`). Empty on manual runs.
// CLI: `node e2e/ci/pr.mjs number|base_sha|title|body` prints one field.
export function readPullRequest() {
  try {
    const pr = JSON.parse(process.env.PR_JSON || '""');
    return pr && typeof pr === 'object' ? pr : {};
  } catch {
    return {};
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pr = readPullRequest();
  const fields = { number: pr.number, base_sha: pr.base?.sha, title: pr.title, body: pr.body };
  process.stdout.write(String(fields[process.argv[2]] ?? ''));
}
