// The simulation world: mechanisms, collectibles, chest/key/door and win flow.
import { LEVEL } from './level-data.js';
import { Player } from './player.js';
import { Box } from './box.js';
import { clamp, rectsOverlap, approach, damp, rand } from './utils.js';

export class Level {
  constructor() {
    this.data = LEVEL;
    this.width = LEVEL.width;
    this.waterY = LEVEL.waterY;
    this.bounds = LEVEL.bounds;
    this.time = 0;
    this.score = 0;
    this.coinsCollected = 0;
    this.sardinesCollected = 0;
    this.events = [];
    this.hint = '';
    this.hintTimer = 0;
    this.shake = 0;
    this.finished = false;
    this.winTimer = 0;
    this.checkpointIndex = 0;
    this.toast = null;
    this.lastCheckpointFlash = 0;

    this.players = [
      new Player(0, LEVEL.spawn.p1)
    ];

    this.platforms = LEVEL.platforms.map((p, i) => ({
      ...p,
      id: `plat${i}`,
      kind: 'platform',
      solid: true,
      dx: 0,
      dy: 0
    }));

    this.boxes = LEVEL.boxes.map((b) => new Box(b.x, b.y));

    this.plates = LEVEL.plates.map((p) => ({ ...p, pressed: false, glow: 0, press: 0 }));
    this.gates = LEVEL.gates.map((g) => ({
      ...g,
      kind: 'gate',
      open: 0,
      latched: false,
      solid: true,
      dx: 0,
      dy: 0
    }));

    this.levers = LEVEL.levers.map((l) => ({
      ...l,
      on: false,
      cooldown: 0,
      wasInside: false,
      pull: 0
    }));

    this.movers = LEVEL.movers.map((m) => ({
      ...m,
      x: m.from.x,
      y: m.from.y,
      kind: 'mover',
      solid: true,
      progress: 0,
      dir: 1,
      dx: 0,
      dy: 0,
      active: false
    }));

    this.fans = LEVEL.fans.map((f) => ({
      ...f,
      spin: rand(0, Math.PI * 2),
      windPhase: rand(0, 10),
      active: true
    }));

    this.coins = LEVEL.coins.map((c, i) => ({
      ...c,
      id: i,
      w: 26,
      h: 26,
      collected: false,
      phase: (i * 0.37) % (Math.PI * 2)
    }));

    this.sardines = LEVEL.sardines.map((s) => ({
      ...s,
      w: 38,
      h: 26,
      collected: false
    }));

    this.signs = LEVEL.signs.map((s) => ({ ...s, cooldown: 0 }));
    this.checkpoints = LEVEL.checkpoints;

    this.chest = {
      ...LEVEL.chest,
      state: 'closed',
      timer: 0,
      opened: false,
      wobble: 0
    };

    this.key = {
      state: 'hidden', // hidden | free | held | inserted
      x: 0,
      y: 0,
      w: 34,
      h: 34,
      vx: 0,
      vy: 0,
      age: 0,
      phase: 0,
      holder: null
    };

    this.door = {
      ...LEVEL.door,
      inserted: false,
      open: 0,
      zone: { x: LEVEL.door.x - 6, y: LEVEL.door.y - 6, w: LEVEL.door.w + 12, h: LEVEL.door.h + 12 }
    };

    this.staticSolids = [];
    this.collisionSolids = [];
    this.moverActive = false;

    this.showHint('Kumpulkan sardin, lalu capai pintu emas bersama-sama!', 6);
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  showHint(text, seconds = 5) {
    this.hint = text;
    this.hintTimer = seconds;
  }

  get maxX() {
    return Math.max(...this.players.map((p) => p.x));
  }

  get objective() {
    if (this.door.inserted) return 'Kedua kucing masuk ke pintu emas!';
    if (this.key.state === 'held') return 'Bawa Kunci Emas ke pintu keluar';
    if (this.chest.opened) return 'Ambil Kunci Emas!';
    if (this.checkpointIndex >= 4 || this.maxX > 6700) return 'Cari peti hadiah di atas platform kayu';
    if (this.checkpointIndex >= 3 || this.maxX > 4900) return 'Seberangi arena es dan kipas raksasa';
    if (this.checkpointIndex >= 2 || this.maxX > 3600) return 'Aktifkan tuas, lalu seberangi jurang';
    if (this.gates[0].latched) return 'Gerbang terbuka! Lanjut ke kanan';
    if (this.maxX > 2100) return 'Berdiri di tombol lantai untuk membuka gerbang';
    if (this.maxX > 1600) return 'Temukan gerbang dan tombol lantai';
    return 'Kumpulkan sardin & koin, lalu menuju pintu keluar';
  }

  update(dt, inputs, networkSlots) {
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);

    if (inputs) {
      for (let slotId = 2; slotId <= 4; slotId++) {
        const playerIndex = slotId - 1;
        const isConnected = networkSlots && networkSlots[slotId]?.connected;
        const playerInput = inputs[playerIndex];
        const hasInput = playerInput && (playerInput.left || playerInput.right || playerInput.jump || playerInput.jumpPressed);

        const existingPlayer = this.players.find((p) => p.index === playerIndex);
        if ((isConnected || hasInput) && !existingPlayer) {
          const p1 = this.players[0];
          const spawnX = p1 ? p1.cx + (playerIndex * 48 - 24) : 180 + playerIndex * 50;
          const spawnY = p1 ? p1.y : 568;
          const newPlayer = new Player(playerIndex, { x: spawnX, y: spawnY });
          newPlayer.onGround = true;
          newPlayer.invuln = 1.2;
          this.players.push(newPlayer);
          this.players.sort((a, b) => a.index - b.index);
          const name = playerIndex === 1 ? 'Kucing Abu-abu (P2)' : playerIndex === 2 ? 'Kucing Putih (P3)' : 'Kucing Hitam (P4)';
          this.showHint(`${name} bergabung ke permainan!`, 4);
          this.emit('checkpoint', { x: newPlayer.cx, y: newPlayer.y });
        }
      }
    }

    for (const sign of this.signs) sign.cooldown = Math.max(0, sign.cooldown - dt);
    for (const lever of this.levers) {
      lever.cooldown = Math.max(0, lever.cooldown - dt);
      lever.pull = damp(lever.pull, lever.on ? 1 : 0, 12, dt);
    }

    this.updateLevers(dt);
    this.updateMovers(dt);
    this.updateGates(dt);

    this.staticSolids = [...this.platforms, ...this.gates, ...this.movers].filter((s) => s.solid);
    this.collisionSolids = [...this.staticSolids, ...this.boxes].filter((s) => s.solid);

    for (let i = 0; i < this.players.length; i++) {
      const input = inputs[i] || { left: false, right: false, jump: false, jumpPressed: false };
      this.players[i].update(dt, input, this);
    }

    for (const box of this.boxes) box.update(dt, this);

    this.updatePlates(dt);
    this.updatePickups(dt);
    this.updateChestKey(dt);
    this.updateDoor(dt, networkSlots);
    this.updateCheckpoints(networkSlots);
    this.updateSigns(dt);
    this.updateFans(dt);
  }

