// Рантайм-состояние. Не сохраняется в localStorage.
// Живёт до перезагрузки страницы. Всё, что «на лету» — здесь.
// Persistent state — в storage.js.

export const runtime = {
  taskFilter: 'all',           // all | 9 | 10 | 11 | 12
  progressFilter: 'all',       // all | errors | new | review | hard
  streak: 0,                   // текущая серия верных подряд
  errorMode: false,
  errorModeTotalCount: 0,
};