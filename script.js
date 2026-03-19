/*
  Neon Rift Arena (offline, vanilla JS)
  -------------------------------------
  Systems:
  - Game state manager (main menu, settings, how-to, playing, shop, paused, game over)
  - Player / enemies / projectiles / drones
  - Economy + between-wave shop
  - Persistent settings via localStorage (offline-safe)
*/

// -------------------------------------------------
// DOM references
// -------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameWrap = document.getElementById('gameWrap');
const controlsPanel = document.getElementById('controlsPanel');

const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const livesEl = document.getElementById('lives');
const healthEl = document.getElementById('health');
const shieldEl = document.getElementById('shield');
const creditsEl = document.getElementById('credits');
const weaponEl = document.getElementById('weapon');
const dronesEl = document.getElementById('drones');
const upgradeListEl = document.getElementById('upgradeList');

const menuOverlay = document.getElementById('menuOverlay');
const menuTitle = document.getElementById('menuTitle');
const menuText = document.getElementById('menuText');
const menuButtons = document.getElementById('menuButtons');

const shopOverlay = document.getElementById('shopOverlay');
const shopSummaryEl = document.getElementById('shopSummary');
const shopCreditsEl = document.getElementById('shopCredits');
const shopButtonsEl = document.getElementById('shopButtons');
const nextWaveButton = document.getElementById('nextWaveButton');

// -------------------------------------------------
// Constants
// -------------------------------------------------
const GAME_STATE = {
  MAIN_MENU: 'main_menu',
  SETTINGS_MENU: 'settings_menu',
  HOW_TO_PLAY: 'how_to_play',
  PLAYING: 'playing',
  SHOP: 'shop',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
};

const SETTINGS = {
  canvasWidth: 1360,
  canvasHeight: 800,

  // Player
  rotationSpeed: 0.085,
  maxTurnSpeed: 0.24, // radians per update step; smooth cap for all steering
  thrustPower: 0.19,
  friction: 0.992,
  baseMaxSpeed: 7.5,
  baseFireCooldownMs: 210,
  baseBulletSpeed: 9.2,
  baseBulletDamage: 1,

  // Player durability
  startLives: 3,
  baseMaxHealth: 100,
  baseMaxShield: 0,
  shieldRegenPerSecond: 0,
  respawnInvulnMs: 1600,

  // Economy
  startCredits: 0,
  killCreditMultiplier: 1,
  waveClearRewardBase: 65,
  waveClearRewardPerWave: 26,
  fastClearTargetSeconds: 34,
  fastClearBonus: 45,
  noDamageBonus: 45,

  // Enemy scaling
  enemyHpScalePerWave: 0.17,
  enemySpeedScalePerWave: 0.09,

  // Pickup economy
  basePickupRadius: 32,
  magnetRadiusPerTier: 45,

  // Drone system
  maxDrones: 3,
  droneOrbitBaseRadius: 52,
  droneOrbitStep: 18,
  bomberDamage: 22,
  bomberAoeRadius: 95,
  bomberCooldownMs: 1600,
  electricityDamage: 10,
  electricityRange: 210,
  electricityChainRange: 120,
  electricityCooldownMs: 520,
  laserDps: 14,
  laserRange: 270,
  laserRetargetMs: 260,

  // Visual
  glowIntensity: 0.95,
  pulseSpeed: 0.006,
  colorCycleSpeed: 0.0018,
  starDensityLow: 90,
  starDensityMedium: 130,
  starDensityHigh: 180,
  particleScaleLow: 0.6,
  particleScaleMedium: 0.8,
  particleScaleHigh: 1,
};

const SHOP_LAYOUT = {
  maxVisibleRows: 6,
  rowHeightPx: 80,
  rowGapPx: 9,
  listMaxHeightPx: 525,
  footerHeightPx: 78,
};

// Mouse-aim tuning (kept outside SETTINGS for easy visibility while tuning controls)
const MOUSE_AIM_DEADZONE = 52; // px radius around ship where aim will not update
const MOUSE_AIM_TURN_RATE = 0.28; // max radians per frame step for stable directional aim
const MOUSE_ASSIST_TURN_RATE = 0.16; // slower steering for optional flight-assist mode

const NEON = {
  cyan: '#63e9ff',
  blue: '#6da1ff',
  magenta: '#ff6de2',
  green: '#79ffbc',
  orange: '#ffb67d',
  yellow: '#ffe08e',
  red: '#ff7b7b',
  white: '#f4fbff',
};

const ENEMY_TYPES = {
  driftRock: { label: 'Drift Rock', radius: 28, hp: 3, speed: 0.95, score: 20, credits: 14 },
  dartScout: { label: 'Dart Scout', radius: 12, hp: 2, speed: 2.1, score: 28, credits: 18 },
  bulwark: { label: 'Bulwark', radius: 24, hp: 9, speed: 0.75, score: 65, credits: 34 },
  splitterCore: { label: 'Splitter Core', radius: 19, hp: 5, speed: 1.35, score: 46, credits: 24 },
  pulseTurret: { label: 'Pulse Turret', radius: 17, hp: 4, speed: 1.15, score: 42, credits: 26 },
};

// -------------------------------------------------
// Player settings (persisted)
// -------------------------------------------------
const DEFAULT_PLAYER_SETTINGS = {
  graphicsIntensity: 'high', // low | medium | high
  glowEffects: true,
  screenShake: true,
  hudScale: 1,
  mouseAim: true,
  mouseControlMode: 'aim', // 'aim' (stable directional) | 'assist' (softer steer)
  holdToFire: true,
  rightMouseThrust: true,
  showControlHints: true,
  autoStartNextWave: false,
  showDroneTargetLines: true,
  reducedFlashes: false,
};

const SETTINGS_STORAGE_KEY = 'neon_rift_arena_settings_v1';

