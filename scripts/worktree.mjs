import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, open, readFile, writeFile, rename, access} from 'node:fs/promises';
import {resolve, join, dirname, delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

export class WorkflowError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
}
const fail = (code, message, details) => { throw new WorkflowError(code, message, details); };
const digest = value => createHash('sha256').update(value).digest('hex');
const exists = path => access(path).then(() => true, () => false);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function save(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}
function run(command, args, cwd, onOutput, allowed = [0]) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {cwd, env: {...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}`, GIT_TERMINAL_PROMPT: '0'}, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {
      output = (output + data).slice(-64 * 1024);
      onOutput?.(data.toString());
    });
    child.on('error', reject);
    child.on('close', (code, signal) => allowed.includes(code)
      ? resolveRun({code, output: output.trim()})
      : reject(new WorkflowError('COMMAND_FAILED', `${command} ${args.join(' ')} failed (${signal || code}).`, {output, cwd})));
  });
}
const git = async (cwd, args, allowed) => (await run('git', args, cwd, null, allowed)).output;
const head = cwd => git(cwd, ['rev-parse', 'HEAD']);
const branch = cwd => git(cwd, ['branch', '--show-current']);
const ancestor = async (cwd, a, b) => (await run('git', ['merge-base', '--is-ancestor', a, b], cwd, null, [0, 1])).code === 0;

export async function repository(cwd = process.cwd()) {
  if (Number(process.versions.node.split('.')[0]) < 22) fail('NODE_VERSION', 'This repository requires Node.js 22 or newer. Run nvm use (when using nvm), then retry.');
  const root = await git(cwd, ['rev-parse', '--show-toplevel']);
  const common = await git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const raw = await git(root, ['worktree', 'list', '--porcelain', '-z']);
  const worktrees = raw.split('\0\0').filter(Boolean).map(block => Object.fromEntries(block.split('\0').filter(Boolean).map(line => {
    const space = line.indexOf(' ');
    return space < 0 ? [line, true] : [line.slice(0, space), line.slice(space + 1)];
  })));
  const main = worktrees.find(tree => tree.branch === 'refs/heads/main')?.worktree;
  if (!main) fail('MAIN_NOT_CHECKED_OUT', 'Keep main checked out in the primary repository before using this workflow.');
  return {root, common, main, worktrees, directory: join(common, 'codex-workflow')};
}
async function clean(cwd, label) {
  const changes = await git(cwd, ['status', '--porcelain', '--untracked-files=all']);
  if (changes) fail('DIRTY_CHECKOUT', `${label} has uncommitted changes. Commit only your own completed work, then retry.`, {cwd, changes});
  for (const operation of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
    if (await exists(await git(cwd, ['rev-parse', '--path-format=absolute', '--git-path', operation])))
      fail('GIT_OPERATION_PENDING', `${label} has an unfinished Git operation.`, {cwd, operation});
  }
}
async function locked(repo, fn, waitMs = 60000) {
  await mkdir(repo.directory, {recursive: true});
  const path = join(repo.directory, 'workflow.lock'), started = Date.now();
  let handle;
  while (!handle) {
    try { handle = await open(path, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started >= waitMs)
        fail('WORKFLOW_BUSY', 'Another worktree operation holds the repository lock. Retry after it finishes; inspect status if the lock remains.', {lock: path});
      await delay(100);
    }
  }
  try {
    await handle.writeFile(JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()}));
    return await fn();
  } finally {
    await handle.close();
    const {unlink} = await import('node:fs/promises');
    await unlink(path);
  }
}
const recordsPath = repo => join(repo.directory, 'tasks.json');
const records = async repo => await exists(recordsPath(repo)) ? await json(recordsPath(repo)) : {};
function identity(taskId) {
  const id = taskId || process.env.CODEX_THREAD_ID;
  if (!id || typeof id !== 'string' || id.length > 200) fail('TASK_ID_REQUIRED', 'Supply --task <stable-task-id>, or set CODEX_THREAD_ID. Reuse that ID throughout the task.');
  return id;
}
function freshBranch(name, taskId) {
  const slug = (name || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'task';
  return `codex/${slug}-${digest(taskId).slice(0, 8)}-${randomUUID().slice(0, 4)}`;
}
function portFor(path, tasks) {
  const used = new Set(Object.values(tasks).map(task => task.port));
  const offset = parseInt(digest(path).slice(0, 8), 16) % 1000;
  for (let i = 0; i < 1000; i++) {
    const port = 5300 + (offset + i) % 1000;
    if (!used.has(port)) return port;
  }
  fail('NO_PORTS', 'All reserved worktree development ports are in use.');
}

export async function startWorktree({cwd, taskId, name} = {}) {
  const repo = await repository(cwd), id = identity(taskId), key = digest(id);
  return locked(repo, async () => {
    const tasks = await records(repo);
    let task = tasks[key];
    if (task) {
      if (!await exists(task.path)) fail('MISSING_WORKTREE', 'The registered task worktree is missing; no files were recreated.', task);
      if (await branch(task.path) !== task.branch) fail('BRANCH_CHANGED', 'The registered worktree has switched branches. Resolve that change before continuing.', task);
      // A completed task can receive a follow-up without working from an old main.
      if (task.mergedHead && await head(task.path) === task.mergedHead && await ancestor(repo.main, task.mergedHead, 'main')) {
        await clean(task.path, 'Task worktree');
        task.branch = freshBranch(name || task.name, id);
        await git(task.path, ['switch', '-c', task.branch, 'main']);
        task.base = await head(task.path);
        delete task.mergedHead;
        delete task.mergeCommit;
      }
    } else {
      const owner = Object.values(tasks).find(item => item.path === repo.root);
      if (owner) fail('WORKTREE_OWNED', 'This worktree already belongs to another task. Start from the primary repository instead.', {taskId: owner.taskId, path: owner.path});
      let path = repo.root, taskBranch = await branch(path);
      if (path === repo.main) {
        await clean(repo.main, 'Main checkout');
        taskBranch = freshBranch(name, id);
        path = join(repo.main, '.worktrees', taskBranch.slice('codex/'.length));
        const ignored = await run('git', ['check-ignore', '--quiet', path], repo.main, null, [0, 1]);
        if (ignored.code !== 0) fail('WORKTREE_ROOT_NOT_IGNORED', 'Add .worktrees/ to the repository .gitignore before creating task worktrees.');
        await mkdir(dirname(path), {recursive: true});
        await git(repo.main, ['worktree', 'add', '-b', taskBranch, path, 'main']);
      } else if (!taskBranch) {
        taskBranch = freshBranch(name, id);
        await git(path, ['switch', '-c', taskBranch]);
      } else if (!taskBranch.startsWith('codex/')) {
        fail('NOT_TASK_BRANCH', 'Use a codex/ branch in the isolated worktree before registering it.');
      }
      task = {taskId: id, name: name || 'task', path, branch: taskBranch, base: await head(path), port: portFor(path, tasks)};
    }
    tasks[key] = task;
    await save(recordsPath(repo), tasks);
    return {ok: true, ...task, main: repo.main, next: `Run all task commands in ${task.path}. Run npm ci there before development.`};
  });
}

export async function finishWorktree({cwd, taskId, waitMs, onOutput} = {}) {
  const repo = await repository(cwd), id = identity(taskId), key = digest(id);
  return locked(repo, async () => {
    const tasks = await records(repo), task = tasks[key];
    if (!task || task.path !== repo.root) fail('NOT_TASK_WORKTREE', 'Run finish from the registered task worktree with the same task ID used by start.');
    if (await branch(repo.root) !== task.branch) fail('BRANCH_CHANGED', 'The task worktree has switched branches.');
    await clean(repo.root, 'Task worktree');
    await clean(repo.main, 'Main checkout');
    const sourceHead = await head(repo.root), mainHead = await head(repo.main);
    if (await ancestor(repo.main, sourceHead, mainHead)) {
      return {ok: true, status: 'already-integrated', branch: task.branch, main: mainHead, mergeCommit: task.mergeCommit || null};
    }
    let integration = task.integration;
    if (!integration || integration.sourceHead !== sourceHead || integration.mainHead !== mainHead) {
      if (integration) (task.previousIntegrations ||= []).push(integration.path);
      const path = join(repo.main, '.worktrees', `integration-${randomUUID()}`);
      await mkdir(dirname(path), {recursive: true});
      await git(repo.main, ['worktree', 'add', '--detach', path, mainHead]);
      integration = task.integration = {path, mainHead, sourceHead};
      await save(recordsPath(repo), tasks);
      try { await git(path, ['merge', '--no-ff', '-m', `Merge ${task.branch}`, sourceHead]); }
      catch (error) { fail('MERGE_BLOCKED', 'Resolve the merge in the retained integration worktree, commit the resolution, then run finish again from your task worktree.', {integration: path, cause: error.details?.output || error.message}); }
    }
    const path = integration.path;
    await clean(path, 'Integration worktree');
    if (!await ancestor(path, mainHead, 'HEAD') || !await ancestor(path, sourceHead, 'HEAD'))
      fail('INVALID_INTEGRATION', 'The integration commit must contain both the task and main commits.', {integration: path});
    const candidate = await head(path);
    for (const args of [['ci'], ['test'], ['run', 'build']]) {
      onOutput?.(`\nValidating ${task.branch}: npm ${args.join(' ')}\n`);
      try { await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, path, onOutput); }
      catch (error) { fail('VALIDATION_FAILED', `Validation failed; main was not updated. Fix the task or retained integration worktree, then retry.`, {integration: path, command: `npm ${args.join(' ')}`, cause: error.details?.output || error.message}); }
    }
    await clean(path, 'Validated integration worktree');
    if (await head(path) !== candidate) fail('INTEGRATION_CHANGED', 'Validation changed the integration commit. Retry after reviewing those changes.');
    await clean(repo.root, 'Task worktree');
    await clean(repo.main, 'Main checkout');
    if (await head(repo.root) !== sourceHead || await branch(repo.root) !== task.branch)
      fail('TASK_ADVANCED', 'The task changed during validation. Retry to validate its latest commit.');
    if (await head(repo.main) !== mainHead || await branch(repo.main) !== 'main')
      fail('MAIN_ADVANCED', 'Main changed during validation. Retry to merge and validate against its latest commit.');
    await git(repo.main, ['merge', '--ff-only', candidate]);
    task.mergedHead = sourceHead;
    task.mergeCommit = candidate;
    delete task.integration;
    await save(recordsPath(repo), tasks);
    let cleanupWarning;
    try { await git(repo.main, ['worktree', 'remove', path]); }
    catch { cleanupWarning = `Merged successfully; the integration worktree remains at ${path}.`; }
    return {ok: true, status: 'merged', branch: task.branch, mergeCommit: candidate, validation: ['npm ci', 'npm test', 'npm run build'], ...(cleanupWarning ? {cleanupWarning} : {})};
  }, waitMs);
}

export async function workflowStatus({cwd} = {}) {
  const repo = await repository(cwd), lock = join(repo.directory, 'workflow.lock');
  return {ok: true, main: repo.main, mainHead: await head(repo.main), current: repo.root, tasks: Object.values(await records(repo)), lock: await exists(lock) ? {path: lock, owner: await readFile(lock, 'utf8')} : null};
}
export async function developmentPort(cwd) {
  const repo = await repository(cwd);
  if (repo.root === repo.main) return 5182;
  const task = Object.values(await records(repo)).find(item => item.path === repo.root);
  if (!task) fail('NOT_REGISTERED', 'Run the worktree start command before starting this worktree’s development server.');
  return task.port;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--task', '--name'].includes(args[i]) || !args[i + 1]) fail('USAGE', 'Usage: node scripts/worktree.mjs start|finish|status [--task <id>] [--name <name>]');
      options[args[i] === '--task' ? 'taskId' : 'name'] = args[i + 1];
    }
    const action = {start: startWorktree, finish: finishWorktree, status: workflowStatus}[command];
    if (!action) fail('USAGE', 'Usage: node scripts/worktree.mjs start|finish|status [--task <id>] [--name <name>]');
    console.log(JSON.stringify(await action({...options, onOutput: output => process.stderr.write(output)}), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ok: false, code: error.code || 'ERROR', message: error.message, ...error.details}, null, 2));
    process.exitCode = 1;
  }
}
