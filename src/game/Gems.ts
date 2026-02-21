import { Vector2 } from './types';
import { distance, normalize } from './math';
import { Player } from './Player';

export class Gem {
  x: number;
  y: number;
  exp: number;
  radius: number = 4;
  color: string;
  isCollected: boolean = false;

  constructor(x: number, y: number, exp: number) {
    this.x = x;
    this.y = y;
    this.exp = exp;
    if (exp < 5) this.color = '#4ade80'; // green
    else if (exp < 20) this.color = '#3b82f6'; // blue
    else this.color = '#ef4444'; // red
  }

  update(player: Player) {
    if (this.isCollected) {
      const dist = distance(this, player);
      if (dist < player.radius) {
        player.gainExp(this.exp);
        return true; // remove
      }
      const dir = normalize({ x: player.x - this.x, y: player.y - this.y });
      const speed = 10;
      this.x += dir.x * speed;
      this.y += dir.y * speed;
    } else {
      const dist = distance(this, player);
      if (dist < player.pickupRadius) {
        this.isCollected = true;
      }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Vector2) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
