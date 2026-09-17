"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "./globals.css";

const CHECKING_STEPS = ["MENGECEK NIM", "MENCARI DATA", "MENYIAPKAN HASIL"];

type Screen = "initial" | "checking" | "result";
type ResultState = "passed" | "failed" | null;

type CheckResponse = {
  found: boolean;
  passed: boolean;
  name?: string;
  division?: string | null;
};

function normalizeNIM(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function validateNIM(nim: string): string {
  if (!nim) return "NIM-nya belum diisi nih!";
  if (nim.length < 6) return "Coba cek lagi, NIM kamu kelihatannya terlalu pendek.";
  if (!/^[A-Z0-9]+$/.test(nim)) return "NIM cuma boleh huruf dan angka, ya!";
  return "";
}

async function fetchCheckNIM(nim: string): Promise<CheckResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("/api/check-nim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // HANYA kirim nim — tidak ada data lain yang bisa dimanipulasi client
      body: JSON.stringify({ nim }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.error ?? `Server error (${res.status})`);
    }

    const data = (await res.json()) as CheckResponse;

    // Validasi shape response — jangan pernah percaya response mentah
    if (typeof data?.found !== "boolean" || typeof data?.passed !== "boolean") {
      throw new Error("Respons server tidak valid.");
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Confetti helpers ──────────────────────────────────────────────────────────
function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

interface ConfettiPiece {
  x: number; y: number; size: number; color: string;
  shape: "rect" | "circle" | "triangle" | "star";
  velocityX: number; velocityY: number; gravity: number;
  rotation: number; rotationSpeed: number;
  wobble: number; wobbleSpeed: number;
  opacity: number; life: number;
}

function createConfettiPiece(fromBurst = false): ConfettiPiece {
  const colors = ["#E099F8", "#35342E", "#B1C480", "#71C646", "#EECB8F"];
  const shapes: ConfettiPiece["shape"][] = ["rect", "circle", "triangle", "star"];
  const angle = randomBetween(-Math.PI, 0);
  const burstSpeed = randomBetween(7, 17);
  return {
    x: fromBurst ? window.innerWidth / 2 : randomBetween(0, window.innerWidth),
    y: fromBurst ? window.innerHeight * 0.48 : randomBetween(-window.innerHeight * 0.65, -18),
    size: randomBetween(6, 15),
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    velocityX: fromBurst ? Math.cos(angle) * burstSpeed : randomBetween(-2.2, 2.2),
    velocityY: fromBurst ? Math.sin(angle) * burstSpeed : randomBetween(2.7, 7.2),
    gravity: fromBurst ? randomBetween(0.14, 0.25) : randomBetween(0.035, 0.09),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.19, 0.19),
    wobble: randomBetween(0, Math.PI * 2),
    wobbleSpeed: randomBetween(0.04, 0.12),
    opacity: 1,
    life: fromBurst ? randomBetween(120, 190) : randomBetween(240, 420),
  };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const r = point % 2 === 0 ? radius : radius * 0.43;
    const a = -Math.PI / 2 + (point * Math.PI) / 5;
    if (point === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawConfettiPiece(ctx: CanvasRenderingContext2D, piece: ConfettiPiece) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, piece.opacity);
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.rotation);
  ctx.fillStyle = piece.color;
  ctx.strokeStyle = "rgba(53, 52, 46, .45)";
  ctx.lineWidth = 1;
  if (piece.shape === "circle") {
    ctx.beginPath(); ctx.arc(0, 0, piece.size * 0.48, 0, Math.PI * 2);
  } else if (piece.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -piece.size * 0.65);
    ctx.lineTo(piece.size * 0.58, piece.size * 0.48);
    ctx.lineTo(-piece.size * 0.58, piece.size * 0.48);
    ctx.closePath();
  } else if (piece.shape === "star") {
    drawStar(ctx, 0, 0, piece.size * 0.65);
  } else {
    ctx.beginPath();
    ctx.rect(-piece.size * 0.6, -piece.size * 0.3, piece.size * 1.2, piece.size * 0.6);
  }
  ctx.fill(); ctx.stroke(); ctx.restore();
}

