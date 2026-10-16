'use strict';

const {
  app, BrowserWindow, globalShortcut, ipcMain,
  Tray, Menu, nativeImage, screen,
} = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const Store = require('electron-store');

// Only one instance may run at a time — otherwise every stray background
// copy registers its own tray/shortcut, and pressing the shortcut can pop
// open windows from old, never-quit instances.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  showWindow();
});

// ── Tray icon ─────────────────────────────────────────────────────────────────
function makePngBuffer() {
  // CRC-32 (plain array to avoid Uint32Array.map type-coercion issues)
  const T = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    T[i] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const u32 = (n) => Buffer.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    return Buffer.concat([u32(data.length), td, u32(crc32(td))]);
  };

  // 16×16 RGBA: white filled circle on transparent background
  const N = 16, cx = 7.5, cy = 7.5, r = 6.5;
  const rowBufs = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    row.push(0); // PNG filter: None
    for (let x = 0; x < N; x++) {
      const inside = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) <= r;
      row.push(255, 255, 255, inside ? 255 : 0); // RGBA
    }
    rowBufs.push(Buffer.from(row));
  }

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),            // PNG signature
    chunk('IHDR', Buffer.from([0,0,0,16,0,0,0,16,8,6,0,0,0])), // 16×16 RGBA
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rowBufs))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildTrayIcon() {
  try {
    const png = makePngBuffer();
    // createFromPath is more reliable than createFromBuffer on macOS
    const iconPath = path.join(os.tmpdir(), 'ai-memo-tray.png');
    fs.writeFileSync(iconPath, png);
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      img.setTemplateImage(true); // auto-adapt to dark/light menu bar
      return img;
    }
  } catch (err) {
    console.error('[tray icon] failed to build PNG:', err);
  }
  // Fallback: empty image (tray will still show via setTitle below)
  return nativeImage.createEmpty();
}

const store = new Store({
  defaults: {
    settings: {
      notionApiKey: '',
      notionDatabaseId: '',
      shortcut: 'CommandOrControl+Shift+M',
    },
    snippets: [],
    pendingMemos: [],
  },
});

