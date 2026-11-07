// Renders the LAN controller URL as a scannable QR code on <canvas>.
const QUIET = 4;

function makeQrCanvas(text, moduleSize = 8) {
  if (typeof qrcode === 'undefined') return null;
  let qr;
  try {
    // Type 0 = auto-select the smallest version that fits the room URL.
    qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
  } catch {
    return null;
  }

  const count = qr.getModuleCount();
  const total = count + QUIET * 2;
  const canvas = document.createElement('canvas');
  canvas.width = total * moduleSize;
  canvas.height = total * moduleSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#14233b';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      ctx.fillRect((col + QUIET) * moduleSize, (row + QUIET) * moduleSize, moduleSize, moduleSize);
    }
  }
  return canvas;
}

export class QRDisplay {
  constructor() {
    this.big = document.querySelector('#qrCanvas');
    this.small = document.querySelector('#qrCanvasSmall');
    this.lastText = '';
  }

  render(text) {
    if (!text) return false;
    if (text === this.lastText) return true;
    const big = makeQrCanvas(text, 9);
    if (!big) {
      if (this.big) this.big.innerHTML = `<div class="qr-loading">QR tidak tersedia.<br />Buka ${text}</div>`;
      return false;
    }
    this.lastText = text;
    if (this.big) {
      this.big.innerHTML = '';
      this.big.appendChild(big);
    }
    if (this.small) {
      this.small.innerHTML = '';
      const small = makeQrCanvas(text, 5);
      if (small) this.small.appendChild(small);
    }
    return true;
  }
}
