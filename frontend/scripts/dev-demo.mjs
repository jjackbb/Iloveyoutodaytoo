import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// 기존 .env.local은 보존하고, 이 프로세스만 실제 DB·계측과 분리한다.
const child = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)),
  'dev', '--webpack', '--hostname', '127.0.0.1', '--port', process.env.ONEULDO_DEMO_PORT || '4317',
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    NEXT_PUBLIC_GA_ID: '',
  },
})

child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 0 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
