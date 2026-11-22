// Рендер карточки, футера, баннера ошибок, тостов, feedback.

import { state } from './storage.js';
import { runtime } from './state.js';
import { hardCountWithTaskFilter } from './srs.js';
import { esc, plural, todayStr } from './utils.js';
import { DEFAULT_DAILY_GOAL } from './config.js';

const $ = id => document.getElementById(id);

export function renderWord(w) {
  const idx = w.w.indexOf("..");
  if (idx === -1) { $("word").textContent = w.w; return; }
  $("word").innerHTML =
    esc(w.w.slice(0, idx)) + '<span class="gap" id="gap"></span>' + esc(w.w.slice(idx + 2));
}

export function setGap(letter, cls) {
  const g = $("gap");
  if (!g) return;
  g.textContent = letter || "";
  g.className = "gap" + (cls ? " " + cls : "");
}

export function showFeedback(type, title, text, flagCallback) {
  const f = $("feedback");
  f.className = "feedback show " + type;
  let html = `<span class="rule-title">${title}</span>${text}`;
  if (flagCallback) {
    html += `<button class="flag-btn" type="button">🚩 Сообщить об ошибке</button>`;
  }
  f.innerHTML = html;
  if (flagCallback) {
    f.querySelector('.flag-btn').addEventListener('click', flagCallback);
  }
}

export function showToast(text) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 2600);
}

function updateSessionBadge() {
  const el = $("sessionBadge");
  if (!el) return;
  const s = state.session;
  if (s.rounds > 0) {
    const sub = s.correctAttempts + s.wrongAttempts;
    const pct = sub > 0 ? Math.round(s.correctAttempts / sub * 100) : 0;
    el.textContent = `${s.rounds} · ${pct}%`;
    el.title = `За эту сессию: ${s.rounds} ${plural(s.rounds, "слово", "слова", "слов")}, точность ${pct}%`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

export function updateFooterStats() {
  $("statSolved").textContent = Object.values(state.words).filter(s => s.reps > 0).length;
  $("statErrors").textContent = state.stats.wrongAttempts;

  const st = $("streak");
  if (runtime.streak >= 2) {
    st.classList.add("show");
    st.textContent = `🔥 ${runtime.streak}`;
    st.title = `${runtime.streak} ${plural(runtime.streak, "правильный ответ", "правильных ответа", "правильных ответов")} подряд`;
  } else {
    st.classList.remove("show");
  }

  const dsEl = $("dayStreak");
  if (state.dailyStreak.current >= 2) {
    dsEl.style.display = "";
    dsEl.textContent = `📅 ${state.dailyStreak.current}`;
    dsEl.title = `${state.dailyStreak.current} ${plural(state.dailyStreak.current, "день", "дня", "дней")} подряд · лучшая серия: ${state.dailyStreak.best}`;
  } else {
    dsEl.style.display = "none";
  }

  const dgEl = $("dailyGoal");
  const rounds = state.daily.date === todayStr() ? state.daily.rounds : 0;
  const goal = state.daily.goal || DEFAULT_DAILY_GOAL;
  dgEl.textContent = `🎯 ${rounds}/${goal}`;
  dgEl.classList.toggle("done", rounds >= goal);
  dgEl.title = `Сегодня: ${rounds} из ${goal}`;

  updateErrorBanner();
  updateSessionBadge();
}

export function updateErrorBanner() {
  const banner = $("errorBanner");
  if (!banner) return;
  const hardCount = hardCountWithTaskFilter();
  const title = $("errorBannerTitle");
  const sub = $("errorBannerSub");
  const listBtn = $("errorBannerListBtn");
  const actionBtn = $("errorBannerActionBtn");

  if (runtime.errorMode) {
    const done = Math.max(0, runtime.errorModeTotalCount - hardCount);
    banner.hidden = false;
    title.textContent = `Отработка: ${done} из ${runtime.errorModeTotalCount}`;
    sub.textContent = hardCount > 0
      ? `Осталось ${hardCount} ${plural(hardCount, "слово", "слова", "слов")}`
      : "Готово!";
    listBtn.hidden = false;
    actionBtn.textContent = "Выйти";
    actionBtn.classList.remove("error-banner-btn-primary");
  } else if (hardCount > 0) {
    banner.hidden = false;
    title.textContent = `${hardCount} ${plural(hardCount, "слово", "слова", "слов")} с ошибками`;
    sub.textContent = "Отработайте их, чтобы укрепить знания";
    listBtn.hidden = true;
    actionBtn.textContent = "Отработать →";
    actionBtn.classList.add("error-banner-btn-primary");
  } else {
    banner.hidden = true;
  }
}
