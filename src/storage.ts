const BEST_KEY = "squeek-escape:best";
const SOUND_KEY = "squeek-escape:sound";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage disabled: the score just won't persist.
  }
}

export function loadBest(): number {
  const n = Number(read(BEST_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function saveBest(score: number): void {
  write(BEST_KEY, String(Math.floor(score)));
}

export function loadSound(): boolean {
  return read(SOUND_KEY) !== "off";
}

export function saveSound(on: boolean): void {
  write(SOUND_KEY, on ? "on" : "off");
}