// ── Copy helper (nama di-bold) ────────────────────────────────────────────────
function renderPassedCopy(name: string | undefined, division: string | null | undefined) {
  const formattedName = name ?? "";
  const formattedDivision = division?.trim();

  if (!formattedName && !formattedDivision) {
    return (
      <>
        Selamat! Kamu resmi menjadi bagian dari{" "}
        <strong>Staff DIESNATALIS INFORMATIKA 18</strong>!
      </>
    );
  }

  if (formattedName && !formattedDivision) {
    return (
      <>
        Selamat, <strong>{formattedName}</strong>! Kamu resmi menjadi bagian dari{" "}
        <strong>Staff DIESNATALIS INFORMATIKA 18</strong>!
      </>
    );
  }

  if (!formattedName && formattedDivision) {
    return (
      <>
        Selamat! Kamu resmi menjadi bagian dari{" "}
        Staff DIESNATALIS INFORMATIKA 18 sebagai{" "}
        <strong>Divisi {formattedDivision}</strong>!
      </>
    );
  }

  return (
    <>
      Selamat, <strong>{formattedName}</strong>! Kamu resmi menjadi bagian dari{" "}
      Staff DIESNATALIS INFORMATIKA 18 sebagai{" "}
      <strong>Divisi {formattedDivision}</strong>!
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("initial");
  const [enteringScreen, setEnteringScreen] = useState<Screen>("initial");
  const [nimValue, setNimValue] = useState("");
  const [fieldMessage, setFieldMessage] = useState("");
  const [checkingLabel, setCheckingLabel] = useState(CHECKING_STEPS[0]);
  const [resultState, setResultState] = useState<ResultState>(null);
  const [resultAnimated, setResultAnimated] = useState(false);
  const [resultNim, setResultNim] = useState("");
  const [resultTitle, setResultTitle] = useState("");
  const [resultSubtitle, setResultSubtitle] = useState("");
  const [resultCopy, setResultCopy] = useState<React.ReactNode>("");
  const [resultDivision, setResultDivision] = useState<string | null>(null);
  const [checkDisabled, setCheckDisabled] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nimInputRef = useRef<HTMLInputElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const checkingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latestNimRef = useRef<string | null>(null);
  const confettiRef = useRef<{ animationId: number | null; particles: ConfettiPiece[] }>({
    animationId: null, particles: [],
  });

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const showScreen = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
    setEnteringScreen(screen);
  }, []);

  const resizeConfettiCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }, []);

  const stopConfetti = useCallback(() => {
    const state = confettiRef.current;
    if (state.animationId) { cancelAnimationFrame(state.animationId); state.animationId = null; }
    state.particles = [];
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext("2d"); ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }, []);

  const animateConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    const state = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    state.particles.forEach((piece) => {
      piece.wobble += piece.wobbleSpeed;
      piece.x += piece.velocityX + Math.sin(piece.wobble) * 0.8;
      piece.y += piece.velocityY;
      piece.velocityY += piece.gravity;
      piece.rotation += piece.rotationSpeed;
      piece.life -= 1;
      if (piece.life < 45) piece.opacity = piece.life / 45;
      drawConfettiPiece(ctx, piece);
    });
    state.particles = state.particles.filter(
      (p) => p.life > 0 && p.y < window.innerHeight + 80 && p.x > -100 && p.x < window.innerWidth + 100
    );
    if (state.particles.length > 0) {
      state.animationId = requestAnimationFrame(animateConfetti);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      state.animationId = null;
    }
  }, []);

  const startConfetti = useCallback(() => {
    stopConfetti();
    resizeConfettiCanvas();
    const state = confettiRef.current;
    const viewportFactor = Math.min(1.35, Math.max(0.7, window.innerWidth / 900));
    state.particles = [
      ...Array.from({ length: Math.floor(220 * viewportFactor) }, () => createConfettiPiece(false)),
      ...Array.from({ length: Math.floor(95 * viewportFactor) }, () => createConfettiPiece(true)),
    ];
    animateConfetti();
  }, [stopConfetti, resizeConfettiCanvas, animateConfetti]);

  const createCelebrationBurst = useCallback(() => {
    const symbols = ["✦", "★", "●", "✨", "○"];
    const colors = ["#E099F8", "#35342E", "#B1C480", "#71C646", "#EECB8F"];
    for (let i = 0; i < 28; i++) {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * i) / 28 + randomBetween(-0.14, 0.14);
      const distance = randomBetween(150, Math.min(430, window.innerWidth * 0.46));
      particle.className = "celebration-particle";
      particle.textContent = symbols[i % symbols.length];
      particle.setAttribute("aria-hidden", "true");
      particle.style.setProperty("--particle-size", `${randomBetween(10, 25)}px`);
      particle.style.setProperty("--particle-color", colors[i % colors.length]);
      particle.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--particle-y", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--particle-rotate", `${randomBetween(-420, 420)}deg`);
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 1500);
    }
  }, []);

  const createSadRain = useCallback(() => {
    const sadSymbols = ["😢", "😭", "🥀", "🥀", "😔"];
    for (let i = 0; i < 18; i++) {
      const particle = document.createElement("span");
      particle.className = "sad-particle";
      particle.setAttribute("aria-hidden", "true");
      particle.textContent = sadSymbols[i % sadSymbols.length];
      particle.style.setProperty("--sad-x", `${randomBetween(4, 94)}vw`);
      particle.style.setProperty("--sad-size", `${randomBetween(24, 46)}px`);
      particle.style.setProperty("--sad-drift", `${randomBetween(-90, 90)}px`);
      particle.style.setProperty("--sad-duration", `${randomBetween(2.8, 4.2)}s`);
      particle.style.setProperty("--sad-delay", `${i * 70}ms`);
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 5600);
    }
  }, []);

  const showResult = useCallback(
    (nim: string, result: CheckResponse) => {
      const didPass = result.found && result.passed;
      const notFound = !result.found;

      setResultState(didPass ? "passed" : "failed");
      setResultNim(nim);
      setResultAnimated(false);
      setResultDivision(result.division ?? null);

      if (notFound) {
        setResultTitle("HMM 🤔");
        setResultSubtitle("NIM TIDAK DITEMUKAN");
        setResultCopy(
          "NIM kamu tidak terdaftar sebagai peserta seleksi Staff DIESNATALIS INFORMATIKA 18. Coba cek ulang NIM-nya, ya!"
        );
      } else if (didPass) {
        setResultTitle("YEAHHH! 🎉");
        setResultSubtitle("KAMU LOLOS!");
        setResultCopy(renderPassedCopy(result.name,  result.division));
      } else {
        setResultTitle("YAHH 😭");
        setResultSubtitle("BELUM LOLOS");
        setResultCopy(
          "Terima kasih sudah ikut dalam proses seleksi Staff DIESNATALIS INFORMATIKA 18! Tetap semangat, ya!"
        );
      }

      showScreen("result");
      requestAnimationFrame(() => requestAnimationFrame(() => setResultAnimated(true)));
      setCheckDisabled(false);

      if (didPass && !prefersReducedMotion) {
        setTimeout(() => { startConfetti(); createCelebrationBurst(); }, 180);
      }
      if (!didPass && result.found && !prefersReducedMotion) {
        setTimeout(createSadRain, 220);
      }

      setTimeout(
        () => resetButtonRef.current?.focus({ preventScroll: true }),
        prefersReducedMotion ? 30 : 950
      );
    },
    [showScreen, prefersReducedMotion, startConfetti, createCelebrationBurst, createSadRain]
  );

  const clearTimers = useCallback(() => {
    checkingTimers.current.forEach(clearTimeout);
    checkingTimers.current = [];
  }, []);

  const runCheckingSequence = useCallback(
    async (nim: string) => {
      clearTimers();
      showScreen("checking");
      setCheckDisabled(true);
      setCheckingLabel(CHECKING_STEPS[0]);

      const stepDuration = prefersReducedMotion ? 180 : 360;
      CHECKING_STEPS.slice(1).forEach((step, idx) => {
        const t = setTimeout(() => setCheckingLabel(step), stepDuration * (idx + 1));
        checkingTimers.current.push(t);
      });

      const minWait = new Promise<void>((res) =>
        setTimeout(res, stepDuration * CHECKING_STEPS.length)
      );

      try {
        const [result] = await Promise.all([fetchCheckNIM(nim), minWait]);

        // Guard race condition: kalau user reset / ganti NIM saat loading, abaikan
        if (latestNimRef.current !== nim) return;

        showResult(nim, result);
      } catch (err) {
        clearTimers();
        if (latestNimRef.current !== nim) return;
        showScreen("initial");
        setCheckDisabled(false);
        const msg =
          err instanceof Error && err.name === "AbortError"
            ? "Server lama merespons, coba lagi."
            : err instanceof Error
              ? err.message
              : "Gagal menghubungi server, coba lagi.";
        setFieldMessage(msg);
      }
    },
    [clearTimers, showScreen, prefersReducedMotion, showResult]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nim = normalizeNIM(nimValue);
    const err = validateNIM(nim);
    if (err) { setFieldMessage(err); nimInputRef.current?.focus(); return; }
    setNimValue(nim);
    setFieldMessage("");
    latestNimRef.current = nim;
    runCheckingSequence(nim);
  };

  const handleReset = useCallback(() => {
    clearTimers();
    stopConfetti();
    latestNimRef.current = null;
    document.querySelectorAll(".celebration-particle, .sad-particle").forEach((el) => el.remove());
    setResultAnimated(false);
    setResultState(null);
    setResultDivision(null);
    showScreen("initial");
    setNimValue("");
    setFieldMessage("");
    setCheckDisabled(false);
    setTimeout(() => nimInputRef.current?.focus({ preventScroll: true }), 380);
  }, [clearTimers, stopConfetti, showScreen]);

  useEffect(() => {
    const onResize = () => { if (confettiRef.current.animationId) resizeConfettiCanvas(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeConfettiCanvas]);

  const screenClass = (name: Screen) => {
    const cls = ["screen"];
    if (currentScreen !== name) cls.push("is-hidden");
    else if (enteringScreen === name) cls.push("is-entering");
    return cls.join(" ");
  };

  const resultPanelClass = [
    "result-panel",
    resultState === "passed" ? "result-panel--passed" : "",
    resultState === "failed" ? "result-panel--failed" : "",
    resultAnimated ? "is-animated" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <main className="site-shell">
        <div className="background-18" aria-hidden="true"><img src="/logo.svg" alt="bg-lo" /></div>
        <div className="dot-pattern dot-pattern--one" aria-hidden="true" />
        <div className="dot-pattern dot-pattern--two" aria-hidden="true" />
        <div className="blob blob--pink" aria-hidden="true" />
        <div className="blob blob--cyan" aria-hidden="true" />
        <span className="floating-deco deco-star-one" aria-hidden="true">★</span>
        <span className="floating-deco deco-star-two" aria-hidden="true">✦</span>
        <span className="floating-deco deco-sparkle" aria-hidden="true">✨</span>
        <span className="floating-deco deco-dot" aria-hidden="true" />
        <span className="floating-deco deco-ring" aria-hidden="true" />
        <span className="floating-deco sticker-logo" aria-hidden="true"><img src="/logo.svg" alt="stiker-logo" /></span>
        <span className="floating-deco sticker-18" aria-hidden="true">18</span>
        <svg className="squiggle squiggle--one" viewBox="0 0 100 36" aria-hidden="true">
          <path d="M5 24 C17 4, 29 34, 42 15 S68 30, 78 11 S91 15, 96 7" />
        </svg>
        <svg className="squiggle squiggle--two" viewBox="0 0 100 36" aria-hidden="true">
          <path d="M5 24 C17 4, 29 34, 42 15 S68 30, 78 11 S91 15, 96 7" />
        </svg>

        <div className="poster-frame">
          {/* INITIAL SCREEN */}
          <section className={screenClass("initial")} aria-labelledby="main-title">
            <div className="content-wrap">
              <div className="announcement-badge">STAFF ANNOUNCEMENT</div>
              <h1 className="main-title" id="main-title">
                <span className="title-top">DIESNATALIS</span>
                <span className="title-bottom">INFORMATIKA 18</span>
              </h1>
              <div className="intro-copy">
                <p className="intro-kicker">Udah siap tahu hasilnya?</p>
                <p className="intro-description">
                  Masukkan NIM kamu dan lihat apakah kamu berhasil menjadi bagian dari Staff DIESNATALIS INFORMATIKA 18!
                </p>
              </div>
              <form className="nim-form" noValidate onSubmit={handleSubmit}>
                <label className="field-label" htmlFor="nim-input">MASUKKAN NIM KAMU</label>
                <div className="input-row">
                  <input
                    ref={nimInputRef}
                    className="nim-input"
                    id="nim-input"
                    name="nim"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="H1H123456"
                    maxLength={20}
                    aria-describedby="field-message"
                    required
                    value={nimValue}
                    onChange={(e) => { setNimValue(e.target.value.toUpperCase()); setFieldMessage(""); }}
                  />
                  <button className="check-button" type="submit" disabled={checkDisabled}>
                    CEK HASIL <span className="button-sparkle" aria-hidden="true">✨</span>
                  </button>
                </div>
                <p className="field-message" id="field-message" aria-live="polite">{fieldMessage}</p>
              </form>
            </div>
          </section>

          {/* CHECKING SCREEN */}
          <section className={screenClass("checking")} aria-label="Sedang mengecek NIM" aria-live="polite" aria-busy={currentScreen === "checking"}>
            <div className="checking-panel">
              <div className="checking-orbit" aria-hidden="true">
                <span className="orbit-dot" /><span className="orbit-dot" /><span className="orbit-dot" />
                <span className="checking-center"><img src="/logo.svg" alt="" /></span>
              </div>
              <p className="checking-text">
                <span>{checkingLabel}</span>
                <span className="animated-dots" aria-hidden="true" />
              </p>
            </div>
          </section>

          {/* RESULT SCREEN */}
          <section className={screenClass("result")} aria-live="polite" aria-atomic="true">
            <div className={resultPanelClass}>
              <span className="result-mini-star result-mini-star--one" aria-hidden="true">✦</span>
              <span className="result-mini-star result-mini-star--two" aria-hidden="true">★</span>
              <div className="result-content">
                <p className="result-eyebrow">HASIL PENGUMUMAN</p>
                <h2 className="result-title">{resultTitle}</h2>
                <p className="result-subtitle">{resultSubtitle}</p>
                <p className="result-nim">{resultNim}</p>
                <p className="result-copy">{resultCopy}</p>
                <button ref={resetButtonRef} className="reset-button" type="button" onClick={handleReset}>
                  CEK NIM LAIN ↻
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
      <canvas ref={canvasRef} id="confetti-canvas" aria-hidden="true" />
    </>
  );
}