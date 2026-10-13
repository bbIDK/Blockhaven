# Research: how Minecraft ship-building mods work

Read from the mods' own source (Valkyrien Skies 2 + Eureka, Archimedes' Ships, Create, Small Ships,
Create Big Cannons). The design the One Piece mod follows:

- **Assembly** (Archimedes / Eureka): right-click a Ship's Wheel; flood fill (6 directions) over the
  connected blocks, skipping air, water and terrain (dirt, sand, stone...), up to a block limit; the
  set must hold the wheel and touch water. The blocks move into the ship's own small voxel grid and
  are removed from the world.
- **Rendering** (every mod): mesh the ship's grid once with the normal chunk mesher and draw it with
  one transform per ship, `T(pos)·Ry(yaw)·T(-centre)`; re-mesh only when a block on it changes.
- **Yaw only** (Archimedes): ships turn but never tip, so collision stays simple and "up" stays up.
- **Walking on deck** (Create's ContraptionCollider, VS2's EntityDragger): carry riders along with
  the ship's move and turn (`toWorld_now(toLocal_prev(pos))`, yaw += turn) *before* their own move,
  then collide their box against the ship's blocks in ship-local space (a yaw-rotated box is just a
  widened box there). After stepping off, the carried motion fades (x0.9 a tick).
- **Buoyancy** (Archimedes): blocks per layer; submerged volume from the waterline gives lift; mass
  from block densities. Too heavy, it sits low (or sinks).
- **Steering**: whoever stands at the wheel drives (W/S thrust, A/D turn, slower turning for bigger
  ships, as Eureka does).
- **Disassembly**: snap yaw to the nearest 90°, round the position, refuse if anything solid is in
  the way, rotate facing blocks, write all the blocks back at once.
- **Cannons** (Small Ships, Create Big Cannons): cannon blocks on the grid; firing spawns cannonballs
  from `toWorld(cell)` to the side the pilot looks, ship velocity added, gravity and drag, explode on
  hitting land; cooldown, uses gunpowder and cannonballs.

Sources: github.com/ValkyrienSkies/Valkyrien-Skies-2 (EntityDragger.kt, EntityShipCollisionUtils.kt,
ShipAssembler.kt), github.com/ValkyrienSkies/Eureka (ShipAssembler.kt, EurekaShipControl.kt),
github.com/Ckathode/archimedes-ships (ChunkAssembler, ChunkDisassembler, EntityShip),
github.com/Creators-of-Create/Create (ContraptionCollider, Contraption, StructureTransform),
github.com/talhanation/smallships (Cannon.java), github.com/Cannoneers-of-Create/CreateBigCannons.