// -------------------------------------------------
// Upgrade/shop definitions
// -------------------------------------------------
const UPGRADE_DEFS = [
  { id: 'rapidFire', name: 'Rapid Fire', key: '1', maxLevel: 6, baseCost: 70, costScale: 1.46, desc: 'Decrease fire delay', apply: () => { state.upgrades.rapidFire += 1; } },
  { id: 'overchargedRounds', name: 'Overcharged Rounds', key: '2', maxLevel: 6, baseCost: 85, costScale: 1.5, desc: 'Increase bullet damage', apply: () => { state.upgrades.overchargedRounds += 1; } },
  { id: 'velocityRounds', name: 'Velocity Rounds', key: '3', maxLevel: 5, baseCost: 65, costScale: 1.45, desc: 'Increase bullet speed', apply: () => { state.upgrades.velocityRounds += 1; } },
  { id: 'scatterCannon', name: 'Scatter Cannon', key: '4', maxLevel: 2, baseCost: 150, costScale: 1.9, desc: 'Add spread projectiles', apply: () => { state.upgrades.scatterCannon += 1; } },
  {
    id: 'reinforcedHull',
    name: 'Reinforced Hull',
    key: '5',
    maxLevel: 4,
    baseCost: 125,
    costScale: 1.58,
    desc: '+Max health and full heal',
    apply: () => {
      state.upgrades.reinforcedHull += 1;
      state.player.maxHealth += 25;
      state.player.health = state.player.maxHealth;
    },
  },
  {
    id: 'rechargeShield',
    name: 'Recharge Shield',
    key: '6',
    maxLevel: 4,
    baseCost: 130,
    costScale: 1.58,
    desc: '+Shield cap and regen',
    apply: () => {
      state.upgrades.rechargeShield += 1;
      state.player.maxShield += 20;
      state.player.shield = state.player.maxShield;
      state.player.shieldRegen += 1.35;
    },
  },
  { id: 'thrusterBoost', name: 'Thruster Boost', key: '7', maxLevel: 5, baseCost: 80, costScale: 1.42, desc: 'Increase thrust and top speed', apply: () => { state.upgrades.thrusterBoost += 1; } },
  { id: 'magnetField', name: 'Magnet Field', key: '8', maxLevel: 5, baseCost: 95, costScale: 1.46, desc: 'Increase credit pickup radius', apply: () => { state.upgrades.magnetField += 1; } },
  { id: 'salvageBonus', name: 'Salvage Bonus', key: '9', maxLevel: 5, baseCost: 105, costScale: 1.47, desc: 'Increase credits from kills', apply: () => { state.upgrades.salvageBonus += 1; } },
  {
    id: 'emergencyRepair',
    name: 'Emergency Repair',
    key: '0',
    maxLevel: 5,
    baseCost: 90,
    costScale: 1.4,
    desc: 'Heal now + between-wave recovery',
    apply: () => {
      state.upgrades.emergencyRepair += 1;
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 35);
    },
  },
  // Drone unlocks (premium, appear after early waves)
  { id: 'droneBomber', name: 'Bomber Drone', key: '', maxLevel: 1, baseCost: 300, costScale: 1, desc: 'AOE bombs for crowds', minWave: 3, apply: () => unlockDrone('bomber') },
  { id: 'droneElectricity', name: 'Electricity Drone', key: '', maxLevel: 1, baseCost: 320, costScale: 1, desc: 'Arc chains nearby enemies', minWave: 4, apply: () => unlockDrone('electricity') },
  { id: 'droneLaser', name: 'Laser Drone', key: '', maxLevel: 1, baseCost: 340, costScale: 1, desc: 'Sustained beam vs tanks', minWave: 5, apply: () => unlockDrone('laser') },
];

// -------------------------------------------------
// State object
// -------------------------------------------------
const state = {
  gameState: GAME_STATE.MAIN_MENU,
  previousMenuState: GAME_STATE.MAIN_MENU,

  keys: {},
  mouse: {
    leftDown: false,
    rightDown: false,
    lastValidX: SETTINGS.canvasWidth / 2,
    lastValidY: SETTINGS.canvasHeight / 2,
    lastValidAimAngle: -Math.PI / 2,
    hasValid: true,
  },

  settings: { ...DEFAULT_PLAYER_SETTINGS },

  player: null,
  enemies: [],
  bullets: [],
  enemyBullets: [],
  bombs: [],
  pickups: [],

  drones: [], // each: { type, orbitAngle, cooldown, targetRef, retargetAt }
  arcEffects: [], // electricity lines
  beamEffects: [], // laser beam visuals

  stars: [],
  particles: [],
  rings: [],

  wave: 1,
  score: 0,
  credits: SETTINGS.startCredits,
  totalCreditsEarned: 0,
  totalKills: 0,
  upgradesPurchased: 0,

  waveStartTime: 0,
  damageTakenThisWave: 0,

  lastShotAt: 0,
  lastFrameTime: performance.now(),
  shake: 0,

  autoNextWaveAt: null,

  upgrades: {
    rapidFire: 0,
    overchargedRounds: 0,
    velocityRounds: 0,
    scatterCannon: 0,
    reinforcedHull: 0,
    rechargeShield: 0,
    thrusterBoost: 0,
    magnetField: 0,
    salvageBonus: 0,
    emergencyRepair: 0,

    droneBomber: 0,
    droneElectricity: 0,
    droneLaser: 0,
  },
};

canvas.width = SETTINGS.canvasWidth;
canvas.height = SETTINGS.canvasHeight;

// -------------------------------------------------
// Utilities
// -------------------------------------------------
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function wrap(obj) {
  const m = obj.radius || 8;
  if (obj.x < -m) obj.x = canvas.width + m;
  if (obj.x > canvas.width + m) obj.x = -m;
  if (obj.y < -m) obj.y = canvas.height + m;
  if (obj.y > canvas.height + m) obj.y = -m;
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function moveAngleToward(current, target, maxStep) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function circlesHit(a, b) {
  const r = a.radius + b.radius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= r * r;
}

function graphicsLevelFactor() {
  if (state.settings.graphicsIntensity === 'low') return 0.6;
  if (state.settings.graphicsIntensity === 'medium') return 0.8;
  return 1;
}

function glowScale() {
  if (!state.settings.glowEffects) return 0;
  if (state.settings.reducedFlashes) return 0.5;
  return SETTINGS.glowIntensity;
}

function maybeShake(amount) {
  if (!state.settings.screenShake) return;
  state.shake = Math.max(state.shake, amount);
}

function addParticle(x, y, color, speedMin, speedMax, lifeMs, sizeMin = 1, sizeMax = 3.2, glow = 10) {
  const ang = rand(0, Math.PI * 2);
  const sp = rand(speedMin, speedMax);
  state.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: lifeMs, maxLife: lifeMs, size: rand(sizeMin, sizeMax), color, glow });
}

function addExplosion(x, y, color, count, ringSize = 30) {
  const total = Math.floor(count * graphicsLevelFactor());
  for (let i = 0; i < total; i++) {
    addParticle(x, y, color, 0.8, 4.8, rand(220, 680));
  }
  state.rings.push({ x, y, radius: 2, maxRadius: ringSize, life: 300, maxLife: 300, color });
}

function pointerToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  if (!inside) return null;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
  } catch (_err) {
    // localStorage may be blocked in some environments; ignore safely.
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.settings = { ...DEFAULT_PLAYER_SETTINGS, ...parsed };
  } catch (_err) {
    state.settings = { ...DEFAULT_PLAYER_SETTINGS };
  }
}

function applySettingsToUI() {
  // HUD scaling is done via CSS transform so beginners can quickly tweak.
  const scale = clamp(Number(state.settings.hudScale) || 1, 0.8, 1.4);
  document.querySelectorAll('.hud, .controls-panel, .upgrades-panel').forEach((el) => {
    el.style.transform = `scale(${scale})`;
  });

  if (state.settings.showControlHints) controlsPanel.classList.remove('hidden');
  else controlsPanel.classList.add('hidden');

  // Shop layout values (kept as clear tweakable constants)
  document.documentElement.style.setProperty('--shop-max-visible-rows', SHOP_LAYOUT.maxVisibleRows);
  document.documentElement.style.setProperty('--shop-row-height', `${SHOP_LAYOUT.rowHeightPx}px`);
  document.documentElement.style.setProperty('--shop-row-gap', `${SHOP_LAYOUT.rowGapPx}px`);
  document.documentElement.style.setProperty('--shop-list-max-height', `${SHOP_LAYOUT.listMaxHeightPx}px`);
  document.documentElement.style.setProperty('--shop-footer-height', `${SHOP_LAYOUT.footerHeightPx}px`);

  buildStars();
}

