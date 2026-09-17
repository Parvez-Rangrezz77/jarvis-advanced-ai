const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, shell, screen } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const memory = require('./memory.cjs');

// Prevent main process crashes on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception in Electron Main Process:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in Electron Main Process:', reason);
});

// Auto-detect WhatsApp audio file in Downloads and sync to public/sounds/
function checkAndSyncCustomSound() {
  try {
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
    if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });

    if (fs.existsSync(downloadsDir)) {
      const files = fs.readdirSync(downloadsDir);
      const match = files.find(f => f.toLowerCase().includes('whatsapp') && (f.toLowerCase().includes('audio') || f.toLowerCase().includes('sound')));
      if (match) {
        const src = path.join(downloadsDir, match);
        const ext = path.extname(match) || '.mp3';
        const dest = path.join(soundsDir, `whatsapp_audio${ext}`);
        fs.copyFileSync(src, dest);
        console.log(`Auto-synced custom sound: ${match} -> ${dest}`);
      }
    }
  } catch (e) {
    console.error('Error syncing custom sound:', e);
  }
}
checkAndSyncCustomSound();

let mainWindow;
let statsInterval;

// CPU Calculation variables
let startCPU = getCPUUsage();

function getCPUUsage() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
  
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

function calculateCPU() {
  const endCPU = getCPUUsage();
  const idleDiff = endCPU.idle - startCPU.idle;
  const totalDiff = endCPU.total - startCPU.total;
  startCPU = endCPU;
  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 100);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless for JARVIS cinematic UI
    transparent: true, // Transparent window for glassmorphism
    backgroundColor: '#00000000', // Set transparent background
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  // Load URL
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle URL navigation externally in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    clearInterval(statsInterval);
  });

  // Start polling system statistics
  startStatsPolling();
}

function startStatsPolling() {
  if (statsInterval) clearInterval(statsInterval);
  
  statsInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const cpu = calculateCPU();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const ram = Math.round(((totalMem - freeMem) / totalMem) * 100);
      
      // Also calculate network simulated speed or basic info (could be expanded)
      mainWindow.webContents.send('system-stats', { cpu, ram });
    }
  }, 2000);
}