  updateLevers(dt) {
    for (const lever of this.levers) {
      const rect = { x: lever.x, y: lever.y - lever.h, w: lever.w, h: lever.h };
      let inside = false;
      for (const player of this.players) {
        if (rectsOverlap(player.rect, rect)) inside = true;
      }
      if (inside && !lever.wasInside && lever.cooldown <= 0) {
        this.activateLever(lever);
      }
      lever.wasInside = inside;
    }
  }

  activateLever(lever) {
    lever.cooldown = 0.9;
    this.emit('lever', { x: lever.x + lever.w / 2, y: lever.y - lever.h / 2 });
    this.shake = Math.max(this.shake, 0.18);

    if (lever.type === 'latch') {
      if (lever.on) return;
      lever.on = true;
      const gate = this.gates.find((g) => g.id === lever.gate);
      if (gate) {
        gate.latched = true;
        this.showHint('Gerbang terkunci terbuka! Kedua kucing bisa lewat.', 5);
        this.emit('gate', { x: gate.x + gate.w / 2, y: gate.y + gate.h / 2 });
      }
      return;
    }

    if (lever.type === 'toggle') {
      lever.on = !lever.on;
      this.moverActive = lever.on;
      for (const mover of this.movers) {
        if (lever.movers?.includes(mover.id)) mover.active = lever.on;
      }
      this.showHint(
        lever.on ? 'Platform ajaib aktif! Naik dan seberangi jurang.' : 'Platform ajaib berhenti...',
        4
      );
    }
  }

