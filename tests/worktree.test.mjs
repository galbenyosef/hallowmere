import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm, access, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startWorktree, finishWorktree, workflowStatus, developmentPort} from '../scripts/worktree.mjs';

const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const head = cwd => git(cwd, 'rev-parse', 'HEAD');
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hallowmere-workflow-test-')));
  t.after(() => rm(root, {recursive: true, force: true}));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'worktree-test@example.invalid');
  git(root, 'config', 'user.name', 'Worktree test');
  git(root, 'config', 'commit.gpgSign', 'false');
  git(root, 'config', 'core.hooksPath', join(root, '.git', 'no-hooks'));
  await writeFile(join(root, '.gitignore'), '.worktrees/\nnode_modules/\n');
  const pkg = {name: 'worktree-fixture', version: '1.0.0', private: true, scripts: {test: 'node check.cjs test', build: 'node check.cjs build'}};
  await writeFile(join(root, 'package.json'), JSON.stringify(pkg));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: {'': {name: pkg.name, version: pkg.version}}}));
  await writeFile(join(root, 'check.cjs'), "const fs=require('node:fs');console.log('CHECK_'+process.argv[2]);if(fs.existsSync('break-'+process.argv[2]))process.exit(1);\n");
  await writeFile(join(root, 'shared.txt'), 'original\n');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'Fixture baseline');
  return root;
}
async function commit(cwd, name, content = `${name}\n`) {
  await writeFile(join(cwd, name), content);
  git(cwd, 'add', '--', name); git(cwd, 'commit', '-m', `Update ${name}`);
  return head(cwd);
}
const rejectCode = code => error => { assert.equal(error.code, code, error.message); return true; };

