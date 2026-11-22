// Игровой цикл: раунд, ответ, конец раунда + режим отработки ошибок.

import {
  state, saveState, ensureWordState, touchActivity, updateDailyOnRound,
} from './storage.js';
import { runtime } from './state.js';
import { currentPool, pickFromPool, hardCountWithTaskFilter, isHard } from './srs.js';
import {
  renderWord, setGap, showFeedback, showToast, updateFooterStats,
} from './ui.js';
import { openReportDialog } from './report.js';
import { WORDS } from './words.js';
import { MAX_LEVEL, ERROR_BASE_MS, ERROR_MAX_MS, SRS_INTERVALS_DAYS, DAY_MS } from './config.js';
import { esc, plural } from './utils.js';

const $ = id => document.getElementById(id);

let current = null;
let phase = "question";
let wrongSubmits = 0;
let previousWordId = null;

export function newRound() {
  if (runtime.errorMode && currentPool().length === 0) {
    exitErrorMode();
    showToast("🎉 Все ошибки отработаны!");
  }

  const pool = currentPool();
  if (pool.length === 0) { showEmptyState(); return; }

  current = pickFromPool(pool, previousWordId);
  if (!current) { showEmptyState(); return; }

  previousWordId = current.id;
  ensureWordState(current.id);
  saveState();

  phase = "question"; wrongSubmits = 0;
  $("taskLabel").textContent = `Задание ${current.t}`;
  renderWord(current);

  const card = $("card");
  if (card) card.className = "card";

  const inp = $("answerInput");
  inp.value = ""; inp.disabled = false; inp.className = "answer-input";

  $("submitBtn").disabled = false;
  $("feedback").className = "feedback";
  $("feedback").innerHTML = "";
  $("actions").classList.remove("show");

  requestAnimationFrame(() => inp.focus({ preventScroll: true }));
  updateFooterStats();
}

