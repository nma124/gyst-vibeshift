import React, { useEffect, useMemo, useState } from "react";

// VibeShift — Clickable Mock (React + Tailwind)
// One-file demo: mood gauge, signal controls, playlist pathing, emoji feedback.
// No external APIs; everything is simulated.

// ---------- Helpers ----------
const clamp = (min, v, max) => Math.max(min, Math.min(v, max));
const lerp = (a, b, t) => a + (b - a) * t;
const easeCos = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t); // 0→1 smooth
const prettyPct = (x) => `${Math.round(x * 100)}%`;

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

function moodColor(mood) {
  // 0=red, 50=amber, 100=green
  const r = mood < 50 ? 255 : Math.round(lerp(255, 40, (mood - 50) / 50));
  const g = mood < 50 ? Math.round(lerp(60, 180, mood / 50)) : 200;
  const b = 80;
  return `rgb(${r},${g},${b})`;
}

function chip(value, unit) {
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-zinc-100 border border-white/15 backdrop-blur">
      {value}{unit}
    </span>
  );
}

// ---------- Mock Data ----------
const ART_SEEDS = [
  "Tame Impala",
  "Men I Trust",
  "KAYTRANADA",
  "Phoebe Bridgers",
  "Khruangbin",
  "ODESZA",
  "Mac DeMarco",
  "Billie Eilish",
];

const GENRE_SEEDS = ["indie-pop", "lo-fi", "r&b", "electropop", "alt-rock", "ambient", "house"];

const WORDS_A = [
  "Sunrise",
  "Neon",
  "Raincheck",
  "Citrus",
  "Granville",
  "Umbrella",
  "Skytrain",
  "Seawall",
  "Cloud",
  "Pacific",
  "Larch",
];

const WORDS_B = [
  "Drizzle",
  "Chorus",
  "Mirage",
  "Loop",
  "Stroll",
  "Arc",
  "Echo",
  "Motion",
  "Glow",
  "Haze",
  "Crescendo",
];

function randomTitle(i) {
  const a = WORDS_A[i % WORDS_A.length];
  const b = WORDS_B[(i * 3) % WORDS_B.length];
  return `${a} ${b}`;
}

function albumGradient(i) {
  const h1 = (i * 47) % 360;
  const h2 = (h1 + 140) % 360;
  return `linear-gradient(135deg, hsl(${h1},70%,60%), hsl(${h2},70%,55%))`;
}

// ---------- Core: Mood Calculation ----------
function computeMood(signals) {
  const { hrv, rhr, steps, sleepHours, precip, cloud, tempC, unempDiff, housingStress, selfReport, financeStress, eduSurprise } = signals;
  // baselines (mock personal)
  const base = { hrv: 45, rhr: 65, steps: 7000 };
  const z = (val, mu, sd) => (val - mu) / sd;
  const hrvZ = z(hrv, base.hrv, 10);
  const rhrZ = z(rhr, base.rhr, 8);
  const stepsZ = z(steps, base.steps, 3000);
  const sleepDef = Math.max(0, 7.5 - sleepHours);
  const tempComfort = 17; // comfort temp (Vancouver-ish)
  const tempDiscomfort = Math.min(1, Math.abs(tempC - tempComfort) / 17);
  const weatherGloom = 0.35 * (precip / 10) + 0.25 * (cloud / 100) + 0.4 * tempDiscomfort; // stronger temp effect

  // weights (hackathon priors)
  const w1 = 6, w2 = 5, w3 = 4, w4 = 3.5, w5 = 10, w6 = 12, w7 = 9, w8 = 6, w9 = 5, w10 = 6;

  let mood = 50;
  mood += w1 * hrvZ;           // higher HRV → calmer → up
  mood -= w2 * rhrZ;           // higher resting HR → stress → down
  mood += w3 * stepsZ;         // more steps → up
  mood -= w4 * sleepDef;       // less sleep → down
  mood -= w5 * weatherGloom;   // rainy/cloudy/cold → down
  mood -= w6 * unempDiff;      // worse major prospects → down
  mood -= w7 * housingStress;  // affordability stress → down
  mood -= w9 * financeStress;  // recent spend spike → down
  mood += w8 * (selfReport / 10);
  mood += w10 * (eduSurprise); // -1..+1 surprise from Canvas grades (bad→down, good→up)
  return clamp(0, Math.round(mood), 100);
}

