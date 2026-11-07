/* Sardin Quest - WebRTC phone controller (PeerJS public cloud). */
const $ = (sel) => document.querySelector(sel);

const els = {
  lobbyView: $('#lobbyView'),
  gameView: $('#gameView'),
  lobbyStatus: $('#lobbyStatus'),
  lobbyStatusText: $('#lobbyStatusText'),
  lobbyPlayer: $('#lobbyPlayer'),
  lobbyName: $('#lobbyName'),
  lobbyHint: $('#lobbyHint'),
  lobbyRoomCode: $('#lobbyRoomCode'),
  lobbySlot: $('#lobbySlot'),
  enterBtn: $('#enterBtn'),

  pauseBtn: $('#pauseBtn'),
  pauseLabel: $('#pauseLabel'),
  exitBtn: $('#exitBtn'),
  fullscreenBtn: $('#fullscreenBtn'),
  gameDot: $('#gameDot'),
  headerSlot: $('#headerSlot'),
  headerRoom: $('#headerRoom'),
  gamePlayerLabel: $('#gamePlayerLabel'),
  gamePlayerName: $('#gamePlayerName'),
  meowBtn: $('#meowBtn'),
  jumpBtn: $('#jumpBtn'),

  overlay: $('#overlay'),
  overlayTitle: $('#overlayTitle'),
  overlayText: $('#overlayText'),
  spinner: $('#spinner'),
  retryBtn: $('#retryBtn'),
  toast: $('#toast')
};

const COLORS = {
  1: { fur: '#f59e42', inner: '#ffd0a8', belly: '#ffe7cf', blush: '#ff8f8f' },
  2: { fur: '#a8b3c4', inner: '#dbe3ee', belly: '#edf2f8', blush: '#f0a8b8' },
  3: { fur: '#f1f5f9', inner: '#e2e8f0', belly: '#ffffff', blush: '#fb7185' },
  4: { fur: '#334155', inner: '#475569', belly: '#64748b', blush: '#c084fc' }
};

