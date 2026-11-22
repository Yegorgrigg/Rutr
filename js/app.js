// Точка входа. Порядок важен:
// 1. Загружаем state
// 2. Инициализируем UI/настройки
// 3. Вешаем обработчики
// 4. Запускаем первый раунд

import { $ } from './config.js';
import { state, loadState, saveState } from './storage.js';
import { runtime } from './state.js';
import { newRound, submitAnswer, enterErrorMode, exitErrorMode, openErrorList, getPhase } from './game.js';
import { renderStats, openProfile } from './stats.js';
import {
  applyTheme, updateThemeUI,
  exportProgress, handleImportFile, showValidation, doResetProgress,
} from './settings.js';
import { initDebug } from './debug.js';
import { validateBank } from './settings.js';

/* === Дропдауны === */
function closeAllDropdowns(except) {
  document.querySelectorAll('.dropdown.open').forEach(d => {
    if (d !== except) {
      d.classList.remove('open');
      const btn = d.querySelector('.seg-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
}
function initDropdowns() {
  document.querySelectorAll('.dropdown').forEach(dd => {
    const btn = dd.querySelector('.seg-btn');
    let hideTimer = null;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (dd.classList.contains('disabled')) return;
      const isOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        dd.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    if (window.matchMedia('(hover: hover)').matches) {
      dd.addEventListener('mouseenter', () => {
        if (dd.classList.contains('disabled')) return;
        clearTimeout(hideTimer);
        closeAllDropdowns(dd);
        dd.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      });
      dd.addEventListener('mouseleave', () => {
        hideTimer = setTimeout(() => {
          dd.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }, 150);
      });
    }
  });
  document.addEventListener('click', () => closeAllDropdowns());
  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const dd = item.closest('.dropdown');
      if (dd) {
        dd.classList.remove('open');
        const btn = dd.querySelector('.seg-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllDropdowns();
  });
}

/* === Фильтры === */
const TASK_LABELS = { all: "Задания ЕГЭ", 9: "Задание 9", 10: "Задание 10", 11: "Задание 11", 12: "Задание 12" };
const PROGRESS_LABELS = { all: "Прогресс", errors: "Ошибки", new: "Неизученные", review: "Повторение", hard: "Сложные" };

export function refreshFilterUI() {
  const taskLabel = document.querySelector('#dropdownTask .seg-label');
  if (taskLabel) taskLabel.textContent = TASK_LABELS[runtime.taskFilter] || "Задания ЕГЭ";
  const progLabel = document.querySelector('#dropdownProgress .seg-label');
  if (progLabel) progLabel.textContent = PROGRESS_LABELS[runtime.progressFilter] || "Прогресс";

  document.querySelectorAll('#dropdownTask .dropdown-item').forEach(item => {
    const a = item.dataset.value === String(runtime.taskFilter);
    item.classList.toggle('active', a);
    item.setAttribute('aria-selected', String(a));
  });
  document.querySelectorAll('#dropdownProgress .dropdown-item').forEach(item => {
    const a = item.dataset.value === runtime.progressFilter;
    item.classList.toggle('active', a);
    item.setAttribute('aria-selected', String(a));
  });

  const taskDD = $('dropdownTask'), progDD = $('dropdownProgress');
  if (taskDD) {
    taskDD.classList.toggle('active', runtime.taskFilter !== "all");
    taskDD.classList.toggle('disabled', runtime.errorMode);
  }
  if (progDD) {
    progDD.classList.toggle('active', runtime.progressFilter !== "all");
    progDD.classList.toggle('disabled', runtime.errorMode);
  }
}

function setTaskFilter(v) {
  if (runtime.errorMode) return;
  runtime.taskFilter = v;
  refreshFilterUI(); newRound();
}
function setProgressFilter(v) {
  if (runtime.errorMode) return;
  runtime.progressFilter = v;
  refreshFilterUI(); newRound();
}

/* === Обработчики === */
function bindHandlers() {
  $("submitBtn").addEventListener("click", submitAnswer);
  $("nextBtn").addEventListener("click", newRound);

  $("answerInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); submitAnswer(); }
  });
  $("answerInput").addEventListener("focus", () => {
    setTimeout(() => {
      $("answerInput").scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && getPhase() === "feedback") { e.preventDefault(); newRound(); }
  });

  // Сохраняем при сворачивании
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state) { try { saveState(); } catch (e) {} }
  });
  window.addEventListener("pagehide", () => {
    if (state) { try { saveState(); } catch (e) {} }
  });

  // Футер и меню
  $("statsBtn").addEventListener("click", () => { renderStats(); $("statsModal").showModal(); });

  document.querySelectorAll('#dropdownProfile [data-action]').forEach(item => {
    item.addEventListener('click', () => {
      const a = item.dataset.action;
      if (a === "profile") openProfile();
      else if (a === "stats") { renderStats(); $("statsModal").showModal(); }
      else if (a === "settings") $("settingsModal").showModal();
    });
  });

  // Отработка ошибок
  $("errorBannerActionBtn").addEventListener("click", () => {
    if (runtime.errorMode) { exitErrorMode(); newRound(); }
    else openErrorList();
  });
  $("errorBannerListBtn").addEventListener("click", openErrorList);

  // Тема
  document.querySelectorAll('[data-theme-value]').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeValue));
  });

  // Экспорт/импорт/валидация/сброс
  $("exportBtn").addEventListener("click", exportProgress);
  $("importBtn").addEventListener("click", () => $("importFileInput").click());
  $("importFileInput").addEventListener("change", e => {
    handleImportFile(e.target.files[0]);
    e.target.value = "";
  });
  $("validateBtn").addEventListener("click", showValidation);

  $("resetBtn").addEventListener("click", () => {
    $("settingsModal").close();
    $("resetConfirmInput").value = "";
    $("resetConfirmBtn").disabled = true;
    $("resetModal").showModal();
    setTimeout(() => $("resetConfirmInput").focus(), 50);
  });
  $("resetConfirmInput").addEventListener("input", e => {
    $("resetConfirmBtn").disabled = e.target.value.trim().toUpperCase() !== "СБРОС";
  });
  $("resetConfirmBtn").addEventListener("click", () => {
    if ($("resetConfirmInput").value.trim().toUpperCase() !== "СБРОС") return;
    doResetProgress();
  });

  // Фильтры
  document.querySelectorAll('#dropdownTask .dropdown-item').forEach(item => {
    item.addEventListener('click', () => setTaskFilter(item.dataset.value));
  });
  document.querySelectorAll('#dropdownProgress .dropdown-item').forEach(item => {
    item.addEventListener('click', () => setProgressFilter(item.dataset.value));
  });

  // Закрытие модалок
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => $(btn.dataset.close).close());
  });
  ["statsModal","settingsModal","validationModal","profileModal","resetModal","errorListModal"].forEach(id => {
    const m = $(id);
    m.addEventListener("click", e => { if (e.target === m) m.close(); });
  });
}

export function bootRound() { newRound(); }

/* === Старт === */
loadState();
saveState();
initDebug();
initDropdowns();
refreshFilterUI();
updateThemeUI();
bindHandlers();
newRound();

const _r = validateBank();
if (_r.issues.length > 0) {
  console.warn(`[Банк слов] Проблем: ${_r.issues.length}`);
  _r.issues.forEach(i => console.warn(" ·", i.type, "—", i.message));
} else {
  console.info(`[Банк слов] OK, записей: ${_r.total}`);
}