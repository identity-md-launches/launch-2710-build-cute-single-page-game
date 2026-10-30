import { sfx } from "../audio";
import type { WheelMode } from "../wheel";
import {
  ACORN,
  BLOCK,
  HAMSTER_HURT,
  HAMSTER_JUMP,
  HAMSTER_RUN_A,
  HAMSTER_RUN_B,
  HAMSTER_SLEEP_A,
  HAMSTER_SLEEP_B,
  MOON,
  SEED,
  SUN,
  TUBE,
  drawSprite,
  type Sprite,
} from "./sprites";

/** Logical pixels per CSS pixel are about 1 / PIXEL_SCALE; the world width is clamped to this range. */
const PIXEL_SCALE = 2.6;
const MIN_W = 140;
const MAX_W = 220;
const GROUND_H = 16;
const HAMSTER_X = 28;
const BASE_SPEED = 62; // px per second at 1x
const GRAVITY = 600;
const JUMP_V = -190;
const DOUBLE_JUMP_V = -160;
/** Simulation speed while the wheel is idle and the hamster sleeps. */
export const SLEEP_TIME_SCALE = 0.4;

export type GamePhase = "ready" | "playing" | "over";

export interface RunResult {
  score: number;
  seeds: number;
  meters: number;
}

export interface GameCallbacks {
  onScore(score: number, combo: number): void;
  onOver(result: RunResult): void;
}

interface Obstacle {
  x: number;
  sprite: Sprite;
  stack: number;
}

interface Pickup {
  x: number;
  y: number;
  golden: boolean;
  taken: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: "dot" | "z";
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, "0")).join("");
}

export class Game {
  phase: GamePhase = "ready";
  private ctx: CanvasRenderingContext2D;
  private w = 200;
  private h = 120;
  private raf = 0;
  private last = 0;
  private time = 0;

  // live wheel input
  private wheelMode: WheelMode = "connecting";
  private targetFactor = 1;
  private factor = 1;
  private night = 0;
  private timeScale = 1;
  private reducedMotion = false;

  // run state
  private y = 0;
  private vy = 0;
  private grounded = true;
  private jumpsLeft = 2;
  private distance = 0;
  private runTime = 0;
  private seedPoints = 0;
  private seeds = 0;
  private combo = 0;
  private nextMilestone = 100;
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private nextObstacleAt = 0;
  private nextPickupAt = 0;
  private scroll = 0;
  private shake = 0;
  private lastScore = -1;
  private squeakIn = 3;
  private snoreIn = 4;
  private stars: Array<[number, number]> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
    for (let i = 0; i < 40; i++) this.stars.push([Math.random(), Math.random() * 0.6]);
    this.resize();
    this.reset();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  /** Matches the logical height to the canvas's displayed aspect ratio. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = rect.width > 0 ? rect.height / rect.width : 0.6;
    this.w = Math.round(Math.min(MAX_W, Math.max(MIN_W, rect.width / PIXEL_SCALE)));
    this.h = Math.max(64, Math.round(this.w * ratio));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
    this.draw();
  }

  setWheel(mode: WheelMode, factor: number): void {
    this.wheelMode = mode;
    this.targetFactor = factor;
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
  }

  private get groundY(): number {
    return this.h - GROUND_H;
  }

  private get asleep(): boolean {
    return this.wheelMode === "idle";
  }

  private reset(): void {
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumpsLeft = 2;
    this.distance = 0;
    this.runTime = 0;
    this.seedPoints = 0;
    this.seeds = 0;
    this.combo = 0;
    this.nextMilestone = 100;
    this.obstacles = [];
    this.pickups = [];
    this.nextObstacleAt = 160;
    this.nextPickupAt = 90;
    this.lastScore = -1;
  }

  start(): void {
    this.reset();
    this.phase = "playing";
    this.emitScore();
  }

  /** Jump, or double-jump while airborne. */
  jump(): void {
    if (this.phase !== "playing" || this.jumpsLeft <= 0) return;
    this.vy = this.grounded ? JUMP_V : DOUBLE_JUMP_V;
    this.grounded = false;
    this.jumpsLeft -= 1;
    sfx.jump();
    this.burst(HAMSTER_X + 8, this.groundY - this.y, 4, "#fff1d6");
  }

