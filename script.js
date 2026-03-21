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
const weaponSlotsEl = document.getElementById('weaponSlots');
const dronesEl = document.getElementById('drones');
const bestScoreEl = document.getElementById('bestScore');
const bestWaveEl = document.getElementById('bestWave');
const upgradeListEl = document.getElementById('upgradeList');
const pickupLabelsEl = document.getElementById('pickupLabels');
const buildInfoEl = document.getElementById('buildInfo');

const menuOverlay = document.getElementById('menuOverlay');
const menuCard = menuOverlay.querySelector('.menu-card');
const menuTitle = document.getElementById('menuTitle');
const menuText = document.getElementById('menuText');
const menuContent = document.getElementById('menuContent');
const menuButtons = document.getElementById('menuButtons');
const menuFooter = document.getElementById('menuFooter');
const menuFooterButtons = document.getElementById('menuFooterButtons');

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

const GAME_VERSION = 'v0.7';
const BUILD_TIME = new Date().toLocaleTimeString();

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

const SHOP_CARD_MIN_HEIGHT = 156;
const SHOP_CARD_PADDING_Y = 14;
const SHOP_CARD_LINE_GAP = 6;
const SHOP_TITLE_FONT_SIZE = 16;
const SHOP_META_FONT_SIZE = 12;

const SETTINGS_MAX_VISIBLE_ROWS = 8;
const SETTINGS_ROW_HEIGHT = 46;
const SETTINGS_PANEL_HEIGHT = 560;
const SETTINGS_FOOTER_HEIGHT = 74;

const RIFT_ENABLED = true;
const RIFT_CENTER_X = 0.5; // normalized (0-1) or absolute px if > 1
const RIFT_CENTER_Y = 0.42; // normalized (0-1) or absolute px if > 1
const RIFT_SCALE = 1;
const RIFT_PURPLE_INTENSITY = 1.24;
const RIFT_GREEN_INTENSITY = 1.06;
const RIFT_PULSE_SPEED = 0.0023;
const RIFT_OPACITY = 0.56;
const STAR_DENSITY = 1;
const PLAYER_SPAWN_INVULN_DURATION = 2400;

const MAX_ACTIVE_PARTICLES = 900;
const MAX_ACTIVE_PICKUPS = 260;
const MAX_ACTIVE_FLOATING_TEXTS = 80;
const MAX_ACTIVE_ENEMIES = 340;
const MAX_ACTIVE_ENEMY_PROJECTILES = 320;
const ENEMY_OUT_OF_BOUNDS_TIMEOUT = 2600;
const PLAYER_BOUNDARY_PADDING = 12;
const ENEMY_BOUNDARY_PADDING = 8;
const PROJECTILE_DESPAWN_MARGIN = 40;
const WEAPON_VISUAL_SCALE = 1;

const WEAPON_BALANCE_VALUES = {
  blaster: { damage: 1.2, fireDelayMs: 200, speed: 9.4, spread: 0, pierce: 0, splash: 0 },
  rapid: { damage: 0.56, fireDelayMs: 92, speed: 10.8, spread: 0, pierce: 0, splash: 0 },
  spread: { damage: 0.8, fireDelayMs: 250, speed: 8.2, spread: 0.19, pierce: 0, splash: 0 },
  laser: { damage: 1.05, fireDelayMs: 190, speed: 13.4, spread: 0, pierce: 4, splash: 0 },
  arc: { damage: 1.45, fireDelayMs: 305, speed: 8.6, spread: 0, pierce: 0, splash: 94 },
};

const PLAYER_RING_OUTER_RADIUS = 25;
const PLAYER_RING_INNER_RADIUS = 20;
const PLAYER_RING_WIDTH = 3;
const SHIELD_RING_COLOR = '#63c9ff';
const HEALTH_RING_COLOR = '#79ffbc';
const PLAYER_RING_ALPHA = 0.78;
const PLAYER_DAMPING = 0.95;
const PLAYER_BRAKE_DAMPING = 0.85;
const PLAYER_MIN_VELOCITY = 0.04;
const ENEMY_EDGE_AVOID_RADIUS = 120;
const ENEMY_EDGE_AVOID_FORCE = 0.07;
const ENEMY_CENTER_BIAS = 0.02;
const ENEMY_SEPARATION_RADIUS = 42;
const ENEMY_SEPARATION_FORCE = 0.06;
const AGGRESSION_SCALING_PER_WAVE = 0.015;
const SPEED_SCALING_PER_WAVE = 0.012;
const ELITE_CHANCE_PER_WAVE = 0.005;
const MIXED_WAVE_COMPLEXITY_SCALING = 0.11;

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
  classicPhysicsMode: false,
  showVersionInfo: true,
  soundEnabled: true,
  sfxVolume: 0.75,
  musicEnabled: true,
  musicVolume: 0.34,
};

const SETTINGS_STORAGE_KEY = 'neon_rift_arena_settings_v1';
const HIGH_SCORE_STORAGE_KEY = 'neon_rift_arena_high_scores_v1';

const WEAPON_SLOTS = ['blaster', 'rapid', 'spread', 'laser', 'arc'];
const WEAPON_DEFS = {
  blaster: { label: 'Blaster', fireDelayMs: WEAPON_BALANCE_VALUES.blaster.fireDelayMs, bulletDamage: WEAPON_BALANCE_VALUES.blaster.damage, bulletSpeed: WEAPON_BALANCE_VALUES.blaster.speed, bulletsPerShot: 1, spreadStep: WEAPON_BALANCE_VALUES.blaster.spread, pierce: WEAPON_BALANCE_VALUES.blaster.pierce, color: '#dff6ff', trail: 'rgba(177,231,255,0.45)', impact: '#9be8ff' },
  rapid: { label: 'Rapid Blaster', fireDelayMs: WEAPON_BALANCE_VALUES.rapid.fireDelayMs, bulletDamage: WEAPON_BALANCE_VALUES.rapid.damage, bulletSpeed: WEAPON_BALANCE_VALUES.rapid.speed, bulletsPerShot: 1, spreadStep: WEAPON_BALANCE_VALUES.rapid.spread, pierce: WEAPON_BALANCE_VALUES.rapid.pierce, color: '#d6ff7b', trail: 'rgba(214,255,123,0.38)', impact: '#ccff88' },
  spread: { label: 'Spread Blaster', fireDelayMs: WEAPON_BALANCE_VALUES.spread.fireDelayMs, bulletDamage: WEAPON_BALANCE_VALUES.spread.damage, bulletSpeed: WEAPON_BALANCE_VALUES.spread.speed, bulletsPerShot: 3, spreadStep: WEAPON_BALANCE_VALUES.spread.spread, pierce: WEAPON_BALANCE_VALUES.spread.pierce, color: '#ffb8e0', trail: 'rgba(255,184,224,0.35)', impact: '#ff98d9' },
  laser: { label: 'Laser Beam', fireDelayMs: WEAPON_BALANCE_VALUES.laser.fireDelayMs, bulletDamage: WEAPON_BALANCE_VALUES.laser.damage, bulletSpeed: WEAPON_BALANCE_VALUES.laser.speed, bulletsPerShot: 1, spreadStep: WEAPON_BALANCE_VALUES.laser.spread, pierce: WEAPON_BALANCE_VALUES.laser.pierce, color: '#8affff', trail: 'rgba(138,255,255,0.5)', impact: '#82f6ff' },
  arc: { label: 'Arc Cannon', fireDelayMs: WEAPON_BALANCE_VALUES.arc.fireDelayMs, bulletDamage: WEAPON_BALANCE_VALUES.arc.damage, bulletSpeed: WEAPON_BALANCE_VALUES.arc.speed, bulletsPerShot: 1, spreadStep: WEAPON_BALANCE_VALUES.arc.spread, pierce: WEAPON_BALANCE_VALUES.arc.pierce, splashRadius: WEAPON_BALANCE_VALUES.arc.splash, color: '#a790ff', trail: 'rgba(167,144,255,0.42)', impact: '#b8a7ff' },
};

const PICKUP_SETTINGS = {
  moneyOrbLifetimeMs: 8500,
  moneyOrbValueMinScale: 0.7,
  moneyOrbValueMaxScale: 1.25,
  moneyOrbGlowSize: 16,
  moneyMagnetBaseRadius: 42,
  moneyMagnetRadiusPerTier: 48,
  moneyAttractionBase: 0.22,
  moneyAttractionPerTier: 0.065,
  rareDropLifetimeMs: 9000,
};

const RARE_DROP_CHANCE = {
  base: 0.045,
  bulwarkBonus: 0.04,
  splitterBonus: 0.025,
  turretBonus: 0.02,
};

const UTILITY_PURCHASES = {
  hullRepairAmount: 42,
  shieldRechargeAmount: 58,
  emergencyRepairBaseCost: 95,
  shieldRechargeBaseCost: 105,
};

const ENDLESS_SCALING = {
  hpPerWave: 0.145,
  speedPerWave: 0.075,
  projectileSpeedPerWave: 0.04,
  fireRatePerWave: 0.035,
  countPerWave: 0.085,
  eliteBaseChance: 0.02,
  eliteChancePerWave: 0.004,
};

const SCATTER_TUNING = {
  baseProjectiles: 3,
  maxExtraProjectiles: 4,
  tierDamageBonus: 0.18,
  wideSpreadStep: 0.02,
  denseSpreadStep: 0.012,
  pelletVelocityBonus: 0.8,
  piercePerTier: 1,
};

const RARE_FEEDBACK = {
  rareTextSizePx: 26,
  normalTextSizePx: 15,
  extraLifeDropChance: 0.015,
};

