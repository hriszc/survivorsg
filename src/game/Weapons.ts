import type {
  Engine,
  SegmentDamagedPayload,
  SegmentDestroyedPayload,
  PlayerDamagedPayload,
} from './Engine';
import { distance, normalize } from './math';
import { Segment } from './Enemy';

const MAX_SKILL_LEVEL = 8;

type Camera = { x: number; y: number };

type SegmentRef = {
  snake: import('./Enemy').Snake;
  segment: Segment;
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

type BounceProjectile = Projectile & {
  bouncesLeft: number;
  lastHit?: Segment;
};

function findNearestSegment(
  engine: Engine,
  origin: { x: number; y: number },
  maxDist: number = Infinity,
  headsOnly: boolean = false,
  exclude?: Segment,
): SegmentRef | null {
  let nearest: SegmentRef | null = null;
  let minDist = maxDist;

  for (const snake of engine.snakes) {
    for (const segment of snake.segments) {
      if (exclude && segment === exclude) continue;
      if (headsOnly && !segment.isHead) continue;
      const dist = distance(origin, segment);
      if (dist < minDist) {
        minDist = dist;
        nearest = { snake, segment };
      }
    }
  }

  return nearest;
}

function forSegmentsInRadius(
  engine: Engine,
  center: { x: number; y: number },
  radius: number,
  cb: (ref: SegmentRef) => void,
) {
  for (const snake of engine.snakes) {
    for (const segment of [...snake.segments]) {
      if (distance(center, segment) <= radius + segment.radius) {
        cb({ snake, segment });
      }
    }
  }
}

function clampLevelUp(current: number, max: number): number {
  return Math.min(max, current + 1);
}

export interface Weapon {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  tags: string[];
  description: string;
  update(engine: Engine): void;
  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine): void;
  levelUp(): void;
  requires?(engine: Engine): boolean;
  onSegmentDamaged?(engine: Engine, payload: SegmentDamagedPayload): void;
  onSegmentDestroyed?(engine: Engine, payload: SegmentDestroyedPayload): void;
  onPlayerDamaged?(engine: Engine, payload: PlayerDamagedPayload): void;
}