// -------------------------------------------------
// Stat helpers
// -------------------------------------------------
function fireDelay() {
  return Math.max(70, SETTINGS.baseFireCooldownMs - state.upgrades.rapidFire * 13);
}
function bulletDamage() {
  return SETTINGS.baseBulletDamage + state.upgrades.overchargedRounds;
}
function bulletSpeed() {
  return SETTINGS.baseBulletSpeed + state.upgrades.velocityRounds * 1.2;
}
function thrustPower() {
  return SETTINGS.thrustPower + state.upgrades.thrusterBoost * 0.03;
}
function topSpeed() {
  return SETTINGS.baseMaxSpeed + state.upgrades.thrusterBoost * 0.5;
}
function pickupRadius() {
  return SETTINGS.basePickupRadius + state.upgrades.magnetField * SETTINGS.magnetRadiusPerTier;
}
function salvageMultiplier() {
  return 1 + state.upgrades.salvageBonus * 0.18;
}
function weaponName() {
  if (state.upgrades.scatterCannon >= 2) return 'Rift Scatter Mk-II';
  if (state.upgrades.scatterCannon >= 1) return 'Rift Scatter Mk-I';
  return 'Rift Blaster';
}

// -------------------------------------------------
// Entities
// -------------------------------------------------
function createPlayer() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 14,

    maxHealth: SETTINGS.baseMaxHealth,
    health: SETTINGS.baseMaxHealth,
    maxShield: SETTINGS.baseMaxShield,
    shield: SETTINGS.baseMaxShield,
    shieldRegen: SETTINGS.shieldRegenPerSecond,
    lives: SETTINGS.startLives,

    invincibleUntil: 0,
  };
}

function createEnemy(typeId, x, y, wave) {
  const def = ENEMY_TYPES[typeId];
  const hpScale = 1 + (wave - 1) * SETTINGS.enemyHpScalePerWave;
  const speedScale = 1 + (wave - 1) * SETTINGS.enemySpeedScalePerWave;
  const angle = rand(0, Math.PI * 2);

  let vx = 0;
  let vy = 0;
  if (typeId === 'driftRock' || typeId === 'splitterCore') {
    vx = Math.cos(angle) * def.speed * speedScale;
    vy = Math.sin(angle) * def.speed * speedScale;
  }

  return {
    typeId,
    x,
    y,
    vx,
    vy,
    angle,
    spin: rand(-0.02, 0.02),
    radius: def.radius,
    hp: Math.ceil(def.hp * hpScale),
    maxHp: Math.ceil(def.hp * hpScale),
    scoreValue: def.score,
    creditValue: Math.round(def.credits * (1 + (wave - 1) * 0.08)),
    shootCooldown: rand(900, 1550),
    lastShotAt: 0,
  };
}

function createPlayerBullet(offsetAngle = 0) {
  const ang = state.player.angle + offsetAngle;
  return {
    x: state.player.x + Math.cos(ang) * state.player.radius,
    y: state.player.y + Math.sin(ang) * state.player.radius,
    vx: Math.cos(ang) * bulletSpeed() + state.player.vx * 0.15,
    vy: Math.sin(ang) * bulletSpeed() + state.player.vy * 0.15,
    radius: 2.6,
    life: 1200,
    damage: bulletDamage(),
    trail: [],
  };
}

function createEnemyBullet(enemy, angleToPlayer) {
  const speed = 3.4 + state.wave * 0.08;
  return {
    x: enemy.x,
    y: enemy.y,
    vx: Math.cos(angleToPlayer) * speed,
    vy: Math.sin(angleToPlayer) * speed,
    radius: 3.6,
    damage: 12 + state.wave,
    life: 2200,
  };
}

function spawnCreditPickup(x, y, value) {
  state.pickups.push({ x, y, vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), radius: 5, value, life: 8000 });
}

// -------------------------------------------------
// Drone system
// -------------------------------------------------
function unlockDrone(type) {
  if (state.drones.length >= SETTINGS.maxDrones) return;
  if (state.drones.some((d) => d.type === type)) return;

  const baseAngle = rand(0, Math.PI * 2);
  state.drones.push({
    type,
    orbitAngle: baseAngle,
    cooldown: 0,
    targetRef: null,
    retargetAt: 0,
  });
}

function droneLabelList() {
  if (state.drones.length === 0) return 'None';
  return state.drones.map((d) => {
    if (d.type === 'bomber') return 'Bomber';
    if (d.type === 'electricity') return 'Electric';
    return 'Laser';
  }).join(', ');
}

function nearestEnemyTo(point, maxRange) {
  let best = null;
  let bestDist = Infinity;

  for (const enemy of state.enemies) {
    const d = distance(point, enemy);
    if (d < bestDist && d <= maxRange) {
      best = enemy;
      bestDist = d;
    }
  }

  return best;
}

function applyDamageToEnemyRef(enemyRef, dmg) {
  const idx = state.enemies.indexOf(enemyRef);
  if (idx === -1) return;

  const enemy = state.enemies[idx];
  enemy.hp -= dmg;
  if (enemy.hp <= 0) {
    killEnemy(idx, enemy);
  }
}

function updateDrones(dtMs, now) {
  const p = state.player;
  state.beamEffects = [];
  state.arcEffects = [];

  state.drones.forEach((drone, index) => {
    // Orbit position around player
    const orbitSpeed = 0.0016 + index * 0.0002;
    drone.orbitAngle += dtMs * orbitSpeed;
    const radius = SETTINGS.droneOrbitBaseRadius + index * SETTINGS.droneOrbitStep;
    drone.x = p.x + Math.cos(drone.orbitAngle) * radius;
    drone.y = p.y + Math.sin(drone.orbitAngle) * radius;

    if (drone.cooldown > 0) drone.cooldown -= dtMs;

    // Bomber Drone: explosive bomb to clustered targets
    if (drone.type === 'bomber') {
      if (drone.cooldown <= 0) {
        let target = null;
        let bestScore = -1;

        for (const enemy of state.enemies) {
          let clusterScore = 0;
          for (const other of state.enemies) {
            if (distance(enemy, other) < SETTINGS.bomberAoeRadius) clusterScore += 1;
          }
          if (clusterScore > bestScore) {
            bestScore = clusterScore;
            target = enemy;
          }
        }

        if (target) {
          const ang = Math.atan2(target.y - drone.y, target.x - drone.x);
          state.bombs.push({
            x: drone.x,
            y: drone.y,
            vx: Math.cos(ang) * 3.2,
            vy: Math.sin(ang) * 3.2,
            radius: 4,
            life: 1800,
            damage: SETTINGS.bomberDamage,
            aoe: SETTINGS.bomberAoeRadius,
          });
          drone.cooldown = SETTINGS.bomberCooldownMs;
        }
      }
    }

    // Electricity Drone: close-range chain arcs
    if (drone.type === 'electricity') {
      if (drone.cooldown <= 0) {
        const primary = nearestEnemyTo(drone, SETTINGS.electricityRange);
        if (primary) {
          applyDamageToEnemyRef(primary, SETTINGS.electricityDamage);
          state.arcEffects.push({ x1: drone.x, y1: drone.y, x2: primary.x, y2: primary.y, life: 120 });

          // Optional chain: up to 2 nearby enemies.
          const candidates = state.enemies.filter((e) => e !== primary && distance(primary, e) <= SETTINGS.electricityChainRange);
          for (let i = 0; i < Math.min(2, candidates.length); i++) {
            const chainTarget = candidates[i];
            applyDamageToEnemyRef(chainTarget, SETTINGS.electricityDamage * 0.7);
            state.arcEffects.push({ x1: primary.x, y1: primary.y, x2: chainTarget.x, y2: chainTarget.y, life: 120 });
          }

          drone.cooldown = SETTINGS.electricityCooldownMs;
        }
      }
    }

    // Laser Drone: sustained beam DPS on single target
    if (drone.type === 'laser') {
      if (!drone.targetRef || state.enemies.indexOf(drone.targetRef) === -1 || now >= drone.retargetAt || distance(drone, drone.targetRef) > SETTINGS.laserRange) {
        drone.targetRef = nearestEnemyTo(drone, SETTINGS.laserRange);
        drone.retargetAt = now + SETTINGS.laserRetargetMs;
      }

      if (drone.targetRef) {
        const dpsDamage = SETTINGS.laserDps * (dtMs / 1000);
        applyDamageToEnemyRef(drone.targetRef, dpsDamage);
        state.beamEffects.push({ x1: drone.x, y1: drone.y, x2: drone.targetRef.x, y2: drone.targetRef.y });
      }
    }
  });

  // Arc effects decay
  for (let i = state.arcEffects.length - 1; i >= 0; i--) {
    state.arcEffects[i].life -= dtMs;
    if (state.arcEffects[i].life <= 0) state.arcEffects.splice(i, 1);
  }
}

