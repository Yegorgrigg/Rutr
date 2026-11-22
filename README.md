# RUTR

Тренажёр орфографии. ES-модули, без сборщика и без зависимостей.

## Запуск

**Нужен HTTP-сервер** (ES-модули не работают через `file://`).

Локально:
    python -m http.server 8000
    # или
    npx serve .

Открыть http://localhost:8000.

На iPhone: задеплоить на любой бесплатный хостинг (GitHub Pages, Netlify, Vercel).

## Карта проекта

| Файл | Что внутри | Когда править |
|------|-----------|---------------|
| `js/words.js` | Массив WORDS + стабильные ID | Добавить/исправить слово |
| `js/config.js` | Константы: ключи, интервалы SRS, лимиты | Менять SRS-интервалы, дневную цель |
| `js/utils.js` | `todayStr`, `dateStrFor`, `plural`, `esc`, `hashString` | Помощники |
| `js/state.js` | Рантайм: `taskFilter`, `progressFilter`, `streak`, `errorMode` | Новая настройка «на лету» |
| `js/storage.js` | `loadState/saveState/migrations/backup` + дневная цель + серия дней | Работа с localStorage и версиями |
| `js/srs.js` | `priorityOf`, `currentPool`, `pickFromPool`, `is*`-предикаты | Алгоритм повторения |
| `js/ui.js` | `renderWord`, `showFeedback`, `showToast`, `updateFooterStats`, `updateErrorBanner` | Рендер элементов карточки |
| `js/game.js` | `newRound`, `submitAnswer`, `endRound` + режим отработки ошибок | Логика раунда |
| `js/stats.js` | `renderStats`, `openProfile` | Модалка статистики |
| `js/settings.js` | Тема, экспорт/импорт, валидатор, сброс | Настройки |
| `js/debug.js` | Диагностика, задел под iPhone-фиксы | Отладка |
| `js/app.js` | Bootstrap, обработчики, дропдауны | Точка входа |

## Стабильные ID слов

ID вычисляется как `w_` + hash(`t::w::a`). При изменении порядка в `words.js`
прогресс остаётся привязан к правильным словам. Добавление/удаление слов
не «сдвигает» прогресс.

## Версии состояния

- `v3` — текущая. Ключ `ru-trainer-v2`, но версия внутри `state.version = 3`.
- `v2 → v3` мигрируется автоматически (по индексу в массиве WORDS).
- `v1 → v3` **не поддерживается** (слишком старый формат).

## Тестирование

Открыть `index.html` через HTTP. Все сценарии в ТЗ №3, раздел 8.

## iPhone

Пока отложено. В `js/debug.js` есть `runIOSAudit()` — задел под будущий фикс.
Плюс глобальный обработчик в `<head>` показывает красный экран при любой
ошибке загрузки — не придётся гадать «почему пусто».