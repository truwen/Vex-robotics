Neon Rift Arena (Offline, Vanilla HTML/CSS/JS)
===============================================

Version: v0.11

Deeper progression build of Neon Rift Arena.
Run by opening `index.html` directly (no server, no npm, no framework).

Core additions in this build
----------------------------
- 5-weapon loadout with hot-swap (1-5)
- money orb pickups (green glowing drops with magnet pull)
- rare drops (temporary/permanent in-run bonuses)
- repeatable upgrades to reduce progression stall after capped upgrades
- utility purchases (Emergency Repair + Shield Recharge) always available each shop
- keyboard flight upgrades (WASD + Space) while preserving optional mouse mode
- persistent settings + persistent high scores via localStorage
- retro-style Web Audio API SFX + lightweight ambient music

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
3) Spread Blaster (multi-shot with tiered scatter upgrades)
4) Laser Beam (piercing shots for tanky targets)
5) Arc Cannon (splash burst for groups)

Some weapons start locked and can unlock through rare drops.

Weapon balance model (v0.11+)
-----------------------------
- Goal: no single dominant weapon; each has a clear combat role.
- Roles:
  - Rapid = single-target pressure
  - Spread = close-range swarm clear
  - Laser = tank killer / pierce line
  - Arc = group control (splash clusters)
  - Blaster = balanced fallback
- Balance mechanics now include:
  - distance-based damage falloff per weapon
  - diminishing returns for sustained same-target rapid/laser pressure
  - situational bonuses/penalties based on enemy density, target durability, and range

Drone roles + orbit system
--------------------------
- Drone roles are intentionally distinct:
  - Bomber: slower outer-ring orbit, clustered AoE pressure
  - Electricity: faster inner-ring orbit, frequent chain targeting
  - Laser: mid-ring continuous single-target beam pressure
- Orbit behavior:
  - clockwise orbit direction
  - smooth angular spacing around the player as drone count changes
  - smooth radius interpolation for stable rings without snapping
- Orbit tuning constants in `script.js`:
  - `DRONE_ORBIT_RADIUS`
  - `DRONE_ORBIT_SPEED`

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
- includes a very rare **Extra Life Core** pickup

Progression model
-----------------
Capped upgrades:
- high-impact upgrades like spread shots remain capped.

Repeatable upgrades:
- Deep Core Salvage (orb economy scaling)
- Weapon Tuning (global weapon scaling)
- Drone Overclock (drone scaling)
- Magnet Field / Salvage / Drone Cooldown / Scatter Pellet Velocity also soft-scale

This keeps late-run choices meaningful after early capped paths fill out.

Persistence (localStorage keys)
-------------------------------
- Settings key: `neon_rift_arena_settings_v1`
- High score key: `neon_rift_arena_high_scores_v1`
- Save slots:
  - `neon_rift_save_slot_1`
  - `neon_rift_save_slot_2`
  - `neon_rift_save_slot_3`
- Audio settings are stored inside the settings object:
  - `soundEnabled`
  - `sfxVolume`
  - `musicEnabled`
  - `musicVolume`

High scores saved:
- best score
- highest wave
- best credits earned in one run
- best kills in one run

Meta skill tree structure (gems only)
-------------------------------------
- Gems are spent **only** in the persistent Meta Skill Tree (never in-run shop).
- Tree categories:
  - Weapons (includes per-weapon nodes)
  - Drones
  - Defense
  - Offense
  - Economy
- Node sizes:
  - Small: lower cost, higher max levels
  - Medium: moderate cost, moderate max levels
  - Keystone: high-cost, single-rank capstone

Current node model in `script.js`:
- Weapons:
  - Small: Blaster/Rapid/Spread/Laser/Arc damage nodes
  - Medium: Weapon Core (+all weapon damage)
  - Keystone: Calibrated Arsenal (+global fire-rate)
- Drones:
  - Small: Drone damage
  - Medium: Drone fire-rate
  - Keystone: +1 max drone
- Defense:
  - Small: max health
  - Medium: max shield
  - Keystone: +1 starting life
- Offense:
  - Small: all-damage scaling
  - Medium: crit chance
  - Keystone: Glass Cannon (+damage, -max health)
- Economy:
  - Small: credits scaling
  - Medium: extra gems at run end
  - Keystone: credits + score multiplier

