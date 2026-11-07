// World renderer: platforms, mechanisms, props, pickups and cats.
import { PALETTE, PLAYERS } from '../config.js';
import { clamp, hash2, lerp } from '../utils.js';
import { drawCat, drawCatShadow, drawKey } from './cat.js';

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function visible(view, x, y, w, h, pad = 160) {
  return x + w > view.x - pad && x < view.x + view.w + pad && y + h > view.y - pad && y < view.y + view.h + pad;
}

/* ------------------------------------------------------------------ */
/* Platforms                                                           */
/* ------------------------------------------------------------------ */

function grassCap(ctx, x, y, w) {
  ctx.fillStyle = PALETTE.grassDark;
  rr(ctx, x, y, w, 30, 12);
  ctx.fill();

  ctx.fillStyle = PALETTE.grass;
  rr(ctx, x, y, w, 24, 11);
  ctx.fill();

  // Scalloped fringe.
  ctx.fillStyle = PALETTE.grass;
  for (let i = 0; i < w; i += 26) {
    const r = 8 + hash2(Math.floor(x + i), 2) * 6;
    ctx.beginPath();
    ctx.arc(x + i + 13, y + 22, r, 0, Math.PI);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 8, y + 3, w - 16, 4);

  // Blades.
  ctx.fillStyle = PALETTE.grassDark;
  for (let i = 14; i < w - 10; i += 58) {
    const h = 6 + hash2(Math.floor((x + i) * 3), 7) * 8;
    ctx.beginPath();
    ctx.moveTo(x + i, y + 2);
    ctx.lineTo(x + i + 3, y - h);
    ctx.lineTo(x + i + 6, y + 2);
    ctx.closePath();
    ctx.fill();
  }

  // Tiny flowers.
  for (let i = 70; i < w - 40; i += 190) {
    const seed = hash2(Math.floor((x + i) / 17), 11);
    if (seed < 0.35) continue;
    const fx = x + i;
    const fy = y - 1;
    ctx.strokeStyle = PALETTE.grassDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - 10);
    ctx.stroke();
    const colors = ['#fff3b0', '#ffb3c7', '#c9b6ff'];
    ctx.fillStyle = colors[Math.floor(seed * 3) % 3];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 3.2, fy - 11 + Math.sin(a) * 3.2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(fx, fy - 11, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrassPlatform(ctx, p, low = false) {
  const { x, y, w, h } = p;

  if (low) {
    ctx.fillStyle = PALETTE.dirt;
    rr(ctx, x, y + 8, w, h - 8, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.dirtDark;
    ctx.fillRect(x + 4, y + Math.min(240, Math.max(18, h)), w - 8, Math.max(0, h - 240));
    ctx.fillStyle = PALETTE.grass;
    rr(ctx, x, y, w, 32, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 8, y + 3, w - 16, 4);
    return;
  }

  const dirt = ctx.createLinearGradient(0, y, 0, y + Math.min(200, h));
  dirt.addColorStop(0, PALETTE.dirtLight);
  dirt.addColorStop(0.5, PALETTE.dirt);
  dirt.addColorStop(1, PALETTE.dirtDark);
  ctx.fillStyle = dirt;
  rr(ctx, x, y + 8, w, h - 8, 16);
  ctx.fill();
  if (h > 240) {
    ctx.fillStyle = PALETTE.dirtDark;
    ctx.fillRect(x + 4, y + 240, w - 8, h - 240);
  }

  // Soil strata only on thick ground blocks.
  if (h > 120) {
    ctx.strokeStyle = 'rgba(120,72,42,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const yy = y + 70 + i * 46;
      if (yy > y + h - 12) break;
      ctx.beginPath();
      ctx.moveTo(x + 18, yy);
      for (let xx = x + 18; xx < x + w - 18; xx += 60) {
        ctx.quadraticCurveTo(xx + 30, yy + (i % 2 ? 6 : -6), xx + 60, yy);
      }
      ctx.stroke();
    }
  }

  // Pebbles.
  if (h > 90) {
    for (let i = 0; i < Math.min(18, Math.floor(w / 90)); i++) {
      const seed = hash2(i, Math.floor(x));
      const px = x + 30 + seed * (w - 60);
      const py = y + 46 + hash2(i, 3) * Math.min(150, h - 60);
      ctx.fillStyle = 'rgba(255,225,190,0.28)';
      ctx.beginPath();
      ctx.ellipse(px, py, 5 + seed * 5, 3 + seed * 3, seed * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  grassCap(ctx, x, y, w);

  // Rounded side shading.
  const sideH = Math.max(0, Math.min(h - 30, 260));
  ctx.fillStyle = 'rgba(90,52,30,0.18)';
  ctx.fillRect(x, y + 30, 7, sideH);
  ctx.fillRect(x + w - 7, y + 30, 7, sideH);
}

function drawIcePlatform(ctx, p, low = false) {
  const { x, y, w, h } = p;

  if (low) {
    ctx.fillStyle = '#cfedf7';
    rr(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(ctx, x, y, w, 13, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,200,220,0.45)';
    ctx.fillRect(x + 3, y + 13, w - 6, 3);
    return;
  }

  const grad = ctx.createLinearGradient(0, y, 0, y + 180);
  grad.addColorStop(0, '#f4feff');
  grad.addColorStop(0.35, '#d9f5fc');
  grad.addColorStop(0.7, '#bfeaf5');
  grad.addColorStop(1, '#9cd9e8');
  ctx.fillStyle = grad;
  rr(ctx, x, y, w, h, 14);
  ctx.fill();

  // Frosted facets.
  for (let i = 0; i < w; i += 210) {
    if (i + 170 > w) continue;
    const seed = hash2(i, Math.floor(x));
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(x + i + 10, y + 28);
    ctx.lineTo(x + i + 110 + seed * 40, y + 54);
    ctx.lineTo(x + i + 150, y + 150);
    ctx.lineTo(x + i + 40, y + 128);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,190,215,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Thick snow cap with puffy mounds.
  ctx.fillStyle = '#ffffff';
  rr(ctx, x, y, w, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#f4fdff';
  for (let i = 0; i < w; i += 34) {
    const r = 6 + hash2(i, Math.floor(x)) * 7;
    ctx.beginPath();
    ctx.arc(x + i + 17, y + 9, r, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(150,220,245,0.6)';
  ctx.fillRect(x + 4, y + 15, w - 8, 3);

  // Chunky ice-block seams and frosty side rims.
  ctx.strokeStyle = 'rgba(80,180,210,0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < w; i += 260) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + 16);
    ctx.lineTo(x + i + 10, y + 80);
    ctx.lineTo(x + i - 4, y + 150);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y + 16, 7, 170);
  ctx.fillRect(x + w - 7, y + 16, 7, 170);

  // Frost bands and a glassy sheen.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 40; i < w; i += 150) {
    ctx.beginPath();
    ctx.ellipse(x + i, y + 44 + hash2(i, 4) * 40, 40, 11, -0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 3;
  for (let i = 40; i < w; i += 120) {
    const seed = hash2(i, Math.floor(x));
    ctx.beginPath();
    ctx.moveTo(x + i, y + 16);
    ctx.lineTo(x + i + 30 + seed * 30, y + 16 + 46 + seed * 30);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(60,150,200,0.4)';
  ctx.lineWidth = 2;
  for (let i = 90; i < w; i += 170) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + 60);
    ctx.lineTo(x + i + 24, y + 88);
    ctx.lineTo(x + i + 12, y + 120);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + 30, 34, 5, -0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawStonePlatform(ctx, p, low = false) {
  const { x, y, w, h } = p;
  if (low) {
    ctx.fillStyle = PALETTE.stone;
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.stoneLight;
    ctx.fillRect(x + 4, y + 2, w - 8, 5);
    return;
  }
  const grad = ctx.createLinearGradient(0, y, 0, y + 120);
  grad.addColorStop(0, PALETTE.stoneLight);
  grad.addColorStop(0.4, PALETTE.stone);
  grad.addColorStop(1, PALETTE.stoneDark);
  ctx.fillStyle = grad;
  rr(ctx, x, y, w, h, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(70,80,92,0.4)';
  ctx.lineWidth = 2;
  for (let yy = y + 34; yy < y + Math.min(h, 300); yy += 34) {
    ctx.beginPath();
    ctx.moveTo(x + 4, yy);
    ctx.lineTo(x + w - 4, yy);
    ctx.stroke();
    const offset = ((yy / 34) % 2) * 34;
    for (let xx = x + 30 + offset; xx < x + w - 10; xx += 68) {
      ctx.beginPath();
      ctx.moveTo(xx, yy - 34);
      ctx.lineTo(xx, yy);
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 6, y + 2, w - 12, 4);
  ctx.fillStyle = 'rgba(90,150,90,0.35)';
  for (let i = 20; i < w; i += 74) {
    ctx.beginPath();
    ctx.arc(x + i, y + 3, 4 + hash2(i, 5) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWoodPlatform(ctx, p, low = false) {
  const { x, y, w, h } = p;
  if (low) {
    ctx.fillStyle = PALETTE.wood;
    rr(ctx, x, y, w, h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,235,190,0.45)';
    ctx.fillRect(x + 4, y + 2, w - 8, 3);
    return;
  }
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#e0a96c');
  grad.addColorStop(1, PALETTE.woodDark);
  ctx.fillStyle = grad;
  rr(ctx, x, y, w, h, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(90,50,20,0.35)';
  ctx.lineWidth = 2;
  for (let yy = y + 12; yy < y + h; yy += 14) {
    ctx.beginPath();
    ctx.moveTo(x + 4, yy);
    ctx.lineTo(x + w - 4, yy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,235,190,0.4)';
  ctx.fillRect(x + 4, y + 2, w - 8, 3);

  for (let i = 16; i < w; i += 70) {
    ctx.fillStyle = '#7a4c25';
    ctx.beginPath();
    ctx.arc(x + i, y + 9, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + i, y + h - 7, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlatform(ctx, p, low = false) {
  if (p.type === 'ice') drawIcePlatform(ctx, p, low);
  else if (p.type === 'stone') drawStonePlatform(ctx, p, low);
  else if (p.type === 'wood') drawWoodPlatform(ctx, p, low);
  else drawGrassPlatform(ctx, p, low);
}

/* ------------------------------------------------------------------ */
/* Decor                                                               */
/* ------------------------------------------------------------------ */

function drawTree(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  ctx.fillStyle = '#8a5a35';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-5, -38, -4, -62);
  ctx.lineTo(6, -62);
  ctx.quadraticCurveTo(5, -34, 9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,225,180,0.25)';
  ctx.beginPath();
  ctx.ellipse(-2, -30, 3, 22, 0.08, 0, Math.PI * 2);
  ctx.fill();

  const blobs = [
    { x: 0, y: -82, r: 38 },
    { x: -28, y: -68, r: 27 },
    { x: 28, y: -68, r: 27 },
    { x: -14, y: -100, r: 24 },
    { x: 16, y: -102, r: 22 }
  ];
  ctx.fillStyle = PALETTE.leaf;
  for (const b of blobs) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.leafLight;
  for (const b of blobs) {
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.24, b.y - b.r * 0.26, b.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-16, -106, 10, 0, Math.PI * 2);
  ctx.fill();

  // Little oranges.
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 26, -78 + Math.sin(a) * 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBush(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  ctx.fillStyle = '#4f9f58';
  ctx.beginPath();
  ctx.arc(-22, -12, 18, 0, Math.PI * 2);
  ctx.arc(0, -22, 24, 0, Math.PI * 2);
  ctx.arc(22, -11, 17, 0, Math.PI * 2);
  ctx.arc(0, -5, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7ed36a';
  ctx.beginPath();
  ctx.arc(-4, -26, 12, 0, Math.PI * 2);
  ctx.arc(16, -16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9ab5';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-16 + i * 16, -18 + (i % 2) * 6, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlowers(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 13 + (hash2(i, 4) - 0.5) * 8;
    const hgt = 12 + hash2(i, 7) * 12;
    ctx.strokeStyle = '#3f9e46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 2, -hgt / 2, x, -hgt);
    ctx.stroke();
    const colors = ['#fff3b0', '#ffb3c7', '#c9b6ff', '#ffd98a'];
    ctx.fillStyle = colors[i % colors.length];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 3.4, -hgt + Math.sin(a) * 3.4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(x, -hgt, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRock(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  ctx.fillStyle = '#98a3b0';
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-26, -16);
  ctx.lineTo(-8, -30);
  ctx.lineTo(14, -26);
  ctx.lineTo(24, -8);
  ctx.lineTo(18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c3ccd6';
  ctx.beginPath();
  ctx.moveTo(-8, -28);
  ctx.lineTo(12, -24);
  ctx.lineTo(4, -14);
  ctx.lineTo(-12, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(70,90,80,0.35)';
  ctx.beginPath();
  ctx.arc(8, -8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMushroom(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  ctx.fillStyle = '#f6e6cc';
  ctx.fillRect(-4, -16, 8, 16);
  ctx.fillStyle = '#ef6f6f';
  ctx.beginPath();
  ctx.arc(0, -16, 13, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 6, -20 - (i % 2) * 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCattail(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.s, d.s);
  for (let i = 0; i < 4; i++) {
    const x = i * 12 - 18;
    ctx.strokeStyle = '#4f8a4a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 5, -30, x + 2, -54 - i * 4);
    ctx.stroke();
    ctx.fillStyle = '#8a5a35';
    ctx.beginPath();
    ctx.roundRect(x - 2, -58 - i * 4, 5, 15, 2.5);
    ctx.fill();
  }
  ctx.restore();
}

function drawDecor(ctx, d) {
  switch (d.type) {
    case 'tree': drawTree(ctx, d); break;
    case 'bush': drawBush(ctx, d); break;
    case 'flowers': drawFlowers(ctx, d); break;
    case 'rock': drawRock(ctx, d); break;
    case 'mushroom': drawMushroom(ctx, d); break;
    case 'cattail': drawCattail(ctx, d); break;
    case 'signpost':
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.fillStyle = '#8a5a35';
      ctx.fillRect(-3, -40, 6, 40);
      ctx.fillStyle = '#c98b52';
      rr(ctx, -22, -58, 44, 22, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(90,50,20,0.5)';
      ctx.fillRect(-16, -52, 24, 3);
      ctx.fillRect(-16, -46, 18, 3);
      ctx.restore();
      break;
    default: break;
  }
}

/* ------------------------------------------------------------------ */
/* Water                                                               */
/* ------------------------------------------------------------------ */

function drawWater(ctx, span, time, low = false) {
  if (low) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(span.x, span.y, span.w, span.h);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(span.x, span.y, span.w, 4);
    return;
  }
  ctx.save();
  const grad = ctx.createLinearGradient(0, span.y - 10, 0, span.y + 220);
  grad.addColorStop(0, '#8fe0f5');
  grad.addColorStop(0.35, PALETTE.water);
  grad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(span.x, span.y, span.w, span.h);

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(span.x, span.y);
  for (let x = span.x; x <= span.x + span.w; x += 16) {
    const y = span.y + Math.sin(x * 0.018 + time * 2.2) * 5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(span.x + span.w, span.y + 16);
  ctx.lineTo(span.x, span.y + 16);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let x = span.x; x <= span.x + span.w; x += 14) {
      const y = span.y + 10 + k * 22 + Math.sin(x * 0.02 + time * 2 + k) * 4;
      if (x === span.x) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.35 - k * 0.08;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 10; i++) {
    const x = span.x + ((i * 97 + time * 18) % span.w);
    const y = span.y + 12 + Math.sin(time * 2 + i) * 6 + (i % 3) * 20;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + (i % 2) * 2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Mechanisms                                                          */
/* ------------------------------------------------------------------ */

function drawGate(ctx, gate, time) {
  const x = gate.x;
  const y = gate.y;
  const w = gate.w;
  const h = gate.h;

  // Stone frame.
  ctx.fillStyle = PALETTE.stoneDark;
  rr(ctx, x - 16, y - 56, 16, h + 56, 4);
  ctx.fill();
  rr(ctx, x + w, y - 56, 16, h + 56, 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.stone;
  rr(ctx, x - 24, y - 76, w + 48, 30, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.stoneLight;
  ctx.fillRect(x - 20, y - 73, w + 40, 5);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2, y - 76, w + 4, h + 76);
  ctx.clip();
  ctx.translate(0, -gate.open * (h + 8));

  // Bars.
  for (let i = 0; i < 2; i++) {
    const bx = x + 8 + i * (w - 16);
    ctx.fillStyle = '#5b6573';
    ctx.fillRect(bx - 3, y, 7, h);
    ctx.fillStyle = '#aab6c4';
    ctx.fillRect(bx - 2, y, 2, h);
  }
  for (let yy = y + 12; yy < y + h; yy += 30) {
    ctx.fillStyle = '#4b5563';
    rr(ctx, x + 2, yy, w - 4, 9, 3);
    ctx.fill();
    ctx.fillStyle = '#c7d2de';
    ctx.fillRect(x + 4, yy + 1, w - 8, 2.5);
    ctx.fillStyle = '#9aa6b4';
    for (const bx of [x + 6, x + w - 10]) {
      ctx.beginPath();
      ctx.arc(bx, yy + 4.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Lock badge.
  const cx = x + w / 2;
  const cy = y + h * 0.55;
  ctx.fillStyle = gate.latched ? '#3fae63' : '#b23b3b';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff7e6';
  if (gate.latched) {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy);
    ctx.lineTo(cx - 1, cy + 5);
    ctx.lineTo(cx + 7, cy - 5);
    ctx.strokeStyle = '#fff7e6';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  } else {
    ctx.fillRect(cx - 3, cy - 2, 6, 7);
    ctx.strokeStyle = '#fff7e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 4, Math.PI, 0);
    ctx.stroke();
  }
}

function drawPlate(ctx, plate, time) {
  const x = plate.x;
  const y = plate.y;
  const w = plate.w;
  const press = plate.press;

  const glow = ctx.createRadialGradient(x + w / 2, y, 4, x + w / 2, y, 90);
  const strength = 0.15 + plate.glow * 0.4;
  glow.addColorStop(0, `rgba(255,214,90,${strength})`);
  glow.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + 2, 90, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7d5a3c';
  rr(ctx, x, y - 8, w, 16, 7);
  ctx.fill();
  ctx.fillStyle = '#4e3a28';
  rr(ctx, x + 8, y - 6, w - 16, 8, 4);
  ctx.fill();

  ctx.fillStyle = plate.glow > 0.35 ? '#ffd45c' : '#e3a93c';
  rr(ctx, x + 10, y - 12 + press * 5, w - 20, 12, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,55,20,0.65)';
  ctx.lineWidth = 2;
  rr(ctx, x + 10, y - 12 + press * 5, w - 20, 12, 6);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  rr(ctx, x + 16, y - 10 + press * 5, w - 44, 3, 2);
  ctx.fill();

  // Paw print.
  ctx.fillStyle = 'rgba(90,55,20,0.6)';
  const px = x + w / 2;
  const py = y - 5 + press * 5;
  ctx.beginPath();
  ctx.ellipse(px, py + 2, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(px - 7 + i * 7, py - 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (plate.pressed) {
    ctx.strokeStyle = `rgba(255,230,120,${0.4 + Math.sin(time * 6) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y - 4, w / 2 + 8, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawLever(ctx, lever) {
  const x = lever.x;
  const groundY = lever.y;
  const cx = x + lever.w / 2;

  ctx.fillStyle = '#6b7785';
  rr(ctx, x - 4, groundY - 18, lever.w + 8, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#414b58';
  rr(ctx, x + 6, groundY - 14, lever.w - 12, 8, 4);
  ctx.fill();

  ctx.fillStyle = '#8a5a35';
  rr(ctx, cx - 7, groundY - lever.h, 14, lever.h - 8, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.3)';
  ctx.fillRect(cx - 4, groundY - lever.h + 6, 3, lever.h - 22);

  const angle = lerp(-0.85, 0.6, lever.pull);
  ctx.save();
  ctx.translate(cx, groundY - lever.h + 10);
  ctx.rotate(angle);
  ctx.strokeStyle = '#3f4a57';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(34, 0);
  ctx.stroke();
  ctx.strokeStyle = '#9aa6b4';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(34, 0);
  ctx.stroke();
  ctx.fillStyle = '#e34d4d';
  ctx.beginPath();
  ctx.arc(36, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(33, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Indicator lamp.
  ctx.fillStyle = lever.on ? '#5ef08a' : '#8a3a3a';
  ctx.beginPath();
  ctx.arc(cx + 16, groundY - lever.h - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  if (lever.on) {
    const g = ctx.createRadialGradient(cx + 16, groundY - lever.h - 4, 1, cx + 16, groundY - lever.h - 4, 24);
    g.addColorStop(0, 'rgba(94,240,138,0.5)');
    g.addColorStop(1, 'rgba(94,240,138,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx + 16, groundY - lever.h - 4, 24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMover(ctx, mover, time) {
  // Rail.
  ctx.save();
  ctx.strokeStyle = 'rgba(140,220,255,0.28)';
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(mover.from.x + mover.w / 2, mover.from.y + mover.h / 2);
  ctx.lineTo(mover.to.x + mover.w / 2, mover.to.y + mover.h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const x = mover.x;
  const y = mover.y;
  const w = mover.w;
  const h = mover.h;

  if (mover.active) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 6, x + w / 2, y + h / 2, w * 0.7);
    g.addColorStop(0, 'rgba(120,240,255,0.28)');
    g.addColorStop(1, 'rgba(120,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w * 0.7, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#8a5a35';
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = '#c98b52';
  rr(ctx, x + 2, y + 2, w - 4, h - 6, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,200,0.5)';
  ctx.fillRect(x + 8, y + 5, w - 16, 3);

  // Metal caps.
  ctx.fillStyle = '#5d6a78';
  rr(ctx, x - 5, y - 2, 12, h + 2, 4);
  ctx.fill();
  rr(ctx, x + w - 7, y - 2, 12, h + 2, 4);
  ctx.fill();

  // Runes.
  const runeAlpha = mover.active ? 0.85 : 0.3;
  ctx.strokeStyle = `rgba(130,245,255,${runeAlpha})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const rx = x + w * (0.28 + i * 0.22);
    ctx.beginPath();
    ctx.moveTo(rx - 5, y + h / 2 + 4);
    ctx.lineTo(rx, y + h / 2 - 4);
    ctx.lineTo(rx + 5, y + h / 2 + 4);
    ctx.stroke();
  }
  if (mover.active) {
    ctx.fillStyle = `rgba(160,250,255,${0.4 + Math.sin(time * 5) * 0.2})`;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFan(ctx, fan, time, low = false) {
  const cx = fan.x + fan.w / 2;
  const cy = fan.y + fan.h / 2;
  const r = Math.min(fan.w, fan.h) / 2;

  // Support post from the housing to the ground.
  ctx.fillStyle = '#59636f';
  ctx.fillRect(cx - 9, cy + r - 4, 18, Math.max(0, fan.y + fan.h - (cy + r) + 4));
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(cx - 6, cy + r - 2, 4, Math.max(0, fan.y + fan.h - (cy + r)));

  // Support legs.
  ctx.fillStyle = '#6d7885';
  const legTop = fan.y + fan.h - 10;
  ctx.fillRect(cx - r * 0.55, legTop, 10, 24);
  ctx.fillRect(cx + r * 0.55 - 10, legTop, 10, 24);
  ctx.fillStyle = '#4e5864';
  ctx.fillRect(cx - r * 0.7, legTop + 20, r * 1.4, 8);

  // Wind cone.
  if (fan.active && !low) {
    const cone = ctx.createLinearGradient(fan.x - 240, 0, fan.x, 0);
    cone.addColorStop(0, 'rgba(220,248,255,0)');
    cone.addColorStop(1, 'rgba(220,248,255,0.22)');
    ctx.fillStyle = cone;
    ctx.fillRect(fan.zone.x, fan.zone.y, fan.zone.w, fan.zone.h);
    ctx.strokeStyle = 'rgba(240,252,255,0.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const yy = fan.zone.y + 20 + i * (fan.zone.h / 8);
      const phase = (time * 300 + i * 70) % 300;
      ctx.beginPath();
      ctx.moveTo(fan.x - 20 - phase, yy);
      ctx.quadraticCurveTo(fan.x - 60 - phase, yy - 6, fan.x - 112 - phase, yy);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(cx, cy);

  // Housing ring.
  ctx.fillStyle = '#59636f';
  ctx.beginPath();
  ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f3742';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Blades.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(fan.spin);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    const blade = ctx.createLinearGradient(0, 0, r, 0);
    blade.addColorStop(0, '#cfd9e4');
    blade.addColorStop(1, '#7d8b9c');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.42, r * 0.92, -6);
    ctx.quadraticCurveTo(r * 0.55, r * 0.16, 0, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#e8eef5';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cage rings.
  ctx.strokeStyle = 'rgba(210,224,238,0.55)';
  ctx.lineWidth = 1.6;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (r * i) / 3.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c7d2de';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#7b8798';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  ctx.stroke();

  // Warning stripes on the housing.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r + 8, Math.PI * 0.15, Math.PI * 0.85);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffcf5c';
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Hub.
  ctx.fillStyle = '#ffcf5c';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Chest, key, door                                                    */
/* ------------------------------------------------------------------ */

function drawChest(ctx, chest, time, low = false) {
  const { x, y, w, h } = chest;
  const open = chest.state === 'closed' ? 0 : chest.state === 'opening' ? clamp(chest.timer / 0.45, 0, 1) : 1;

  // Pedestal keeps the chest readable above the cats.
  ctx.fillStyle = '#6d7885';
  rr(ctx, x - 12, y + h, w + 24, 34, 6);
  ctx.fill();
  ctx.fillStyle = '#8f9aa8';
  rr(ctx, x - 8, y + h, w + 16, 10, 4);
  ctx.fill();
  ctx.fillStyle = '#5a6573';
  ctx.fillRect(x + 8, y + h + 22, w - 16, 4);

  if (open < 1) {
    const bob = Math.sin(time * 3) * 3;
    ctx.save();
    ctx.translate(x + w / 2, y - 22 + bob);
    ctx.fillStyle = 'rgba(255,247,230,0.95)';
    rr(ctx, -13, -14, 26, 24, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.lineTo(0, 16);
    ctx.lineTo(6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b45309';
    ctx.font = "800 18px 'Baloo 2', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 3);
    ctx.restore();
  }

  // Glow.
  if (!low) {
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, 120);
    glow.addColorStop(0, `rgba(255,220,110,${0.25 + open * 0.4})`);
    glow.addColorStop(1, 'rgba(255,220,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, y - 90, w + 180, h + 180);
  }

  // Base.
  const baseGrad = ctx.createLinearGradient(0, y + 30, 0, y + h);
  baseGrad.addColorStop(0, '#b97a45');
  baseGrad.addColorStop(1, '#7a4a24');
  ctx.fillStyle = baseGrad;
  rr(ctx, x, y + 26, w, h - 26, 10);
  ctx.fill();
  ctx.strokeStyle = '#5a3418';
  ctx.lineWidth = 3;
  rr(ctx, x, y + 26, w, h - 26, 10);
  ctx.stroke();

  ctx.fillStyle = '#ffcf5c';
  ctx.fillRect(x + 12, y + 34, 9, h - 44);
  ctx.fillRect(x + w - 21, y + 34, 9, h - 44);
  ctx.fillStyle = 'rgba(255,247,200,0.5)';
  ctx.fillRect(x + 14, y + 36, 3, h - 48);

  // Lock plate.
  ctx.fillStyle = '#ffcf5c';
  rr(ctx, x + w / 2 - 13, y + h - 42, 26, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#8a5a12';
  ctx.lineWidth = 2;
  rr(ctx, x + w / 2 - 13, y + h - 42, 26, 26, 5);
  ctx.stroke();
  ctx.fillStyle = '#5a3a10';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h - 31, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + w / 2 - 1.5, y + h - 31, 3, 8);

  // Lid.
  ctx.save();
  ctx.translate(x + w / 2, y + 32);
  ctx.rotate(-open * 0.28);
  ctx.translate(0, -open * 16);
  const lidGrad = ctx.createLinearGradient(0, -30, 0, 10);
  lidGrad.addColorStop(0, '#d99a5e');
  lidGrad.addColorStop(1, '#a06636');
  ctx.fillStyle = lidGrad;
  rr(ctx, -w / 2, -34, w, 40, 12);
  ctx.fill();
  ctx.strokeStyle = '#5a3418';
  ctx.lineWidth = 3;
  rr(ctx, -w / 2, -34, w, 40, 12);
  ctx.stroke();
  ctx.fillStyle = '#ffcf5c';
  ctx.fillRect(-w / 2 + 12, -26, 10, 30);
  ctx.fillRect(w / 2 - 22, -26, 10, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, -w / 2 + 14, -30, w - 28, 5, 3);
  ctx.fill();
  ctx.restore();

  // Interior sparkles when open.
  if (open > 0.6) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,235,150,0.9)';
    for (let i = 0; i < 5; i++) {
      const a = time * 1.5 + i * 1.3;
      const sx = x + w / 2 + Math.cos(a) * (18 + i * 4);
      const sy = y + 18 + Math.sin(a * 1.4) * 8;
      ctx.globalAlpha = 0.4 + Math.abs(Math.sin(a)) * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawDoor(ctx, door, key, time, low = false) {
  const { x, y, w, h } = door;
  const cx = x + w / 2;
  const open = door.open;

  // Glow.
  if (!low) {
    const glow = ctx.createRadialGradient(cx, y + h / 2, 10, cx, y + h / 2, 170);
    glow.addColorStop(0, `rgba(255,225,130,${0.12 + open * 0.42})`);
    glow.addColorStop(1, 'rgba(255,225,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 130, y - 80, w + 260, h + 180);
  }

  // Arch.
  ctx.fillStyle = '#6d7885';
  ctx.beginPath();
  ctx.moveTo(x - 18, y + h);
  ctx.lineTo(x - 18, y + 64);
  ctx.arc(cx, y + 64, w / 2 + 18, Math.PI, 0);
  ctx.lineTo(x + w + 18, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f9aa8';
  ctx.beginPath();
  ctx.moveTo(x - 8, y + h);
  ctx.lineTo(x - 8, y + 66);
  ctx.arc(cx, y + 66, w / 2 + 8, Math.PI, 0);
  ctx.lineTo(x + w + 8, y + h);
  ctx.closePath();
  ctx.fill();

  // Portal.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h);
  ctx.lineTo(x + 6, y + 70);
  ctx.arc(cx, y + 70, w / 2 - 6, Math.PI, 0);
  ctx.lineTo(x + w - 6, y + h);
  ctx.closePath();
  ctx.clip();

  const portal = ctx.createLinearGradient(0, y, 0, y + h);
  if (open > 0.2) {
    portal.addColorStop(0, '#fff3b0');
    portal.addColorStop(0.5, '#ffd45c');
    portal.addColorStop(1, '#ff9f43');
  } else {
    portal.addColorStop(0, '#3f4a57');
    portal.addColorStop(1, '#232a33');
  }
  ctx.fillStyle = portal;
  ctx.fillRect(x, y, w, h);

  if (open > 0.05) {
    ctx.globalAlpha = open;
    for (let i = 0; i < 8; i++) {
      const rx = x + 16 + ((time * 40 + i * 31) % (w - 32));
      const ry = y + 60 + ((time * 26 + i * 53) % (h - 80));
      ctx.fillStyle = 'rgba(255,255,240,0.9)';
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Panels slide apart.
  const panelW = (w - 12) / 2;
  const slide = open * panelW * 0.85;
  for (let side = 0; side < 2; side++) {
    const px = side === 0 ? x + 6 - slide : x + w / 2 + slide;
    ctx.fillStyle = side === 0 ? '#8a5a35' : '#7c4f2e';
    rr(ctx, px, y + 46, panelW, h - 46, 4);
    ctx.fill();
    ctx.strokeStyle = '#5a3418';
    ctx.lineWidth = 2;
    rr(ctx, px, y + 46, panelW, h - 46, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,190,0.18)';
    ctx.fillRect(px + 10, y + 54, panelW - 20, 3);
    ctx.fillRect(px + 10, y + h - 20, panelW - 20, 3);
  }

  // Keyhole and key.
  if (open < 0.7) {
    ctx.fillStyle = '#2b1a0c';
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.58, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 2.5, y + h * 0.58, 5, 14);
  }
  if (door.inserted && open < 0.7) {
    drawKey(ctx, cx, y + h * 0.58 - 4, 0.55, 0.2, false);
  }

  ctx.restore();

  // Cat emblems.
  const emblemY = y + 34;
  for (let side = 0; side < 2; side++) {
    const ex = cx + (side === 0 ? -22 : 22);
    ctx.fillStyle = side === 0 ? PLAYERS[0].fur : PLAYERS[1].fur;
    ctx.strokeStyle = '#5a3418';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, emblemY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a2416';
    ctx.beginPath();
    ctx.arc(ex - 3, emblemY - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 3, emblemY - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ex - 6, emblemY - 7);
    ctx.lineTo(ex - 5, emblemY - 11);
    ctx.lineTo(ex - 2, emblemY - 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ex + 6, emblemY - 7);
    ctx.lineTo(ex + 5, emblemY - 11);
    ctx.lineTo(ex + 2, emblemY - 8);
    ctx.fill();
  }

  // Sign.
  ctx.save();
  ctx.translate(cx, y - 34);
  ctx.fillStyle = '#5a3418';
  rr(ctx, -46, -20, 92, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffcf5c';
  rr(ctx, -43, -17, 86, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#5a3418';
  ctx.font = "800 14px 'Baloo 2', 'Nunito', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('KELUAR', 0, 1);
  ctx.restore();

  // Lock badge when locked.
  if (!door.inserted) {
    ctx.fillStyle = 'rgba(40,25,12,0.72)';
    rr(ctx, cx - 48, y + h + 12, 96, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ffcf5c';
    ctx.font = "800 13px 'Baloo 2', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('BUTUH KUNCI', cx, y + h + 30);
  }
}

/* ------------------------------------------------------------------ */
/* Collectibles and props                                              */
/* ------------------------------------------------------------------ */

function drawCoin(ctx, coin, low = false) {
  if (coin.collected) return;
  const bob = Math.sin(coin.phase) * 3;
  const sx = 0.32 + 0.68 * Math.abs(Math.cos(coin.phase));
  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.scale(sx, 1);

  if (low) {
    ctx.fillStyle = '#b7791f';
    ctx.beginPath();
    ctx.arc(0, 1.5, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd45c';
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
  glow.addColorStop(0, 'rgba(255,214,90,0.45)');
  glow.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b7791f';
  ctx.beginPath();
  ctx.arc(0, 1.5, 12.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd45c';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff0a8';
  ctx.beginPath();
  ctx.arc(-3, -3, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b7791f';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-4.5 + i * 4.5, -2.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSardine(ctx, sardine, time) {
  if (sardine.collected) return;
  const bob = Math.sin(time * 2 + sardine.phase) * 4;
  ctx.save();
  ctx.translate(sardine.x, sardine.y + bob);
  ctx.rotate(Math.sin(time * 1.4 + sardine.phase) * 0.08);

  const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 34);
  glow.addColorStop(0, 'rgba(160,230,255,0.35)');
  glow.addColorStop(1, 'rgba(160,230,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  // Tail.
  ctx.fillStyle = '#8fd3ef';
  ctx.strokeStyle = '#2f6f8f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(-25, -10);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-25, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body.
  const body = ctx.createLinearGradient(0, -10, 0, 10);
  body.addColorStop(0, '#e8f8ff');
  body.addColorStop(0.45, '#a6dff5');
  body.addColorStop(1, '#5aa8c9');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Stripes.
  ctx.strokeStyle = 'rgba(47,111,143,0.55)';
  ctx.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-4 + i * 5, -8);
    ctx.quadraticCurveTo(-1 + i * 5, 0, -4 + i * 5, 8);
    ctx.stroke();
  }

  // Face.
  ctx.fillStyle = '#1f3a4a';
  ctx.beginPath();
  ctx.arc(10, -2.5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(10.6, -3.2, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f6f8f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(16, 2, 3, -0.6, 0.8);
  ctx.stroke();

  // Shine.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-2, -2, 8, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();

  ctx.restore();
}

function drawBox(ctx, box) {
  const squish = box.squish;
  const sx = 1 + squish * 0.08;
  const sy = 1 - squish * 0.12;
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h);
  ctx.scale(sx, sy);

  ctx.fillStyle = '#7a4a24';
  rr(ctx, -box.w / 2, -box.h, box.w, box.h, 7);
  ctx.fill();
  ctx.fillStyle = '#c98b52';
  rr(ctx, -box.w / 2 + 2, -box.h + 2, box.w - 4, box.h - 4, 6);
  ctx.fill();

  ctx.strokeStyle = 'rgba(90,50,20,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-box.w / 2 + 6, -box.h + 6);
  ctx.lineTo(box.w / 2 - 6, -6);
  ctx.moveTo(box.w / 2 - 6, -box.h + 6);
  ctx.lineTo(-box.w / 2 + 6, -6);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(90,50,20,0.55)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-box.w / 2 + 10, -box.h + 10, box.w - 20, box.h - 20);

  ctx.fillStyle = '#5d6a78';
  for (const [x, y] of [
    [-box.w / 2 + 6, -box.h + 6],
    [box.w / 2 - 6, -box.h + 6],
    [-box.w / 2 + 6, -6],
    [box.w / 2 - 6, -6]
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSign(ctx, sign) {
  ctx.save();
  ctx.translate(sign.x, sign.y);
  ctx.fillStyle = '#8a5a35';
  ctx.fillRect(-4, -86, 8, 86);
  ctx.fillStyle = '#6b3f22';
  ctx.fillRect(-4, -86, 3, 86);

  ctx.save();
  ctx.translate(0, -104);
  ctx.rotate(-0.035);
  ctx.fillStyle = '#5a3418';
  rr(ctx, -32, -20, 64, 40, 7);
  ctx.fill();
  ctx.fillStyle = '#d99b68';
  rr(ctx, -29, -17, 58, 34, 5);
  ctx.fill();
  ctx.fillStyle = '#8a5a35';
  ctx.fillRect(-24, -8, 48, 2.5);
  ctx.fillRect(-24, -1, 38, 2.5);
  ctx.fillRect(-24, 6, 44, 2.5);

  ctx.fillStyle = '#ffcf5c';
  ctx.beginPath();
  ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3418';
  ctx.font = "800 9px 'Baloo 2', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('i', 0, -8);
  ctx.restore();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Players                                                             */
/* ------------------------------------------------------------------ */

function drawPlayer(ctx, level, player, time, low = false) {
  const info = PLAYERS[player.index];
  drawCatShadow(ctx, player);

  // Colored ring so P1/P2 read instantly.
  ctx.save();
  ctx.strokeStyle = info.fur;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(player.cx, player.bottom + 2.5, 29, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawCat(ctx, player, player.index, time);

  if (player.carryingKey) {
    const key = level.key;
    drawKey(ctx, player.cx, player.y - 16 + Math.sin(time * 4) * 3, 0.9, Math.sin(time * 3) * 0.2, !low);
    void key;
  }
}

/* ------------------------------------------------------------------ */
/* Main scene                                                          */
/* ------------------------------------------------------------------ */

export function drawScene(ctx, level, camera, time, particles, low = false) {
  const view = camera.view;

  if (!low) {
    for (const d of level.data.decor) {
      if (!visible(view, d.x - 60, d.y - 120, 120, 130, 100)) continue;
      drawDecor(ctx, d);
    }
  }

  for (const span of level.data.waterSpans || []) {
    if (!visible(view, span.x, span.y - 20, span.w, span.h)) continue;
    drawWater(ctx, span, time, low);
  }

  for (const p of level.platforms) {
    if (!visible(view, p.x, p.y, p.w, p.h)) continue;
    drawPlatform(ctx, p, low);
  }

  for (const lever of level.levers) {
    if (!visible(view, lever.x - 40, lever.y - lever.h - 30, lever.w + 80, lever.h + 40)) continue;
    drawLever(ctx, lever);
  }

  for (const plate of level.plates) {
    if (!visible(view, plate.x - 80, plate.y - 40, plate.w + 160, 80)) continue;
    drawPlate(ctx, plate, time);
  }

  for (const gate of level.gates) {
    if (!visible(view, gate.x - 40, gate.y - 100, gate.w + 80, gate.h + 140)) continue;
    drawGate(ctx, gate, time);
  }

  for (const mover of level.movers) {
    if (!visible(view, mover.x, mover.y, mover.w, mover.h)) continue;
    drawMover(ctx, mover, time);
  }

  for (const fan of level.fans) {
    if (!visible(view, fan.x - 280, fan.y - 20, fan.w + 300, fan.h + 40)) continue;
    drawFan(ctx, fan, time, low);
  }

  for (const sign of level.signs) {
    if (!visible(view, sign.x - 50, sign.y - 140, 100, 140)) continue;
    drawSign(ctx, sign);
  }

  for (const coin of level.coins) {
    if (coin.collected) continue;
    if (!visible(view, coin.x - 25, coin.y - 25, 50, 50)) continue;
    drawCoin(ctx, coin, low);
  }

  for (const sardine of level.sardines) {
    if (sardine.collected) continue;
    if (!visible(view, sardine.x - 40, sardine.y - 30, 80, 60)) continue;
    drawSardine(ctx, sardine, time);
  }

  if (visible(view, level.chest.x - 60, level.chest.y - 80, level.chest.w + 120, level.chest.h + 100)) {
    drawChest(ctx, level.chest, time, low);
  }

  if (level.key.state === 'free' && visible(view, level.key.x - 30, level.key.y - 30, 60, 60)) {
    drawKey(ctx, level.key.x + level.key.w / 2, level.key.y + level.key.h / 2 + Math.sin(time * 4) * 3, 1, Math.sin(time * 2.5) * 0.18, !low);
  }

  if (visible(view, level.door.x - 80, level.door.y - 120, level.door.w + 160, level.door.h + 160)) {
    drawDoor(ctx, level.door, level.key, time, low);
  }

  for (const box of level.boxes) {
    if (!visible(view, box.x, box.y, box.w, box.h)) continue;
    drawBox(ctx, box);
  }

  for (const player of level.players) {
    if (!visible(view, player.x - 60, player.y - 80, player.w + 120, player.h + 100)) continue;
    drawPlayer(ctx, level, player, time, low);
  }

  if (particles) particles.draw(ctx, low);
}

export function drawForeground(ctx, camera, level, time) {
  // Soft light shaft near the treasure chest and the exit door.
  const chest = level.chest;
  const g = ctx.createRadialGradient(chest.x + chest.w / 2, chest.y, 10, chest.x + chest.w / 2, chest.y, 300);
  g.addColorStop(0, 'rgba(255,235,160,0.10)');
  g.addColorStop(1, 'rgba(255,235,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(chest.x - 300, chest.y - 300, chest.w + 600, 600);
  void camera;
  void time;
}
