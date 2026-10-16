'use strict';

const api = window.electronAPI;

// ── Security helper ───────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60_000) return 'たった今';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}日前`;
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Message helper ────────────────────────────────────────────────────────────
function showMsg(id, text, type = '') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `msg${type ? ' ' + type : ''}`;
  if (text) setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(text, type = 'success') {
  const el = document.createElement('div');
  const bg = type === 'success' ? 'var(--success)' : 'var(--error)';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
    background: bg, color: type === 'success' ? '#000' : '#fff',
    padding: '5px 14px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600',
    zIndex: '2000', pointerEvents: 'none',
    opacity: '1', transition: 'opacity 400ms',
  });
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 1800);
}

// ── Tab switching ─────────────────────────────────────────────────────────────
let activeTab = 'memo';

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    if (target === activeTab) return;
    activeTab = target;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
    if (target === 'history')  loadHistory('');
    if (target === 'snippets') loadSnippets();
    if (target === 'settings') loadSettings();
  });
});

document.getElementById('btnClose').addEventListener('click', () => api.hideWindow());

// ── Memo tab ──────────────────────────────────────────────────────────────────
const btnSaveMemo = document.getElementById('btnSaveMemo');

btnSaveMemo.addEventListener('click', async () => {
  const title  = document.getElementById('memoTitle').value.trim();
  const body   = document.getElementById('memoBody').value.trim();
  const tags   = document.getElementById('memoTags').value.trim();
  const source = document.getElementById('memoSource').value;

  if (!title && !body) {
    showMsg('memoMsg', 'タイトルまたは本文を入力してください', 'error');
    return;
  }

  btnSaveMemo.disabled = true;
  btnSaveMemo.textContent = '保存中…';

  try {
    const res = await api.saveMemo({
      title, body, tags, source,
      images: attachedImages.map(i => ({ path: i.path, name: i.name, mimeType: i.mimeType })),
    });
    if (res.success) {
      toast('Notion に保存しました');
      document.getElementById('memoTitle').value  = '';
      document.getElementById('memoBody').value   = '';
      document.getElementById('memoTags').value   = '';
      document.getElementById('memoSource').value = '自分のメモ';
      clearImages();
      showMsg('memoMsg', '');
    } else if (res.savedLocally) {
      showMsg('memoMsg', `⚠ 送信失敗、ローカルに保存: ${res.error}`, 'warning');
    } else {
      showMsg('memoMsg', res.error, 'error');
    }
  } catch (e) {
    showMsg('memoMsg', `エラー: ${e.message}`, 'error');
  } finally {
    btnSaveMemo.disabled = false;
    btnSaveMemo.textContent = 'Notion に保存';
  }
});

document.getElementById('memoTitle').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); document.getElementById('memoBody').focus(); }
});

// Cmd/Ctrl+Enter anywhere in memo panel saves
document.getElementById('panel-memo').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') btnSaveMemo.click();
});

// ── Image attachments ─────────────────────────────────────────────────────────
let attachedImages = []; // { objectUrl, path, name, mimeType }

const imageArea       = document.getElementById('imageArea');
const imageThumbnails = document.getElementById('imageThumbnails');
const imageDropHint   = document.querySelector('.image-drop-hint');

function renderThumbnails() {
  if (!attachedImages.length) {
    imageThumbnails.innerHTML = '';
    imageDropHint.style.display = '';
    return;
  }
  imageDropHint.style.display = 'none';
  imageThumbnails.innerHTML = attachedImages.map((img, i) => `
    <div class="img-thumb">
      <img src="${img.objectUrl}" alt="${esc(img.name)}" draggable="false">
      <button class="img-thumb-remove" data-idx="${i}" title="削除">✕</button>
    </div>
  `).join('');
}

imageThumbnails.addEventListener('click', e => {
  const btn = e.target.closest('.img-thumb-remove');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  URL.revokeObjectURL(attachedImages[idx].objectUrl);
  attachedImages.splice(idx, 1);
  renderThumbnails();
});

const panelMemo = document.getElementById('panel-memo');

panelMemo.addEventListener('dragover', e => {
  const hasImage = [...(e.dataTransfer.items || [])].some(i => i.type.startsWith('image/'));
  if (!hasImage) return;
  e.preventDefault();
  imageArea.classList.add('drag-over');
});

panelMemo.addEventListener('dragleave', e => {
  if (!panelMemo.contains(e.relatedTarget)) imageArea.classList.remove('drag-over');
});

