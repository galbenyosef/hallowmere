import {spawn} from 'node:child_process';
import {developmentPort} from './worktree.mjs';

const port = process.env.PORT || await developmentPort(process.cwd());
const child = spawn(process.execPath, ['--watch', 'scripts/serve.mjs', ...process.argv.slice(2)], {
  stdio: 'inherit', env: {...process.env, PORT: String(port)}
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
