// Shared gameplay constants.
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PHYS = {
  gravity: 2350,
  maxFall: 1500,
  speed: 330,
  groundAccel: 3100,
  airAccel: 1950,
  friction: 3400,
  iceFriction: 240,
  iceAccel: 1250,
  jump: -815,
  jumpCut: 2.15,
  coyote: 0.1,
  buffer: 0.14,
  pushSpeed: 300
};

export const PLAYER_SIZE = { w: 54, h: 52 };
export const BOX_SIZE = 64;

export const PLAYERS = [
  {
    id: 0,
    slot: 1,
    name: 'Kucing Oranye',
    short: 'P1',
    fur: '#f59e42',
    furDark: '#d97724',
    furLight: '#ffb86b',
    belly: '#ffe7cf',
    inner: '#ffc9a3',
    blush: '#ff8f8f',
    stripe: '#c2651a',
    key: '#ffcf5c'
  },
  {
    id: 1,
    slot: 2,
    name: 'Kucing Abu-abu',
    short: 'P2',
    fur: '#a8b3c4',
    furDark: '#7c8899',
    furLight: '#c8d2df',
    belly: '#eef3f9',
    inner: '#dbe3ee',
    blush: '#f0a8b8',
    stripe: '#6b7688',
    key: '#9ad7ff'
  },
  {
    id: 2,
    slot: 3,
    name: 'Kucing Putih',
    short: 'P3',
    fur: '#f1f5f9',
    furDark: '#cbd5e1',
    furLight: '#ffffff',
    belly: '#ffffff',
    inner: '#e2e8f0',
    blush: '#fb7185',
    stripe: '#94a3b8',
    key: '#fb7185'
  },
  {
    id: 3,
    slot: 4,
    name: 'Kucing Hitam',
    short: 'P4',
    fur: '#334155',
    furDark: '#1e293b',
    furLight: '#475569',
    belly: '#64748b',
    inner: '#475569',
    blush: '#c084fc',
    stripe: '#0f172a',
    key: '#c084fc'
  }
];

export const PALETTE = {
  ink: '#3a2416',
  inkSoft: '#5b3a22',
  cream: '#fff7e6',
  grass: '#65c95a',
  grassDark: '#3f9e46',
  grassLight: '#93e06f',
  dirt: '#b97a4b',
  dirtDark: '#8d5733',
  dirtLight: '#d99b68',
  stone: '#8f9aa8',
  stoneDark: '#616d7c',
  stoneLight: '#b9c3cf',
  wood: '#c98b52',
  woodDark: '#8f5a2f',
  ice: '#b9edfa',
  iceDark: '#6fc3dc',
  iceLight: '#eefcff',
  gold: '#ffcf5c',
  goldDark: '#d99a1f',
  water: '#4ab8e8',
  waterDeep: '#2b7fbf',
  leaf: '#3f9e46',
  leafLight: '#7ed36a'
};