panelMemo.addEventListener('drop', e => {
  e.preventDefault();
  imageArea.classList.remove('drag-over');
  const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  for (const file of files) {
    if (attachedImages.length >= 5) { toast('画像は最大5枚までです', 'error'); break; }
    if (attachedImages.some(a => a.path === file.path)) continue;
    attachedImages.push({
      objectUrl: URL.createObjectURL(file),
      path: file.path,
      name: file.name,
      mimeType: file.type,
    });
  }
  renderThumbnails();
});

function clearImages() {
  attachedImages.forEach(img => URL.revokeObjectURL(img.objectUrl));
  attachedImages = [];
  renderThumbnails();
}

// ── History tab ───────────────────────────────────────────────────────────────
function sourceCls(source) {
  if (source === 'Claude') return 'src-Claude';
  if (source === 'Gemini') return 'src-Gemini';
  return 'src-self';
}

async function loadHistory(query) {
  const listEl = document.getElementById('historyList');
  listEl.innerHTML = '<p class="hint">読み込み中…</p>';
  try {
    const res = await api.getMemos(query);
    if (!res.success) {
      listEl.innerHTML = `<p class="hint" style="color:var(--error)">${esc(res.error)}</p>`;
      return;
    }
    if (!res.memos.length) {
      listEl.innerHTML = '<p class="hint">メモが見つかりません</p>';
      return;
    }
    listEl.innerHTML = res.memos.map(m => `
      <div class="memo-card">
        <div class="memo-card-header">
          <span class="memo-card-title">${esc(m.title)}</span>
          <span class="memo-card-source ${sourceCls(m.source)}">${esc(m.source)}</span>
        </div>
        ${m.body ? `<div class="memo-card-body">${esc(m.body)}</div>` : ''}
        <div class="memo-card-footer">
          <div class="memo-card-tags">
            ${m.tags ? m.tags.split(',').map(t => `<span class="tag-chip">${esc(t.trim())}</span>`).join('') : ''}
          </div>
          <span class="memo-card-date">${fmtDate(m.createdAt)}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    listEl.innerHTML = `<p class="hint" style="color:var(--error)">${esc(e.message)}</p>`;
  }
}

document.getElementById('btnSearch').addEventListener('click', () => {
  loadHistory(document.getElementById('historySearch').value);
});
document.getElementById('historySearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadHistory(e.target.value);
});

// ── Snippets tab ──────────────────────────────────────────────────────────────
let editingId = null;

async function loadSnippets() {
  const snippets = await api.getSnippets();
  const listEl = document.getElementById('snippetList');
  if (!snippets.length) {
    listEl.innerHTML = '<p class="hint">スニペットがありません<br>「＋ 新規」で追加</p>';
    return;
  }
  listEl.innerHTML = snippets.map(s => `
    <div class="snippet-item" draggable="true" data-id="${esc(s.id)}">
      <span class="drag-handle" title="ドラッグして並び替え">⠿</span>
      <span class="snippet-name">${esc(s.name)}</span>
      <div class="snippet-actions">
        <button class="btn btn-secondary btn-sm" data-action="copy"   data-id="${esc(s.id)}">コピー</button>
        <button class="btn btn-ghost    btn-sm" data-action="edit"   data-id="${esc(s.id)}">編集</button>
        <button class="btn btn-danger   btn-sm" data-action="delete" data-id="${esc(s.id)}">削除</button>
      </div>
    </div>
  `).join('');
  initSnippetDnD(listEl);
}

function initSnippetDnD(listEl) {
  let dragSrc = null;

  listEl.querySelectorAll('.snippet-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      listEl.querySelectorAll('.snippet-item').forEach(i => i.classList.remove('drag-over'));
      dragSrc = null;
    });
    item.addEventListener('dragover', e => {
      if (!dragSrc || dragSrc === item) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      listEl.querySelectorAll('.snippet-item').forEach(i => i.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      item.classList.remove('drag-over');
      const items = [...listEl.querySelectorAll('.snippet-item')];
      const fromIdx = items.indexOf(dragSrc);
      const toIdx   = items.indexOf(item);
      if (fromIdx === toIdx) return;
      if (fromIdx < toIdx) item.after(dragSrc); else item.before(dragSrc);
      const ids = [...listEl.querySelectorAll('.snippet-item')].map(i => i.dataset.id);
      await api.reorderSnippets(ids);
    });
  });
}

document.getElementById('snippetList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const snippets = await api.getSnippets();
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  if (action === 'copy') {
    openFillDialog(snippet);
  } else if (action === 'edit') {
    openEditor(snippet);
  } else if (action === 'delete') {
    if (window.confirm(`「${snippet.name}」を削除しますか？`)) {
      await api.deleteSnippet(id);
      loadSnippets();
    }
  }
});

document.getElementById('btnNewSnippet').addEventListener('click', () => openEditor(null));

function openEditor(snippet) {
  editingId = snippet?.id ?? null;
  document.getElementById('snippetName').value = snippet?.name ?? '';
  document.getElementById('snippetBody').value = snippet?.body ?? '';
  document.getElementById('snippetEditor').classList.remove('hidden');
  document.getElementById('snippetName').focus();
}

document.getElementById('btnCancelSnippet').addEventListener('click', () => {
  document.getElementById('snippetEditor').classList.add('hidden');
  editingId = null;
});

document.getElementById('btnSaveSnippet').addEventListener('click', async () => {
  const name = document.getElementById('snippetName').value.trim();
  const body = document.getElementById('snippetBody').value;
  if (!name) { toast('スニペット名を入力してください', 'error'); return; }

  await api.saveSnippet({ id: editingId, name, body });
  document.getElementById('snippetEditor').classList.add('hidden');
  editingId = null;
  loadSnippets();
  toast('スニペットを保存しました');
});

// ── Fill dialog ───────────────────────────────────────────────────────────────
let activeSnippet = null;

function openFillDialog(snippet) {
  activeSnippet = snippet;
  const vars = [...new Set(
    (snippet.body.match(/\{\{([^}]+)\}\}/g) || []).map(m => m.slice(2, -2).trim())
  )];

  if (!vars.length) {
    navigator.clipboard.writeText(snippet.body);
    toast('コピーしました');
    return;
  }

  document.getElementById('fillTitle').textContent = `「${snippet.name}」の変数を入力`;
  document.getElementById('fillFields').innerHTML = vars.map(v => `
    <div class="field" style="margin-bottom:8px">
      <label>${esc(v)}</label>
      <input type="text" class="input fill-var" data-var="${esc(v)}" placeholder="${esc(v)}">
    </div>
  `).join('');

  document.getElementById('fillOverlay').classList.remove('hidden');
  document.querySelector('.fill-var')?.focus();
}

document.getElementById('btnFillCopy').addEventListener('click', () => {
  if (!activeSnippet) return;
  let text = activeSnippet.body;
  document.querySelectorAll('.fill-var').forEach(inp => {
    // Replace all occurrences of this variable
    text = text.split(`{{${inp.dataset.var}}}`).join(inp.value);
  });
  navigator.clipboard.writeText(text);
  document.getElementById('fillOverlay').classList.add('hidden');
  activeSnippet = null;
  toast('コピーしました');
});

document.getElementById('btnFillCancel').addEventListener('click', () => {
  document.getElementById('fillOverlay').classList.add('hidden');
  activeSnippet = null;
});

document.getElementById('fillOverlay').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('fillOverlay').classList.add('hidden');
    activeSnippet = null;
  } else if (e.key === 'Enter' && !e.shiftKey) {
    // Don't trigger from textarea — but fill-var inputs are single-line
    if (e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      document.getElementById('btnFillCopy').click();
    }
  }
});

// ── Settings tab ──────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await api.getSettings();
  document.getElementById('cfgApiKey').value   = s.notionApiKey      ?? '';
  document.getElementById('cfgDbId').value     = s.notionDatabaseId  ?? '';
  document.getElementById('cfgShortcut').value = s.shortcut          ?? 'CommandOrControl+Shift+M';

  const count = await api.getPendingCount();
  document.getElementById('pendingInfo').textContent =
    count > 0 ? `${count} 件のメモが保留中` : '保留中のメモはありません';
}

document.getElementById('btnSaveSettings').addEventListener('click', async () => {
  const settings = {
    notionApiKey:      document.getElementById('cfgApiKey').value.trim(),
    notionDatabaseId:  document.getElementById('cfgDbId').value.trim(),
    shortcut:          document.getElementById('cfgShortcut').value.trim()
                       || 'CommandOrControl+Shift+M',
  };
  const res = await api.saveSettings(settings);
  showMsg('settingsMsg', res.success ? '設定を保存しました' : '保存に失敗しました',
          res.success ? 'success' : 'error');
});

document.getElementById('btnRetry').addEventListener('click', async () => {
  const res = await api.retryPending();
  if (res.success) {
    const msg = res.retried > 0
      ? `${res.retried} 件を送信しました。残り ${res.remaining} 件`
      : '送信するメモがありません';
    showMsg('retryMsg', msg, res.remaining === 0 ? 'success' : 'warning');
    document.getElementById('pendingInfo').textContent =
      res.remaining > 0 ? `${res.remaining} 件のメモが保留中` : '保留中のメモはありません';
  } else {
    showMsg('retryMsg', res.error, 'error');
  }
});

// ── Global keyboard shortcuts ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('fillOverlay').classList.contains('hidden')) {
    return; // handled by overlay listener
  }
  if (e.key === 'Escape') api.hideWindow();
});
