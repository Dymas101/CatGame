// Pushable wooden crate.
import { PHYS, BOX_SIZE } from './config.js';
import { approach, clamp } from './utils.js';

export class Box {
  constructor(x, y) {
    this.w = BOX_SIZE;
    this.h = BOX_SIZE;
    this.x = x;
    this.y = y;
    this.spawn = { x, y };
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.rider = null;
    this.dx = 0;
    this.dy = 0;
    this.squish = 0;
    this.kind = 'box';
    this.solid = true;
    this.type = 'wood';
    this.rotation = 0;
  }

  get cx() {
    return this.x + this.w / 2;
  }

  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.rider = null;
  }

  update(dt, world) {
    this.dx = 0;
    this.dy = 0;
    this.onGround = false;
    if (this.rider) {
      if (this.rider.dx) this.x += this.rider.dx;
      if (this.rider.dy) this.y += this.rider.dy;
      if (this.y + this.h < this.rider.y - 10) this.rider = null;
    }

    this.vx = approach(this.vx, 0, 950 * dt);
    this.vy = Math.min(this.vy + PHYS.gravity * dt, PHYS.maxFall);
    this.squish = Math.max(0, this.squish - dt * 5);

    const dx = this.vx * dt;
    if (dx !== 0) this.moveX(dx, world);
    const dy = this.vy * dt;
    if (dy !== 0) this.moveY(dy, world);

    if (this.y > world.waterY + 80) {
      this.reset();
      world.emit('splash', { x: this.cx, y: world.waterY, color: '#b97a4b' });
    }
    this.x = clamp(this.x, world.bounds.minX, world.bounds.maxX - this.w);
  }

  tryMoveTo(x, world) {
    const oldX = this.x;
    this.x = x;
    for (const solid of world.staticSolids) {
      if (!solid.solid) continue;
      if (this.overlaps(solid)) {
        this.x = oldX;
        return false;
      }
    }
    for (const other of world.boxes) {
      if (other === this) continue;
      if (this.overlaps(other)) {
        this.x = oldX;
        return false;
      }
    }
    return true;
  }

  moveX(dx, world) {
    this.x += dx;
    for (const solid of world.staticSolids) {
      if (!solid.solid) continue;
      if (this.overlaps(solid)) {
        if (dx > 0) this.x = solid.x - this.w;
        else if (dx < 0) this.x = solid.x + solid.w;
        this.vx = 0;
      }
    }
    for (const other of world.boxes) {
      if (other === this) continue;
      if (this.overlaps(other)) {
        if (dx > 0) this.x = other.x - this.w;
        else if (dx < 0) this.x = other.x + other.w;
        this.vx = 0;
      }
    }
  }

  moveY(dy, world) {
    this.y += dy;
    for (const solid of world.staticSolids) {
      if (!solid.solid) continue;
      if (this.overlaps(solid)) {
        if (dy > 0) {
          this.y = solid.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.rider = solid;
        } else if (dy < 0) {
          this.y = solid.y + solid.h;
          this.vy = 0;
        }
      }
    }
    for (const player of world.players) {
      if (this.overlaps(player)) {
        if (dy > 0) this.y = player.y - this.h;
        else this.y = player.y + player.h;
        this.vy = 0;
      }
    }
  }

  overlaps(rect) {
    return (
      this.x < rect.x + rect.w &&
      this.x + this.w > rect.x &&
      this.y < rect.y + rect.h &&
      this.y + this.h > rect.y
    );
  }
}
