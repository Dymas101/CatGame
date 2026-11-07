// DOM HUD controller. Keeps writes cheap and idempotent.
import { QRDisplay } from './qr.js';
import { formatTime } from '../utils.js';

export class HUD {
  constructor() {
    this.qr = new QRDisplay();
    this.el = {
      hud: document.querySelector('#hud'),
      title: document.querySelector('#titleScreen'),
      score: document.querySelector('#scoreValue'),
      fish: document.querySelector('#fishValue'),
      time: document.querySelector('#timeValue'),
      objective: document.querySelector('#objective'),
      objectiveText: document.querySelector('#objectiveText'),
      hint: document.querySelector('#hint'),
      hintText: document.querySelector('#hintText'),
      chipP1: document.querySelector('#chipP1'),
      chipP2: document.querySelector('#chipP2'),
      chipP1State: document.querySelector('#chipP1State'),
      chipP2State: document.querySelector('#chipP2State'),
      controllerUrl: document.querySelector('#controllerUrl'),
      qrPanelUrl: document.querySelector('#qrPanelUrl'),
      roomStatus: document.querySelector('#roomStatus'),
      roomCode: document.querySelector('#roomCode'),
      panelRoomCode: document.querySelector('#panelRoomCode'),
      qrPanel: document.querySelector('#qrPanel'),
      slot1: document.querySelector('#slot1'),
      slot2: document.querySelector('#slot2'),
      panelSlot1: document.querySelector('#panelSlot1'),
      panelSlot2: document.querySelector('#panelSlot2'),
      pause: document.querySelector('#pauseScreen'),
      win: document.querySelector('#winScreen'),
      fade: document.querySelector('#fade'),
      loading: document.querySelector('#loading'),
      banner: document.querySelector('#serverBanner'),
      bannerText: document.querySelector('#bannerText'),
      perfBadge: document.querySelector('#perfBadge'),
      muteBtn: document.querySelector('#muteBtn'),
      winRank: document.querySelector('#winRank'),
      winScore: document.querySelector('#winScore'),
      winFish: document.querySelector('#winFish'),
      winCoins: document.querySelector('#winCoins'),
      winTime: document.querySelector('#winTime')
    };

    this.displayScore = 0;
    this.lastScore = -1;
    this.lastFish = -1;
    this.lastTime = -1;
    this.lastObjective = '';
    this.lastHint = '';
    this.lastHintVisible = false;
    this.controllerUrl = '';
  }

  showHUD() { this.el.hud?.classList.remove('is-hidden'); }
  hideHUD() { this.el.hud?.classList.add('is-hidden'); }
  showTitle() { this.el.title?.classList.remove('is-hidden'); }
  hideTitle() { this.el.title?.classList.add('is-hidden'); }

  hideLoading() {
    this.el.loading?.classList.add('is-hidden');
    setTimeout(() => {
      if (this.el.loading) this.el.loading.style.display = 'none';
    }, 500);
  }

  fadeTo(on) {
    this.el.fade?.classList.toggle('on', on);
  }

  setControllerUrl(url) {
    this.controllerUrl = url || '';
    if (this.el.controllerUrl) this.el.controllerUrl.textContent = this.controllerUrl || 'Menyiapkan room WebRTC...';
    if (this.el.qrPanelUrl) this.el.qrPanelUrl.textContent = this.controllerUrl || 'Menyiapkan room...';
    if (this.controllerUrl) this.qr.render(this.controllerUrl);
  }

  setRoom(roomId) {
    const code = roomId || '—';
    if (this.el.roomCode) this.el.roomCode.textContent = code;
    if (this.el.panelRoomCode) this.el.panelRoomCode.textContent = code;
  }

  setRoomStatus(text, mode = 'wait') {
    if (!this.el.roomStatus) return;
    this.el.roomStatus.textContent = text;
    this.el.roomStatus.className = `room-status ${mode}`;
  }

  setBanner(text) {
    if (this.el.bannerText) this.el.bannerText.textContent = text;
  }

  setPerf(text, show = false) {
    if (!this.el.perfBadge) return;
    this.el.perfBadge.textContent = text;
    this.el.perfBadge.classList.toggle('is-hidden', !show);
  }

  setQRVisible(visible) {
    this.el.qrPanel?.classList.toggle('is-hidden', !visible);
    if (visible && this.controllerUrl) this.qr.render(this.controllerUrl);
  }

