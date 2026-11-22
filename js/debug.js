// Диагностика. Место под будущий фикс iPhone.
// Пока — только сбор системной информации, доступен из консоли:
//   window.__rutrDebug()
// и заготовка для iOS-специфичных проверок.

export function runIOSAudit() {
  const r = {
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    safeAreaSupported: CSS.supports('padding-top', 'env(safe-area-inset-top)'),
    dvhSupported: CSS.supports('height', '100dvh'),
    dialogSupported: typeof HTMLDialogElement !== 'undefined' && !!document.createElement('dialog').showModal,
    hasSupported: CSS.supports('selector(:has(*))'),
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
  console.group('[RUTR] iOS / browser audit');
  Object.entries(r).forEach(([k, v]) => console.log(k, '=', v));
  console.groupEnd();
  return r;
}

export function initDebug() {
  window.__rutrDebug = runIOSAudit;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    console.info('[RUTR] iOS detected. Run window.__rutrDebug() for audit.');
  }
}