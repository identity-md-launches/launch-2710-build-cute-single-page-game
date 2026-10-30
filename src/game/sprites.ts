/** Pixel sprites as rows of palette keys. "." is transparent. */
export type Sprite = readonly string[];

export const PALETTE: Record<string, string> = {
  o: "#5a3a22", // outline
  f: "#f2a65a", // fur
  c: "#fff1d6", // belly
  p: "#f78fa7", // ears, cheeks, nose
  e: "#2b1a10", // eye
  w: "#ffffff", // eye shine
  t: "#c98f55", // cardboard
  T: "#9c6a3a", // cardboard ring
  b: "#e8c27a", // wood block
  B: "#b98a3e", // wood edge
  s: "#3b3340", // seed shell
  S: "#efe9df", // seed stripe
  g: "#ffd23f", // golden acorn
  G: "#c48a12", // acorn cap
  y: "#ffd23f", // sun
  Y: "#ffb000", // sun edge
  m: "#fff6cf", // moon
};

const HEAD = [
  "......oo..oo....",
  ".....oppooppo...",
  "...ooffffffffoo.",
  "..offffffffffffo",
];

const BODY = [
  "offffffffffppfpo",
  "offffffffcccccco",
  "offfffffccccccco",
  ".offfffccccccco.",
  "..oooooooooooo..",
];

const EYES_OPEN = [".offffffffffewfo", ".offffffffffeefo"];
const EYES_SHUT = [".offfffffffffffo", ".offffffffffoofo"];

export const HAMSTER_RUN_A: Sprite = [...HEAD, ...EYES_OPEN, ...BODY, "...oo.....oo...."];
export const HAMSTER_RUN_B: Sprite = [...HEAD, ...EYES_OPEN, ...BODY, "....oo...oo....."];
export const HAMSTER_JUMP: Sprite = [...HEAD, ...EYES_OPEN, ...BODY, "....o.o..o.o...."];
export const HAMSTER_SLEEP_A: Sprite = [...HEAD, ...EYES_SHUT, ...BODY, "...oo.....oo...."];
export const HAMSTER_SLEEP_B: Sprite = [...HEAD, ...EYES_SHUT, ...BODY, "....oo...oo....."];
export const HAMSTER_HURT: Sprite = [
  ...HEAD,
  ".offffffffffwefo",
  ".offffffffffewfo",
  ...BODY,
  "...o.o....o.o...",
];

export const TUBE: Sprite = [
  "TTTTTTTT",
  "tttttttt",
  "tttttttt",
  "TTTTTTTT",
  "tttttttt",
  "tttttttt",
  "TTTTTTTT",
  "tttttttt",
  "tttttttt",
  "TTTTTTTT",
  "tttttttt",
  "TTTTTTTT",
];

export const BLOCK: Sprite = [
  "BBBBBBBBBB",
  "BbbbbbbbbB",
  "BbBBbbBBbB",
  "BbbbbbbbbB",
  "BbbbbbbbbB",
  "BbBBbbBBbB",
  "BbbbbbbbbB",
  "BBBBBBBBBB",
];

export const SEED: Sprite = [".s.", "sSs", "sSs", "sSs", ".s."];

export const ACORN: Sprite = [".GGG.", "GGGGG", "ggggg", "ggggg", ".ggg.", "..g.."];

export const SUN: Sprite = [
  "....YYYY....",
  "..YYyyyyYY..",
  ".YyyyyyyyyY.",
  ".YyyyyyyyyY.",
  "YyyyyyyyyyyY",
  "YyyyyyyyyyyY",
  "YyyyyyyyyyyY",
  "YyyyyyyyyyyY",
  ".YyyyyyyyyY.",
  ".YyyyyyyyyY.",
  "..YYyyyyYY..",
  "....YYYY....",
];

export const MOON: Sprite = [
  "...mmm....",
  ".mmmm.....",
  ".mmm......",
  "mmm.......",
  "mmm.......",
  "mmm.......",
  "mmmm......",
  ".mmmm...m.",
  "..mmmmmmm.",
  "....mmm...",
];

export function spriteSize(sprite: Sprite): { w: number; h: number } {
  return { w: sprite[0].length, h: sprite.length };
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  alpha = 1,
): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  ctx.globalAlpha = alpha;
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const key = line[col];
      if (key === ".") continue;
      ctx.fillStyle = PALETTE[key];
      ctx.fillRect(ox + col, oy + row, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
