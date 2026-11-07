// Game orchestrator: states, fixed-step simulation, rendering and juice.
import { VIEW_W, VIEW_H } from './config.js';
import { Level } from './level.js';
import { Camera } from './camera.js';
import { ParticleSystem } from './particles.js';
import { AudioEngine } from './audio.js';
import { PeerRoom } from './peer-room.js';
import { InputManager } from './input.js';
import { HUD } from './ui/hud.js';
import { drawBackground, drawVignette } from './render/background.js';
import { drawScene } from './render/scene.js';

const STEP = 1 / 120;

function isTVBrowser() {
  const ua = navigator.userAgent || '';
  if (/Android TV|GoogleTV|Google TV|SMART-TV|SmartTV|Tizen|Web0S|webOS|BRAVIA|AFT[A-Z0-9]|MiTV|Hisense|Vizio|Philips|Roku|CrKey/i.test(ua)) return true;
  // Android-tablet/TV builds often omit "Mobile" and have a large screen.
  return /Android/i.test(ua) && !/Mobile/i.test(ua) && Math.max(screen.width, screen.height) >= 960;
}

export class Game {
  constructor() {
    this.canvas = document.querySelector('#game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.network = new PeerRoom();
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem();
    this.input = new InputManager(this.network);
    this.hud = new HUD();

    const params = new URLSearchParams(location.search);
    const requestedQuality = params.get('quality') || window.SARDIN_CONFIG?.performance || 'auto';
    this.forcedQuality = ['low', 'high'].includes(requestedQuality) ? requestedQuality : null;
    this.debugPerf = params.get('debug') === '1';
    this.lowFx = this.forcedQuality === 'low' || (this.forcedQuality !== 'high' && isTVBrowser());
    this.lowScale = 0.8;
    this.renderScale = this.lowFx ? this.lowScale : 1;
    this.currentFps = 0;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    this.lowStreak = 0;
    this.perfAdjusted = false;
    document.documentElement.classList.toggle('low-fx', this.lowFx);

    this.level = new Level();
    this.camera = new Camera(this.level);
    this.state = 'title';
    this.acc = 0;
    this.animTime = 0;
    this.last = performance.now();
    this.dpr = 1;
    this.qrVisible = false;
    this.previousSlots = null;
    this.stepAudioCooldown = 0;
    this.windAudioCooldown = 0;
    this.controllerBase = '';
    this.controllerUrl = '';
    this.roomId = '';

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.bindUI();
    this.bindNetwork();
    this.bindShortcuts();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    this.loop = this.loop.bind(this);
    this.tick = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  async boot() {
    this.resize();
    const fontReady = document.fonts?.ready || Promise.resolve();
    await Promise.race([fontReady, new Promise((r) => setTimeout(r, 1600))]);

    this.controllerBase = await this.resolveControllerBase();
    this.hud.setRoomStatus('Menyiapkan room WebRTC...', 'wait');
    this.hud.setPresence(this.network.slots);
    this.hud.setServerStatus(this.network.status);
    this.hud.setMuted(this.audio.muted);
    this.prepareTitle();
    this.hud.hideLoading();
    this.last = performance.now();
    requestAnimationFrame(this.loop);

    // Create the PeerJS room from the main screen. The static host is not
    // involved in signaling or input.
    this.network.start();
  }

  async resolveControllerBase() {
    const configured = window.SARDIN_CONFIG?.controllerBaseUrl;
    if (configured) return configured;

    // The optional static host can tell us the LAN address. On a public static
    // host this endpoint is absent and we simply fall back to the same origin.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch('/api/info', { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const info = await response.json();
          if (info.controllerUrl) return info.controllerUrl;
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      /* static host without helper */
    }

    const url = new URL('controller.html', location.href);
    url.search = '';
    url.hash = '';
    return url.href;
  }

  buildControllerUrl(roomId) {
    try {
      const url = new URL(this.controllerBase, location.href);
      url.searchParams.set('room', roomId);
      return url.href;
    } catch {
      return `${this.controllerBase}?room=${encodeURIComponent(roomId)}`;
    }
  }

  resize() {
    const baseDpr = Math.min(window.devicePixelRatio || 1, this.lowFx ? 1 : 1.5);
    const dpr = Math.max(0.6, baseDpr * this.renderScale);
    this.dpr = dpr;
    this.canvas.width = Math.round(VIEW_W * dpr);
    this.canvas.height = Math.round(VIEW_H * dpr);
  }

  applyLowMode(reason) {
    if (this.lowFx) return;
    this.lowFx = true;
    this.lowScale = 0.8;
    this.renderScale = this.lowScale;
    document.documentElement.classList.add('low-fx');
    this.resize();
    this.hud.setPerf(`MODE PERFORMA ${this.currentFps.toFixed(0)} FPS`, this.debugPerf);
    if (this.state === 'playing') {
      this.level.showHint('Mode performa aktif: resolusi diturunkan agar tetap lancar.', 4);
    }
    void reason;
  }

  updatePerf(rawDt) {
    if (!(rawDt > 0) || rawDt > 0.5) return;
    this.fpsFrames += 1;
    this.fpsElapsed += rawDt;
    if (this.fpsElapsed < 1) return;

    const fps = this.fpsFrames / this.fpsElapsed;
    this.currentFps = fps;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;

    if (this.debugPerf) {
      this.hud.setPerf(
        `${fps.toFixed(0)} FPS · ${this.lowFx ? 'LOW' : 'HIGH'} · ${this.canvas.width}×${this.canvas.height}`,
        true
      );
    }

    if (this.forcedQuality === 'high') return;

    if (!this.lowFx) {
      if (fps < 46) this.lowStreak += 1;
      else this.lowStreak = 0;
      if (this.lowStreak >= 2) this.applyLowMode('fps');
      return;
    }

    // If even the low-resolution pass struggles, drop one more notch once.
    if (!this.perfAdjusted && this.lowScale > 0.7 && fps < 36) {
      this.perfAdjusted = true;
      this.lowScale = 0.7;
      this.renderScale = this.lowScale;
      this.resize();
      if (this.debugPerf) this.hud.setPerf(`${fps.toFixed(0)} FPS · LOW ${this.canvas.width}×${this.canvas.height}`, true);
    }
  }

  prepareTitle() {
    this.level = new Level();
    const p1 = this.level.players[0];
    const p2 = this.level.players[1];
    // A photogenic spot in the open meadow for the title backdrop.
    p1.reset({ x: 8320, y: 568 });
    p2.reset({ x: 8420, y: 568 });
    for (const p of this.level.players) {
      p.onGround = true;
      p.groundType = 'grass';
      p.vx = 0;
      p.vy = 0;
      p.carryingKey = false;
      p.invuln = 0;
    }
    this.level.players[1].facing = -1;
    // Keep the title backdrop clean: the exit arch belongs to the gameplay reveal.
    this.level.door.x = -4000;
    this.level.door.zone = { x: -4000, y: this.level.door.y, w: this.level.door.w, h: this.level.door.h };
    this.camera = new Camera(this.level);
    this.camera.zoom = 1.08;
    this.camera.x = 8400;
    this.camera.y = 520;
    this.particles.clear();
  }

  /* ------------------------------------------------------------------ */
  /* UI wiring                                                           */
  /* ------------------------------------------------------------------ */

  bindUI() {
    document.querySelector('#startBtn')?.addEventListener('click', () => this.startGame());
    document.querySelector('#soundBtn')?.addEventListener('click', (event) => {
      this.audio.unlock();
      if (this.audio.muted) this.audio.setMuted(false);
      this.hud.setMuted(false);
      this.audio.sfx('coin');
      event.currentTarget.textContent = '♪ Suara aktif';
      event.currentTarget.disabled = true;
    });
    document.querySelector('#muteBtn')?.addEventListener('click', () => this.toggleMute());
    document.querySelector('#qrBtn')?.addEventListener('click', () => this.toggleQR());
    document.querySelector('#qrClose')?.addEventListener('click', () => this.setQR(false));
    document.querySelector('#resumeBtn')?.addEventListener('click', () => this.resume());
    document.querySelector('#restartPauseBtn')?.addEventListener('click', () => this.restart());
    document.querySelector('#replayBtn')?.addEventListener('click', () => this.restart());
    document.querySelector('#menuBtn')?.addEventListener('click', () => this.toTitle());

    const urlEl = document.querySelector('#controllerUrl');
    urlEl?.addEventListener('click', async () => {
      if (!this.controllerUrl) return;
      try {
        await navigator.clipboard.writeText(this.controllerUrl);
        urlEl.textContent = 'Alamat disalin!';
        setTimeout(() => { urlEl.textContent = this.controllerUrl; }, 1400);
      } catch { /* clipboard needs https/localhost */ }
    });

    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }

  bindNetwork() {
    this.network.onRoom = (roomId) => {
      this.roomId = roomId;
      this.controllerUrl = this.buildControllerUrl(roomId);
      this.hud.setRoom(roomId);
      this.hud.setControllerUrl(this.controllerUrl);
      this.hud.setRoomStatus('Room siap · scan QR untuk bergabung', 'ok');
      if (this.qrVisible) this.hud.setQRVisible(true);
    };

    this.network.onPresence = (slots) => {
      this.hud.setPresence(slots);
      if (this.previousSlots) {
        for (const slot of [1, 2]) {
          const was = this.previousSlots[slot]?.connected;
          if (slots[slot]?.connected && !was && this.state === 'playing') {
            this.level.showHint(`${slots[slot].name} terhubung dari HP! Siap bermain.`, 3);
            this.audio.sfx('checkpoint');
          }
        }
      }
      this.previousSlots = slots;
    };

    this.network.onMeow = (playerIndex) => {
      if (this.state === 'playing' || this.state === 'paused') this.level.meow(playerIndex);
    };

    this.network.onStatus = (status) => {
      this.hud.setServerStatus(status);
      if (status === 'online') {
        this.hud.setRoomStatus('Room siap · scan QR untuk bergabung', 'ok');
      } else if (status === 'connecting') {
        this.hud.setRoomStatus('Menyiapkan room WebRTC...', 'wait');
      } else if (status === 'reconnecting') {
        this.hud.setRoomStatus('Menyambung ulang ke broker WebRTC...', 'wait');
        this.hud.setBanner('Menyambung ulang ke broker WebRTC...');
      } else if (status === 'offline') {
        this.hud.setRoomStatus('Broker WebRTC terputus. Mencoba lagi...', 'bad');
        this.hud.setBanner('Broker WebRTC terputus — menyambung ulang...');
      }
    };

    this.network.onError = (message) => {
      this.hud.setRoomStatus(message, 'bad');
    };
  }

  bindShortcuts() {
    this.input.onShortcut = (code, event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (this.state === 'title') {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
          event.preventDefault();
          this.startGame();
        }
        return;
      }
      if (code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      } else if (code === 'KeyR') {
        if (this.state === 'playing' || this.state === 'paused' || this.state === 'won') this.restart();
      } else if (code === 'KeyM') {
        this.toggleMute();
      } else if (code === 'KeyQ') {
        this.toggleQR();
      } else if (code === 'KeyF') {
        this.toggleFullscreen();
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* State transitions                                                   */
  /* ------------------------------------------------------------------ */

  startGame() {
    if (this.state !== 'title') return;
    this.audio.unlock();
    this.input.clear();
    this.resetRun();
    this.state = 'playing';
    this.hud.hideTitle();
    this.hud.showHUD();
    this.hud.showPause(false);
    this.hud.showWin(false);
    this.hud.setQRVisible(false);
    this.qrVisible = false;
    this.level.showHint('Kumpulkan sardin, lalu capai pintu emas bersama!', 6);
    this.hud.setHint(this.level.hint, true);
  }

  resetRun() {
    this.level = new Level();
    this.camera = new Camera(this.level);
    this.particles.clear();
    this.acc = 0;
    this.hud.displayScore = 0;
    this.hud.lastScore = -1;
    this.hud.lastObjective = '';
    this.stepAudioCooldown = 0;
    this.windAudioCooldown = 0;
    this.hud.setWin(false);
    this.hud.showPause(false);
  }

  restart() {
    this.audio.unlock();
    this.resetRun();
    this.state = 'playing';
    this.hud.showWin(false);
    this.hud.showPause(false);
    this.hud.showHUD();
    this.hud.hideTitle();
    this.hud.setQRVisible(false);
    this.qrVisible = false;
    this.hud.fadeTo(true);
    setTimeout(() => this.hud.fadeTo(false), 260);
    this.level.showHint('Coba lagi! Kali ini kerja samanya lebih rapat.', 4);
  }

  toTitle() {
    this.state = 'title';
    this.prepareTitle();
    this.hud.hideHUD();
    this.hud.showTitle();
    this.hud.showWin(false);
    this.hud.showPause(false);
    this.hud.setQRVisible(false);
    this.qrVisible = false;
    this.hud.fadeTo(false);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.clear();
    this.hud.showPause(true);
    this.hud.setHint(this.level.hint, false);
    this.hud.setQRVisible(false);
    this.qrVisible = false;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.acc = 0;
    this.last = performance.now();
    this.hud.showPause(false);
  }

  finish() {
    if (this.state === 'won') return;
    this.state = 'won';
    const stats = this.level.stats;
    const timeBonus = Math.max(0, Math.round((360 - Math.min(360, stats.time)) * 2.5));
    this.level.score += timeBonus;
    const fishRatio = stats.sardines / stats.totalSardines;
    const coinRatio = stats.coins / Math.max(1, stats.totalCoins);
    let rank = 'C';
    if (fishRatio >= 1 && coinRatio >= 0.85) rank = 'S';
    else if (fishRatio >= 0.75) rank = 'A';
    else if (fishRatio >= 0.5) rank = 'B';

    this.hud.setWin({
      score: this.level.score,
      rank,
      sardines: stats.sardines,
      totalSardines: stats.totalSardines,
      coins: stats.coins,
      totalCoins: stats.totalCoins,
      time: stats.time
    });
    this.hud.showWin(true);
    this.hud.setHint('', false);
    this.audio.sfx('win');
    this.particles.confetti(this.level.door.x + this.level.door.w / 2, this.level.door.y + 40, 90);
    this.camera.kick(0.6);
  }

  toggleMute() {
    this.audio.unlock();
    const muted = this.audio.toggleMute();
    this.hud.setMuted(muted);
  }

  toggleQR() {
    if (this.state === 'title') return;
    this.setQR(!this.qrVisible);
  }

  setQR(visible) {
    this.qrVisible = visible;
    this.hud.setQRVisible(visible);
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */

  loop(now) {
    const raw = (now - this.last) / 1000;
    this.last = now;
    this.updatePerf(raw);
    const dt = Math.min(0.05, Math.max(0, raw));
    this.animTime += dt;
    this.tick += 1;

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'title') {
      this.updateTitle(dt);
    } else if (this.state === 'won') {
      this.particles.update(dt);
      this.camera.update(dt, this.level.players, this.level);
      this.hud.update(this.level, dt);
    } else if (this.state === 'paused') {
      this.particles.update(dt * 0.15);
    }

    this.render(dt);
    requestAnimationFrame(this.loop);
  }

  updatePlaying(dt) {
    const inputs = [this.input.poll(0), this.input.poll(1)];
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      const stepInputs = [
        {
          left: inputs[0].left,
          right: inputs[0].right,
          jump: inputs[0].jump,
          jumpPressed: steps === 0 ? inputs[0].jumpPressed : false
        },
        {
          left: inputs[1].left,
          right: inputs[1].right,
          jump: inputs[1].jump,
          jumpPressed: steps === 0 ? inputs[1].jumpPressed : false
        }
      ];
      this.level.update(STEP, stepInputs);
      this.acc -= STEP;
      steps += 1;
      if (this.level.finished) break;
    }
    if (this.acc > 0.25) this.acc = 0;

    this.stepAudioCooldown = Math.max(0, this.stepAudioCooldown - dt);
    this.windAudioCooldown = Math.max(0, this.windAudioCooldown - dt);

    this.drainEvents();
    this.camera.update(dt, this.level.players, this.level);
    this.particles.update(dt);
    this.hud.update(this.level, dt);
    this.hud.setHint(this.level.hint, this.level.hintTimer > 0);

    if (this.level.finished) this.finish();
  }

  updateTitle(dt) {
    for (const player of this.level.players) {
      player.animTime += dt;
      player.blinkTimer -= dt;
      if (player.blinkTimer <= 0) {
        player.blinking = 0.13;
        player.blinkTimer = 2.5 + Math.random() * 4;
      }
      player.blinking = Math.max(0, player.blinking - dt);
    }
    this.camera.update(dt, this.level.players, this.level);
    this.particles.update(dt);
  }

  drainEvents() {
    const events = this.level.drainEvents();
    for (const event of events) {
      switch (event.type) {
        case 'jump':
          this.audio.sfx('jump');
          this.particles.dust(event.x, event.y, '#efe3c8', 4);
          break;
        case 'land':
          if (event.speed > 380) {
            this.audio.sfx('land');
            this.particles.dust(event.x, event.y, '#efe3c8', 6);
          }
          break;
        case 'step':
          if (this.stepAudioCooldown <= 0) {
            this.audio.sfx('step');
            this.stepAudioCooldown = 0.12;
          }
          this.particles.dust(event.x, event.y, event.type === 'ice' ? '#dff8ff' : '#e8d8b8', 1);
          break;
        case 'coin':
          this.audio.sfx('coin');
          this.particles.sparks(event.x, event.y, '#ffd45c', 7, 130);
          break;
        case 'sardine':
          this.audio.sfx('sardine');
          this.particles.sparks(event.x, event.y, '#bfefff', 16, 190);
          this.particles.hearts(event.x, event.y - 8, 3);
          this.particles.float('+50', event.x, event.y - 24, '#bfefff', 20, 1.1);
          break;
        case 'chest':
          this.audio.sfx('chest');
          this.particles.confetti(event.x, event.y, 60);
          this.particles.sparks(event.x, event.y, '#ffe08a', 22, 240);
          this.particles.float('+200', event.x, event.y - 40, '#ffe08a', 26, 1.4);
          this.camera.kick(0.55);
          break;
        case 'confetti':
          this.particles.confetti(event.x, event.y, event.count || 30);
          break;
        case 'key':
          this.audio.sfx('key');
          this.particles.sparks(event.x, event.y, '#ffe08a', 20, 200);
          this.particles.float('Kunci Emas!', event.x, event.y - 30, '#ffe08a', 22, 1.5);
          break;
        case 'door':
          this.audio.sfx('door');
          this.particles.confetti(event.x, event.y, 70);
          this.camera.kick(0.6);
          break;
        case 'plate':
          this.audio.sfx('plate');
          this.particles.sparks(event.x, event.y, '#ffd45c', 6, 90);
          break;
        case 'lever':
          this.audio.sfx('lever');
          this.particles.sparks(event.x, event.y, '#b9f6ff', 12, 150);
          break;
        case 'gate':
          this.audio.sfx('gate');
          this.camera.kick(0.3);
          break;
        case 'splash':
          this.audio.sfx('splash');
          this.particles.splash(event.x, event.y, true);
          this.camera.kick(0.35);
          break;
        case 'checkpoint':
          this.audio.sfx('checkpoint');
          this.particles.sparks(event.x, event.y, '#a7f3d0', 18, 170);
          this.particles.float('Checkpoint!', event.x, event.y - 50, '#a7f3d0', 22, 1.4);
          break;
        case 'wind':
          this.particles.wind(event.x, event.y, event.dir);
          if (this.windAudioCooldown <= 0) {
            this.audio.sfx('wind');
            this.windAudioCooldown = 0.5;
          }
          break;
        case 'meow':
          this.audio.sfx('meow', { player: event.player });
          this.particles.meow(event.x, event.y);
          this.particles.hearts(event.x, event.y, 2);
          break;
        case 'win':
          break;
        default:
          break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    drawBackground(ctx, this.camera, this.level, this.animTime, this.lowFx);

    ctx.save();
    this.camera.apply(ctx);
    drawScene(ctx, this.level, this.camera, this.animTime, this.particles, this.lowFx);
    ctx.restore();

    if (!this.lowFx) drawVignette(ctx);
  }
}
