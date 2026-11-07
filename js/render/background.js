// Parallax sky, sun, hills and weather. Drawn in screen space (no camera transform).
import { VIEW_W, VIEW_H } from '../config.js';
import { clamp, hash2, lerp, smoothstep } from '../utils.js';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(lerp(ca.r, cb.r, t));
  const g = Math.round(lerp(ca.g, cb.g, t));
  const bl = Math.round(lerp(ca.b, cb.b, t));
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const CLOUDS = Array.from({ length: 15 }, (_, i) => ({
  x: i * 560 + ((i * 173) % 380),
  y: 70 + ((i * 89) % 170),
  s: 0.65 + ((i * 53) % 60) / 100,
  a: 0.55 + ((i * 29) % 35) / 100
}));

const BIRDS = Array.from({ length: 6 }, (_, i) => ({
  x: i * 380 + (i * 97) % 250,
  y: 120 + ((i * 61) % 150),
  s: 0.7 + ((i * 31) % 50) / 100,
  speed: 12 + ((i * 17) % 20)
}));

function drawSun(ctx, time, offsetX, low = false) {
  const x = 1015 + offsetX;
  const y = 122;
  ctx.save();
  ctx.translate(x, y);

  const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, low ? 100 : 150);
  glow.addColorStop(0, 'rgba(255,236,160,0.55)');
  glow.addColorStop(0.55, 'rgba(255,224,138,0.18)');
  glow.addColorStop(1, 'rgba(255,224,138,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, low ? 100 : 150, 0, Math.PI * 2);
  ctx.fill();

  if (!low) {
    ctx.rotate(Math.sin(time * 0.12) * 0.06);
    ctx.strokeStyle = 'rgba(255,236,160,0.55)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + time * 0.04;
      const r1 = 46;
      const r2 = 60 + Math.sin(time * 0.7 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
  }

  const body = ctx.createRadialGradient(-8, -10, 6, 0, 0, 40);
  body.addColorStop(0, '#fff6c8');
  body.addColorStop(0.7, '#ffe08a');
  body.addColorStop(1, '#ffca5f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, 39, 0, Math.PI * 2);
  ctx.fill();

  // Sleepy happy face.
  ctx.strokeStyle = '#b97a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-13, -2, 6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(13, -2, 6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 4, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,150,120,0.5)';
  ctx.beginPath();
  ctx.arc(-21, 8, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(21, 8, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCloud(ctx, x, y, scale, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(-38, 6, 20, 0, Math.PI * 2);
  ctx.arc(-10, -8, 28, 0, Math.PI * 2);
  ctx.arc(26, 0, 22, 0, Math.PI * 2);
  ctx.arc(48, 10, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-54, 4, 108, 20, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(180,225,245,0.45)';
  ctx.beginPath();
  ctx.roundRect(-52, 17, 104, 8, 4);
  ctx.fill();
  ctx.restore();
}

function drawMountains(ctx, camera, time, low = false) {
  const par = 0.055;
  const span = 900;
  const baseY = 430 - (camera.y - 560) * 0.05;
  ctx.save();
  for (let layer = 0; layer < (low ? 1 : 2); layer++) {
    const offset = layer * 240;
    const color = layer === 0 ? '#c3e6ea' : '#a9d6df';
    const shift = -camera.x * par * (1 + layer * 0.25);
    const width = 260 + layer * 60;
    const height = 190 + layer * 70;
    for (let i = -2; i < 9; i++) {
      let x = ((i * 300 + shift + offset) % (span * 3) + span * 3) % (span * 3) - 500;
      if (x < -500 || x > VIEW_W + 500) continue;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - width, baseY);
      ctx.lineTo(x - width * 0.32, baseY - height * 0.8);
      ctx.lineTo(x, baseY - height);
      ctx.lineTo(x + width * 0.36, baseY - height * 0.72);
      ctx.lineTo(x + width, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.beginPath();
      ctx.moveTo(x, baseY - height);
      ctx.lineTo(x + width * 0.12, baseY - height * 0.76);
      ctx.lineTo(x + width * 0.02, baseY - height * 0.78);
      ctx.lineTo(x - width * 0.06, baseY - height * 0.7);
      ctx.lineTo(x - width * 0.12, baseY - height * 0.76);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHills(ctx, camera, time, low = false) {
  const layers = [
    { par: 0.11, y: 570, rx: 460, ry: 300, color: '#bce9b0', step: 520 },
    { par: 0.2, y: 610, rx: 380, ry: 250, color: '#94dc92', step: 430 },
    { par: 0.32, y: 650, rx: 300, ry: 210, color: '#72c982', step: 360 }
  ].slice(0, low ? 2 : 3);
  const yShift = -(camera.y - 560) * 0.08;
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const shift = -camera.x * layer.par;
    ctx.fillStyle = layer.color;
    for (let i = -1; i < 7; i++) {
      let x = ((i * layer.step + shift) % (layer.step * 7) + layer.step * 7) % (layer.step * 7) - 200;
      if (x < -400 || x > VIEW_W + 400) continue;
      ctx.beginPath();
      ctx.ellipse(x, layer.y + yShift, layer.rx, layer.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tree silhouettes on the nearest hill.
  if (!low) {
    const par = 0.3;
    const shift = -camera.x * par;
    for (let i = -1; i < 14; i++) {
      let x = ((i * 230 + shift) % 3220 + 3220) % 3220 - 220;
      if (x < -80 || x > VIEW_W + 80) continue;
      const seed = Math.abs(Math.floor((i * 230 + shift) / 3220));
      const scale = 0.6 + hash2(seed, i) * 0.45;
      const base = 604 + yShift;
      ctx.save();
      ctx.translate(x, base);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#5b9f5c';
      ctx.beginPath();
      ctx.roundRect(-4, -40, 8, 42, 3);
      ctx.fill();
      ctx.fillStyle = '#4d9a55';
      ctx.beginPath();
      ctx.arc(0, -52, 26, 0, Math.PI * 2);
      ctx.arc(-18, -40, 18, 0, Math.PI * 2);
      ctx.arc(18, -40, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(-7, -60, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawWeather(ctx, camera, time) {
  const ice = smoothstep(4850, 5350, camera.x) * (1 - smoothstep(6550, 6900, camera.x));
  const warm = smoothstep(7000, 7600, camera.x);

  if (ice > 0.02) {
    ctx.save();
    ctx.globalAlpha = ice * 0.8;
    for (let i = 0; i < 55; i++) {
      const seedX = hash2(i, 7);
      const seedY = hash2(i, 13);
      const speed = 18 + seedX * 34;
      const x = ((seedX * 1400 - camera.x * 0.35 + time * (8 + seedY * 14)) % 1400 + 1400) % 1400 - 60;
      const y = ((seedY * 800 + time * speed) % 800);
      const size = 1.4 + seedX * 2.4;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (warm > 0.2) {
    ctx.save();
    ctx.globalAlpha = warm * 0.7;
    for (let i = 0; i < 18; i++) {
      const seed = hash2(i, 3);
      const x = ((seed * 1500 - camera.x * 0.5 + time * 12) % 1500 + 1500) % 1500 - 100;
      const y = 380 + Math.sin(time * 0.8 + i) * 40 + seed * 160;
      ctx.fillStyle = 'rgba(255,232,140,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + seed * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawBackground(ctx, camera, level, time, low = false) {
  const ice = smoothstep(4850, 5350, camera.x) * (1 - smoothstep(6550, 6900, camera.x));
  const warm = smoothstep(7100, 7700, camera.x);

  const top = mixHex(mixHex('#74ccf2', '#8fd8f7', ice), '#79c9ee', warm * 0.4);
  const mid = mixHex(mixHex('#c8efff', '#dcf6ff', ice), '#ffe3bd', warm * 0.45);
  const bottom = mixHex(mixHex('#fff0c2', '#f4fbff', ice), '#ffd9a6', warm * 0.4);

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, top);
  sky.addColorStop(0.55, mid);
  sky.addColorStop(1, bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawSun(ctx, time, -camera.x * 0.02, low);

  let cloudIndex = 0;
  for (const cloud of CLOUDS) {
    cloudIndex += 1;
    if (low && cloudIndex % 2 === 0) continue;
    const span = VIEW_W + 900;
    const base = cloud.x - camera.x * 0.16;
    const x = ((base % span) + span) % span - 450;
    const y = cloud.y - (camera.y - 560) * 0.06 + Math.sin(time * 0.2 + cloud.x) * 3;
    drawCloud(ctx, x, y, cloud.s, cloud.a);
  }

  drawMountains(ctx, camera, time, low);
  drawHills(ctx, camera, time, low);

  if (!low) {
    // Fluffy mid-ground treetops peeking above the ground line.
    ctx.save();
    const shift = -camera.x * 0.42;
    for (let i = -1; i < 9; i++) {
      let x = ((i * 340 + shift) % 3060 + 3060) % 3060 - 300;
      if (x < -160 || x > VIEW_W + 160) continue;
      const y = 600 - (camera.y - 560) * 0.1;
      ctx.fillStyle = '#4f9f58';
      ctx.beginPath();
      ctx.arc(x, y - 8, 46, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#66b968';
      ctx.beginPath();
      ctx.arc(x - 16, y - 20, 26, Math.PI, Math.PI * 2);
      ctx.arc(x + 20, y - 16, 22, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Birds.
    ctx.save();
    ctx.strokeStyle = 'rgba(80,110,120,0.45)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const bird of BIRDS) {
      const x = ((bird.x - camera.x * 0.12 + time * bird.speed) % (VIEW_W + 300) + VIEW_W + 300) % (VIEW_W + 300) - 150;
      const y = bird.y - (camera.y - 560) * 0.05 + Math.sin(time * 2 + bird.x) * 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(bird.s, bird.s);
      const flap = Math.sin(time * 6 + bird.x) * 3;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-4, -5 + flap, 0, 0);
      ctx.quadraticCurveTo(4, -5 + flap, 10, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    drawWeather(ctx, camera, time);
  }

  if (!low) {
    // Warm haze near the horizon.
    const haze = ctx.createLinearGradient(0, VIEW_H * 0.45, 0, VIEW_H);
    haze.addColorStop(0, 'rgba(255,240,200,0)');
    haze.addColorStop(1, ice > 0.4 ? 'rgba(210,245,255,0.32)' : 'rgba(255,238,190,0.28)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

export function drawVignette(ctx) {
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.46, VIEW_H * 0.36, VIEW_W / 2, VIEW_H * 0.5, VIEW_W * 0.72);
  v.addColorStop(0, 'rgba(10,20,30,0)');
  v.addColorStop(1, 'rgba(10,20,30,0.3)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export { clamp };