  updateMovers(dt) {
    for (const mover of this.movers) {
      const oldX = mover.x;
      const oldY = mover.y;
      const length = Math.max(1, Math.hypot(mover.to.x - mover.from.x, mover.to.y - mover.from.y));
      const step = (mover.speed / length) * dt;

      if (mover.active) {
        mover.progress += mover.dir * step;
        if (mover.progress >= 1) {
          mover.progress = 1;
          mover.dir = -1;
        } else if (mover.progress <= 0) {
          mover.progress = 0;
          mover.dir = 1;
        }
      } else if (mover.progress > 0) {
        mover.progress = approach(mover.progress, 0, step);
      }

      mover.x = mover.from.x + (mover.to.x - mover.from.x) * mover.progress;
      mover.y = mover.from.y + (mover.to.y - mover.from.y) * mover.progress;
      mover.dx = mover.x - oldX;
      mover.dy = mover.y - oldY;
    }
  }

  updateGates(dt) {
    for (const gate of this.gates) {
      const plate = gate.plate ? this.plates.find((p) => p.id === gate.plate) : null;
      const target = gate.latched || (plate ? plate.pressed : false) ? 1 : 0;
      gate.open = damp(gate.open, target, 10, dt);
      gate.solid = gate.open < 0.72;
      gate.dx = 0;
      gate.dy = 0;
    }
  }

  updatePlates(dt) {
    for (const plate of this.plates) {
      let pressed = false;
      for (const player of this.players) {
        if (this.standsOn(player, plate)) pressed = true;
      }
      for (const box of this.boxes) {
        if (this.standsOn(box, plate)) pressed = true;
      }
      plate.pressed = pressed;
      plate.press = damp(plate.press, pressed ? 1 : 0, 18, dt);
      plate.glow = damp(plate.glow, pressed ? 1 : 0, 8, dt);
      if (pressed && !plate.wasPressed) {
        this.emit('plate', { x: plate.x + plate.w / 2, y: plate.y });
      }
      plate.wasPressed = pressed;
    }
  }

  standsOn(entity, plate) {
    const bottom = entity.y + entity.h;
    return (
      entity.x + entity.w > plate.x + 4 &&
      entity.x < plate.x + plate.w - 4 &&
      Math.abs(bottom - plate.y) <= 10 &&
      (entity.onGround || entity.vy >= 0)
    );
  }

  updatePickups(dt) {
    for (const coin of this.coins) {
      if (coin.collected) continue;
      coin.phase += dt * 3.2;
      for (const player of this.players) {
        if (rectsOverlap(player.rect, { x: coin.x - 13, y: coin.y - 13, w: 26, h: 26 })) {
          coin.collected = true;
          this.coinsCollected += 1;
          this.score += 10;
          this.emit('coin', { x: coin.x, y: coin.y, index: coin.id });
          break;
        }
      }
    }

    for (const sardine of this.sardines) {
      if (sardine.collected) continue;
      sardine.phase += dt;
      for (const player of this.players) {
        if (rectsOverlap(player.rect, { x: sardine.x - 19, y: sardine.y - 13, w: 38, h: 26 })) {
          sardine.collected = true;
          this.sardinesCollected += 1;
          this.score += 50;
          this.emit('sardine', { x: sardine.x, y: sardine.y });
          break;
        }
      }
    }
  }

