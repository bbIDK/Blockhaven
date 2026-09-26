# Blockhaven

A block-building sandbox game that runs in your web browser. Explore an endless generated world, mine and craft in Survival, or build freely in Creative. It needs no installs and no plugins. It's written from scratch in plain JavaScript and WebGL 2. It looks the part with an openly licensed Minecraft-style texture pack (Pixel Perfection), the music is composed live, and the sound effects are public-domain recordings.

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
| `Ctrl` or double-tap `W` | Sprint; with your head under water, swim (you glide the way you look) |
| `1`–`9`, mouse wheel | Choose hotbar slot |
| `E` | Inventory (armor, 2×2 crafting, recipe book) |
| `Q` | Drop the held item (`Ctrl+Q` drops the stack) |
| `T`, `Enter` or `/` | Chat and commands |
| `F3` | Coordinates and debug info |
| `F1` | Hide the HUD |
| `F5` | Camera: through your eyes, from behind, from in front |
| `Esc` | Game menu (with Open to Friends) |

In inventories, crafting tables, furnaces and chests the clicks work like Minecraft's: left click takes or places a stack, right click takes half or places one, `Shift`+click moves a stack across (on a crafting result it crafts as many as you can), dragging a stack across slots shares it out evenly (right-drag places one in each), double-click gathers a stack, number keys swap with the hotbar and `Q` throws the item under the mouse. On touch screens, tap is a left click and a long press a right click.

On phones and tablets, on-screen controls appear automatically. The left stick moves you, dragging anywhere else looks around, a tap places a block and holding breaks one.

### Commands

`/help`, `/time set day|noon|night|midnight|<ticks>`, `/time add <ticks>`, `/weather clear|rain [seconds]`, `/gamemode creative|survival`, `/tp <x> <y> <z>` (supports `~`), `/give <item> [count]` (e.g. `/give diamond_pickaxe`, `/give tiger_spawn_egg`), `/summon <creature> [x y z]` (e.g. `/summon elephant`), `/locate village|camp|hamlet|town|kingdom`, `/spawn`, `/setspawn`, `/seed`, `/fly`, `/kill`, `/clear`. In multiplayer: `/list` shows who's online and `/pvp on|off` (host only) sets whether players can hurt each other.

## What's in it

