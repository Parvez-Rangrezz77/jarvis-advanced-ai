const { spawn, execSync } = require('child_process');
const http = require('http');

// Kill any process using port 3000 before starting
try {
  if (process.platform === 'win32') {
    execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :3000 ^| findstr LISTENING\') do taskkill /f /pid %a', { stdio: 'ignore' });
  }
} catch (e) {}

console.log('[Runner] Starting Vite dev server...');
const vite = spawn('npm', ['run', 'dev'], { 
  shell: true, 
  stdio: 'inherit',
  env: { ...process.env, DISABLE_HMR: 'false' } 
});

let electronStarted = false;

function checkViteServer() {
  if (electronStarted) return;

  const req = http.get('http://localhost:3000', (res) => {
    console.log('[Runner] Vite server is ready. Launching Electron...');
    electronStarted = true;
    launchElectron();
  });

  req.on('error', () => {
    // Retry in 500ms
    setTimeout(checkViteServer, 500);
  });
}

function launchElectron() {
  const electron = spawn('node', ['node_modules/electron/cli.js', '.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: 'http://localhost:3000'
    }
  });

  electron.on('close', (code) => {
    console.log(`[Runner] Electron process exited with code ${code}. Cleaning up Vite...`);
    // Kill Vite server on Electron close
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', vite.pid, '/f', '/t'], { shell: true });
    } else {
      vite.kill('SIGINT');
    }
    process.exit(code);
  });
}

// Start checking for port 3000
setTimeout(checkViteServer, 1000);
