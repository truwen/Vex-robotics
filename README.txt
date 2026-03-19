Neon Rift Arena (Offline, Vanilla HTML/CSS/JS)
===============================================

Neon Rift Arena is a local/offline wave-survival prototype.
Run by opening `index.html` directly.

No npm, no frameworks, no build tools, no server.

Files
-----
- index.html : canvas + HUD + menu overlay + shop overlay
- style.css  : neon layout, passive HUD, interactive menus
- script.js  : game state, waves, enemies, drones, shop, settings, rendering
- README.txt : guide

How to Run
----------
1) Keep files together in one folder.
2) Double-click `index.html`.
3) Use Main Menu -> Start Game.

Game states / menus
-------------------
- Main Menu
- Settings Menu
- How To Play
- Playing
- Shop
- Paused
- Game Over

Controls
--------
- Arrow Left / Arrow Right = rotate
- Arrow Up = thrust
- Space = shoot
- Left Mouse = shoot / hold fire
- Right Mouse hold = thrust (if enabled)
- P or Escape = pause menu
- M = quick toggle mouse aim
- Enter = next wave from shop

Drone system
------------
Up to 3 active drones max, one per type:
- Bomber Drone (AOE bombs)
- Electricity Drone (short-range arcs + chain)
- Laser Drone (sustained beam)

Drones are premium shop unlocks that appear after early waves.

Shop / upgrades
---------------
Core upgrades:
1) Rapid Fire
2) Overcharged Rounds
3) Velocity Rounds
4) Scatter Cannon
5) Reinforced Hull
6) Recharge Shield
7) Thruster Boost
8) Magnet Field
9) Salvage Bonus
10) Emergency Repair

Drone unlock upgrades:
- Bomber Drone
- Electricity Drone
- Laser Drone

Settings (saved in localStorage)
--------------------------------
Display
- graphics intensity (low/medium/high)
- glow effects
- screen shake
- HUD scale

Controls
- mouse aim
- mouse control mode (aim / assist)
- hold to fire
- right mouse thrust
- show control hints

Gameplay
- auto-start next wave
- show drone targeting lines

Accessibility
- reduced flashes

Main tweakable constants
------------------------
In `script.js`:
- Canvas: `canvasWidth`, `canvasHeight`
- Player: rotation/thrust/friction/max speed/fire delay/bullet stats
- Enemy scaling: `enemyHpScalePerWave`, `enemySpeedScalePerWave`
- Economy: kill multiplier + wave bonuses
- Drones: max count, orbit radius, damage, cooldowns, ranges
- Visual: glow intensity, pulse speed, color cycle speed, star density, particle scaling
- Mouse feel: `MOUSE_AIM_DEADZONE`, `MOUSE_AIM_TURN_RATE`, `MOUSE_ASSIST_TURN_RATE`
- Turn smoothing: `SETTINGS.maxTurnSpeed`
- Shop layout: `SHOP_LAYOUT.maxVisibleRows`, `rowHeightPx`, `listMaxHeightPx`, `footerHeightPx`

Input reliability notes
-----------------------
- Passive HUD uses `pointer-events: none`.
- Only menus/shop capture pointer events.
- Mouse tracking uses `window` + last valid canvas position.
- Hold-fire continues while button is held (if setting enabled).

Offline confirmation
--------------------
- Uses only local HTML/CSS/JS and browser APIs.
- Works by opening `index.html` directly.
