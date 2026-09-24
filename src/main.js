import { Game } from './game.js';
import { $ } from './ui.js';

function fail(message) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== 'screen-error';
  $('error-text').textContent = message;
}

try {
  const game = new Game();
  window.blockhaven = game;
  game.renderer.onLost = () => {
    game.save();
    fail('The graphics driver was reset. Your world was saved — reload the page to keep playing.');
  };
  const hot = window.claude?.hot;
  try {
    hot?.snapshot?.(() => { game.save(); return { worldId: game.meta?.id ?? null }; });
  } catch { /* hot reload is optional */ }
  const boot = (data) => game.start(data ?? {});
  if (hot?.ready) hot.ready(boot);
  else boot(hot?.data ?? {});
} catch (err) {
  console.error(err);
  fail(/WebGL/.test(err.message)
    ? 'This game needs WebGL 2, which your browser or device doesn’t support. Try a recent Chrome, Edge, Firefox or Safari.'
    : `Something went wrong while starting: ${err.message}`);
}
