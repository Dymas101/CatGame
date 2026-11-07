// WebRTC room host for the main screen.
//
// The main screen creates a PeerJS peer (public cloud signaling). Phones open
// controller.html?room=<id> and connect directly with a WebRTC DataChannel.
// There is no WebSocket server, no room server, and no game-state server.
import { PLAYERS } from './config.js';
import { SlotTable } from './room-state.js';

const ROOM_STORAGE_KEY = 'sardin-webrtc-room';
const TOKEN_RE = /^[A-Za-z0-9_-]{6,64}$/;

function randomHex(bytes = 5) {
  const data = new Uint8Array(bytes);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(data);
  else for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
  return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeToken(token) {
  return typeof token === 'string' && TOKEN_RE.test(token) ? token : '';
}

function parseData(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === 'object') return raw;
  return null;
}

export class PeerRoom {
  constructor() {
    this.table = new SlotTable(12000);
    this.connections = new Map();
    this.inputs = [this.freshInput(), this.freshInput()];
    this.roomId = '';
    this.status = 'connecting';
    this.peer = null;
    this.destroyed = false;
    this.retryTimer = null;
    this.retryAttempt = 0;
    this.idRetries = 0;
    this.expiryTimer = null;
    this.openTimer = null;

    this.onRoom = null;
    this.onStatus = null;
    this.onPresence = null;
    this.onMeow = null;
    this.onError = null;
    this.onPauseToggle = null;
  }

  freshInput() {
    return {
      left: false,
      right: false,
      jump: false,
      jumpQueued: false,
      connected: false,
      lastSeen: 0,
      seq: 0
    };
  }

  get slots() {
    return this.table.slotMap();
  }

  get isOnline() {
    return this.status === 'online' && Boolean(this.roomId);
  }

  start() {
    this.destroyed = false;
    this.startExpiryTimer();
    this.createPeer();
  }

  startExpiryTimer() {
    clearInterval(this.expiryTimer);
    this.expiryTimer = setInterval(() => {
      if (this.destroyed) return;
      if (this.table.expire(Date.now())) {
        this.onPresence?.(this.table.slotMap());
        this.broadcastPresence();
      }
    }, 2000);
  }

