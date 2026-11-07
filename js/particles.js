// Lightweight world-space particle + floating text system.
import { rand, randInt } from './utils.js';

const CONFETTI_COLORS = ['#ffcf5c', '#ff7a7a', '#7ee0a3', '#7cc8ff', '#f9a8d4', '#fff3b0'];

function starPath(ctx, r, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * inner;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function heartPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.7);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.2, -r * 0.7, -r * 1.1, 0, -r * 0.4);
  ctx.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.2, 0, r * 0.7);
  ctx.closePath();
}

export class ParticleSystem {
  constructor() {
    this.items = [];
    this.floaters = [];
  }

  clear() {
    this.items.length = 0;
    this.floaters.length = 0;
  }

  add(item) {
    if (this.items.length > 420) this.items.shift();
    this.items.push(item);
  }

  float(text, x, y, color = '#fff7e6', size = 22, life = 1.1) {
    this.floaters.push({ text, x, y, color, size, life, maxLife: life, vy: -42 });
  }

  dust(x, y, color = '#e8d8b8', count = 4) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'dust',
        x: x + rand(-10, 10),
        y: y - rand(0, 6),
        vx: rand(-45, 45),
        vy: rand(-70, -20),
        g: 60,
        life: rand(0.35, 0.65),
        maxLife: 0.65,
        size: rand(4, 9),
        color
      });
    }
  }

  sparks(x, y, color = '#ffcf5c', count = 10, spread = 190) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(60, spread);
      this.add({
        type: 'star',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        g: 420,
        life: rand(0.4, 0.9),
        maxLife: 0.9,
        size: rand(3, 7),
        color,
        rot: rand(0, 6.28),
        vr: rand(-8, 8)
      });
    }
  }

  confetti(x, y, count = 40) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'confetti',
        x: x + rand(-30, 30),
        y: y + rand(-10, 10),
        vx: rand(-260, 260),
        vy: rand(-520, -180),
        g: 620,
        life: rand(1.2, 2.3),
        maxLife: 2.3,
        size: rand(5, 10),
        color: CONFETTI_COLORS[randInt(0, CONFETTI_COLORS.length - 1)],
        rot: rand(0, 6.28),
        vr: rand(-12, 12),
        flutter: rand(2, 6)
      });
    }
  }

  splash(x, y, big = false) {
    const count = big ? 22 : 10;
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'drop',
        x: x + rand(-22, 22),
        y,
        vx: rand(-170, 170),
        vy: rand(-420, -120),
        g: 950,
        life: rand(0.5, 0.95),
        maxLife: 0.95,
        size: rand(3, 7),
        color: i % 3 === 0 ? '#d9f6ff' : '#7fd4f2'
      });
    }
    this.add({
      type: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      g: 0,
      life: 0.55,
      maxLife: 0.55,
      size: 18,
      grow: big ? 120 : 70,
      color: '#d9f6ff'
    });
  }

  wind(x, y, dir) {
    this.add({
      type: 'wind',
      x,
      y,
      vx: dir * rand(380, 620),
      vy: rand(-18, 18),
      g: 0,
      life: rand(0.25, 0.55),
      maxLife: 0.55,
      size: rand(26, 70),
      color: 'rgba(220,245,255,0.75)'
    });
  }

  sparkle(x, y, color = '#fff3b0') {
    this.add({
      type: 'twinkle',
      x,
      y,
      vx: rand(-12, 12),
      vy: rand(-30, -8),
      g: 0,
      life: rand(0.6, 1.2),
      maxLife: 1.2,
      size: rand(3, 6),
      color
    });
  }

  hearts(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'heart',
        x: x + rand(-18, 18),
        y: y + rand(-8, 8),
        vx: rand(-30, 30),
        vy: rand(-90, -40),
        g: 0,
        life: rand(0.7, 1.2),
        maxLife: 1.2,
        size: rand(6, 11),
        color: '#ff8fa3'
      });
    }
  }

  meow(x, y) {
    this.float('Meong!', x, y - 34, '#fff7e6', 24, 1.2);
    this.add({
      type: 'note',
      x: x + 18,
      y: y - 22,
      vx: rand(20, 50),
      vy: -60,
      g: 0,
      life: 1.1,
      maxLife: 1.1,
      size: 16,
      color: '#ffe08a'
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
      if (p.type === 'confetti') p.x += Math.sin(p.life * (p.flutter || 4)) * 26 * dt;
      if (p.type === 'wind') p.size += 120 * dt;
      if (p.type === 'ring') p.size += (p.grow || 60) * dt;
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  draw(ctx, low = false) {
    for (const p of this.items) {
      if (low && (p.type === 'dust' || p.type === 'wind' || p.type === 'twinkle' || p.type === 'note')) continue;
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      if (p.type === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.2 - alpha * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star' || p.type === 'twinkle') {
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        starPath(ctx, p.size);
        ctx.fill();
      } else if (p.type === 'confetti') {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.type === 'drop') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.7, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'wind') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.quadraticCurveTo(-p.size * 0.4, -4, 0, 0);
        ctx.stroke();
      } else if (p.type === 'heart') {
        ctx.fillStyle = p.color;
        heartPath(ctx, p.size);
        ctx.fill();
      } else if (p.type === 'note') {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px 'Baloo 2', sans-serif`;
        ctx.fillText('♪', 0, 0);
      }
      ctx.restore();
    }

    for (const f of this.floaters) {
      const alpha = Math.min(1, f.life / (f.maxLife * 0.45));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${f.size}px 'Baloo 2', 'Nunito', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(58,36,22,0.55)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
}