function makeToken() {
  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function loadToken(fresh = false) {
  const key = 'sardin-controller-token';
  let token = null;
  try {
    token = localStorage.getItem(key);
  } catch { /* private mode */ }
  if (!token || fresh) {
    token = makeToken();
    try { localStorage.setItem(key, token); } catch { /* ignore */ }
  }
  return token;
}

const params = new URLSearchParams(location.search);
const roomParam = params.get('room') || '';
const roomId = /^[A-Za-z0-9_-]{3,64}$/.test(roomParam) ? roomParam : '';

let token = loadToken();
let peer = null;
let conn = null;
let connected = false;
let welcomeReceived = false;
let slot = 0;
let presence = null;
let paused = false;
let inGame = false;
let reconnectAttempt = 0;
let reconnectTimer = null;
let joinTimer = null;
let peerOpenTimer = null;
let firstConnect = true;
let duplicateTab = false;
let channel = null;
const tabId = Math.random().toString(36).slice(2);

const input = { left: false, right: false, jump: false };
const held = new Map();
window.__controllerState = input;

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */

function setStatus(text, mode = 'waiting') {
  if (els.lobbyStatusText) els.lobbyStatusText.textContent = text;
  if (els.lobbyStatus) els.lobbyStatus.className = `status ${mode}`;
  if (els.gameDot) els.gameDot.className = `dot ${mode}`;
}

function setRoomCodes() {
  const code = roomId || '—';
  if (els.lobbyRoomCode) els.lobbyRoomCode.textContent = code;
  if (els.headerRoom) els.headerRoom.textContent = `ROOM ${code}`;
}

function setSlot(slotId, name, color) {
  slot = slotId;
  document.querySelector('#app')?.setAttribute('data-slot', String(slotId || 0));
  const label = slotId ? `PLAYER ${slotId}` : 'PENONTON';
  if (els.lobbyPlayer) els.lobbyPlayer.textContent = slotId ? `PLAYER ${slotId}` : 'PENONTON';
  if (els.lobbyName) els.lobbyName.textContent = name || 'Menunggu slot...';
  if (els.lobbySlot) els.lobbySlot.textContent = slotId ? `P${slotId}` : 'PENONTON';
  if (els.gamePlayerLabel) els.gamePlayerLabel.textContent = label;
  if (els.gamePlayerName) els.gamePlayerName.textContent = name || '—';
  if (els.headerSlot) els.headerSlot.textContent = slotId ? `P${slotId}` : 'PENONTON';
  if (els.enterBtn) els.enterBtn.disabled = !slotId;

  if (slotId && COLORS[slotId]) {
    const c = COLORS[slotId];
    const root = document.documentElement.style;
    root.setProperty('--fur', c.fur);
    root.setProperty('--inner', c.inner);
    root.setProperty('--belly', c.belly);
    root.setProperty('--blush', c.blush);
  }
  if (slotId) {
    if (els.lobbyHint) els.lobbyHint.textContent = `Kamu akan mengendalikan ${name}. Tekan tombol masuk jika sudah siap.`;
  } else if (els.lobbyHint) {
    els.lobbyHint.textContent = 'Dua pemain sudah terhubung. Kamu masuk sebagai penonton.';
  }
}

function showOverlay(title, text, { retry = false, spin = false } = {}) {
  if (!els.overlay) return;
  els.overlay.classList.remove('hidden');
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.retryBtn.hidden = !retry;
  els.spinner.classList.toggle('hidden', !spin);
}

function hideOverlay() {
  els.overlay?.classList.add('hidden');
}

function showToast(text, ms = 2300) {
  if (!els.toast) return;
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function showLobby(message) {
  if (!els.lobbyView) return;
  els.gameView?.classList.add('is-hidden');
  els.lobbyView.classList.remove('is-hidden');
  inGame = false;
  releaseAll();
  if (message && els.lobbyHint) els.lobbyHint.textContent = message;
  if (slot) setStatus(`P${slot} terhubung ke layar utama`, 'ok');
  hideOverlay();
  setTimeout(() => els.enterBtn?.focus({ preventScroll: true }), 80);
}

function showGame() {
  if (!slot) return;
  els.lobbyView?.classList.add('is-hidden');
  els.gameView?.classList.remove('is-hidden');
  inGame = true;
  hideOverlay();
  setPaused(paused);
  send({ type: 'input', ...input, seq: Date.now() % 100000 });
  engageDevice();
}

function setPaused(value) {
  paused = Boolean(value);
  if (els.pauseLabel) els.pauseLabel.textContent = paused ? 'LANJUT' : 'PAUSE';
  if (els.pauseBtn) els.pauseBtn.classList.toggle('paused', paused);
}

function updatePresenceText() {
  if (!presence || !slot) return;
  const p1 = presence.players?.find((p) => p.slot === 1);
  const p2 = presence.players?.find((p) => p.slot === 2);
  const left = slot === 1 ? p2 : p1;
  if (!left) return;
  if (left.connected) setStatus(`P${slot} & P${left.slot} siap`, 'ok');
  else if (left.pending) setStatus(`P${slot} siap · P${left.slot} ulang`, 'waiting');
  else setStatus(`P${slot} siap · tunggu P${left.slot}`, 'ok');
}

/* ------------------------------------------------------------------ */
/* PeerJS / WebRTC                                                     */
/* ------------------------------------------------------------------ */

function peerOptions() {
  const config = window.SARDIN_CONFIG?.peer;
  const defaultConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
  return {
    debug: 1,
    config: defaultConfig,
    ...(config && typeof config === 'object' ? config : {})
  };
}

function send(message) {
  if (!conn || !conn.open) return false;
  try {
    conn.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

function parseData(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw && typeof raw === 'object' ? raw : null;
}

function startPeer() {
  if (duplicateTab) return;
  if (!roomId) {
    setStatus('Room tidak ditemukan', 'bad');
    showOverlay('Room tidak ditemukan', 'Scan QR dari layar utama, lalu buka halaman kontroler yang muncul.', { retry: false });
    return;
  }
  if (typeof window.Peer !== 'function') {
    setStatus('PeerJS gagal dimuat', 'bad');
    showOverlay('Gagal memuat PeerJS', 'Periksa koneksi internet, lalu muat ulang halaman ini.', { retry: true });
    return;
  }

  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  if (peer && !peer.destroyed) {
    if (peer.disconnected) {
      try { peer.reconnect(); } catch { /* ignore */ }
    }
    if (peer.open) connectToRoom();
    else {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (peer && !peer.open && !peer.destroyed) scheduleReconnect('peer-wait');
      }, 2500);
    }
    return;
  }

  setStatus(firstConnect ? 'Membuka koneksi WebRTC...' : 'Menyambung ulang...', 'waiting');
  if (!firstConnect) showOverlay('Menyambung ulang', 'Menghubungkan kembali ke layar utama...', { spin: true });

  let newPeer;
  try {
    newPeer = new window.Peer(undefined, peerOptions());
  } catch (error) {
    setStatus('WebRTC error', 'bad');
    showOverlay('WebRTC tidak tersedia', String(error.message || error), { retry: true });
    return;
  }
  peer = newPeer;

  clearTimeout(peerOpenTimer);
  peerOpenTimer = setTimeout(() => {
    if (peer !== newPeer || newPeer.open) return;
    setStatus('Broker PeerJS tidak merespons', 'bad');
    showOverlay(
      'Broker PeerJS tidak merespons',
      'Matikan VPN/Cloudflare WARP atau coba browser lain, lalu tekan Coba lagi.',
      { retry: true, spin: false }
    );
  }, 10000);

  peer.on('open', () => {
    if (peer !== newPeer) return;
    clearTimeout(peerOpenTimer);
    peerOpenTimer = null;
    connectToRoom();
  });

  peer.on('error', (error) => handlePeerError(error, newPeer));

  peer.on('disconnected', () => {
    if (peer !== newPeer) return;
    setStatus('Broker WebRTC terputus...', 'bad');
    showOverlay('Broker WebRTC terputus', 'Mencoba menyambung ulang ke PeerJS cloud...', { spin: true });
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (peer !== newPeer || newPeer.destroyed) return;
      try { newPeer.reconnect(); } catch { /* ignore */ }
      if (newPeer.open) connectToRoom();
      else scheduleReconnect('peer-disconnected');
    }, 1200);
  });

  peer.on('close', () => {
    if (peer !== newPeer) return;
    clearTimeout(peerOpenTimer);
    peerOpenTimer = null;
    peer = null;
    connected = false;
    welcomeReceived = false;
    scheduleReconnect('peer-close');
  });
}

