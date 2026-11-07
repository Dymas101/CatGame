// Pure platformer character physics. No DOM, no rendering.
import { PHYS, PLAYER_SIZE } from './config.js';
import { approach, clamp, rand } from './utils.js';

export class Player {
  constructor(index, spawn) {
    this.index = index;
    this.slot = index + 1;
    this.w = PLAYER_SIZE.w;
    this.h = PLAYER_SIZE.h;
    this.spawn = { x: spawn.x, y: spawn.y };
    this.reset(spawn);
  }

  reset(spawn) {
    const point = spawn || this.spawn;
    this.x = point.x;
    this.y = point.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.facing = 1;
    this.rider = null;
    this.groundType = 'grass';
    this.carryingKey = false;
    this.invuln = 0;
    this.animTime = rand(0, 4);
    this.stepTimer = 0;
    this.landSquash = 0;
    this.landTimer = 0;
    this.blinkTimer = rand(1.5, 4.5);
    this.blinking = 0;
    this.meowTime = 0;
    this.windTime = 0;
    this.frozen = false;
    this.justJumped = false;
    this.wasAirborne = false;
    this.lastSafe = { x: point.x, y: point.y };
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get bottom() {
    return this.y + this.h;
  }

  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  queueJump() {
    this.jumpBuffer = PHYS.buffer;
  }

  setSpawn(point) {
    this.spawn = { x: point.x, y: point.y };
  }

  respawn(point, { keepKey = true } = {}) {
    const key = this.carryingKey;
    this.reset(point || this.spawn);
    this.carryingKey = keepKey ? key : false;
    this.invuln = 1.1;
    this.landSquash = 0;
  }

  update(dt, input, world) {
    this.animTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.meowTime = Math.max(0, this.meowTime - dt);
    this.windTime = Math.max(0, this.windTime - dt);
    this.landSquash = Math.max(0, this.landSquash - dt * 5.5);
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.13;
      this.blinkTimer = rand(2.2, 6.5);
    }
    this.blinking = Math.max(0, this.blinking - dt);

    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.jumpPressed) this.jumpBuffer = PHYS.buffer;

    // Ride moving platforms / boxes from the previous frame.
    if (this.rider) {
      const solid = this.rider;
      if (solid.dx) this.x += solid.dx;
      if (solid.dy) this.y += solid.dy;
      if (solid.removed || this.y + this.h < solid.y - 8 || this.x + this.w < solid.x || this.x > solid.x + solid.w) {
        this.rider = null;
      }
    }

    if (this.onGround) {
      this.coyote = PHYS.coyote;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;

    const onIce = this.groundType === 'ice' && this.onGround;
    const friction = this.inWind ? 500 : onIce ? PHYS.iceFriction : PHYS.friction;
    const accel = onIce ? PHYS.iceAccel : this.onGround ? PHYS.groundAccel : PHYS.airAccel;

    if (dir !== 0) {
      this.vx = approach(this.vx, dir * PHYS.speed, accel * dt);
    } else if (this.onGround && !this.inWind) {
      this.vx = approach(this.vx, 0, friction * dt);
    } else if (this.onGround && this.inWind) {
      this.vx = approach(this.vx, 0, 420 * dt);
    } else if (!this.onGround) {
      this.vx = approach(this.vx, 0, 120 * dt);
    }

    // Jumping: coyote time + buffered input + variable height.
    this.justJumped = false;
    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = PHYS.jump;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.rider = null;
      this.justJumped = true;
      this.landSquash = -0.55;
      world.emit('jump', { x: this.cx, y: this.bottom, player: this.index });
    }

    if (this.vy < 0 && !input.jump) {
      this.vy += PHYS.gravity * (PHYS.jumpCut - 1) * dt;
    }
    this.vy += PHYS.gravity * dt;
    this.vy = Math.min(this.vy, PHYS.maxFall);

    // Environmental forces (fans) are applied by the world before integration.
    world.applyEnvironment(this, dt);

    const wasOnGround = this.onGround;
    const fallSpeed = this.vy;
    this.onGround = false;
    this.groundType = 'air';
    const previousRider = this.rider;
    this.rider = null;

    this.rideAlong(previousRider);

    const dx = this.vx * dt;
    if (dx !== 0) this.moveX(dx, world);
    const dy = this.vy * dt;
    this.moveY(dy, world, wasOnGround, fallSpeed);

    this.x = clamp(this.x, world.bounds.minX, world.bounds.maxX - this.w);

    if (this.y + this.h > world.waterY + 40) {
      world.respawnPlayer(this);
      return;
    }

    if (this.onGround && Math.abs(this.vx) > 120) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.17;
        world.emit('step', { x: this.cx - this.facing * 14, y: this.bottom, type: this.groundType, vx: this.vx });
      }
    } else {
      this.stepTimer = 0;
    }

    this.wasAirborne = !this.onGround && this.vy > 0;
    this.lastSafe = { x: this.x, y: this.y };
  }

  rideAlong(solid) {
    if (!solid) return;
  }

  moveX(dx, world) {
    this.x += dx;
    const solids = world.collisionSolids;
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (!solid.solid) continue;
      if (!this.overlaps(solid)) continue;

      if (solid.kind === 'box' && world.tryPushBox(solid, dx, this)) {
        continue;
      }

      if (dx > 0) {
        this.x = solid.x - this.w;
      } else if (dx < 0) {
        this.x = solid.x + solid.w;
      }
      this.vx = 0;
    }
  }

  moveY(dy, world, wasOnGround, fallSpeed) {
    this.y += dy;
    const solids = world.collisionSolids;
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (!solid.solid) continue;
      if (!this.overlaps(solid)) continue;

      if (dy >= 0 && this.vy >= 0) {
        this.y = solid.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.rider = solid;
        this.groundType = solid.type || 'stone';
        if (!wasOnGround && fallSpeed > 260) {
          this.landSquash = Math.min(1, fallSpeed / 900);
          this.landTimer = 0.22;
          world.emit('land', { x: this.cx, y: this.bottom, player: this.index, speed: fallSpeed });
        }
      } else if (dy < 0) {
        this.y = solid.y + solid.h;
        this.vy = 0;
      }
    }
  }

  overlaps(solid) {
    return (
      this.x < solid.x + solid.w &&
      this.x + this.w > solid.x &&
      this.y < solid.y + solid.h &&
      this.y + this.h > solid.y
    );
  }
}
