# Blockhaven

A block-building sandbox game that runs in your web browser. Explore an endless generated world, mine and craft in Survival, or build freely in Creative. It needs no installs and no plugins. It's written from scratch in plain JavaScript and WebGL 2. Every texture is drawn by code, the music is composed live, and the sound effects are public-domain recordings.

## Play it

Pick whichever is easiest:

- **Offline, no setup:** download [`dist/blockhaven.html`](dist/blockhaven.html) and double-click it. The whole game is in that one file.
- **From this repo on GitHub Pages:** in the repository settings open **Pages**, set the source to "Deploy from a branch", and choose this branch and the root folder. After a minute the game is live at `https://<your-user>.github.io/<repo>/`.
- **Locally while editing the code:** serve the folder with any static server and open it:
  ```sh
  python3 -m http.server 8000     # then open http://localhost:8000
  ```
  (Opening `index.html` directly from disk won't work in most browsers, because it loads ES modules. Use the server, or the single-file build.)

Worlds save automatically in your browser (IndexedDB), on that device only.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Walk |
| Mouse | Look around (click the game to capture the mouse) |
| Left click | Break block (hold to mine in Survival), attack |
| Right click | Place block, open doors and chests, sleep in a bed, light TNT with flint and steel |
| Hold right click | Eat the food you're holding (when hungry) |
| Middle click | Pick the block you're looking at |
| `Space` | Jump. Double-tap to toggle flying in Creative |
| `Shift` | Sneak (you won't fall off edges) / fly down |
| `Ctrl` or double-tap `W` | Sprint |
| `1`–`9`, mouse wheel | Choose hotbar slot |
| `E` | Inventory and crafting |
| `Q` | Drop the held item (`Ctrl+Q` drops the stack) |
| `T`, `Enter` or `/` | Chat and commands |
| `F3` | Coordinates and debug info |
| `F1` | Hide the HUD |
| `Esc` | Pause |

On phones and tablets, on-screen controls appear automatically. The left stick moves you, dragging anywhere else looks around, a tap places a block and holding breaks one.

### Commands

`/help`, `/time set day|noon|night|midnight|<ticks>`, `/time add <ticks>`, `/weather clear|rain [seconds]`, `/gamemode creative|survival`, `/tp <x> <y> <z>` (supports `~`), `/give <item> [count]` (e.g. `/give diamond_pickaxe`), `/spawn`, `/setspawn`, `/seed`, `/fly`, `/kill`, `/clear`.

## What's in it

- **Endless worlds** from a seed: continents and oceans, rivers, beaches, plains, forests, birch forests, taiga, snowy taiga, deserts, mountains with snowy peaks, and a flat world option.
- **Underground:** winding cave tunnels and caverns, lava lakes deep down, coal, iron, gold and diamond ore veins.
- **Minecraft-style lighting:** sunlight and block light flood-fill through the world, smooth lighting with ambient occlusion, torches, glowstone and jack o'lanterns. There's also a day/night cycle with a sun, moon, stars and drifting clouds.
- **60+ blocks:** logs that face the way you place them, wall torches, glass, wool colors, bricks, bookshelves, furnaces, TNT, flowers, sugar cane and cacti.
- **Shaped blocks:** slabs (stack two into a full block), stairs you can walk up, doors that open, climbable ladders, fences that connect and can't be jumped, and glass panes.
- **Chests and beds:** chests store 27 stacks and spill their contents when broken. Sleep in a bed at night to skip to morning and make it your respawn point.
- **Physics:** flowing water that spreads and falls, sand and gravel that fall, water that hardens lava into obsidian, and TNT explosions that chain.
- **Weather:** rain showers come and go, with streaks of rain, splashes, a grey sky and the sound of rain (quieter indoors). It snows in cold biomes and high up, and deserts stay dry. Sleeping clears the weather.
- **Survival:** health, hunger (sprinting, jumping, fighting and mining make you hungry, and you only heal when well fed), fall damage, drowning, lava, cacti, and mining speeds that depend on the tool and block. There are wooden to diamond (and golden) pickaxes, axes, shovels and swords, critical hits when you strike while falling, and shapeless crafting that uses a nearby crafting table or furnace.
- **Creatures:** pigs, sheep, cows and chickens wander the grasslands and drop food (cook it in a furnace), leather, feathers and wool. In Survival, zombies come out at night and in dark caves, and burn in sunlight unless it's raining. Mobs flash red and get knocked back when hit, and fall over and vanish in a puff of smoke when they die.
- **Creative:** every block, flying, instant breaking, and a searchable inventory.
- **Sound and music:** recorded sounds for every block material (breaking, placing, footsteps), doors, chests, eating, animals, zombies, explosions and rain, positioned in 3D and muffled underwater. The soundtrack is calm piano music composed while you play, with a piano synthesised in the browser.
- **Held items:** tools and blocks are held, swung and switched the way the original game does it.
- **Performance:** terrain generation and meshing run in Web Workers. Chunks stream in around you, with finished chunks applied a few milliseconds' worth per frame. Cave culling skips sections you can't see into, faces pointing away from the camera are skipped, and the Auto resolution setting lowers the render scale when frames run slow.

## Project layout

```
index.html          page, menus and HUD markup
src/style.css       interface styling
src/main.js         entry point
src/game.js         game states, main loop, player actions, survival rules, commands
src/world.js        chunk streaming, block access, lighting updates, water and sand ticks
src/worldgen.js     terrain, biomes, caves, ores, trees
src/mesher.js       turns chunk sections into vertex data (face culling, AO, smooth light)
src/light.js        per-chunk light flood fill (runs in workers)
src/renderer.js     WebGL 2 renderer: terrain, sky, clouds, entities, particles, held item
src/blocks.js       block registry;  src/items.js items, tools and recipes
src/textures.js     procedural pixel-art textures
src/entities.js     mobs, dropped items, TNT;  src/player.js, src/body.js physics
src/audio.js        sound effects;  src/music.js generative piano music;  src/weather.js rain and snow
src/sounddata.js    the sound recordings (generated from assets/sounds by tools/pack-sounds.mjs)
src/ui.js, icons.js, inventory.js, touch.js, input.js, storage.js, sky.js, ...
assets/sounds/      the sound effects as MP3s, with their sources in CREDITS.md
tools/build.mjs     bundles everything into dist/blockhaven.html
tools/prepare_sounds.py  downloads, trims and encodes the sounds (needs Python, numpy, imageio-ffmpeg)
```

After changing anything in `src/` or `index.html`, rebuild the single-file version:

```sh
node tools/build.mjs
```

The bundler has no dependencies. It needs Node 18 or newer. After changing the MP3s in `assets/sounds`, run `node tools/pack-sounds.mjs` to regenerate `src/sounddata.js`.

---

Blockhaven is a fan-made game inspired by Minecraft. It's not affiliated with or endorsed by Mojang or Microsoft. Its code, textures and music are original, and its sound effects are public-domain (CC0) recordings by Kenney and Freesound contributors, credited in [`assets/sounds/CREDITS.md`](assets/sounds/CREDITS.md).