function connectToRoom() {
  if (duplicateTab || !roomId) return;
  if (!peer || !peer.open) {
    startPeer();
    return;
  }
  if (conn && conn.open) return;

  if (conn) {
    try { conn.close(); } catch { /* ignore */ }
    conn = null;
  }

  setStatus('Menghubungkan ke room...', 'waiting');

  let connection;
  try {
    connection = peer.connect(roomId, {
      reliable: true,
      metadata: { token }
    });
  } catch {
    setStatus('Gagal terhubung', 'bad');
    scheduleReconnect('connect-throw');
    return;
  }
  conn = connection;
  connected = false;
  welcomeReceived = false;

  connection.on('open', () => {
    if (conn !== connection) return;
    connected = true;
    send({ type: 'join', token });
    setStatus('Menunggu slot...', 'waiting');
    clearTimeout(joinTimer);
    joinTimer = setTimeout(() => {
      if (conn !== connection || welcomeReceived) return;
      try { connection.close(); } catch { /* ignore */ }
      showOverlay(
        'Koneksi membutuhkan waktu lebih lama',
        'Pastikan HP dan Desktop PC berada di jaringan Wi-Fi yang sama. Jika Desktop PC diakses via localhost, buka via IP LAN PC.',
        { retry: true, spin: true }
      );
      scheduleReconnect('join-timeout');
    }, 6000);
  });

  connection.on('data', (raw) => {
    if (conn !== connection) return;
    handleData(raw);
  });

  connection.on('close', () => {
    if (conn !== connection) return;
    conn = null;
    connected = false;
    welcomeReceived = false;
    clearTimeout(joinTimer);
    setStatus('Koneksi terputus', 'bad');
    if (!firstConnect) {
      showOverlay('Koneksi terputus', 'Menyambung ulang ke layar utama...', { spin: true });
    }
    scheduleReconnect('conn-close');
  });

  connection.on('error', () => {
    /* PeerJS emits close afterwards */
  });
}

