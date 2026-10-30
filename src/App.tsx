import { useCallback, useEffect, useRef, useState } from "react";
import { setSoundEnabled, unlockAudio } from "./audio";
import { Game, SLEEP_TIME_SCALE, type GamePhase, type RunResult } from "./game/engine";
import { loadBest, loadSound, saveBest, saveSound } from "./storage";
import { STATUS_URL, speedFactor, useWheel, type WheelState } from "./wheel";

const RESTART_COOLDOWN_MS = 600;
const fmt = new Intl.NumberFormat("en-US");

function wheelLabel(wheel: WheelState): string {
  switch (wheel.mode) {
    case "spinning":
      return `Wheel spinning, ${fmt.format(Math.round(wheel.speedMmPerSecond))} mm/s`;
    case "idle":
      return "Wheel idle";
    case "offline":
      return "Wheel offline";
    default:
      return "Connecting to the wheel…";
  }
}

function boostLabel(wheel: WheelState): string {
  if (wheel.mode === "spinning") return `×${speedFactor(wheel).toFixed(1)} speed`;
  if (wheel.mode === "idle") return `×${SLEEP_TIME_SCALE} slow motion`;
  return "×1.0 speed";
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z" />
      {on ? (
        <path fill="currentColor" d="M11 5h1v1h1v4h-1v1h-1v-1h1V6h-1zM13 3h1v1h1v8h-1v1h-1v-1h1V4h-1z" />
      ) : (
        <path fill="currentColor" d="M11 5h1v1h1V5h1v1h-1v1h-1v1h1v1h1v1h-1V9h-1v1h-1V9h1V8h-1V7h1V6h-1z" />
      )}
    </svg>
  );
}

function ChainBar({ wheel }: { wheel: WheelState }) {
  const pct = wheel.blockProgress * 100;
  const next = wheel.blockHeight !== null ? fmt.format(wheel.blockHeight + 1) : null;
  return (
    <section className="chain" aria-label="Live Squeekchain status">
      <p className="chain__block">
        <span className="chain__label">Block</span>{" "}
        <span className="num">{wheel.blockHeight !== null ? fmt.format(wheel.blockHeight) : "…"}</span>
      </p>
      <div className="chain__progress">
        <div
          className="bar"
          role="progressbar"
          aria-label={next ? `Progress to block ${next}` : "Progress to the next block"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 10) / 10}
        >
          <div className="bar__fill" style={{ inlineSize: `${pct}%` }} />
        </div>
        <span className="chain__pct num">
          {pct.toFixed(1)}%{next ? ` to block ${next}` : ""}
        </span>
      </div>
      <p className={`chip chip--${wheel.mode}`}>
        <span className="chip__dot" aria-hidden="true" />
        {wheelLabel(wheel)}
      </p>
    </section>
  );
}

