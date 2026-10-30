import { useEffect, useState } from "react";

export const STATUS_URL = "https://api.squeekchain.com/v1/status";

const POLL_MS = 2000;
const MAX_BACKOFF_MS = 15000;
const REQUEST_TIMEOUT_MS = 6000;
/** One block is this many block units (cumulativeBlockUnits = height * 1e9 + progress). */
const BLOCK_UNITS = 1_000_000_000;

export type WheelMode = "connecting" | "spinning" | "idle" | "offline";

export interface WheelState {
  mode: WheelMode;
  /** Raw coreStatus string from the API, if any. */
  coreStatus: string | null;
  speedMmPerSecond: number;
  rpm: number;
  blockHeight: number | null;
  /** 0..1 progress toward the next block. */
  blockProgress: number;
  observedAt: string | null;
  error: string | null;
}

export const initialWheel: WheelState = {
  mode: "connecting",
  coreStatus: null,
  speedMmPerSecond: 0,
  rpm: 0,
  blockHeight: null,
  blockProgress: 0,
  observedAt: null,
  error: null,
};

interface StatusPayload {
  measurement?: {
    freshness?: string;
    observedAt?: string;
    staleAfterSeconds?: number;
    coreStatus?: string;
    rpmMilli?: number;
    speedMmPerSecond?: number;
  };
  builder?: {
    projected?: { blockHeight?: string; blockProgress?: string };
    anchor?: { blockHeight?: string; blockProgress?: string };
  };
}

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Turns the raw API payload into the state the game reads. Exported for tests. */
export function parseStatus(payload: StatusPayload, now = Date.now()): WheelState {
  const m = payload.measurement ?? {};
  const block = payload.builder?.projected ?? payload.builder?.anchor;
  const speed = Math.max(0, num(m.speedMmPerSecond));
  const rpm = Math.max(0, num(m.rpmMilli) / 1000);
  const status = typeof m.coreStatus === "string" ? m.coreStatus.toUpperCase() : null;

  const staleMs = num(m.staleAfterSeconds || 120) * 1000;
  const observed = m.observedAt ? Date.parse(m.observedAt) : NaN;
  const stale =
    (m.freshness !== undefined && m.freshness !== "online") ||
    (Number.isFinite(observed) && now - observed > staleMs);

  let mode: WheelMode;
  if (stale || status === null) mode = "offline";
  else if (status === "SPINNING") mode = "spinning";
  else if (status === "IDLE") mode = "idle";
  else mode = speed > 0 || rpm > 0 ? "spinning" : "idle";

  const height = block?.blockHeight !== undefined ? num(block.blockHeight) : null;
  const progress = Math.min(1, Math.max(0, num(block?.blockProgress) / BLOCK_UNITS));

  return {
    mode,
    coreStatus: status,
    speedMmPerSecond: speed,
    rpm,
    blockHeight: height,
    blockProgress: progress,
    observedAt: m.observedAt ?? null,
    error: stale ? "The wheel has not reported recently." : null,
  };
}

/** Polls the Squeekchain status endpoint and keeps the last good reading on failure. */
export function useWheel(): WheelState {
  const [state, setState] = useState<WheelState>(initialWheel);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;

    const tick = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(STATUS_URL, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const next = parseStatus((await res.json()) as StatusPayload);
        failures = 0;
        if (!cancelled) setState(next);
      } catch {
        failures += 1;
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            mode: "offline",
            error: "Unable to reach the wheel. Retrying.",
          }));
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) {
          const delay = failures === 0 ? POLL_MS : Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures);
          timer = window.setTimeout(tick, delay);
        }
      }
    };

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}

/** World speed multiplier for a live reading. Unknown speeds stay at 1x. */
export function speedFactor(wheel: Pick<WheelState, "mode" | "speedMmPerSecond">): number {
  if (wheel.mode !== "spinning") return 1;
  return Math.min(1.9, Math.max(1.1, 0.9 + wheel.speedMmPerSecond / 1000));
}