  updateChestKey(dt) {
    const chest = this.chest;

    if (chest.state === 'closed') {
      for (const player of this.players) {
        if (rectsOverlap(player.rect, chest)) {
          chest.state = 'opening';
          chest.timer = 0;
          this.score += 200;
          this.emit('chest', { x: chest.x + chest.w / 2, y: chest.y + chest.h / 2 });
          this.shake = Math.max(this.shake, 0.35);
          this.showHint('Peti hadiah terbuka! Ambil Kunci Emas.', 5);
          break;
        }
      }
    } else if (chest.state === 'opening') {
      chest.timer += dt;
      chest.wobble = Math.sin(chest.timer * 40) * (1 - chest.timer) * 0.08;
      if (chest.timer > 0.55) {
        chest.state = 'open';
        chest.opened = true;
        this.spawnKey();
      }
    }

    const key = this.key;
    if (key.state === 'free') {
      key.age += dt;
      key.phase += dt;
      key.vy += 1650 * dt;
      key.x += key.vx * dt;
      key.y += key.vy * dt;
      key.vx *= 0.995;

      // Bounce off platform tops.
      for (const solid of this.platforms) {
        if (
          key.x + key.w > solid.x &&
          key.x < solid.x + solid.w &&
          key.y + key.h > solid.y &&
          key.y + key.h < solid.y + 40 &&
          key.vy > 0
        ) {
          key.y = solid.y - key.h;
          key.vy *= -0.32;
          if (Math.abs(key.vy) < 80) key.vy = 0;
        }
      }
      if (key.y > this.waterY + 60) this.resetKeyToChest();

      if (key.age > 0.45) {
        for (const player of this.players) {
          if (rectsOverlap(player.rect, { x: key.x, y: key.y, w: key.w, h: key.h })) {
            key.state = 'held';
            key.holder = player;
            player.carryingKey = true;
            this.score += 100;
            this.emit('key', { x: key.x, y: key.y, player: player.index });
            this.showHint('Kunci Emas didapat! Bawa ke pintu di ujung kanan.', 5);
            break;
          }
        }
      }
    } else if (key.state === 'held' && key.holder) {
      const p = key.holder;
      key.phase += dt;
      key.x = p.cx - key.w / 2;
      key.y = p.y - 26 + Math.sin(key.phase * 4) * 3;
      if (!p.carryingKey) {
        // Safety: if something cleared the flag, drop the key.
        key.state = 'free';
        key.vy = -100;
        key.age = 1;
        key.holder = null;
      }
    }
  }

  spawnKey() {
    const chest = this.chest;
    this.key.state = 'free';
    this.key.x = chest.x + chest.w / 2 - this.key.w / 2;
    this.key.y = chest.y + 12;
    this.key.vx = 35;
    this.key.vy = -430;
    this.key.age = 0;
    this.key.phase = 0;
    this.emit('confetti', { x: chest.x + chest.w / 2, y: chest.y + 20, count: 40 });
  }

  resetKeyToChest() {
    this.key.state = 'free';
    this.key.x = this.chest.x + this.chest.w / 2 - this.key.w / 2;
    this.key.y = this.chest.y + 6;
    this.key.vx = 0;
    this.key.vy = -220;
    this.key.age = 0.6;
    this.key.holder = null;
  }

  updateDoor(dt, networkSlots) {
    const door = this.door;
    door.open = damp(door.open, door.inserted ? 1 : 0, 7, dt);

    if (!door.inserted && this.key.state === 'held' && this.key.holder) {
      for (const player of this.players) {
        if (rectsOverlap(player.rect, door.zone)) {
          door.inserted = true;
          this.key.state = 'inserted';
          this.key.x = door.x + door.w / 2 - this.key.w / 2;
          this.key.y = door.y + 76;
          this.key.holder.carryingKey = false;
          this.key.holder = null;
          player.carryingKey = false;
          this.score += 150;
          this.emit('door', { x: door.x + door.w / 2, y: door.y + 70 });
          this.shake = Math.max(this.shake, 0.35);
          this.showHint('Kunci masuk! Sekarang semua kucing aktif harus berdiri di pintu.', 6);
          break;
        }
      }
    }

    if (door.inserted && !this.finished) {
      const activePlayers = this.players.filter((p) => {
        if (p.index === 0) return true; // P1 always active
        if (networkSlots && networkSlots[p.slot]) {
          return networkSlots[p.slot].connected;
        }
        return p.index === 1; // Default P2 active locally
      });

      const inside = activePlayers.filter((p) => rectsOverlap(p.rect, door.zone));
      if (inside.length === activePlayers.length) {
        this.winTimer += dt;
        if (this.winTimer > 0.55) {
          this.finished = true;
          this.emit('win', {
            time: this.time,
            score: this.score,
            coins: this.coinsCollected,
            totalCoins: this.coins.length,
            sardines: this.sardinesCollected,
            totalSardines: this.sardines.length
          });
        }
      } else {
        this.winTimer = 0;
        if (inside.length > 0 && inside.length < activePlayers.length) {
          if (this.hintTimer <= 0) this.showHint(`Semua kucing aktif harus masuk pintu (${inside.length}/${activePlayers.length})!`, 3);
        }
      }
    }
  }