function handleData(raw) {
  const msg = parseData(raw);
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'welcome') {
    welcomeReceived = true;
    connected = true;
    clearTimeout(joinTimer);
    reconnectAttempt = 0;

    if (msg.spectator) {
      setSlot(0, '', '');
      setStatus('Penonton', 'bad');
      showOverlay(
        'Dua slot sudah penuh',
        'P1 dan P2 sudah terhubung. Tutup salah satu tab atau minta pemain lain keluar, lalu tekan Coba lagi.',
        { retry: true }
      );
      return;
    }

    setSlot(msg.slot, msg.name, msg.color);
    setRoomCodes();
    token = msg.token || token;
    try { localStorage.setItem('sardin-controller-token', token); } catch { /* ignore */ }
    firstConnect = false;
    setStatus(`P${msg.slot} terhubung`, 'ok');
    if (presence) updatePresenceText();
    if (inGame) {
      hideOverlay();
      setPaused(paused);
    } else {
      showLobby();
    }
    if (navigator.vibrate) navigator.vibrate(30);
    send({ type: 'input', ...input, seq: Date.now() % 100000 });
    return;
  }

  if (msg.type === 'presence') {
    presence = msg;
    if (slot) updatePresenceText();
    return;
  }

  if (msg.type === 'game-state') {
    setPaused(msg.paused);
    if (msg.phase === 'won') {
      if (els.pauseBtn) els.pauseBtn.disabled = true;
      if (els.pauseLabel) els.pauseLabel.textContent = 'SELESAI';
      showToast('Game selesai!');
    } else if (els.pauseBtn) {
      els.pauseBtn.disabled = false;
    }
    return;
  }

  if (msg.type === 'pong') {
    connected = true;
  }
}

function handlePeerError(error, sourcePeer) {
  if (peer !== sourcePeer) return;
  const type = error?.type || 'error';
  const message = error?.message || String(error);
  clearTimeout(peerOpenTimer);
  peerOpenTimer = null;

  if (type === 'peer-unavailable') {
    setStatus('Room tidak ditemukan', 'bad');
    showOverlay(
      'Room tidak ditemukan',
      `Room ${roomId} belum tersedia. Pastikan layar utama masih terbuka dan QR belum kedaluwarsa.`,
      { retry: true }
    );
    scheduleReconnect('room-unavailable');
    return;
  }

  if (type === 'browser-incompatible') {
    setStatus('Browser tidak mendukung', 'bad');
    showOverlay('Browser tidak mendukung WebRTC', 'Coba Chrome, Edge, atau Safari terbaru.', { retry: false });
    return;
  }

  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed' || type === 'ssl-unavailable') {
    setStatus('Broker WebRTC terputus', 'bad');
    showOverlay('Broker WebRTC terputus', 'Mencoba menyambung ulang...', { spin: true });
    scheduleReconnect(`peer-${type}`);
    return;
  }

  if (type === 'unavailable-id') {
    try { sourcePeer.destroy(); } catch { /* ignore */ }
    peer = null;
    scheduleReconnect('peer-id');
    return;
  }

  if (type === 'webrtc') {
    setStatus('Negosiasi WebRTC gagal', 'bad');
    showOverlay('Gagal membuat koneksi P2P', 'Jaringan mungkin memblokir WebRTC. Coba Wi-Fi lain atau matikan VPN.', { retry: true });
    scheduleReconnect('webrtc');
    return;
  }

  setStatus('WebRTC error', 'bad');
  showOverlay('Koneksi WebRTC gagal', `${type}: ${message}`, { retry: true });
  scheduleReconnect('peer-error');
}

function scheduleReconnect(reason) {
  if (duplicateTab || !roomId) return;
  clearTimeout(reconnectTimer);
  reconnectAttempt += 1;
  const delay = Math.min(6500, 800 * Math.pow(1.7, Math.min(reconnectAttempt, 5)));
  reconnectTimer = setTimeout(() => {
    if (duplicateTab) return;
    if (peer && peer.open) connectToRoom();
    else startPeer();
  }, delay);
  void reason;
}

