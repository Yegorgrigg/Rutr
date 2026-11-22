// Модалка статистики и профиль.

import { state } from './storage.js';
import { isMastered } from './srs.js';
import { WORDS } from './words.js';
import { MAX_LEVEL, $ } from './config.js';

export function renderStats() {
  const body = $("statsBody");
  const total = WORDS.length;

  const byTask = {};
  [9,10,11,12].forEach(t => byTask[t] = { total: 0, encountered: 0, mastered: 0, correctAtt: 0, wrongAtt: 0 });
  let encountered = 0, mastered = 0, totalCorrect = 0, totalWrong = 0;

  WORDS.forEach(w => {
    const ts = byTask[w.t];
    if (!ts) return;
    ts.total++;
    const s = state.words[w.id];
    if (s && s.reps > 0) {
      ts.encountered++; encountered++;
      if (s.level >= MAX_LEVEL) { ts.mastered++; mastered++; }
      ts.correctAtt += s.correctAttempts || 0;
      ts.wrongAtt += s.wrongAttempts || 0;
      totalCorrect += s.correctAttempts || 0;
      totalWrong += s.wrongAttempts || 0;
    }
  });

  const overallPct = (totalCorrect + totalWrong) > 0
    ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : 0;
  const firstTryPct = state.stats.totalRounds > 0
    ? Math.round(state.stats.firstTryCorrect / state.stats.totalRounds * 100) : 0;

  const sess = state.session;
  const sessSubmits = sess.correctAttempts + sess.wrongAttempts;
  const sessPct = sessSubmits > 0 ? Math.round(sess.correctAttempts / sessSubmits * 100) : 0;

  const hist = state.stats.history || [];

  body.innerHTML = `
    <section class="stat-section">
      <h3>Текущая сессия</h3>
      <div class="stat-grid">
        <div><b>${sess.rounds}</b><span>слов решено</span></div>
        <div><b>${sessPct}%</b><span>точность</span></div>
        <div><b>${sess.wrongAttempts}</b><span>ошибок</span></div>
      </div>
    </section>
    <section class="stat-section">
      <h3>Освоение банка</h3>
      <div class="progress-overall">
        <div class="progress-bar-lg">
          <div class="progress-bar-lg-fill" style="width:${total > 0 ? Math.round(encountered / total * 100) : 0}%"></div>
        </div>
        <div class="progress-meta">
          <span>Встречено: <b>${encountered} / ${total}</b></span>
          <span>Освоено: <b>${mastered} / ${total}</b></span>
        </div>
      </div>
      <div class="stat-grid" style="margin-top:12px">
        <div><b>${overallPct}%</b><span>общая точность</span></div>
        <div><b>${firstTryPct}%</b><span>с 1-й попытки</span></div>
        <div><b>${totalWrong}</b><span>ошибок всего</span></div>
      </div>
    </section>
    <section class="stat-section">
      <h3>По заданиям</h3>
      ${[9,10,11,12].map(t => {
        const ts = byTask[t];
        const acc = (ts.correctAtt + ts.wrongAtt) > 0
          ? Math.round(ts.correctAtt / (ts.correctAtt + ts.wrongAtt) * 100) : 0;
        const encPct = ts.total > 0 ? Math.round(ts.encountered / ts.total * 100) : 0;
        const masPct = ts.total > 0 ? Math.round(ts.mastered / ts.total * 100) : 0;
        return `
          <div class="task-stat">
            <div class="task-stat-header">
              <span>Задание ${t}</span>
              <span>${ts.encountered} / ${ts.total}</span>
            </div>
            <div class="stat-bar"><div class="stat-bar-fill" style="width:${encPct}%"></div></div>
            <div class="task-stat-sub">
              <span>Точность: ${acc}%</span>
              <span>Освоено: ${masPct}%</span>
            </div>
          </div>
        `;
      }).join("")}
    </section>
    ${hist.length > 0 ? `
    <section class="stat-section">
      <h3>Последние сессии</h3>
      <div class="history-list">
        ${hist.slice().reverse().map(h => {
          const sub = (h.correctAttempts || 0) + (h.wrongAttempts || 0);
          const pct = sub > 0 ? Math.round(h.correctAttempts / sub * 100) : 0;
          const dt = new Date(h.endedAt);
          const dateStr = dt.toLocaleDateString('ru-RU', {day:'numeric', month:'short'});
          const timeStr = dt.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
          return `<div class="history-item">
            <span class="history-date">${dateStr}, ${timeStr}</span>
            <span>${h.rounds} слов</span>
            <span class="history-pct">${pct}%</span>
          </div>`;
        }).join("")}
      </div>
    </section>` : ''}
  `;
}

export function openProfile() {
  const total = WORDS.length;
  const encountered = WORDS.filter(w => {
    const s = state.words[w.id];
    return s && s.reps > 0;
  }).length;
  const mastered = WORDS.filter(isMastered).length;

  let ca = 0, wa = 0;
  Object.values(state.words).forEach(s => {
    ca += s.correctAttempts || 0;
    wa += s.wrongAttempts || 0;
  });
  const acc = (ca + wa) > 0 ? Math.round(ca / (ca + wa) * 100) : 0;

  $("profileBody").innerHTML = `
    <div class="profile-badge">
      <div class="profile-avatar">👤</div>
      <div>
        <div class="profile-name">Гостевой профиль</div>
        <div class="profile-sub">Локальное хранилище · без синхронизации</div>
      </div>
    </div>
    <p>Прогресс сохраняется только в этом браузере. Очистка данных браузера удалит прогресс — используйте экспорт для резервной копии.</p>
    <div class="stat-grid" style="margin-top:12px">
      <div><b>${encountered} / ${total}</b><span>слов встречено</span></div>
      <div><b>${mastered} / ${total}</b><span>освоено</span></div>
      <div><b>${acc}%</b><span>точность</span></div>
    </div>
    <p class="profile-note">💡 Синхронизация появится в будущих версиях. Сейчас прогресс можно переносить вручную через «Экспорт / Импорт» в настройках.</p>
    <div class="modal-actions" style="margin-top:12px">
      <button class="btn btn-ghost" id="profileExportBtn">📥 Экспорт прогресса</button>
    </div>
  `;
  $("profileExportBtn").addEventListener("click", () => {
    import('./settings.js').then(m => m.exportProgress());
  });
  $("profileModal").showModal();
}