# Working in this repository

Every implementation task uses an isolated Git worktree and its own `codex/` branch. The primary checkout stays on `main` and is the integration target. This policy applies to this repository only. The user has authorized local commits and automatic local merges after validation; pushing, opening pull requests, and deploying require a separate request.

## Before editing

Use Node.js 22 or newer. The repository includes `.nvmrc`; run `nvm use` if the shell has selected an older Node version. In a shell without nvm loaded, prefix commands with `bash scripts/node22.sh` (for example, `bash scripts/node22.sh node scripts/worktree.mjs start --task <task-id> --name <short-name>`). Codex setup and actions use this launcher automatically.

1. Run `node scripts/worktree.mjs start --task <task-id> --name <short-task-name>` from the current checkout. Use `CODEX_THREAD_ID` as the stable task ID when available (the helper reads it automatically). Otherwise use this task's ID or choose one stable unique ID and retain it for follow-ups.
2. Read the returned `path` and use that directory as the working directory for **every** edit, command, test, and commit. Never continue implementation in the primary checkout. This also applies when the app composer was accidentally left in Local mode.
3. Run `npm ci` in the task worktree unless the Codex environment setup has already installed dependencies. Do not share `node_modules` between worktrees.

The helper reuses this task's registered worktree and adopts a new Codex-managed worktree, creating a branch if its HEAD is detached. It refuses to adopt another task's registered directory. When a completed task receives a follow-up, run `start` again before editing; it creates a fresh branch from current local `main` in the retained task directory.

For planning, explanations, and read-only reviews, no worktree or merge is necessary. Respect Plan mode and any user instruction to leave work uncommitted or unmerged.

## Development and validation

- `npm run dev:worktree` starts the game with the port reserved for this task. Add `-- --network` for other devices. The primary checkout uses port 5182. A deliberate `PORT` environment variable overrides the reservation.
- Run `npm test` and `npm run build` as the standard checks, plus checks appropriate to the change.
- Keep edits focused on the requested task. Never stash, discard, reset, or commit another task's work. Do not auto-merge merely because a conversational turn is ending.

## Completing implementation

1. Review the diff and commit only this task's completed changes in its worktree. The checkout must be clean, including non-ignored untracked files.
2. Run `node scripts/worktree.mjs finish --task <same-task-id>` from the task worktree. Do this before declaring the implementation complete.
3. The helper serializes integration, merges against the latest local `main` in a temporary worktree, installs dependencies, runs tests and build validation, and fast-forwards the clean main checkout to that exact validated merge commit. It never pushes.
4. If a merge conflicts, use the integration path in the error. Resolve only conflicts whose intended behavior is clear, commit the resolution there, and rerun `finish` from the task worktree. If fixing the source task instead, commit there and rerun `finish`; the helper builds a fresh integration checkout.
5. If main or the task advances during validation, rerun `finish` against the new state. If another merge holds the lock, wait for it and retry. If main is dirty, preserve those edits and report the blocker; never clean main automatically. Report ambiguous conflicts or failing checks with the retained branch and integration path.
6. On success, report the task branch, merge commit, and validation results. Keep the task worktree for follow-ups. Never delete a running task's worktree or force-remove failed integration worktrees.

Use `node scripts/worktree.mjs status` to inspect registered tasks, ports, pending integrations, and the repository lock. A lock left by a terminated process must be investigated; the helper never steals it based on age.