// -------------------------------------------------
// Upgrade/shop definitions
// -------------------------------------------------
const UPGRADE_DEFS = [
  // Utility purchases (always shown)
  {
    id: 'emergencyRepair',
    name: 'Emergency Repair (Utility)',
    key: '0',
    category: 'utility',
    maxLevel: null,
    baseCost: UTILITY_PURCHASES.emergencyRepairBaseCost,
    costScale: 1.16,
    desc: 'Restore hull instantly',
    isDisabled: () => state.player.health >= state.player.maxHealth,
    apply: () => {
      state.upgrades.emergencyRepair += 1;
      state.player.health = Math.min(state.player.maxHealth, state.player.health + UTILITY_PURCHASES.hullRepairAmount);
    },
  },
  {
    id: 'rechargeShield',
    name: 'Shield Recharge (Utility)',
    key: '',
    category: 'utility',
    maxLevel: null,
    baseCost: UTILITY_PURCHASES.shieldRechargeBaseCost,
    costScale: 1.16,
    desc: 'Restore shield instantly',
    isDisabled: () => state.player.maxShield <= 0 || state.player.shield >= state.player.maxShield,
    apply: () => {
      state.upgrades.rechargeShield += 1;
      state.player.shield = Math.min(state.player.maxShield, state.player.shield + UTILITY_PURCHASES.shieldRechargeAmount);
    },
  },

  // One-time unlocks
  { id: 'weaponSpreadUnlock', name: 'Unlock: Spread Blaster', key: '4', category: 'unlock', maxLevel: 1, baseCost: 170, costScale: 1, desc: 'Unlock weapon slot 3', minWave: 2, apply: () => { state.weaponUnlocks.spread = true; } },
  { id: 'weaponLaserUnlock', name: 'Unlock: Laser Beam', key: '', category: 'unlock', maxLevel: 1, baseCost: 260, costScale: 1, desc: 'Unlock weapon slot 4', minWave: 4, apply: () => { state.weaponUnlocks.laser = true; } },
  { id: 'weaponArcUnlock', name: 'Unlock: Arc Cannon', key: '', category: 'unlock', maxLevel: 1, baseCost: 300, costScale: 1, desc: 'Unlock weapon slot 5', minWave: 5, apply: () => { state.weaponUnlocks.arc = true; } },
  { id: 'droneBomber', name: 'Unlock: Bomber Drone', key: '', category: 'unlock', maxLevel: 1, baseCost: 320, costScale: 1, desc: 'AOE bombs for crowds', minWave: 3, apply: () => unlockDrone('bomber') },
  { id: 'droneElectricity', name: 'Unlock: Electricity Drone', key: '', category: 'unlock', maxLevel: 1, baseCost: 340, costScale: 1, desc: 'Arc chains nearby enemies', minWave: 4, apply: () => unlockDrone('electricity') },
  { id: 'droneLaser', name: 'Unlock: Laser Drone', key: '', category: 'unlock', maxLevel: 1, baseCost: 360, costScale: 1, desc: 'Sustained beam vs tanks', minWave: 5, apply: () => unlockDrone('laser') },

  // Capped core upgrades
  { id: 'rapidFire', name: 'Rapid Fire', key: '1', category: 'capped', maxLevel: 6, baseCost: 70, costScale: 1.44, desc: 'Decrease fire delay', apply: () => { state.upgrades.rapidFire += 1; } },
  { id: 'overchargedRounds', name: 'Overcharged Rounds', key: '2', category: 'capped', maxLevel: 6, baseCost: 85, costScale: 1.48, desc: 'Increase weapon damage', apply: () => { state.upgrades.overchargedRounds += 1; } },
  { id: 'velocityRounds', name: 'Velocity Rounds', key: '3', category: 'capped', maxLevel: 5, baseCost: 70, costScale: 1.43, desc: 'Increase projectile speed', apply: () => { state.upgrades.velocityRounds += 1; } },
  {
    id: 'reinforcedHull',
    name: 'Reinforced Hull',
    key: '5',
    category: 'capped',
    maxLevel: 4,
    baseCost: 125,
    costScale: 1.58,
    desc: '+Max hull and full heal',
    apply: () => {
      state.upgrades.reinforcedHull += 1;
      state.player.maxHealth += 24;
      state.player.health = state.player.maxHealth;
    },
  },
  {
    id: 'shieldMatrix',
    name: 'Shield Matrix',
    key: '6',
    category: 'capped',
    maxLevel: 5,
    baseCost: 135,
    costScale: 1.52,
    desc: '+Shield cap and regen',
    apply: () => {
      state.upgrades.shieldMatrix += 1;
      state.player.maxShield += 18;
      state.player.shield = state.player.maxShield;
      state.player.shieldRegen += 1.2;
    },
  },
  { id: 'thrusterBoost', name: 'Thruster Boost', key: '7', category: 'capped', maxLevel: 6, baseCost: 82, costScale: 1.4, desc: 'Increase thrust and top speed', apply: () => { state.upgrades.thrusterBoost += 1; } },

  // Weapon-specific (Spread Blaster) tiered upgrades
  {
    id: 'scatterTier1',
    name: 'Spread Blaster: Scatter Tier I',
    key: '',
    category: 'weapon',
    maxLevel: 1,
    baseCost: 130,
    costScale: 1,
    desc: '+Spread weapon damage',
    isVisible: () => state.weaponUnlocks.spread,
    apply: () => { state.upgrades.scatterTier1 += 1; },
  },
  {
    id: 'scatterTier2',
    name: 'Spread Blaster: Scatter Tier II',
    key: '',
    category: 'weapon',
    maxLevel: 1,
    baseCost: 185,
    costScale: 1,
    desc: 'More spread weapon damage',
    isVisible: () => state.weaponUnlocks.spread && state.upgrades.scatterTier1 > 0,
    apply: () => { state.upgrades.scatterTier2 += 1; },
  },
  {
    id: 'scatterTier3',
    name: 'Spread Blaster: Scatter Tier III',
    key: '',
    category: 'weapon',
    maxLevel: 1,
    baseCost: 260,
    costScale: 1,
    desc: 'Max spread weapon damage tier',
    isVisible: () => state.weaponUnlocks.spread && state.upgrades.scatterTier2 > 0,
    apply: () => { state.upgrades.scatterTier3 += 1; },
  },
  { id: 'scatterWide', name: 'Spread Blaster: Wide Spread', key: '', category: 'weapon', maxLevel: 4, baseCost: 120, costScale: 1.35, desc: 'Wider angle coverage', isVisible: () => state.weaponUnlocks.spread, apply: () => { state.upgrades.scatterWide += 1; } },
  { id: 'scatterDense', name: 'Spread Blaster: Dense Spread', key: '', category: 'weapon', maxLevel: 3, baseCost: 170, costScale: 1.45, desc: 'Extra pellets (capped)', isVisible: () => state.weaponUnlocks.spread && state.wave >= 4, apply: () => { state.upgrades.scatterDense += 1; } },
  { id: 'scatterVelocity', name: 'Spread Blaster: Pellet Velocity', key: '', category: 'weapon', maxLevel: null, baseCost: 145, costScale: 1.25, desc: 'Repeatable pellet speed scaling', isVisible: () => state.weaponUnlocks.spread, apply: () => { state.upgrades.scatterVelocity += 1; } },
  { id: 'scatterPierce', name: 'Spread Blaster: Piercing Pellets', key: '', category: 'weapon', maxLevel: 2, baseCost: 240, costScale: 1.55, desc: 'Pellets can pierce targets', isVisible: () => state.weaponUnlocks.spread && state.upgrades.scatterTier2 > 0, apply: () => { state.upgrades.scatterPierce += 1; } },

  // Infinite / soft-scaling upgrades
  { id: 'magnetField', name: 'Magnet Field', key: '8', category: 'infinite', maxLevel: null, baseCost: 95, costScale: 1.24, desc: 'Repeatable pickup radius and pull', apply: () => { state.upgrades.magnetField += 1; } },
  { id: 'salvageBonus', name: 'Salvage Bonus', key: '9', category: 'infinite', maxLevel: null, baseCost: 105, costScale: 1.24, desc: 'Repeatable credits gain', apply: () => { state.upgrades.salvageBonus += 1; } },
  { id: 'deepCoreSalvage', name: 'Deep Core Salvage', key: '', category: 'infinite', maxLevel: null, baseCost: 160, costScale: 1.24, desc: 'Repeatable orb value scaling', minWave: 3, apply: () => { state.upgrades.deepCoreSalvage += 1; } },
  { id: 'weaponTuning', name: 'Weapon Tuning', key: '', category: 'infinite', maxLevel: null, baseCost: 175, costScale: 1.25, desc: 'Repeatable global weapon scaling', minWave: 4, apply: () => { state.upgrades.weaponTuning += 1; } },
  { id: 'droneOverclock', name: 'Drone Overclock', key: '', category: 'infinite', maxLevel: null, baseCost: 185, costScale: 1.26, desc: 'Repeatable drone damage scaling', minWave: 5, isVisible: () => state.drones.length > 0, apply: () => { state.upgrades.droneOverclock += 1; } },
  { id: 'droneCooldown', name: 'Drone Cooldown Tuning', key: '', category: 'infinite', maxLevel: null, baseCost: 170, costScale: 1.23, desc: 'Repeatable drone fire-rate scaling', minWave: 6, isVisible: () => state.drones.length > 0, apply: () => { state.upgrades.droneCooldown += 1; } },
];

const RARE_DROP_DEFS = [
  { id: 'tempOvercharge', name: 'Temp Overcharge', color: '#ffd97f', chanceWeight: 1.25, apply: () => { state.runBonuses.damageMultiplier += 0.26; state.runBonuses.overchargeUntil = performance.now() + 13000; } },
  { id: 'fireRateBoost', name: 'Fire Rate Boost', color: '#b9ff8a', chanceWeight: 1.2, apply: () => { state.runBonuses.fireRateMultiplier += 0.23; state.runBonuses.fireRateUntil = performance.now() + 12500; } },
  { id: 'shieldBurst', name: 'Shield Burst', color: '#79f5ff', chanceWeight: 1, apply: () => { state.player.shield = Math.min(state.player.maxShield, state.player.shield + 42); state.player.health = Math.min(state.player.maxHealth, state.player.health + 8); } },
  { id: 'weaponCache', name: 'Weapon Cache', color: '#d9a4ff', chanceWeight: 0.8, apply: () => unlockRandomWeapon() },
  { id: 'dronePulse', name: 'Drone Enhancement', color: '#ffa66f', chanceWeight: 0.8, apply: () => { state.runBonuses.droneDamageMultiplier += 0.25; state.runBonuses.dronePowerUntil = performance.now() + 14000; } },
  { id: 'critFocus', name: 'Critical Focus', color: '#ff7ebd', chanceWeight: 0.85, apply: () => { state.runBonuses.critChance += 0.12; state.runBonuses.critUntil = performance.now() + 12000; } },
  { id: 'weaponCore', name: 'Weapon Core +', color: '#fff', chanceWeight: 0.62, apply: () => { state.runBonuses.permanentWeaponBonus += 0.12; } },
  { id: 'extraLife', name: 'Extra Life Core', color: '#ffe58a', chanceWeight: 0.12, apply: () => { state.player.lives += 1; } },
];