let mainWindow = null;
let tray = null;
let currentShortcut = '';

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 620,
    show: false,
    titleBarStyle: 'hiddenInset',
    fullscreenable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 360,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Float above full-screen apps, but don't follow across spaces
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(false);

  // Prevent close — hide instead
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray() {
  // Tray creation is best-effort — failure must never block shortcut registration
  try {
    // Try file-based icon first, then dataURL, then empty
    let icon = nativeImage.createEmpty();
    try {
      const png = makePngBuffer();
      // Approach A: save to tmp file and load by path
      const iconPath = path.join(os.tmpdir(), 'ai-memo-tray.png');
      fs.writeFileSync(iconPath, png);
      const fromPath = nativeImage.createFromPath(iconPath);
      if (!fromPath.isEmpty()) {
        fromPath.setTemplateImage(true);
        icon = fromPath;
      } else {
        // Approach B: data URL
        const fromUrl = nativeImage.createFromDataURL(
          'data:image/png;base64,' + png.toString('base64')
        );
        if (!fromUrl.isEmpty()) {
          fromUrl.setTemplateImage(true);
          icon = fromUrl;
        }
      }
    } catch (iconErr) {
      console.error('[tray] icon build failed:', iconErr.message);
    }

    tray = new Tray(icon);
    tray.setTitle('✎');
    tray.setToolTip('AI メモ (Cmd+Shift+M)');
    const menu = Menu.buildFromTemplate([
      { label: 'AI メモを開く', click: showWindow },
      { type: 'separator' },
      { label: '終了', click: () => { mainWindow = null; app.exit(0); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', toggleWindow);
    console.log('[tray] created successfully');
  } catch (err) {
    console.error('[tray] Tray() constructor failed:', err.message);
    tray = null;
  }
}

function getWindowPosition() {
  if (!tray) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { x: Math.round((width - 500) / 2), y: Math.round((height - 620) / 3) };
  }
  const tb = tray.getBounds();
  const wb = mainWindow.getBounds();
  const x = Math.max(0, Math.round(tb.x + tb.width / 2 - wb.width / 2));
  const y = tb.y + tb.height + 4;
  return { x, y };
}

function showWindow() {
  if (!mainWindow) return;
  // Briefly allow all workspaces so it appears on the current space/full-screen,
  // then disable so it stops following when switching spaces
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const { x, y } = getWindowPosition();
  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
  setTimeout(() => {
    if (mainWindow) mainWindow.setVisibleOnAllWorkspaces(false);
  }, 300);
}

function toggleWindow() {
  if (!mainWindow) return;
  // Hide only when visible AND focused on current space.
  // If on another space (not focused), bring to current space instead.
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function registerShortcut(shortcut) {
  if (currentShortcut) {
    try { globalShortcut.unregister(currentShortcut); } catch (_) {}
  }
  try {
    const ok = globalShortcut.register(shortcut, toggleWindow);
    if (ok) currentShortcut = shortcut;
    return ok;
  } catch (_) {
    return false;
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();

  createWindow();    // window created hidden

  createTray();      // best-effort — never throws

  // Shortcut registration runs regardless of tray success
  const { shortcut } = store.get('settings');
  const ok = registerShortcut(shortcut || 'CommandOrControl+Shift+M');
  console.log('[shortcut] registered:', ok, shortcut || 'CommandOrControl+Shift+M');

  // Show window on first launch so it's immediately accessible
  setTimeout(() => showWindow(), 300);
});

// Log unhandled errors instead of silently crashing
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// Prevent quit when windows close (menu bar app)
app.on('window-all-closed', () => {});

// ── IPC: Window ───────────────────────────────────────────────────────────────

ipcMain.handle('hide-window', () => mainWindow?.hide());

// ── IPC: Settings ─────────────────────────────────────────────────────────────

ipcMain.handle('get-settings', () => store.get('settings'));

ipcMain.handle('save-settings', (_, settings) => {
  store.set('settings', settings);
  if (settings.shortcut) registerShortcut(settings.shortcut);
  return { success: true };
});

// ── IPC: Snippets ─────────────────────────────────────────────────────────────

ipcMain.handle('get-snippets', () => store.get('snippets', []));

ipcMain.handle('save-snippet', (_, snippet) => {
  const snippets = store.get('snippets', []);
  if (snippet.id) {
    const i = snippets.findIndex(s => s.id === snippet.id);
    if (i !== -1) snippets[i] = snippet;
    else snippets.push(snippet);
  } else {
    snippet.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    snippet.createdAt = new Date().toISOString();
    snippets.push(snippet);
  }
  store.set('snippets', snippets);
  return snippet;
});

ipcMain.handle('delete-snippet', (_, id) => {
  store.set('snippets', store.get('snippets', []).filter(s => s.id !== id));
  return { success: true };
});

ipcMain.handle('reorder-snippets', (_, ids) => {
  const snippets = store.get('snippets', []);
  const map = Object.fromEntries(snippets.map(s => [s.id, s]));
  const reordered = ids.map(id => map[id]).filter(Boolean);
  store.set('snippets', reordered);
  return { success: true };
});

// ── Notion helpers ────────────────────────────────────────────────────────────

function notionFetch(method, urlPath, body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.notion.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(buf);
          res.statusCode < 400 ? resolve(json) : reject(new Error(json.message || `HTTP ${res.statusCode}`));
        } catch (_) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Notion rich_text has a 2000-char limit per element
function toRichText(text) {
  const chunks = [];
  const str = text || '';
  for (let i = 0; i < str.length; i += 2000) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + 2000) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

function parseTags(tagsStr) {
  return (tagsStr || '').split(/[,、\s]+/).filter(Boolean).map(t => ({ name: t.trim() }));
}

// ── Notion file upload helpers ────────────────────────────────────────────────

function binaryPut(url, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': buffer.length },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode < 400 ? resolve(body) : reject(new Error(`PUT ${res.statusCode}`)));
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function attachImagesToPage(pageId, images, apiKey) {
  const blocks = [];
  let attempted = false;

  for (const img of images) {
    if (!img.path || !fs.existsSync(img.path)) continue;
    attempted = true;
    try {
      const session = await notionFetch('POST', '/v1/files', {
        parent: { type: 'page_id', page_id: pageId },
        name: img.name,
      }, apiKey);
      if (session.upload_url) {
        const buf = fs.readFileSync(img.path);
        await binaryPut(session.upload_url, buf, img.mimeType || 'image/png');
        blocks.push({
          object: 'block', type: 'image',
          image: { type: 'file', file: { url: session.url || session.upload_url } },
        });
      }
    } catch (err) {
      console.error('[notion img]', img.name, err.message);
    }
  }

  // Fallback: if uploads all failed, add a text note with filenames
  if (blocks.length === 0 && attempted) {
    blocks.push({
      object: 'block', type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: {
        content: `[添付画像: ${images.map(i => i.name).join(', ')}]`,
      }}]},
    });
  }

  if (blocks.length > 0) {
    await notionFetch('PATCH', `/v1/blocks/${pageId}/children`, { children: blocks }, apiKey);
  }
}

// ── IPC: Notion save ──────────────────────────────────────────────────────────

ipcMain.handle('save-memo', async (_, memo) => {
  const { notionApiKey, notionDatabaseId } = store.get('settings');
  if (!notionApiKey || !notionDatabaseId) {
    return { success: false, error: 'Notion APIキーとデータベースIDを設定してください' };
  }

  const body = {
    parent: { database_id: notionDatabaseId },
    properties: {
      'タイトル': { title: [{ text: { content: (memo.title || '無題').slice(0, 2000) } }] },
      '本文': { rich_text: toRichText(memo.body) },
      'タグ': { multi_select: parseTags(memo.tags) },
      'ソース': { select: { name: memo.source || '自分のメモ' } },
      '作成日時': { date: { start: new Date().toISOString() } },
    },
  };

  try {
    const result = await notionFetch('POST', '/v1/pages', body, notionApiKey);
    if (memo.images && memo.images.length > 0) {
      attachImagesToPage(result.id, memo.images, notionApiKey)
        .catch(err => console.error('[attachImages]', err.message));
    }
    return { success: true, id: result.id };
  } catch (error) {
    // Save locally as pending
    const pending = store.get('pendingMemos', []);
    pending.push({ ...memo, queuedAt: new Date().toISOString() });
    store.set('pendingMemos', pending);
    return { success: false, error: error.message, savedLocally: true };
  }
});

// ── IPC: Notion query ─────────────────────────────────────────────────────────

ipcMain.handle('get-memos', async (_, searchQuery) => {
  const { notionApiKey, notionDatabaseId } = store.get('settings');
  if (!notionApiKey || !notionDatabaseId) {
    return { success: false, error: 'Notion APIキーとデータベースIDを設定してください', memos: [] };
  }

  const reqBody = {
    sorts: [{ property: '作成日時', direction: 'descending' }],
    page_size: 100,
  };

  if (searchQuery && searchQuery.trim()) {
    reqBody.filter = {
      or: [
        { property: 'タイトル', title: { contains: searchQuery } },
        { property: '本文', rich_text: { contains: searchQuery } },
        { property: 'タグ', multi_select: { contains: searchQuery } },
      ],
    };
  }

  try {
    const result = await notionFetch(
      'POST',
      `/v1/databases/${notionDatabaseId}/query`,
      reqBody,
      notionApiKey
    );

    const memos = result.results.map(p => ({
      id: p.id,
      title: p.properties['タイトル']?.title?.[0]?.text?.content || '無題',
      body: (p.properties['本文']?.rich_text || []).map(r => r.text?.content).join(''),
      tags: (p.properties['タグ']?.multi_select || []).map(t => t.name).join(', '),
      source: p.properties['ソース']?.select?.name || '',
      createdAt: p.properties['作成日時']?.date?.start || p.created_time,
    }));

    return { success: true, memos };
  } catch (error) {
    return { success: false, error: error.message, memos: [] };
  }
});

// ── IPC: Pending retry ────────────────────────────────────────────────────────

ipcMain.handle('get-pending-count', () => store.get('pendingMemos', []).length);

ipcMain.handle('retry-pending', async () => {
  const { notionApiKey, notionDatabaseId } = store.get('settings');
  if (!notionApiKey || !notionDatabaseId) {
    return { success: false, error: 'Notion設定が未完了です' };
  }

  const pending = store.get('pendingMemos', []);
  if (!pending.length) return { success: true, retried: 0, remaining: 0 };

  const failed = [];
  let retried = 0;

  for (const memo of pending) {
    try {
      await notionFetch('POST', '/v1/pages', {
        parent: { database_id: notionDatabaseId },
        properties: {
          'タイトル': { title: [{ text: { content: (memo.title || '無題').slice(0, 2000) } }] },
          '本文': { rich_text: toRichText(memo.body) },
          'タグ': { multi_select: parseTags(memo.tags) },
          'ソース': { select: { name: memo.source || '自分のメモ' } },
          '作成日時': { date: { start: memo.queuedAt || new Date().toISOString() } },
        },
      }, notionApiKey);
      retried++;
    } catch (_) {
      failed.push(memo);
    }
  }

  store.set('pendingMemos', failed);
  return { success: true, retried, remaining: failed.length };
});
