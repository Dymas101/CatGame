// Hand-authored level: "Lembah Sardin".
// Coordinates are world pixels; y grows downward. Ground top is y = 620.
const GROUND = 620;

const coin = (x, y) => ({ x, y });
const line = (x, y, n, gap = 44) => Array.from({ length: n }, (_, i) => coin(x + i * gap, y));

const platforms = [
  // --- A. Padang rumput pembuka -------------------------------------------
  { x: -240, y: GROUND, w: 1940, h: 460, type: 'grass' },
  { x: 520, y: 512, w: 180, h: 28, type: 'grass' },
  { x: 800, y: 432, w: 150, h: 26, type: 'grass' },
  { x: 1050, y: 500, w: 170, h: 28, type: 'grass' },

  // --- B. Gerbang tombol berat -------------------------------------------
  { x: 1700, y: GROUND, w: 1900, h: 460, type: 'grass' },
  { x: 2760, y: 490, w: 170, h: 26, type: 'stone' },
  { x: 3150, y: 500, w: 180, h: 26, type: 'stone' },

  // --- C. Jurang platform ajaib ------------------------------------------
  { x: 3600, y: GROUND, w: 260, h: 460, type: 'stone' },
  { x: 4200, y: 360, w: 190, h: 26, type: 'stone' },
  { x: 4760, y: 500, w: 200, h: 28, type: 'grass' },

  // --- D. Arena es & kipas raksasa ---------------------------------------
  { x: 4960, y: GROUND, w: 1740, h: 460, type: 'ice' },
  { x: 5400, y: 490, w: 170, h: 26, type: 'stone' },
  { x: 6100, y: 540, w: 150, h: 26, type: 'stone' },

  // --- E. Peti hadiah & pintu keluar -------------------------------------
  { x: 6700, y: GROUND, w: 2460, h: 460, type: 'grass' },
  { x: 6960, y: 540, w: 170, h: 26, type: 'wood' },
  { x: 7200, y: 450, w: 160, h: 26, type: 'wood' },
  { x: 7440, y: 360, w: 240, h: 26, type: 'wood' }
];

const coins = [
  ...line(560, 470, 3),
  ...line(835, 390, 3),
  ...line(1085, 458, 3),
  ...line(1245, 560, 4, 42),

  ...line(1840, 560, 4),
  ...line(2090, 505, 3),
  ...line(2415, 472, 3),
  ...line(2810, 440, 3),
  ...line(3190, 452, 3),

  ...line(3920, 520, 2),
  ...line(4260, 310, 3),
  ...line(4520, 310, 3),
  ...line(4790, 310, 2),
  ...line(4660, 448, 3),

  ...line(5150, 560, 4),
  ...line(5480, 440, 3),
  ...line(5900, 560, 4),
  ...line(6150, 540, 3),
  ...line(6300, 560, 3),

  ...line(6820, 560, 3),
  ...line(7000, 500, 3),
  ...line(7240, 410, 3),
  ...line(7700, 320, 3),
  ...line(8000, 560, 4),
  ...line(8350, 560, 3)
];

const sardines = [
  { x: 1290, y: 548 },
  { x: 1960, y: 540 },
  { x: 3230, y: 452 },
  { x: 4245, y: 300 },
  { x: 5425, y: 438 },
  { x: 6625, y: 520 },
  { x: 7730, y: 300 },
  { x: 8120, y: 540 }
].map((s, i) => ({ ...s, id: i, phase: i * 0.9 }));

const checkpoints = [
  { x: 120, spawn: [{ x: 180, y: 568 }, { x: 270, y: 568 }, { x: 90, y: 568 }, { x: 360, y: 568 }] },
  { x: 1760, spawn: [{ x: 1780, y: 568 }, { x: 1860, y: 568 }, { x: 1700, y: 568 }, { x: 1940, y: 568 }] },
  { x: 3620, spawn: [{ x: 3630, y: 568 }, { x: 3690, y: 568 }, { x: 3570, y: 568 }, { x: 3750, y: 568 }] },
  { x: 5000, spawn: [{ x: 5030, y: 568 }, { x: 5110, y: 568 }, { x: 4950, y: 568 }, { x: 5170, y: 568 }] },
  { x: 6760, spawn: [{ x: 6820, y: 568 }, { x: 6900, y: 568 }, { x: 6740, y: 568 }, { x: 6960, y: 568 }] }
];

const signs = [
  { x: 300, y: 620, text: 'Tekan ◀ ▶ untuk berjalan. Di HP: tombol besar di kiri.' },
  { x: 700, y: 620, text: 'Tekan LOMPAT untuk melompati celah dan naik ke platform.' },
  { x: 1330, y: 620, text: 'Sardin +50 dan koin +10 masuk ke skor bersama.' },
  { x: 2080, y: 620, text: 'Tombol lantai membuka gerbang. Satu kucing berdiri, satu lewat!' },
  { x: 2830, y: 620, text: 'Tuas ini mengunci gerbang tetap terbuka. Kerja sama yang baik!' },
  { x: 3660, y: 620, text: 'Tuas besar mengaktifkan platform ajaib di atas jurang.' },
  { x: 5050, y: 620, text: 'Lantai es licin! Jaga momentum dan jangan berhenti mendadak.' },
  { x: 5680, y: 620, text: 'Kipas raksasa meniup ke belakang. Lompat melawan angin!' },
  { x: 6780, y: 620, text: 'Peti hadiah tersembunyi di atas. Cari jalan lewat platform kayu.' },
  { x: 8380, y: 620, text: 'Bawa Kunci Emas. Kalian BERDUA harus masuk ke pintu.' }
];

