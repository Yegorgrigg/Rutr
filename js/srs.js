// SRS: приоритеты, выбор слова, предикаты фильтров.

import { state } from './storage.js';
import { runtime } from './state.js';
import { WORDS } from './words.js';
import { MAX_LEVEL } from './config.js';

export function isNew(w)      { const s = state.words[w.id]; return !s || s.reps === 0; }
export function isHard(w)     { const s = state.words[w.id]; return !!(s && s.errors > 0 && s.level < 3); }
export function hasErrors(w)  { const s = state.words[w.id]; return !!(s && s.errors > 0); }
export function isReview(w)   { const s = state.words[w.id]; return !!(s && s.reps > 0 && s.nextReview <= Date.now()); }
export function isMastered(w) { const s = state.words[w.id]; return !!(s && s.level >= MAX_LEVEL); }

export function priorityOf(id) {
  const s = state.words[id];
  if (!s || s.reps === 0) return 5;
  if (s.nextReview <= Date.now()) {
    return 30 + s.errors * 3 + (MAX_LEVEL - s.level) * 2;
  }
  return 1;
}

export function currentPool() {
  let pool = WORDS;
  if (runtime.taskFilter !== "all") {
    const t = Number(runtime.taskFilter);
    pool = pool.filter(w => w.t === t);
  }
  if (runtime.errorMode) return pool.filter(isHard);

  switch (runtime.progressFilter) {
    case "errors": pool = pool.filter(hasErrors); break;
    case "new":    pool = pool.filter(isNew); break;
    case "review": pool = pool.filter(isReview); break;
    case "hard":   pool = pool.filter(isHard); break;
  }
  return pool;
}

export function hardCountWithTaskFilter() {
  let pool = WORDS;
  if (runtime.taskFilter !== "all") pool = pool.filter(w => w.t === Number(runtime.taskFilter));
  return pool.filter(isHard).length;
}

export function pickFromPool(pool, excludeId) {
  let candidates = pool;
  if (candidates.length > 1 && excludeId) {
    const filtered = candidates.filter(w => w.id !== excludeId);
    if (filtered.length > 0) candidates = filtered;
  }
  const weights = candidates.map(w => priorityOf(w.id));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}