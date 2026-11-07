// Pure camera follow with automatic zoom-out so both cats stay on screen.
import { VIEW_W, VIEW_H } from './config.js';
import { clamp, damp } from './utils.js';

export class Camera {
  constructor(world) {
    this.world = world;
    this.x = 240;
    this.y = 360;
    this.zoom = 1;
    this.targetX = this.x;
    this.targetY = this.y;
    this.targetZoom = this.zoom;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.time = 0;
  }

  resize() {
    // Nothing to recompute: fixed virtual resolution.
  }

  update(dt, players, level) {
    this.time += dt;
    const p1 = players[0];
    const p2 = players[1];
    const midX = (p1.cx + p2.cx) / 2;
    const midY = (p1.y + p2.bottom) / 2;

    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x + p1.w, p2.x + p2.w);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.bottom, p2.bottom);

    const spanX = maxX - minX + 520;
    const spanY = maxY - minY + 380;
    let zoom = Math.min(1.14, VIEW_W / spanX, VIEW_H / spanY);
    zoom = clamp(zoom, 0.58, 1.14);

    // Keep a little more air below than above when zoomed out.
    this.targetZoom = zoom;
    this.targetX = midX;
    this.targetY = midY - 12;

    this.zoom = damp(this.zoom, this.targetZoom, 4.2, dt);
    this.x = damp(this.x, this.targetX, 5.2, dt);
    this.y = damp(this.y, this.targetY, 4.4, dt);

    const halfW = VIEW_W / (2 * this.zoom);
    const halfH = VIEW_H / (2 * this.zoom);
    const bounds = level.bounds;
    const worldW = level.width;
    const loX = bounds.minX + halfW;
    const hiX = worldW + 40 - halfW;
    if (loX < hiX) this.x = clamp(this.x, loX, hiX);
    else this.x = (bounds.minX + worldW) / 2;

    const loY = 160 + halfH;
    const hiY = 1080 - halfH;
    if (loY < hiY) this.y = clamp(this.y, loY, hiY);
    else this.y = (160 + 1080) / 2;

    const shake = Math.max(level.shake, this.shake);
    this.shake = Math.max(0, this.shake - dt * 2);
    const amount = shake * 18;
    this.shakeX = (Math.random() * 2 - 1) * amount;
    this.shakeY = (Math.random() * 2 - 1) * amount;
  }

  kick(amount = 0.4) {
    this.shake = Math.max(this.shake, amount);
  }

  apply(ctx) {
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.shakeX, -this.y + this.shakeY);
  }

  get view() {
    const w = VIEW_W / this.zoom;
    const h = VIEW_H / this.zoom;
    return {
      x: this.x - w / 2,
      y: this.y - h / 2,
      w,
      h
    };
  }
}