  get score(): number {
    return Math.floor(this.distance / 10) + this.seedPoints;
  }

  private emitScore(): void {
    const s = this.score;
    if (s !== this.lastScore) {
      this.lastScore = s;
      this.callbacks.onScore(s, this.combo);
    }
  }

  private frame = (now: number): void => {
    const dtReal = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.update(dtReal);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dtReal: number): void {
    // Ease toward the wheel's live state so changes feel smooth.
    const k = 1 - Math.exp(-dtReal * 2.5);
    this.factor = lerp(this.factor, this.targetFactor, k);
    this.night = lerp(this.night, this.asleep ? 1 : 0, 1 - Math.exp(-dtReal * 1.5));
    this.timeScale = lerp(this.timeScale, this.asleep ? SLEEP_TIME_SCALE : 1, k);

    const dt = dtReal * this.timeScale;
    this.time += dt;

    const attract = this.phase === "ready" && !this.reducedMotion;
    const moving = this.phase === "playing" || attract;
    const ramp = this.phase === "playing" ? Math.min(1.6, 1 + this.runTime / 120) : 1;
    const speed = moving ? BASE_SPEED * this.factor * ramp : 0;
    this.scroll += speed * dt;

    this.updateParticles(dt);
    this.ambient(dtReal, speed);

    if (this.phase !== "playing") return;

    this.runTime += dt;
    this.distance += speed * dt;

    // Hamster physics
    if (!this.grounded) {
      this.vy += GRAVITY * dt;
      this.y -= this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.jumpsLeft = 2;
        this.burst(HAMSTER_X + 6, this.groundY, 3, "#d9b98a");
      }
    }

    // Spawning by distance, with gaps the jump can always clear.
    if (this.distance >= this.nextObstacleAt) {
      const roll = Math.random();
      const sprite = roll < 0.5 ? TUBE : BLOCK;
      const stack = sprite === BLOCK && roll > 0.8 && this.runTime > 20 ? 2 : 1;
      this.obstacles.push({ x: this.w + 4, sprite, stack });
      const minGap = speed * 0.85 + 40;
      this.nextObstacleAt = this.distance + rand(minGap, minGap + 110);
    }
    if (this.distance >= this.nextPickupAt) {
      const golden = Math.random() < 0.08;
      const row = Math.floor(rand(0, 3));
      const count = golden ? 1 : 3 + Math.floor(rand(0, 3));
      for (let i = 0; i < count; i++) {
        this.pickups.push({
          x: this.w + 4 + i * 10,
          y: this.groundY - 14 - row * 12 - (golden ? 10 : 0),
          golden,
          taken: false,
        });
      }
      this.nextPickupAt = this.distance + rand(110, 200);
    }

    const dx = speed * dt;
    for (const o of this.obstacles) o.x -= dx;
    for (const p of this.pickups) p.x -= dx;
    this.obstacles = this.obstacles.filter((o) => o.x > -20);
    this.pickups = this.pickups.filter((p) => {
      if (p.x > -10) return true;
      if (!p.taken) this.combo = 0;
      return false;
    });

