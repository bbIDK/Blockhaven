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

## Play with friends

One player hosts: open a world, press `Esc` and choose **Open to Friends**. Everyone else chooses **Multiplayer** on the title screen.

- **On claude.ai:** share the page with your friends (they need to be signed in). The host picks **Open on This Page**, and the world shows up in everyone's Multiplayer list. Hosting there needs permission to interact with the page; anyone who can open it can join.
- **Anywhere else** (GitHub Pages, the downloaded file, a local server): the host picks **Get a Join Code** and gets a six-letter code; friends type it under Multiplayer. This connects your browsers directly (WebRTC), using the free PeerJS server to find each other, so it needs an internet connection.

The host's game runs the world: mobs, items, TNT, water, furnaces, time and weather. Guests see the same terrain and everything that changes, and everyone sees each other's characters, with name tags, armour and what they're holding. Chests and furnaces are shared, chat works with `T`, players can hit each other (the host can turn that off with `/pvp off`), and the night only passes when everyone is in bed. When a guest leaves, the host's world keeps their inventory for next time. Keep the host's tab open while you play; the world lives there.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Walk |
| Mouse | Look around (click the game to capture the mouse) |
| Left click | Break block (hold to mine in Survival), attack |
| Right click | Place block; use crafting tables, furnaces, chests, doors, beds and levers; put on armor; light fires and TNT with flint and steel; talk and trade with villagers; get into boats and minecarts, onto horses; cast a fishing rod; feed, tame, saddle, lead and name creatures |
| Hold right click | Eat or drink what you're holding, draw a bow, raise a shield |
| Middle click | Pick the block you're looking at |
| `Space` | Jump. Double-tap to toggle flying in Creative |
| `Shift` | Sneak (you won't fall off edges) / fly down |
| `Ctrl` or double-tap `W` | Sprint |
| `1`–`9`, mouse wheel | Choose hotbar slot |
| `E` | Inventory (armor, 2×2 crafting, recipe book) |
| `Q` | Drop the held item (`Ctrl+Q` drops the stack) |
| `T`, `Enter` or `/` | Chat and commands |
| `F3` | Coordinates and debug info |
| `F1` | Hide the HUD |
| `Esc` | Game menu (with Open to Friends) |

In inventories, crafting tables, furnaces and chests the clicks work like Minecraft's: left click takes or places a stack, right click takes half or places one, `Shift`+click moves a stack across (on a crafting result it crafts as many as you can), dragging a stack across slots shares it out evenly (right-drag places one in each), double-click gathers a stack, number keys swap with the hotbar and `Q` throws the item under the mouse. On touch screens, tap is a left click and a long press a right click.

On phones and tablets, on-screen controls appear automatically. The left stick moves you, dragging anywhere else looks around, a tap places a block and holding breaks one.

### Commands

`/help`, `/time set day|noon|night|midnight|<ticks>`, `/time add <ticks>`, `/weather clear|rain [seconds]`, `/gamemode creative|survival`, `/tp <x> <y> <z>` (supports `~`), `/give <item> [count]` (e.g. `/give diamond_pickaxe`), `/locate village`, `/spawn`, `/setspawn`, `/seed`, `/fly`, `/kill`, `/clear`. In multiplayer: `/list` shows who's online and `/pvp on|off` (host only) sets whether players can hurt each other.

## What's in it

- **Endless worlds** from a seed, in 37 biomes: mountain ranges with stony, jagged and frozen peaks, snowy slopes and meadows; plains, flower forests, dark forests, birch and old-growth forests, taiga, jungles, swamps, savannas, badlands, deserts, cherry groves and ice spikes; rivers, beaches and warm, cold and deep oceans. Trees grow big, and there's a flat world option.
- **Underground:** winding caves and caverns, deepslate, ores by depth (coal, copper, iron, gold, lapis, redstone, diamond, emerald), lava lakes, and dungeons with loot chests. On the surface you'll also find desert wells, icebergs, boulders and fallen trees.
- **Walled villages:** stone walls with corner towers, a gatehouse on every side and a walk along the top, streets and a market square with a well, and some thirty kinds of buildings: houses, a smithy, butcher's, hunter's lodge, library, inn, bakery, farms, pens and a mine.
- **Villagers who talk and trade:** friendly people with jobs (merchant, guard, blacksmith, butcher, hunter, librarian, innkeeper, baker, farmer, shepherd, miner and fisher). They go about their day, chat when you talk to them, and buy and sell for gold coins. Iron golems and cats live there too.
- **Creatures:** pigs, cows, sheep, chickens, rabbits, foxes, goats, horses, donkeys, llamas, cats, parrots, turtles, bats, wolves and polar bears; squid, cod, salmon and dolphins in the water; and zombies, husks, drowned, skeletons, strays, creepers, spiders, cave spiders, slimes, endermen, witches and phantoms. They all share one Minecraft-style look, flash red when hit (the living ones bleed), and drop what you'd expect.
- **Pets and golems:** tame wolves with bones, cats with fish and parrots with seeds; they follow you, sit when told and defend you. Build iron golems from four iron blocks and a pumpkin, and snow golems from two snow blocks and a pumpkin.
- **339 blocks and hundreds of items**, with 362 recipes. Every block, item and creature is drawn in one consistent pixel-art style.
- **Crafting like Minecraft:** shaped recipes in a 2×2 grid in your inventory and a 3×3 grid at a crafting table, with a recipe book that lists what you can make and lays recipes out for you (recipes you're missing things for show as a faint "ghost" in the grid).
- **Furnaces:** put something in the top slot and fuel in the bottom one. They smelt ores, cook meat, bake sand into glass and clay into bricks, turn logs into charcoal, keep going while you're away, and glow while they burn.
- **Farming:** hoes and farmland, wheat, carrots, potatoes and beetroots, saplings that grow into trees, bone meal and composters.
- **Building:** slabs, stairs, doors, trapdoors, fence gates, ladders, fences, walls, glass panes and more. Also levers, buttons, pressure plates and redstone lamps, and signs you can write on.
- **Fire and fluids:** flint and steel lights fires that spread through wood and leaves and burn out. Water spreads quickly and lava slowly, as in Minecraft, and where they meet you get obsidian, cobblestone or stone. Sand and gravel fall smoothly as blocks. TNT explosions chain.
- **Chests and beds:** two chests side by side make a double chest. Sleeping in a bed sets your spawn point and skips the night.
- **Combat:** it works like Minecraft 1.9 onwards. Each weapon winds up again after a swing (swords quickly, axes slowly, shown by a meter under the crosshair), and fully wound-up hits while falling are critical hits. There are bows and arrows, and a shield to block with.
- **Armor:** leather, chainmail, iron, gold and diamond, with Minecraft's damage reduction and wear. Your character wears it, and so do other players.
- **Experience and enchanting:** orbs and levels, an enchanting table with 24 enchantments, and anvils and grindstones.
- **Potions:** 12 kinds, to drink or throw as splash potions. Witches throw them at you, and status effects show on the HUD.
- **Getting about:** boats, horses, donkeys and mules to tame and saddle, and minecarts on rails, including powered and detector rails.
- **Fishing:** cast, wait for a bite, and reel in fish, junk or treasure.
- **And more:** cake, name tags and leads, item frames, 15 paintings, flower pots, note blocks, and a jukebox with 8 music discs.
- **Shaders:** **Options → Shaders** (Low or High) adds sunlight with soft shadows, glinting water, a glowing sky, bloom and light shafts.
- **Multiplayer:** host a world for your friends from the game menu, on claude.ai or with a join code (see [Play with friends](#play-with-friends)).
- **Weather:** rain showers come and go, with streaks of rain, splashes, a grey sky and the sound of rain (quieter indoors). It snows in cold biomes and high up, and deserts stay dry. Sleeping clears the weather.
- **Survival:** health, hunger (sprinting, jumping, fighting and mining make you hungry, and you only heal when well fed), fall damage, drowning, fire and lava, and mining speeds that depend on the tool and block.
- **Creative:** every block, flying, instant breaking, and a searchable inventory.
- **Interface:** menus, HUD and inventories styled after the classic game (bevelled buttons, sliders with their value written on them, a pixel-art logo with splash text) and all drawn to one GUI scale. **Options → GUI Scale** makes the whole interface bigger or smaller; Auto picks the largest size that fits, like the original.
- **Sound and music:** recorded sounds for every block material, creatures, weapons, doors, chests, furnaces, eating, explosions and rain, positioned in 3D and muffled underwater. The soundtrack is calm piano music composed while you play, with a piano synthesised in the browser.
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
src/blocks.js       block registry;  src/items.js items, tools and armor;  src/crafting.js recipes, smelting, fuel
src/containers.js   inventory, crafting table, furnace and chest screens (slot rules);  src/furnace.js smelting
src/gui.js          the Minecraft-style container windows and recipe book;  src/preview.js your character in the inventory
src/textures.js     procedural pixel-art textures
src/entities.js     mobs, dropped items, TNT;  src/player.js, src/body.js physics
src/net.js          multiplayer transports (claude.ai room, PeerJS join codes) and reliable message streams
src/multiplayer.js  hosting and joining: world, entity, chest and player sync;  src/avatars.js other players
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
