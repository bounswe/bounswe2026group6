const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  BACKEND_URL,
  BASE_URL,
  DB_CONFIG,
  E2E_BACKEND_PORT,
  E2E_HOST,
  E2E_WEB_PORT,
  JWT_SECRET,
  SERVER_STATE_PATH,
  TEST_RESULTS_DIR,
  applyDefaultTestEnv,
} = require('./helpers/config');

const npmCommand = process.platform === 'win32' ? process.execPath : 'npm';
const npmArgsPrefix = process.platform === 'win32'
  ? [
      process.env.npm_execpath
      || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ]
  : [];

function createLogFile(name) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  const logPath = path.join(TEST_RESULTS_DIR, `${name}.log`);
  const logFd = fs.openSync(logPath, 'a');
  return { logFd, logPath };
}

function startProcess({ name, cwd, args, env }) {
  const { logFd, logPath } = createLogFile(name);
  const child = spawn(npmCommand, [...npmArgsPrefix, ...args], {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });

  child.unref();
  fs.closeSync(logFd);

  return {
    name,
    pid: child.pid,
    logPath,
  };
}

async function waitForUrl(url, { timeoutMs = 90_000, intervalMs = 750 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }

      lastError = new Error(`Unexpected status ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function killProcessGroup(pid) {
  if (!pid) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/t', '/f']);
      return;
    }

    process.kill(-pid, 'SIGTERM');
  } catch (_error) {
    // Best effort cleanup.
  }
}

function killProcess(pid) {
  if (!pid) {
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (_error) {
    // Best effort cleanup.
  }
}

function cleanupExistingProcesses() {
  if (fs.existsSync(SERVER_STATE_PATH)) {
    try {
      const state = JSON.parse(fs.readFileSync(SERVER_STATE_PATH, 'utf8'));
      for (const processInfo of state.processes || []) {
        killProcessGroup(processInfo.pid);
      }
    } catch (_error) {
      // Best effort cleanup.
    }

    fs.rmSync(SERVER_STATE_PATH, { force: true });
  }

  for (const port of [E2E_BACKEND_PORT, E2E_WEB_PORT]) {
    const result = spawnSync('lsof', ['-ti', `tcp:${port}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.status !== 0 || !result.stdout) {
      continue;
    }

    for (const pid of result.stdout
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)) {
      killProcess(Number(pid));
    }
  }
}

module.exports = async function globalSetup() {
  applyDefaultTestEnv();
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  cleanupExistingProcesses();

  const backendGlobalSetup = require(path.resolve(
    __dirname,
    '../../backend/tests/setup/global-setup.js'
  ));

  await backendGlobalSetup();

  const processes = [];

  try {
    const backendProcess = startProcess({
      name: 'backend-e2e',
      cwd: path.resolve(__dirname, '../../backend'),
      args: ['start'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_PORT: String(E2E_BACKEND_PORT),
        POSTGRES_HOST: DB_CONFIG.host,
        POSTGRES_PORT: String(DB_CONFIG.port),
        POSTGRES_USER: DB_CONFIG.user,
        POSTGRES_PASSWORD: DB_CONFIG.password,
        POSTGRES_DB: DB_CONFIG.database,
        JWT_SECRET,
        APP_URL: BACKEND_URL,
        FRONTEND_URL: BASE_URL,
      },
    });
    processes.push(backendProcess);

    await waitForUrl(`${BACKEND_URL}/health`);

    const webProcess = startProcess({
      name: 'web-e2e',
      cwd: path.resolve(__dirname, '..'),
      args: ['run', 'dev', '--', '--hostname', E2E_HOST, '--port', String(E2E_WEB_PORT)],
      env: {
        ...process.env,
        PORT: String(E2E_WEB_PORT),
        NEXT_PUBLIC_API_BASE_URL: '/api',
        API_BASE_URL: `${BACKEND_URL}/api`,
      },
    });
    processes.push(webProcess);

    await waitForUrl(`${BASE_URL}/login`);

    fs.writeFileSync(
      SERVER_STATE_PATH,
      JSON.stringify(
        {
          startedAt: new Date().toISOString(),
          backendUrl: BACKEND_URL,
          baseUrl: BASE_URL,
          processes,
        },
        null,
        2
      )
    );
  } catch (error) {
    processes.forEach((processInfo) => killProcessGroup(processInfo.pid));
    throw error;
  }
};