export class MagicWand implements Weapon {
  id = 'magic-wand';
  name = 'Magic Wand';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'projectile'];

  cooldown = 60;
  timer = 0;
  damage = 10;
  projectiles: Projectile[] = [];

  get description() {
    return `Fires ${1 + Math.floor(this.level / 3)} projectile(s). Dmg: ${this.damage}`;
  }

  update(engine: Engine) {
    this.timer--;
    if (this.timer <= 0) {
      this.timer = engine.toEffectiveCooldown(this.cooldown);
      this.fire(engine);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.life--;

      let hit = false;
      for (const snake of engine.snakes) {
        for (const segment of snake.segments) {
          if (distance(projectile, segment) < segment.radius + 5) {
            engine.damageSegment(snake, segment, this.damage, this.id);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }

      if (hit || projectile.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  fire(engine: Engine) {
    const nearest = findNearestSegment(engine, engine.player, 420);
    if (!nearest) return;

    const numProjectiles = 1 + Math.floor(this.level / 3);
    for (let i = 0; i < numProjectiles; i++) {
      setTimeout(() => {
        if (engine.isGameOver || engine.isPaused) return;
        const currentNearest = findNearestSegment(engine, engine.player, 420);
        if (!currentNearest) return;

        const dir = normalize({
          x: currentNearest.segment.x - engine.player.x,
          y: currentNearest.segment.y - engine.player.y,
        });
        const speed = 8;

        this.projectiles.push({
          x: engine.player.x,
          y: engine.player.y,
          vx: dir.x * speed,
          vy: dir.y * speed,
          life: 100,
        });
      }, i * 120);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.fillStyle = '#60a5fa';
    for (const projectile of this.projectiles) {
      ctx.beginPath();
      ctx.arc(projectile.x - camera.x, projectile.y - camera.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.damage += 5;
    this.cooldown = Math.max(15, this.cooldown - 5);
  }
}

export class Garlic implements Weapon {
  id = 'garlic';
  name = 'Garlic';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'aoe'];

  cooldown = 30;
  timer = 0;
  damage = 5;
  radius = 70;

  get description() {
    return `AoE aura. Radius: ${this.radius}, Dmg: ${this.damage}`;
  }

  update(engine: Engine) {
    this.timer--;
    if (this.timer <= 0) {
      this.timer = engine.toEffectiveCooldown(this.cooldown);
      for (const snake of engine.snakes) {
        for (const segment of [...snake.segments]) {
          if (distance(engine.player, segment) < this.radius + segment.radius) {
            engine.damageSegment(snake, segment, this.damage, this.id);
          }
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(Date.now() / 150) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(engine.player.x - camera.x, engine.player.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.damage += 3;
    this.radius += 15;
    this.cooldown = Math.max(10, this.cooldown - 2);
  }
}

export class Orbitals implements Weapon {
  id = 'orbitals';
  name = 'Orbitals';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'orbit'];

  damage = 12;
  distance = 90;
  speed = 0.04;
  angle = 0;

  get description() {
    return `${1 + Math.floor(this.level / 2)} orbiting projectiles. Dmg: ${this.damage}`;
  }

  update(engine: Engine) {
    const atkSpeed = engine.getEffectiveAttackSpeed();
    const timeDilationMul = engine.timeDilationAttackMul;
    this.angle += (this.speed * atkSpeed) / timeDilationMul;

    const numOrbs = 1 + Math.floor(this.level / 2);
    const hitGapMs = (400 * timeDilationMul) / atkSpeed;

    for (let i = 0; i < numOrbs; i++) {
      const orbAngle = this.angle + (i * Math.PI * 2) / numOrbs;
      const ox = engine.player.x + Math.cos(orbAngle) * this.distance;
      const oy = engine.player.y + Math.sin(orbAngle) * this.distance;

      for (const snake of engine.snakes) {
        for (const segment of [...snake.segments]) {
          if (distance({ x: ox, y: oy }, segment) < 12 + segment.radius) {
            if (!segment.lastOrbHit || Date.now() - segment.lastOrbHit > hitGapMs) {
              engine.damageSegment(snake, segment, this.damage, this.id);
              segment.lastOrbHit = Date.now();
            }
          }
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine) {
    const numOrbs = 1 + Math.floor(this.level / 2);
    ctx.fillStyle = '#f472b6';
    for (let i = 0; i < numOrbs; i++) {
      const orbAngle = this.angle + (i * Math.PI * 2) / numOrbs;
      const ox = engine.player.x + Math.cos(orbAngle) * this.distance;
      const oy = engine.player.y + Math.sin(orbAngle) * this.distance;
      ctx.beginPath();
      ctx.arc(ox - camera.x, oy - camera.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.damage += 6;
    this.speed += 0.005;
  }
}

export class Headhunter implements Weapon {
  id = 'headhunter';
  name = 'Headhunter';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'burst'];

  cooldown = 120;
  timer = 0;
  damage = 18;
  explosionRadius = 70;
  explosionDamage = 12;

  get description() {
    return `Auto-snipes snake heads. Dmg: ${this.damage}. Head kill explodes for ${this.explosionDamage}.`;
  }

  update(engine: Engine) {
    this.timer--;
    if (this.timer > 0) return;

    this.timer = engine.toEffectiveCooldown(this.cooldown);
    const target = findNearestSegment(engine, engine.player, 1000, true);
    if (!target) return;

    const wasAlive = target.segment.hp > 0;
    engine.damageSegment(target.snake, target.segment, this.damage, this.id);

    if (wasAlive && target.segment.hp <= 0) {
      forSegmentsInRadius(
        engine,
        { x: target.segment.x, y: target.segment.y },
        this.explosionRadius,
        ({ snake, segment }) => {
          if (segment !== target.segment) {
            engine.damageSegment(snake, segment, this.explosionDamage, this.id);
          }
        },
      );
    }
  }

  draw() {}

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.damage += 7;
    this.cooldown = Math.max(50, this.cooldown - 8);
    this.explosionDamage += 4;
  }
}

export class TailFuse implements Weapon {
  id = 'tail-fuse';
  name = 'Tail Fuse';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'chain'];

  get chainDamage() {
    return 10 + (this.level - 1) * 5;
  }

  get chainCount() {
    return 1 + Math.floor((this.level - 1) / 2);
  }

  get description() {
    return `Body segment death chains ${this.chainCount} segment(s). Dmg: ${this.chainDamage}.`;
  }

  update() {}

  onSegmentDestroyed(engine: Engine, payload: SegmentDestroyedPayload) {
    if (payload.segment.isHead) return;

    const index = payload.snake.segments.indexOf(payload.segment);
    if (index === -1) return;

    for (let i = 1; i <= this.chainCount; i++) {
      const target = payload.snake.segments[index + i];
      if (!target) break;
      engine.damageSegment(payload.snake, target, this.chainDamage, this.id);
    }
  }

  draw() {}

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
  }
}

export class BloodTrail implements Weapon {
  id = 'blood-trail';
  name = 'Blood Trail';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'zone'];

  spawnInterval = 16;
  spawnTimer = 0;
  lastPlayerX = 0;
  lastPlayerY = 0;
  pools: { x: number; y: number; life: number; tick: number }[] = [];

  get poolLife() {
    return 120 + (this.level - 1) * 10;
  }

  get poolRadius() {
    return 28 + (this.level - 1) * 3;
  }

  get tickDamage() {
    return 4 + (this.level - 1);
  }

  get tickInterval() {
    return 20;
  }

  get description() {
    return `Moving leaves toxic pools. Radius: ${this.poolRadius}, Dmg: ${this.tickDamage}.`;
  }

  update(engine: Engine) {
    const moved = distance({ x: this.lastPlayerX, y: this.lastPlayerY }, engine.player) > 1;
    this.lastPlayerX = engine.player.x;
    this.lastPlayerY = engine.player.y;

    this.spawnTimer--;
    if (moved && this.spawnTimer <= 0) {
      this.spawnTimer = engine.toEffectiveCooldown(this.spawnInterval);
      this.pools.push({
        x: engine.player.x,
        y: engine.player.y,
        life: this.poolLife,
        tick: 0,
      });
      if (this.pools.length > 24) {
        this.pools.shift();
      }
    }

    const tickReset = engine.toEffectiveCooldown(this.tickInterval);
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const pool = this.pools[i];
      pool.life--;
      pool.tick--;

      if (pool.tick <= 0) {
        pool.tick = tickReset;
        forSegmentsInRadius(engine, pool, this.poolRadius, ({ snake, segment }) => {
          engine.damageSegment(snake, segment, this.tickDamage, this.id);
        });
      }

      if (pool.life <= 0) {
        this.pools.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    for (const pool of this.pools) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.arc(pool.x - camera.x, pool.y - camera.y, this.poolRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.spawnInterval = Math.max(8, this.spawnInterval - 1);
  }
}

export class MagnetPulse implements Weapon {
  id = 'magnet-pulse';
  name = 'Magnet Pulse';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['utility', 'offense'];

  cooldown = 300;
  timer = 0;
  pulseFx = 0;

  get pullRadius() {
    return 140 + (this.level - 1) * 20;
  }

  get pulseRadius() {
    return 110 + (this.level - 1) * 10;
  }

  get pulseDamage() {
    return 10 + (this.level - 1) * 4;
  }

  get description() {
    return `Periodically vacuums gems and pulses ${this.pulseDamage} dmg.`;
  }

  update(engine: Engine) {
    this.timer--;
    if (this.timer <= 0) {
      this.timer = engine.toEffectiveCooldown(this.cooldown);
      this.pulseFx = 20;

      for (const gem of engine.gems) {
        if (distance(gem, engine.player) <= this.pullRadius) {
          gem.isCollected = true;
        }
      }

      forSegmentsInRadius(engine, engine.player, this.pulseRadius, ({ snake, segment }) => {
        engine.damageSegment(snake, segment, this.pulseDamage, this.id);
      });
    }

    if (this.pulseFx > 0) {
      this.pulseFx--;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine) {
    if (this.pulseFx <= 0) return;

    const t = this.pulseFx / 20;
    const radius = this.pulseRadius * (1 - t * 0.6);
    ctx.beginPath();
    ctx.arc(engine.player.x - camera.x, engine.player.y - camera.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 * t})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.cooldown = Math.max(160, this.cooldown - 20);
  }
}

export class RicochetArc implements Weapon {
  id = 'ricochet-arc';
  name = 'Ricochet Arc';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'projectile'];

  cooldown = 90;
  timer = 0;
  damage = 14;
  projectiles: BounceProjectile[] = [];

  get bounces() {
    return 1 + Math.floor(this.level / 2);
  }

  get description() {
    return `Arc shot with ${this.bounces} bounce(s). Dmg: ${this.damage}`;
  }

  update(engine: Engine) {
    this.timer--;
    if (this.timer <= 0) {
      this.timer = engine.toEffectiveCooldown(this.cooldown);
      this.fire(engine);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.life--;

      let hitRef: SegmentRef | null = null;
      for (const snake of engine.snakes) {
        for (const segment of snake.segments) {
          if (distance(projectile, segment) <= segment.radius + 5) {
            hitRef = { snake, segment };
            break;
          }
        }
        if (hitRef) break;
      }

      if (hitRef) {
        engine.damageSegment(hitRef.snake, hitRef.segment, this.damage, this.id);
        if (projectile.bouncesLeft > 0) {
          const next = findNearestSegment(engine, hitRef.segment, 320, false, hitRef.segment);
          if (next) {
            const dir = normalize({ x: next.segment.x - projectile.x, y: next.segment.y - projectile.y });
            const speed = 9;
            projectile.vx = dir.x * speed;
            projectile.vy = dir.y * speed;
            projectile.bouncesLeft--;
            projectile.lastHit = hitRef.segment;
            continue;
          }
        }

        this.projectiles.splice(i, 1);
        continue;
      }

      if (projectile.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  fire(engine: Engine) {
    const target = findNearestSegment(engine, engine.player, 600);
    if (!target) return;

    const dir = normalize({ x: target.segment.x - engine.player.x, y: target.segment.y - engine.player.y });
    const speed = 9;
    this.projectiles.push({
      x: engine.player.x,
      y: engine.player.y,
      vx: dir.x * speed,
      vy: dir.y * speed,
      life: 120,
      bouncesLeft: this.bounces,
    });
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.fillStyle = '#a78bfa';
    for (const projectile of this.projectiles) {
      ctx.beginPath();
      ctx.arc(projectile.x - camera.x, projectile.y - camera.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
    this.damage += 4;
    this.cooldown = Math.max(40, this.cooldown - 5);
  }
}

export class OrbitalResonance implements Weapon {
  id = 'orbital-resonance';
  name = 'Orbital Resonance';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'synergy'];

  stacks = 0;

  requires(engine: Engine) {
    return engine.hasWeapon('orbitals');
  }

  get threshold() {
    return Math.max(3, 6 - Math.floor((this.level - 1) / 3));
  }

  get novaRadius() {
    return 120 + (this.level - 1) * 12;
  }

  get novaDamage() {
    return 16 + (this.level - 1) * 5;
  }

  get description() {
    return `Orbital hits stack resonance. ${this.threshold} stacks = nova (${this.novaDamage} dmg).`;
  }

  update() {}

  onSegmentDamaged(engine: Engine, payload: SegmentDamagedPayload) {
    if (payload.sourceId !== 'orbitals') return;

    this.stacks++;
    if (this.stacks >= this.threshold) {
      this.stacks = 0;
      forSegmentsInRadius(engine, engine.player, this.novaRadius, ({ snake, segment }) => {
        engine.damageSegment(snake, segment, this.novaDamage, this.id);
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine) {
    if (this.stacks <= 0) return;
    ctx.fillStyle = '#f9a8d4';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      `Res ${this.stacks}/${this.threshold}`,
      engine.player.x - camera.x + 22,
      engine.player.y - camera.y - 22,
    );
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
  }
}

export class EmergencyShield implements Weapon {
  id = 'emergency-shield';
  name = 'Emergency Shield';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['defense', 'reactive'];

  lastTrigger = 0;

  get cooldownMs() {
    return Math.max(8000, 18000 - (this.level - 1) * 1000);
  }

  get healAmount() {
    return 10 + (this.level - 1) * 6;
  }

  get extraInvulnMs() {
    return 300 + (this.level - 1) * 80;
  }

  get description() {
    return `On hit: heal ${this.healAmount} + ${this.extraInvulnMs}ms shield (${Math.round(this.cooldownMs / 1000)}s CD).`;
  }

  update() {}

  onPlayerDamaged(engine: Engine) {
    const now = Date.now();
    if (now - this.lastTrigger < this.cooldownMs) return;

    this.lastTrigger = now;
    engine.player.hp = Math.min(engine.player.maxHp, engine.player.hp + this.healAmount);
    engine.player.extraInvulnUntil = Math.max(engine.player.extraInvulnUntil, now + this.extraInvulnMs);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine) {
    if (Date.now() > engine.player.extraInvulnUntil) return;
    ctx.beginPath();
    ctx.arc(engine.player.x - camera.x, engine.player.y - camera.y, engine.player.radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
  }
}

export class TimeDilation implements Weapon {
  id = 'time-dilation';
  name = 'Time Dilation';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['control', 'reactive'];

  lastTrigger = 0;
  cooldownMs = 14000;

  get durationMs() {
    return 1200 + (this.level - 1) * 250;
  }

  get enemySpeedMul() {
    return Math.max(0.45, 0.65 - (this.level - 1) * 0.03);
  }

  get attackCooldownMul() {
    return 0.75;
  }

  get description() {
    return `On hit: ${Math.round(this.durationMs / 100) / 10}s slow-time (enemy x${this.enemySpeedMul.toFixed(2)}).`;
  }

  update() {}

  onPlayerDamaged(engine: Engine) {
    const now = Date.now();
    if (now - this.lastTrigger < this.cooldownMs) return;

    this.lastTrigger = now;
    engine.activateTimeDilation(this.durationMs, this.enemySpeedMul, this.attackCooldownMul);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, engine: Engine) {
    if (Date.now() > engine.timeDilationUntil) return;
    ctx.beginPath();
    ctx.arc(engine.player.x - camera.x, engine.player.y - camera.y, engine.player.radius + 20, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
  }
}

export class GreedPact implements Weapon {
  id = 'greed-pact';
  name = 'Greed Pact';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['economy', 'risk'];

  get description() {
    const expMul = 1 + this.level * 0.12;
    const enemyMul = 1 + this.level * 0.08;
    return `EXP x${expMul.toFixed(2)} but enemies scale x${enemyMul.toFixed(2)}.`;
  }

  update() {}

  draw() {}

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
  }
}

export class CorpseBloom implements Weapon {
  id = 'corpse-bloom';
  name = 'Corpse Bloom';
  level = 1;
  maxLevel = MAX_SKILL_LEVEL;
  tags = ['offense', 'zone'];

  zones: { x: number; y: number; life: number; tick: number }[] = [];

  get zoneLife() {
    return 180 + (this.level - 1) * 20;
  }

  get zoneRadius() {
    return 32 + (this.level - 1) * 3;
  }

  get zoneDamage() {
    return 3 + (this.level - 1);
  }

  get description() {
    return `Killed segments sprout thorns. Radius: ${this.zoneRadius}, Dmg: ${this.zoneDamage}.`;
  }

  update(engine: Engine) {
    const tickReset = engine.toEffectiveCooldown(15);
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i];
      zone.life--;
      zone.tick--;

      if (zone.tick <= 0) {
        zone.tick = tickReset;
        forSegmentsInRadius(engine, zone, this.zoneRadius, ({ snake, segment }) => {
          engine.damageSegment(snake, segment, this.zoneDamage, this.id);
        });
      }

      if (zone.life <= 0) {
        this.zones.splice(i, 1);
      }
    }
  }

  onSegmentDestroyed(_engine: Engine, payload: SegmentDestroyedPayload) {
    this.zones.push({
      x: payload.segment.x,
      y: payload.segment.y,
      life: this.zoneLife,
      tick: 0,
    });
    if (this.zones.length > 6) {
      this.zones.shift();
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    for (const zone of this.zones) {
      ctx.beginPath();
      ctx.arc(zone.x - camera.x, zone.y - camera.y, this.zoneRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
  }

  levelUp() {
    if (this.level >= this.maxLevel) return;
    this.level = clampLevelUp(this.level, this.maxLevel);
  }
}

export const WEAPON_TYPES = [MagicWand, Garlic, Orbitals];

export const ALL_WEAPON_TYPES = [
  MagicWand,
  Garlic,
  Orbitals,
  Headhunter,
  TailFuse,
  BloodTrail,
  MagnetPulse,
  RicochetArc,
  OrbitalResonance,
  EmergencyShield,
  TimeDilation,
  GreedPact,
  CorpseBloom,
];
