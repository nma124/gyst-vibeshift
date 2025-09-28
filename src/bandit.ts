// VibeShift — Frontend API shim for the Bandit backend
// -----------------------------------------------------
// Drop this file into your React project (e.g., src/lib/bandit.ts)
// and set VITE_BANDIT_API=http://localhost:8080
//
// Usage sketch in a component:
//   import { banditAct, recommend, banditUpdate, buildContext, rewardFromSession } from "./bandit";
//   const ctx = buildContext(uiState);
//   const act = await banditAct(userId, ctx);
//   const rec = await recommend(uiState.mood, uiState.baseBpm, act.action);
//   // ... render rec.targets as the path ...
//   const r = rewardFromSession({ endMood: 47, emoji: +1, completionPct: 0.9, skips: 1 });
//   await banditUpdate(userId, act.action_id, ctx, r);

export const API_BASE = (import.meta as any)?.env?.VITE_BANDIT_API || "http://localhost:8080";

export type Context = {
  start_mood: number; // 0..100
  base_bpm: number;
  explicit_ok: boolean;
  no_lyrics: boolean;
  daypart: number; // 0..23
  sleep_deficit_h: number; // + if slept less than baseline
  hrv_z: number;
  rhr_z: number;
  steps_z: number;
  gloom_index: number; // 0..1
  spend_anomaly: number; // 0..1
  grade_surprise: number; // -1..+1
  genre_cluster: number; // 0..4
};

export type Action = {
  id: string;
  kv: number; ke: number; kt: number; kd: number;
  tempo_offset: number; N: number; instrumental: 0|1;
};

export type ActResponse = {
  action_id: string;
  action: Action;
  propensity: number;
  expected_score: number;
  targets_preview: any;
  server_time: number;
};

export type TrackTarget = { index: number; valence: number; energy: number; dance: number; tempo: number };

export async function banditAct(user_id: string, context: Context): Promise<ActResponse> {
  const r = await fetch(`${API_BASE}/bandit/act`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, context }),
  });
  if (!r.ok) throw new Error(`bandit/act ${r.status}`);
  return r.json();
}

export async function banditUpdate(user_id: string, action_id: string, context: Context, reward: number) {
  const r = await fetch(`${API_BASE}/bandit/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, action_id, context, reward }),
  });
  if (!r.ok) throw new Error(`bandit/update ${r.status}`);
  return r.json();
}

export async function recommend(start_mood: number, base_bpm: number, action: Action) {
  const r = await fetch(`${API_BASE}/playlist/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_mood, base_bpm, action }),
  });
  if (!r.ok) throw new Error(`playlist/recommend ${r.status}`);
  return r.json() as Promise<{ targets: TrackTarget[] }>;
}

// --------------------
// Helpers
// --------------------
const clamp = (a:number, x:number, b:number) => Math.max(a, Math.min(b, x));
const z = (x:number, mu:number, sd:number) => (sd>0 ? (x-mu)/sd : 0);

export type UIState = {
  mood: number; baseBpm: number; allowExplicit: boolean; noLyrics: boolean;
  sleepHours: number; sleepBaseline?: number;
  hrv: number; hrvMu?: number; hrvSd?: number;
  rhr: number; rhrMu?: number; rhrSd?: number;
  steps: number; stepsMu?: number; stepsSd?: number;
  precip: number; cloud: number; tempC: number;
  spendSpike: number; gradeSurprise: number; genres: string[];
};

export function computeGloomIndex(precip:number, cloud:number, tempC:number){
  const comfort = 17; // °C
  const tempDiscomfort = Math.min(1, Math.abs(tempC - comfort)/17);
  return 0.35 * clamp(0, precip/10, 1) + 0.25 * clamp(0, cloud/100, 1) + 0.40 * tempDiscomfort;
}

function genreClusterFromSeeds(seeds: string[]): number {
  // Tiny heuristic buckets for the demo
  const s = (seeds || []).map(x=>x.toLowerCase());
  if (s.some(x=>x.includes("lo-fi") || x.includes("chill"))) return 1;
  if (s.some(x=>x.includes("indie") || x.includes("alt"))) return 2;
  if (s.some(x=>x.includes("r&b") || x.includes("soul"))) return 3;
  if (s.some(x=>x.includes("edm") || x.includes("house"))) return 4;
  return 0;
}

export function buildContext(ui: UIState): Context {
  const sleepBaseline = ui.sleepBaseline ?? 7.5;
  const hrvMu = ui.hrvMu ?? 45, hrvSd = ui.hrvSd ?? 12;
  const rhrMu = ui.rhrMu ?? 64, rhrSd = ui.rhrSd ?? 8;
  const stepsMu = ui.stepsMu ?? 8000, stepsSd = ui.stepsSd ?? 2500;

  return {
    start_mood: clamp(0, ui.mood, 100),
    base_bpm: Math.round(ui.baseBpm || 96),
    explicit_ok: !!ui.allowExplicit,
    no_lyrics: !!ui.noLyrics,
    daypart: new Date().getHours(),
    sleep_deficit_h: Math.max(0, sleepBaseline - ui.sleepHours),
    hrv_z: z(ui.hrv, hrvMu, hrvSd),
    rhr_z: z(ui.rhr, rhrMu, rhrSd),
    steps_z: z(ui.steps, stepsMu, stepsSd),
    gloom_index: computeGloomIndex(ui.precip, ui.cloud, ui.tempC),
    spend_anomaly: clamp(0, ui.spendSpike, 1),
    grade_surprise: clamp(-1, ui.gradeSurprise, 1),
    genre_cluster: genreClusterFromSeeds(ui.genres),
  };
}

export function rewardFromSession(p: { endMood: number; emoji: -2|-1|0|1|2; completionPct: number; skips: number; delayed?: -2|-1|0|1|2 }){
  const SETPOINT = 50;
  const lam1=0.5, lam2=0.3, lam3=0.15, lam4=0.05, lam5=0.1;
  const toward = (SETPOINT - Math.abs(p.endMood - SETPOINT))/SETPOINT; // 0..1
  let r = lam1 * toward + lam2 * (p.emoji/2) + lam3 * clamp(0, p.completionPct, 1) - lam4 * Math.min(p.skips/5,1);
  if (typeof p.delayed === "number") r += lam5 * (p.delayed/2);
  return clamp(-1, r, 1);
}

// Optional convenience: simple client that runs act -> recommend in one call
export async function getCurveAndTargets(user_id: string, ui: UIState){
  const context = buildContext(ui);
  const act = await banditAct(user_id, context);
  const rec = await recommend(ui.mood, ui.baseBpm, act.action);
  return { act, rec, context };
}