export function submitAnswer() {
  if (phase !== "question" || !current) return;
  const s = ensureWordState(current.id);
  const inp = $("answerInput");
  const raw = inp.value.trim().toLowerCase().replace(/ё/g, "е");
  if (!raw) { inp.focus(); return; }

  const norm = x => x.replace(/ё/g, "е");
  touchActivity();

  if (norm(raw) === norm(current.a.toLowerCase())) {
    inp.classList.add("ok");
    inp.disabled = true;
    setGap(current.a, "ok");
    $("card").className = "card correct";
    s.correctAttempts++;
    state.stats.correctAttempts++;
    state.session.correctAttempts++;

    const firstTry = wrongSubmits === 0;
    if (firstTry) {
      runtime.streak++;
      state.stats.firstTryCorrect++;
      state.session.firstTryCorrect++;
      showFeedback("ok", "Верно", "");
    } else {
      showFeedback("ok", "Верно со второй попытки", "Слово вернётся для закрепления.");
    }
    endRound();
    return;
  }

  inp.classList.add("err");
  $("card").className = "card incorrect";
  s.wrongAttempts++;
  state.stats.wrongAttempts++;
  state.session.wrongAttempts++;
  wrongSubmits++;
  runtime.streak = 0;

  setTimeout(() => inp.classList.remove("err"), 500);

  if (wrongSubmits === 1) {
    inp.value = "";
    showFeedback("err", "Правило",
      esc(current.r) + "<br><br>Попробуйте ещё раз.",
      () => openReportDialog(current));
    setTimeout(() => {
      inp.focus({ preventScroll: true });
      inp.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    updateFooterStats();
  } else {
    inp.disabled = true;
    setGap(current.a, "err");
    showFeedback("err", "Правильный ответ",
      esc(current.r) + `<span class="answer-reveal">${esc(current.a)}</span>`,
      () => openReportDialog(current));
    endRound();
  }
}

function endRound() {
  const s = ensureWordState(current.id);
  const now = Date.now();
  s.reps++;
  s.lastReview = now;

  if (wrongSubmits > 0) {
    s.errors++;
    s.consecutiveErrors++;
    s.level = Math.max(0, s.level - 1);
    s.nextReview = now + Math.min(ERROR_BASE_MS * Math.pow(2, s.consecutiveErrors - 1), ERROR_MAX_MS);
  } else {
    s.correct++;
    s.consecutiveErrors = 0;
    s.level = Math.min(MAX_LEVEL, s.level + 1);
    s.nextReview = now + (SRS_INTERVALS_DAYS[s.level] || 1) * DAY_MS;
  }

  state.stats.totalRounds++;
  state.session.rounds++;
  updateDailyOnRound();
  saveState();
  updateFooterStats();

  phase = "feedback";
  $("submitBtn").disabled = true;
  $("actions").classList.add("show");
  requestAnimationFrame(() => {
    $("nextBtn").focus({ preventScroll: true });
    $("nextBtn").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function showEmptyState() {
  current = null; phase = "empty";
  $("taskLabel").textContent = "—";
  $("word").innerHTML = '<span style="font-size:18px;color:var(--muted);font-weight:400">Здесь пока пусто</span>';
  const inp = $("answerInput");
  inp.value = ""; inp.disabled = true;
  inp.className = "answer-input";
  $("submitBtn").disabled = true;
  $("actions").classList.remove("show");
  $("card").className = "card";

  let hint;
  if (runtime.progressFilter === "errors")      hint = "Вы пока не ошибались — так держать!";
  else if (runtime.progressFilter === "hard")   hint = "Сложных слов нет — все ошибки отработаны.";
  else if (runtime.progressFilter === "new")    hint = "Все слова этой категории уже встречались.";
  else if (runtime.progressFilter === "review") hint = "Сейчас нечего повторять — всё свежее.";
  else                                          hint = "В этой категории нет слов.";

  $("feedback").className = "feedback show ok";
  $("feedback").innerHTML = `${hint}<div class="empty-hint"><button id="switchAllBtn">Сбросить фильтры →</button></div>`;
  document.getElementById("switchAllBtn").addEventListener("click", () => {
    runtime.taskFilter = "all"; runtime.progressFilter = "all"; previousWordId = null;
    import('./app.js').then(m => m.refreshFilterUI());
    newRound();
  });
  updateFooterStats();
}

export function enterErrorMode() {
  const total = hardCountWithTaskFilter();
  if (total === 0) { showToast("Слов с ошибками нет 🎉"); return; }
  runtime.errorMode = true;
  runtime.errorModeTotalCount = total;
  previousWordId = null;
  import('./app.js').then(m => m.refreshFilterUI());
  newRound();
}

export function exitErrorMode() {
  runtime.errorMode = false;
  runtime.errorModeTotalCount = 0;
  previousWordId = null;
  import('./app.js').then(m => m.refreshFilterUI());
}

export function openErrorList() {
  renderErrorList();
  $("errorListModal").showModal();
}

function renderErrorList() {
  const body = $("errorListBody");
  let pool = WORDS;
  if (runtime.taskFilter !== "all") pool = pool.filter(w => w.t === Number(runtime.taskFilter));
  const hard = pool.filter(isHard);

  if (hard.length === 0) {
    body.innerHTML = `<div class="validation-ok">Все ошибки отработаны 🎉</div>`;
    return;
  }
  hard.sort((a, b) => (state.words[b.id]?.errors || 0) - (state.words[a.id]?.errors || 0));

  body.innerHTML = `
    <p style="color:var(--muted);font-size:13px;margin-top:0">
      Слова с ошибками, которые ещё не отработаны (уровень &lt; 3).
      Отсортированы по количеству ошибок.
    </p>
    <div class="error-list">
      ${hard.map(w => {
        const s = state.words[w.id] || {};
        const parts = w.w.split("..");
        const filled = `${esc(parts[0])}<mark class="error-mark">${esc(w.a)}</mark>${esc(parts[1] || "")}`;
        return `
          <div class="error-list-item">
            <div class="error-list-word">${filled}</div>
            <div class="error-list-meta">
              <span>Ошибок: <b>${s.errors || 0}</b></span>
              <span>Уровень: <b>${s.level || 0}/${MAX_LEVEL}</b></span>
              <button class="flag-btn flag-btn-inline" data-report-id="${w.id}" type="button" title="Сообщить об ошибке">🚩</button>
            </div>
            <div class="error-list-rule">${esc(w.r)}</div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-primary" id="errorListStartBtn">
        ${runtime.errorMode ? "Продолжить отработку" : "Начать отработку"}
      </button>
    </div>
  `;

  body.querySelectorAll('[data-report-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = WORDS.find(w => w.id === btn.dataset.reportId);
      if (word) openReportDialog(word);
    });
  });

  $("errorListStartBtn").addEventListener("click", () => {
    $("errorListModal").close();
    if (!runtime.errorMode) enterErrorMode();
    else newRound();
  });
}

export function getCurrentWord() { return current; }
export function getPhase() { return phase; }