function updateBombs(dtMs) {
  for (let i = state.bombs.length - 1; i >= 0; i--) {
    const bomb = state.bombs[i];
    bomb.x += bomb.vx;
    bomb.y += bomb.vy;
    wrap(bomb);
    bomb.life -= dtMs;

    let exploded = false;
    for (const enemy of state.enemies) {
      if (distance(bomb, enemy) < bomb.radius + enemy.radius) {
        exploded = true;
        break;
      }
    }

    if (bomb.life <= 0) exploded = true;

    if (exploded) {
      addExplosion(bomb.x, bomb.y, NEON.orange, 20, 45);
      maybeShake(4);
      const targets = [...state.enemies];
      for (const enemy of targets) {
        const d = distance(bomb, enemy);
        if (d <= bomb.aoe) {
          const falloff = 1 - d / bomb.aoe;
          applyDamageToEnemyRef(enemy, bomb.damage * falloff);
        }
      }
      state.bombs.splice(i, 1);
    }
  }
}

// -------------------------------------------------
// Game flow
// -------------------------------------------------
function resetRun() {
  state.player = createPlayer();
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.bombs = [];
  state.pickups = [];
  state.particles = [];
  state.rings = [];
  state.drones = [];
  state.arcEffects = [];
  state.beamEffects = [];

  state.wave = 1;
  state.score = 0;
  state.credits = SETTINGS.startCredits;
  state.totalCreditsEarned = 0;
  state.totalKills = 0;
  state.upgradesPurchased = 0;

  state.waveStartTime = performance.now();
  state.damageTakenThisWave = 0;
  state.lastShotAt = 0;
  state.shake = 0;
  state.autoNextWaveAt = null;

  Object.keys(state.upgrades).forEach((k) => { state.upgrades[k] = 0; });

  spawnWave(state.wave);
  updateHud();
  renderUpgradeList();
}

function startRun() {
  resetRun();
  state.gameState = GAME_STATE.PLAYING;
  menuOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
}

function pauseRun() {
  if (state.gameState !== GAME_STATE.PLAYING) return;
  state.previousMenuState = GAME_STATE.PAUSED;
  state.gameState = GAME_STATE.PAUSED;
  showPauseMenu();
}

function endRun() {
  state.gameState = GAME_STATE.GAME_OVER;
  showGameOverMenu();
}

function enterShop(rewards) {
  state.gameState = GAME_STATE.SHOP;
  shopOverlay.classList.remove('hidden');
  menuOverlay.classList.add('hidden');

  shopSummaryEl.textContent =
    `Wave ${state.wave} clear! Wave bonus ${rewards.waveBonus} + fast ${rewards.fastBonus} + no-damage ${rewards.noDamageBonus}.`;

  // Emergency repair: between-wave heal per tier
  const recovery = state.upgrades.emergencyRepair * 8;
  if (recovery > 0) {
    state.player.health = Math.min(state.player.maxHealth, state.player.health + recovery);
  }

  if (state.settings.autoStartNextWave) {
    state.autoNextWaveAt = performance.now() + 6000;
  } else {
    state.autoNextWaveAt = null;
  }

  buildShopButtons();
  updateHud();
}

function startNextWave() {
  state.wave += 1;
  state.gameState = GAME_STATE.PLAYING;
  state.waveStartTime = performance.now();
  state.damageTakenThisWave = 0;
  state.enemyBullets = [];
  state.pickups = [];
  state.autoNextWaveAt = null;

  spawnWave(state.wave);
  shopOverlay.classList.add('hidden');
  updateHud();
}

// -------------------------------------------------
// Menus
// -------------------------------------------------
function setMenu(title, text, buttons) {
  menuTitle.textContent = title;
  menuText.textContent = text;
  menuButtons.innerHTML = '';

  buttons.forEach((btn) => {
    const b = document.createElement('button');
    b.className = 'menu-btn';
    b.textContent = btn.label;
    b.addEventListener('click', btn.onClick);
    menuButtons.appendChild(b);
  });

  menuOverlay.classList.remove('hidden');
  shopOverlay.classList.add('hidden');
}

function showMainMenu() {
  state.gameState = GAME_STATE.MAIN_MENU;
  setMenu(
    'NEON RIFT ARENA',
    'Offline neon survival prototype. Defeat waves, buy upgrades, and deploy drones.',
    [
      { label: 'Start Game', onClick: startRun },
      { label: 'Settings', onClick: showSettingsMenu },
      { label: 'How To Play', onClick: showHowToPlay },
    ],
  );
}

function showHowToPlay() {
  state.gameState = GAME_STATE.HOW_TO_PLAY;
  setMenu(
    'HOW TO PLAY',
    'Move with arrows, shoot with Space/LMB, thrust with Up/RMB. Clear waves, collect credits, buy upgrades and drone unlocks in shop, then start next wave.',
    [
      { label: 'Back to Main Menu', onClick: showMainMenu },
      { label: 'Start Game', onClick: startRun },
    ],
  );
}

function settingOptionButtons() {
  const buttons = [];

  function addToggle(label, key) {
    buttons.push({
      label: `${label}: ${state.settings[key] ? 'ON' : 'OFF'}`,
      onClick: () => {
        state.settings[key] = !state.settings[key];
        saveSettings();
        applySettingsToUI();
        showSettingsMenu();
      },
    });
  }

  function addCycle(label, key, values) {
    buttons.push({
      label: `${label}: ${state.settings[key]}`,
      onClick: () => {
        const idx = values.indexOf(state.settings[key]);
        state.settings[key] = values[(idx + 1) % values.length];
        saveSettings();
        applySettingsToUI();
        showSettingsMenu();
      },
    });
  }

  addCycle('Graphics Intensity', 'graphicsIntensity', ['low', 'medium', 'high']);
  addToggle('Glow Effects', 'glowEffects');
  addToggle('Screen Shake', 'screenShake');
  addCycle('HUD Scale', 'hudScale', [0.8, 1, 1.2, 1.4]);
  addToggle('Mouse Aim', 'mouseAim');
  addCycle('Mouse Control Mode', 'mouseControlMode', ['aim', 'assist']);
  addToggle('Hold To Fire', 'holdToFire');
  addToggle('Right Mouse Thrust', 'rightMouseThrust');
  addToggle('Show Control Hints', 'showControlHints');
  addToggle('Auto Start Next Wave', 'autoStartNextWave');
  addToggle('Show Drone Target Lines', 'showDroneTargetLines');
  addToggle('Reduced Flashes', 'reducedFlashes');

  buttons.push({
    label: state.previousMenuState === GAME_STATE.PAUSED ? 'Back to Pause Menu' : 'Back to Main Menu',
    onClick: () => {
      if (state.previousMenuState === GAME_STATE.PAUSED) showPauseMenu();
      else showMainMenu();
    },
  });

  return buttons;
}