const AUDIO_LIMITS = {
  weaponFireMinGapMs: 42,
  uiHoverMinGapMs: 70,
  pickupMinGapMs: 55,
};

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audio = {
  ctx: null,
  master: null,
  musicBus: null,
  sfxBus: null,
  musicNodes: [],
  unlocked: false,
  lastSfxAt: {},

  ensure() {
    if (!AudioCtx) return false;
    if (this.ctx) return true;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applySettings();
    return true;
  },

  unlock() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    this.updateMusicState();
  },

  applySettings() {
    if (!AudioCtx) return;
    if (!this.ctx) {
      if (!this.unlocked) return;
      if (!this.ensure()) return;
    }
    const masterVol = state.settings.soundEnabled ? 1 : 0;
    this.master.gain.setValueAtTime(masterVol, this.ctx.currentTime);
    this.sfxBus.gain.setValueAtTime(clamp(Number(state.settings.sfxVolume) || 0, 0, 1), this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(state.settings.musicEnabled ? clamp(Number(state.settings.musicVolume) || 0, 0, 1) : 0, this.ctx.currentTime);
    this.updateMusicState();
  },

  canPlay(key, minGapMs = 0) {
    const now = performance.now();
    const last = this.lastSfxAt[key] || 0;
    if (now - last < minGapMs) return false;
    this.lastSfxAt[key] = now;
    return true;
  },

  tone({
    type = 'sine',
    freq = 440,
    freqEnd = null,
    duration = 0.12,
    gain = 0.1,
    attack = 0.003,
    release = 0.07,
    pan = 0,
    bus = 'sfx',
  }) {
    if (!this.unlocked || !this.ensure() || !state.settings.soundEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    const targetBus = bus === 'music' ? this.musicBus : this.sfxBus;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

    panner.pan.setValueAtTime(clamp(pan, -1, 1), now);
    osc.connect(amp);
    amp.connect(panner);
    panner.connect(targetBus);

    osc.start(now);
    osc.stop(now + duration + release + 0.02);
  },

  noiseBurst({ duration = 0.11, gain = 0.06, pan = 0 }) {
    if (!this.unlocked || !this.ensure() || !state.settings.soundEnabled) return;
    const samples = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);

    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    const now = this.ctx.currentTime;

    src.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(420, now);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    panner.pan.setValueAtTime(clamp(pan, -1, 1), now);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(panner);
    panner.connect(this.sfxBus);
    src.start(now);
  },

  play(name, opts = {}) {
    if (!this.unlocked || !state.settings.soundEnabled) return;
    const pan = opts.pan || 0;
    if (name === 'weapon_blaster') this.tone({ type: 'square', freq: 520, freqEnd: 260, duration: 0.06, gain: 0.08, pan });
    if (name === 'weapon_rapid') this.tone({ type: 'square', freq: 740, freqEnd: 420, duration: 0.04, gain: 0.055, pan });
    if (name === 'weapon_spread') this.tone({ type: 'triangle', freq: 480, freqEnd: 230, duration: 0.085, gain: 0.075, pan });
    if (name === 'weapon_laser') this.tone({ type: 'sawtooth', freq: 980, freqEnd: 320, duration: 0.07, gain: 0.06, pan });
    if (name === 'weapon_arc') {
      this.tone({ type: 'triangle', freq: 330, freqEnd: 180, duration: 0.12, gain: 0.09, pan });
      this.noiseBurst({ duration: 0.08, gain: 0.035, pan });
    }
    if (name === 'enemy_hit') this.tone({ type: 'triangle', freq: 250, freqEnd: 190, duration: 0.03, gain: 0.035, pan });
    if (name === 'enemy_destroy') {
      this.tone({ type: 'sawtooth', freq: 185, freqEnd: 70, duration: 0.2, gain: opts.big ? 0.13 : 0.08, pan });
      this.noiseBurst({ duration: opts.big ? 0.22 : 0.14, gain: opts.big ? 0.08 : 0.045, pan });
    }
    if (name === 'player_hit') this.tone({ type: 'square', freq: 170, freqEnd: 120, duration: 0.15, gain: 0.1, pan: -0.1 });
    if (name === 'shield_hit') this.tone({ type: 'triangle', freq: 900, freqEnd: 420, duration: 0.1, gain: 0.065, pan: 0.1 });
    if (name === 'pickup_money') this.tone({ type: 'sine', freq: 700, freqEnd: 1020, duration: 0.08, gain: 0.055, pan });
    if (name === 'pickup_rare') {
      this.tone({ type: 'sine', freq: 620, freqEnd: 980, duration: 0.13, gain: 0.1, pan });
      this.tone({ type: 'triangle', freq: 980, freqEnd: 1400, duration: 0.11, gain: 0.07, pan });
      this.noiseBurst({ duration: 0.1, gain: 0.035, pan });
    }
    if (name === 'pickup_life') {
      this.tone({ type: 'triangle', freq: 540, freqEnd: 900, duration: 0.14, gain: 0.12, pan });
      this.tone({ type: 'sine', freq: 900, freqEnd: 1480, duration: 0.2, gain: 0.09, pan });
    }
    if (name === 'shop_buy') this.tone({ type: 'sine', freq: 580, freqEnd: 860, duration: 0.1, gain: 0.06, pan });
    if (name === 'wave_clear') {
      this.tone({ type: 'triangle', freq: 420, freqEnd: 620, duration: 0.12, gain: 0.07 });
      this.tone({ type: 'triangle', freq: 620, freqEnd: 860, duration: 0.14, gain: 0.06 });
    }
    if (name === 'game_over') {
      this.tone({ type: 'sawtooth', freq: 340, freqEnd: 130, duration: 0.35, gain: 0.1 });
      this.noiseBurst({ duration: 0.2, gain: 0.05 });
    }
    if (name === 'ui_click') this.tone({ type: 'square', freq: 520, freqEnd: 430, duration: 0.04, gain: 0.045 });
    if (name === 'ui_hover') this.tone({ type: 'sine', freq: 760, freqEnd: 840, duration: 0.025, gain: 0.03 });
  },

  startMusic() {
    if (!this.unlocked || !this.ensure()) return;
    if (this.musicNodes.length > 0) return;
    const now = this.ctx.currentTime;
    const base = this.ctx.createOscillator();
    const pad = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const baseGain = this.ctx.createGain();
    const padGain = this.ctx.createGain();

    base.type = 'triangle';
    base.frequency.setValueAtTime(92, now);
    pad.type = 'sine';
    pad.frequency.setValueAtTime(184, now);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, now);
    lfoGain.gain.setValueAtTime(12, now);
    baseGain.gain.setValueAtTime(0.06, now);
    padGain.gain.setValueAtTime(0.03, now);

    lfo.connect(lfoGain);
    lfoGain.connect(base.frequency);
    base.connect(baseGain);
    pad.connect(padGain);
    baseGain.connect(this.musicBus);
    padGain.connect(this.musicBus);

    base.start(now);
    pad.start(now);
    lfo.start(now);
    this.musicNodes = [base, pad, lfo];
  },

  stopMusic() {
    if (!this.ctx) return;
    this.musicNodes.forEach((n) => {
      try { n.stop(); } catch (_err) { /* no-op */ }
    });
    this.musicNodes = [];
  },

  updateMusicState() {
    if (!this.ctx || !this.unlocked) return;
    if (state.settings.musicEnabled && state.settings.soundEnabled) this.startMusic();
    else this.stopMusic();
  },
};

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
  rareDrops: [],
  pickupLabels: [],

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
  rareFlash: 0,
  rareFlashColor: '#ffffff',

  autoNextWaveAt: null,
  highScores: {
    bestScore: 0,
    highestWave: 1,
    bestCredits: 0,
    totalKillsBestRun: 0,
  },

  upgrades: {
    rapidFire: 0,
    overchargedRounds: 0,
    velocityRounds: 0,
    weaponSpreadUnlock: 0,
    weaponLaserUnlock: 0,
    weaponArcUnlock: 0,
    reinforcedHull: 0,
    rechargeShield: 0,
    shieldMatrix: 0,
    thrusterBoost: 0,
    magnetField: 0,
    salvageBonus: 0,
    emergencyRepair: 0,
    scatterTier1: 0,
    scatterTier2: 0,
    scatterTier3: 0,
    scatterWide: 0,
    scatterDense: 0,
    scatterVelocity: 0,
    scatterPierce: 0,

    droneBomber: 0,
    droneElectricity: 0,
    droneLaser: 0,
    deepCoreSalvage: 0,
    weaponTuning: 0,
    droneOverclock: 0,
    droneCooldown: 0,
  },
  currentWeaponSlot: 1,
  weaponUnlocks: {
    blaster: true,
    rapid: true,
    spread: false,
    laser: false,
    arc: false,
  },
  runBonuses: {
    damageMultiplier: 0,
    fireRateMultiplier: 0,
    critChance: 0,
    permanentWeaponBonus: 0,
    droneDamageMultiplier: 0,
    overchargeUntil: 0,
    fireRateUntil: 0,
    critUntil: 0,
    dronePowerUntil: 0,
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

function clampToArena(obj, padding = 0, bounce = 0) {
  const minX = (obj.radius || 0) + padding;
  const maxX = canvas.width - (obj.radius || 0) - padding;
  const minY = (obj.radius || 0) + padding;
  const maxY = canvas.height - (obj.radius || 0) - padding;

  if (obj.x < minX) {
    obj.x = minX;
    if (obj.vx !== undefined) obj.vx = Math.abs(obj.vx || 0) * bounce;
  } else if (obj.x > maxX) {
    obj.x = maxX;
    if (obj.vx !== undefined) obj.vx = -Math.abs(obj.vx || 0) * bounce;
  }
  if (obj.y < minY) {
    obj.y = minY;
    if (obj.vy !== undefined) obj.vy = Math.abs(obj.vy || 0) * bounce;
  } else if (obj.y > maxY) {
    obj.y = maxY;
    if (obj.vy !== undefined) obj.vy = -Math.abs(obj.vy || 0) * bounce;
  }
}

function isOutsideDespawnMargin(obj, margin = PROJECTILE_DESPAWN_MARGIN) {
  return obj.x < -margin || obj.x > canvas.width + margin || obj.y < -margin || obj.y > canvas.height + margin;
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
  if (state.particles.length >= MAX_ACTIVE_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_ACTIVE_PARTICLES + 1);
  }
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

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.highScores = { ...state.highScores, ...parsed };
  } catch (_err) {
    // Ignore localStorage failures gracefully.
  }
}

