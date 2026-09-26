# Texture credits

The game's block, item and creature textures (`textures/` and `skins/` here) come from two openly licensed
Minecraft-style resource packs, and are shared under the same licence as them: Creative Commons
Attribution-ShareAlike 4.0 ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)).

- **Pixel Perfection** by XSSheep (Hugh Rutland), <https://www.planetminecraft.com/texture-pack/131pixel-perfection/>,
  as updated in its Community Edition, <https://github.com/Athemis/PixelPerfectionCE>, by StonePendant,
  freejusticehere, Stingraych, Nova_Wostra and lazerl0rd.
- **Mineclonia**, <https://codeberg.org/mineclonia/mineclonia>, for the blocks newer than that edition (deepslate,
  copper, raw ores, calcite and cherry wood). Its textures are based on Pixel Perfection and on Pixel Perfection
  Legacy by Nova_Wostra; the ones used here come from the mods by NO11 (deepslate, copper, raw ores), PrairieWind,
  Wbjitscool, SmokeyDope and cora (cherry blossom) and Emojiminetest and kay27 (calcite).

`tools/import-textures.mjs` imports them, following `tools/texture-sources.mjs` and `tools/skin-sources.mjs`.
Those marked *changed* below were changed to fit the game: cut out of Minecraft's model sheets into the game's
block faces (chests, beds, lanterns, bells, campfires, levers, flower pots) and creature skins, recoloured (the
bed icon red, leather dyed brown, potions tinted, grey bases for the dye colours and water), turned, cropped, or
doubled in size (the particles). Anything not listed is drawn by the game's own code.