test('start isolates two tasks, reuses ownership, and reserves stable distinct ports', async t => {
  const root = await fixture(t), original = head(root);
  const [a, b] = await Promise.all([
    startWorktree({cwd: root, taskId: 'a', name: 'First task'}),
    startWorktree({cwd: root, taskId: 'b', name: 'Second task'})
  ]);
  assert.notEqual(a.path, b.path); assert.notEqual(a.branch, b.branch); assert.notEqual(a.port, b.port);
  assert.match(a.branch, /^codex\/first-task-[a-f0-9]{8}-[a-f0-9]{4}$/);
  assert.equal((await startWorktree({cwd: root, taskId: 'a'})).path, a.path);
  assert.equal(await developmentPort(a.path), a.port); assert.equal(await developmentPort(root), 5182);
  await commit(a.path, 'a.txt');
  assert.equal(head(root), original); assert.equal(head(b.path), original);
  await assert.rejects(access(join(b.path, 'a.txt')));
  await assert.rejects(startWorktree({cwd: a.path, taskId: 'intruder'}), rejectCode('WORKTREE_OWNED'));
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('app-created detached worktrees are adopted without dropping files', async t => {
  const root = await fixture(t), path = join(root, '.worktrees', 'app-created');
  git(root, 'worktree', 'add', '--detach', path, 'main');
  await writeFile(join(path, 'existing.txt'), 'keep');
  const task = await startWorktree({cwd: path, taskId: 'app-task', name: 'Native'});
  assert.equal(task.path, path); assert.match(task.branch, /^codex\/native-/);
  assert.equal(await readFile(join(path, 'existing.txt'), 'utf8'), 'keep');
  assert.equal(git(root, 'branch', '--show-current'), 'main');
});

test('simultaneous completions serialize, validate the combined result, and keep both tasks', async t => {
  const root = await fixture(t);
  const a = await startWorktree({cwd: root, taskId: 'a'}), b = await startWorktree({cwd: root, taskId: 'b'});
  const aHead = await commit(a.path, 'a.txt'), bHead = await commit(b.path, 'b.txt');
  const result = await Promise.all([
    finishWorktree({cwd: a.path, taskId: 'a'}), finishWorktree({cwd: b.path, taskId: 'b'})
  ]);
  assert.ok(result.every(r => r.status === 'merged'));
  git(root, 'merge-base', '--is-ancestor', aHead, 'main'); git(root, 'merge-base', '--is-ancestor', bHead, 'main');
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'a.txt\n');
  assert.equal(await readFile(join(root, 'b.txt'), 'utf8'), 'b.txt\n');
  assert.equal((await workflowStatus({cwd: root})).lock, null);
  assert.equal(git(root, 'worktree', 'list', '--porcelain').match(/^worktree /gm).length, 3);
  assert.equal(git(root, 'status', '--porcelain'), '');
  await access(a.path); await access(b.path);
});

test('repeated finish is a no-op; a follow-up starts from latest main in the same task directory', async t => {
  const root = await fixture(t), a = await startWorktree({cwd: root, taskId: 'a', name: 'one'});
  await commit(a.path, 'a.txt');
  const result = await finishWorktree({cwd: a.path, taskId: 'a'}), integrated = head(root);
  assert.equal(result.mergeCommit, integrated);
  assert.equal((await finishWorktree({cwd: a.path, taskId: 'a'})).status, 'already-integrated');
  assert.equal(head(root), integrated);
  const b = await startWorktree({cwd: root, taskId: 'b'}); await commit(b.path, 'b.txt');
  await finishWorktree({cwd: b.path, taskId: 'b'});
  const followup = await startWorktree({cwd: a.path, taskId: 'a'});
  assert.equal(followup.path, a.path); assert.notEqual(followup.branch, a.branch);
  assert.equal(head(followup.path), head(root));
  assert.equal(await readFile(join(a.path, 'b.txt'), 'utf8'), 'b.txt\n');
});

test('dirty task and dirty main block integration without stashing or committing edits', async t => {
  const root = await fixture(t), a = await startWorktree({cwd: root, taskId: 'a'}), original = head(root);
  await writeFile(join(a.path, 'uncommitted.txt'), 'task work');
  await assert.rejects(finishWorktree({cwd: a.path, taskId: 'a'}), rejectCode('DIRTY_CHECKOUT'));
  git(a.path, 'add', '.'); git(a.path, 'commit', '-m', 'Complete task');
  await writeFile(join(root, 'someone-elses.txt'), 'untouched');
  await assert.rejects(finishWorktree({cwd: a.path, taskId: 'a'}), rejectCode('DIRTY_CHECKOUT'));
  assert.equal(head(root), original); assert.equal(await readFile(join(root, 'someone-elses.txt'), 'utf8'), 'untouched');
  assert.equal(git(root, 'stash', 'list'), '');
  await assert.rejects(startWorktree({cwd: root, taskId: 'b'}), rejectCode('DIRTY_CHECKOUT'));
});

test('failed tests and builds retain integration and never advance main', async t => {
  const root = await fixture(t), original = head(root);
  for (const check of ['test', 'build']) {
    const task = await startWorktree({cwd: root, taskId: check});
    await commit(task.path, `break-${check}`);
    await assert.rejects(finishWorktree({cwd: task.path, taskId: check}), error => {
      assert.equal(error.code, 'VALIDATION_FAILED'); assert.match(error.details.command, new RegExp(check)); return true;
    });
    const pending = (await workflowStatus({cwd: root})).tasks.find(item => item.taskId === check).integration;
    await access(pending.path); assert.equal(head(root), original);
  }
});

test('overlapping edits stay in a retained integration until the resolution is committed and validated', async t => {
  const root = await fixture(t), a = await startWorktree({cwd: root, taskId: 'a'}), b = await startWorktree({cwd: root, taskId: 'b'});
  await commit(a.path, 'shared.txt', 'first\n'); await commit(b.path, 'shared.txt', 'second\n');
  await finishWorktree({cwd: a.path, taskId: 'a'});
  const before = head(root);
  await assert.rejects(finishWorktree({cwd: b.path, taskId: 'b'}), rejectCode('MERGE_BLOCKED'));
  assert.equal(head(root), before); assert.equal(await readFile(join(root, 'shared.txt'), 'utf8'), 'first\n');
  const pending = (await workflowStatus({cwd: root})).tasks.find(item => item.taskId === 'b').integration;
  await commit(pending.path, 'shared.txt', 'first and second\n');
  const result = await finishWorktree({cwd: b.path, taskId: 'b'});
  assert.equal(result.status, 'merged'); assert.equal(await readFile(join(root, 'shared.txt'), 'utf8'), 'first and second\n');
});

test('main advancing during validation blocks promotion and retry includes the newer main', async t => {
  const root = await fixture(t), a = await startWorktree({cwd: root, taskId: 'a'});
  await commit(a.path, 'a.txt');
  let advanced;
  await assert.rejects(finishWorktree({cwd: a.path, taskId: 'a', onOutput: output => {
    if (!advanced && output.includes('CHECK_test')) {
      git(root, 'commit', '--allow-empty', '-m', 'External main advancement'); advanced = head(root);
    }
  }}), rejectCode('MAIN_ADVANCED'));
  assert.equal(head(root), advanced); await assert.rejects(access(join(root, 'a.txt')));
  assert.equal((await finishWorktree({cwd: a.path, taskId: 'a'})).status, 'merged');
  git(root, 'merge-base', '--is-ancestor', advanced, 'main');
  assert.equal((await workflowStatus({cwd: root})).tasks[0].previousIntegrations.length, 1);
});

test('source advancing during validation blocks promotion', async t => {
  const root = await fixture(t), a = await startWorktree({cwd: root, taskId: 'a'}), original = head(root);
  await commit(a.path, 'a.txt'); let advanced = false;
  await assert.rejects(finishWorktree({cwd: a.path, taskId: 'a', onOutput: output => {
    if (!advanced && output.includes('CHECK_test')) {
      git(a.path, 'commit', '--allow-empty', '-m', 'Task advanced'); advanced = true;
    }
  }}), rejectCode('TASK_ADVANCED'));
  assert.equal(head(root), original);
});

test('an existing lock is never stolen and its owner remains inspectable', async t => {
  const root = await fixture(t), a = await startWorktree({cwd: root, taskId: 'a'});
  await commit(a.path, 'a.txt');
  const lock = join(root, '.git', 'codex-workflow', 'workflow.lock'), owner = '{"pid":123,"startedAt":"2000-01-01"}';
  await writeFile(lock, owner);
  await assert.rejects(finishWorktree({cwd: a.path, taskId: 'a', waitMs: 10}), rejectCode('WORKFLOW_BUSY'));
  assert.equal((await workflowStatus({cwd: root})).lock.owner, owner);
  assert.equal(await readFile(lock, 'utf8'), owner);
});
