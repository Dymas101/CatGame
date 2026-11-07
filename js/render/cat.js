// Cute round-cat renderer. Pure canvas drawing, no assets needed.
import { PLAYERS, PHYS } from '../config.js';
import { clamp } from '../utils.js';

export function drawCat(ctx, p, index, time) {
  const info = PLAYERS[index];
  const dir = p.facing >= 0 ? 1 : -1;
  const speedRatio = clamp(Math.abs(p.vx) / PHYS.speed, 0, 1);
  const run = p.onGround ? speedRatio : 0;
  const phase = p.animTime * (7 + run * 13);
  const bob = p.onGround ? Math.abs(Math.sin(phase)) * 2.1 * run : 0;
  const squash = p.landSquash;
  const stretch = p.vy < -250 ? 0.07 : 0;
  const sx = 1 + squash * 0.18 - stretch * 0.55;
  const sy = 1 - squash * 0.22 + stretch;
  const blink = p.blinking > 0;
  const meow = p.meowTime > 0.65;
  const air = !p.onGround;
  const tailWave = Math.sin(time * 4 + index * 1.7) * 5 + (air ? 8 : 0);

  ctx.save();
  ctx.translate(p.cx, p.bottom - bob);
  ctx.scale(dir * sx, sy);
  if (p.invuln > 0 && Math.floor(time * 20) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }

  // Soft inner glow (helps cats pop against grass).
  const glow = ctx.createRadialGradient(0, -28, 8, 0, -28, 42);
  glow.addColorStop(0, 'rgba(255,255,255,0.20)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, -28, 36, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail (behind everything).
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, -18);
  ctx.bezierCurveTo(-38, -16, -44, -34 + tailWave, -33, -49 + tailWave);
  ctx.stroke();
  ctx.strokeStyle = info.fur;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  if (index === 1) {
    ctx.strokeStyle = info.stripe;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-38, -27 + tailWave * 0.5);
    ctx.lineTo(-31, -25 + tailWave * 0.5);
    ctx.moveTo(-41, -35 + tailWave * 0.7);
    ctx.lineTo(-34, -34 + tailWave * 0.7);
    ctx.stroke();
  }

  // Ears.
  const earY = air ? -1 : 0;
  ctx.fillStyle = info.fur;
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-24, -39 + earY);
  ctx.quadraticCurveTo(-18, -57 + earY, -9, -50 + earY);
  ctx.quadraticCurveTo(-5, -46, -6, -36 + earY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, -39 + earY);
  ctx.quadraticCurveTo(18, -57 + earY, 9, -50 + earY);
  ctx.quadraticCurveTo(5, -46, 6, -36 + earY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = info.inner;
  ctx.beginPath();
  ctx.moveTo(-20, -41 + earY);
  ctx.quadraticCurveTo(-17, -52 + earY, -11, -47 + earY);
  ctx.quadraticCurveTo(-9, -44, -10, -38 + earY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, -41 + earY);
  ctx.quadraticCurveTo(17, -52 + earY, 11, -47 + earY);
  ctx.quadraticCurveTo(9, -44, 10, -38 + earY);
  ctx.closePath();
  ctx.fill();

  // Body.
  const bodyGrad = ctx.createLinearGradient(0, -56, 0, 2);
  bodyGrad.addColorStop(0, info.furLight);
  bodyGrad.addColorStop(0.55, info.fur);
  bodyGrad.addColorStop(1, info.furDark);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(0, -27, 27, 25.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belly.
  ctx.fillStyle = info.belly;
  ctx.globalAlpha *= 0.95;
  ctx.beginPath();
  ctx.ellipse(0, -16, 16.5, 13.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.95;

  // Head stripes.
  ctx.strokeStyle = info.stripe;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, -49);
  ctx.lineTo(-7, -44);
  ctx.moveTo(0, -51);
  ctx.lineTo(0, -45);
  ctx.moveTo(7, -49);
  ctx.lineTo(7, -44);
  ctx.stroke();

  if (index === 1) {
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-25, -26);
    ctx.quadraticCurveTo(-20, -23, -21, -18);
    ctx.moveTo(-27, -18);
    ctx.quadraticCurveTo(-22, -16, -22, -11);
    ctx.stroke();
  }

  // Paws.
  const footSwing = Math.sin(phase) * (run > 0.05 ? 3.4 * run : 0);
  ctx.fillStyle = info.belly;
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(-13, -3 - Math.max(0, footSwing), 7, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(13, -3 - Math.max(0, -footSwing), 7, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Face.
  const eyeY = -31;
  ctx.fillStyle = '#2b170c';
  if (blink || meow) {
    ctx.strokeStyle = '#2b170c';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-9.5, eyeY, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9.5, eyeY, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    const look = p.facing * 1.3;
    const lookY = clamp(p.vy / 700, -1.2, 1.2);
    ctx.beginPath();
    ctx.ellipse(-9.5, eyeY, 4.3, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9.5, eyeY, 4.3, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-10.9 + look * 0.25, eyeY - 1.8 + lookY * 0.3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8.1 + look * 0.25, eyeY - 1.8 + lookY * 0.3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blush.
  ctx.fillStyle = info.blush;
  ctx.globalAlpha *= 0.75;
  ctx.beginPath();
  ctx.ellipse(-18.5, -22, 5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(18.5, -22, 5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.75;

  // Muzzle / nose / mouth.
  ctx.fillStyle = info.belly;
  ctx.globalAlpha *= 0.75;
  ctx.beginPath();
  ctx.ellipse(0, -21, 9.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.75;

  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(-3, -23);
  ctx.lineTo(3, -23);
  ctx.lineTo(0, -20);
  ctx.closePath();
  ctx.fill();

  if (meow || (air && p.vy < -80)) {
    ctx.fillStyle = '#5b2b22';
    ctx.beginPath();
    ctx.ellipse(0, -15.5, 4, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath();
    ctx.ellipse(0, -13, 2.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#5b2b22';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(0, -20.5);
    ctx.lineTo(0, -18.5);
    ctx.moveTo(0, -18.5);
    ctx.quadraticCurveTo(-3, -16.5, -5, -18.5);
    ctx.moveTo(0, -18.5);
    ctx.quadraticCurveTo(3, -16.5, 5, -18.5);
    ctx.stroke();
  }

  // Whiskers.
  ctx.strokeStyle = 'rgba(58,36,22,0.55)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-12, -21);
  ctx.lineTo(-24, -23);
  ctx.moveTo(-12, -18);
  ctx.lineTo(-23, -16);
  ctx.moveTo(12, -21);
  ctx.lineTo(24, -23);
  ctx.moveTo(12, -18);
  ctx.lineTo(23, -16);
  ctx.stroke();

  // Accessories: leaf for the orange cat, bow for the grey cat.
  if (index === 0) {
    ctx.strokeStyle = '#2f7a3a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(1, -51);
    ctx.quadraticCurveTo(2, -59, 7, -61);
    ctx.stroke();
    ctx.fillStyle = '#7ed36a';
    ctx.beginPath();
    ctx.ellipse(8, -62, 5.5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5bbf52';
    ctx.beginPath();
    ctx.ellipse(-3, -60, 4.5, 2.6, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#7cc8ff';
    ctx.strokeStyle = '#2b6f9e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-24, -49);
    ctx.lineTo(-31, -54);
    ctx.lineTo(-30, -45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-24, -49);
    ctx.lineTo(-17, -54);
    ctx.lineTo(-18, -45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(-24, -49, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawCatShadow(ctx, p) {
  ctx.save();
  ctx.fillStyle = 'rgba(58,36,22,0.16)';
  ctx.beginPath();
  ctx.ellipse(p.cx, p.bottom + 2.5, 25, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawKey(ctx, x, y, size = 1, angle = 0, glow = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);

  if (glow) {
    const g = ctx.createRadialGradient(0, -4, 2, 0, -4, 34);
    g.addColorStop(0, 'rgba(255,224,120,0.55)');
    g.addColorStop(1, 'rgba(255,224,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -4, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Dark outline pass.
  ctx.strokeStyle = '#7a4c0a';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, -19, 9, 0, Math.PI * 2);
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 20);
  ctx.moveTo(0, 20);
  ctx.lineTo(10, 20);
  ctx.moveTo(0, 13);
  ctx.lineTo(7, 13);
  ctx.stroke();

  // Gold body.
  ctx.strokeStyle = '#ffd35c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -19, 9, 0, Math.PI * 2);
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 20);
  ctx.moveTo(0, 20);
  ctx.lineTo(10, 20);
  ctx.moveTo(0, 13);
  ctx.lineTo(7, 13);
  ctx.stroke();

  ctx.strokeStyle = '#fff3b0';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -19, 5.5, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();

  // Sparkle.
  ctx.fillStyle = '#fffbe6';
  ctx.beginPath();
  ctx.arc(11, -25, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