function showSettingsMenu() {
  state.gameState = GAME_STATE.SETTINGS_MENU;
  setMenu('SETTINGS', 'Click an option to toggle/cycle values. Saved locally for next launch.', settingOptionButtons());
}

function showPauseMenu() {
  state.previousMenuState = GAME_STATE.PAUSED;
  state.gameState = GAME_STATE.PAUSED;

  setMenu(
    'PAUSED',
    'Gameplay is paused. Choose an option.',
    [
      { label: 'Resume', onClick: () => { state.gameState = GAME_STATE.PLAYING; menuOverlay.classList.add('hidden'); } },
      { label: 'Settings', onClick: showSettingsMenu },
      { label: 'Restart Run', onClick: startRun },
      { label: 'Return to Main Menu', onClick: showMainMenu },
    ],
  );
}

function showGameOverMenu() {
  setMenu(
    'RIFT COLLAPSED',
    `Wave ${state.wave} | Score ${state.score} | Credits ${state.totalCreditsEarned} | Kills ${state.totalKills} | Purchases ${state.upgradesPurchased}`,
    [
      { label: 'Restart Run', onClick: startRun },
      { label: 'Main Menu', onClick: showMainMenu },
    ],
  );
}

// -------------------------------------------------
// Wave manager
// -------------------------------------------------
function randomEdgePoint() {
  const edge = Math.floor(rand(0, 4));
  if (edge === 0) return { x: rand(0, canvas.width), y: -20 };
  if (edge === 1) return { x: canvas.width + 20, y: rand(0, canvas.height) };
  if (edge === 2) return { x: rand(0, canvas.width), y: canvas.height + 20 };
  return { x: -20, y: rand(0, canvas.height) };
}

function spawnWave(wave) {
  state.enemies = [];

  const driftCount = 3 + Math.floor(wave * 0.9);
  const dartCount = Math.max(0, Math.floor((wave - 1) * 0.85));
  const bulwarkCount = Math.max(0, Math.floor((wave - 2) * 0.35));
  const splitterCount = Math.max(0, Math.floor((wave - 2) * 0.45));
  const turretCount = Math.max(0, Math.floor((wave - 3) * 0.55));

  for (let i = 0; i < driftCount; i++) {
    const p = randomEdgePoint();
    state.enemies.push(createEnemy('driftRock', p.x, p.y, wave));
  }
  for (let i = 0; i < dartCount; i++) {
    const p = randomEdgePoint();
    state.enemies.push(createEnemy('dartScout', p.x, p.y, wave));
  }
  for (let i = 0; i < bulwarkCount; i++) {
    const p = randomEdgePoint();
    state.enemies.push(createEnemy('bulwark', p.x, p.y, wave));
  }
  for (let i = 0; i < splitterCount; i++) {
    const p = randomEdgePoint();
    state.enemies.push(createEnemy('splitterCore', p.x, p.y, wave));
  }
  for (let i = 0; i < turretCount; i++) {
    const p = randomEdgePoint();
    state.enemies.push(createEnemy('pulseTurret', p.x, p.y, wave));
  }
}

// -------------------------------------------------
// Core update systems
// -------------------------------------------------
function shootPlayer() {
  const now = performance.now();
  if (now - state.lastShotAt < fireDelay()) return;

  const spread = state.upgrades.scatterCannon;
  if (spread === 0) {
    state.bullets.push(createPlayerBullet(0));
  } else if (spread === 1) {
    state.bullets.push(createPlayerBullet(-0.07));
    state.bullets.push(createPlayerBullet(0.07));
  } else {
    state.bullets.push(createPlayerBullet(-0.12));
    state.bullets.push(createPlayerBullet(0));
    state.bullets.push(createPlayerBullet(0.12));
  }

  state.lastShotAt = now;
}

function updatePlayer(dtMs, now) {
  const p = state.player;

  let desiredAngle = p.angle;
  if (state.keys.ArrowLeft) desiredAngle -= SETTINGS.rotationSpeed;
  if (state.keys.ArrowRight) desiredAngle += SETTINGS.rotationSpeed;

  if (state.settings.mouseAim && state.mouse.hasValid) {
    const dx = state.mouse.lastValidX - p.x;
    const dy = state.mouse.lastValidY - p.y;
    const dist = Math.hypot(dx, dy);

    // Update desired aim only when mouse is outside deadzone.
    // This prevents immediate flip-around when the ship crosses the cursor.
    if (dist > MOUSE_AIM_DEADZONE) {
      state.mouse.lastValidAimAngle = Math.atan2(dy, dx);
    }

    // Two modes:
    // - aim: stable directional aiming (default)
    // - assist: softer steering toward cursor
    const modeTurnRate = state.settings.mouseControlMode === 'assist'
      ? MOUSE_ASSIST_TURN_RATE
      : MOUSE_AIM_TURN_RATE;
    const turnRate = Math.min(SETTINGS.maxTurnSpeed, modeTurnRate);
    desiredAngle = moveAngleToward(p.angle, state.mouse.lastValidAimAngle, turnRate);
  }

  // Final cap for any steering path to prevent snap-turns.
  p.angle = moveAngleToward(p.angle, desiredAngle, SETTINGS.maxTurnSpeed);

  const thrustingByMouse = state.settings.rightMouseThrust && state.settings.mouseAim && state.mouse.rightDown;
  const thrusting = state.keys.ArrowUp || thrustingByMouse;

  if (thrusting) {
    const t = thrustPower();
    p.vx += Math.cos(p.angle) * t;
    p.vy += Math.sin(p.angle) * t;

    if (Math.random() < graphicsLevelFactor()) {
      addParticle(p.x - Math.cos(p.angle) * p.radius, p.y - Math.sin(p.angle) * p.radius, NEON.yellow, 0.4, 2.4, rand(120, 250), 1, 2.2);
    }
  }

  const speed = Math.hypot(p.vx, p.vy);
  if (speed > topSpeed()) {
    const scale = topSpeed() / speed;
    p.vx *= scale;
    p.vy *= scale;
  }

  p.vx *= SETTINGS.friction;
  p.vy *= SETTINGS.friction;
  p.x += p.vx;
  p.y += p.vy;
  wrap(p);

  if (state.settings.holdToFire && state.mouse.leftDown) {
    shootPlayer();
  }

  if (p.maxShield > 0 && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + p.shieldRegen * (dtMs / 1000));
  }

  if (p.shield > 0 && Math.random() < 0.08 * graphicsLevelFactor()) {
    addParticle(p.x, p.y, NEON.cyan, 0.1, 0.9, 120, 1, 2);
  }
}