function releaseAll() {
  held.clear();
  for (const btn of document.querySelectorAll('.key, .jump')) btn.classList.remove('active');
  input.left = input.right = input.jump = false;
  send({ type: 'input', left: false, right: false, jump: false, seq: Date.now() % 100000 });
}

/* ------------------------------------------------------------------ */
/* Touch controls                                                      */
/* ------------------------------------------------------------------ */

function setInput(name, value) {
  if (input[name] === value) return;
  input[name] = value;
  send({ type: 'input', left: input.left, right: input.right, jump: input.jump, seq: Date.now() % 100000 });
}

function pressKey(button, direction, pointerId) {
  held.set(pointerId, direction);
  button.classList.add('active');
  setInput(direction, true);
}

function releaseKey(direction, pointerId) {
  held.delete(pointerId);
  const stillHeld = [...held.values()].includes(direction);
  if (!stillHeld) {
    const btn = document.querySelector(`.key[data-dir="${direction}"]`);
    btn?.classList.remove('active');
    setInput(direction, false);
  }
}

for (const button of document.querySelectorAll('.key')) {
  const dir = button.dataset.dir;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    pressKey(button, dir, event.pointerId);
    engageDevice();
    if (navigator.vibrate) navigator.vibrate(6);
  });
  const end = (event) => {
    event.preventDefault();
    releaseKey(dir, event.pointerId);
  };
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('lostpointercapture', end);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

els.jumpBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  els.jumpBtn.setPointerCapture?.(event.pointerId);
  els.jumpBtn.classList.add('active');
  setInput('jump', true);
  send({ type: 'jump' });
  engageDevice();
  if (navigator.vibrate) navigator.vibrate(12);
});
const jumpEnd = (event) => {
  event.preventDefault();
  els.jumpBtn.classList.remove('active');
  setInput('jump', false);
};
els.jumpBtn.addEventListener('pointerup', jumpEnd);
els.jumpBtn.addEventListener('pointercancel', jumpEnd);
els.jumpBtn.addEventListener('lostpointercapture', jumpEnd);
els.jumpBtn.addEventListener('contextmenu', (e) => e.preventDefault());

els.meowBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  send({ type: 'meow' });
  els.meowBtn.style.transform = 'scale(0.9)';
  setTimeout(() => { els.meowBtn.style.transform = ''; }, 120);
  if (navigator.vibrate) navigator.vibrate([8, 24, 8]);
});

els.pauseBtn?.addEventListener('click', () => {
  send({ type: 'pause' });
  if (navigator.vibrate) navigator.vibrate(12);
});
els.exitBtn?.addEventListener('click', () => {
  showLobby('Kamu keluar ke lobby. Tekan MASUK GAME untuk kembali.');
});
els.enterBtn?.addEventListener('click', () => showGame());

/* ------------------------------------------------------------------ */
/* Fullscreen & orientation                                            */
/* ------------------------------------------------------------------ */

const docEl = document.documentElement;
let toastTimer = null;
let fullscreenBusy = false;

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenUi() {
  const active = isFullscreen();
  document.body.classList.toggle('is-fullscreen', active);
  if (els.fullscreenBtn) {
    els.fullscreenBtn.classList.toggle('active', active);
    els.fullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    els.fullscreenBtn.title = active ? 'Keluar fullscreen' : 'Fullscreen & landscape';
    els.fullscreenBtn.setAttribute('aria-label', active ? 'Keluar fullscreen' : 'Fullscreen dan landscape');
  }
}

async function requestFullscreen() {
  if (isFullscreen()) return true;
  if (docEl.requestFullscreen) {
    try {
      await docEl.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      await docEl.requestFullscreen();
    }
    return true;
  }
  if (docEl.webkitRequestFullscreen) {
    await docEl.webkitRequestFullscreen();
    return true;
  }
  return false;
}