function saveHighScores() {
  try {
    localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(state.highScores));
  } catch (_err) {
    // Ignore localStorage failures gracefully.
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
  document.documentElement.style.setProperty('--shop-card-min-height', `${SHOP_CARD_MIN_HEIGHT}px`);
  document.documentElement.style.setProperty('--shop-card-padding-y', `${SHOP_CARD_PADDING_Y}px`);
  document.documentElement.style.setProperty('--shop-card-line-gap', `${SHOP_CARD_LINE_GAP}px`);
  document.documentElement.style.setProperty('--shop-title-font-size', `${SHOP_TITLE_FONT_SIZE}px`);
  document.documentElement.style.setProperty('--shop-meta-font-size', `${SHOP_META_FONT_SIZE}px`);
  document.documentElement.style.setProperty('--settings-max-visible-rows', SETTINGS_MAX_VISIBLE_ROWS);
  document.documentElement.style.setProperty('--settings-row-height', `${SETTINGS_ROW_HEIGHT}px`);
  document.documentElement.style.setProperty('--settings-panel-height', `${SETTINGS_PANEL_HEIGHT}px`);
  document.documentElement.style.setProperty('--settings-footer-height', `${SETTINGS_FOOTER_HEIGHT}px`);

  audio.applySettings();
  updateBuildInfo();
  buildStars();
}

function updateBuildInfo() {
  if (!state.settings.showVersionInfo) {
    buildInfoEl.textContent = '';
    return;
  }
  buildInfoEl.textContent = `${GAME_VERSION} | ${BUILD_TIME}`;
}

function addPickupLabel(text, x, y, color = '#eafff5', emphasis = 'normal') {
  if (state.pickupLabels.length >= MAX_ACTIVE_FLOATING_TEXTS) state.pickupLabels.shift();
  state.pickupLabels.push({
    text,
    x,
    y,
    color,
    emphasis,
    vy: -0.44,
    life: 900,
    maxLife: 900,
  });
}

// -------------------------------------------------
// Stat helpers
// -------------------------------------------------
function fireDelay() {
  const weapon = activeWeaponDef();
  const base = Math.max(55, weapon.fireDelayMs - state.upgrades.rapidFire * 8);
  const boost = 1 + state.runBonuses.fireRateMultiplier;
  return base / boost;
}
function thrustPower() {
  return SETTINGS.thrustPower + state.upgrades.thrusterBoost * 0.03;
}
function topSpeed() {
  return SETTINGS.baseMaxSpeed + state.upgrades.thrusterBoost * 0.5;
}
function pickupRadius() {
  return PICKUP_SETTINGS.moneyMagnetBaseRadius + state.upgrades.magnetField * PICKUP_SETTINGS.moneyMagnetRadiusPerTier;
}
function pickupPullStrength() {
  return PICKUP_SETTINGS.moneyAttractionBase + state.upgrades.magnetField * PICKUP_SETTINGS.moneyAttractionPerTier;
}
function salvageMultiplier() {
  return 1 + state.upgrades.salvageBonus * 0.18 + state.upgrades.deepCoreSalvage * 0.08;
}
function waveScale(wave = state.wave) {
  const w = Math.max(1, wave);
  return {
    hp: 1 + (w - 1) * ENDLESS_SCALING.hpPerWave,
    speed: 1 + (w - 1) * (ENDLESS_SCALING.speedPerWave + SPEED_SCALING_PER_WAVE),
    projectile: 1 + (w - 1) * ENDLESS_SCALING.projectileSpeedPerWave,
    fireRate: 1 + (w - 1) * (ENDLESS_SCALING.fireRatePerWave + AGGRESSION_SCALING_PER_WAVE * 0.45),
    count: 1 + (w - 1) * ENDLESS_SCALING.countPerWave,
    aggression: 1 + (w - 1) * AGGRESSION_SCALING_PER_WAVE,
    eliteChance: clamp(ENDLESS_SCALING.eliteBaseChance + (w - 1) * (ENDLESS_SCALING.eliteChancePerWave + ELITE_CHANCE_PER_WAVE), 0, 0.45),
  };
}
function weaponDamageMultiplier() {
  return 1
    + state.upgrades.overchargedRounds * 0.16
    + state.upgrades.weaponTuning * 0.08
    + state.runBonuses.damageMultiplier
    + state.runBonuses.permanentWeaponBonus;
}
function critMultiplier() {
  return state.runBonuses.critChance > 0 && Math.random() < state.runBonuses.critChance ? 1.75 : 1;
}
function weaponProjectileSpeed() {
  return activeWeaponDef().bulletSpeed + state.upgrades.velocityRounds * 0.9;
}
function activeWeaponId() {
  return WEAPON_SLOTS[state.currentWeaponSlot - 1] || 'blaster';
}
function activeWeaponDef() {
  return WEAPON_DEFS[activeWeaponId()];
}
function weaponName() {
  const id = activeWeaponId();
  const base = WEAPON_DEFS[id].label;
  return state.weaponUnlocks[id] ? base : `${base} (Locked)`;
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
  const scale = waveScale(wave);
  const angle = rand(0, Math.PI * 2);

  let vx = 0;
  let vy = 0;
  if (typeId === 'driftRock' || typeId === 'splitterCore') {
    vx = Math.cos(angle) * def.speed * scale.speed;
    vy = Math.sin(angle) * def.speed * scale.speed;
  }

  const elite = Math.random() < scale.eliteChance;
  const eliteHpMult = elite ? 1.6 : 1;
  const eliteSpeedMult = elite ? 1.12 : 1;

  return {
    typeId,
    x,
    y,
    vx: vx * eliteSpeedMult,
    vy: vy * eliteSpeedMult,
    angle,
    spin: rand(-0.02, 0.02),
    radius: def.radius,
    hp: Math.ceil(def.hp * scale.hp * eliteHpMult),
    maxHp: Math.ceil(def.hp * scale.hp * eliteHpMult),
    scoreValue: Math.round(def.score * (elite ? 1.6 : 1)),
    creditValue: Math.round(def.credits * (1 + (wave - 1) * 0.08) * (elite ? 1.55 : 1)),
    shootCooldown: rand(900, 1550) / scale.fireRate / (elite ? 1.1 : 1),
    lastShotAt: 0,
    elite,
    burstAt: performance.now() + rand(1800, 4200),
  };
}

function createPlayerBullet(offsetAngle = 0, weaponId = activeWeaponId()) {
  const weapon = WEAPON_DEFS[weaponId];
  const ang = state.player.angle + offsetAngle;
  const baseDamage = weapon.bulletDamage * weaponDamageMultiplier() * critMultiplier();
  return {
    x: state.player.x + Math.cos(ang) * state.player.radius,
    y: state.player.y + Math.sin(ang) * state.player.radius,
    vx: Math.cos(ang) * weaponProjectileSpeed() + state.player.vx * 0.15,
    vy: Math.sin(ang) * weaponProjectileSpeed() + state.player.vy * 0.15,
    radius: weaponId === 'laser' ? 2 : 2.8,
    life: 1200,
    damage: baseDamage,
    trail: [],
    weaponId,
    pierce: weapon.pierce || 0,
    splashRadius: weapon.splashRadius || 0,
  };
}

function createEnemyBullet(enemy, angleToPlayer) {
  if (state.enemyBullets.length >= MAX_ACTIVE_ENEMY_PROJECTILES) return null;
  const scale = waveScale();
  const speed = (3.4 + state.wave * 0.08) * scale.projectile * (enemy.elite ? 1.1 : 1);
  return {
    x: enemy.x,
    y: enemy.y,
    vx: Math.cos(angleToPlayer) * speed,
    vy: Math.sin(angleToPlayer) * speed,
    radius: 3.6,
    damage: (12 + state.wave) * (enemy.elite ? 1.12 : 1),
    life: 2200,
  };
}

function spawnCreditPickup(x, y, value) {
  if (state.pickups.length >= MAX_ACTIVE_PICKUPS) return;
  const scaled = Math.round(value * rand(PICKUP_SETTINGS.moneyOrbValueMinScale, PICKUP_SETTINGS.moneyOrbValueMaxScale) * salvageMultiplier());
  state.pickups.push({
    kind: 'money',
    x,
    y,
    vx: rand(-0.5, 0.5),
    vy: rand(-0.45, 0.45),
    radius: 5.2,
    value: Math.max(1, scaled),
    life: PICKUP_SETTINGS.moneyOrbLifetimeMs,
    bobTime: rand(0, Math.PI * 2),
  });
}