| File | Made from | |
| --- | --- | --- |
| `textures/stone.png` | Pixel Perfection CE block/stone.png |  |
| `textures/smooth_stone.png` | Pixel Perfection CE block/smooth_stone.png |  |
| `textures/smooth_stone_side.png` | Pixel Perfection CE block/smooth_stone_slab_side.png |  |
| `textures/cobblestone.png` | Pixel Perfection CE block/cobblestone.png |  |
| `textures/mossy_cobblestone.png` | Pixel Perfection CE block/mossy_cobblestone.png |  |
| `textures/granite.png` | Pixel Perfection CE block/granite.png |  |
| `textures/diorite.png` | Pixel Perfection CE block/diorite.png |  |
| `textures/andesite.png` | Pixel Perfection CE block/andesite.png |  |
| `textures/polished_granite.png` | Pixel Perfection CE block/polished_granite.png |  |
| `textures/polished_diorite.png` | Pixel Perfection CE block/polished_diorite.png |  |
| `textures/polished_andesite.png` | Pixel Perfection CE block/polished_andesite.png |  |
| `textures/calcite.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_calcite_block.png |  |
| `textures/deepslate.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate.png |  |
| `textures/deepslate_top.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_top.png |  |
| `textures/cobbled_deepslate.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_cobbled.png |  |
| `textures/deepslate_bricks.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_bricks.png |  |
| `textures/dirt.png` | Pixel Perfection CE block/dirt.png |  |
| `textures/coarse_dirt.png` | Pixel Perfection CE block/coarse_dirt.png |  |
| `textures/grass_top.png` | Pixel Perfection CE block/grass_block_top.png |  |
| `textures/grass_side.png` | Pixel Perfection CE block/grass_block_side.png |  |
| `textures/grass_side_overlay.png` | Pixel Perfection CE block/grass_block_side_overlay.png |  |
| `textures/grass_side_snowy.png` | Pixel Perfection CE block/grass_block_snow.png |  |
| `textures/podzol_top.png` | Pixel Perfection CE block/podzol_top.png |  |
| `textures/podzol_side.png` | Pixel Perfection CE block/podzol_side.png |  |
| `textures/dirt_path_top.png` | Pixel Perfection CE block/grass_path_top.png |  |
| `textures/dirt_path_side.png` | Pixel Perfection CE block/grass_path_side.png |  |
| `textures/farmland.png` | Pixel Perfection CE block/farmland.png |  |
| `textures/farmland_moist.png` | Pixel Perfection CE block/farmland_moist.png |  |
| `textures/sand.png` | Pixel Perfection CE block/sand.png |  |
| `textures/red_sand.png` | Pixel Perfection CE block/red_sand.png |  |
| `textures/gravel.png` | Pixel Perfection CE block/gravel.png |  |
| `textures/clay.png` | Pixel Perfection CE block/clay.png |  |
| `textures/snow.png` | Pixel Perfection CE block/snow.png |  |
| `textures/ice.png` | Pixel Perfection CE block/ice.png |  |
| `textures/packed_ice.png` | Pixel Perfection CE block/packed_ice.png |  |
| `textures/obsidian.png` | Pixel Perfection CE block/obsidian.png |  |
| `textures/bedrock.png` | Pixel Perfection CE block/bedrock.png |  |
| `textures/glowstone.png` | Pixel Perfection CE block/glowstone.png |  |
| `textures/lava.png` | Pixel Perfection CE block/lava_still.png | changed |
| `textures/water.png` | Pixel Perfection CE block/water_still.png | changed |
| `textures/coal_ore.png` | Pixel Perfection CE block/coal_ore.png |  |
| `textures/deepslate_coal_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_coal_ore.png |  |
| `textures/iron_ore.png` | Pixel Perfection CE block/iron_ore.png |  |
| `textures/deepslate_iron_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_iron_ore.png |  |
| `textures/copper_ore.png` | Pixel Perfection CE block/stone.png; Mineclonia mods/ITEMS/mcl_copper/textures/mcl_copper_ore.png | changed |
| `textures/deepslate_copper_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_copper_ore.png |  |
| `textures/gold_ore.png` | Pixel Perfection CE block/gold_ore.png |  |
| `textures/deepslate_gold_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_gold_ore.png |  |
| `textures/redstone_ore.png` | Pixel Perfection CE block/redstone_ore.png |  |
| `textures/deepslate_redstone_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_redstone_ore.png |  |
| `textures/lapis_ore.png` | Pixel Perfection CE block/lapis_ore.png |  |
| `textures/deepslate_lapis_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_lapis_ore.png |  |
| `textures/emerald_ore.png` | Pixel Perfection CE block/emerald_ore.png |  |
| `textures/deepslate_emerald_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_emerald_ore.png |  |
| `textures/diamond_ore.png` | Pixel Perfection CE block/diamond_ore.png |  |
| `textures/deepslate_diamond_ore.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_diamond_ore.png |  |
| `textures/iron_block.png` | Pixel Perfection CE block/iron_block.png |  |
| `textures/gold_block.png` | Pixel Perfection CE block/gold_block.png |  |
| `textures/diamond_block.png` | Pixel Perfection CE block/diamond_block.png |  |
| `textures/emerald_block.png` | Pixel Perfection CE block/emerald_block.png |  |
| `textures/lapis_block.png` | Pixel Perfection CE block/lapis_block.png |  |
| `textures/redstone_block.png` | Pixel Perfection CE block/redstone_block.png |  |
| `textures/copper_block.png` | Mineclonia mods/ITEMS/mcl_copper/textures/mcl_copper_block.png |  |
| `textures/coal_block.png` | Pixel Perfection CE block/coal_block.png |  |
| `textures/raw_iron_block.png` | Mineclonia mods/ITEMS/mcl_raw_ores/textures/mcl_raw_ores_raw_iron_block.png |  |
| `textures/oak_planks.png` | Pixel Perfection CE block/oak_planks.png |  |
| `textures/oak_log.png` | Pixel Perfection CE block/oak_log.png |  |
| `textures/oak_log_top.png` | Pixel Perfection CE block/oak_log_top.png |  |
| `textures/spruce_planks.png` | Pixel Perfection CE block/spruce_planks.png |  |
| `textures/spruce_log.png` | Pixel Perfection CE block/spruce_log.png |  |
| `textures/spruce_log_top.png` | Pixel Perfection CE block/spruce_log_top.png |  |
| `textures/birch_planks.png` | Pixel Perfection CE block/birch_planks.png |  |
| `textures/birch_log.png` | Pixel Perfection CE block/birch_log.png |  |
| `textures/birch_log_top.png` | Pixel Perfection CE block/birch_log_top.png |  |
| `textures/jungle_planks.png` | Pixel Perfection CE block/jungle_planks.png |  |
| `textures/jungle_log.png` | Pixel Perfection CE block/jungle_log.png |  |
| `textures/jungle_log_top.png` | Pixel Perfection CE block/jungle_log_top.png |  |
| `textures/acacia_planks.png` | Pixel Perfection CE block/acacia_planks.png |  |
| `textures/acacia_log.png` | Pixel Perfection CE block/acacia_log.png |  |
| `textures/acacia_log_top.png` | Pixel Perfection CE block/acacia_log_top.png |  |
| `textures/dark_oak_planks.png` | Pixel Perfection CE block/dark_oak_planks.png |  |
| `textures/dark_oak_log.png` | Pixel Perfection CE block/dark_oak_log.png |  |
| `textures/dark_oak_log_top.png` | Pixel Perfection CE block/dark_oak_log_top.png |  |
| `textures/cherry_planks.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_planks.png |  |
| `textures/cherry_log.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_log.png |  |
| `textures/cherry_log_top.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_log_top.png |  |
| `textures/oak_leaves.png` | Pixel Perfection CE block/oak_leaves.png |  |
| `textures/birch_leaves.png` | Pixel Perfection CE block/birch_leaves.png | changed |
| `textures/spruce_leaves.png` | Pixel Perfection CE block/spruce_leaves.png | changed |
| `textures/jungle_leaves.png` | Pixel Perfection CE block/jungle_leaves.png |  |
| `textures/acacia_leaves.png` | Pixel Perfection CE block/acacia_leaves.png | changed |
| `textures/dark_oak_leaves.png` | Pixel Perfection CE block/dark_oak_leaves.png | changed |
| `textures/cherry_leaves.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_leaves.png |  |
| `textures/oak_sapling.png` | Pixel Perfection CE block/oak_sapling.png |  |
| `textures/spruce_sapling.png` | Pixel Perfection CE block/spruce_sapling.png |  |
| `textures/birch_sapling.png` | Pixel Perfection CE block/birch_sapling.png |  |
| `textures/jungle_sapling.png` | Pixel Perfection CE block/jungle_sapling.png |  |
| `textures/acacia_sapling.png` | Pixel Perfection CE block/acacia_sapling.png |  |
| `textures/dark_oak_sapling.png` | Pixel Perfection CE block/dark_oak_sapling.png |  |
| `textures/cherry_sapling.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_sapling.png |  |
| `textures/tall_grass.png` | Pixel Perfection CE block/grass.png |  |
| `textures/tall_grass_bottom.png` | Pixel Perfection CE block/tall_grass_bottom.png |  |
| `textures/tall_grass_top.png` | Pixel Perfection CE block/tall_grass_top.png |  |
| `textures/fern.png` | Pixel Perfection CE block/fern.png |  |
| `textures/large_fern_bottom.png` | Pixel Perfection CE block/large_fern_bottom.png |  |
| `textures/large_fern_top.png` | Pixel Perfection CE block/large_fern_top.png |  |
| `textures/dandelion.png` | Pixel Perfection CE block/dandelion.png |  |
| `textures/poppy.png` | Pixel Perfection CE block/poppy.png |  |
| `textures/cornflower.png` | Pixel Perfection CE block/cornflower.png |  |
| `textures/allium.png` | Pixel Perfection CE block/allium.png |  |
| `textures/azure_bluet.png` | Pixel Perfection CE block/azure_bluet.png |  |
| `textures/blue_orchid.png` | Pixel Perfection CE block/blue_orchid.png |  |
| `textures/oxeye_daisy.png` | Pixel Perfection CE block/oxeye_daisy.png |  |
| `textures/red_tulip.png` | Pixel Perfection CE block/red_tulip.png |  |
| `textures/orange_tulip.png` | Pixel Perfection CE block/orange_tulip.png |  |
| `textures/white_tulip.png` | Pixel Perfection CE block/white_tulip.png |  |
| `textures/pink_tulip.png` | Pixel Perfection CE block/pink_tulip.png |  |
| `textures/lily_of_the_valley.png` | Pixel Perfection CE block/lily_of_the_valley.png |  |
| `textures/dead_bush.png` | Pixel Perfection CE block/dead_bush.png |  |
| `textures/sugar_cane.png` | Pixel Perfection CE block/sugar_cane.png |  |
| `textures/red_mushroom.png` | Pixel Perfection CE block/red_mushroom.png |  |
| `textures/brown_mushroom.png` | Pixel Perfection CE block/brown_mushroom.png |  |
| `textures/lily_pad.png` | Pixel Perfection CE block/lily_pad.png |  |
| `textures/vine.png` | Pixel Perfection CE block/vine.png |  |
| `textures/sunflower_bottom.png` | Pixel Perfection CE block/sunflower_bottom.png |  |
| `textures/sunflower_top.png` | Pixel Perfection CE block/sunflower_top.png |  |
| `textures/lilac_bottom.png` | Pixel Perfection CE block/lilac_bottom.png |  |
| `textures/lilac_top.png` | Pixel Perfection CE block/lilac_top.png |  |
| `textures/rose_bush_bottom.png` | Pixel Perfection CE block/rose_bush_bottom.png |  |
| `textures/rose_bush_top.png` | Pixel Perfection CE block/rose_bush_top.png |  |
| `textures/peony_bottom.png` | Pixel Perfection CE block/peony_bottom.png |  |
| `textures/peony_top.png` | Pixel Perfection CE block/peony_top.png |  |
| `textures/wheat_0.png` | Pixel Perfection CE block/wheat_stage0.png |  |
| `textures/wheat_1.png` | Pixel Perfection CE block/wheat_stage1.png |  |
| `textures/wheat_2.png` | Pixel Perfection CE block/wheat_stage2.png |  |
| `textures/wheat_3.png` | Pixel Perfection CE block/wheat_stage3.png |  |
| `textures/wheat_4.png` | Pixel Perfection CE block/wheat_stage4.png |  |
| `textures/wheat_5.png` | Pixel Perfection CE block/wheat_stage5.png |  |
| `textures/wheat_6.png` | Pixel Perfection CE block/wheat_stage6.png |  |
| `textures/wheat_7.png` | Pixel Perfection CE block/wheat_stage7.png |  |
| `textures/carrots_0.png` | Pixel Perfection CE block/carrots_stage0.png |  |
| `textures/potatoes_0.png` | Pixel Perfection CE block/potatoes_stage0.png |  |
| `textures/beetroots_0.png` | Pixel Perfection CE block/beetroots_stage0.png |  |
| `textures/carrots_1.png` | Pixel Perfection CE block/carrots_stage1.png |  |
| `textures/potatoes_1.png` | Pixel Perfection CE block/potatoes_stage1.png |  |
| `textures/beetroots_1.png` | Pixel Perfection CE block/beetroots_stage1.png |  |
| `textures/carrots_2.png` | Pixel Perfection CE block/carrots_stage2.png |  |
| `textures/potatoes_2.png` | Pixel Perfection CE block/potatoes_stage2.png |  |
| `textures/beetroots_2.png` | Pixel Perfection CE block/beetroots_stage2.png |  |
| `textures/carrots_3.png` | Pixel Perfection CE block/carrots_stage3.png |  |
| `textures/potatoes_3.png` | Pixel Perfection CE block/potatoes_stage3.png |  |
| `textures/beetroots_3.png` | Pixel Perfection CE block/beetroots_stage3.png |  |
| `textures/bricks.png` | Pixel Perfection CE block/bricks.png |  |
| `textures/stone_bricks.png` | Pixel Perfection CE block/stone_bricks.png |  |
| `textures/mossy_stone_bricks.png` | Pixel Perfection CE block/mossy_stone_bricks.png |  |
| `textures/cracked_stone_bricks.png` | Pixel Perfection CE block/cracked_stone_bricks.png |  |
| `textures/chiseled_stone_bricks.png` | Pixel Perfection CE block/chiseled_stone_bricks.png |  |
| `textures/sandstone_side.png` | Pixel Perfection CE block/sandstone.png |  |
| `textures/sandstone_top.png` | Pixel Perfection CE block/sandstone_top.png |  |
| `textures/sandstone_bottom.png` | Pixel Perfection CE block/sandstone_bottom.png |  |
| `textures/cut_sandstone.png` | Pixel Perfection CE block/cut_sandstone.png |  |
| `textures/chiseled_sandstone.png` | Pixel Perfection CE block/chiseled_sandstone.png |  |
| `textures/red_sandstone_side.png` | Pixel Perfection CE block/red_sandstone.png |  |
| `textures/red_sandstone_top.png` | Pixel Perfection CE block/red_sandstone_top.png |  |
| `textures/red_sandstone_bottom.png` | Pixel Perfection CE block/red_sandstone_bottom.png |  |
| `textures/cut_red_sandstone.png` | Pixel Perfection CE block/cut_red_sandstone.png |  |
| `textures/chiseled_red_sandstone.png` | Pixel Perfection CE block/chiseled_red_sandstone.png |  |
| `textures/terracotta.png` | Pixel Perfection CE block/terracotta.png |  |
| `textures/terracotta_dyed.png` | Pixel Perfection CE block/white_terracotta.png | changed |
| `textures/wool.png` | Pixel Perfection CE block/white_wool.png | changed |
| `textures/concrete.png` | Pixel Perfection CE block/white_concrete.png | changed |
| `textures/concrete_powder.png` | Pixel Perfection CE block/white_concrete_powder.png | changed |
| `textures/stained_glass.png` | Pixel Perfection CE block/white_stained_glass.png | changed |
| `textures/glass.png` | Pixel Perfection CE block/glass.png |  |
| `textures/glass_pane_top.png` | Pixel Perfection CE block/glass_pane_top.png |  |
| `textures/bookshelf.png` | Pixel Perfection CE block/bookshelf.png |  |
| `textures/crafting_table_top.png` | Pixel Perfection CE block/crafting_table_top.png |  |
| `textures/crafting_table_front.png` | Pixel Perfection CE block/crafting_table_front.png |  |
| `textures/crafting_table_side.png` | Pixel Perfection CE block/crafting_table_side.png |  |
| `textures/furnace_side.png` | Pixel Perfection CE block/furnace_side.png |  |
| `textures/furnace_top.png` | Pixel Perfection CE block/furnace_top.png |  |
| `textures/furnace_front.png` | Pixel Perfection CE block/furnace_front.png |  |
| `textures/furnace_front_on.png` | Pixel Perfection CE block/furnace_front_on.png |  |
| `textures/smoker_side.png` | Pixel Perfection CE block/smoker_side.png |  |
| `textures/smoker_top.png` | Pixel Perfection CE block/smoker_top.png |  |
| `textures/smoker_bottom.png` | Pixel Perfection CE block/smoker_bottom.png |  |
| `textures/smoker_front.png` | Pixel Perfection CE block/smoker_front.png |  |
| `textures/smoker_front_on.png` | Pixel Perfection CE block/smoker_front_on.png | changed |
| `textures/blast_furnace_side.png` | Pixel Perfection CE block/blast_furnace_side.png |  |
| `textures/blast_furnace_top.png` | Pixel Perfection CE block/blast_furnace_top.png |  |
| `textures/blast_furnace_front.png` | Pixel Perfection CE block/blast_furnace_front.png |  |
| `textures/blast_furnace_front_on.png` | Pixel Perfection CE block/blast_furnace_front_on.png | changed |
| `textures/barrel_side.png` | Pixel Perfection CE block/barrel_side.png |  |
| `textures/barrel_top.png` | Pixel Perfection CE block/barrel_top.png |  |
| `textures/barrel_bottom.png` | Pixel Perfection CE block/barrel_bottom.png |  |
| `textures/smithing_table_top.png` | Pixel Perfection CE block/smithing_table_top.png |  |
| `textures/smithing_table_side.png` | Pixel Perfection CE block/smithing_table_side.png |  |
| `textures/smithing_table_front.png` | Pixel Perfection CE block/smithing_table_front.png |  |
| `textures/fletching_table_top.png` | Pixel Perfection CE block/fletching_table_top.png |  |
| `textures/fletching_table_side.png` | Pixel Perfection CE block/fletching_table_side.png |  |
| `textures/fletching_table_front.png` | Pixel Perfection CE block/fletching_table_front.png |  |
| `textures/tnt_side.png` | Pixel Perfection CE block/tnt_side.png |  |
| `textures/tnt_top.png` | Pixel Perfection CE block/tnt_top.png |  |
| `textures/tnt_bottom.png` | Pixel Perfection CE block/tnt_bottom.png |  |
| `textures/torch.png` | Pixel Perfection CE block/torch.png |  |
| `textures/lantern_side.png` | Pixel Perfection CE block/lantern.png | changed |
| `textures/lantern_top.png` | Pixel Perfection CE block/lantern.png | changed |
| `textures/campfire_log.png` | Pixel Perfection CE block/campfire_log.png | changed |
| `textures/campfire_log_lit.png` | Pixel Perfection CE block/campfire_log.png; Pixel Perfection CE block/campfire_log_lit.png | changed |
| `textures/cactus_side.png` | Pixel Perfection CE block/cactus_side.png |  |
| `textures/cactus_top.png` | Pixel Perfection CE block/cactus_top.png |  |
| `textures/cactus_bottom.png` | Pixel Perfection CE block/cactus_bottom.png |  |
| `textures/pumpkin_side.png` | Pixel Perfection CE block/pumpkin_side.png |  |
| `textures/pumpkin_top.png` | Pixel Perfection CE block/pumpkin_top.png |  |
| `textures/pumpkin_face.png` | Pixel Perfection CE block/carved_pumpkin.png |  |
| `textures/jack_face.png` | Pixel Perfection CE block/jack_o_lantern.png |  |
| `textures/melon_side.png` | Pixel Perfection CE block/melon_side.png |  |
| `textures/melon_top.png` | Pixel Perfection CE block/melon_top.png |  |
| `textures/hay_block_side.png` | Pixel Perfection CE block/hay_block_side.png |  |
| `textures/hay_block_top.png` | Pixel Perfection CE block/hay_block_top.png |  |
| `textures/chest_side.png` | Pixel Perfection CE entity/chest/normal.png | changed |
| `textures/chest_front.png` | Pixel Perfection CE entity/chest/normal.png | changed |
| `textures/chest_top.png` | Pixel Perfection CE entity/chest/normal.png | changed |
| `textures/chest_front_l.png` | Pixel Perfection CE entity/chest/normal_left.png | changed |
| `textures/chest_front_r.png` | Pixel Perfection CE entity/chest/normal_right.png | changed |
| `textures/chest_back_double.png` | Pixel Perfection CE entity/chest/normal.png | changed |
| `textures/chest_top_dx.png` | Pixel Perfection CE entity/chest/normal.png | changed |
| `textures/chest_top_dz.png` | Pixel Perfection CE entity/chest/normal.png | changed |
| `textures/bed_head.png` | Pixel Perfection CE entity/bed/red.png | changed |
| `textures/bed_head_s.png` | Pixel Perfection CE entity/bed/red.png | changed |
| `textures/bed_head_e.png` | Pixel Perfection CE entity/bed/red.png | changed |
| `textures/bed_head_w.png` | Pixel Perfection CE entity/bed/red.png | changed |
| `textures/bed_foot.png` | Pixel Perfection CE entity/bed/red.png | changed |
| `textures/bed_side.png` | Pixel Perfection CE entity/bed/red.png | changed |
| `textures/anvil.png` | Pixel Perfection CE block/anvil.png |  |
| `textures/anvil_top.png` | Pixel Perfection CE block/anvil_top.png |  |
| `textures/anvil_top_z.png` | Pixel Perfection CE block/anvil_top.png | changed |
| `textures/cauldron_side.png` | Pixel Perfection CE block/cauldron_side.png |  |
| `textures/cauldron_inner.png` | Pixel Perfection CE block/cauldron_inner.png |  |
| `textures/cauldron_top.png` | Pixel Perfection CE block/cauldron_top.png |  |
| `textures/cauldron_bottom.png` | Pixel Perfection CE block/cauldron_bottom.png |  |
| `textures/cauldron_water.png` | Pixel Perfection CE block/water_still.png | changed |
| `textures/bell_body.png` | Pixel Perfection CE entity/bell/bell_body.png | changed |
| `textures/bell_top.png` | Pixel Perfection CE block/bell_top.png |  |
| `textures/grindstone_round.png` | Pixel Perfection CE block/grindstone_round.png |  |
| `textures/grindstone_side.png` | Pixel Perfection CE block/grindstone_side.png |  |
| `textures/stonecutter_top.png` | Pixel Perfection CE block/stonecutter_top.png |  |
| `textures/stonecutter_side.png` | Pixel Perfection CE block/stonecutter_side.png |  |
| `textures/stonecutter_saw.png` | Pixel Perfection CE block/stonecutter_saw.png | changed |
| `textures/composter_side.png` | Pixel Perfection CE block/composter_side.png |  |
| `textures/composter_top.png` | Pixel Perfection CE block/composter_top.png |  |
| `textures/composter_bottom.png` | Pixel Perfection CE block/composter_bottom.png |  |
| `textures/compost.png` | Pixel Perfection CE block/composter_compost.png |  |
| `textures/composter_ready.png` | Pixel Perfection CE block/composter_ready.png |  |
| `textures/loom_front.png` | Pixel Perfection CE block/loom_front.png |  |
| `textures/loom_side.png` | Pixel Perfection CE block/loom_side.png |  |
| `textures/loom_top.png` | Pixel Perfection CE block/loom_top.png |  |
| `textures/loom_bottom.png` | Pixel Perfection CE block/loom_bottom.png |  |
| `textures/lectern_base.png` | Pixel Perfection CE block/lectern_base.png |  |
| `textures/lectern_sides.png` | Pixel Perfection CE block/lectern_sides.png |  |
| `textures/lectern_top.png` | Pixel Perfection CE block/lectern_top.png |  |
| `textures/cartography_table_top.png` | Pixel Perfection CE block/cartography_table_top.png |  |
| `textures/cartography_table_side1.png` | Pixel Perfection CE block/cartography_table_side1.png |  |
| `textures/cartography_table_side2.png` | Pixel Perfection CE block/cartography_table_side2.png |  |
| `textures/flower_pot.png` | Pixel Perfection CE block/flower_pot.png |  |
| `textures/flower_pot_top.png` | Pixel Perfection CE block/flower_pot.png; Pixel Perfection CE block/dirt.png | changed |
| `textures/coal.png` | Pixel Perfection CE item/coal.png |  |
| `textures/charcoal.png` | Pixel Perfection CE item/charcoal.png |  |
| `textures/iron_ingot.png` | Pixel Perfection CE item/iron_ingot.png |  |
| `textures/gold_ingot.png` | Pixel Perfection CE item/gold_ingot.png |  |
| `textures/copper_ingot.png` | Mineclonia mods/ITEMS/mcl_copper/textures/mcl_copper_ingot.png |  |
| `textures/iron_nugget.png` | Pixel Perfection CE item/iron_nugget.png |  |
| `textures/gold_nugget.png` | Pixel Perfection CE item/gold_nugget.png |  |
| `textures/diamond.png` | Pixel Perfection CE item/diamond.png |  |
| `textures/emerald.png` | Pixel Perfection CE item/emerald.png |  |
| `textures/lapis_lazuli.png` | Pixel Perfection CE item/lapis_lazuli.png |  |
| `textures/brick.png` | Pixel Perfection CE item/brick.png |  |
| `textures/slime_ball.png` | Pixel Perfection CE item/slime_ball.png |  |
| `textures/ender_pearl.png` | Pixel Perfection CE item/ender_pearl.png |  |
| `textures/egg.png` | Pixel Perfection CE item/egg.png |  |
| `textures/dye.png` | Pixel Perfection CE item/white_dye.png | changed |
| `textures/apple.png` | Pixel Perfection CE item/apple.png |  |
| `textures/golden_apple.png` | Pixel Perfection CE item/golden_apple.png |  |
| `textures/bread.png` | Pixel Perfection CE item/bread.png |  |
| `textures/carrot.png` | Pixel Perfection CE item/carrot.png |  |
| `textures/golden_carrot.png` | Pixel Perfection CE item/golden_carrot.png |  |
| `textures/beetroot.png` | Pixel Perfection CE item/beetroot.png |  |
| `textures/melon_slice.png` | Pixel Perfection CE item/melon_slice.png |  |
| `textures/pumpkin_pie.png` | Pixel Perfection CE item/pumpkin_pie.png |  |
| `textures/cookie.png` | Pixel Perfection CE item/cookie.png |  |
| `textures/glass_bottle.png` | Pixel Perfection CE item/glass_bottle.png |  |
| `textures/potion_healing.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_healing.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_regeneration.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_regeneration.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_swiftness.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_swiftness.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_strength.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_strength.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_leaping.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_leaping.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_fire_resistance.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_fire_resistance.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_water_breathing.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_water_breathing.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_night_vision.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_night_vision.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_invisibility.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_invisibility.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_slowness.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_slowness.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_poison.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_poison.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/potion_harming.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/potion.png | changed |
| `textures/splash_potion_harming.png` | Pixel Perfection CE item/potion_overlay.png; Pixel Perfection CE item/splash_potion.png | changed |
| `textures/wooden_pickaxe.png` | Pixel Perfection CE item/wooden_pickaxe.png |  |
| `textures/wooden_axe.png` | Pixel Perfection CE item/wooden_axe.png |  |
| `textures/wooden_shovel.png` | Pixel Perfection CE item/wooden_shovel.png |  |
| `textures/wooden_hoe.png` | Pixel Perfection CE item/wooden_hoe.png |  |
| `textures/wooden_sword.png` | Pixel Perfection CE item/wooden_sword.png |  |
| `textures/stone_pickaxe.png` | Pixel Perfection CE item/stone_pickaxe.png |  |
| `textures/stone_axe.png` | Pixel Perfection CE item/stone_axe.png |  |
| `textures/stone_shovel.png` | Pixel Perfection CE item/stone_shovel.png |  |
| `textures/stone_hoe.png` | Pixel Perfection CE item/stone_hoe.png |  |
| `textures/stone_sword.png` | Pixel Perfection CE item/stone_sword.png |  |
| `textures/iron_pickaxe.png` | Pixel Perfection CE item/iron_pickaxe.png |  |
| `textures/iron_axe.png` | Pixel Perfection CE item/iron_axe.png |  |
| `textures/iron_shovel.png` | Pixel Perfection CE item/iron_shovel.png |  |
| `textures/iron_hoe.png` | Pixel Perfection CE item/iron_hoe.png |  |
| `textures/iron_sword.png` | Pixel Perfection CE item/iron_sword.png |  |
| `textures/golden_pickaxe.png` | Pixel Perfection CE item/golden_pickaxe.png |  |
| `textures/golden_axe.png` | Pixel Perfection CE item/golden_axe.png |  |
| `textures/golden_shovel.png` | Pixel Perfection CE item/golden_shovel.png |  |
| `textures/golden_hoe.png` | Pixel Perfection CE item/golden_hoe.png |  |
| `textures/golden_sword.png` | Pixel Perfection CE item/golden_sword.png |  |
| `textures/diamond_pickaxe.png` | Pixel Perfection CE item/diamond_pickaxe.png |  |
| `textures/diamond_axe.png` | Pixel Perfection CE item/diamond_axe.png |  |
| `textures/diamond_shovel.png` | Pixel Perfection CE item/diamond_shovel.png |  |
| `textures/diamond_hoe.png` | Pixel Perfection CE item/diamond_hoe.png |  |
| `textures/diamond_sword.png` | Pixel Perfection CE item/diamond_sword.png |  |
| `textures/stick.png` | Pixel Perfection CE item/stick.png |  |
| `textures/bow.png` | Pixel Perfection CE item/bow.png |  |
| `textures/arrow.png` | Pixel Perfection CE item/arrow.png |  |
| `textures/fishing_rod.png` | Pixel Perfection CE item/fishing_rod.png |  |
| `textures/fishing_rod_cast.png` | Pixel Perfection CE item/fishing_rod_cast.png |  |
| `textures/shears.png` | Pixel Perfection CE item/shears.png |  |
| `textures/flint_and_steel.png` | Pixel Perfection CE item/flint_and_steel.png |  |
| `textures/raw_porkchop.png` | Pixel Perfection CE item/porkchop.png |  |
| `textures/cooked_porkchop.png` | Pixel Perfection CE item/cooked_porkchop.png |  |
| `textures/raw_beef.png` | Pixel Perfection CE item/beef.png |  |
| `textures/cooked_beef.png` | Pixel Perfection CE item/cooked_beef.png |  |
| `textures/raw_mutton.png` | Pixel Perfection CE item/mutton.png |  |
| `textures/cooked_mutton.png` | Pixel Perfection CE item/cooked_mutton.png |  |
| `textures/raw_chicken.png` | Pixel Perfection CE item/chicken.png |  |
| `textures/cooked_chicken.png` | Pixel Perfection CE item/cooked_chicken.png |  |
| `textures/raw_rabbit.png` | Pixel Perfection CE item/rabbit.png |  |
| `textures/cooked_rabbit.png` | Pixel Perfection CE item/cooked_rabbit.png |  |
| `textures/cod.png` | Pixel Perfection CE item/cod.png |  |
| `textures/cooked_cod.png` | Pixel Perfection CE item/cooked_cod.png |  |
| `textures/salmon.png` | Pixel Perfection CE item/salmon.png |  |
| `textures/cooked_salmon.png` | Pixel Perfection CE item/cooked_salmon.png |  |
| `textures/tropical_fish.png` | Pixel Perfection CE item/tropical_fish.png |  |
| `textures/pufferfish.png` | Pixel Perfection CE item/pufferfish.png |  |
| `textures/bowl.png` | Pixel Perfection CE item/bowl.png |  |
| `textures/mushroom_stew.png` | Pixel Perfection CE item/mushroom_stew.png |  |
| `textures/beetroot_soup.png` | Pixel Perfection CE item/beetroot_soup.png |  |
| `textures/rabbit_stew.png` | Pixel Perfection CE item/rabbit_stew.png |  |
| `textures/rotten_flesh.png` | Pixel Perfection CE item/rotten_flesh.png |  |
| `textures/potato.png` | Pixel Perfection CE item/potato.png |  |
| `textures/baked_potato.png` | Pixel Perfection CE item/baked_potato.png |  |
| `textures/poisonous_potato.png` | Pixel Perfection CE item/poisonous_potato.png |  |
| `textures/spider_eye.png` | Pixel Perfection CE item/spider_eye.png |  |
| `textures/redstone.png` | Pixel Perfection CE item/redstone.png |  |
| `textures/flint.png` | Pixel Perfection CE item/flint.png |  |
| `textures/string.png` | Pixel Perfection CE item/string.png |  |
| `textures/raw_iron.png` | Mineclonia mods/ITEMS/mcl_raw_ores/textures/mcl_raw_ores_raw_iron.png |  |
| `textures/raw_gold.png` | Mineclonia mods/ITEMS/mcl_raw_ores/textures/mcl_raw_ores_raw_gold.png |  |
| `textures/raw_copper.png` | Mineclonia mods/ITEMS/mcl_copper/textures/mcl_copper_raw.png |  |
| `textures/wheat_seeds.png` | Pixel Perfection CE item/wheat_seeds.png |  |
| `textures/beetroot_seeds.png` | Pixel Perfection CE item/beetroot_seeds.png |  |
| `textures/pumpkin_seeds.png` | Pixel Perfection CE item/pumpkin_seeds.png |  |
| `textures/melon_seeds.png` | Pixel Perfection CE item/melon_seeds.png |  |
| `textures/wheat.png` | Pixel Perfection CE item/wheat.png |  |
| `textures/saddle.png` | Pixel Perfection CE item/saddle.png |  |
| `textures/bone_meal.png` | Pixel Perfection CE item/bone_meal.png |  |
| `textures/sugar.png` | Pixel Perfection CE item/sugar.png |  |
| `textures/gunpowder.png` | Pixel Perfection CE item/gunpowder.png |  |
| `textures/feather.png` | Pixel Perfection CE item/feather.png |  |
| `textures/leather.png` | Pixel Perfection CE item/leather.png |  |
| `textures/rabbit_hide.png` | Pixel Perfection CE item/rabbit_hide.png |  |
| `textures/clay_ball.png` | Pixel Perfection CE item/clay_ball.png |  |
| `textures/bone.png` | Pixel Perfection CE item/bone.png |  |
| `textures/paper.png` | Pixel Perfection CE item/paper.png |  |
| `textures/phantom_membrane.png` | Pixel Perfection CE item/phantom_membrane.png |  |
| `textures/bucket.png` | Pixel Perfection CE item/bucket.png |  |
| `textures/water_bucket.png` | Pixel Perfection CE item/water_bucket.png |  |
| `textures/lava_bucket.png` | Pixel Perfection CE item/lava_bucket.png |  |
| `textures/milk_bucket.png` | Pixel Perfection CE item/milk_bucket.png |  |
| `textures/compass.png` | Pixel Perfection CE item/compass_16.png |  |
| `textures/clock.png` | Pixel Perfection CE item/clock_00.png |  |
| `textures/book.png` | Pixel Perfection CE item/book.png |  |
| `textures/name_tag.png` | Pixel Perfection CE item/name_tag.png |  |
| `textures/lead.png` | Pixel Perfection CE item/lead.png |  |
| `textures/snowball.png` | Pixel Perfection CE item/snowball.png |  |
| `textures/oak_boat.png` | Pixel Perfection CE item/oak_boat.png |  |
| `textures/spruce_boat.png` | Pixel Perfection CE item/spruce_boat.png |  |
| `textures/birch_boat.png` | Pixel Perfection CE item/birch_boat.png |  |
| `textures/jungle_boat.png` | Pixel Perfection CE item/jungle_boat.png |  |
| `textures/acacia_boat.png` | Pixel Perfection CE item/acacia_boat.png |  |
| `textures/dark_oak_boat.png` | Pixel Perfection CE item/dark_oak_boat.png |  |
| `textures/cherry_boat.png` | Mineclonia mods/ENTITIES/mcl_boats/textures/mcl_boats_cherry_blossom_boat.png |  |
| `textures/minecart_item.png` | Pixel Perfection CE item/minecart.png |  |
| `textures/item_frame_item.png` | Pixel Perfection CE item/item_frame.png |  |
| `textures/painting_item.png` | Pixel Perfection CE item/painting.png |  |
| `textures/enchanted_book.png` | Pixel Perfection CE item/enchanted_book.png |  |
| `textures/leather_helmet.png` | Pixel Perfection CE item/leather_helmet.png; Pixel Perfection CE item/leather_helmet_overlay.png | changed |
| `textures/leather_chestplate.png` | Pixel Perfection CE item/leather_chestplate.png; Pixel Perfection CE item/leather_chestplate_overlay.png | changed |
| `textures/leather_leggings.png` | Pixel Perfection CE item/leather_leggings.png; Pixel Perfection CE item/leather_leggings_overlay.png | changed |
| `textures/leather_boots.png` | Pixel Perfection CE item/leather_boots.png; Pixel Perfection CE item/leather_boots_overlay.png | changed |
| `textures/iron_helmet.png` | Pixel Perfection CE item/iron_helmet.png |  |
| `textures/iron_chestplate.png` | Pixel Perfection CE item/iron_chestplate.png |  |
| `textures/iron_leggings.png` | Pixel Perfection CE item/iron_leggings.png |  |
| `textures/iron_boots.png` | Pixel Perfection CE item/iron_boots.png |  |
| `textures/golden_helmet.png` | Pixel Perfection CE item/golden_helmet.png |  |
| `textures/golden_chestplate.png` | Pixel Perfection CE item/golden_chestplate.png |  |
| `textures/golden_leggings.png` | Pixel Perfection CE item/golden_leggings.png |  |
| `textures/golden_boots.png` | Pixel Perfection CE item/golden_boots.png |  |
| `textures/diamond_helmet.png` | Pixel Perfection CE item/diamond_helmet.png |  |
| `textures/diamond_chestplate.png` | Pixel Perfection CE item/diamond_chestplate.png |  |
| `textures/diamond_leggings.png` | Pixel Perfection CE item/diamond_leggings.png |  |
| `textures/diamond_boots.png` | Pixel Perfection CE item/diamond_boots.png |  |
| `textures/chainmail_helmet.png` | Pixel Perfection CE item/chainmail_helmet.png |  |
| `textures/chainmail_chestplate.png` | Pixel Perfection CE item/chainmail_chestplate.png |  |
| `textures/chainmail_leggings.png` | Pixel Perfection CE item/chainmail_leggings.png |  |
| `textures/chainmail_boots.png` | Pixel Perfection CE item/chainmail_boots.png |  |
| `textures/oak_door_top.png` | Pixel Perfection CE block/oak_door_top.png |  |
| `textures/oak_door_bottom.png` | Pixel Perfection CE block/oak_door_bottom.png |  |
| `textures/spruce_door_top.png` | Pixel Perfection CE block/spruce_door_top.png |  |
| `textures/spruce_door_bottom.png` | Pixel Perfection CE block/spruce_door_bottom.png |  |
| `textures/birch_door_top.png` | Pixel Perfection CE block/birch_door_top.png |  |
| `textures/birch_door_bottom.png` | Pixel Perfection CE block/birch_door_bottom.png |  |
| `textures/jungle_door_top.png` | Pixel Perfection CE block/jungle_door_top.png |  |
| `textures/jungle_door_bottom.png` | Pixel Perfection CE block/jungle_door_bottom.png |  |
| `textures/acacia_door_top.png` | Pixel Perfection CE block/acacia_door_top.png |  |
| `textures/acacia_door_bottom.png` | Pixel Perfection CE block/acacia_door_bottom.png |  |
| `textures/dark_oak_door_top.png` | Pixel Perfection CE block/dark_oak_door_top.png |  |
| `textures/dark_oak_door_bottom.png` | Pixel Perfection CE block/dark_oak_door_bottom.png |  |
| `textures/cherry_door_top.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_door_top.png |  |
| `textures/cherry_door_bottom.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_door_bottom.png |  |
| `textures/iron_door_top.png` | Pixel Perfection CE block/iron_door_top.png |  |
| `textures/iron_door_bottom.png` | Pixel Perfection CE block/iron_door_bottom.png |  |
| `textures/oak_door_item.png` | Pixel Perfection CE item/oak_door.png |  |
| `textures/spruce_door_item.png` | Pixel Perfection CE item/spruce_door.png |  |
| `textures/birch_door_item.png` | Pixel Perfection CE item/birch_door.png |  |
| `textures/jungle_door_item.png` | Pixel Perfection CE item/jungle_door.png |  |
| `textures/acacia_door_item.png` | Pixel Perfection CE item/acacia_door.png |  |
| `textures/dark_oak_door_item.png` | Pixel Perfection CE item/dark_oak_door.png |  |
| `textures/cherry_door_item.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_door_inv.png |  |
| `textures/iron_door_item.png` | Pixel Perfection CE item/iron_door.png |  |
| `textures/ladder.png` | Pixel Perfection CE block/ladder.png |  |
| `textures/iron_bars.png` | Pixel Perfection CE block/iron_bars.png |  |
| `textures/sign_item.png` | Pixel Perfection CE item/oak_sign.png |  |
| `textures/bed_item.png` | Pixel Perfection CE item/bed.png | changed |
| `textures/lantern_item.png` | Pixel Perfection CE item/lantern.png |  |
| `textures/campfire_item.png` | Pixel Perfection CE item/campfire.png |  |
| `textures/lever_item.png` | Pixel Perfection CE block/lever.png |  |
| `textures/crit.png` | Pixel Perfection CE particle/critical_hit.png | changed |
| `textures/heart.png` | Pixel Perfection CE particle/heart.png | changed |
| `textures/happy.png` | Pixel Perfection CE particle/glint.png | changed |
| `textures/angry.png` | Pixel Perfection CE particle/angry.png | changed |
| `textures/portal.png` | Pixel Perfection CE block/portal.png | changed |
| `textures/bubble.png` | Pixel Perfection CE particle/bubble.png | changed |
| `textures/smoke.png` | Pixel Perfection CE particle/generic_5.png | changed |
| `textures/fire_0.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_1.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_2.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_3.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_4.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_5.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_6.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/fire_7.png` | Pixel Perfection CE block/fire_0.png | changed |
| `textures/destroy_0.png` | Pixel Perfection CE block/destroy_stage_0.png |  |
| `textures/destroy_1.png` | Pixel Perfection CE block/destroy_stage_1.png |  |
| `textures/destroy_2.png` | Pixel Perfection CE block/destroy_stage_2.png |  |
| `textures/destroy_3.png` | Pixel Perfection CE block/destroy_stage_3.png |  |
| `textures/destroy_4.png` | Pixel Perfection CE block/destroy_stage_4.png |  |
| `textures/destroy_5.png` | Pixel Perfection CE block/destroy_stage_5.png |  |
| `textures/destroy_6.png` | Pixel Perfection CE block/destroy_stage_6.png |  |
| `textures/destroy_7.png` | Pixel Perfection CE block/destroy_stage_7.png |  |
| `textures/destroy_8.png` | Pixel Perfection CE block/destroy_stage_8.png |  |
| `textures/destroy_9.png` | Pixel Perfection CE block/destroy_stage_9.png |  |
| `textures/oak_trapdoor.png` | Pixel Perfection CE block/oak_trapdoor.png |  |
| `textures/spruce_trapdoor.png` | Pixel Perfection CE block/spruce_trapdoor.png |  |
| `textures/birch_trapdoor.png` | Pixel Perfection CE block/birch_trapdoor.png |  |
| `textures/jungle_trapdoor.png` | Pixel Perfection CE block/jungle_trapdoor.png |  |
| `textures/acacia_trapdoor.png` | Pixel Perfection CE block/acacia_trapdoor.png |  |
| `textures/dark_oak_trapdoor.png` | Pixel Perfection CE block/dark_oak_trapdoor.png |  |
| `textures/cherry_trapdoor.png` | Mineclonia mods/ITEMS/mcl_cherry_blossom/textures/mcl_cherry_blossom_trapdoor.png |  |
| `textures/iron_trapdoor.png` | Pixel Perfection CE block/iron_trapdoor.png |  |
| `textures/lever.png` | Pixel Perfection CE block/lever.png | changed |
| `textures/redstone_lamp.png` | Pixel Perfection CE block/redstone_lamp.png |  |
| `textures/redstone_lamp_on.png` | Pixel Perfection CE block/redstone_lamp_on.png |  |
| `textures/enchanting_table_top.png` | Pixel Perfection CE block/enchanting_table_top.png |  |
| `textures/enchanting_table_side.png` | Pixel Perfection CE block/enchanting_table_side.png |  |
| `textures/enchanting_table_bottom.png` | Pixel Perfection CE block/enchanting_table_bottom.png |  |
| `textures/xp_orb.png` | Pixel Perfection CE entity/experience_orb.png | changed |
| `textures/magic_crit.png` | Pixel Perfection CE particle/enchanted_hit.png | changed |
| `textures/cake_top.png` | Pixel Perfection CE block/cake_top.png |  |
| `textures/cake_side.png` | Pixel Perfection CE block/cake_side.png |  |
| `textures/cake_inner.png` | Pixel Perfection CE block/cake_inner.png |  |
| `textures/cake_bottom.png` | Pixel Perfection CE block/cake_bottom.png |  |
| `textures/cake_item.png` | Pixel Perfection CE item/cake.png |  |
| `textures/note_block.png` | Pixel Perfection CE block/note_block.png |  |
| `textures/jukebox_side.png` | Pixel Perfection CE block/jukebox_side.png |  |
| `textures/jukebox_top.png` | Pixel Perfection CE block/jukebox_top.png |  |
| `textures/music_disc_0.png` | Pixel Perfection CE item/music_disc_cat.png |  |
| `textures/music_disc_1.png` | Pixel Perfection CE item/music_disc_mall.png |  |
| `textures/music_disc_2.png` | Pixel Perfection CE item/music_disc_blocks.png |  |
| `textures/music_disc_3.png` | Pixel Perfection CE item/music_disc_wait.png |  |
| `textures/music_disc_4.png` | Pixel Perfection CE item/music_disc_13.png |  |
| `textures/music_disc_5.png` | Pixel Perfection CE item/music_disc_mellohi.png |  |
| `textures/music_disc_6.png` | Pixel Perfection CE item/music_disc_ward.png |  |
| `textures/music_disc_7.png` | Pixel Perfection CE item/music_disc_strad.png |  |
| `textures/note.png` | Pixel Perfection CE particle/note.png | changed |
| `textures/painting_sunrise_0_0.png` | Pixel Perfection CE painting/aztec.png | changed |
| `textures/painting_moonlit_0_0.png` | Pixel Perfection CE painting/alban.png | changed |
| `textures/painting_still_life_0_0.png` | Pixel Perfection CE painting/plant.png | changed |
| `textures/painting_bouquet_0_0.png` | Pixel Perfection CE painting/kebab.png | changed |
| `textures/painting_wanderer_0_0.png` | Pixel Perfection CE painting/wanderer.png | changed |
| `textures/painting_wanderer_0_1.png` | Pixel Perfection CE painting/wanderer.png | changed |
| `textures/painting_falls_0_0.png` | Pixel Perfection CE painting/graham.png | changed |
| `textures/painting_falls_0_1.png` | Pixel Perfection CE painting/graham.png | changed |
| `textures/painting_fields_0_0.png` | Pixel Perfection CE painting/pool.png | changed |
| `textures/painting_fields_1_0.png` | Pixel Perfection CE painting/pool.png | changed |
| `textures/painting_sail_0_0.png` | Pixel Perfection CE painting/sea.png | changed |
| `textures/painting_sail_1_0.png` | Pixel Perfection CE painting/sea.png | changed |
| `textures/painting_village_0_0.png` | Pixel Perfection CE painting/match.png | changed |
| `textures/painting_village_1_0.png` | Pixel Perfection CE painting/match.png | changed |
| `textures/painting_village_0_1.png` | Pixel Perfection CE painting/match.png | changed |
| `textures/painting_village_1_1.png` | Pixel Perfection CE painting/match.png | changed |
| `textures/painting_peaks_0_0.png` | Pixel Perfection CE painting/bust.png | changed |
| `textures/painting_peaks_1_0.png` | Pixel Perfection CE painting/bust.png | changed |
| `textures/painting_peaks_0_1.png` | Pixel Perfection CE painting/bust.png | changed |
| `textures/painting_peaks_1_1.png` | Pixel Perfection CE painting/bust.png | changed |
| `textures/painting_starry_0_0.png` | Pixel Perfection CE painting/stage.png | changed |
| `textures/painting_starry_1_0.png` | Pixel Perfection CE painting/stage.png | changed |
| `textures/painting_starry_0_1.png` | Pixel Perfection CE painting/stage.png | changed |
| `textures/painting_starry_1_1.png` | Pixel Perfection CE painting/stage.png | changed |
| `textures/painting_blocks_0_0.png` | Pixel Perfection CE painting/skull_and_roses.png | changed |
| `textures/painting_blocks_1_0.png` | Pixel Perfection CE painting/skull_and_roses.png | changed |
| `textures/painting_blocks_0_1.png` | Pixel Perfection CE painting/skull_and_roses.png | changed |
| `textures/painting_blocks_1_1.png` | Pixel Perfection CE painting/skull_and_roses.png | changed |
| `textures/painting_castle_0_0.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_1_0.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_2_0.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_3_0.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_0_1.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_1_1.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_2_1.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_castle_3_1.png` | Pixel Perfection CE painting/fighters.png | changed |
| `textures/painting_islands_0_0.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_1_0.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_2_0.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_3_0.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_0_1.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_1_1.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_2_1.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_3_1.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_0_2.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_1_2.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_2_2.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_islands_3_2.png` | Pixel Perfection CE painting/skeleton.png | changed |
| `textures/painting_deep_0_0.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_1_0.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_2_0.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_3_0.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_0_1.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_1_1.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_2_1.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_3_1.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_0_2.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_1_2.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_2_2.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_3_2.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_0_3.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_1_3.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_2_3.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_deep_3_3.png` | Pixel Perfection CE painting/pointer.png | changed |
| `textures/painting_back.png` | Pixel Perfection CE painting/back.png |  |
| `textures/item_frame.png` | Pixel Perfection CE block/item_frame.png |  |
| `textures/rail.png` | Pixel Perfection CE block/rail.png |  |
| `textures/rail_corner.png` | Pixel Perfection CE block/rail_corner.png |  |
| `textures/powered_rail.png` | Pixel Perfection CE block/powered_rail.png |  |
| `textures/powered_rail_on.png` | Pixel Perfection CE block/powered_rail_on.png | changed |
| `textures/detector_rail.png` | Pixel Perfection CE block/detector_rail.png |  |
| `textures/detector_rail_on.png` | Pixel Perfection CE block/detector_rail_on.png |  |
| `textures/minecart.png` | Pixel Perfection CE item/minecart.png |  |
| `textures/tuff.png` | Mineclonia mods/ITEMS/mcl_deepslate/textures/mcl_deepslate_tuff.png |  |
| `textures/dripstone_block.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/dripstone_block.png |  |
| `textures/smooth_basalt.png` | Mineclonia mods/ITEMS/mcl_blackstone/textures/mcl_blackstone_basalt_smooth.png |  |
| `textures/raw_copper_block.png` | Mineclonia mods/ITEMS/mcl_copper/textures/mcl_copper_block_raw.png |  |
| `textures/raw_gold_block.png` | Mineclonia mods/ITEMS/mcl_raw_ores/textures/mcl_raw_ores_raw_gold_block.png |  |
| `textures/moss_block.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_moss_block.png |  |
| `textures/rooted_dirt.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_rooted_dirt.png |  |
| `textures/amethyst_block.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_block.png |  |
| `textures/budding_amethyst.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_budding_amethyst.png |  |
| `textures/azalea_leaves.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_leaves.png |  |
| `textures/azalea_top.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_top.png |  |
| `textures/flowering_azalea_leaves.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_leaves_flowering.png |  |
| `textures/flowering_azalea_top.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_flowering_top.png |  |
| `textures/azalea_side.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_side.png |  |
| `textures/flowering_azalea_side.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_flowering_side.png |  |
| `textures/azalea_plant.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_azalea_plant.png |  |
| `textures/pointed_dripstone_up_base.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_base.png | changed |
| `textures/pointed_dripstone_down_base.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_base.png |  |
| `textures/pointed_dripstone_up_middle.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_middle.png | changed |
| `textures/pointed_dripstone_down_middle.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_middle.png |  |
| `textures/pointed_dripstone_up_frustum.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_frustum.png | changed |
| `textures/pointed_dripstone_down_frustum.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_frustum.png |  |
| `textures/pointed_dripstone_up_tip.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_tip.png | changed |
| `textures/pointed_dripstone_down_tip.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_tip.png |  |
| `textures/pointed_dripstone_up_tip_merge.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_tip_merge.png | changed |
| `textures/pointed_dripstone_down_tip_merge.png` | Mineclonia mods/ITEMS/mcl_dripstone/textures/pointed_dripstone_tip_merge.png |  |
| `textures/cave_vines.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_cave_vines.png |  |
| `textures/cave_vines_lit.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_cave_vines_lit.png |  |
| `textures/cave_vines_plant.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_cave_vines_plant.png |  |
| `textures/cave_vines_plant_lit.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_cave_vines_plant_lit.png |  |
| `textures/hanging_roots.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_hanging_roots.png |  |
| `textures/spore_blossom_hanging.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_spore_blossom.png | changed |
| `textures/glow_lichen.png` | Mineclonia mods/ITEMS/mcl_core/textures/mcl_core_glow_lichen.png |  |
| `textures/big_dripleaf_top.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_big_dripleaf_top.png |  |
| `textures/big_dripleaf_side.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_big_dripleaf_side.png |  |
| `textures/big_dripleaf_stem.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_big_dripleaf_stem.png |  |
| `textures/small_amethyst_bud.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_bud_small.png |  |
| `textures/small_amethyst_bud_down.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_bud_small.png | changed |
| `textures/medium_amethyst_bud.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_bud_medium.png |  |
| `textures/medium_amethyst_bud_down.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_bud_medium.png | changed |
| `textures/large_amethyst_bud.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_bud_large.png |  |
| `textures/large_amethyst_bud_down.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_bud_large.png | changed |
| `textures/amethyst_cluster.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_cluster.png |  |
| `textures/amethyst_cluster_down.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_cluster.png | changed |
| `textures/cobweb.png` | Pixel Perfection CE block/cobweb.png |  |
| `textures/glow_berries.png` | Mineclonia mods/ITEMS/mcl_lush_caves/textures/mcl_lush_caves_glow_berries.png |  |
| `textures/amethyst_shard.png` | Mineclonia mods/ITEMS/mcl_amethyst/textures/mcl_amethyst_amethyst_shard.png |  |
| `textures/kelp.png` | Pixel Perfection CE block/kelp.png | changed |
| `textures/kelp_plant.png` | Pixel Perfection CE block/kelp_plant.png | changed |
| `textures/seagrass.png` | Pixel Perfection CE block/seagrass.png | changed |
| `textures/tall_seagrass_bottom.png` | Pixel Perfection CE block/tall_seagrass_bottom.png | changed |
| `textures/tall_seagrass_top.png` | Pixel Perfection CE block/tall_seagrass_top.png | changed |
| `textures/tube_coral_block.png` | Pixel Perfection CE block/tube_coral_block.png |  |
| `textures/tube_coral.png` | Pixel Perfection CE block/tube_coral.png |  |
| `textures/tube_coral_fan.png` | Pixel Perfection CE block/tube_coral_fan.png |  |
| `textures/brain_coral_block.png` | Pixel Perfection CE block/brain_coral_block.png |  |
| `textures/brain_coral.png` | Pixel Perfection CE block/brain_coral.png |  |
| `textures/brain_coral_fan.png` | Pixel Perfection CE block/brain_coral_fan.png |  |
| `textures/bubble_coral_block.png` | Pixel Perfection CE block/bubble_coral_block.png |  |
| `textures/bubble_coral.png` | Pixel Perfection CE block/bubble_coral.png |  |
| `textures/bubble_coral_fan.png` | Pixel Perfection CE block/bubble_coral_fan.png |  |
| `textures/fire_coral_block.png` | Pixel Perfection CE block/fire_coral_block.png |  |
| `textures/fire_coral.png` | Pixel Perfection CE block/fire_coral.png |  |
| `textures/fire_coral_fan.png` | Pixel Perfection CE block/fire_coral_fan.png |  |
| `textures/horn_coral_block.png` | Pixel Perfection CE block/horn_coral_block.png |  |
| `textures/horn_coral.png` | Pixel Perfection CE block/horn_coral.png |  |
| `textures/horn_coral_fan.png` | Pixel Perfection CE block/horn_coral_fan.png |  |
| `textures/sea_pickle.png` | Pixel Perfection CE block/sea_pickle.png |  |
| `textures/sea_pickle_item.png` | Pixel Perfection CE item/sea_pickle.png |  |
| `textures/kelp_item.png` | Pixel Perfection CE item/kelp.png |  |
| `textures/dried_kelp.png` | Pixel Perfection CE item/dried_kelp.png |  |
| `textures/dried_kelp_side.png` | Pixel Perfection CE block/dried_kelp_side.png |  |
| `textures/dried_kelp_top.png` | Pixel Perfection CE block/dried_kelp_top.png |  |
| `textures/dried_kelp_bottom.png` | Pixel Perfection CE block/dried_kelp_bottom.png |  |
| `textures/raw_shark.png` | Pixel Perfection CE item/beef.png | changed |
| `textures/cooked_shark.png` | Pixel Perfection CE item/cooked_beef.png | changed |
| `textures/raw_venison.png` | Pixel Perfection CE item/mutton.png | changed |
| `textures/cooked_venison.png` | Pixel Perfection CE item/cooked_mutton.png | changed |
| `textures/raw_bear.png` | Pixel Perfection CE item/beef.png | changed |
| `textures/cooked_bear.png` | Pixel Perfection CE item/cooked_beef.png | changed |
| `textures/bamboo.png` | Pixel Perfection CE block/bamboo_stalk.png; Pixel Perfection CE block/bamboo_large_leaves.png | changed |
| `textures/bamboo_mid.png` | Pixel Perfection CE block/bamboo_stalk.png; Pixel Perfection CE block/bamboo_small_leaves.png | changed |
| `textures/bamboo_stalk.png` | Pixel Perfection CE block/bamboo_stalk.png | changed |
| `textures/bamboo_item.png` | Pixel Perfection CE item/bamboo.png | changed |
| `textures/pig_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/cow_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/sheep_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/chicken_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/rabbit_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/fox_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/goat_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/wolf_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/horse_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/polar_bear_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/squid_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/cod_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/salmon_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/zombie_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/husk_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/skeleton_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/stray_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/creeper_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/spider_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/enderman_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/slime_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/donkey_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/mule_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/llama_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/cat_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/turtle_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/parrot_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/bat_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/iron_golem_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/snow_golem_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/dolphin_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/tropical_fish_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/pufferfish_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/shark_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/humpback_whale_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/blue_whale_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/brown_bear_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/black_bear_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/deer_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/moose_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/boar_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/tiger_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/lion_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/panda_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/elephant_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/hippo_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/zebra_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/giraffe_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/crocodile_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/camel_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/penguin_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/robin_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/blue_jay_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/cardinal_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/sparrow_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/goldfinch_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/crow_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/seagull_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/eagle_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/vulture_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/butterfly_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/bee_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/drowned_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/witch_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/cave_spider_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `textures/phantom_spawn_egg.png` | Pixel Perfection CE item/spawn_egg.png; Pixel Perfection CE item/spawn_egg_overlay.png | changed |
| `skins/zombie.png` | Pixel Perfection CE entity/zombie/zombie.png | changed |
| `skins/husk.png` | Pixel Perfection CE entity/zombie/husk.png | changed |
| `skins/drowned.png` | Pixel Perfection CE entity/zombie/drowned.png; Pixel Perfection CE entity/zombie/drowned_outer_layer.png | changed |
| `skins/player_0.png` | Pixel Perfection CE entity/steve.png | changed |
| `skins/skeleton.png` | Pixel Perfection CE entity/skeleton/skeleton.png | changed |
| `skins/stray.png` | Pixel Perfection CE entity/skeleton/stray.png | changed |
| `skins/creeper.png` | Pixel Perfection CE entity/creeper/creeper.png | changed |
| `skins/spider.png` | Pixel Perfection CE entity/spider/spider.png | changed |
| `skins/cave_spider.png` | Pixel Perfection CE entity/spider/cave_spider.png | changed |
| `skins/squid.png` | Pixel Perfection CE entity/squid.png | changed |
| `skins/cod.png` | Pixel Perfection CE entity/fish/cod.png | changed |
| `skins/salmon.png` | Pixel Perfection CE entity/fish/salmon.png | changed |
| `skins/tropical_clownfish.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_1.png | changed |
| `skins/tropical_tomato_clownfish.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_1.png | changed |
| `skins/tropical_triggerfish.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_2.png | changed |
| `skins/tropical_parrotfish.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_2.png | changed |
| `skins/tropical_blue_tang.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_4.png | changed |
| `skins/tropical_queen_angelfish.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_5.png | changed |
| `skins/tropical_cotton_candy_betta.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_6.png | changed |
| `skins/tropical_snooper.png` | Pixel Perfection CE entity/fish/tropical_a.png; Pixel Perfection CE entity/fish/tropical_a_pattern_3.png | changed |
| `skins/tropical_threadfin.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_1.png | changed |
| `skins/tropical_yellow_tang.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_2.png | changed |
| `skins/tropical_red_lipped_blenny.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_2.png | changed |
| `skins/tropical_glitterfish.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_3.png | changed |
| `skins/tropical_red_snapper.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_4.png | changed |
| `skins/tropical_red_cichlid.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_5.png | changed |
| `skins/tropical_ornate_butterflyfish.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_6.png | changed |
| `skins/tropical_goatfish.png` | Pixel Perfection CE entity/fish/tropical_b.png; Pixel Perfection CE entity/fish/tropical_b_pattern_4.png | changed |
| `skins/pufferfish.png` | Pixel Perfection CE entity/fish/pufferfish.png | changed |
| `skins/pig.png` | Pixel Perfection CE entity/pig/pig.png | changed |
| `skins/cow.png` | Pixel Perfection CE entity/cow/cow.png | changed |
| `skins/sheep.png` | Pixel Perfection CE entity/sheep/sheep.png | changed |
| `skins/sheep_wool.png` | Pixel Perfection CE entity/sheep/sheep_fur.png | changed |
| `skins/chicken.png` | Pixel Perfection CE entity/chicken.png | changed |
| `skins/wolf.png` | Pixel Perfection CE entity/wolf/wolf.png | changed |
| `skins/wolf_angry.png` | Pixel Perfection CE entity/wolf/wolf_angry.png | changed |
| `skins/wolf_snowy.png` | Pixel Perfection CE entity/wolf/wolf.png | changed |
| `skins/wolf_snowy_angry.png` | Pixel Perfection CE entity/wolf/wolf_angry.png | changed |
| `skins/wolf_woods.png` | Pixel Perfection CE entity/wolf/wolf.png | changed |
| `skins/wolf_woods_angry.png` | Pixel Perfection CE entity/wolf/wolf_angry.png | changed |
| `skins/wolf_black.png` | Pixel Perfection CE entity/wolf/wolf.png | changed |
| `skins/wolf_black_angry.png` | Pixel Perfection CE entity/wolf/wolf_angry.png | changed |
| `skins/wolf_rusty.png` | Pixel Perfection CE entity/wolf/wolf.png | changed |
| `skins/wolf_rusty_angry.png` | Pixel Perfection CE entity/wolf/wolf_angry.png | changed |
| `skins/wolf_ashen.png` | Pixel Perfection CE entity/wolf/wolf.png | changed |
| `skins/wolf_ashen_angry.png` | Pixel Perfection CE entity/wolf/wolf_angry.png | changed |
| `skins/panda.png` | Pixel Perfection CE entity/panda/panda.png | changed |
| `skins/panda_lazy.png` | Pixel Perfection CE entity/panda/lazy_panda.png | changed |
| `skins/panda_worried.png` | Pixel Perfection CE entity/panda/worried_panda.png | changed |
| `skins/panda_playful.png` | Pixel Perfection CE entity/panda/playful_panda.png | changed |
| `skins/panda_weak.png` | Pixel Perfection CE entity/panda/weak_panda.png | changed |
| `skins/panda_aggressive.png` | Pixel Perfection CE entity/panda/aggressive_panda.png | changed |
| `skins/panda_brown.png` | Pixel Perfection CE entity/panda/brown_panda.png | changed |
| `skins/bee.png` | Pixel Perfection CE entity/bee/bee.png | changed |
| `skins/bee_angry.png` | Pixel Perfection CE entity/bee/bee_angry.png | changed |
| `skins/turtle.png` | Pixel Perfection CE entity/turtle/big_sea_turtle.png | changed |
| `skins/zebra.png` | Pixel Perfection CE entity/horse/horse_white.png | changed |
| `skins/horse_white.png` | Pixel Perfection CE entity/horse/horse_white.png | changed |
| `skins/horse_creamy.png` | Pixel Perfection CE entity/horse/horse_creamy.png | changed |
| `skins/horse_chestnut.png` | Pixel Perfection CE entity/horse/horse_chestnut.png | changed |
| `skins/horse_brown.png` | Pixel Perfection CE entity/horse/horse_brown.png | changed |
| `skins/horse_black.png` | Pixel Perfection CE entity/horse/horse_black.png | changed |
| `skins/horse_gray.png` | Pixel Perfection CE entity/horse/horse_gray.png | changed |
| `skins/horse_dark_brown.png` | Pixel Perfection CE entity/horse/horse_darkbrown.png | changed |
| `skins/horse_markings_white.png` | Pixel Perfection CE entity/horse/horse_markings_white.png | changed |
| `skins/horse_markings_whitefield.png` | Pixel Perfection CE entity/horse/horse_markings_whitefield.png | changed |
| `skins/horse_markings_whitedots.png` | Pixel Perfection CE entity/horse/horse_markings_whitedots.png | changed |
| `skins/horse_markings_blackdots.png` | Pixel Perfection CE entity/horse/horse_markings_blackdots.png | changed |
| `skins/donkey.png` | Pixel Perfection CE entity/horse/donkey.png | changed |
| `skins/mule.png` | Pixel Perfection CE entity/horse/mule.png | changed |
| `skins/snow_golem.png` | Pixel Perfection CE entity/snow_golem.png | changed |
| `skins/armor_leather.png` | Pixel Perfection CE models/armor/leather_layer_1.png; Pixel Perfection CE models/armor/leather_layer_1_overlay.png | changed |
| `skins/armor_leather_legs.png` | Pixel Perfection CE models/armor/leather_layer_2.png; Pixel Perfection CE models/armor/leather_layer_2_overlay.png | changed |
| `skins/armor_iron.png` | Pixel Perfection CE models/armor/iron_layer_1.png | changed |
| `skins/armor_iron_legs.png` | Pixel Perfection CE models/armor/iron_layer_2.png | changed |
| `skins/armor_golden.png` | Pixel Perfection CE models/armor/gold_layer_1.png | changed |
| `skins/armor_golden_legs.png` | Pixel Perfection CE models/armor/gold_layer_2.png | changed |
| `skins/armor_diamond.png` | Pixel Perfection CE models/armor/diamond_layer_1.png | changed |
| `skins/armor_diamond_legs.png` | Pixel Perfection CE models/armor/diamond_layer_2.png | changed |
| `skins/armor_chainmail.png` | Pixel Perfection CE models/armor/chainmail_layer_1.png | changed |
| `skins/armor_chainmail_legs.png` | Pixel Perfection CE models/armor/chainmail_layer_2.png | changed |
