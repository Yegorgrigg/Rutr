// Тема, экспорт/импорт, валидация, сброс.
// Все технические действия собраны здесь.

import {
  STORAGE_KEY, BACKUP_KEY, BACKUP_TS_KEY, THEME_KEY,
  STATE_VERSION, LEGACY_VERSION, MAX_LEVEL,
  DEFAULT_DAILY_GOAL, $,
} from './config.js';
import {
  state, setState, createEmptyState, saveState, forceBackup,
} from './storage.js';
import { runtime } from './state.js';
import { WORDS } from './words.js';
import { esc } from './utils.js';

/* === Тема === */
export function applyTheme(theme) {
  if (theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
    try { localStorage.removeItem(THEME_KEY); } catch (e) {}
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }
  updateThemeUI();
}
export function updateThemeUI() {
  const cur = document.documentElement.getAttribute("data-theme") || "auto";
  document.querySelectorAll('[data-theme-value]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeValue === cur);
  });
}

/* === Валидатор банка === */
export function validateBank() {
  const issues = [];
  const seenIds = new Set();
  const seenKeys = new Map();

  WORDS.forEach((w, i) => {
    const where = `#${i}${w.w ? ` (${w.w})` : ""}`;
    if (!w.id) issues.push({ type: "missing-id", message: `Запись ${where}: нет id` });
    else if (seenIds.has(w.id)) issues.push({ type: "duplicate-id", message: `Запись ${where}: дублирующийся id "${w.id}"` });
    else seenIds.add(w.id);

    if (![9, 10, 11, 12].includes(w.t)) issues.push({ type: "invalid-task", message: `Запись ${where}: задание "${w.t}"` });
    if (!w.w || typeof w.w !== "string") issues.push({ type: "missing-word", message: `Запись ${where}: нет поля w` });
    if (!w.a || typeof w.a !== "string") issues.push({ type: "missing-answer", message: `Запись ${where}: нет поля a` });
    else if (w.a.length !== 1) issues.push({ type: "long-answer", message: `Запись ${where}: ответ "${w.a}" длиной ${w.a.length}` });
    if (!w.r || typeof w.r !== "string" || !w.r.trim()) issues.push({ type: "missing-rule", message: `Запись ${where}: нет поля r` });

    if (w.w && typeof w.w === "string") {
      const gi = w.w.indexOf("..");
      if (gi === -1) issues.push({ type: "no-gap", message: `Запись ${where}: нет ".."` });
      else if (w.w.indexOf("..", gi + 2) !== -1) issues.push({ type: "multi-gap", message: `Запись ${where}: больше одного ".."` });
    }
    if (w.w && w.a) {
      const key = `${w.t}::${w.w}::${w.a}`;
      if (seenKeys.has(key)) issues.push({ type: "duplicate-entry", message: `Запись ${where}: дубликат (совпадает с #${seenKeys.get(key)})` });
      else seenKeys.set(key, i);
    }
  });
  return { issues, total: WORDS.length };
}

function renderStorageDiagnostics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    const bytes = new Blob([raw]).size;
    const backupRaw = localStorage.getItem(BACKUP_KEY) || "";
    const backupBytes = new Blob([backupRaw]).size;
    const lastSave = state.meta.lastSaved
      ? new Date(state.meta.lastSaved).toLocaleString('ru-RU') : '—';
    return `
      <section class="stat-section">
        <h3>Хранилище</h3>
        <div class="stat-grid">
          <div><b>${(bytes/1024).toFixed(1)} КБ</b><span>основные данные</span></div>
          <div><b>${backupBytes > 0 ? (backupBytes/1024).toFixed(1) + ' КБ' : '—'}</b><span>резервная копия</span></div>
          <div><b>v${state.version}</b><span>версия состояния</span></div>
          <div><b>${Object.keys(state.words).length}</b><span>записей прогресса</span></div>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:8px 0 0">Последнее сохранение: ${lastSave}</p>
      </section>
    `;
  } catch (e) {
    return `<p style="color:var(--err)">Не удалось получить диагностику: ${esc(e.message)}</p>`;
  }
}

export function showValidation() {
  const { issues, total } = validateBank();
  const body = $("validationBody");

  const bankHtml = issues.length === 0
    ? `<div class="validation-ok">✓ Банк валиден. Проверено записей: ${total}.<br>Проблем не найдено.</div>`
    : `<div style="margin-bottom:12px;color:var(--muted);font-size:13px">
         Проверено записей: <b>${total}</b> · найдено проблем: <b>${issues.length}</b>.
         Автоматические правки <b>не</b> применяются — проверяйте вручную.
       </div>
       ${issues.map(iss => `
         <div class="validation-item">
           <span class="type">${esc(iss.type)}</span>
           ${esc(iss.message)}
         </div>`).join("")}`;

  body.innerHTML = `<section class="stat-section"><h3>Банк слов</h3>${bankHtml}</section>${renderStorageDiagnostics()}`;
  $("validationModal").showModal();
}

/* === Экспорт/импорт === */
export function exportProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `ru-trainer-progress-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateImport(data) {
  if (!data || typeof data !== "object") return { valid: false, error: "Не объект JSON" };
  if (data.version !== STATE_VERSION && data.version !== LEGACY_VERSION) {
    return { valid: false, error: `Неподдерживаемая версия: ${data.version}` };
  }
  if (!data.words || typeof data.words !== "object") return { valid: false, error: "Нет поля words" };
  if (!data.stats || typeof data.stats !== "object") return { valid: false, error: "Нет поля stats" };
  if (data.version === LEGACY_VERSION && !data.session) return { valid: false, error: "Нет поля session" };
  let count = 0;
  for (const [id, s] of Object.entries(data.words)) {
    if (!s || typeof s !== "object") return { valid: false, error: `Повреждена запись ${id}` };
    if (typeof s.level !== "number" || typeof s.reps !== "number") {
      return { valid: false, error: `Повреждена запись ${id}: level/reps` };
    }
    count++;
  }
  return { valid: true, wordsCount: count, needsMigration: data.version === LEGACY_VERSION };
}

export async function handleImportFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const check = validateImport(data);
    if (!check.valid) { alert("Импорт отклонён: " + check.error); return; }
    if (!confirm(`Импортировать прогресс? Записей: ${check.wordsCount}.\nТекущий прогресс будет перезаписан (сохранён в бэкапе).`)) return;
    forceBackup();
    const { migrateV2toV3 } = await import('./storage.js');
    setState(check.needsMigration ? migrateV2toV3(data) : data);
    if (!state.daily) state.daily = { date: state.daily?.date || '', rounds: 0, goal: DEFAULT_DAILY_GOAL };
    if (!state.dailyStreak) state.dailyStreak = { current: 0, best: 0, lastActiveDate: "" };
    saveState();
    runtime.taskFilter = "all"; runtime.progressFilter = "all"; runtime.errorMode = false;
    const app = await import('./app.js');
    app.refreshFilterUI();
    app.bootRound();
    alert("Прогресс загружен.");
  } catch (e) {
    alert("Ошибка импорта: " + e.message);
  }
}

/* === Сброс === */
export async function doResetProgress() {
  forceBackup();
  setState(createEmptyState());
  runtime.streak = 0;
  runtime.errorMode = false;
  runtime.taskFilter = "all"; runtime.progressFilter = "all";
  saveState();
  const app = await import('./app.js');
  app.refreshFilterUI();
  app.bootRound();
  $("resetModal").close();
}