- **Endless worlds** from a seed, in 42 biomes: mountain ranges with stony, jagged and frozen peaks, snowy slopes and meadows; plains, flower forests, dark forests, birch and old-growth forests, taiga, jungles, swamps, savannas, badlands, deserts, cherry groves and ice spikes; rivers, beaches, and warm, lukewarm, temperate, cold and frozen oceans (deep ones too). Biomes are big, with ragged natural edges between them, and some are rare: badlands and ice spikes turn up far less often than forests and plains, and jungles grow thickets of bamboo. Grass, leaves and water shade gradually over a wide band from one biome's colours into the next's, and under water the sea takes on its own colour, turquoise in warm seas, deep blue in cold ones and murky green in swamps. Trees grow big (the giant spruces of the old-growth taiga close their crowns over the tops of their trunks, as Minecraft's do), and there's a flat world option. (Worlds made before the biome update keep their old biomes.)
- **Oceans:** wide seas with islands out in them, each with a sandy beach, palm trees and a green heart of jungle or woods. Warm seas grow coral reefs (coral trees, mushrooms and claws in five colours, with coral fans and glowing sea pickles on them), cooler ones kelp forests reaching up to the surface, and seagrass grows in meadows almost everywhere. They're full of life: schools of tropical fish of sixteen kinds and pufferfish (which puff up and sting) around the reefs, cod, salmon, squid and dolphins, sharks that go for anyone swimming near, and humpback and blue whales, as big as the real ones, which come up to blow and leave you be unless you hurt them. Kelp dries in a furnace into a quick snack, bone meal grows seagrass and coral, and sharks give meat and teeth. (Worlds made before the ocean update keep their old seas.)
- **Underground:** great caverns held up by stone pillars, tunnels of every width winding between them with narrow passages off those, deep ravines, underground lakes, and a sea of lava at the very bottom where the distance fades to darkness. Thick deepslate with tuff in it, great veins of copper and iron, and ores by depth (coal, copper, iron, gold, lapis, redstone, diamond, emerald) in veins sized like Minecraft's: each ore has its own, and the big ones are rare (most diamond veins hold three to five, but now and then you'll find a dozen together). Caves of their own kinds, rarer than the plain ones: dripstone caves full of stalactites and stalagmites, lush caves with moss, azaleas, big dripleaves, spore blossoms and vines hung with glow berries (and azalea trees growing above them), and amethyst geodes; glow lichen on the walls, and cobwebs to get stuck in. The tunnels mostly close up before they reach the surface, so the land isn't riddled with holes, but here and there one opens out into a cave mouth. Dungeons hold loot chests. (Worlds made before the cave update keep their old caves, and those made before the world-fix update keep their old ores, cave kinds and cave mouths.) On the surface you'll also find desert wells, icebergs, boulders and fallen trees.
- **Settlements of every size, no two alike:** tents round a campfire in the woods (hunters', woodcutters' and travellers' camps); hamlets of a few houses behind a fence, a dry-stone wall or a log palisade with watchtowers; walled villages; towns with tall walls, towers along them, a grid of streets, a church and a market square with a fountain; and kingdoms, whose great walls under spired towers ring a city with a castle at its heart. Each picks its own shape, walls, streets, roofs and stone from the land it stands in, and the bigger it is, the more people live there. Their ground eases gently back into the land around them, so you can walk up to every gate, and a road runs out of each one, fading away into the countryside. (Worlds made before this keep their walled villages; those made before the world-fix update keep their steeper edges.)
- **Castles:** a curtain wall with round towers, a gatehouse with a portcullis, knights' barracks, an armoury, stables and a chapel round the courtyard, and a keep whose great hall has the thrones of the king and queen under a canopy, windows glazed in the kingdom's colour, and a wide stairwell up to the royal rooms: the library, the king and queen's bedchamber with its four-poster bed, and the treasury, a strongroom behind an iron door (press the button beside it) with a knight on guard outside. (Castles in worlds made before the world-fix update keep their old keep.)
- **Buildings:** some forty kinds - cottages, long houses, terraces, manors, a smithy, butcher's, hunter's lodge, library, inn, bakery, church, stables, mason's yard, windmill, farms, pens and a mine.
- **People who talk and trade:** friendly folk with jobs (merchant, guard, blacksmith, butcher, hunter, librarian, innkeeper, baker, farmer, shepherd, miner, fisher, woodcutter, mason, stablehand, cleric, traveller - and in kingdoms the king, the queen and their knights). They go about their day at their trades (farmers harvest ripe crops and sow them again, woodcutters and miners work at the trees and the stone, smiths at the anvil and forge, librarians among the books, fishers at the water's edge, shepherds and stablehands with their animals), chat when you talk to them, and buy and sell for gold coins. The king and queen hold court from their thrones and never leave their keep. Iron golems and cats live there too, and only farm animals wander inside the walls. Hurt anyone there (or their golem), or be seen taking from their chests, and the guards and knights come after you, until you get far enough away. The dead stay dead: a village that loses people is smaller when you come back, and one that loses everyone lies abandoned.
- **Creatures:** pigs, cows, sheep, chickens, rabbits, foxes, goats, horses, donkeys, llamas, cats, parrots, turtles, bats and wolves; squid, cod, salmon, tropical fish, pufferfish, dolphins, sharks and whales in the water; and zombies, husks, drowned, skeletons, strays, creepers, spiders, cave spiders, slimes, endermen and witches (phantoms don't come out at night; you can still hatch one from a spawn egg). They all share one Minecraft-style look, flash red when hit (the living ones bleed), and drop what you'd expect.
- **Wildlife, each where it belongs:** deer (stags with antlers), brown and black bears and wild boar in the woods; moose in the northern forests; polar bears on the ice and penguins on snowy shores; elephants, zebras, giraffes, lions and hippos on the savanna; tigers, pandas and elephants in the jungle; crocodiles in the swamps; camels in the desert. Bears, polar bears, tigers, lions and crocodiles come for anyone who strays too near (big cats creep up low, then spring) and give up if you get far enough away; their young don't, and a mother defends hers. Elephants, hippos, moose and boar leave you be unless you hurt one, and then the herd turns on you. Tame an elephant, a zebra or a camel the way you would a horse, saddle it and ride it (high up on an elephant's back). Deer bolt, and each animal drops its own meat and hide (venison, bear meat, pork, leather, feathers; pandas drop bamboo, which you can plant). Wolves and foxes wear coats to suit where they live.
- **Birds and insects:** robins, blue jays, cardinals, sparrows and goldfinches flit about the woods and fields (and fly off if you come near), crows gather in the open, gulls wheel over the shore, and eagles and vultures circle high overhead; butterflies and bees drift among the flowers (swat a bee and the whole swarm stings you), and on warm nights fireflies blink over the meadows, woods and swamps.
- **Pets and golems:** tame wolves with bones, cats with fish and parrots with seeds; they follow you, sit when told and defend you. Build iron golems from four iron blocks and a pumpkin, and snow golems from two snow blocks and a pumpkin.
- **384 blocks and hundreds of items**, with 377 recipes. Every block, item and creature is drawn in one consistent pixel-art style.
- **Crafting like Minecraft:** shaped recipes in a 2×2 grid in your inventory and a 3×3 grid at a crafting table, with a recipe book that lists what you can make and lays recipes out for you (recipes you're missing things for show as a faint "ghost" in the grid).
- **Furnaces:** put something in the top slot and fuel in the bottom one. They smelt ores, cook meat, bake sand into glass and clay into bricks, turn logs into charcoal, keep going while you're away, and glow while they burn.
- **Farming:** hoes and farmland, wheat, carrots, potatoes and beetroots, saplings that grow into trees, bone meal and composters.
- **Building:** slabs, stairs (which turn corners where they meet, like Minecraft's), doors, trapdoors, fence gates, ladders, fences, walls, glass panes and more. Also levers, buttons, pressure plates and redstone lamps, and signs you can write on.
- **Fire and fluids:** flint and steel lights fires that spread through wood and leaves and burn out. Water spreads quickly and lava slowly, as in Minecraft, and where they meet you get obsidian, cobblestone or stone. Sand and gravel fall smoothly as blocks. TNT explosions chain.
- **Chests and beds:** two chests side by side make a double chest. Sleeping in a bed sets your spawn point and skips the night.
- **Combat:** it works like Minecraft 1.9 onwards. Each weapon winds up again after a swing (swords quickly, axes slowly, shown by a meter under the crosshair), and fully wound-up hits while falling are critical hits. There are bows and arrows, and a shield to block with.
- **Armor:** leather, chainmail, iron, gold and diamond, with Minecraft's damage reduction and wear. Your character wears it, and so do other players.
- **Experience and enchanting:** orbs and levels, an enchanting table with 24 enchantments, and anvils and grindstones.
- **Potions:** 12 kinds, to drink or throw as splash potions. Witches throw them at you, and status effects show on the HUD.
- **Getting about:** boats (which glide and turn smoothly), horses (seven coats, with or without markings), donkeys and mules to tame and saddle, and minecarts on rails, including powered and detector rails. Breed a horse with a donkey for a mule.
- **Breeding:** feed two animals of a kind their food and love hearts float over them until they meet and have a baby; tamed animals show hearts too.
- **Fishing:** cast, wait for a bite, and reel in fish, junk or treasure.
- **And more:** cake, name tags and leads, item frames, 15 paintings, flower pots, note blocks, and a jukebox with 8 music discs.
- **Shaders:** **Options → Shaders** (Low or High) adds sunlight with soft shadows, glinting water, a glowing sky, bloom and light shafts.
- **Multiplayer:** host a world for your friends from the game menu, on claude.ai or with a join code (see [Play with friends](#play-with-friends)).
- **Swimming:** sprint with your head under water to swim like in Minecraft, gliding the way you look with Minecraft's breaststroke. Jump or fall in and there's a proper splash. **F5** shows you from behind or in front, sneaking with Minecraft's crouch.
- **Weather:** rain showers come and go, with streaks of rain, splashes, a grey sky and the sound of rain (quieter indoors). It snows in cold biomes and high up; deserts, savannas and badlands stay dry. Sleeping clears the weather.
- **Survival:** health, hunger (sprinting, jumping, fighting and mining make you hungry, and you only heal when well fed), fall damage, drowning, fire and lava, and mining times that match Minecraft's for every tool and block (with its short pause between one block and the next).
- **Creative:** every block, flying, instant breaking, a searchable inventory with Minecraft's tabs, and a spawn egg for every creature (use it on the ground, or on water for sea life; in Survival they're had only by command).
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
src/worldgen.js     terrain, biomes, ores, trees;  src/cavegen.js the caves and what grows in them;  src/caves.js dripstone and vines
src/oceangen.js     the sea floor: coral reefs, kelp forests, seagrass;  src/tropical.js the kinds of tropical fish
src/mobs.js         creatures: what each is, how it behaves and moves;  src/rigs.js, src/wildrigs.js their models
src/mesher.js       turns chunk sections into vertex data (face culling, AO, smooth light)
src/light.js        per-chunk light flood fill (runs in workers)
src/renderer.js     WebGL 2 renderer: terrain, sky, clouds, entities, particles, held item
src/blocks.js       block registry;  src/items.js items, tools and armor;  src/crafting.js recipes, smelting, fuel
src/containers.js   inventory, crafting table, furnace and chest screens (slot rules);  src/furnace.js smelting
src/gui.js          the Minecraft-style container windows and recipe book;  src/preview.js your character in the inventory
src/textures.js     the block and item textures (imported ones from src/tex/packdata.js, the rest drawn in src/tex/)
src/skins.js        creature skins, laid out Minecraft's way (imported, or drawn in src/tex/mobskins.js)
src/entities.js     mobs, dropped items, TNT;  src/player.js, src/body.js physics
src/net.js          multiplayer transports (claude.ai room, PeerJS join codes) and reliable message streams
src/multiplayer.js  hosting and joining: world, entity, chest and player sync;  src/avatars.js other players
src/audio.js        sound effects;  src/music.js generative piano music;  src/weather.js rain and snow
src/sounddata.js    the sound recordings (generated from assets/sounds by tools/pack-sounds.mjs)
src/ui.js, icons.js, inventory.js, touch.js, input.js, storage.js, sky.js, ...
assets/sounds/      the sound effects as MP3s, with their sources in CREDITS.md
assets/textures/    the imported block and item textures (16x16 PNGs named after the game's), assets/skins/ the
                    creature skins (64x64); where each came from is in assets/CREDITS.md
tools/build.mjs     bundles everything into dist/blockhaven.html
tools/prepare_sounds.py  downloads, trims and encodes the sounds (needs Python, numpy, imageio-ffmpeg)
tools/import-textures.mjs  makes assets/textures and assets/skins from the resource packs (see texture-sources.mjs)
tools/pack-textures.mjs    packs them into src/tex/packdata.js
```

After changing anything in `src/` or `index.html`, rebuild the single-file version:

```sh
node tools/build.mjs
```

The bundler has no dependencies. It needs Node 18 or newer. After changing the MP3s in `assets/sounds`, run `node tools/pack-sounds.mjs` to regenerate `src/sounddata.js`.

### Textures

The textures come from two openly licensed resource packs: [Pixel Perfection](https://github.com/Athemis/PixelPerfectionCE) (in its Community Edition) and, for the newest blocks (deepslate, copper, cherry wood, and the cave blocks: tuff, dripstone, moss, lush-cave plants, glow lichen and amethyst), [Mineclonia](https://codeberg.org/mineclonia/mineclonia). To import them again, check both out and run

```sh
node tools/import-textures.mjs <PixelPerfectionCE checkout> <mineclonia checkout>
node tools/pack-textures.mjs
```

`tools/texture-sources.mjs` and `tools/skin-sources.mjs` say which picture each of the game's textures and skins comes from (and how it's cut to fit). Anything with no source there is drawn by the game's own code in `src/tex/`, as a fallback. To change a texture by hand, edit its PNG in `assets/textures` (or `assets/skins`) and run `node tools/pack-textures.mjs`.

---

Blockhaven is a fan-made game inspired by Minecraft. It's not affiliated with or endorsed by Mojang or Microsoft. Its code and music are original. Its textures are from the Pixel Perfection resource pack by XSSheep and its community (and from Mineclonia for the newest blocks), shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and credited in [`assets/CREDITS.md`](assets/CREDITS.md). Its sound effects are public-domain (CC0) recordings by Kenney and Freesound contributors, credited in [`assets/sounds/CREDITS.md`](assets/sounds/CREDITS.md).