export function App() {
  const wheel = useWheel();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const overAtRef = useRef(0);
  const startBtnRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<GamePhase>("ready");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [last, setLast] = useState<RunResult | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [sound, setSound] = useState(loadSound);
  const [announce, setAnnounce] = useState("");
  const bestRef = useRef(best);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, {
      onScore: (s, c) => {
        setScore(s);
        setCombo(c);
      },
      onOver: (result) => {
        overAtRef.current = performance.now();
        setPhase("over");
        setLast(result);
        const isBest = result.score > bestRef.current;
        setNewBest(isBest);
        if (isBest) {
          bestRef.current = result.score;
          setBest(result.score);
          saveBest(result.score);
        }
        setAnnounce(
          `Run over. ${result.score} points${isBest ? ", a new best" : ""}. Press Space or select Run again.`,
        );
      },
    });
    gameRef.current = game;
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setWheel(wheel.mode, speedFactor(wheel));
  }, [wheel]);

  useEffect(() => {
    gameRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Night mode follows the wheel for the whole page.
  const night = wheel.mode === "idle";
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#141a40" : "#fff4e0");
  }, [night]);

  useEffect(() => {
    if (wheel.mode === "idle") setAnnounce("The hamster is currently sleeping. The run is in slow motion.");
    else if (wheel.mode === "spinning") setAnnounce("The wheel is spinning. Full speed.");
  }, [wheel.mode]);

  // After a crash, offer the restart button once the cooldown has passed.
  useEffect(() => {
    if (phase !== "over") return;
    const t = window.setTimeout(() => startBtnRef.current?.focus({ preventScroll: true }), RESTART_COOLDOWN_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  /** Starts a run. Keyboard starts move focus to the scene so the ring shows where input goes. */
  const start = useCallback((fromKeyboard = false) => {
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === "over" && performance.now() - overAtRef.current < RESTART_COOLDOWN_MS) return;
    unlockAudio();
    game.start();
    setPhase("playing");
    setNewBest(false);
    setAnnounce("");
    if (fromKeyboard) stageRef.current?.focus({ preventScroll: true });
  }, []);

  const act = useCallback(
    (fromKeyboard: boolean) => {
      const game = gameRef.current;
      if (!game) return;
      if (game.phase === "playing") game.jump();
      else start(fromKeyboard);
    },
    [start],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && gameRef.current?.phase !== "playing") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea")) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        act(true);
      } else if (e.code === "Enter" && gameRef.current?.phase !== "playing") {
        e.preventDefault();
        start(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, start]);

  const onStagePointer = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    act(false);
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSound(next);
  };

  const mult = Math.min(5, 1 + Math.floor(combo / 5));

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Squeek Escape, reload">
          <img src="./favicon.svg" width="32" height="32" alt="" />
          <h1 className="brand__name">Squeek Escape</h1>
        </a>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={sound}
          aria-label="Sound"
          title={sound ? "Sound on" : "Sound off"}
          onClick={toggleSound}
        >
          <SoundIcon on={sound} />
        </button>
      </header>

      <ChainBar wheel={wheel} />

      <main id="main">
        <div
          ref={stageRef}
          className={`stage stage--${wheel.mode}`}
          tabIndex={0}
          role="group"
          aria-label="Game scene"
          aria-describedby="how-to"
          onPointerDown={onStagePointer}
        >
          <canvas ref={canvasRef} className="stage__canvas" aria-hidden="true" />
          <div className="stage__overlay">
            <div className="hud">
              <p className="hud__score num">
                <span className="visually-hidden">Score </span>
                {String(score).padStart(4, "0")}
              </p>
              {phase === "playing" && mult > 1 && <p className="hud__combo num">Seed combo ×{mult}</p>}
              <p className="hud__best num">Best {fmt.format(best)}</p>
            </div>

            {wheel.mode === "idle" && (
              <div className="sleep">
                <p className="sleep__title">The hamster is currently sleeping…</p>
                <p className="sleep__note">Slow motion until the wheel spins again.</p>
              </div>
            )}
            {wheel.mode === "offline" && (
              <p className="sleep__note sleep__note--solo">
                {wheel.error ?? "Wheel offline."} Running at standard speed.
              </p>
            )}

            {phase !== "playing" && (
              <div className="panel">
                {phase === "over" && last && (
                  <p className="panel__result">
                    <span className="num">{fmt.format(last.score)}</span> points
                    {newBest ? ", new best!" : `, best ${fmt.format(best)}`}
                  </p>
                )}
                <button ref={startBtnRef} type="button" className="btn" onClick={(e) => start(e.detail === 0)}>
                  {phase === "over" ? "Run again" : "Start running"}
                </button>
              </div>
            )}
          </div>
        </div>

        <p id="how-to" className="how-to">
          Tap the scene or press Space to jump. Tap twice to double jump.
        </p>

        <dl className="stats">
          <div className="stat">
            <dt>Best score</dt>
            <dd className="num">{fmt.format(best)}</dd>
          </div>
          <div className="stat">
            <dt>Last run</dt>
            <dd className="num">{last ? `${fmt.format(last.meters)} m, ${last.seeds} seeds` : "None yet"}</dd>
          </div>
          <div className="stat">
            <dt>Wheel boost</dt>
            <dd className="num">{boostLabel(wheel)}</dd>
          </div>
        </dl>

        <section className="about" aria-labelledby="about-title">
          <h2 id="about-title">A real wheel sets the pace</h2>
          <p>
            Every two seconds the game reads a real hamster wheel on Squeekchain. Spinning means daylight
            and speed; a nap means night and slow motion. Seeds score 5, golden acorns 50, and every
            fifth seed in a row raises the combo.
          </p>
          <p className="about__meta">
            Live data from <a href={STATUS_URL}>the Squeekchain status feed</a>. Your best score is saved in
            this browser only.
          </p>
        </section>
      </main>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
