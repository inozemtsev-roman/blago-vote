import {
  init,
  isTMA,
  miniApp,
  viewport,
  themeParams,
  backButton,
  closingBehavior,
  mainButton,
  secondaryButton,
  retrieveLaunchParams,
} from "@tma.js/sdk";

// Инициализация tma.js. Все методы SDK бросают ошибку вне Telegram Mini Apps,
// а mount() возвращает промис, который может отклоняться асинхронно, поэтому
// вызовы оборачиваем в guard isTMA() и глушим отклонённые промисы.
export function initTma() {
  if (typeof window === "undefined") return null;
  if (!isTMA()) return null;

  try {
    init();
  } catch {
    // ignore
  }

  const safe = (fn: () => unknown) => {
    try {
      const res = fn();
      if (res && typeof (res as Promise<unknown>).then === "function") {
        (res as Promise<unknown>).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  safe(() => themeParams.mount());
  safe(() => miniApp.mount());
  safe(() => viewport.mount());
  safe(() => backButton.mount());
  safe(() => closingBehavior.mount());
  safe(() => mainButton.mount());
  safe(() => secondaryButton.mount());

  safe(() => miniApp.ready());
  safe(() => {
    if (!viewport.isExpanded()) {
      viewport.expand();
    }
  });

  safe(() => themeParams.bindCssVars());
  safe(() => viewport.bindCssVars());
  safe(() => miniApp.bindCssVars());

  // Согласуем цвета шапки/фона Telegram с текущей темой приложения.
  syncTmaTheme();

  return {
    miniApp,
    viewport,
    themeParams,
    backButton,
    closingBehavior,
    mainButton,
    secondaryButton,
  };
}

// Перекрашивает нативные элементы Telegram (шапка, фон, нижняя полоса) под
// текущую тему приложения. Вызывается при init и при переключении темы.
export function syncTmaTheme(): void {
  if (typeof window === "undefined" || !isTMA()) return;
  const theme =
    document.documentElement.getAttribute("data-theme") || "light";
  const color = theme === "dark" ? "#09090a" : "#f3f3f5";
  try {
    miniApp.setHeaderColor(color);
  } catch {}
  try {
    miniApp.setBgColor(color);
  } catch {}
  try {
    miniApp.setBottomBarColor(color);
  } catch {}
}

export function getTmaLaunchParams() {
  try {
    return retrieveLaunchParams();
  } catch {
    return undefined;
  }
}
