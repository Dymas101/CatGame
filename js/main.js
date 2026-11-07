import { Game } from './game.js';

const game = new Game();
window.__sardin = game;

game.boot().catch((error) => {
  console.error('Gagal memulai Sardin Quest:', error);
  const loading = document.querySelector('#loading');
  if (loading) {
    const p = loading.querySelector('p');
    if (p) p.textContent = 'Gagal memuat game. Lihat konsol untuk detail.';
  }
});

window.addEventListener('error', (event) => {
  console.error('Runtime error:', event.error || event.message);
});