// ---------- Core: Playlist Generation ----------
function makePlaylist(currentMood, cfg) {
  const { N, kv, ke, kt, kd, baseBpm, neutral } = cfg;
  const delta = 50 - currentMood; // + if we need to go up in mood
  const tracks = [];
  for (let i = 1; i <= N; i++) {
    const t = easeCos(i / N);
    const valence = clamp(0, neutral + (kv * delta * t) / 50, 1);
    const energy = clamp(0, neutral + (ke * delta * t) / 50, 1);
    const dance = clamp(0, neutral + (kd * delta * t) / 50, 1);
    const tempo = Math.round(baseBpm + kt * delta * t);
    tracks.push({
      id: `track-${i}`,
      title: randomTitle(i),
      artist: ART_SEEDS[(i + 1) % ART_SEEDS.length],
      valence,
      energy,
      dance,
      tempo,
      art: albumGradient(i),
    });
  }
  return tracks;
}

// ---------- UI Components ----------
function Gauge({ mood }) {
  const percent = mood;
  const color = moodColor(mood);
  const bg = `conic-gradient(${color} ${percent * 3.6}deg, #e5e7eb ${percent * 3.6}deg)`;
  return (
    <div className="relative w-48 h-48 sm:w-56 sm:h-56">
      <div className="absolute inset-0 rounded-full" style={{ background: bg }} />
      <div className="absolute inset-3 sm:inset-4 rounded-full bg-black/30 backdrop-blur border border-white/20 flex items-center justify-center shadow-inner">
        <div className="text-center">
          <div className="text-4xl font-bold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]">{mood}</div>
          <div className="text-xs text-zinc-400 tracking-wide">Mood</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition relative ${checked ? "bg-green-500" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

function Slider({ label, min, max, step = 1, value, unit = "", onChange }) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm text-zinc-300">
        <span>{label}</span>
        <span className="text-zinc-400">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
    </div>
  );
}

function Badge({ children }) {
  return <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-zinc-100 border border-white/15 backdrop-blur">{children}</span>;
}

function FeaturePill({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-400">{label}</span>
      <div className="h-2 w-24 bg-gray-200 rounded overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300" style={{ width: prettyPct(value) }} />
      </div>
    </div>
  );
}

function EmojiFeedback({ onSelect }) {
  const emojis = [
    { e: "😭", v: -2 },
    { e: "🙁", v: -1 },
    { e: "😐", v: 0 },
    { e: "🙂", v: 1 },
    { e: "🤩", v: 2 },
  ];
  return (
    <div className="flex items-center justify-center gap-3">
      {emojis.map((x) => (
        <button
          key={x.e}
          onClick={() => onSelect(x)}
          className="text-3xl hover:scale-110 active:scale-95 transition"
          aria-label={`Feedback ${x.e}`}
        >
          {x.e}
        </button>
      ))}
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  // Signals (mock controls)
  const [sleepHours, setSleepHours] = useLocalStorage("vs_sleep", 6.2);
  const [hrv, setHrv] = useLocalStorage("vs_hrv", 42);
  const [rhr, setRhr] = useLocalStorage("vs_rhr", 67);
  const [steps, setSteps] = useLocalStorage("vs_steps", 8200);
  const [precip, setPrecip] = useLocalStorage("vs_precip", 5); // mm
  const [cloud, setCloud] = useLocalStorage("vs_cloud", 90); // %
  const [tempC, setTempC] = useLocalStorage("vs_temp", 12);
  const [unempDiff, setUnempDiff] = useLocalStorage("vs_unemp", 0.016); // 1.6% worse than national
  const [housingStress, setHousingStress] = useLocalStorage("vs_house", 0.27); // ~27% over median
  const [spendSpike, setSpendSpike] = useLocalStorage("vs_spend", 0.20); // 0..1 recent spend anomaly
  const [financeSource, setFinanceSource] = useLocalStorage("vs_fin_source", "plaid"); // 'plaid' | 'gmail'
  const [financeConnected, setFinanceConnected] = useLocalStorage("vs_fin_conn", false);
  const [gradeSurprise, setGradeSurprise] = useLocalStorage("vs_grade", 0.0); // -1 bad to +1 great
  const [eduSource, setEduSource] = useLocalStorage("vs_edu_source", "canvas"); // 'canvas' | 'gmail'
  const [eduConnected, setEduConnected] = useLocalStorage("vs_edu_conn", false);
  const [canvasDomain, setCanvasDomain] = useLocalStorage("vs_canvas_domain", "example.instructure.com");
  const [selfReport, setSelfReport] = useLocalStorage("vs_self", -2); // -10..+10
  const [healthSource, setHealthSource] = useLocalStorage("vs_health_source", "healthkit"); // 'healthkit' | 'healthconnect'
  const [healthConnected, setHealthConnected] = useLocalStorage("vs_health_conn", false);
  const [demoMode, setDemoMode] = useLocalStorage("vs_demo", false);
  const [delayedFeedback, setDelayedFeedback] = useLocalStorage("vs_feedback_delay", true);

  const signals = { hrv, rhr, steps, sleepHours, precip, cloud, tempC, unempDiff, housingStress, selfReport, financeStress: spendSpike, eduSurprise: gradeSurprise };
  const mood = useMemo(() => computeMood(signals), [JSON.stringify(signals)]);

  // Settings
  const [explicitOK, setExplicitOK] = useLocalStorage("vs_explicit", false);
  const [noLyrics, setNoLyrics] = useLocalStorage("vs_lyrics", false);
  const [N, setN] = useLocalStorage("vs_len", 10);
  const [genres, setGenres] = useLocalStorage("vs_genres", ["indie-pop", "lo-fi", "r&b"]);

  // RL-ish knobs
  const [kv, setKv] = useLocalStorage("vs_kv", 0.6);
  const [ke, setKe] = useLocalStorage("vs_ke", 0.4);
  const [kt, setKt] = useLocalStorage("vs_kt", 0.3);
  const [kd, setKd] = useLocalStorage("vs_kd", 0.2);
  const [baseBpm, setBaseBpm] = useLocalStorage("vs_bpm", 96);
  const neutral = 0.55;

  // Playlist state
  const [tracks, setTracks] = useState([]);
  const [idx, setIdx] = useState(0);
  const [screen, setScreen] = useState("home"); // home | play | settings
  const [lastReward, setLastReward] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const startSession = () => {
    const cfg = { N, kv, ke, kt, kd, baseBpm, neutral };
    const list = makePlaylist(mood, cfg);
    setTracks(list);
    setIdx(0);
    setLastReward(null);
    setScreen("play");
  };

  const next = () => setIdx((i) => clamp(0, i + 1, tracks.length - 1));
  const prev = () => setIdx((i) => clamp(0, i - 1, tracks.length - 1));

  const onFeedback = ({ e, v }) => {
    setLastReward({ e, v });
    // tiny bandit-ish update: nudge curve based on sign
    const nud = v / 50; // small
    setKv((x) => clamp(0, x + nud, 1));
    setKe((x) => clamp(0, x + nud * 0.8, 1));
    setKt((x) => clamp(-1, x + nud * 0.6, 1));
    setKd((x) => clamp(0, x + nud * 0.4, 1));
    setToast(v >= 1 ? "Nice! We’ll lean into that next time." : v <= -1 ? "Got it. We’ll soften the curve next time." : "Thanks for the signal.");
  };

  const handleConnectHealth = () => {
    setHealthConnected(true);
    setToast(healthSource === "healthkit" ? "Simulated: HealthKit connected" : "Simulated: Health Connect connected");
    // Optionally nudge values to show effect
    setSleepHours(6.8); setHrv(45); setRhr(64); setSteps(9000);
  };

  const applyDemoPreset = () => {
    setHealthSource("healthkit");
    setHealthConnected(true);
    setFinanceSource("plaid");
    setFinanceConnected(true);
    setSleepHours(6.0);
    setHrv(38);
    setRhr(70);
    setSteps(5800);
    setPrecip(8);
    setCloud(95);
    setTempC(11);
    setUnempDiff(0.02);
    setHousingStress(0.30);
    setSpendSpike(0.35);
    setN(10);
    setGenres(["indie-pop","lo-fi","r&b"]);
    setKv(0.6); setKe(0.4); setKt(0.3); setKd(0.2); setBaseBpm(96);
    setScreen("home");
  };
  const remindLater = () => { setToast("We'll ask again in ~2h (simulated)"); };

  // Canvas OAuth (simulated)
  const completeCanvasOAuth = () => {
    setEduConnected(true);
    setToast(`Canvas connected: ${canvasDomain}`);
    setScreen("settings");
  };

  // ---- UI Layout ----
  return (
    <div className="min-h-screen relative text-zinc-100 bg-gradient-to-b from-[#0b0f19] via-[#070a12] to-[#04060a]">
      {/* Decorative background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.35), transparent 60%)," +
              "radial-gradient(1.5px 1.5px at 70% 20%, rgba(255,255,255,0.30), transparent 60%)," +
              "radial-gradient(1.5px 1.5px at 40% 80%, rgba(255,255,255,0.25), transparent 60%)",
          }}
        />
        <div
          className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle at center, rgba(99,102,241,0.35), transparent 60%)" }}
        />
        <div
          className="absolute -bottom-40 -right-32 w-[40rem] h-[40rem] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle at center, rgba(34,211,238,0.28), transparent 60%)" }}
        />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-white/10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg" style={{ background: albumGradient(11) }} />
            <h1 className="font-semibold tracking-tight">VibeShift</h1>
            <span className="text-xs text-zinc-400">Mood DJ</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <button onClick={() => setScreen("home")} className={`px-3 py-1.5 rounded-lg ${screen === "home" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "hover:bg-white/10"}`}>Home</button>
            <button onClick={() => setScreen("play")} className={`px-3 py-1.5 rounded-lg ${screen === "play" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "hover:bg-white/10"}`}>Now Playing</button>
            <button onClick={() => setScreen("settings")} className={`px-3 py-1.5 rounded-lg ${screen === "settings" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "hover:bg-white/10"}`}>Settings</button>
            <button onClick={() => setScreen("how")} className={`px-3 py-1.5 rounded-lg ${screen === "how" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "hover:bg-white/10"}`}>How it works</button>
            <button
              onClick={() => { const nv = !demoMode; setDemoMode(nv); if(nv){ applyDemoPreset(); setToast("Judge Demo preset loaded"); } else { setToast("Judge Demo off"); } }}
              className={`px-3 py-1.5 rounded-lg ${demoMode ? "bg-emerald-600 text-white" : "hover:bg-white/10"}`}
              aria-pressed={demoMode}
            >
              Demo
            </button>
          </nav>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 top-20 z-50 px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 border border-white/15 text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {screen === "home" && (
          <section className="grid md:grid-cols-2 gap-6">
            {/* Left: Gauge & CTA */}
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <div className="flex items-center gap-6">
                <Gauge mood={mood} />
                <div className="space-y-3">
                  <div className="text-sm text-zinc-400">Target setpoint <b>50</b></div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{mood < 50 ? "Need uplifting" : mood > 50 ? "Tapering" : "Balanced"}</Badge>
                    <Badge>Δ to neutral: {Math.abs(50 - mood)}</Badge>
                    <Badge>Rain: {precip > 0 ? `${precip}mm` : "none"}</Badge>
                    <Badge>Cloud: {cloud}%</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{healthConnected ? `Health: Connected ✓ (${healthSource === "healthkit" ? "HealthKit" : "Health Connect"})` : "Health: Not connected"}</Badge>
                    <button onClick={handleConnectHealth} className="px-2 py-1 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-xs backdrop-blur">
                      {healthConnected ? "Reconnect" : "Connect Health"}
                    </button>
                    <button onClick={() => setScreen("settings")} className="px-2 py-1 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-xs backdrop-blur">
                      Choose Source
                    </button>
                  </div>
                  <button
                    onClick={startSession}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500/70 to-cyan-400/70 text-white shadow-lg hover:from-indigo-400/80 hover:to-cyan-300/80 border border-white/10 backdrop-blur"
                  >
                    Start Mood Shift ({N} tracks)
                  </button>
                  <div className="text-xs text-zinc-400">We’ll tailor the curve from your current state toward neutral.</div>
                </div>
              </div>
            </div>

            {/* Right: Signal controls */}
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">Today’s Signals</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Slider label="Sleep" min={3} max={10} step={0.1} value={sleepHours} unit="h" onChange={setSleepHours} />
                  <Slider label="HRV (SDNN)" min={20} max={80} step={1} value={hrv} unit=" ms" onChange={setHrv} />
                  <Slider label="Resting HR" min={48} max={90} step={1} value={rhr} unit=" bpm" onChange={setRhr} />
                  <Slider label="Steps" min={0} max={15000} step={100} value={steps} unit="" onChange={setSteps} />
                </div>
                <div>
                  <Slider label="Precipitation" min={0} max={20} step={1} value={precip} unit=" mm" onChange={setPrecip} />
                  <Slider label="Cloud Cover" min={0} max={100} step={1} value={cloud} unit="%" onChange={setCloud} />
                  <Slider label="Temperature" min={-5} max={30} step={1} value={tempC} unit=" °C" onChange={setTempC} />
                  <Slider label="Self‑report" min={-10} max={10} step={1} value={selfReport} unit="" onChange={setSelfReport} />
                </div>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
                  <div className="text-xs text-zinc-400 mb-1">Macro (cached)</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {chip(`${(unempDiff * 100).toFixed(1)}`, "% vs natl")}
                    {chip(`${Math.round(housingStress * 100)}`, "% HPI ↑ vs median")}
                    {chip(`${Math.round(spendSpike * 100)}`, "% spend spike 24h")}
                    {chip(`${Math.round((gradeSurprise + 1) * 50)}`, "% grade surprise")}
                  </div>
                  <Slider label="Unemployment diff" min={-0.03} max={0.06} step={0.001} value={unempDiff} onChange={setUnempDiff} />
                  <Slider label="Housing stress" min={-0.1} max={0.6} step={0.01} value={housingStress} onChange={setHousingStress} />
                  <Slider label="Spend spike (24h vs avg)" min={0} max={1} step={0.01} value={spendSpike} onChange={setSpendSpike} />
                  <Slider label="Grade surprise (last 7d)" min={-1} max={1} step={0.05} value={gradeSurprise} onChange={setGradeSurprise} />
                </div>
                <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
                  <div className="text-xs text-zinc-400 mb-2">Playlist preview targets</div>
                  <div className="flex flex-col gap-2">
                    <FeaturePill label="Valence" value={clamp(0, 0.55 + (kv * (50 - mood)) / 100, 1)} />
                    <FeaturePill label="Energy" value={clamp(0, 0.55 + (ke * (50 - mood)) / 100, 1)} />
                    <FeaturePill label="Danceability" value={clamp(0, 0.55 + (kd * (50 - mood)) / 100, 1)} />
                    <div className="text-xs text-zinc-400">Tempo target: {Math.round(baseBpm + kt * (50 - mood))} BPM</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "play" && (
          <section className="grid lg:grid-cols-3 gap-6">
            {/* Now Playing Card */}
            <div className="lg:col-span-2 p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              {tracks.length === 0 ? (
                <div className="text-sm text-zinc-400">No playlist yet. Start a session from Home.</div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-full sm:w-64 aspect-square rounded-2xl shadow" style={{ background: tracks[idx].art }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-semibold">{tracks[idx].title}</h3>
                        <div className="text-zinc-400 text-sm">{tracks[idx].artist}</div>
                      </div>
                      <Badge>Track {idx + 1} / {tracks.length}</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10 text-center">
                        <div className="text-xs text-zinc-400">Valence</div>
                        <div className="text-sm font-medium">{prettyPct(tracks[idx].valence)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10 text-center">
                        <div className="text-xs text-zinc-400">Energy</div>
                        <div className="text-sm font-medium">{prettyPct(tracks[idx].energy)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10 text-center">
                        <div className="text-xs text-zinc-400">Dance</div>
                        <div className="text-sm font-medium">{prettyPct(tracks[idx].dance)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10 text-center">
                        <div className="text-xs text-zinc-400">Tempo</div>
                        <div className="text-sm font-medium">{tracks[idx].tempo} BPM</div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center gap-3">
                      <button onClick={prev} className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-zinc-100 hover:bg-white/20 backdrop-blur">Prev</button>
                      <button onClick={next} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500/70 to-cyan-400/70 text-white hover:from-indigo-400/80 hover:to-cyan-300/80 border border-white/10 backdrop-blur">Next</button>
                    </div>

                    {idx === tracks.length - 1 && (
                      <div className="mt-6 p-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
                        <div className="text-sm font-medium mb-2">How did this set move you toward neutral?</div>
                        <EmojiFeedback onSelect={onFeedback} />
                        {delayedFeedback && (
                          <div className="mt-3 text-xs">
                            <button onClick={remindLater} className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-zinc-100 backdrop-blur">Remind me in ~2h</button>
                          </div>
                        )}
                        {lastReward && (
                          <div className="mt-2 text-xs text-emerald-700">
                            Thanks! You picked {lastReward.e}. Curve updated slightly for next time.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Path Card */}
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-3">Path to Neutral</h3>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Start: {mood}</Badge>
                <Badge>Target: 50</Badge>
                <Badge>Δ {Math.abs(50 - mood)}</Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {tracks.map((t, i) => {
                  const done = i < idx;
                  const active = i === idx;
                  const bg = done ? "bg-emerald-500" : active ? "bg-gray-900" : "bg-gray-200";
                  return <span key={t.id} className={`h-2 w-8 rounded ${bg}`} />;
                })}
              </div>
              <div className="mt-4 space-y-2 text-xs text-zinc-400">
                <div>We gradually adjust **valence**, **energy**, **tempo**, and **danceability** over the set. Early tracks sit closer to your current state, then ease toward neutral.</div>
                <div className="italic">Tip: tweak curve strength in Settings → Advanced.</div>
              </div>
            </div>
          </section>
        )}

        {screen === "settings" && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">Preferences</h3>
              <Toggle label="Allow explicit" checked={explicitOK} onChange={setExplicitOK} />
              <Toggle label="No‑lyrics focus mode" checked={noLyrics} onChange={setNoLyrics} />
              <Toggle label="Ask me later about how the set felt" checked={delayedFeedback} onChange={setDelayedFeedback} />
              <Slider label="Session length" min={5} max={15} step={1} value={N} onChange={setN} />
              <div className="mt-2 text-xs text-zinc-400">Seeds (genres):</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {GENRE_SEEDS.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => setGenres(on ? genres.filter((x) => x !== g) : [...genres, g])}
                      className={`px-3 py-1.5 rounded-full border ${on ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            
              {/* Health Data Source */}
              <div className="mt-6 pt-4 border-t">
                <div className="text-sm font-medium mb-2">Health Data Source</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    className={`px-3 py-1.5 rounded-full border ${healthSource === "healthkit" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    onClick={() => setHealthSource("healthkit")}
                  >
                    HealthKit (iOS) — Recommended
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-full border ${healthSource === "healthconnect" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    onClick={() => setHealthSource("healthconnect")}
                  >
                    Health Connect (Android)
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleConnectHealth} className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-zinc-100 hover:bg-white/20 backdrop-blur">
                    {healthConnected ? "Connected ✓" : "Connect Health"}
                  </button>
                  <div className="text-xs text-zinc-400">
                    Real reads happen on-device via {healthSource === "healthkit" ? "HealthKit" : "Health Connect"}. Demo can still use sliders.
                  </div>
                </div>
              </div>

              {/* Finance Source */}
              <div className="mt-6 pt-4 border-t">
                <div className="text-sm font-medium mb-2">Finance Signal Source</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    className={`px-3 py-1.5 rounded-full border ${financeSource === "plaid" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    onClick={() => setFinanceSource("plaid")}
                  >
                    Plaid (default)
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-full border ${financeSource === "gmail" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    onClick={() => setFinanceSource("gmail")}
                  >
                    Gmail Receipts
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setFinanceConnected(true); setToast(financeSource === "plaid" ? "Simulated: Plaid linked" : "Simulated: Gmail connected"); }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-zinc-100 hover:bg-white/20 backdrop-blur"
                  >
                    {financeConnected ? "Connected ✓" : (financeSource === "plaid" ? "Connect via Plaid" : "Connect Gmail")}
                  </button>
                  <div className="text-xs text-zinc-400">
                    Demo uses the <b>Spend spike</b> slider on Home → Macro.
                  </div>
                </div>
              </div>

              {/* Education Source */}
              <div className="mt-6 pt-4 border-t">
                <div className="text-sm font-medium mb-2">Education Signal Source</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    className={`px-3 py-1.5 rounded-full border ${eduSource === "canvas" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    onClick={() => setEduSource("canvas")}
                  >
                    Canvas (default)
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-full border ${eduSource === "gmail" ? "bg-white/20 text-white border-white/30 ring-1 ring-white/20" : "bg-white/5 text-zinc-200 hover:bg-white/10 border-white/15"}`}
                    onClick={() => setEduSource("gmail")}
                  >
                    Grade Emails (Gmail)
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { if (eduSource === "canvas") { setScreen("canvas"); } else { setEduConnected(true); setToast("Simulated: Gmail connected"); } }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-zinc-100 hover:bg-white/20 backdrop-blur"
                  >
                    {eduConnected ? "Connected ✓" : (eduSource === "canvas" ? "Connect Canvas" : "Connect Gmail")}
                  </button>
                  <div className="text-xs text-zinc-400">
                    Real app uses Canvas OAuth or polls Canvas API; demo uses the <b>Grade surprise</b> slider.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">Advanced (Curve)</h3>
              <div className="grid grid-cols-2 gap-4">
                <Slider label="Valence gain (k_v)" min={0} max={1} step={0.05} value={kv} onChange={setKv} />
                <Slider label="Energy gain (k_e)" min={0} max={1} step={0.05} value={ke} onChange={setKe} />
                <Slider label="Tempo gain (k_t)" min={-1} max={1} step={0.05} value={kt} onChange={setKt} />
                <Slider label="Dance gain (k_d)" min={0} max={1} step={0.05} value={kd} onChange={setKd} />
                <Slider label="Base tempo (BPM)" min={70} max={140} step={1} value={baseBpm} onChange={setBaseBpm} />
              </div>
              <div className="mt-3 text-xs text-zinc-400">These control how aggressively we move from your current mood toward neutral across the set.</div>
              <div className="mt-4">
                <button
                  onClick={() => setScreen("home")}
                  className="inline-flex items-center justify-center gap-2 bg-white/20 text-white border-white/30 ring-1 ring-white/20 px-4 py-2 rounded-xl hover:bg-black transition shadow"
                >
                  Save & Back to Home
                </button>
              </div>
            </div>
          </section>
        )}

        {screen === "canvas" && (
          <section className="max-w-3xl mx-auto p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
            <h3 className="font-medium mb-1">Connect Canvas (OAuth stub)</h3>
            <p className="text-sm text-zinc-400 mb-4">Enter your institution domain (e.g., <code>school.instructure.com</code>), review scopes, and authorize.</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-4">
              <div className="flex-1 w-full">
                <label className="block text-xs text-zinc-400 mb-1">Canvas Domain</label>
                <input value={canvasDomain} onChange={e=>setCanvasDomain(e.target.value)} className="w-full px-3 py-2 rounded-lg border" placeholder="example.instructure.com" />
              </div>
              <button onClick={completeCanvasOAuth} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500/70 to-cyan-400/70 text-white hover:from-indigo-400/80 hover:to-cyan-300/80 border border-white/10 backdrop-blur">Authorize</button>
              <button onClick={()=>setScreen("settings")} className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-zinc-100 hover:bg-white/20 backdrop-blur">Cancel</button>
            </div>
            <div className="text-xs text-zinc-400">Requested scopes: read courses, submissions/grades.</div>
          </section>
        )}

        {screen === "how" && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">1) Read your signals</h3>
              <ul className="list-disc ml-5 text-sm text-zinc-300 space-y-1">
                <li>Health: Sleep, HRV (SDNN), Resting HR, Steps</li>
                <li>Weather: rain/cloud/<b>temp deviation</b></li>
                <li>Macro: unemployment (major), housing (HPI), finance (Plaid), education (Canvas)</li>
                <li>Optional: quick self-report</li>
              </ul>
            </div>
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">2) Quantify mood (0–100)</h3>
              <p className="text-sm text-zinc-300">Start at 50 (neutral). Personal z-scores raise/lower it; external stressors nudge it. All clamped to 0–100.</p>
            </div>
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">3) Playlist path</h3>
              <p className="text-sm text-zinc-300">We map Δ to 50 → target valence/energy/tempo/danceability per track with a smooth ease curve.</p>
            </div>
            <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
              <h3 className="font-medium mb-2">4) Learn from emojis</h3>
              <p className="text-sm text-zinc-300">😭 −2 … 🤩 +2 tunes the curve gains and your musicEffectToMood ratio. Optional delayed check-in refines it.</p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-zinc-400">
        © 2025 VibeShift — Mashup Mania demo. Built with React & Tailwind.
      </footer>
    </div>
  );
}