function spawnRareDrop(x, y, enemyTypeId) {
  if (state.rareDrops.length >= MAX_ACTIVE_PICKUPS) return;
  let chance = RARE_DROP_CHANCE.base;
  if (enemyTypeId === 'bulwark') chance += RARE_DROP_CHANCE.bulwarkBonus;
  if (enemyTypeId === 'splitterCore') chance += RARE_DROP_CHANCE.splitterBonus;
  if (enemyTypeId === 'pulseTurret') chance += RARE_DROP_CHANCE.turretBonus;
  const lifeBoost = enemyTypeId === 'bulwark' || enemyTypeId === 'pulseTurret' ? 1.8 : 1;
  if (Math.random() < RARE_FEEDBACK.extraLifeDropChance * lifeBoost) {
    state.rareDrops.push({
      id: 'extraLife',
      x,
      y,
      vx: rand(-0.3, 0.3),
      vy: rand(-0.3, 0.3),
      radius: 9,
      life: PICKUP_SETTINGS.rareDropLifetimeMs,
      color: '#ffe58a',
      label: 'EXTRA LIFE +1',
    });
    return;
  }
  if (Math.random() > chance) return;

  const totalWeight = RARE_DROP_DEFS.reduce((sum, d) => sum + d.chanceWeight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = RARE_DROP_DEFS[0];
  for (const def of RARE_DROP_DEFS) {
    roll -= def.chanceWeight;
    if (roll <= 0) { chosen = def; break; }
  }

  state.rareDrops.push({
    id: chosen.id,
    x,
    y,
    vx: rand(-0.35, 0.35),
    vy: rand(-0.35, 0.35),
    radius: 7.4,
    life: PICKUP_SETTINGS.rareDropLifetimeMs,
    color: chosen.color,
    label: chosen.name,
  });
}

function unlockRandomWeapon() {
  const locked = WEAPON_SLOTS.filter((id) => !state.weaponUnlocks[id]);
  if (locked.length === 0) {
    state.credits += 45;
    addPickupLabel('+45 bonus credits', state.player.x, state.player.y - 20, '#9effa7', 'rare');
    return;
  }
  const pick = locked[Math.floor(rand(0, locked.length))];
  state.weaponUnlocks[pick] = true;
  addPickupLabel(`Unlocked ${WEAPON_DEFS[pick].label}`, state.player.x, state.player.y - 20, '#f8d7ff', 'rare');
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
  const droneMult = 1 + state.upgrades.droneOverclock * 0.12 + state.runBonuses.droneDamageMultiplier;
  const cooldownMult = Math.max(0.45, 1 - state.upgrades.droneCooldown * 0.04);
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
            damage: SETTINGS.bomberDamage * droneMult,
            aoe: SETTINGS.bomberAoeRadius,
          });
          drone.cooldown = SETTINGS.bomberCooldownMs * cooldownMult;
        }
      }
    }

    // Electricity Drone: close-range chain arcs
    if (drone.type === 'electricity') {
      if (drone.cooldown <= 0) {
        const primary = nearestEnemyTo(drone, SETTINGS.electricityRange);
        if (primary) {
          applyDamageToEnemyRef(primary, SETTINGS.electricityDamage * droneMult);
          state.arcEffects.push({ x1: drone.x, y1: drone.y, x2: primary.x, y2: primary.y, life: 120 });

          // Optional chain: up to 2 nearby enemies.
          const candidates = state.enemies.filter((e) => e !== primary && distance(primary, e) <= SETTINGS.electricityChainRange);
          for (let i = 0; i < Math.min(2, candidates.length); i++) {
            const chainTarget = candidates[i];
            applyDamageToEnemyRef(chainTarget, SETTINGS.electricityDamage * 0.7 * droneMult);
            state.arcEffects.push({ x1: primary.x, y1: primary.y, x2: chainTarget.x, y2: chainTarget.y, life: 120 });
          }

          drone.cooldown = SETTINGS.electricityCooldownMs * cooldownMult;
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
        const dpsDamage = SETTINGS.laserDps * droneMult * (dtMs / 1000);
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
    if (isOutsideDespawnMargin(bomb, PROJECTILE_DESPAWN_MARGIN)) {
      state.bombs.splice(i, 1);
      continue;
    }
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
  state.rareDrops = [];
  state.pickupLabels = [];
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
  state.rareFlash = 0;
  state.rareFlashColor = '#ffffff';
  state.autoNextWaveAt = null;
  state.currentWeaponSlot = 1;
  state.weaponUnlocks = {
    blaster: true,
    rapid: true,
    spread: false,
    laser: false,
    arc: false,
  };
  state.runBonuses = {
    damageMultiplier: 0,
    fireRateMultiplier: 0,
    critChance: 0,
    permanentWeaponBonus: 0,
    droneDamageMultiplier: 0,
    overchargeUntil: 0,
    fireRateUntil: 0,
    critUntil: 0,
    dronePowerUntil: 0,
  };

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
  state.highScores.bestScore = Math.max(state.highScores.bestScore, Math.floor(state.score));
  state.highScores.highestWave = Math.max(state.highScores.highestWave, state.wave);
  state.highScores.bestCredits = Math.max(state.highScores.bestCredits, Math.floor(state.totalCreditsEarned));
  state.highScores.totalKillsBestRun = Math.max(state.highScores.totalKillsBestRun, state.totalKills);
  saveHighScores();
  audio.play('game_over');
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
  state.rareDrops = [];
  state.pickupLabels = [];
  state.autoNextWaveAt = null;
  state.player.invincibleUntil = performance.now() + PLAYER_SPAWN_INVULN_DURATION;

  spawnWave(state.wave);
  shopOverlay.classList.add('hidden');
  updateHud();
}

// -------------------------------------------------
// Menus
// -------------------------------------------------
function setMenu(title, text, buttons, options = {}) {
  menuTitle.textContent = title;
  menuText.textContent = text;
  menuButtons.innerHTML = '';
  menuFooterButtons.innerHTML = '';

  const createMenuButton = (btn, parent) => {
    const b = document.createElement('button');
    b.className = 'menu-btn';
    b.textContent = btn.label;
    b.addEventListener('mouseenter', () => {
      if (audio.canPlay('ui_hover', AUDIO_LIMITS.uiHoverMinGapMs)) audio.play('ui_hover');
    });
    b.addEventListener('click', () => {
      audio.play('ui_click');
      btn.onClick();
    });
    parent.appendChild(b);
  };

  buttons.forEach((btn) => createMenuButton(btn, menuButtons));

  (options.footerButtons || []).forEach((btn) => createMenuButton(btn, menuFooterButtons));

  menuCard.classList.toggle('settings-layout', Boolean(options.settingsLayout));
  if (options.footerButtons && options.footerButtons.length) menuFooter.classList.remove('hidden');
  else menuFooter.classList.add('hidden');
  menuContent.scrollTop = 0;

  menuOverlay.classList.remove('hidden');
  shopOverlay.classList.add('hidden');
}

function showMainMenu() {
  state.gameState = GAME_STATE.MAIN_MENU;
  setMenu(
    'NEON RIFT ARENA',
    `Offline neon survival prototype. Defeat waves, buy upgrades, unlock weapons, and deploy drones.
Best Score: ${state.highScores.bestScore} | Best Wave: ${state.highScores.highestWave} | Best Credits: ${state.highScores.bestCredits} | Best Kills: ${state.highScores.totalKillsBestRun}`,
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
    'Move with WASD (or arrows). Space/LMB fires your active weapon. Switch weapons with 1-5. Rare drops grant temporary and permanent run boosts.',
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
  addToggle('Classic Physics Mode', 'classicPhysicsMode');
  addToggle('Show Version Info', 'showVersionInfo');
  addToggle('Master Sound', 'soundEnabled');
  addCycle('SFX Volume', 'sfxVolume', [0, 0.25, 0.5, 0.75, 1]);
  addToggle('Music', 'musicEnabled');
  addCycle('Music Volume', 'musicVolume', [0, 0.2, 0.34, 0.5, 0.7]);

  return buttons;
}

function settingsFooterButtons() {
  return [
    {
      label: state.previousMenuState === GAME_STATE.PAUSED ? 'Back to Pause Menu' : 'Back to Main Menu',
      onClick: () => {
        if (state.previousMenuState === GAME_STATE.PAUSED) showPauseMenu();
        else showMainMenu();
      },
    },
  ];
}

function showSettingsMenu() {
  state.gameState = GAME_STATE.SETTINGS_MENU;
  setMenu(
    'SETTINGS',
    'Click an option to toggle/cycle values. Saved locally for next launch.',
    settingOptionButtons(),
    { settingsLayout: true, footerButtons: settingsFooterButtons() },
  );
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
    `Wave ${state.wave} | Score ${state.score} | Credits ${state.totalCreditsEarned} | Kills ${state.totalKills} | Purchases ${state.upgradesPurchased}
Best Score ${state.highScores.bestScore} | Best Wave ${state.highScores.highestWave}`,
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
  const scale = waveScale(wave);
  const complexity = 1 + Math.floor(Math.max(0, wave - 4) * MIXED_WAVE_COMPLEXITY_SCALING);
  const countScale = scale.count * (1 + complexity * 0.08);

  const driftCount = Math.floor((3 + wave * 0.9) * countScale);
  const dartCount = Math.max(0, Math.floor((wave - 1) * 0.85 * countScale));
  const bulwarkCount = Math.max(0, Math.floor((wave - 2) * 0.35 * (0.8 + complexity * 0.15)));
  const splitterCount = Math.max(0, Math.floor((wave - 2) * 0.45 * (0.85 + complexity * 0.12)));
  const turretCount = Math.max(0, Math.floor((wave - 3) * 0.55 * (0.8 + complexity * 0.15)));

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

  if (state.enemies.length > MAX_ACTIVE_ENEMIES) {
    state.enemies.length = MAX_ACTIVE_ENEMIES;
  }
}

// -------------------------------------------------
// Core update systems
// -------------------------------------------------
function shootPlayer() {
  const weaponId = activeWeaponId();
  if (!state.weaponUnlocks[weaponId]) return;

  const now = performance.now();
  if (now - state.lastShotAt < fireDelay()) return;

  const weapon = activeWeaponDef();
  let bulletsPerShot = weapon.bulletsPerShot;
  let spreadStep = weapon.spreadStep;
  let extraPierce = 0;

  if (weaponId === 'spread') {
    const damageTier = state.upgrades.scatterTier1 + state.upgrades.scatterTier2 + state.upgrades.scatterTier3;
    bulletsPerShot += Math.min(SCATTER_TUNING.maxExtraProjectiles, state.upgrades.scatterDense);
    spreadStep += state.upgrades.scatterWide * SCATTER_TUNING.wideSpreadStep;
    spreadStep = Math.max(0.06, spreadStep - state.upgrades.scatterDense * SCATTER_TUNING.denseSpreadStep);
    extraPierce = state.upgrades.scatterPierce * SCATTER_TUNING.piercePerTier;
  }

  if (bulletsPerShot <= 1) {
    state.bullets.push(createPlayerBullet(0, weaponId));
  } else {
    const totalArc = spreadStep * (bulletsPerShot - 1);
    for (let i = 0; i < bulletsPerShot; i++) {
      const offset = -totalArc / 2 + i * spreadStep;
      const pellet = createPlayerBullet(offset, weaponId);
      pellet.pierce += extraPierce;
      pellet.vx *= 1 + state.upgrades.scatterVelocity * (SCATTER_TUNING.pelletVelocityBonus * 0.05);
      pellet.vy *= 1 + state.upgrades.scatterVelocity * (SCATTER_TUNING.pelletVelocityBonus * 0.05);
      pellet.damage *= 1 + (state.upgrades.scatterTier1 + state.upgrades.scatterTier2 + state.upgrades.scatterTier3) * SCATTER_TUNING.tierDamageBonus;
      state.bullets.push(pellet);
    }
  }

  state.lastShotAt = now;
  if (audio.canPlay('weapon_fire', AUDIO_LIMITS.weaponFireMinGapMs)) {
    audio.play(`weapon_${weaponId}`);
  }
}

function updatePlayer(dtMs, now) {
  const p = state.player;

  let desiredAngle = p.angle;
  if (state.keys.ArrowLeft || state.keys.a || state.keys.A) desiredAngle -= SETTINGS.rotationSpeed;
  if (state.keys.ArrowRight || state.keys.d || state.keys.D) desiredAngle += SETTINGS.rotationSpeed;

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
  const thrusting = state.keys.ArrowUp || state.keys.w || state.keys.W || thrustingByMouse;
  const braking = state.keys.s || state.keys.S || state.keys.ArrowDown;

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

  if (state.settings.classicPhysicsMode) {
    p.vx *= SETTINGS.friction;
    p.vy *= SETTINGS.friction;
    if (braking) {
      p.vx *= 0.93;
      p.vy *= 0.93;
    }
  } else {
    const assistedDamping = braking
      ? PLAYER_BRAKE_DAMPING
      : thrusting
        ? 0.985
        : PLAYER_DAMPING;
    p.vx *= assistedDamping;
    p.vy *= assistedDamping;
    if (Math.abs(p.vx) < PLAYER_MIN_VELOCITY) p.vx = 0;
    if (Math.abs(p.vy) < PLAYER_MIN_VELOCITY) p.vy = 0;
  }
  p.x += p.vx;
  p.y += p.vy;
  clampToArena(p, PLAYER_BOUNDARY_PADDING, 0.2);

  if (state.settings.holdToFire && (state.mouse.leftDown || state.keys[' '])) {
    shootPlayer();
  }

  if (p.maxShield > 0 && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + p.shieldRegen * (dtMs / 1000));
  }

  if (p.shield > 0 && Math.random() < 0.08 * graphicsLevelFactor()) {
    addParticle(p.x, p.y, NEON.cyan, 0.1, 0.9, 120, 1, 2);
  }
}

function enemyEdgeAvoidance(enemy) {
  let fx = 0;
  let fy = 0;
  const left = enemy.x - enemy.radius;
  const right = canvas.width - (enemy.x + enemy.radius);
  const top = enemy.y - enemy.radius;
  const bottom = canvas.height - (enemy.y + enemy.radius);

  if (left < ENEMY_EDGE_AVOID_RADIUS) fx += (1 - left / ENEMY_EDGE_AVOID_RADIUS) * ENEMY_EDGE_AVOID_FORCE;
  if (right < ENEMY_EDGE_AVOID_RADIUS) fx -= (1 - right / ENEMY_EDGE_AVOID_RADIUS) * ENEMY_EDGE_AVOID_FORCE;
  if (top < ENEMY_EDGE_AVOID_RADIUS) fy += (1 - top / ENEMY_EDGE_AVOID_RADIUS) * ENEMY_EDGE_AVOID_FORCE;
  if (bottom < ENEMY_EDGE_AVOID_RADIUS) fy -= (1 - bottom / ENEMY_EDGE_AVOID_RADIUS) * ENEMY_EDGE_AVOID_FORCE;

  // Slight center bias to reduce passive edge hugging.
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  fx += Math.sign(cx - enemy.x) * ENEMY_CENTER_BIAS;
  fy += Math.sign(cy - enemy.y) * ENEMY_CENTER_BIAS;
  return { fx, fy };
}

function enemySeparation(idx) {
  const me = state.enemies[idx];
  let fx = 0;
  let fy = 0;
  let nearCount = 0;

  for (let i = 0; i < state.enemies.length; i++) {
    if (i === idx) continue;
    const other = state.enemies[i];
    const dx = me.x - other.x;
    const dy = me.y - other.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 0 || distSq > ENEMY_SEPARATION_RADIUS * ENEMY_SEPARATION_RADIUS) continue;
    const dist = Math.sqrt(distSq);
    const push = (1 - dist / ENEMY_SEPARATION_RADIUS) * ENEMY_SEPARATION_FORCE;
    fx += (dx / dist) * push;
    fy += (dy / dist) * push;
    nearCount += 1;
    if (nearCount >= 8) break; // cheap cap for large waves
  }
  return { fx, fy };
}

function updateEnemies(now) {
  const scale = waveScale();
  for (let idx = 0; idx < state.enemies.length; idx++) {
    const e = state.enemies[idx];
    const dx = state.player.x - e.x;
    const dy = state.player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const edge = enemyEdgeAvoidance(e);
    const sep = enemySeparation(idx);
    const aggression = scale.aggression * (e.elite ? 1.12 : 1);

    if (e.typeId === 'driftRock' || e.typeId === 'splitterCore') {
      // Previously these could drift into passive edge loops. Add active steering.
      e.vx += nx * 0.02 * aggression + edge.fx + sep.fx;
      e.vy += ny * 0.02 * aggression + edge.fy + sep.fy;
      const maxDriftSpeed = ENEMY_TYPES[e.typeId].speed * 1.4 * scale.speed;
      const vMag = Math.hypot(e.vx, e.vy) || 1;
      if (vMag > maxDriftSpeed) {
        e.vx = (e.vx / vMag) * maxDriftSpeed;
        e.vy = (e.vy / vMag) * maxDriftSpeed;
      }
      e.x += e.vx;
      e.y += e.vy;
      e.angle += e.spin;
      clampToArena(e, ENEMY_BOUNDARY_PADDING, 0.25);
      continue;
    }

    if (e.typeId === 'dartScout') {
      const sp = ENEMY_TYPES.dartScout.speed * scale.speed * (e.elite ? 1.12 : 1);
      e.vx = nx * sp + edge.fx * 1.2 + sep.fx * 1.35;
      e.vy = ny * sp + edge.fy * 1.2 + sep.fy * 1.35;
      e.x += e.vx;
      e.y += e.vy;
      clampToArena(e, ENEMY_BOUNDARY_PADDING, 0.25);
      continue;
    }

    if (e.typeId === 'bulwark') {
      // Slow pressure unit with periodic charge burst and stronger inward pressure.
      const burst = now >= e.burstAt;
      if (burst) e.burstAt = now + rand(2400, 4300);
      const burstMult = burst ? 1.85 : 1;
      const sp = ENEMY_TYPES.bulwark.speed * scale.speed * aggression * 0.9 * (e.elite ? 1.08 : 1) * burstMult;
      e.vx = nx * sp + edge.fx * 2.1 + sep.fx * 0.55;
      e.vy = ny * sp + edge.fy * 2.1 + sep.fy * 0.55;
      e.x += e.vx;
      e.y += e.vy;
      clampToArena(e, ENEMY_BOUNDARY_PADDING, 0.25);
      continue;
    }

    if (e.typeId === 'pulseTurret') {
      const desired = 250;
      const sp = ENEMY_TYPES.pulseTurret.speed * scale.speed * 0.72 * (e.elite ? 1.1 : 1);
      if (dist > desired) {
        e.vx = nx * sp;
        e.vy = ny * sp;
      } else {
        // Late waves: flank harder around the player to punish center camping.
        const flank = 0.75 + Math.min(0.55, (state.wave - 1) * 0.014);
        e.vx = -ny * sp * flank;
        e.vy = nx * sp * flank;
      }
      e.vx += edge.fx * 1.45 + sep.fx;
      e.vy += edge.fy * 1.45 + sep.fy;
      e.x += e.vx;
      e.y += e.vy;
      clampToArena(e, ENEMY_BOUNDARY_PADDING, 0.2);

      if (now - e.lastShotAt > e.shootCooldown) {
        e.lastShotAt = now;
        const shot = createEnemyBullet(e, Math.atan2(dy, dx));
        if (shot) state.enemyBullets.push(shot);
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
    if (isOutsideDespawnMargin(b)) {
      state.bullets.splice(i, 1);
      continue;
    }
    b.life -= dtMs;
    if (b.life <= 0) state.bullets.splice(i, 1);
  }

  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (isOutsideDespawnMargin(b)) {
      state.enemyBullets.splice(i, 1);
      continue;
    }
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
    orb.bobTime += dtMs * 0.004;

    orb.x += orb.vx;
    orb.y += orb.vy;
    orb.vx *= 0.99;
    orb.vy *= 0.99;
    clampToArena(orb, 0, 0.1);

    const dx = p.x - orb.x;
    const dy = p.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < pullRadius) {
      const pull = pickupPullStrength();
      orb.vx += (dx / dist) * pull;
      orb.vy += (dy / dist) * pull;
    }

    if (dist < p.radius + orb.radius + 5) {
      state.credits += orb.value;
      state.totalCreditsEarned += orb.value;
      addParticle(orb.x, orb.y, NEON.green, 0.2, 1.4, 180, 1.2, 2.5);
      addPickupLabel(`+${orb.value}`, orb.x, orb.y, '#8dffb1');
      if (audio.canPlay('pickup_money', AUDIO_LIMITS.pickupMinGapMs)) audio.play('pickup_money', { pan: clamp((orb.x / canvas.width) * 2 - 1, -1, 1) });
      state.pickups.splice(i, 1);
      continue;
    }

    if (orb.life <= 0) state.pickups.splice(i, 1);
  }

  for (let i = state.rareDrops.length - 1; i >= 0; i--) {
    const drop = state.rareDrops[i];
    drop.life -= dtMs;
    drop.x += drop.vx;
    drop.y += drop.vy;
    drop.vx *= 0.988;
    drop.vy *= 0.988;
    clampToArena(drop, 0, 0.12);

    const dx = p.x - drop.x;
    const dy = p.y - drop.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < pullRadius * 0.88) {
      drop.vx += (dx / dist) * pickupPullStrength() * 0.75;
      drop.vy += (dy / dist) * pickupPullStrength() * 0.75;
    }

    if (dist < p.radius + drop.radius + 4) {
      const def = RARE_DROP_DEFS.find((d) => d.id === drop.id);
      if (def) def.apply();
      addPickupLabel(drop.label, drop.x, drop.y, drop.color, 'rare');
      const isLife = drop.id === 'extraLife';
      addExplosion(drop.x, drop.y, drop.color, isLife ? 24 : 18, isLife ? 48 : 34);
      maybeShake(isLife ? 8 : 5);
      state.rareFlash = isLife ? 0.42 : 0.28;
      state.rareFlashColor = drop.color;
      audio.play(isLife ? 'pickup_life' : 'pickup_rare', { pan: clamp((drop.x / canvas.width) * 2 - 1, -1, 1) });
      state.rareDrops.splice(i, 1);
      continue;
    }

    if (drop.life <= 0) state.rareDrops.splice(i, 1);
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

  for (let i = state.pickupLabels.length - 1; i >= 0; i--) {
    const label = state.pickupLabels[i];
    label.life -= dtMs;
    label.y += label.vy;
    if (label.life <= 0) state.pickupLabels.splice(i, 1);
  }

  state.shake = Math.max(0, state.shake - dtMs * 0.035);
  state.rareFlash = Math.max(0, state.rareFlash - dtMs * 0.0024);
}

function updateRunBonuses(now) {
  if (state.runBonuses.overchargeUntil && now >= state.runBonuses.overchargeUntil) {
    state.runBonuses.damageMultiplier = 0;
    state.runBonuses.overchargeUntil = 0;
  }
  if (state.runBonuses.fireRateUntil && now >= state.runBonuses.fireRateUntil) {
    state.runBonuses.fireRateMultiplier = 0;
    state.runBonuses.fireRateUntil = 0;
  }
  if (state.runBonuses.critUntil && now >= state.runBonuses.critUntil) {
    state.runBonuses.critChance = 0;
    state.runBonuses.critUntil = 0;
  }
  if (state.runBonuses.dronePowerUntil && now >= state.runBonuses.dronePowerUntil) {
    state.runBonuses.droneDamageMultiplier = 0;
    state.runBonuses.dronePowerUntil = 0;
  }
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
    if (audio.canPlay('shield_hit', 40)) audio.play('shield_hit');
  }

  if (remaining > 0) {
    p.health -= remaining;
    state.damageTakenThisWave += remaining;
    addExplosion(p.x, p.y, NEON.red, 16, 32);
    maybeShake(7);
    if (audio.canPlay('player_hit', 60)) audio.play('player_hit');
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

  const credits = Math.round(enemy.creditValue * SETTINGS.killCreditMultiplier);
  spawnCreditPickup(enemy.x, enemy.y, credits);
  spawnRareDrop(enemy.x, enemy.y, enemy.typeId);

  const colorMap = {
    driftRock: '#9ebfff',
    dartScout: '#ffbe8c',
    bulwark: '#7ff7ff',
    splitterCore: '#ff8be6',
    pulseTurret: '#cc9fff',
  };

  addExplosion(enemy.x, enemy.y, colorMap[enemy.typeId], enemy.typeId === 'bulwark' ? 20 : 14, enemy.typeId === 'bulwark' ? 42 : 28);
  maybeShake(enemy.typeId === 'bulwark' ? 6 : 3.5);
  audio.play('enemy_destroy', { big: enemy.typeId === 'bulwark', pan: clamp((enemy.x / canvas.width) * 2 - 1, -1, 1) });

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
    let bulletConsumed = false;

    for (let e = state.enemies.length - 1; e >= 0; e--) {
      const enemy = state.enemies[e];
      if (!circlesHit(bullet, enemy)) continue;
      const wdef = WEAPON_DEFS[bullet.weaponId] || WEAPON_DEFS.blaster;

      enemy.hp -= bullet.damage;
      if (enemy.hp <= 0) killEnemy(e, enemy);
      else {
        addExplosion(enemy.x, enemy.y, wdef.impact, bullet.weaponId === 'rapid' ? 4 : 7, bullet.weaponId === 'arc' ? 26 : 18);
        if (audio.canPlay('enemy_hit', 22)) audio.play('enemy_hit', { pan: clamp((enemy.x / canvas.width) * 2 - 1, -1, 1) });
      }

      if (bullet.splashRadius > 0) {
        for (const other of state.enemies) {
          if (other === enemy) continue;
          const d = distance(enemy, other);
          if (d <= bullet.splashRadius) {
            applyDamageToEnemyRef(other, bullet.damage * (1 - d / bullet.splashRadius) * 0.65);
          }
        }
        addExplosion(enemy.x, enemy.y, '#8ac4ff', 14, bullet.splashRadius * 0.44);
        bulletConsumed = true;
      } else if (bullet.pierce > 0) {
        bullet.pierce -= 1;
        bullet.damage *= 0.94;
      } else {
        bulletConsumed = true;
      }

      if (bulletConsumed) {
        state.bullets.splice(b, 1);
        break;
      }
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

function cleanupEnemiesAndState(dtMs) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y) || e.hp <= 0 || !Number.isFinite(e.hp)) {
      state.enemies.splice(i, 1);
      continue;
    }

    const outside = e.x < -ENEMY_BOUNDARY_PADDING
      || e.x > canvas.width + ENEMY_BOUNDARY_PADDING
      || e.y < -ENEMY_BOUNDARY_PADDING
      || e.y > canvas.height + ENEMY_BOUNDARY_PADDING;

    if (outside) {
      e.outOfBoundsMs = (e.outOfBoundsMs || 0) + dtMs;
      if (e.outOfBoundsMs > ENEMY_OUT_OF_BOUNDS_TIMEOUT) {
        state.enemies.splice(i, 1);
      }
    } else {
      e.outOfBoundsMs = 0;
    }
  }
}