  setMuted(muted) {
    this.el.muteBtn?.classList.toggle('muted', muted);
    if (this.el.muteBtn) this.el.muteBtn.textContent = muted ? '✕' : '♪';
  }

  update(level, dt) {
    const target = level.score;
    if (target !== this.lastScore) {
      this.lastScore = target;
      this.el.score?.parentElement?.classList.remove('pulse');
      void this.el.score?.parentElement?.offsetWidth;
      this.el.score?.parentElement?.classList.add('pulse');
    }
    if (this.displayScore !== target) {
      const diff = target - this.displayScore;
      if (Math.abs(diff) < 1) this.displayScore = target;
      else this.displayScore += diff * Math.min(1, dt * 9);
      if (this.el.score) this.el.score.textContent = String(Math.round(this.displayScore));
    }

    const fish = `${level.sardinesCollected}/${level.sardines.length}`;
    if (fish !== this.el.fish?.textContent) {
      if (this.el.fish) this.el.fish.textContent = fish;
      this.el.fish?.parentElement?.classList.remove('pulse');
      void this.el.fish?.parentElement?.offsetWidth;
      this.el.fish?.parentElement?.classList.add('pulse');
    }

    const secs = Math.floor(level.time);
    if (secs !== this.lastTime) {
      this.lastTime = secs;
      if (this.el.time) this.el.time.textContent = formatTime(secs);
    }

    if (level.objective !== this.lastObjective) {
      this.lastObjective = level.objective;
      if (this.el.objectiveText) this.el.objectiveText.textContent = level.objective;
      this.el.objective?.classList.remove('bump');
      void this.el.objective?.offsetWidth;
      this.el.objective?.classList.add('bump');
    }
  }

  setHint(text, visible) {
    if (text !== this.lastHint) {
      this.lastHint = text;
      if (this.el.hintText) this.el.hintText.textContent = text;
    }
    if (visible !== this.lastHintVisible) {
      this.lastHintVisible = visible;
      this.el.hint?.classList.toggle('show', visible);
    }
  }

  setPresence(slots) {
    this.applySlot(this.el.slot1, slots[1], 'Menunggu HP');
    this.applySlot(this.el.slot2, slots[2], 'Menunggu HP');
    this.applySlot(this.el.panelSlot1, slots[1], 'Menunggu');
    this.applySlot(this.el.panelSlot2, slots[2], 'Menunggu');

    this.applyChip(this.el.chipP1, this.el.chipP1State, slots[1]);
    this.applyChip(this.el.chipP2, this.el.chipP2State, slots[2]);
  }

  applySlot(row, slot, waitingText) {
    if (!row || !slot) return;
    const state = row.querySelector('.slot-state');
    row.classList.toggle('connected', slot.connected);
    row.classList.toggle('pending', !slot.connected && slot.pending);
    if (state) {
      state.textContent = slot.connected ? 'WebRTC tersambung' : slot.pending ? 'Menyambung...' : waitingText;
    }
  }

  applyChip(chip, stateEl, slot) {
    if (!chip || !slot) return;
    chip.classList.toggle('connected', slot.connected);
    chip.classList.toggle('pending', !slot.connected && slot.pending);
    if (stateEl) {
      stateEl.textContent = slot.connected ? 'Connected' : slot.pending ? 'Menyambung' : 'Keyboard';
    }
  }

  setServerStatus(status) {
    const offline = status === 'offline' || status === 'reconnecting';
    this.el.banner?.classList.toggle('is-hidden', !offline);
  }

  showPause(show) {
    this.el.pause?.classList.toggle('is-hidden', !show);
  }

  showWin(show) {
    this.el.win?.classList.toggle('is-hidden', !show);
  }

  setWin({ score, rank, sardines, totalSardines, coins, totalCoins, time }) {
    if (this.el.winRank) this.el.winRank.textContent = rank;
    if (this.el.winScore) this.el.winScore.textContent = String(score);
    if (this.el.winFish) this.el.winFish.textContent = `${sardines}/${totalSardines}`;
    if (this.el.winCoins) this.el.winCoins.textContent = `${coins}/${totalCoins}`;
    if (this.el.winTime) this.el.winTime.textContent = formatTime(time);
  }
}
