// Persistent state в localStorage. Единственная точка изменения state.

import {
  STORAGE_KEY, BACKUP_KEY, BACKUP_TS_KEY,
  STATE_VERSION, LEGACY_VERSION, MAX_LEVEL,
  SESSION_GAP_MS, BACKUP_INTERVAL_MS, DEFAULT_DAILY_GOAL, DAY_MS,
} from './config.js';
import { WORDS } from './words.js';
import { todayStr, dateStrFor } from './utils.js';

export let state = null;
export function setState(s) { state = s; }

export function createEmptyState() {
  const now = Date.now();
  return {
    version: STATE_VERSION,
    words: {},
    reports: [],
    stats: {
      totalRounds: 0, firstTryCorrect: 0,
      correctAttempts: 0, wrongAttempts: 0,
      history: [],
    },
    session: {
      startedAt: now, rounds: 0,
      firstTryCorrect: 0, correctAttempts: 0, wrongAttempts: 0,
    },
    daily: { date: todayStr(), rounds: 0, goal: DEFAULT_DAILY_GOAL },
    dailyStreak: { current: 0, best: 0, lastActiveDate: "" },
    meta: { createdAt: now, lastSaved: now, lastActivity: now },
  };
}

function normalizeWordState(raw) {
  return {
    level: Math.max(0, Math.min(MAX_LEVEL, raw.level ?? 0)),
    errors: Math.max(0, raw.errors ?? 0),
    correct: Math.max(0, raw.correct ?? 0),
    correctAttempts: Math.max(0, raw.correctAttempts ?? raw.correct ?? 0),
    wrongAttempts: Math.max(0, raw.wrongAttempts ?? raw.errors ?? 0),
    reps: Math.max(0, raw.reps ?? 0),
    consecutiveErrors: Math.max(0, raw.consecutiveErrors ?? 0),
    lastReview: raw.lastReview ?? 0,
    nextReview: raw.nextReview ?? 0,
    firstSeen: raw.firstSeen ?? 0,
  };
}

export function migrateV2toV3(old) {
  const s = createEmptyState();
  const newWords = {};
  Object.entries(old.words || {}).forEach(([key, val]) => {
    let newKey = key;
    const m = key.match(/^w_(\d+)$/);
    if (m) {
      const idx = parseInt(m[1], 10);
      if (WORDS[idx]) newKey = WORDS[idx].id;
      else return;
    }
    if (newWords[newKey]) return;
    newWords[newKey] = normalizeWordState(val);
  });
  s.words = newWords;
  s.stats = {
    totalRounds: old.stats?.totalRounds ?? 0,
    firstTryCorrect: old.stats?.firstTryCorrect ?? 0,
    correctAttempts: old.stats?.correctAttempts ?? 0,
    wrongAttempts: old.stats?.wrongAttempts ?? 0,
    history: [],
  };
  s.session = {
    startedAt: old.session?.startedAt ?? Date.now(),
    rounds: old.session?.rounds ?? 0,
    firstTryCorrect: old.session?.firstTryCorrect ?? 0,
    correctAttempts: old.session?.correctAttempts ?? 0,
    wrongAttempts: old.session?.wrongAttempts ?? 0,
  };
  s.meta = {
    createdAt: old.meta?.createdAt ?? Date.now(),
    lastSaved: old.meta?.lastSaved ?? Date.now(),
    lastActivity: old.meta?.lastSaved ?? Date.now(),
  };
  return s;
}

export function loadState() {
  let loaded = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) loaded = JSON.parse(raw);
  } catch (e) { console.warn("Основное состояние повреждено:", e); }

  if (loaded && loaded.words && loaded.stats) {
    if (loaded.version === STATE_VERSION) {
      state = loaded;
    } else if (loaded.version === LEGACY_VERSION) {
      state = migrateV2toV3(loaded);
      console.info("Миграция v2 → v3");
    }
  }

  if (!state) {
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const data = JSON.parse(backup);
        if (data.version === STATE_VERSION) state = data;
        else if (data.version === LEGACY_VERSION) state = migrateV2toV3(data);
      }
    } catch (e) { console.warn("Резервная копия повреждена:", e); }
  }

  if (!state) state = createEmptyState();

  Object.entries(state.words).forEach(([id, s]) => {
    state.words[id] = normalizeWordState(s);
  });
  if (!state.reports) state.reports = [];
  if (!state.stats.history) state.stats.history = [];
  if (!state.session) state.session = createEmptyState().session;
  if (!state.meta) state.meta = createEmptyState().meta;
  if (!state.daily) state.daily = { date: todayStr(), rounds: 0, goal: DEFAULT_DAILY_GOAL };
  if (!state.dailyStreak) state.dailyStreak = { current: 0, best: 0, lastActiveDate: "" };

  checkSessionRotation();
}

export function saveState() {
  try {
    state.meta.lastSaved = Date.now();
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    const lastBackup = Number(localStorage.getItem(BACKUP_TS_KEY) || 0);
    if (Date.now() - lastBackup > BACKUP_INTERVAL_MS) {
      localStorage.setItem(BACKUP_KEY, serialized);
      localStorage.setItem(BACKUP_TS_KEY, String(Date.now()));
    }
  } catch (e) { console.error("Не удалось сохранить:", e); }
}

export function forceBackup() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
    localStorage.setItem(BACKUP_TS_KEY, String(Date.now()));
  } catch (e) {}
}

export function touchActivity() {
  state.meta.lastActivity = Date.now();
}

function checkSessionRotation() {
  const last = state.meta.lastActivity || 0;
  if (last > 0 && Date.now() - last > SESSION_GAP_MS) {
    archiveCurrentSession();
  }
}

function archiveCurrentSession() {
  const s = state.session;
  if (s && (s.rounds > 0 || s.correctAttempts > 0 || s.wrongAttempts > 0)) {
    state.stats.history.push({
      startedAt: s.startedAt, endedAt: Date.now(),
      rounds: s.rounds, firstTryCorrect: s.firstTryCorrect,
      correctAttempts: s.correctAttempts, wrongAttempts: s.wrongAttempts,
    });
    while (state.stats.history.length > 10) state.stats.history.shift();
  }
  state.session = {
    startedAt: Date.now(), rounds: 0,
    firstTryCorrect: 0, correctAttempts: 0, wrongAttempts: 0,
  };
}

export function updateDailyOnRound() {
  const today = todayStr();
  if (state.daily.date !== today) {
    state.daily = { date: today, rounds: 0, goal: state.daily.goal || DEFAULT_DAILY_GOAL };
  }
  state.daily.rounds++;

  const ds = state.dailyStreak;
  if (ds.lastActiveDate !== today) {
    const yesterday = dateStrFor(Date.now() - DAY_MS);
    if (ds.lastActiveDate === yesterday) ds.current++;
    else ds.current = 1;
    ds.lastActiveDate = today;
    if (ds.current > ds.best) ds.best = ds.current;
  }
}

export function ensureWordState(id) {
  if (!state.words[id]) {
    state.words[id] = normalizeWordState({ firstSeen: Date.now() });
  }
  return state.words[id];
}
