import type { Engine } from './Engine';
import { distance, normalize } from './math';
import { Segment } from './Enemy';

export interface Weapon {
  name: string;
  level: number;
  description: string;
  update(engine: Engine): void;
  draw(ctx: CanvasRenderingContext2D, camera: {x: number, y: number}, engine: Engine): void;
  levelUp(): void;
}

export class MagicWand implements Weapon {
  name = 'Magic Wand';
  level = 1;
  cooldown = 60;
  timer = 0;
  damage = 10;
  projectiles: {x: number, y: number, vx: number, vy: number, life: number}[] = [];
  
  get description() { return `Fires ${1 + Math.floor(this.level / 3)} projectile(s). Dmg: ${this.damage}`; }

  update(engine: Engine) {
    this.timer--;
    if (this.timer <= 0) {
      this.timer = this.cooldown;
      this.fire(engine);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      let hit = false;
      for (const snake of engine.snakes) {
        for (const seg of snake.segments) {
          if (distance(p, seg) < seg.radius + 5) {
            engine.damageSegment(snake, seg, this.damage);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }

      if (hit || p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  fire(engine: Engine) {
    let nearest: Segment | null = null;
    let minDist = Infinity;
    for (const snake of engine.snakes) {
      for (const seg of snake.segments) {
        const dist = distance(engine.player, seg);
        if (dist < minDist && dist < 400) {
          minDist = dist;
          nearest = seg;
        }
      }
    }

    if (nearest) {
      const numProjectiles = 1 + Math.floor(this.level / 3);
      for(let i=0; i<numProjectiles; i++) {
        setTimeout(() => {
            if(engine.isGameOver) return;
            let currentNearest: Segment | null = null;
            let currentMinDist = Infinity;
            for (const snake of engine.snakes) {
              for (const seg of snake.segments) {
                const dist = distance(engine.player, seg);
                if (dist < currentMinDist && dist < 400) {
                  currentMinDist = dist;
                  currentNearest = seg;
                }
              }
            }
            if(!currentNearest) return;
            const dir = normalize({ x: currentNearest.x - engine.player.x, y: currentNearest.y - engine.player.y });
            const speed = 8;
            this.projectiles.push({
                x: engine.player.x,
                y: engine.player.y,
                vx: dir.x * speed,
                vy: dir.y * speed,
                life: 100
            });
        }, i * 150);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: {x: number, y: number}) {
    ctx.fillStyle = '#60a5fa';
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y - camera.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  levelUp() {
    this.level++;
    this.damage += 5;
    this.cooldown = Math.max(15, this.cooldown - 5);
  }
}

export class Garlic implements Weapon {
  name = 'Garlic';
  level = 1;
  cooldown = 30;
  timer = 0;
  damage = 5;
  radius = 70;

  get description() { return `AoE aura. Radius: ${this.radius}, Dmg: ${this.damage}`; }

  update(engine: Engine) {
    this.timer--;
    if (this.timer <= 0) {
      this.timer = this.cooldown;
      for (const snake of engine.snakes) {
        for (const seg of snake.segments) {
          if (distance(engine.player, seg) < this.radius + seg.radius) {
            engine.damageSegment(snake, seg, this.damage);
          }
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: {x: number, y: number}, engine: Engine) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(Date.now() / 150) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(engine.player.x - camera.x, engine.player.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
    ctx.fill();
  }

  levelUp() {
    this.level++;
    this.damage += 3;
    this.radius += 15;
    this.cooldown = Math.max(10, this.cooldown - 2);
  }
}

export class Orbitals implements Weapon {
  name = 'Orbitals';
  level = 1;
  damage = 12;
  distance = 90;
  speed = 0.04;
  angle = 0;

  get description() { return `${1 + Math.floor(this.level / 2)} orbiting projectiles. Dmg: ${this.damage}`; }

  update(engine: Engine) {
    this.angle += this.speed;
    const numOrbs = 1 + Math.floor(this.level / 2);
    
    for (let i = 0; i < numOrbs; i++) {
      const orbAngle = this.angle + (i * Math.PI * 2) / numOrbs;
      const ox = engine.player.x + Math.cos(orbAngle) * this.distance;
      const oy = engine.player.y + Math.sin(orbAngle) * this.distance;

      for (const snake of engine.snakes) {
        for (const seg of snake.segments) {
          if (distance({x: ox, y: oy}, seg) < 12 + seg.radius) {
            if (!seg.lastOrbHit || Date.now() - seg.lastOrbHit > 400) {
              engine.damageSegment(snake, seg, this.damage);
              seg.lastOrbHit = Date.now();
            }
          }
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: {x: number, y: number}, engine: Engine) {
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
    this.level++;
    this.damage += 6;
    this.speed += 0.005;
  }
}

export const WEAPON_TYPES = [MagicWand, Garlic, Orbitals];
