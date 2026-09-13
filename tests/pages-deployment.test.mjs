import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Execute the workflow's actual preflight with the same shell options as Actions.
const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
const preflight = workflow.match(/        run: \|\n((?:          [^\n]*\n|\n)+)/)?.[1].replace(/^          /gm, '');
assert.ok(preflight, 'Pages workflow must include its deployment preflight');

async function runPreflight(t, endpoint) {
  const directory = await mkdtemp(join(tmpdir(), 'hallowmere-pages-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const summary = join(directory, 'summary.md');
  await writeFile(summary, '');
  const env = {...process.env, GITHUB_STEP_SUMMARY: summary};
  delete env.MULTIPLAYER_SERVER_URL;
  if (endpoint !== undefined) env.MULTIPLAYER_SERVER_URL = endpoint;
  const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', preflight], {env, encoding: 'utf8'});
  assert.ifError(result.error);
  return {...result, summary: await readFile(summary, 'utf8')};
}

test('Pages preparation fails clearly when its backend URL is absent, empty, or whitespace', async t => {
  for (const endpoint of [undefined, '', ' \t\n ']) {
    const result = await runPreflight(t, endpoint);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /::error::Pages deployment blocked/);
    assert.match(result.summary, /MULTIPLAYER_SERVER_URL/);
    assert.match(result.summary, /Run workflow/);
  }
});

test('Pages preparation proceeds to backend health validation when a URL is supplied', async t => {
  const result = await runPreflight(t, 'wss://backend.example/multiplayer');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.summary, '');
});