    // Collisions, with a forgiving hitbox.
    const hx = HAMSTER_X + 3;
    const hw = 10;
    const hy = this.groundY - this.y - 10;
    const hh = 9;
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (p.x < hx + hw && p.x + 5 > hx && p.y < hy + hh && p.y + 6 > hy) {
        p.taken = true;
        this.combo += 1;
        this.seeds += 1;
        const mult = Math.min(5, 1 + Math.floor(this.combo / 5));
        this.seedPoints += (p.golden ? 50 : 5) * mult;
        sfx.seed(this.combo);
        this.burst(p.x + 2, p.y + 2, p.golden ? 10 : 5, p.golden ? "#ffd23f" : "#ffffff");
      }
    }
    for (const o of this.obstacles) {
      const w = o.sprite[0].length;
      const h = o.sprite.length * o.stack;
      const top = this.groundY - h;
      if (o.x + 1 < hx + hw && o.x + w - 1 > hx && hy + hh > top + 1) {
        this.crash();
        return;
      }
    }

    if (this.score >= this.nextMilestone) {
      this.nextMilestone += 100;
      sfx.milestone();
      this.burst(HAMSTER_X + 8, this.groundY - this.y - 14, 8, "#ffd23f");
    }
    this.emitScore();
  }

  private crash(): void {
    this.phase = "over";
    this.shake = this.reducedMotion ? 0 : 0.3;
    sfx.crash();
    this.burst(HAMSTER_X + 8, this.groundY - this.y - 6, 12, "#f78fa7");
    this.emitScore();
    this.callbacks.onOver({
      score: this.score,
      seeds: this.seeds,
      meters: Math.floor(this.distance / 10),
    });
  }

  private ambient(dtReal: number, speed: number): void {
    const feetY = this.groundY - this.y;
    if (this.wheelMode === "spinning" && speed > 0) {
      if (this.grounded && Math.random() < (this.reducedMotion ? 0.1 : 0.6)) {
        this.particles.push({
          x: HAMSTER_X + 2,
          y: feetY - 1,
          vx: -rand(20, 50),
          vy: -rand(5, 25),
          life: 0,
          max: rand(0.3, 0.6),
          color: "#e2c79c",
          size: 1,
          kind: "dot",
        });
      }
      if (this.phase === "playing") {
        this.squeakIn -= dtReal;
        if (this.squeakIn <= 0) {
          this.squeakIn = rand(3, 7);
          sfx.squeak();
        }
      }
    }
    if (this.asleep) {
      this.snoreIn -= dtReal;
      if (this.snoreIn <= 0) {
        this.snoreIn = rand(3.5, 5);
        if (this.phase !== "over") sfx.snore();
        this.particles.push({
          x: HAMSTER_X + 13,
          y: feetY - 16,
          vx: 6,
          vy: -10,
          life: 0,
          max: 2.4,
          color: "#ffffff",
          size: 1,
          kind: "z",
        });
      }
    }
  }

  private burst(x: number, y: number, n: number, color: string): void {
    const count = this.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 60);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 20,
        life: 0,
        max: rand(0.3, 0.7),
        color,
        size: Math.random() < 0.3 ? 2 : 1,
        kind: "dot",
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "dot") p.vy += 120 * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    this.shake = Math.max(0, this.shake - dt);
  }

  private draw(): void {
    const { ctx } = this;
    const W = this.w;
    const gy = this.groundY;
    const n = this.night;

    ctx.save();
    if (this.shake > 0) ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-1, 1)));

    // Sky, banded like pixel art rather than a smooth gradient.
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      ctx.fillStyle = mix(mix("#7ccbff", "#141a40", n), mix("#ffe6b8", "#3a3570", n), t);
      ctx.fillRect(0, Math.floor((gy * i) / bands), W, Math.ceil(gy / bands) + 1);
    }

    // Stars and moon at night, sun by day, tucked into the trailing corner.
    const orbX = W - 22;
    const orbY = 5;
    if (n > 0.05) {
      ctx.fillStyle = "#ffffff";
      for (const [sx, sy] of this.stars) {
        const twinkle = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(this.time * 3 + sx * 40);
        ctx.globalAlpha = n * twinkle;
        ctx.fillRect(Math.floor(sx * W), Math.floor(sy * gy), 1, 1);
      }
      drawSprite(ctx, MOON, orbX, orbY, n);
    }
    if (n < 0.95) drawSprite(ctx, SUN, orbX - 2, orbY - 2, 1 - n);

    // Clouds, far hills and near fence, each scrolling at its own depth.
    ctx.fillStyle = mix("#ffffff", "#4a4880", n);
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 67 - this.scroll * 0.1) % (W + 40) + W + 40) % (W + 40) - 30;
      const cy = 14 + ((i * 23) % 30);
      ctx.fillRect(cx, cy, 22, 5);
      ctx.fillRect(cx + 5, cy - 3, 11, 3);
    }
    ctx.fillStyle = mix("#9ad37a", "#23305a", n);
    for (let x = 0; x < W; x++) {
      const wx = x + this.scroll * 0.25;
      const hill = 10 + Math.round(8 * Math.sin(wx / 23) + 4 * Math.sin(wx / 9));
      ctx.fillRect(x, gy - hill, 1, hill);
    }
    ctx.fillStyle = mix("#c98f55", "#3a2f4d", n);
    const fenceOff = Math.floor(this.scroll * 0.6) % 14;
    for (let x = -fenceOff; x < W; x += 14) ctx.fillRect(x, gy - 9, 3, 9);
    ctx.fillRect(0, gy - 7, W, 2);

    // Ground: wood-chip bedding
    ctx.fillStyle = mix("#f3d9a4", "#4a3f5e", n);
    ctx.fillRect(0, gy, W, GROUND_H);
    ctx.fillStyle = mix("#d9b46e", "#362d48", n);
    const chipOff = Math.floor(this.scroll) % 8;
    for (let x = -chipOff; x < W; x += 8) {
      ctx.fillRect(x, gy + 3, 3, 1);
      ctx.fillRect(x + 4, gy + 8, 2, 1);
      ctx.fillRect(x + 1, gy + 12, 3, 1);
    }
    ctx.fillStyle = mix("#b98a3e", "#2a2238", n);
    ctx.fillRect(0, gy, W, 1);

    // Pickups and obstacles
    for (const p of this.pickups) {
      if (p.taken) continue;
      const bob = this.reducedMotion ? 0 : Math.round(Math.sin(this.time * 5 + p.x / 10));
      drawSprite(ctx, p.golden ? ACORN : SEED, p.x, p.y + bob);
    }
    for (const o of this.obstacles) {
      const h = o.sprite.length;
      for (let s = 0; s < o.stack; s++) drawSprite(ctx, o.sprite, o.x, gy - h * (s + 1));
    }

    // Hamster
    const runFrame = Math.floor(this.time * (this.asleep ? 4 : 12)) % 2 === 0;
    let sprite: Sprite;
    if (this.phase === "over") sprite = HAMSTER_HURT;
    else if (!this.grounded) sprite = HAMSTER_JUMP;
    else if (this.asleep) sprite = runFrame ? HAMSTER_SLEEP_A : HAMSTER_SLEEP_B;
    else if (this.phase === "ready" && this.reducedMotion) sprite = HAMSTER_RUN_A;
    else sprite = runFrame ? HAMSTER_RUN_A : HAMSTER_RUN_B;
    const bounce = this.grounded && this.phase !== "over" && runFrame && !this.reducedMotion ? 1 : 0;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(HAMSTER_X + 3, gy, 10, 1);
    drawSprite(ctx, sprite, HAMSTER_X, gy - 12 - this.y - bounce);

    // Particles
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      if (p.kind === "z") {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        ctx.fillRect(x, y, 4, 1);
        ctx.fillRect(x + 2, y + 1, 1, 1);
        ctx.fillRect(x + 1, y + 2, 1, 1);
        ctx.fillRect(x, y + 3, 4, 1);
      } else {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    // Speed lines when the wheel is really going.
    if (this.wheelMode === "spinning" && this.phase === "playing" && this.factor > 1.3 && !this.reducedMotion) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 5; i++) {
        const lx = (W - ((this.scroll * 2 + i * 53) % (W + 30)));
        ctx.fillRect(lx, 20 + ((i * 37) % (gy - 40)), 12, 1);
      }
    }
    ctx.restore();
  }
}