function updateEnemies(now) {
  for (const e of state.enemies) {
    const dx = state.player.x - e.x;
    const dy = state.player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.typeId === 'driftRock' || e.typeId === 'splitterCore') {
      e.x += e.vx;
      e.y += e.vy;
      e.angle += e.spin;
      wrap(e);
      continue;
    }

    if (e.typeId === 'dartScout') {
      const sp = ENEMY_TYPES.dartScout.speed * (1 + (state.wave - 1) * SETTINGS.enemySpeedScalePerWave);
      e.vx = nx * sp;
      e.vy = ny * sp;
      e.x += e.vx;
      e.y += e.vy;
      wrap(e);
      continue;
    }

    if (e.typeId === 'bulwark') {
      const sp = ENEMY_TYPES.bulwark.speed * (1 + (state.wave - 1) * SETTINGS.enemySpeedScalePerWave * 0.7);
      e.vx = nx * sp;
      e.vy = ny * sp;
      e.x += e.vx;
      e.y += e.vy;
      wrap(e);
      continue;
    }

    if (e.typeId === 'pulseTurret') {
      const desired = 250;
      const sp = ENEMY_TYPES.pulseTurret.speed * (1 + (state.wave - 1) * SETTINGS.enemySpeedScalePerWave * 0.6);
      if (dist > desired) {
        e.vx = nx * sp;
        e.vy = ny * sp;
      } else {
        e.vx = -ny * sp * 0.75;
        e.vy = nx * sp * 0.75;
      }
      e.x += e.vx;
      e.y += e.vy;
      wrap(e);

      if (now - e.lastShotAt > e.shootCooldown) {
        e.lastShotAt = now;
        state.enemyBullets.push(createEnemyBullet(e, Math.atan2(dy, dx)));
      }
    }
  }
}

function updateProjectiles(dtMs) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 9) b.trail.shift();

    b.x += b.vx;
    b.y += b.vy;
    wrap(b);
    b.life -= dtMs;
    if (b.life <= 0) state.bullets.splice(i, 1);
  }

  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    wrap(b);
    b.life -= dtMs;
    if (b.life <= 0) state.enemyBullets.splice(i, 1);
  }
}

function updatePickups(dtMs) {
  const p = state.player;
  const pullRadius = pickupRadius();

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const orb = state.pickups[i];
    orb.life -= dtMs;

    orb.x += orb.vx;
    orb.y += orb.vy;
    orb.vx *= 0.99;
    orb.vy *= 0.99;
    wrap(orb);

    const dx = p.x - orb.x;
    const dy = p.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < pullRadius) {
      const pull = 0.25 + state.upgrades.magnetField * 0.07;
      orb.vx += (dx / dist) * pull;
      orb.vy += (dy / dist) * pull;
    }

    if (dist < p.radius + orb.radius + 5) {
      state.credits += orb.value;
      state.totalCreditsEarned += orb.value;
      addParticle(orb.x, orb.y, NEON.green, 0.2, 1.4, 180, 1.2, 2.5);
      state.pickups.splice(i, 1);
      continue;
    }

    if (orb.life <= 0) state.pickups.splice(i, 1);
  }
}

function updateFx(dtMs) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= dtMs;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    r.life -= dtMs;
    r.radius += (r.maxRadius / r.maxLife) * dtMs;
    if (r.life <= 0) state.rings.splice(i, 1);
  }

  state.shake = Math.max(0, state.shake - dtMs * 0.035);
}

function damagePlayer(amount) {
  const p = state.player;
  if (performance.now() < p.invincibleUntil) return;

  let remaining = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, remaining);
    p.shield -= absorbed;
    remaining -= absorbed;
    addExplosion(p.x, p.y, NEON.cyan, 8, 24);
  }

  if (remaining > 0) {
    p.health -= remaining;
    state.damageTakenThisWave += remaining;
    addExplosion(p.x, p.y, NEON.red, 16, 32);
    maybeShake(7);
  }

  if (p.health <= 0) {
    p.lives -= 1;
    if (p.lives <= 0) {
      endRun();
      updateHud();
      return;
    }

    p.x = canvas.width / 2;
    p.y = canvas.height / 2;
    p.vx = 0;
    p.vy = 0;
    p.health = p.maxHealth;
    p.shield = p.maxShield;
    p.invincibleUntil = performance.now() + SETTINGS.respawnInvulnMs;
    addExplosion(p.x, p.y, NEON.yellow, 20, 40);
  }

  updateHud();
}

function killEnemy(index, enemy) {
  state.totalKills += 1;
  state.score += enemy.scoreValue;

  const credits = Math.round(enemy.creditValue * SETTINGS.killCreditMultiplier * salvageMultiplier());
  spawnCreditPickup(enemy.x, enemy.y, credits);

  const colorMap = {
    driftRock: '#9ebfff',
    dartScout: '#ffbe8c',
    bulwark: '#7ff7ff',
    splitterCore: '#ff8be6',
    pulseTurret: '#cc9fff',
  };

  addExplosion(enemy.x, enemy.y, colorMap[enemy.typeId], enemy.typeId === 'bulwark' ? 20 : 14, enemy.typeId === 'bulwark' ? 42 : 28);
  maybeShake(enemy.typeId === 'bulwark' ? 6 : 3.5);

  // Splitter core spawns two dart scouts on death.
  if (enemy.typeId === 'splitterCore') {
    for (let i = 0; i < 2; i++) {
      const mini = createEnemy('dartScout', enemy.x + rand(-8, 8), enemy.y + rand(-8, 8), state.wave);
      mini.radius = 10;
      mini.hp = Math.max(1, Math.floor(mini.hp * 0.8));
      mini.creditValue = Math.floor(mini.creditValue * 0.75);
      mini.scoreValue = Math.floor(mini.scoreValue * 0.75);
      state.enemies.push(mini);
    }
  }

  state.enemies.splice(index, 1);
}

function handleCollisions() {
  for (let b = state.bullets.length - 1; b >= 0; b--) {
    const bullet = state.bullets[b];

    for (let e = state.enemies.length - 1; e >= 0; e--) {
      const enemy = state.enemies[e];
      if (!circlesHit(bullet, enemy)) continue;

      enemy.hp -= bullet.damage;
      if (enemy.hp <= 0) killEnemy(e, enemy);
      else addExplosion(enemy.x, enemy.y, NEON.blue, 6, 18);

      state.bullets.splice(b, 1);
      break;
    }
  }

  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = state.enemyBullets[i];
    if (!circlesHit(bullet, state.player)) continue;

    damagePlayer(bullet.damage);
    state.enemyBullets.splice(i, 1);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    if (!circlesHit(enemy, state.player)) continue;

    damagePlayer(16 + state.wave * 1.3);
    enemy.hp -= 2;
    if (enemy.hp <= 0) killEnemy(i, enemy);
  }
}

function finishWave() {
  const seconds = (performance.now() - state.waveStartTime) / 1000;
  const waveBonus = SETTINGS.waveClearRewardBase + state.wave * SETTINGS.waveClearRewardPerWave;
  const fastBonus = seconds <= SETTINGS.fastClearTargetSeconds ? SETTINGS.fastClearBonus : 0;
  const noDamageBonus = state.damageTakenThisWave <= 0 ? SETTINGS.noDamageBonus : 0;

  const total = waveBonus + fastBonus + noDamageBonus;
  state.credits += total;
  state.totalCreditsEarned += total;

  enterShop({ waveBonus, fastBonus, noDamageBonus });
  updateHud();
}

// -------------------------------------------------
// Shop
// -------------------------------------------------
function upgradeLevel(id) {
  return state.upgrades[id] || 0;
}

function upgradeCost(def) {
  return Math.round(def.baseCost * Math.pow(def.costScale, upgradeLevel(def.id)));
}

function canShowUpgrade(def) {
  if (def.minWave && state.wave < def.minWave) return false;
  return true;
}