// App events
app.whenReady().then(() => {
  createWindow();

  // Register Global Shortcut (Ctrl+Alt+J) to toggle window visibility
  globalShortcut.register('CommandOrControl+Alt+J', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Communication Handlers

// Window Controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Native Open App
ipcMain.handle('open-app', async (event, appName) => {
  let command = '';
  const name = appName.toLowerCase().trim();
  
  if (name.includes('calc') || name.includes('calculator')) {
    command = 'start calc';
  } else if (name.includes('notepad')) {
    command = 'start notepad';
  } else if (name.includes('paint') || name.includes('mspaint')) {
    command = 'start mspaint';
  } else if (name.includes('explorer') || name.includes('file') || name.includes('folder')) {
    command = 'start explorer';
  } else if (name.includes('chrome')) {
    command = 'start chrome';
  } else if (name.includes('cmd') || name.includes('terminal')) {
    command = 'start cmd';
  } else if (name.includes('powershell')) {
    command = 'start powershell';
  } else if (name.includes('code') || name.includes('vscode') || name.includes('visual studio')) {
    command = 'code .';
  } else {
    // Attempt to run standard shell start
    command = `start ${appName}`;
  }

  return new Promise((resolve) => {
    exec(command, (error) => {
      if (error) {
        // Fallback: try running executable name directly
        exec(appName, (err2) => {
          if (err2) {
            resolve({ success: false, error: err2.message });
          } else {
            resolve({ success: true });
          }
        });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// Execute arbitrary system command (Full System Control Access)
ipcMain.handle('execute-system-command', async (event, command) => {
  let processedCommand = String(command || '');

  // 1. Transform raw [System.Windows.Forms.SendKeys]::SendWait to WScript.Shell SendKeys
  processedCommand = processedCommand.replace(
    /\[System\.Windows\.Forms\.SendKeys\]::SendWait\((.*?)\)/gi,
    '(New-Object -ComObject WScript.Shell).SendKeys($1)'
  );

  // 2. Transform Set-ForegroundWindow calls to WScript.Shell AppActivate
  processedCommand = processedCommand.replace(
    /Set-ForegroundWindow\s+(-ProcessName\s+)?["']?([^; "']+)["']?/gi,
    '(New-Object -ComObject WScript.Shell).AppActivate("$2")'
  );
  processedCommand = processedCommand.replace(
    /SetForegroundWindow\s+(-ProcessName\s+)?["']?([^; "']+)["']?/gi,
    '(New-Object -ComObject WScript.Shell).AppActivate("$2")'
  );

  // 3. Prepend helper functions as safety net
  let preambles = [
    'function Set-ForegroundWindow($target) { (New-Object -ComObject WScript.Shell).AppActivate($target) }',
    'function SetForegroundWindow($target) { (New-Object -ComObject WScript.Shell).AppActivate($target) }'
  ];

  processedCommand = `${preambles.join('; ')}; ${processedCommand}`;

  return new Promise((resolve) => {
    exec(processedCommand, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          stdout: stdout.toString(),
          stderr: stderr.toString()
        });
      } else {
        resolve({
          success: true,
          stdout: stdout.toString(),
          stderr: stderr.toString()
        });
      }
    });
  });
});

// Dedicated Type Text Handler (Native typing via WScript.Shell)
ipcMain.handle('type-text', async (event, payload) => {
  const text = typeof payload === 'string' ? payload : (payload?.text || '');
  const targetApp = typeof payload === 'object' ? payload?.targetApp : undefined;

  let ps = '';
  if (targetApp) {
    ps += `(New-Object -ComObject WScript.Shell).AppActivate('${targetApp.replace(/'/g, "''")}'); Start-Sleep -Milliseconds 300; `;
  }

  // Escape SendKeys special characters safely
  const safeText = text.replace(/'/g, "''").replace(/([{}~%^+()\[\]])/g, '{$1}');
  ps += `(New-Object -ComObject WScript.Shell).SendKeys('${safeText}')`;

  return new Promise((resolve) => {
    exec(ps, { shell: 'powershell.exe' }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// Automated WhatsApp Dispatcher (Direct phone URL or automated contact search + type + send)
ipcMain.handle('send-whatsapp', async (event, payload) => {
  const contactName = String(payload?.contact || '').trim();
  const textMsg = String(payload?.message || '').trim();

  // If phone number is given (digits with optional +)
  const isPhone = /^\+?[0-9]{10,14}$/.test(contactName.replace(/\s+/g, ''));

  if (isPhone) {
    const cleanPhone = contactName.replace(/[^0-9]/g, '');
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textMsg)}`;
    shell.openExternal(url);
    return { success: true, mode: 'direct_url' };
  }

  // Open WhatsApp Web or Desktop App
  shell.openExternal('https://web.whatsapp.com/');

  if (!contactName) {
    return { success: true, mode: 'opened_whatsapp' };
  }

  // Upgraded automated sequence with Clipboard text injection
  const psScript = `
    Start-Sleep -Seconds 3;
    $wshell = New-Object -ComObject WScript.Shell;
    $activated = $wshell.AppActivate('WhatsApp');
    if (-not $activated) {
      $activated = $wshell.AppActivate('Chrome');
    }
    if (-not $activated) {
      $activated = $wshell.AppActivate('Edge');
    }
    if ($activated) {
      Start-Sleep -Milliseconds 600;
      Set-Clipboard -Value @"
${contactName}
"@;
      $wshell.SendKeys('^%(/)');
      Start-Sleep -Milliseconds 400;
      $wshell.SendKeys('^f');
      Start-Sleep -Milliseconds 400;
      $wshell.SendKeys('^v');
      Start-Sleep -Milliseconds 1200;
      $wshell.SendKeys('{ENTER}');
      Start-Sleep -Milliseconds 1000;
      if (@"
${textMsg}
"@) {
        Set-Clipboard -Value @"
${textMsg}
"@;
        $wshell.SendKeys('^v');
        Start-Sleep -Milliseconds 600;
        $wshell.SendKeys('{ENTER}');
      }
    }
  `;

  return new Promise((resolve) => {
    exec(psScript, { shell: 'powershell.exe' }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, mode: 'automated_sequence_clipboard' });
      }
    });
  });
});

// Native URL Router
ipcMain.handle('open-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Desktop Capturer sources
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (err) {
    console.error('Failed to get desktop sources:', err);
    return [];
  }
});

// Full Resolution Desktop Screenshot Saver
ipcMain.handle('take-screenshot', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scale = primaryDisplay.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: width * scale, height: height * scale }
    });

    if (!sources || sources.length === 0) {
      return { success: false, error: 'No screen source available' };
    }

    const primarySource = sources.find(s => 
      s.name.toLowerCase().includes('entire screen') || 
      s.name.toLowerCase().includes('screen 1') ||
      s.id.startsWith('screen:')
    ) || sources[0];

    const imageBuffer = primarySource.thumbnail.toPNG();

    const picturesDir = app.getPath('pictures') || path.join(os.homedir(), 'Pictures');
    if (!fs.existsSync(picturesDir)) {
      fs.mkdirSync(picturesDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `JARVIS_Screenshot_${timestamp}.png`;
    const filePath = path.join(picturesDir, filename);

    fs.writeFileSync(filePath, imageBuffer);

    // Open file in folder
    shell.showItemInFolder(filePath);

    return { 
      success: true, 
      filePath, 
      filename,
      message: `Screenshot saved to ${filePath}` 
    };
  } catch (err) {
    console.error('Take screenshot error:', err);
    return { success: false, error: err.message };
  }
});

// Memory System IPC Handlers
ipcMain.handle('memory-get-all', async () => {
  return memory.getAllMemories();
});

ipcMain.handle('memory-add-pinned', async (event, content, category) => {
  return memory.addPinnedMemory(content, category);
});

ipcMain.handle('memory-add-conversation', async (event, summary) => {
  return memory.addConversationSummary(summary);
});

ipcMain.handle('memory-update-profile', async (event, key, value) => {
  memory.updateUserProfile(key, value);
  return { success: true };
});

ipcMain.handle('memory-delete-pinned', async (event, id) => {
  memory.deletePinnedMemory(id);
  return { success: true };
});

ipcMain.handle('memory-get-path', async () => {
  return memory.getMemoryFilePath();
});

ipcMain.handle('memory-add-learning', async (event, context, lesson, source) => {
  return memory.addLearning(context, lesson, source);
});

// Live Web Search & Scraping IPC Handlers
ipcMain.handle('web-search', async (event, query) => {
  return new Promise((resolve) => {
    try {
      const q = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${q}`;
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      };

      const req = https.get(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const results = [];
            // Parse search result links and snippets using regex
            const regex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
            let match;
            while ((match = regex.exec(body)) !== null && results.length < 5) {
              let link = match[1];
              if (link.startsWith('//')) link = 'https:' + link;
              let snippet = match[2].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
              results.push({ url: link, snippet });
            }

            // Fallback parsing if main regex didn't match enough
            if (results.length === 0) {
              const snippetRegex = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
              let sMatch;
              while ((sMatch = snippetRegex.exec(body)) !== null && results.length < 5) {
                const text = sMatch[1].replace(/<[^>]+>/g, '').trim();
                results.push({ snippet: text });
              }
            }

            resolve({ success: true, query, results, count: results.length });
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ success: false, error: 'Web search request timed out' });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('scrape-webpage', async (event, targetUrl) => {
  return new Promise((resolve) => {
    try {
      let fullUrl = String(targetUrl).trim();
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = `https://${fullUrl}`;
      }

      const client = fullUrl.startsWith('https') ? https : http;
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };

      const req = client.get(fullUrl, options, (res) => {
        // Handle redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http')) {
            const u = new URL(fullUrl);
            redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
          }
          return https.get(redirectUrl, options, (r2) => {
            let data = '';
            r2.on('data', chunk => data += chunk);
            r2.on('end', () => resolve(cleanHtml(data, redirectUrl)));
          }).on('error', e => resolve({ success: false, error: e.message }));
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(cleanHtml(body, fullUrl)));
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'Web scraping request timed out' });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

function cleanHtml(html, url) {
  try {
    let text = html
      .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<svg\b[^<]*>([\s\S]*?)<\/svg>/gi, '')
      .replace(/<header\b[^<]*>([\s\S]*?)<\/header>/gi, '')
      .replace(/<footer\b[^<]*>([\s\S]*?)<\/footer>/gi, '')
      .replace(/<nav\b[^<]*>([\s\S]*?)<\/nav>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Limit output size for model consumption
    if (text.length > 3500) {
      text = text.substring(0, 3500) + '\n\n[Content truncated for length...]';
    }

    return { success: true, url, content: text, length: text.length };
  } catch (e) {
    return { success: false, url, error: e.message };
  }
}