  getRoomId() {
    try {
      const saved = sessionStorage.getItem(ROOM_STORAGE_KEY);
      if (/^sardin-[a-f0-9]{10}$/.test(saved || '')) return saved;
    } catch {
      /* private mode */
    }
    const id = `sardin-${randomHex(5)}`;
    try {
      sessionStorage.setItem(ROOM_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    return id;
  }

  clearRoomId() {
    try {
      sessionStorage.removeItem(ROOM_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.roomId = '';
  }

  peerOptions() {
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

  createPeer() {
    if (this.destroyed) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    clearTimeout(this.openTimer);
    this.openTimer = null;

    const PeerCtor = window.Peer;
    if (typeof PeerCtor !== 'function') {
      this.setStatus('offline');
      this.onError?.('Library PeerJS tidak termuat. Periksa koneksi internet atau vendor/peerjs.min.js.');
      this.scheduleRetry(4000);
      return;
    }

    this.setStatus(this.retryAttempt > 0 ? 'reconnecting' : 'connecting');
    const roomId = this.getRoomId();

    let peer;
    try {
      peer = new PeerCtor(roomId, this.peerOptions());
    } catch (error) {
      this.onError?.(`Gagal membuat room: ${error.message || error}`);
      this.scheduleRetry(2500);
      return;
    }
    this.peer = peer;

    // PeerJS normally emits an error when signaling fails, but some blocked
    // networks leave it hanging forever. Recover automatically.
    this.openTimer = setTimeout(() => {
      if (this.destroyed || this.peer !== peer || peer.open) return;
      this.setStatus('offline');
      this.onError?.('Broker PeerJS tidak merespons. Matikan VPN/WARP atau coba browser lain, lalu buat ulang room.');
      this.replacePeer(peer, 1000);
    }, 9000);

    peer.on('open', (id) => {
      if (this.destroyed || this.peer !== peer) return;
      clearTimeout(this.openTimer);
      this.openTimer = null;
      this.roomId = id;
      this.retryAttempt = 0;
      this.idRetries = 0;
      try {
        sessionStorage.setItem(ROOM_STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
      this.setStatus('online');
      this.onRoom?.(id);
      this.broadcastPresence();
    });

    peer.on('connection', (connection) => this.acceptConnection(connection));

    peer.on('disconnected', () => {
      if (this.destroyed || this.peer !== peer) return;
      // DataChannels can stay alive, but new controllers cannot signal until
      // the signaling socket reconnects.
      this.setStatus('reconnecting');
      setTimeout(() => {
        if (this.destroyed || this.peer !== peer || peer.destroyed) return;
        if (peer.disconnected) {
          try {
            peer.reconnect();
          } catch {
            /* ignore */
          }
        }
      }, 700);
    });

    peer.on('close', () => {
      if (this.peer !== peer) return;
      clearTimeout(this.openTimer);
      this.openTimer = null;
      this.peer = null;
      if (this.destroyed) return;
      this.setStatus('offline');
      this.scheduleRetry(1200);
    });

    peer.on('error', (error) => this.handlePeerError(error, peer));
  }

  handlePeerError(error, peer) {
    const type = error?.type || 'error';
    const message = error?.message || String(error);

    if (this.peer !== peer) return;

    if (type === 'unavailable-id') {
      // Clear stale room ID immediately and generate a brand-new room code
      // so we don't get stuck waiting for a disconnected socket to timeout.
      this.clearRoomId();
      this.idRetries = 0;
      this.replacePeer(peer, 300);
      return;
    }
    if (type === 'peer-unavailable') {
      // A phone asked for another room; not fatal for the host.
      return;
    }
    if (type === 'browser-incompatible') {
      this.setStatus('offline');
      this.onError?.('Browser layar utama tidak mendukung WebRTC DataChannel.');
      return;
    }
    if (type === 'invalid-id' || type === 'invalid-key') {
      this.clearRoomId();
      this.setStatus('offline');
      this.onError?.(`Room WebRTC ditolak (${type}). Mencoba room baru...`);
      this.replacePeer(peer, 1200);
      return;
    }
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed' || type === 'ssl-unavailable') {
      this.setStatus('offline');
      this.onError?.('Broker PeerJS tidak terjangkau. Mencoba lagi...');
      this.replacePeer(peer, 2200);
      return;
    }
    if (type === 'webrtc') {
      this.onError?.(`Negosiasi WebRTC gagal: ${message}`);
      return;
    }
    this.onError?.(`PeerJS: ${type} ${message}`);
  }

  replacePeer(peer, delay = 1200) {
    clearTimeout(this.openTimer);
    this.openTimer = null;
    if (this.peer === peer) this.peer = null;
    try {
      peer?.destroy();
    } catch {
      /* ignore */
    }
    this.scheduleRetry(delay);
  }

  retryRoom() {
    this.clearRoomId();
    for (const conn of this.connections.keys()) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    this.table.reset();
    for (const input of this.inputs) {
      Object.assign(input, { left: false, right: false, jump: false, jumpQueued: false, connected: false, lastSeen: 0 });
    }
    this.onPresence?.(this.table.slotMap());
    this.setStatus('connecting');
    this.replacePeer(this.peer, 200);
  }

  scheduleRetry(delay) {
    if (this.destroyed) return;
    clearTimeout(this.retryTimer);
    this.retryAttempt += 1;
    const wait = Math.max(delay, Math.min(8000, 600 * Math.pow(1.5, Math.min(this.retryAttempt, 6))));
    this.retryTimer = setTimeout(() => {
      if (!this.destroyed) this.createPeer();
    }, wait);
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  acceptConnection(conn) {
    const state = {
      token: '',
      slot: 0,
      joined: false,
      lastInput: 0,
      joinTimer: null
    };

    state.joinTimer = setTimeout(() => {
      if (!state.joined) {
        try {
          conn.close();
        } catch {
          /* ignore */
        }
      }
    }, 10000);

    conn.on('data', (raw) => this.handleData(conn, state, raw));
    conn.on('close', () => this.releaseConnection(conn, state));
    conn.on('error', () => {
      /* PeerJS will emit close */
    });
    conn.on('open', () => {
      /* Wait for the explicit join message. */
    });
  }

  handleData(conn, state, raw) {
    const msg = parseData(raw);
    if (!msg || typeof msg !== 'object') return;

    if (!state.joined) {
      if (msg.type !== 'join') return;
      this.joinRoom(conn, state, msg);
      return;
    }

    if (!state.slot) return;
    const now = Date.now();
    const input = this.inputs[state.slot - 1];

    if (msg.type === 'input') {
      if (now - state.lastInput < 8) return;
      state.lastInput = now;
      const wasJump = input.jump;
      input.left = msg.left === true;
      input.right = msg.right === true;
      input.jump = msg.jump === true;
      input.lastSeen = now;
      input.seq = Number.isFinite(msg.seq) ? msg.seq : input.seq;
      if (input.jump && !wasJump) input.jumpQueued = true;
      return;
    }

    if (msg.type === 'jump') {
      input.jumpQueued = true;
      input.lastSeen = now;
      return;
    }

    if (msg.type === 'meow') {
      this.onMeow?.(state.slot - 1);
      return;
    }

    if (msg.type === 'pause') {
      this.onPauseToggle?.(state.slot - 1);
      return;
    }

    if (msg.type === 'ping') {
      this.send(conn, { type: 'pong', t: msg.t });
    }
  }

  joinRoom(conn, state, msg) {
    clearTimeout(state.joinTimer);
    state.joinTimer = null;

    const token = sanitizeToken(msg.token) || sanitizeToken(conn.metadata?.token) || `anon-${randomHex(8)}`;
    const claim = this.table.claim(token);

    if (!claim.slot) {
      state.joined = true;
      state.token = token;
      state.slot = 0;
      this.connections.set(conn, state);
      this.send(conn, {
        type: 'welcome',
        role: 'controller',
        slot: 0,
        spectator: true,
        name: 'Penonton',
        color: '#94a3b8',
        message: 'Dua slot sudah terisi. Kamu masuk sebagai penonton.'
      });
      this.broadcastPresence();
      return;
    }

    // The same phone may have reloaded while the old DataChannel was still open.
    for (const [oldConn, oldState] of [...this.connections]) {
      if (oldState.slot === claim.slot && oldConn !== conn) {
        this.connections.delete(oldConn);
        try {
          oldConn.close();
        } catch {
          /* ignore */
        }
      }
    }

    state.joined = true;
    state.token = token;
    state.slot = claim.slot;
    this.connections.set(conn, state);

    const player = PLAYERS[claim.slot - 1];
    const input = this.inputs[claim.slot - 1];
    Object.assign(input, {
      left: false,
      right: false,
      jump: false,
      jumpQueued: false,
      connected: true,
      lastSeen: Date.now()
    });

    this.send(conn, {
      type: 'welcome',
      role: 'controller',
      slot: claim.slot,
      spectator: false,
      name: player.name,
      color: player.fur,
      token,
      reconnect: claim.reconnect
    });
    this.broadcastPresence();
  }

  releaseConnection(conn, state) {
    const current = this.connections.get(conn);
    if (current !== state) return;
    this.connections.delete(conn);

    if (state.slot) {
      this.table.release(state.token);
      const input = this.inputs[state.slot - 1];
      input.left = false;
      input.right = false;
      input.jump = false;
      input.jumpQueued = false;
      input.connected = false;
      this.onPresence?.(this.table.slotMap());
      this.broadcastPresence();
    }
  }

  presencePayload() {
    return { type: 'presence', ...this.table.presence() };
  }

  broadcastPresence() {
    const payload = this.presencePayload();
    for (const [conn, state] of this.connections) {
      if (state.joined) this.send(conn, payload);
    }
    this.onPresence?.(this.table.slotMap());
  }

  broadcastGameState(paused, phase = 'playing') {
    const payload = { type: 'game-state', paused: Boolean(paused), phase };
    for (const [conn, state] of this.connections) {
      if (state.joined) this.send(conn, payload);
    }
  }

  send(conn, message) {
    if (!conn || !conn.open) return false;
    try {
      conn.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  poll(index, now) {
    const input = this.inputs[index];
    if (!input.connected) return { left: false, right: false, jump: false };
    if (now - input.lastSeen > 1200) return { left: false, right: false, jump: false };
    return { left: input.left, right: input.right, jump: input.jump };
  }

  consumeJump(index) {
    const input = this.inputs[index];
    if (!input.connected || !input.jumpQueued) return false;
    input.jumpQueued = false;
    return true;
  }

  stop() {
    this.destroyed = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.openTimer);
    clearInterval(this.expiryTimer);
    for (const conn of this.connections.keys()) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    const peer = this.peer;
    this.peer = null;
    try {
      peer?.destroy();
    } catch {
      /* ignore */
    }
  }
}
