const net = require('net');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9222;
const CDP_URL = `http://localhost:${PORT}`;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '..', '.vtop-chrome');
const URL = "https://vtop.vit.ac.in/vtop/";
const ROOT = path.join(__dirname, '..');
const ACTIONS_DIR = path.join(ROOT, 'actions');
const LOGIN_JS = path.join(ACTIONS_DIR, 'login.js');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function portOpen() {
  return new Promise(resolve => {
    let done = false;
    const socket = net.connect(PORT, '127.0.0.1', () => {
      if (done) return;
      done = true;
      try { socket.end(); } catch (e) {}
      resolve(true);
    });
    socket.on('error', () => {
      if (done) return;
      done = true;
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (e) {}
      resolve(false);
    });
  });
}

async function waitForPort(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await portOpen()) return true;
    await sleep(500);
  }
  return false;
}

function cli(args) {
  try {
    return execSync(`playwright-cli -s=opencode ${args}`, { encoding: 'utf8', shell: true });
  } catch (e) {
    return '';
  }
}

function spawnCli(args) {
  return spawn('powershell.exe', ['-NoProfile', '-Command', `playwright-cli -s=opencode ${args}`], {
    detached: true, stdio: 'ignore'
  });
}

function runCodeFile(file) {
  return execSync(`playwright-cli -s=opencode --raw run-code --filename="${file}"`, { encoding: 'utf8' }).trim();
}

async function main() {
  let open = await portOpen();
  if (!open) {
    const child = spawn(CHROME_PATH, [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--start-maximized',
      URL
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    open = await waitForPort(15000);
    if (!open) {
      console.log(JSON.stringify({ error: 'chrome_launch_failed' }));
      process.exit(1);
    }
  }

  // Attach if not already attached (blocking execSync; attach returns quickly).
  let listOutput = cli('list');
  const isAttached = (s) => s.includes('opencode') && s.includes('attached');
  if (!isAttached(listOutput)) {
    try {
      cli(`attach --cdp=${CDP_URL}`);
    } catch (e) {}
    await sleep(1500);
    listOutput = cli('list');
    if (!isAttached(listOutput)) {
      console.log(JSON.stringify({ error: 'attach_failed' }));
      process.exit(1);
    }
  }

  // Make sure the VTOP tab is selected.
  const tabs = cli('tab-list');
  const mt = tabs.match(/^-\s*(\d+):[^\[]*\[[^]]*\]\((https:\/\/vtop\.vit\.ac\.in[^)]*)\)/m);
  if (mt) {
    try { cli(`tab-select ${mt[1]}`); } catch (e) {}
  }

  // Check if already logged in (Academics menu <a role="button"> visible).
  let output = null;
  let exitCode = 1;

  const checkFile = path.join(ACTIONS_DIR, '_create_vtop_check.js');
  fs.writeFileSync(checkFile, 'async page => { return page.locator(\'a[role="button"]:has-text("Academics")\').first().isVisible().catch(() => false); }', 'utf8');
  try {
    let res = '';
    try { res = runCodeFile(checkFile); } catch (e) { res = ''; }
    if (res === 'true') {
      output = { status: 'already_logged_in' };
      exitCode = 0;
    }
  } finally {
    try { fs.unlinkSync(checkFile); } catch (e) {}
  }

  if (output === null) {
    // Test whether process.env is visible inside run-code.
    const envTestFile = path.join(ACTIONS_DIR, '_create_vtop_env.js');
    fs.writeFileSync(envTestFile, 'async page => { return { visible: !!process.env.VTOP_USER }; }', 'utf8');
    let envVisible = false;
    try {
      let res = '';
      try { res = runCodeFile(envTestFile); } catch (e) { res = ''; }
      try { envVisible = JSON.parse(res).visible === true; } catch (e) {}
    } finally {
      try { fs.unlinkSync(envTestFile); } catch (e) {}
    }

    // Run actions/login.js, injecting credentials from .env if env is not visible in run-code.
    let runFile = LOGIN_JS;
    const tempFile = path.join(ACTIONS_DIR, '_create_vtop_login.js');
    try {
      if (!envVisible) {
        const envPath = path.join(ROOT, '.env');
        let vtopUser = '';
        let vtopPass = '';
        if (fs.existsSync(envPath)) {
          for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?$/);
            if (match) {
              let val = (match[2] || '').trim();
              val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
              if (match[1] === 'VTOP_USER') vtopUser = val;
              if (match[1] === 'VTOP_PASS') vtopPass = val;
            }
          }
        }
        const loginCode = fs.readFileSync(LOGIN_JS, 'utf8');
        const injected = loginCode
          .replace(/process\.env\.VTOP_USER/g, JSON.stringify(vtopUser))
          .replace(/process\.env\.VTOP_PASS/g, JSON.stringify(vtopPass));
        fs.writeFileSync(tempFile, injected, 'utf8');
        runFile = tempFile;
      }

      const result = runCodeFile(runFile);
      let parsed = null;
      try { parsed = JSON.parse(result); } catch (e) {}
      if (parsed && parsed.status === 'logged_in') {
        output = { status: 'logged_in' };
        exitCode = 0;
      } else {
        output = { error: (parsed && parsed.error) ? parsed.error : 'login_failed' };
        exitCode = 1;
      }
    } catch (e) {
      output = { error: 'login_execution_error', details: e.message };
      exitCode = 1;
    } finally {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
  }

  console.log(JSON.stringify(output));
  process.exit(exitCode);
}

main();
