// Жалобы на слова. Сохранение + копирование в буфер.
// Срабатывает после неверного ответа (кнопка в feedback) и из списка ошибок.

import { state, saveState } from './storage.js';
import { showToast } from './ui.js';
import { esc } from './utils.js';
import { $ } from './config.js';

let currentReport = null;

export function openReportDialog(word) {
  if (!word) return;
  currentReport = word;
  const parts = word.w.split('..');
  const filled = `${esc(parts[0])}<mark class="report-answer">${esc(word.a)}</mark>${esc(parts[1] || '')}`;

  $("reportPreview").innerHTML = `
    <div class="report-word">${filled}</div>
    <div class="report-meta">
      <span>Задание ${word.t}</span>
      <span>Ответ: <b>${esc(word.a)}</b></span>
    </div>
    <div class="report-rule"><b>Правило:</b> ${esc(word.r)}</div>
  `;
  $("reportComment").value = "";
  $("reportModal").showModal();
  setTimeout(() => $("reportComment").focus(), 50);
}

export async function submitReport() {
  if (!currentReport) return;
  const comment = $("reportComment").value.trim();
  const parts = currentReport.w.split('..');
  const filled = `${parts[0]}${currentReport.a}${parts[1] || ''}`;

  const text = [
    '🚩 Жалоба на слово',
    `Слово: ${currentReport.w}`,
    `Ответ: ${currentReport.a} (полное слово: ${filled})`,
    `Задание: ${currentReport.t}`,
    `Правило: ${currentReport.r}`,
    comment ? `Комментарий: ${comment}` : '',
    `Дата: ${new Date().toLocaleString('ru-RU')}`,
    `Сайт: ${location.href}`,
  ].filter(Boolean).join('\n');

  // Копируем в буфер
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }

  // Сохраняем локально
  if (!state.reports) state.reports = [];
  state.reports.push({
    wordId: currentReport.id,
    word: currentReport.w,
    answer: currentReport.a,
    task: currentReport.t,
    rule: currentReport.r,
    comment,
    date: Date.now(),
  });
  saveState();

  $("reportModal").close();
  showToast("Жалоба скопирована в буфер обмена");
  currentReport = null;
}