function buyUpgrade(id) {
  if (state.gameState !== GAME_STATE.SHOP) return;

  const def = UPGRADE_DEFS.find((u) => u.id === id);
  if (!def || !canShowUpgrade(def)) return;

  if (upgradeLevel(def.id) >= def.maxLevel) return;
  const cost = upgradeCost(def);
  if (state.credits < cost) return;

  state.credits -= cost;
  def.apply();
  state.upgradesPurchased += 1;
  state.upgrades[id] = Math.min(def.maxLevel, state.upgrades[id] + 1);

  if (state.settings.autoStartNextWave) {
    state.autoNextWaveAt = performance.now() + 6000;
  }

  buildShopButtons();
  renderUpgradeList();
  updateHud();
}

function buildShopButtons() {
  shopButtonsEl.innerHTML = '';
  shopCreditsEl.textContent = String(state.credits);

  UPGRADE_DEFS.filter(canShowUpgrade).forEach((def) => {
    const lvl = upgradeLevel(def.id);
    const cost = upgradeCost(def);
    const capped = lvl >= def.maxLevel;

    const btn = document.createElement('button');
    btn.className = 'shop-btn';
    btn.disabled = capped || state.credits < cost;

    btn.innerHTML = `
      <div><strong>${def.name}</strong></div>
      <div>${def.desc}</div>
      <div class="cost">Cost: ${capped ? 'MAX' : cost}</div>
      <div class="owned">Tier: ${lvl}/${def.maxLevel}</div>
    `;

    btn.addEventListener('click', () => buyUpgrade(def.id));
    shopButtonsEl.appendChild(btn);
  });
}

// -------------------------------------------------
// UI updates
// -------------------------------------------------
function renderUpgradeList() {
  const lines = UPGRADE_DEFS
    .filter((u) => upgradeLevel(u.id) > 0)
    .map((u) => `${u.name}: ${upgradeLevel(u.id)}/${u.maxLevel}`);

  upgradeListEl.innerHTML = lines.length
    ? lines.map((l) => `<li>${l}</li>`).join('')
    : '<li>None purchased</li>';
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score));
  waveEl.textContent = String(state.wave);
  livesEl.textContent = String(state.player ? state.player.lives : SETTINGS.startLives);
  healthEl.textContent = String(state.player ? Math.max(0, Math.round(state.player.health)) : SETTINGS.baseMaxHealth);
  shieldEl.textContent = String(state.player ? Math.round(state.player.shield) : 0);
  creditsEl.textContent = String(Math.floor(state.credits));
  weaponEl.textContent = weaponName();
  dronesEl.textContent = droneLabelList();
}

// -------------------------------------------------
// Input
// -------------------------------------------------
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  state.keys[event.key] = true;

  if (event.key === 'm' || event.key === 'M') {
    state.settings.mouseAim = !state.settings.mouseAim;
    saveSettings();
    return;
  }

  if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && state.gameState === GAME_STATE.PLAYING) {
    pauseRun();
    return;
  }
  if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && state.gameState === GAME_STATE.PAUSED) {
    state.gameState = GAME_STATE.PLAYING;
    menuOverlay.classList.add('hidden');
    return;
  }

  if (state.gameState === GAME_STATE.PLAYING && event.key === ' ') {
    shootPlayer();
    return;
  }

  if (state.gameState === GAME_STATE.SHOP) {
    // number keys for first 10 core upgrades
    const mapping = {
      '1': 'rapidFire',
      '2': 'overchargedRounds',
      '3': 'velocityRounds',
      '4': 'scatterCannon',
      '5': 'reinforcedHull',
      '6': 'rechargeShield',
      '7': 'thrusterBoost',
      '8': 'magnetField',
      '9': 'salvageBonus',
      '0': 'emergencyRepair',
    };

    if (mapping[event.key]) {
      buyUpgrade(mapping[event.key]);
      return;
    }

    if (event.key === 'Enter') {
      startNextWave();
    }
  }
});

window.addEventListener('keyup', (event) => {
  state.keys[event.key] = false;
});

window.addEventListener('mousemove', (event) => {
  const p = pointerToCanvas(event.clientX, event.clientY);
  if (!p) return;

  state.mouse.lastValidX = p.x;
  state.mouse.lastValidY = p.y;
  state.mouse.hasValid = true;
});

window.addEventListener('mousedown', (event) => {
  if (state.gameState !== GAME_STATE.PLAYING) return;

  if (event.button === 0) {
    state.mouse.leftDown = true;
    shootPlayer();
  }

  if (event.button === 2 && state.settings.rightMouseThrust) {
    state.mouse.rightDown = true;
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) state.mouse.leftDown = false;
  if (event.button === 2) state.mouse.rightDown = false;
});

gameWrap.addEventListener('contextmenu', (event) => event.preventDefault());
nextWaveButton.addEventListener('click', () => {
  if (state.gameState === GAME_STATE.SHOP) startNextWave();
});

// -------------------------------------------------
// Stars + rendering
// -------------------------------------------------
function buildStars() {
  state.stars = [];
  const count = state.settings.graphicsIntensity === 'low'
    ? SETTINGS.starDensityLow
    : state.settings.graphicsIntensity === 'medium'
      ? SETTINGS.starDensityMedium
      : SETTINGS.starDensityHigh;

  for (let i = 0; i < count; i++) {
    const depth = Math.random() < 0.68 ? 1 : 2;
    state.stars.push({
      x: rand(0, canvas.width),
      y: rand(0, canvas.height),
      size: depth === 1 ? rand(0.7, 1.8) : rand(1.3, 2.8),
      alpha: depth === 1 ? rand(0.18, 0.58) : rand(0.4, 1),
      depth,
    });
  }
}

function neonStroke(color, width, blur) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * glowScale();
}