function livingEnemyCount() {
  let alive = 0;
  for (const e of state.enemies) {
    if (e && Number.isFinite(e.hp) && e.hp > 0) alive += 1;
  }
  return alive;
}

function finishWave() {
  const seconds = (performance.now() - state.waveStartTime) / 1000;
  const waveBonus = SETTINGS.waveClearRewardBase + state.wave * SETTINGS.waveClearRewardPerWave;
  const fastBonus = seconds <= SETTINGS.fastClearTargetSeconds ? SETTINGS.fastClearBonus : 0;
  const noDamageBonus = state.damageTakenThisWave <= 0 ? SETTINGS.noDamageBonus : 0;

  const total = waveBonus + fastBonus + noDamageBonus;
  state.credits += total;
  state.totalCreditsEarned += total;
  audio.play('wave_clear');

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
  if (def.isVisible && !def.isVisible()) return false;
  return true;
}

function buyUpgrade(id) {
  if (state.gameState !== GAME_STATE.SHOP) return;

  const def = UPGRADE_DEFS.find((u) => u.id === id);
  if (!def || !canShowUpgrade(def)) return;
  if (def.isDisabled && def.isDisabled()) return;

  if (def.maxLevel !== null && upgradeLevel(def.id) >= def.maxLevel) return;
  const cost = upgradeCost(def);
  if (state.credits < cost) return;

  state.credits -= cost;
  audio.play('shop_buy');
  const beforeLevel = upgradeLevel(id);
  def.apply();
  state.upgradesPurchased += 1;
  if (upgradeLevel(id) === beforeLevel) {
    state.upgrades[id] = def.maxLevel === null
      ? state.upgrades[id] + 1
      : Math.min(def.maxLevel, state.upgrades[id] + 1);
  }

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
  const order = ['utility', 'unlock', 'capped', 'weapon', 'infinite'];
  const visible = UPGRADE_DEFS.filter(canShowUpgrade);
  order.forEach((category) => {
    const group = visible.filter((u) => (u.category || 'capped') === category);
    if (group.length === 0) return;

    const heading = document.createElement('div');
    heading.className = 'shop-group-heading';
    heading.textContent = category === 'utility'
      ? 'Utility Purchases'
      : category === 'unlock'
        ? 'One-Time Unlocks'
        : category === 'capped'
          ? 'Capped Upgrades'
          : category === 'weapon'
            ? 'Spread Blaster Upgrades'
            : 'Infinite Scaling Upgrades';
    shopButtonsEl.appendChild(heading);

    group.forEach((def) => {
    const lvl = upgradeLevel(def.id);
    const cost = upgradeCost(def);
    const capped = def.maxLevel !== null && lvl >= def.maxLevel;
    const disabledByState = def.isDisabled ? def.isDisabled() : false;

    const btn = document.createElement('button');
    btn.className = 'shop-btn';
    btn.disabled = capped || disabledByState || state.credits < cost;

    btn.innerHTML = `
      <div class="shop-btn-content">
        <div class="shop-title">${def.name}</div>
        <div class="shop-desc">${def.desc}</div>
        <div class="cost">Cost: ${capped ? 'MAX' : disabledByState ? 'N/A (full)' : cost}</div>
        <div class="owned shop-tier">Tier: ${def.maxLevel === null ? `${lvl} (repeatable)` : `${lvl}/${def.maxLevel}`}</div>
        <div class="owned shop-type">Type: ${def.category || 'core'}</div>
      </div>
    `;

    btn.addEventListener('mouseenter', () => {
      if (audio.canPlay('ui_hover', AUDIO_LIMITS.uiHoverMinGapMs)) audio.play('ui_hover');
    });
    btn.addEventListener('click', () => buyUpgrade(def.id));
    shopButtonsEl.appendChild(btn);
  });
  });
}

