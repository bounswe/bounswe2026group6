const fs = require('fs');
const { spawnSync } = require('child_process');
const { E2E_BACKEND_PORT, E2E_WEB_PORT, SERVER_STATE_PATH } = require('./helpers/config');

function killProcessGroup(pid) {
  if (!pid) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
      return;
    }

    process.kill(-pid, 'SIGTERM');
  } catch (_error) {
    // Best effort cleanup.
  }
}

function killPortOccupants(port) {
  const result = spawnSync('lsof', ['-ti', `tcp:${port}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0 || !result.stdout) {
    return;
  }

  for (const pid of result.stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)) {
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch (_error) {
      // Best effort cleanup.
    }
  }
}

module.exports = async function globalTeardown() {
  if (!fs.existsSync(SERVER_STATE_PATH)) {
    return;
  }

  const state = JSON.parse(fs.readFileSync(SERVER_STATE_PATH, 'utf8'));

  for (const processInfo of state.processes || []) {
    killProcessGroup(processInfo.pid);
  }

  fs.rmSync(SERVER_STATE_PATH, { force: true });
  killPortOccupants(E2E_BACKEND_PORT);
  killPortOccupants(E2E_WEB_PORT);
};
