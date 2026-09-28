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

The title screen shows which update of the game you're running (bottom left). A browser can keep running an old copy for a while after the site is updated (a tab left open, or files it kept); when the site has a newer update, a notice at the top of the title screen and the game menu says so, and its **Update** button saves your world and loads the new one. (`tools/build.mjs` writes `version.json`, which the notice reads; bump `src/version.js` with each update.)

## Play with friends

One player hosts: open a world, press `Esc` and choose **Open to Friends**. Everyone else chooses **Multiplayer** on the title screen.

- **On claude.ai:** share the page with your friends (they need to be signed in). The host picks **Open on This Page**, and the world shows up in everyone's Multiplayer list. Hosting there needs permission to interact with the page; anyone who can open it can join.
- **Anywhere else** (GitHub Pages, the downloaded file, a local server): the host picks **Get a Join Code** and gets a six-letter code, written in two halves like `ACD 479` and without the letters and numbers that are easy to mix up (no 0 or O, 1 or I, 2 or Z, 5 or S, 6 or G, 8 or B); friends type it under Multiplayer. It needs an internet connection, and finds a way through whatever network you're on:
  - First it tries to connect your browsers directly (WebRTC), finding each other through the free PeerJS server. PeerJS now comes with the game rather than from a CDN.
  - Where your routers won't let a direct connection through, it goes by way of the free TURN relays of the [Open Relay Project](https://www.metered.ca/tools/openrelay/). PeerJS's own relays have shut down, which is why codes often failed between different homes before.
  - Where a network allows no direct connection at all (some school and office networks and mobile data), or blocks the PeerJS server, the game goes through a free public MQTT broker over a secure WebSocket, like any web page. It uses [shiftr.io's public broker](https://www.shiftr.io/try/), [EMQX's](https://www.emqx.com/en/mqtt/public-mqtt5-broker) or [HiveMQ's](https://www.hivemq.com/mqtt/public-mqtt-broker/), whichever answers. The host listens every way at once, so friends coming in different ways all play together.

The host's game runs the world: mobs, items, TNT, water, furnaces, time and weather. Guests see the same terrain and everything that changes, and everyone sees each other's characters, with name tags, armour and what they're holding. Chests (a boat's too), furnaces and maps are shared, everyone shows on everyone else's minimap by name, chat works with `T`, players can hit each other (the host can turn that off with `/pvp off`), and the night only passes when everyone is in bed. When a guest leaves, the host's world keeps their inventory for next time. Keep the host's tab open while you play; the world lives there.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Walk |
| Mouse | Look around (click the game to capture the mouse) |
| Left click | Break block (hold to mine in Survival), attack |
| Right click | Place block; use crafting tables, furnaces, chests, doors, beds and levers; put on armor; light fires and TNT with flint and steel or a fire charge; talk and trade with villagers; get into boats and minecarts, onto horses (sneak to open a boat's chest); cast a fishing rod; feed, tame, saddle, lead and name creatures; scoop up fish, axolotls and tadpoles in a bucket of water; shoot a loaded crossbow; set off a firework; make a map; write in a book and quill |
| Hold right click | Eat or drink what you're holding, draw a bow, wind a crossbow, raise a trident to throw, look through a spyglass, raise a shield |
| Middle click | Pick the block you're looking at |
| `Space` | Jump. Double-tap to toggle flying in Creative |
| `Shift` | Sneak (you won't fall off edges) / fly down |
| `Ctrl` or double-tap `W` | Sprint; with your head under water, swim (you glide the way you look) |
| `1`–`9`, mouse wheel | Choose hotbar slot |
| `E` | Inventory (armor, 2×2 crafting, recipe book); sitting in a boat with a chest, its chest |
| `Q` | Drop the held item (`Ctrl+Q` drops the stack) |
| `T`, `Enter` or `/` | Chat and commands |
| `F3` | Coordinates and debug info |
| `F1` | Hide the HUD |
| `F5` | Camera: through your eyes, from behind, from in front |
| `=` / `-` | Zoom the minimap in / out |
| `B` | Mark a waypoint where you stand |
| `U` | The waypoints (also a click or tap on the minimap) |
| `Esc` | Game menu (with Open to Friends) |

In inventories, crafting tables, furnaces and chests the clicks work like Minecraft's: left click takes or places a stack, right click takes half or places one, `Shift`+click moves a stack across (on a crafting result it crafts as many as you can), dragging a stack across slots shares it out evenly (right-drag places one in each), double-click gathers a stack, number keys swap with the hotbar and `Q` throws the item under the mouse. On touch screens, tap is a left click and a long press a right click.

On phones and tablets, on-screen controls appear automatically. The left stick moves you, dragging anywhere else looks around, a tap places a block and holding breaks one.

### Commands

`/help`, `/time set day|noon|night|midnight|<ticks>`, `/time add <ticks>`, `/weather clear|rain [seconds]`, `/gamemode creative|survival`, `/tp <x> <y> <z>` (supports `~`), `/give <item> [count]` (e.g. `/give diamond_pickaxe`, `/give tiger_spawn_egg`), `/summon <creature> [x y z]` (e.g. `/summon elephant`), `/locate village|camp|hamlet|town|kingdom|pyramid|temple|igloo|shipwreck|monument|mineshaft|stronghold`, `/spawn`, `/setspawn`, `/seed`, `/fly`, `/kill`, `/clear`. In multiplayer: `/list` shows who's online and `/pvp on|off` (host only) sets whether players can hurt each other.

## What's in it

- **Endless worlds** from a seed, in 42 biomes: mountain ranges with stony, jagged and frozen peaks, snowy slopes and meadows; plains, flower forests, dark forests, birch and old-growth forests, taiga, jungles, swamps, savannas, badlands, deserts, cherry groves and ice spikes; rivers, beaches, and warm, lukewarm, temperate, cold and frozen oceans (deep ones too). Biomes are big, with ragged natural edges between them, and some are rare: badlands and ice spikes turn up far less often than forests and plains, and jungles grow thickets of bamboo (deep green canes, bare down the stalk and leafy at the top, like Minecraft's). Grass, leaves and water shade gradually over a wide band from one biome's colours into the next's, and under water the sea takes on its own colour, turquoise in warm seas, deep blue in cold ones and murky green in swamps. Trees grow big (the giant spruces of the old-growth taiga close their crowns over the tops of their trunks, as Minecraft's do), no two trees grow into one another, and every trunk stands on the ground, in the water of a swamp, never on a flower or a stalk of bamboo (in worlds made since the tree fix; older worlds keep their trees as they were). There's a flat world option too. (Worlds made before the biome update keep their old biomes.)
- **Oceans:** wide seas with islands out in them, each with a sandy beach, palm trees and a green heart of jungle or woods. Warm seas grow coral reefs (coral trees, mushrooms and claws in five colours, with coral fans and glowing sea pickles on them), cooler ones kelp forests reaching up to the surface, and seagrass grows in meadows almost everywhere. They're full of life: schools of tropical fish of sixteen kinds and pufferfish (which puff up and sting) around the reefs, cod, salmon, squid and dolphins, sharks that go for anyone swimming near, and humpback and blue whales, as big as the real ones, which come up to blow and leave you be unless you hurt them. Whales keep to deep water: one that strays into the shallows turns for the deepest water about, and one washed up slides back in. Kelp dries in a furnace into a quick snack, bone meal grows seagrass and coral, and sharks give meat and teeth. (Worlds made before the ocean update keep their old seas.)
- **Underground:** great caverns held up by stone pillars, tunnels of every width winding between them with narrow passages off those, deep ravines, underground lakes, and a sea of lava at the very bottom where the distance fades to darkness. Thick deepslate with tuff in it, great veins of copper and iron, and ores by depth (coal, copper, iron, gold, lapis, redstone, diamond, emerald) in veins sized like Minecraft's: each ore has its own, and the big ones are rare (most diamond veins hold three to five, but now and then you'll find a dozen together). Caves of their own kinds, rarer than the plain ones: dripstone caves full of stalactites and stalagmites, lush caves with moss, azaleas, big dripleaves, spore blossoms and vines hung with glow berries (and azalea trees growing above them), and amethyst geodes; glow lichen on the walls, and cobwebs to get stuck in. The tunnels mostly close up before they reach the surface, so the land isn't riddled with holes, but here and there one opens out into a cave mouth. Dungeons hold loot chests. (Worlds made before the cave update keep their old caves, and those made before the world-fix update keep their old ores, cave kinds and cave mouths.) On the surface you'll also find desert wells, icebergs, boulders and fallen trees.
- **Structures** (in worlds made since the structures update; older worlds keep their land as it was), each built the way Minecraft builds it:
  - **Desert pyramids:** stepped sandstone with a tower at each front corner (a ladder inside climbs to a hatch in the top) and a hall with a pattern of orange and blue terracotta in its floor. Under the blue block a shaft drops into a buried room with four chests - and a pressure plate in the middle of it, over TNT.
  - **Jungle temples:** three storeys of mossy cobblestone hung with vines. Down in the cellar a tripwire across the passage to one chest fires a dispenser of arrows, hidden behind vines. The other chest is in a vault behind an iron door, which only one of three levers opens.
  - **Igloos** in the snowy plains, with a bed, a furnace and a crafting table. Half hide a trapdoor under the carpet, with a ladder down to a stone-brick cellar with a chest, a cauldron and two barred cells.
  - **Shipwrecks** on the sea floor and run aground on beaches, in six kinds of wood: whole ships upright, upside down or on their sides, or just a bow or a stern, rotting and full of holes, each with a supply chest, a treasure chest and a map chest.
  - **Ocean monuments** of prismarine in the deep ocean, lit by sea lanterns: a hall of nine rooms behind a great open gateway, a tier above it, a crown above that and a wing either side. At its heart, eight blocks of gold shut in dark prismarine; in one room, sponges soaked through (dry them in a furnace; a dry sponge soaks up the water round it). Guardians swim its halls and hold whoever comes near in a beam that turns from purple to yellow as it charges, then hurts; their spikes prick whoever strikes one while it keeps still. Three elder guardians (one in the crown, one in each wing, and they stay dead once killed) lay Mining Fatigue III on everyone near every minute, their ghostly face looming over the screen, so the monument can't just be dug through.
  - **Mineshafts:** abandoned workings deep underground, branching from a room with a dirt floor. Corridors are propped up with posts and beams, some with rails and some thick with cobwebs, with a chest here and there, stairs going down, and plank bridges where they cross a cave. In the badlands they're dark oak.
  - **Strongholds**, three in a ring 640-1280 blocks from the middle of the world, six further out and so on: stone-brick passages with arches, wooden doors, iron doors with a button either side and iron bars, a spiral stair, libraries, prison cells, a fountain, storerooms, and the portal room, where the frame of an end portal stands over a pool of lava.
  - `/locate` finds the nearest of any of them.
- **Settlements of every size, no two alike:** tents round a campfire in the woods (hunters', woodcutters' and travellers' camps); hamlets of a few houses behind a fence, a dry-stone wall or a log palisade with watchtowers; walled villages; towns with tall walls, towers along them, a grid of streets, a church and a market square with a fountain; and kingdoms, whose great walls under spired towers ring a city with a castle at its heart. Each picks its own shape, walls, streets, roofs and stone from the land it stands in, and the bigger it is, the more people live there. Their ground eases gently back into the land around them, so you can walk up to every gate, and a road runs out of each one, fading away into the countryside. (Worlds made before this keep their walled villages; those made before the world-fix update keep their steeper edges.)
- **Castles:** a curtain wall with round towers, a gatehouse with a portcullis, knights' barracks, an armoury, stables and a chapel round the courtyard, and a keep whose great hall has the thrones of the king and queen under a canopy, windows glazed in the kingdom's colour, and a wide stairwell up to the royal rooms: the library, the king and queen's bedchamber with its four-poster bed, and the treasury, a strongroom behind an iron door (press the button beside it) with a knight on guard outside. (Castles in worlds made before the world-fix update keep their old keep.)
- **Buildings:** some forty kinds - cottages, long houses, terraces, manors, a smithy, butcher's, hunter's lodge, library, inn, bakery, church, stables, mason's yard, windmill, farms, pens and a mine.
- **People who talk and trade:** friendly folk with jobs (merchant, guard, blacksmith, butcher, hunter, librarian, innkeeper, baker, farmer, shepherd, miner, fisher, woodcutter, mason, stablehand, cleric, traveller - and in kingdoms the king, the queen and their knights). They go about their day at their trades (farmers harvest ripe crops and sow them again, woodcutters and miners work at the trees and the stone, smiths at the anvil and forge, librarians among the books, fishers at the water's edge, shepherds and stablehands with their animals), chat when you talk to them (in a window with their name, their face and what they say in large, plain print), and buy and sell for gold coins. The king and queen hold court from their thrones and never leave their keep. Iron golems and cats live there too, and only farm animals wander inside the walls. Hurt anyone there (or their golem), or be seen taking from their chests, and the guards and knights come after you, until you get far enough away. The dead stay dead: a village that loses people is smaller when you come back, and one that loses everyone lies abandoned.
- **Creatures:** pigs, cows, sheep, chickens, rabbits, foxes, goats, horses, donkeys, llamas, cats, parrots, turtles (built like Minecraft's: a domed shell, a blunt head and long front flippers), bats and wolves; squid, cod, salmon, tropical fish, pufferfish, dolphins, sharks and whales in the water (and guardians and elder guardians in the ocean monuments); and zombies, husks, skeletons, strays, creepers, spiders, cave spiders, slimes, endermen and witches. Phantoms don't come out at night, and no zombies come up out of the water (nor does a zombie that stays under water turn into a drowned); you can still hatch a phantom or a drowned from a spawn egg. They all share one Minecraft-style look, flash red when hit (the living ones bleed), and drop what you'd expect the moment they die, as in Minecraft, while their body falls over. They walk up slabs, stairs, snow and carpets without hopping and jump up a single block, but don't keep jumping at a fence or a wall they can't get over: they try along it for a way round, and if there isn't one they give up for a while. An animal running from you that comes to a drop, water or a wall runs off along it instead of standing there. If something ever goes wrong with one creature, the rest carry on (a whale coming up for air with the sound on once stopped every creature after it, leaving them standing still and red where they'd been hit, and the game unsaved), and a line in the chat says what went wrong, which helps get it fixed.
- **The wild update's creatures:**
  - **Axolotls** in the pools of lush caves, in pink, brown, gold and pale cyan (and, one young in twelve hundred, a rare blue). They hunt what swims near them (fish, squid, tadpoles, the drowned, guardians), and anyone fighting alongside them gets Regeneration when they make a kill (and loses any Mining Fatigue). Hurt in the water, an axolotl sometimes plays dead, lying on its back and healing; out of the water too long (five minutes, unless it's raining) it dries out. Breed them with a bucket of tropical fish.
  - **Frogs** in the swamps: orange where it's mild, white where it's warm, green where it's cold. They hop and swim, croak, and snap up small slimes with their tongues (leaving a slimeball). Fed slimeballs, two frogs make one pregnant, and she lays **frogspawn** on still water nearby, which hatches into **tadpoles**; they grow up (sooner for slimeballs) into frogs of whatever kind suits where they are then.
  - **Ocelots** in the jungle: wild cats that run from people, unless you hold out raw cod or salmon and come on calmly; feed one and it may come to trust you, and then stays about (and will have kittens). They hunt chickens, and creepers keep well clear of them.
  - **Glow squid** in the dark water deep underground. They glow (going dark a while after they're hurt) and drop **glow ink sacs**: rub one into a sign to make its writing glow in the dark, or combine it with an item frame for a **glow item frame**, which lights up what's in it.
  - **Buckets:** use a bucket of water on a cod, a salmon, a tropical fish (it keeps its pattern), a pufferfish, an axolotl or a tadpole to scoop it up, and use the bucket again to let it go somewhere else.
  - **The wandering trader:** every day or so there's a chance (better each time it doesn't happen) that a trader turns up near you, leading two llamas in the traders' blue. They sell what they've gathered on their travels for gold coins: saplings and flowers, seeds, dyes, coral, sand, moss and the like, and one rarer thing each (a bucket of tropical fish or pufferfish, an axolotl in a bucket, blue ice...). Their stock doesn't come back; they wander about near where they came, run from monsters, and after forty minutes or so they're gone, llamas and all, unless someone has taken the llamas' leads. `/summon wandering_trader` calls one (without the llamas).
- **Gadgets** (the crossbow update):
  - **Crossbows** (sticks, string, an iron ingot and planks): hold use to wind one up (a second and a quarter; Quick Charge makes it quicker) and it stays loaded, with an arrow or a firework rocket, until you shoot, which it does harder and flatter than a bow. Multishot looses three at once; Piercing arrows go through up to four creatures.
  - **Tridents,** from the treasure chests of shipwrecks, now and then from the wandering trader, or from the one drowned in sixteen that carries one (and throws it at you). Stab with it, or hold use to raise it and let go to throw it. Loyalty brings it back to you; Riptide flings you along with it instead, spinning, when you're in water or out in the rain; Impaling hits sea creatures harder. Thrown, it sticks in whatever it hits until you pick it up.
  - **Spyglass** (an amethyst shard on two copper ingots): hold use to look through it, ten times closer.
  - **Maps:** a compass in eight paper makes an empty map; use it and it becomes a map of the land about you, filling in as you go about with it in hand, in Minecraft's colours, shaded where the land rises and falls and darker the deeper the water. Zoom one out (a map in eight paper) up to four times, copy it onto empty maps, and put it in an item frame to hang it on the wall. Hold it to read it. Shipwrecks' map chests have them, and in multiplayer everyone shares the same maps.
  - **Books and quills** (a book, an ink sac from a squid, and a feather): write up to 50 pages, then sign it with a title to make a written book with your name on it, which anyone can read. Copy one with books and quills (a copy of a copy, but no further).
  - **Fireworks:** paper and one to three gunpowder make three rockets that fly higher the more gunpowder. Add firework stars for bursts: a star is gunpowder and dyes (its colours), with a fire charge for a large ball, a gold nugget for a star shape or a feather for a burst, a diamond for a trail and glowstone dust to make it twinkle; dye a star again for the colours it fades to. Set one off from the ground, or load it in a crossbow to shoot it: it bursts on what it hits, hurting everything near. **Fire charges** (gunpowder, coal and flint) light fires like flint and steel, once.
  - **Boats with chests** (a boat and a chest): 27 slots of storage you can take on the water. Sneak and use it to open the chest, or press `E` sitting in it (you sit a little forward of the chest). Break it and the boat and everything in it drop.
- **Wildlife, each where it belongs:** deer (stags with antlers), brown and black bears and wild boar in the woods; moose in the northern forests; polar bears on the ice and penguins on snowy shores; elephants, zebras, giraffes, lions and hippos on the savanna; tigers, pandas and elephants in the jungle; crocodiles in the swamps; camels in the desert. Bears, polar bears, tigers, lions and crocodiles come for anyone who strays too near (big cats creep up low, then spring) and give up if you get far enough away; their young don't, and a mother defends hers. Elephants, hippos, moose and boar leave you be unless you hurt one, and then the herd turns on you. Tame an elephant, a zebra or a camel the way you would a horse, saddle it and ride it (high up on an elephant's back). Deer bolt, and each animal drops its own meat and hide (venison, bear meat, pork, leather, feathers; pandas drop bamboo, which you can plant). Wolves and foxes wear coats to suit where they live.
- **Birds and insects:** robins, blue jays, cardinals, sparrows and goldfinches flit about the woods and fields (and fly off if you come near), crows gather in the open, gulls wheel over the shore, and eagles and vultures circle high overhead; butterflies and bees drift among the flowers (swat a bee and the whole swarm stings you), and on warm nights fireflies blink over the meadows, woods and swamps.
- **Pets and golems:** tame wolves with bones, cats with fish and parrots with seeds; they follow you, sit when told and defend you. Build iron golems from four iron blocks and a pumpkin, and snow golems from two snow blocks and a pumpkin.
- **395 blocks and hundreds of items**, with 400 recipes. Every block, item and creature is drawn in one consistent pixel-art style.
- **Crafting like Minecraft:** shaped recipes in a 2×2 grid in your inventory and a 3×3 grid at a crafting table, with a recipe book that lists what you can make and lays recipes out for you (recipes you're missing things for show as a faint "ghost" in the grid).
- **Furnaces:** put something in the top slot and fuel in the bottom one. They smelt ores, cook meat, bake sand into glass and clay into bricks, turn logs into charcoal, keep going while you're away, and glow while they burn.
- **Farming:** hoes and farmland, wheat, carrots, potatoes and beetroots, saplings that grow into trees, bone meal and composters.
- **Building:** slabs, stairs (which turn corners where they meet, like Minecraft's), doors, trapdoors, fence gates, ladders, fences, walls, glass panes and more. Also levers, buttons, pressure plates and redstone lamps, dispensers (powered, they shoot arrows or throw out what's in them) and tripwires (string on the ground between two tripwire hooks: whoever crosses it sets the hooks off), and signs you can write on.
- **Fire and fluids:** flint and steel lights fires that spread through wood and leaves and burn out. Water spreads quickly and lava slowly, as in Minecraft, and where they meet you get obsidian, cobblestone or stone. Sand and gravel fall smoothly as blocks. TNT explosions chain.
- **Chests and beds:** two chests side by side make a double chest. Sleeping in a bed sets your spawn point and skips the night.
- **Combat:** it works like Minecraft 1.9 onwards. Each weapon winds up again after a swing (swords quickly, axes slowly, shown by a meter under the crosshair), and fully wound-up hits while falling are critical hits. There are bows and arrows, and a shield to block with.
- **Armor:** leather, chainmail, iron, gold and diamond, with Minecraft's damage reduction and wear. Your character wears it, and so do other players.
- **Experience and enchanting:** orbs and levels, an enchanting table with 30 enchantments, and anvils and grindstones.
- **Potions:** 12 kinds, to drink or throw as splash potions. Witches throw them at you, and status effects show on the HUD.
- **Getting about:** boats (which glide and turn smoothly), horses (seven coats, with or without markings), donkeys and mules to tame and saddle, and minecarts on rails, including powered and detector rails. Breed a horse with a donkey for a mule.
- **Breeding:** feed two animals of a kind their food and love hearts float over them until they meet and have a baby; tamed animals show hearts too.
- **Fishing:** cast, wait for a bite, and reel in fish, junk or treasure.
- **And more:** cake, name tags and leads, item frames, 15 paintings, flower pots, note blocks, and a jukebox with 8 music discs.
- **Shaders:** **Options → Shaders** (Low or High) adds sunlight with soft shadows, glinting water, a glowing sky, bloom and light shafts, kept soft enough to see by: the sun doesn't glare, water shows what's under it even looking across it, and snow and sand in full sun stop short of blinding white.
- **Dynamic Lights:** hold a torch (or a lantern, glowstone, a jack o'lantern, a lava bucket or glow berries) and it lights up everything around you as you walk, as the OptiFine and LambDynamicLights mods do. So does a torch dropped on the ground, a creature on fire, and a torch in a friend's hand; torches go out under water. **Options → Dynamic Lights**: Fancy works the light out for every pixel, Fast at the corners of blocks (like Minecraft's smooth lighting, and quicker), or turn it OFF. Only the look changes: monsters still spawn by the world's own light.
- **Multiplayer:** host a world for your friends from the game menu, on claude.ai or with a join code (see [Play with friends](#play-with-friends)).
- **Swimming:** sprint with your head under water to swim like in Minecraft, gliding the way you look with Minecraft's breaststroke. Under water you see about 24 blocks by day, through water the colour of the sea you're in, and less at night. Jump or fall in and there's a proper splash. **F5** shows you from behind or in front, sneaking with Minecraft's crouch and lifting food to your mouth as you eat (other players see it too); in first person, eating moves as smoothly as Minecraft's.
- **Weather:** rain showers come and go, with streaks of rain, splashes, a grey sky and the sound of rain (quieter indoors). It snows in cold biomes and high up; deserts, savannas and badlands stay dry. Sleeping clears the weather.
- **Survival:** health, hunger (sprinting, jumping, fighting and mining make you hungry, and you only heal when well fed), fall damage, drowning, fire and lava, and mining times that match Minecraft's for every tool and block (with its short pause between one block and the next).
- **Difficulty:** Peaceful, Easy, Normal or Hard, chosen in Create World and changed any time in **Options → Difficulty** (or with `/difficulty`), and doing what Minecraft's do. Peaceful has no monsters and brings your health and food back by themselves. On Easy monsters do less harm and hunger leaves you five hearts. On Hard they hit half as hard again, skeletons shoot faster, and starving can kill. In multiplayer the host's difficulty goes for everyone.
- **Monsters:** skeletons draw, loose and wait as Minecraft's do (an arrow every three seconds or so on Normal, two on Hard, instead of a volley), and are a fifth of the monsters. Monsters only appear where no torch light reaches, and a few at a time.
- **Creative:** every block, flying, instant breaking, a searchable inventory with Minecraft's tabs, and a spawn egg for every creature (use it on the ground, or on water for sea life; in Survival they're had only by command).
- **Key binds and saving:** **Options → Key Binds** changes any key, as in Minecraft: click one and press the new key (one that does two things shows red, and Reset puts keys back). The world saves itself every 30 seconds (or every 1, 2 or 5 minutes: **Options → Autosave**), whenever you pause, and when you close or leave the tab, with **Saving world** in the corner as it does (**Autosave Indicator**).
- **Minimap and waypoints**, like the Xaero's Minimap mod, built in: a map of the land round you in the top right corner, drawn from the blocks themselves (grass, leaves and water in their biome's colours), shaded where the land rises and falls, lit by the sun by day and by torches at night, turning as you turn (or with north kept up: **Options → Lock North**), with N, E, S and W round its edge. Creatures show on it as dots (monsters red, animals yellow, village folk green, pets blue) and other players as white dots with their names; under it are your coordinates and the biome you're in. Under a roof of rock (in a cave, or indoors) it shows what's at your level instead. `=` and `-` zoom it; **Options → Minimap** sets its size (Small, Medium, Large), square or round, zoom, cave mode, and whether creatures, coordinates and waypoints show. **Waypoints:** `B` marks one where you stand (give it a name and one of sixteen colours), and `U` (or a click on the minimap) lists them all by distance, to show or hide, change or delete (and in Creative, go to). Each shows on the minimap (kept to its edge when it's further off) and out in the world as a square with its initials and how many blocks away it is, with its name when you look its way. Dying marks where you fell with a "Death" waypoint. They're kept with the world (a friend's, by the host, for when they come back).
- **Interface:** menus, HUD and inventories styled after the classic game (bevelled buttons, sliders with their value written on them, a pixel-art logo with splash text) and all drawn to one GUI scale. **Options → GUI Scale** makes the whole interface bigger or smaller; Auto picks the largest size that fits, like the original.
- **Easy-to-read text:** all of it is in one pixel font like Minecraft's, made from [Monocraft](https://github.com/IdreesInc/Monocraft) and spaced the way Minecraft spaces its letters, drawn sharp at every GUI scale and all at one size. Letters and numbers that pixel fonts often draw alike aren't: 2 and Z, 8 and B, 0 (with a slash) and O, and 5 and S (Minecraft's own S is a 5 with one corner missing; this one is shaped like its small s). The font comes with the game, so it works offline too.
- **Sound and music:** recorded sounds for every block material, creatures, weapons, doors, chests, furnaces, eating, explosions and rain, positioned in 3D and muffled underwater. The soundtrack is calm piano music composed while you play, with a piano synthesised in the browser.
- **Performance:** terrain generation and meshing run in Web Workers. Chunks stream in around you, the ones in front of you first, with finished chunks applied a few milliseconds' worth per frame. Cave culling skips sections you can't see into, faces pointing away from the camera are skipped, and the Auto resolution setting lowers the render scale when frames run slow. Minecraft's video options are there to trade looks for speed: **Graphics** Fast draws leaves solid, like Minecraft's (a forest then has about a third of the triangles to draw), **Max Framerate** caps the frame rate to save battery, **Particles** can be Decreased or Minimal, and **Entity Distance** sets how far away creatures are drawn.

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
src/civilians.js    village people, talking and trading;  src/wanderer.js the wandering trader
src/mesher.js       turns chunk sections into vertex data (face culling, AO, smooth light)
src/light.js        per-chunk light flood fill (runs in workers)
src/renderer.js     WebGL 2 renderer: terrain, sky, clouds, entities, particles, held item;  src/shaders.js its GLSL
src/dynlight.js     Dynamic Lights: the torches and other glowing things about, for the shaders to light by
src/blocks.js       block registry;  src/items.js items, tools and armor;  src/crafting.js recipes, smelting, fuel
src/containers.js   inventory, crafting table, furnace and chest screens (slot rules);  src/furnace.js smelting
src/gui.js          the Minecraft-style container windows and recipe book;  src/preview.js your character in the inventory
src/textures.js     the block and item textures (imported ones from src/tex/packdata.js, the rest drawn in src/tex/)
src/skins.js        creature skins, laid out Minecraft's way (imported, or drawn in src/tex/mobskins.js)
src/entities.js     mobs, dropped items, TNT;  src/player.js, src/body.js physics
src/net.js          multiplayer transports (claude.ai room, PeerJS join codes) and reliable message streams;  src/relay.js the relay
src/vendor/         PeerJS 1.5.5 (MIT licence, see LICENSE-peerjs.txt)
src/fonts/          the game's font, Blockhaven Pixel (made from Monocraft, SIL OFL 1.1: see OFL-Monocraft.txt)
src/multiplayer.js  hosting and joining: world, entity, chest and player sync;  src/avatars.js other players
src/audio.js        sound effects;  src/music.js generative piano music;  src/weather.js rain and snow
src/sounddata.js    the sound recordings (generated from assets/sounds by tools/pack-sounds.mjs)
src/keys.js         key binds;  src/ui.js, icons.js, inventory.js, touch.js, input.js, storage.js, sky.js, ...
assets/sounds/      the sound effects as MP3s, with their sources in CREDITS.md
assets/textures/    the imported block and item textures (16x16 PNGs named after the game's), assets/skins/ the
                    creature skins (64x64); where each came from is in assets/CREDITS.md
tools/build.mjs     bundles everything into dist/blockhaven.html
tools/prepare_sounds.py  downloads, trims and encodes the sounds (needs Python, numpy, imageio-ffmpeg)
tools/import-textures.mjs  makes assets/textures and assets/skins from the resource packs (see texture-sources.mjs)
tools/pack-textures.mjs    packs them into src/tex/packdata.js
tools/make-font.py  makes src/fonts/blockhaven-pixel.woff2 from Monocraft.ttf (needs Python and fontTools)
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

Blockhaven is a fan-made game inspired by Minecraft. It's not affiliated with or endorsed by Mojang or Microsoft. Its code and music are original. Its textures are from the Pixel Perfection resource pack by XSSheep and its community (and from Mineclonia for the newest blocks), shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and credited in [`assets/CREDITS.md`](assets/CREDITS.md). Its sound effects are public-domain (CC0) recordings by Kenney and Freesound contributors, credited in [`assets/sounds/CREDITS.md`](assets/sounds/CREDITS.md). Its font is made from [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan, under the [SIL Open Font License 1.1](src/fonts/OFL-Monocraft.txt).