  updateCheckpoints() {
    for (let i = this.checkpoints.length - 1; i > this.checkpointIndex; i--) {
      const cp = this.checkpoints[i];
      if (this.players.some((p) => p.cx >= cp.x && p.y + p.h < this.waterY - 20)) {
        this.checkpointIndex = i;
        for (let idx = 0; idx < this.players.length; idx++) {
          const p = this.players[idx];
          if (p) {
            const spawnIndex = Math.min(p.index, cp.spawn.length - 1);
            p.setSpawn(cp.spawn[spawnIndex] || cp.spawn[0]);
          }
        }
        this.showHint('Checkpoint! Kalau jatuh, kalian kembali ke sini.', 3.5);
        this.emit('checkpoint', { x: cp.x, y: 560 });
        break;
      }
    }
  }

  updateSigns(dt) {
    for (const sign of this.signs) {
      if (sign.cooldown > 0) continue;
      for (const player of this.players) {
        if (
          Math.abs(player.cx - sign.x) < 150 &&
          Math.abs(player.y + player.h - sign.y) < 110
        ) {
          this.showHint(sign.text, 5.5);
          sign.cooldown = 8;
          break;
        }
      }
    }
  }

  updateFans(dt) {
    for (const fan of this.fans) {
      fan.spin += dt * 9.5 * (fan.active ? 1 : 0);
      fan.windPhase += dt;
    }
  }

  applyEnvironment(player, dt) {
    player.inWind = false;
    for (const fan of this.fans) {
      if (!fan.active) continue;
      if (!rectsOverlap(player.rect, fan.zone)) continue;
      player.inWind = true;
      player.windTime = 0.2;
      player.vx += fan.dir * fan.force * dt;
      player.vx = clamp(player.vx, -470, 470);
      if (Math.random() < dt * 18) {
        this.emit('wind', { x: fan.x - 10, y: rand(fan.zone.y, fan.zone.y + fan.zone.h), dir: fan.dir });
      }
    }
  }

  tryPushBox(box, dx, player) {
    if (!box || box.kind !== 'box') return false;
    // Player.onGround is cleared just before moveX runs; coyote time still
    // tells us the cat was standing when it started pushing.
    if (player.coyote <= 0 && !player.onGround) return false;
    if (Math.abs(dx) < 0.01) return false;
    const moved = box.tryMoveTo(box.x + dx, this);
    if (moved) {
      box.vx = dx > 0 ? 210 : -210;
      box.squish = 0.25;
      return true;
    }
    return false;
  }

  respawnPlayer(player) {
    const cp = this.checkpoints[this.checkpointIndex];
    const spawnIndex = Math.min(player.index, cp.spawn.length - 1);
    const spawn = cp.spawn[spawnIndex] || player.spawn;
    this.emit('splash', {
      x: player.cx,
      y: Math.min(this.waterY, player.y + player.h),
      big: true
    });
    player.respawn(spawn, { keepKey: true });
    this.emit('respawn', { player: player.index });
    this.shake = Math.max(this.shake, 0.4);
    this.showHint('Ciprat! Kembali ke checkpoint terakhir.', 2.6);
  }

  meow(playerIndex) {
    const player = this.players[playerIndex];
    if (!player) return;
    player.meowTime = 1.4;
    this.emit('meow', { x: player.cx, y: player.y - 10, player: playerIndex });
  }

  get stats() {
    return {
      time: this.time,
      score: this.score,
      coins: this.coinsCollected,
      totalCoins: this.coins.length,
      sardines: this.sardinesCollected,
      totalSardines: this.sardines.length
    };
  }
}
