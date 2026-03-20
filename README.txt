Neon Rift Arena (Offline, Vanilla HTML/CSS/JS)
===============================================

Deeper progression build of Neon Rift Arena.
Run by opening `index.html` directly (no server, no npm, no framework).

Core additions in this build
----------------------------
- 5-weapon loadout with hot-swap (1-5)
- money orb pickups (green glowing drops with magnet pull)
- rare drops (temporary/permanent in-run bonuses)
- repeatable upgrades to reduce progression stall after capped upgrades
- keyboard flight upgrades (WASD + Space) while preserving optional mouse mode
- persistent settings + persistent high scores via localStorage

Controls
--------
- W / ArrowUp = thrust
- A / ArrowLeft = rotate left
- D / ArrowRight = rotate right
- S / ArrowDown = brake / dampening
- Space / Left Mouse = fire current primary weapon
- 1,2,3,4,5 = weapon slots
- Right Mouse hold = thrust (if enabled in settings)
- P or Escape = pause
- M = quick toggle mouse aim
- Enter = start next wave from shop

Weapon system
-------------
Weapon slots:
1) Blaster (balanced default)
2) Rapid Blaster (fast, lower per-shot damage)
3) Spread Cannon (multi-shot with capped spread upgrades)
4) Laser Beam (piercing shots for tanky targets)
5) Arc Cannon (splash burst for groups)

Some weapons start locked and can unlock through rare drops.

Pickups / drops
---------------
Money orbs:
- dropped by enemy kills
- glow green and bob/float slightly
- expire after lifetime
- attracted by magnet radius (boosted by Magnet Field upgrade)

Rare drops:
- low-probability enemy drops (higher chance on stronger enemy types)
- visually distinct diamond drops
- expire after lifetime
- examples: temp overcharge, fire-rate boost, shield burst, crit focus, weapon unlock cache, permanent weapon core, drone enhancement

Progression model
-----------------
Capped upgrades:
- high-impact upgrades like spread shots remain capped.

Repeatable upgrades:
- Deep Core Salvage (orb economy scaling)
- Weapon Tuning (global weapon scaling)
- Drone Overclock (drone scaling)

This keeps late-run choices meaningful after early capped paths fill out.

Persistence (localStorage keys)
-------------------------------
- Settings key: `neon_rift_arena_settings_v1`
- High score key: `neon_rift_arena_high_scores_v1`

High scores saved:
- best score
- highest wave
- best credits earned in one run
- best kills in one run

Main tweakable constants
------------------------
In `script.js`:
- `WEAPON_SLOTS`, `WEAPON_DEFS` (weapon damage/rate/speed/pierce/splash)
- `PICKUP_SETTINGS` (orb lifetime, value scale, glow size, magnet radius, attraction)
- `RARE_DROP_CHANCE`, `RARE_DROP_DEFS` (drop rates and effects)
- `SETTINGS` (player/enemy/economy/drone/visual tuning)
- `SHOP_LAYOUT` (shop rows/height/footer)
- `HIGH_SCORE_STORAGE_KEY`, `SETTINGS_STORAGE_KEY`

GitHub Pages / static hosting
-----------------------------
- Fully static HTML/CSS/JS.
- No external dependencies.
- Compatible with direct file opening and GitHub Pages hosting.