const decor = [
  { type: 'tree', x: 130, y: GROUND, s: 1.15 },
  { type: 'tree', x: 1580, y: GROUND, s: 0.9 },
  { type: 'tree', x: 3330, y: GROUND, s: 1.1 },
  { type: 'tree', x: 4540, y: 480, s: 0.55 },
  { type: 'tree', x: 6840, y: GROUND, s: 1.25 },
  { type: 'tree', x: 9020, y: GROUND, s: 1.0 },
  { type: 'bush', x: 420, y: GROUND, s: 1 },
  { type: 'bush', x: 1040, y: GROUND, s: 0.8 },
  { type: 'bush', x: 1930, y: GROUND, s: 1.1 },
  { type: 'bush', x: 2620, y: GROUND, s: 0.9 },
  { type: 'bush', x: 3400, y: GROUND, s: 1 },
  { type: 'bush', x: 5290, y: GROUND, s: 0.85 },
  { type: 'bush', x: 6600, y: GROUND, s: 1 },
  { type: 'bush', x: 7890, y: GROUND, s: 1.15 },
  { type: 'bush', x: 8840, y: GROUND, s: 1 },
  { type: 'rock', x: 920, y: GROUND, s: 0.9 },
  { type: 'rock', x: 2510, y: GROUND, s: 0.7 },
  { type: 'rock', x: 6950, y: GROUND, s: 0.8 },
  { type: 'rock', x: 5250, y: GROUND, s: 0.65 },
  { type: 'flowers', x: 760, y: GROUND, s: 1 },
  { type: 'flowers', x: 1480, y: GROUND, s: 1.2 },
  { type: 'flowers', x: 2210, y: GROUND, s: 1 },
  { type: 'flowers', x: 3270, y: GROUND, s: 1 },
  { type: 'flowers', x: 6760, y: GROUND, s: 1 },
  { type: 'flowers', x: 7960, y: GROUND, s: 1.2 },
  { type: 'flowers', x: 8600, y: GROUND, s: 0.9 },
  { type: 'signpost', x: 1500, y: GROUND, s: 1 },
  { type: 'mushroom', x: 2360, y: GROUND, s: 0.9 },
  { type: 'mushroom', x: 6350, y: GROUND, s: 0.8 },
  { type: 'cattail', x: 4560, y: 840, s: 1 }
];

export const LEVEL = {
  id: 'lembah-sardin',
  name: 'Lembah Sardin',
  subtitle: 'Petualangan dua kucing mengejar sardin emas',
  width: 9160,
  waterY: 800,
  waterSpans: [{ x: 3840, y: 800, w: 920, h: 500 }],
  bounds: { minX: -80, maxX: 9160 },
  spawn: {
    p1: { x: 180, y: 568 },
    p2: { x: 270, y: 568 },
    p3: { x: 90, y: 568 },
    p4: { x: 360, y: 568 }
  },
  platforms,
  coins,
  sardines,
  checkpoints,
  signs,
  decor,
  boxes: [{ x: 2000, y: 556 }],
  plates: [{ id: 'plate1', x: 2280, y: 620, w: 150, h: 16, gate: 'gate1' }],
  gates: [{ id: 'gate1', x: 2680, y: 360, w: 48, h: 260, plate: 'plate1' }],
  levers: [
    { id: 'lever1', x: 2870, y: 620, w: 64, h: 80, type: 'latch', gate: 'gate1' },
    { id: 'lever2', x: 3780, y: 620, w: 64, h: 80, type: 'toggle', movers: ['elevator', 'ferry'] }
  ],
  movers: [
    {
      id: 'elevator',
      from: { x: 3980, y: 590 },
      to: { x: 3980, y: 360 },
      w: 170,
      h: 26,
      speed: 92
    },
    {
      id: 'ferry',
      from: { x: 4700, y: 360 },
      to: { x: 4460, y: 360 },
      w: 160,
      h: 26,
      speed: 128
    }
  ],
  fans: [
    {
      id: 'fan1',
      x: 5800,
      y: 330,
      w: 130,
      h: 290,
      dir: -1,
      force: 1150,
      zone: { x: 5150, y: 360, w: 650, h: 270 }
    },
    {
      id: 'fan2',
      x: 6500,
      y: 452,
      w: 120,
      h: 168,
      dir: -1,
      force: 1450,
      zone: { x: 6150, y: 452, w: 350, h: 175 }
    }
  ],
  chest: { x: 7490, y: 210, w: 160, h: 120 },
  door: { x: 8560, y: 400, w: 170, h: 220 }
};