// -------------------------------------------------
// UI updates
// -------------------------------------------------
function renderUpgradeList() {
  const lines = UPGRADE_DEFS
    .filter((u) => upgradeLevel(u.id) > 0)
    .map((u) => `${u.name}: ${u.maxLevel === null ? `${upgradeLevel(u.id)} (repeatable)` : `${upgradeLevel(u.id)}/${u.maxLevel}`}`);

  const bonusLines = [];
  if (state.runBonuses.damageMultiplier > 0) bonusLines.push(`Temp Overcharge: +${Math.round(state.runBonuses.damageMultiplier * 100)}% dmg`);
  if (state.runBonuses.fireRateMultiplier > 0) bonusLines.push(`Fire Rate Boost: +${Math.round(state.runBonuses.fireRateMultiplier * 100)}%`);
  if (state.runBonuses.critChance > 0) bonusLines.push(`Critical Focus: ${Math.round(state.runBonuses.critChance * 100)}% crit`);
  if (state.runBonuses.droneDamageMultiplier > 0) bonusLines.push(`Drone Enhancement: +${Math.round(state.runBonuses.droneDamageMultiplier * 100)}%`);
  if (state.runBonuses.permanentWeaponBonus > 0) bonusLines.push(`Weapon Core +: +${Math.round(state.runBonuses.permanentWeaponBonus * 100)}% permanent dmg`);

  const allLines = [...lines, ...bonusLines];

  upgradeListEl.innerHTML = allLines.length
    ? allLines.map((l) => `<li>${l}</li>`).join('')
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
  weaponSlotsEl.innerHTML = WEAPON_SLOTS.map((weaponId, idx) => {
    const slot = idx + 1;
    const locked = !state.weaponUnlocks[weaponId];
    const classes = slot === state.currentWeaponSlot ? 'slot-active' : '';
    const lockTxt = locked ? '🔒' : '';
    return `<span class="${classes}">${slot}:${WEAPON_DEFS[weaponId].label}${lockTxt}</span>`;
  }).join(' | ');
  dronesEl.textContent = droneLabelList();
  bestScoreEl.textContent = String(state.highScores.bestScore);
  bestWaveEl.textContent = String(state.highScores.highestWave);
}

// -------------------------------------------------
// Input
// -------------------------------------------------
function unlockAudioFromUserGesture() {
  audio.unlock();
}