Main tweakable constants
------------------------
In `script.js`:
- `WEAPON_SLOTS`, `WEAPON_DEFS` (weapon damage/rate/speed/pierce/splash)
- `PICKUP_SETTINGS` (orb lifetime, value scale, glow size, magnet radius, attraction)
- `RARE_DROP_CHANCE`, `RARE_DROP_DEFS` (drop rates and effects)
- `SETTINGS` (player/enemy/economy/drone/visual tuning)
- `SHOP_LAYOUT` (shop rows/height/footer)
- `SHOP_CARD_MIN_HEIGHT`, `SHOP_CARD_PADDING_Y`, `SHOP_CARD_LINE_GAP`, `SHOP_TITLE_FONT_SIZE`, `SHOP_META_FONT_SIZE` (shop card readability/spacing)
- `HIGH_SCORE_STORAGE_KEY`, `SETTINGS_STORAGE_KEY`
- `AUDIO_LIMITS` (shot/hover/pickup anti-spam gaps)
- `UTILITY_PURCHASES` (heal/shield utility values + base costs)
- `ENDLESS_SCALING` (hp/speed/projectile/fire-rate/count/elite chance scaling)
- `SCATTER_TUNING` (spread tiers, width/density, pellet velocity, pierce)
- `RARE_FEEDBACK` (rare text size + extra life drop chance)
- `SETTINGS_MAX_VISIBLE_ROWS`, `SETTINGS_ROW_HEIGHT`, `SETTINGS_PANEL_HEIGHT`, `SETTINGS_FOOTER_HEIGHT` (settings menu scroll layout)
- Rift background: `RIFT_ENABLED`, `RIFT_CENTER_X`, `RIFT_CENTER_Y`, `RIFT_SCALE`, `RIFT_PURPLE_INTENSITY`, `RIFT_GREEN_INTENSITY`, `RIFT_PULSE_SPEED`, `RIFT_OPACITY`, `STAR_DENSITY`
- Performance/boundary tuning: `MAX_ACTIVE_PARTICLES`, `MAX_ACTIVE_PICKUPS`, `MAX_ACTIVE_FLOATING_TEXTS`, `MAX_ACTIVE_ENEMIES`, `MAX_ACTIVE_ENEMY_PROJECTILES`, `ENEMY_OUT_OF_BOUNDS_TIMEOUT`, `PLAYER_BOUNDARY_PADDING`, `ENEMY_BOUNDARY_PADDING`, `PROJECTILE_DESPAWN_MARGIN`
- Combat readability: `WEAPON_VISUAL_SCALE`, `WEAPON_BALANCE_VALUES`
- Player rings: `PLAYER_RING_OUTER_RADIUS`, `PLAYER_RING_INNER_RADIUS`, `PLAYER_RING_WIDTH`, `SHIELD_RING_COLOR`, `HEALTH_RING_COLOR`, `PLAYER_RING_ALPHA`
- Wave start protection: `PLAYER_SPAWN_INVULN_DURATION`
- Movement feel: `PLAYER_DAMPING`, `PLAYER_BRAKE_DAMPING`, `PLAYER_MIN_VELOCITY`, plus optional `classicPhysicsMode` setting
- Enemy AI pressure: `ENEMY_EDGE_AVOID_RADIUS`, `ENEMY_EDGE_AVOID_FORCE`, `ENEMY_CENTER_BIAS`, `ENEMY_SEPARATION_RADIUS`, `ENEMY_SEPARATION_FORCE`, `AGGRESSION_SCALING_PER_WAVE`, `SPEED_SCALING_PER_WAVE`, `ELITE_CHANCE_PER_WAVE`, `MIXED_WAVE_COMPLEXITY_SCALING`
- Pursuit/aggression tuning: `ENEMY_PURSUIT_LEAD_BASE_MS`, `ENEMY_PURSUIT_LEAD_DIST_FACTOR`, `LATE_GAME_AGGRESSION_START_WAVE`, `LATE_GAME_AGGRESSION_PER_WAVE`, `LATE_GAME_AGGRESSION_CAP`

Audio system notes
------------------
- Uses Web Audio API only (no external files/libraries).
- Audio starts after first user gesture (click/key/touch) to satisfy browser autoplay rules.
- SFX events include:
  - weapon fire (per-weapon variants)
  - enemy hit / enemy destroyed
  - player hit / shield hit
  - money orb pickup / rare pickup
  - shop purchase
  - wave clear
  - game over
  - menu hover / click
- Ambient looping synth pad is optional via settings (`Music` toggle + music volume).

GitHub Pages / static hosting
-----------------------------
- Fully static HTML/CSS/JS.
- No external dependencies.
- Compatible with direct file opening and GitHub Pages hosting.