function drawBackground(now) {
  const t = now * SETTINGS.colorCycleSpeed;
  const r = Math.floor(10 + Math.sin(t) * 5);
  const g = Math.floor(12 + Math.sin(t + 2) * 5);
  const b = Math.floor(25 + Math.sin(t + 4) * 8);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 160, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStars(now) {
  const p = state.player || { vx: 0, vy: 0 };
  for (const s of state.stars) {
    const x = (s.x - p.vx * 0.2 * s.depth + canvas.width) % canvas.width;
    const y = (s.y - p.vy * 0.2 * s.depth + canvas.height) % canvas.height;
    const pulse = 0.12 * Math.sin(now * 0.003 + s.x * 0.01);

    ctx.globalAlpha = clamp(s.alpha + pulse, 0.05, 1);
    ctx.fillStyle = s.depth === 2 ? '#c9eaff' : '#fff';
    ctx.fillRect(x, y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(now) {
  const p = state.player;
  if (!p) return;

  const blinking = now < p.invincibleUntil && Math.floor(now / 100) % 2 === 0;
  if (blinking) return;

  const pulse = 0.75 + 0.25 * Math.sin(now * SETTINGS.pulseSpeed);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  neonStroke(`rgba(99,233,255,${0.35 + 0.42 * pulse})`, 4, 18);
  ctx.beginPath();
  ctx.moveTo(p.radius, 0);
  ctx.lineTo(-p.radius * 0.8, p.radius * 0.66);
  ctx.lineTo(-p.radius * 0.8, -p.radius * 0.66);
  ctx.closePath();
  ctx.stroke();

  neonStroke(NEON.white, 1.8, 6);
  ctx.stroke();

  neonStroke(NEON.blue, 1.2, 10);
  ctx.beginPath();
  ctx.moveTo(p.radius * 0.2, 0);
  ctx.lineTo(-p.radius * 0.55, 0);
  ctx.stroke();

  const thrustingByMouse = state.settings.rightMouseThrust && state.settings.mouseAim && state.mouse.rightDown;
  if (state.keys.ArrowUp || thrustingByMouse) {
    neonStroke(NEON.yellow, 2, 14);
    ctx.beginPath();
    ctx.moveTo(-p.radius * 0.8, 0);
    ctx.lineTo(-p.radius - rand(10, 22), 0);
    ctx.stroke();
  }

  ctx.restore();

  if (p.shield > 0) {
    const a = 0.3 + 0.35 * Math.sin(now * 0.008);
    neonStroke(`rgba(99,233,255,${a})`, 2, 14);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 6 + Math.sin(now * 0.013) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
}

function drawEnemies(now) {
  for (const e of state.enemies) {
    const pulse = 0.6 + 0.4 * Math.sin(now * 0.005 + e.x * 0.01);
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.typeId === 'driftRock') {
      ctx.rotate(e.angle);
      neonStroke(`rgba(173,199,255,${0.5 + pulse * 0.3})`, 2.4, 11);
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = e.radius * (0.78 + (i % 2 ? 0.2 : 0.08));
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    if (e.typeId === 'dartScout') {
      neonStroke(`rgba(255,176,123,${0.45 + pulse * 0.45})`, 2.2, 10);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.7, 0);
      ctx.lineTo(e.radius * 0.8, 0);
      ctx.stroke();
    }

    if (e.typeId === 'bulwark') {
      neonStroke(`rgba(124,247,255,${0.5 + pulse * 0.35})`, 3, 12);
      ctx.beginPath();
      ctx.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      ctx.stroke();
    }

    if (e.typeId === 'splitterCore') {
      neonStroke(`rgba(255,126,219,${0.45 + pulse * 0.45})`, 2.4, 12);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.stroke();
      neonStroke('rgba(255,126,219,0.7)', 1.4, 8);
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.8, -e.radius * 0.2);
      ctx.lineTo(e.radius * 0.8, e.radius * 0.2);
      ctx.stroke();
    }

    if (e.typeId === 'pulseTurret') {
      ctx.rotate(Math.atan2(e.vy, e.vx));
      neonStroke(`rgba(188,137,255,${0.45 + pulse * 0.45})`, 2.3, 11);
      ctx.beginPath();
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius, 0);
      ctx.closePath();
      ctx.stroke();
    }

    const hpPct = clamp(e.hp / e.maxHp, 0, 1);
    neonStroke('rgba(130,255,189,0.7)', 2, 7);
    ctx.beginPath();
    ctx.moveTo(-e.radius, -e.radius - 7);
    ctx.lineTo(-e.radius + e.radius * 2 * hpPct, -e.radius - 7);
    ctx.stroke();

    ctx.restore();
  }

  ctx.shadowBlur = 0;
}

function drawProjectiles() {
  for (const b of state.bullets) {
    ctx.strokeStyle = 'rgba(177,231,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    b.trail.forEach((t, idx) => {
      if (idx === 0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y);
    });
    ctx.stroke();

    ctx.fillStyle = '#dff6ff';
    ctx.shadowColor = '#dff6ff';
    ctx.shadowBlur = 14 * glowScale();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of state.enemyBullets) {
    ctx.fillStyle = NEON.magenta;
    ctx.shadowColor = NEON.magenta;
    ctx.shadowBlur = 12 * glowScale();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const bomb of state.bombs) {
    ctx.fillStyle = NEON.orange;
    ctx.shadowColor = NEON.orange;
    ctx.shadowBlur = 16 * glowScale();
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.radius + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

function drawPickups(now) {
  for (const orb of state.pickups) {
    const pulse = 0.4 + 0.6 * Math.sin(now * 0.008 + orb.x * 0.03);
    const size = orb.radius + pulse;

    ctx.fillStyle = NEON.green;
    ctx.shadowColor = NEON.green;
    ctx.shadowBlur = 12 * glowScale();
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

function drawDrones() {
  for (const d of state.drones) {
    let color = NEON.white;
    if (d.type === 'bomber') color = NEON.orange;
    if (d.type === 'electricity') color = NEON.cyan;
    if (d.type === 'laser') color = '#c7ff4a';

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * glowScale();
    ctx.beginPath();
    ctx.arc(d.x, d.y, 7, 0, Math.PI * 2);
    ctx.fill();

    neonStroke(color, 1.4, 8);
    ctx.beginPath();
    ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Optional targeting lines (settings)
  if (state.settings.showDroneTargetLines) {
    for (const beam of state.beamEffects) {
      neonStroke('rgba(199,255,74,0.7)', 2, 10);
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
    }

    for (const arc of state.arcEffects) {
      neonStroke('rgba(99,233,255,0.7)', 1.8, 10);
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
}

function drawFx() {
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.glow * glowScale();
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  for (const r of state.rings) {
    ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
    neonStroke(r.color, 2, 14);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawWaveBanner() {
  if (state.gameState !== GAME_STATE.PLAYING) return;
  const elapsed = (performance.now() - state.waveStartTime) / 1000;
  if (elapsed > 2.2) return;

  ctx.save();
  ctx.globalAlpha = clamp(1 - elapsed / 2.2, 0, 1);
  ctx.font = '30px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#dff7ff';
  ctx.shadowColor = NEON.cyan;
  ctx.shadowBlur = 16 * glowScale();
  ctx.fillText(`WAVE ${state.wave}`, canvas.width / 2, 60);
  ctx.restore();
}

function drawCrosshair() {
  if (!state.settings.mouseAim || state.gameState !== GAME_STATE.PLAYING || !state.mouse.hasValid) return;

  const x = state.mouse.lastValidX;
  const y = state.mouse.lastValidY;

  neonStroke('rgba(136,235,255,0.45)', 1.2, 10);
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x, y + 16);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

function draw(now) {
  ctx.save();

  if (state.settings.screenShake && state.shake > 0.01) {
    ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
  }

  drawBackground(now);
  drawStars(now);
  drawFx();
  drawEnemies(now);
  drawProjectiles();
  drawPickups(now);
  drawDrones();
  drawPlayer(now);
  drawCrosshair();
  drawWaveBanner();

  ctx.restore();
}

// -------------------------------------------------
// Update tick
// -------------------------------------------------
function update(now, dtMs) {
  if (state.gameState !== GAME_STATE.PLAYING) {
    // Shop timer for auto-next-wave
    if (state.gameState === GAME_STATE.SHOP && state.autoNextWaveAt && now >= state.autoNextWaveAt) {
      startNextWave();
    }
    return;
  }

  updatePlayer(dtMs, now);
  updateEnemies(now);
  updateProjectiles(dtMs);
  updateBombs(dtMs);
  updateDrones(dtMs, now);
  updatePickups(dtMs);
  handleCollisions();
  updateFx(dtMs);

  if (state.enemies.length === 0) {
    finishWave();
  }

  updateHud();
}

function frame(now) {
  const dtMs = Math.min(50, now - state.lastFrameTime);
  state.lastFrameTime = now;

  update(now, dtMs);
  draw(now);

  requestAnimationFrame(frame);
}

// -------------------------------------------------
// Init
// -------------------------------------------------
function init() {
  loadSettings();
  applySettingsToUI();

  state.player = createPlayer();
  updateHud();
  renderUpgradeList();
  showMainMenu();

  requestAnimationFrame(frame);
}

init();