async function exitFullscreen() {
  if (!isFullscreen()) return;
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

async function lockLandscape() {
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch { /* iOS / desktop / unsupported */ }
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
}

async function enterFullscreen({ silent = false } = {}) {
  if (fullscreenBusy) return isFullscreen();
  fullscreenBusy = true;
  try {
    if (!isFullscreen()) {
      const ok = await requestFullscreen();
      if (!ok) {
        if (!silent) showToast('Browser ini belum mendukung fullscreen. Di iPhone: tambahkan ke Layar Utama.');
        return false;
      }
    }
    updateFullscreenUi();
    await lockLandscape();
    if (!silent) {
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      showToast(portrait ? 'Fullscreen aktif · putar HP mendatar untuk kontrol lebih lega' : 'Fullscreen aktif · kontrol siap', 2600);
    }
    return true;
  } catch {
    if (!silent) showToast('Fullscreen ditolak browser. Ketuk ⛶ sekali lagi.');
    return false;
  } finally {
    fullscreenBusy = false;
  }
}

async function toggleFullscreen() {
  if (isFullscreen()) {
    await exitFullscreen();
    updateFullscreenUi();
    unlockOrientation();
    showToast('Fullscreen dimatikan', 1600);
  } else {
    await enterFullscreen({ silent: false });
  }
}

els.fullscreenBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleFullscreen();
});

for (const eventName of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(eventName, () => {
    updateFullscreenUi();
    if (!isFullscreen()) unlockOrientation();
  });
}

window.addEventListener('orientationchange', () => {
  if (isFullscreen() && window.matchMedia('(orientation: portrait)').matches) {
    showToast('Putar HP mendatar untuk kontrol lebih lebar', 2200);
  }
});

updateFullscreenUi();

/* ------------------------------------------------------------------ */
/* Device niceties                                                     */
/* ------------------------------------------------------------------ */

let wakeLock = null;
let deviceEngaged = false;

async function engageDevice() {
  if (deviceEngaged) return;
  deviceEngaged = true;
  const ok = await enterFullscreen({ silent: true });
  if (ok) {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    showToast(portrait ? 'Fullscreen aktif · putar HP mendatar' : 'Fullscreen aktif · kontrol siap', 1800);
  }
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    }
  } catch { /* ignore */ }
}

function guardDuplicateTabs() {
  try {
    channel = new BroadcastChannel('sardin-controller');
  } catch {
    return;
  }
  channel.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'hello' && data.tab !== tabId) {
      channel.postMessage({ type: 'here', tab: tabId });
    } else if (data.type === 'here' && data.tab !== tabId) {
      duplicateTab = true;
      showOverlay(
        'Controller sudah terbuka',
        'Halaman kontroler ini sudah aktif di tab lain. Tutup tab ini, atau pakai HP lain untuk pemain kedua.',
        { retry: false }
      );
      setStatus('Tab ganda', 'bad');
    }
  });
  channel.postMessage({ type: 'hello', tab: tabId });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAll();
  } else {
    if (!wakeLock && deviceEngaged) {
      navigator.wakeLock?.request('screen').then((lock) => { wakeLock = lock; }).catch(() => {});
    }
    if (!duplicateTab && (!conn || !conn.open)) {
      if (peer && peer.open) connectToRoom();
      else startPeer();
    }
  }
});

window.addEventListener('blur', releaseAll);
window.addEventListener('pagehide', releaseAll);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

els.retryBtn.addEventListener('click', () => {
  try { localStorage.removeItem('sardin-controller-token'); } catch { /* ignore */ }
  location.reload();
});

setInterval(() => {
  if (conn && conn.open) {
    send({ type: 'input', left: input.left, right: input.right, jump: input.jump, seq: Date.now() % 100000 });
  }
}, 500);

setInterval(() => {
  if (conn && conn.open) send({ type: 'ping', t: Date.now() });
}, 4000);

setRoomCodes();
setSlot(0, '', '');
guardDuplicateTabs();
if (!roomId) {
  setStatus('Room tidak ditemukan', 'bad');
  showOverlay('Room tidak ditemukan', 'Scan QR dari layar utama, lalu buka halaman kontroler yang muncul.', { retry: false });
} else {
  showOverlay('Membuka room WebRTC...', 'Menghubungkan ke layar utama...', { spin: true });
  setTimeout(() => {
    if (!duplicateTab) startPeer();
  }, 260);
}

window.addEventListener('beforeunload', () => {
  try { conn?.close(); } catch { /* ignore */ }
  try { peer?.destroy(); } catch { /* ignore */ }
  try { channel?.close(); } catch { /* ignore */ }
});