window.addEventListener('pointerdown', unlockAudioFromUserGesture, { once: true });
window.addEventListener('keydown', unlockAudioFromUserGesture, { once: true });
window.addEventListener('touchstart', unlockAudioFromUserGesture, { once: true, passive: true });

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) event.preventDefault();
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

  if (state.gameState === GAME_STATE.PLAYING && ['1', '2', '3', '4', '5'].includes(event.key)) {
    const slot = Number(event.key);
    const weaponId = WEAPON_SLOTS[slot - 1];
    state.currentWeaponSlot = slot;
    if (!state.weaponUnlocks[weaponId]) {
      addPickupLabel(`${WEAPON_DEFS[weaponId].label} locked`, state.player.x, state.player.y - 16, '#ffb0d1');
    }
    updateHud();
    return;
  }

  if (state.gameState === GAME_STATE.SHOP) {
    // number keys for first 10 core upgrades
    const mapping = {
      '1': 'rapidFire',
      '2': 'overchargedRounds',
      '3': 'velocityRounds',
      '4': 'weaponSpreadUnlock',
      '5': 'reinforcedHull',
      '6': 'shieldMatrix',
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
  audio.play('ui_click');
  if (state.gameState === GAME_STATE.SHOP) startNextWave();
});

// -------------------------------------------------
// Stars + rendering
// -------------------------------------------------
function buildStars() {
  state.stars = [];
  const countBase = state.settings.graphicsIntensity === 'low'
    ? SETTINGS.starDensityLow
    : state.settings.graphicsIntensity === 'medium'
      ? SETTINGS.starDensityMedium
      : SETTINGS.starDensityHigh;
  const count = Math.max(30, Math.round(countBase * STAR_DENSITY));

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

function drawRift(now) {
  if (!RIFT_ENABLED) return;

  const cx = RIFT_CENTER_X <= 1 ? canvas.width * RIFT_CENTER_X : RIFT_CENTER_X;
  const cy = RIFT_CENTER_Y <= 1 ? canvas.height * RIFT_CENTER_Y : RIFT_CENTER_Y;
  const pulse = 0.72 + 0.28 * Math.sin(now * RIFT_PULSE_SPEED);
  const shimmer = 0.5 + 0.5 * Math.sin(now * (RIFT_PULSE_SPEED * 2.1));
  const menuBoost = state.gameState === GAME_STATE.PLAYING ? 0.72 : 1.08;
  const baseOpacity = RIFT_OPACITY * menuBoost;
  const rx = 260 * RIFT_SCALE;
  const ry = 175 * RIFT_SCALE;

  // Large purple haze
  const outer = ctx.createRadialGradient(cx, cy, 30, cx, cy, rx * 1.7);
  outer.addColorStop(0, `rgba(161, 88, 255, ${0.34 * baseOpacity * RIFT_PURPLE_INTENSITY * pulse})`);
  outer.addColorStop(0.52, `rgba(99, 42, 166, ${0.19 * baseOpacity * RIFT_PURPLE_INTENSITY})`);
  outer.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Inner toxic core
  const inner = ctx.createRadialGradient(cx, cy, 12, cx, cy, rx * 0.74);
  inner.addColorStop(0, `rgba(156, 255, 110, ${0.35 * baseOpacity * RIFT_GREEN_INTENSITY * pulse})`);
  inner.addColorStop(0.5, `rgba(84, 230, 120, ${0.2 * baseOpacity * RIFT_GREEN_INTENSITY})`);
  inner.addColorStop(1, 'rgba(20,80,40,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Jagged dimensional tear ring
  const segments = 56;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(now * 0.00011) * 0.15);
  ctx.globalAlpha = clamp(baseOpacity, 0, 1);
  neonStroke(`rgba(191,108,255,${0.56 * RIFT_PURPLE_INTENSITY})`, 2.4, 22);
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const noise = Math.sin(t * 5 + now * 0.0012) * 16 + Math.sin(t * 9 - now * 0.0017) * 10;
    const x = Math.cos(t) * (rx + noise);
    const y = Math.sin(t) * (ry + noise * 0.68);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Toxic inner fracture lines
  neonStroke(`rgba(134,255,144,${0.5 * RIFT_GREEN_INTENSITY * shimmer})`, 1.6, 15);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + now * 0.00023;
    const len = rx * (0.33 + ((i % 3) * 0.14));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 13);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len * 0.64);
    ctx.stroke();
  }

  // Occasional shimmer ripple
  const ripple = (now * 0.0012) % 1;
  if (ripple < 0.14) {
    const rp = ripple / 0.14;
    neonStroke(`rgba(176,255,126,${0.26 * (1 - rp) * baseOpacity})`, 2.2, 12);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * (0.24 + rp * 0.8), ry * (0.2 + rp * 0.8), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
  if (state.keys.ArrowUp || state.keys.w || state.keys.W || thrustingByMouse) {
    neonStroke(NEON.yellow, 2, 14);
    ctx.beginPath();
    ctx.moveTo(-p.radius * 0.8, 0);
    ctx.lineTo(-p.radius - rand(10, 22), 0);
    ctx.stroke();
  }

  ctx.restore();

  const healthPct = clamp(p.health / Math.max(1, p.maxHealth), 0, 1);
  const shieldPct = clamp(p.shield / Math.max(1, p.maxShield || 1), 0, 1);
  const startAngle = -Math.PI / 2;

  // Background capacity arcs
  ctx.lineWidth = PLAYER_RING_WIDTH;
  ctx.globalAlpha = PLAYER_RING_ALPHA * 0.26;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RING_OUTER_RADIUS, startAngle, startAngle + Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RING_INNER_RADIUS, startAngle, startAngle + Math.PI * 2);
  ctx.stroke();

  // Health (green) inner ring
  ctx.globalAlpha = PLAYER_RING_ALPHA;
  ctx.strokeStyle = HEALTH_RING_COLOR;
  ctx.shadowColor = HEALTH_RING_COLOR;
  ctx.shadowBlur = 10 * glowScale();
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RING_INNER_RADIUS, startAngle, startAngle + Math.PI * 2 * healthPct);
  ctx.stroke();

  // Shield (blue) outer ring
  if (p.maxShield > 0 && shieldPct > 0) {
    ctx.globalAlpha = PLAYER_RING_ALPHA * (0.5 + shieldPct * 0.5);
    ctx.strokeStyle = SHIELD_RING_COLOR;
    ctx.shadowColor = SHIELD_RING_COLOR;
    ctx.shadowBlur = 12 * glowScale();
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RING_OUTER_RADIUS, startAngle, startAngle + Math.PI * 2 * shieldPct);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

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

    if (e.elite) {
      neonStroke('rgba(255, 229, 138, 0.8)', 1.6, 10);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.shadowBlur = 0;
}

function drawProjectiles() {
  for (const b of state.bullets) {
    const def = WEAPON_DEFS[b.weaponId] || WEAPON_DEFS.blaster;
    if (b.weaponId === 'laser') {
      ctx.strokeStyle = def.trail;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (b.trail.length > 0) {
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = def.trail;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    b.trail.forEach((t, idx) => {
      if (idx === 0) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y);
    });
    ctx.stroke();

    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = (14 + (b.weaponId === 'arc' ? 5 : 0)) * WEAPON_VISUAL_SCALE * glowScale();
    ctx.beginPath();
    const radiusScale = b.weaponId === 'rapid' ? 0.85 : b.weaponId === 'spread' ? 0.92 : b.weaponId === 'arc' ? 1.2 : 1;
    ctx.arc(b.x, b.y, (b.radius + 1.1) * radiusScale * WEAPON_VISUAL_SCALE, 0, Math.PI * 2);
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
    const pulse = 0.4 + 0.6 * Math.sin(now * 0.008 + orb.x * 0.03 + orb.bobTime);
    const size = orb.radius + pulse;
    const yOffset = Math.sin(orb.bobTime) * 1.6;

    ctx.fillStyle = NEON.green;
    ctx.shadowColor = NEON.green;
    ctx.shadowBlur = PICKUP_SETTINGS.moneyOrbGlowSize * glowScale();
    ctx.beginPath();
    ctx.arc(orb.x, orb.y + yOffset, size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const drop of state.rareDrops) {
    const blink = 0.72 + 0.28 * Math.sin(now * 0.012 + drop.x * 0.01);
    const size = drop.radius * blink;
    if (drop.id === 'extraLife') {
      ctx.fillStyle = '#ffe58a';
      ctx.shadowColor = '#ffe58a';
      ctx.shadowBlur = 22 * glowScale();
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, size * 0.8, size * 1.08, now * 0.003, 0, Math.PI * 2);
      ctx.fill();
      neonStroke('rgba(255,239,150,0.95)', 2.2, 12);
      ctx.beginPath();
      ctx.moveTo(drop.x - size * 0.35, drop.y);
      ctx.lineTo(drop.x + size * 0.35, drop.y);
      ctx.moveTo(drop.x, drop.y - size * 0.35);
      ctx.lineTo(drop.x, drop.y + size * 0.35);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(now * 0.0028);
      ctx.strokeStyle = drop.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = drop.color;
      ctx.shadowBlur = 16 * glowScale();
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
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

function renderPickupLabels() {
  const rect = canvas.getBoundingClientRect();
  pickupLabelsEl.innerHTML = state.pickupLabels.map((label) => {
    const px = (label.x / canvas.width) * rect.width;
    const py = (label.y / canvas.height) * rect.height;
    const alpha = clamp(label.life / label.maxLife, 0, 1);
    const size = label.emphasis === 'rare' ? RARE_FEEDBACK.rareTextSizePx : RARE_FEEDBACK.normalTextSizePx;
    const cls = label.emphasis === 'rare' ? 'pickup-label pickup-label-rare' : 'pickup-label';
    return `<div class="${cls}" style="left:${px}px;top:${py}px;color:${label.color};font-size:${size}px;opacity:${alpha.toFixed(2)};">${label.text}</div>`;
  }).join('');
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

function drawRareFlash() {
  if (state.rareFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = state.rareFlash;
  ctx.fillStyle = state.rareFlashColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function draw(now) {
  ctx.save();

  if (state.settings.screenShake && state.shake > 0.01) {
    ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
  }

  drawBackground(now);
  drawRift(now);
  drawStars(now);
  drawFx();
  drawEnemies(now);
  drawProjectiles();
  drawPickups(now);
  drawDrones();
  drawPlayer(now);
  drawCrosshair();
  drawWaveBanner();
  drawRareFlash();
  renderPickupLabels();

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
  updateRunBonuses(now);
  handleCollisions();
  cleanupEnemiesAndState(dtMs);
  updateFx(dtMs);

  if (livingEnemyCount() === 0) {
    finishWave();
  }

  updateHud();
  renderUpgradeList();
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
  loadHighScores();
  applySettingsToUI();

  state.player = createPlayer();
  updateHud();
  renderUpgradeList();
  showMainMenu();

  requestAnimationFrame(frame);
}

init();
