import { Vector2 } from './types';
import { distance, normalize } from './math';
import { Player } from './Player';

export class Segment {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  color: string;
  lastOrbHit?: number;
  isHead: boolean = false;

  constructor(x: number, y: number, hp: number, radius: number, color: string) {
    this.x = x;
    this.y = y;
    this.maxHp = hp;
    this.hp = hp;
    this.radius = radius;
    this.color = color;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Vector2) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.isHead ? '#ff0000' : '#000000';
    ctx.lineWidth = this.isHead ? 3 : 1;
    ctx.stroke();

    // Health bar
    if (this.hp < this.maxHp) {
      const hpPercent = this.hp / this.maxHp;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(this.x - camera.x - 10, this.y - camera.y - this.radius - 8, 20, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(this.x - camera.x - 10, this.y - camera.y - this.radius - 8, 20 * hpPercent, 4);
    }
  }
}

export class Snake {
  segments: Segment[] = [];
  speed: number;
  damage: number;

  constructor(x: number, y: number, length: number, hp: number, speed: number, damage: number, color: string) {
    this.speed = speed;
    this.damage = damage;
    for (let i = 0; i < length; i++) {
      const seg = new Segment(x - i * 20, y, hp, 12, color);
      if (i === 0) seg.isHead = true;
      this.segments.push(seg);
    }
  }

  update(player: Player) {
    if (this.segments.length === 0) return;

    // Head moves towards player
    const head = this.segments[0];
    const dir = normalize({ x: player.x - head.x, y: player.y - head.y });
    head.x += dir.x * this.speed;
    head.y += dir.y * this.speed;

    // Check collision with player
    if (distance(head, player) < head.radius + player.radius) {
      player.takeDamage(this.damage);
    }

    // Body follows
    for (let i = 1; i < this.segments.length; i++) {
      const leader = this.segments[i - 1];
      const follower = this.segments[i];
      const dist = distance(leader, follower);
      const targetDist = leader.radius + follower.radius - 2; // slight overlap
      
      if (dist > targetDist) {
        const fDir = normalize({ x: leader.x - follower.x, y: leader.y - follower.y });
        // Spring-like follow
        follower.x += fDir.x * (dist - targetDist) * 0.5;
        follower.y += fDir.y * (dist - targetDist) * 0.5;
      }
      
      // Body collision with player
      if (distance(follower, player) < follower.radius + player.radius) {
        player.takeDamage(this.damage * 0.5); // Body does less damage
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Vector2) {
    // Draw from tail to head so head is on top
    for (let i = this.segments.length - 1; i >= 0; i--) {
      this.segments[i].draw(ctx, camera);
    }
  }
}
