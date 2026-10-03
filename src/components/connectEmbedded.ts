import type { TonConnectUI } from "@tonconnect/ui";
import { showToast } from "toasts";
import { addStatusHistory, addSdkError, setConnectDebug, dumpConnectDebug } from "connectDebug";

const GRADOSPHERA_WALLET_APP_NAME = "gradospherawallet";
// 60с: дать пользователю время подтвердить подключение в окне кошелька.
const EMBEDDED_CONNECT_TIMEOUT_MS = 60000;
// Как часто проверять факт подключения по состоянию (не только по колбэкам).
const CONNECTED_POLL_MS = 200;
// Пауза после появления адреса в SDK, чтобы успел сработать wrapped-колбэк UI.
const WRAPPED_SYNC_GRACE_MS = 500;
// Финальный grace после таймаута: SDK мог доставить connect ровно в момент
// таймаута (poll-цикл 250мс мог промахнуться) — даём один короткий шанс.
const FINAL_STATE_CHECK_DELAY_MS = 300;

// Единый признак «подключены»: состояние SDK и UI без ожидания колбэков.
// Wrapped onStatusChange в бандле @tonconnect/ui может молча падать (TDZ
// в бundle кошелька / Cannot find WalletInfo), поэтому состояние важнее.
function isEmbeddedConnected(tonConnectUI: TonConnectUI): boolean {
  return !!(
    tonConnectUI.connector.wallet?.account?.address ||
    tonConnectUI.wallet?.account?.address ||
    tonConnectUI.connected
  );
}

// TDZ-ошибки из бандла кошелька (ReferenceError: can't access lexical
// declaration ...): исключение в обработке событий SDK, НЕ признак провала
// подключения — состояние могло уже установиться в connector.wallet.
function isTdzError(err: unknown): boolean {
  const msg = String(err);
  const stack = err instanceof Error ? err.stack ?? "" : "";
  return (
    msg.includes("can't access lexical declaration") ||
    msg.includes("Cannot access") ||
    msg.includes("before initialization") ||
    stack.includes("can't access lexical declaration") ||
    stack.includes("before initialization")
  );
}

function snapshotStatus(tonConnectUI: TonConnectUI, target?: { jsBridgeKey?: string }) {
  return {
    connectorHasWallet: !!tonConnectUI.connector.wallet?.account?.address,
    uiHasWallet: !!tonConnectUI.wallet?.account?.address,
    uiConnected: tonConnectUI.connected,
    bridgeHasTonconnect: !!(window as any).mytonwallet?.tonconnect,
    jsBridgeKeyTarget: (target as any)?.jsBridgeKey,
  };
}

export async function tryConnectEmbeddedWallet(
  tonConnectUI: TonConnectUI,
): Promise<boolean> {
  const t0 = performance.now();

  const inFrame = window.parent !== window;
  const hasBridge = !!(window as any).mytonwallet?.tonconnect;
  if (!(inFrame && hasBridge)) {
    setConnectDebug(snapshotStatus(tonConnectUI));
    setConnectDebug({ fallback: "нет встроенного кошелька (не во фрейме кошелька)" });
    return false;
  }

  try {
    setConnectDebug(snapshotStatus(tonConnectUI));

    const wallets = await tonConnectUI.getWallets();
    const target = wallets.find(
      (wallet) => wallet.appName === GRADOSPHERA_WALLET_APP_NAME
    ) as { jsBridgeKey?: string } | undefined;

    setConnectDebug({
      gotTarget: !!target,
      targetExists: !!target,
      targetInjected: !!(target as any)?.injected,
      targetEmbedded: !!(target as any)?.embedded,
      targetAppName: (target as any)?.appName,
      hasJsProviderByKey: !!(target && (window as any)[(target as any).jsBridgeKey]?.tonconnect),
      ...snapshotStatus(tonConnectUI, target),
    });

    if (!target || !target.jsBridgeKey) {
      setConnectDebug({ fallback: "gradospherawallet не найден в списке кошельков" });
      return false;
    }

    const hasJsProvider = !!(window as any)[target.jsBridgeKey]?.tonconnect;
    setConnectDebug({ hasJsProvider, ...snapshotStatus(tonConnectUI, target) });
    if (!hasJsProvider) {
      setConnectDebug({ fallback: "нет js-провайдера у gradospherawallet" });
      return false;
    }

    // Уже подключены по состоянию — выходим без таймаута и без тоста.
    if (isEmbeddedConnected(tonConnectUI)) {
      addStatusHistory("already connected by state");
      setConnectDebug({
        connectResult: true,
        connectMs: Math.round(performance.now() - t0),
        ...snapshotStatus(tonConnectUI, target),
      });
      return true;
    }

addStatusHistory("connect start (raw connector.connect)");
    // Прямой SDK-путь: он доказуемо доходит до кошелька и получает connect OK
    // (мост фиксирует methodResponse). Официальный openModal()-путь вызывает
    // TDZ в бundle кошелька (ReferenceError: can't access lexical declaration
    // 'l' before initialization) — это не мешает детекции по состоянию ниже.
    //
    // TDZ/ошибки SDK здесь НЕ фатальны: исключение в обработке событий может
    // броситься при уже установленном соединении. Ловим, логируем и продолжаем
    // поллить состояние до появления адреса или таймаута.
    //
    // state-first: подписки и поллинг регистрируем ДО вызова connect(), чтобы
    // не пропустить мгновенную установку адреса — событие может «потеряться»
    // из-за TDZ, но состояние в connector.wallet уже появится.
    const waiting = waitConnected(tonConnectUI, target, EMBEDDED_CONNECT_TIMEOUT_MS);
    try {
      tonConnectUI.connector.connect({ jsBridgeKey: target.jsBridgeKey });
    } catch (e) {
      const msg = String(e);
      addSdkError(msg);
      addStatusHistory(isTdzError(msg) ? "connector.connect sync TDZ (игнорируем)" : `connector.connect sync error: ${msg}`);
    }

    const ok = await waiting;

    if (!ok) {
      // Финальная проверка по актуальному состоянию ПРЯМО перед тостом/фолбэком:
      // мост мог прислать connect OK, но SDK доставить wallet чуть позже таймаута —
      // тогда никакого обычного подключения не открываем, возвращаем connected.
      const nowConnected = isEmbeddedConnected(tonConnectUI);
      if (nowConnected) {
        addStatusHistory("resolved by final state check before fallback");
        setConnectDebug({
          connectResult: true,
          connectError: "",
          connectMs: Math.round(performance.now() - t0),
          ...snapshotStatus(tonConnectUI, target),
        });
        return true;
      }
      addStatusHistory(
        "не получили connected: кнопка останется неподключенной — проверь APP_NAME кошелька"
      );
      setConnectDebug({
        connectResult: false,
        connectError: "не получен признак connected (таймаут)",
        connectMs: Math.round(performance.now() - t0),
        ...snapshotStatus(tonConnectUI, target),
      });
      dumpConnectDebug("timeout");
      if (inFrame) {
        showToast(
          "Встроенный кошелёк не ответил на запрос. Открываем обычное подключение.",
          { duration: 6000, position: "top-center" }
        );
      }
    } else {
      setConnectDebug({
        connectResult: true,
        connectError: "",
        connectMs: Math.round(performance.now() - t0),
        ...snapshotStatus(tonConnectUI, target),
      });
    }
    return ok;
  } catch (e) {
    const connected = isEmbeddedConnected(tonConnectUI);
    setConnectDebug({
      connectResult: connected,
      connectError: String(e),
      connectMs: Math.round(performance.now() - t0),
      fallback: connected ? "" : "embedded connect не сработал",
      ...snapshotStatus(tonConnectUI),
    });
    dumpConnectDebug("catch");
    console.warn("Не удалось подключиться через встроенный кошелёк:", e);

    if (inFrame && !connected) {
      showToast(
        "Встроенный кошелёк не ответил на запрос. Открываем обычное подключение.",
        { duration: 6000, position: "top-center" }
      );
    }
    return connected;
  }
}

function waitConnected(
  tonConnectUI: TonConnectUI,
  target: { jsBridgeKey?: string },
  timeoutMs: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let wrappedError: string | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let poll: number | undefined;
    let timeout: number | undefined;

    const cleanup = () => {
      if (poll) window.clearInterval(poll);
      if (timeout) window.clearTimeout(timeout);
      unsubscribeRaw();
      unsubscribeWrapped();
    };

    const finish = (byState: boolean) => {
      if (settled) return;
      settled = true;
      if (retryTimer) clearTimeout(retryTimer);
      cleanup();
      addStatusHistory(byState ? "resolved by state (not callback)" : "resolved by callback");
      resolve(true);
    };

    // «Сырой» статус коннектора (SDK-уровень): срабатывает, когда SDK получил
    // от кошелька connect OK и выставил connector.wallet — без обёртки UI.
    const unsubscribeRaw = tonConnectUI.connector.onStatusChange(
      (wallet) => {
        if (settled) return;
        if (wallet?.account?.address) {
          addStatusHistory("connector wallet appears");
          if (isEmbeddedConnected(tonConnectUI)) {
            finish(true);
            return;
          }
          // Адрес есть в SDK, но осторожно: wrapped-колбэк может сработать чуть
          // позже (getSelectedWalletInfo допрос). Даём короткую паузу — микрофикс
          // рассинхрона, чтобы не резолвить раньше обновления кнопки.
          if (!retryTimer) {
            addStatusHistory(`retry wait: ждём wrapped-колбэк ${WRAPPED_SYNC_GRACE_MS}мс`);
            retryTimer = setTimeout(() => {
              if (isEmbeddedConnected(tonConnectUI)) {
                addStatusHistory("resolved by state after retry wait");
                finish(true);
              }
            }, WRAPPED_SYNC_GRACE_MS);
          }
        }
      },
      (err) => {
        // SDK-ошибка подключения (connect_error). НЕ фатальна и НЕ резолвит false:
        // TDZ мог броситься при уже установленном соединении. Продолжаем поллить
        // состояние до появления адреса или таймаута.
        if (settled) return;
        const msg = String(err);
        if (isTdzError(msg)) {
          addStatusHistory("SDK TDZ (игнорируем, состояние проверяем поллингом)");
          return;
        }
        addSdkError(msg);
        addStatusHistory(`SDK connect/status error (не фатально): ${msg}`);
      }
    );

    // Обёрнутый статус UI: как раз тот путь, по которому обновляется useTonWallet
    // и кнопка. Ошибка обёртки НЕ отменяет успешный результат.
    const unsubscribeWrapped = tonConnectUI.onStatusChange(
      (wallet) => {
        if (settled) return;
        if (wallet?.account?.address) {
          addStatusHistory("ui wallet appears");
          finish(false);
          return;
        }
        addStatusHistory("disconnected");
      },
      (err) => {
        if (settled) return;
        const msg = String(err);
        wrappedError = msg;
        if (isTdzError(msg)) {
          addStatusHistory("wrapped TDZ (игнорируем)");
          return;
        }
        addStatusHistory(`wrapped error (не критично): ${msg}`);
      }
    );

    // Поллер-страховка: не блокируемся только на колбэках. Первый тик —
    // синхронная проверка сразу после старта (не ждём первый interval-тип).
    const pollTick = () => {
      if (settled) return;
      if (isEmbeddedConnected(tonConnectUI)) {
        addStatusHistory("resolved by state (poll)");
        finish(true);
      }
    };
    pollTick();
    poll = window.setInterval(pollTick, CONNECTED_POLL_MS);

    // Таймаут: сначала проверяем факт подключения по состоянию.
    timeout = window.setTimeout(() => {
      if (settled) return;
      if (isEmbeddedConnected(tonConnectUI)) {
        addStatusHistory("timeout but already connected");
        finish(true);
        return;
      }
      // Финальный grace-перепровер перед тем, как считать попытку проваленной.
      window.setTimeout(() => {
        if (settled) return;
        if (isEmbeddedConnected(tonConnectUI)) {
          addStatusHistory("resolved by final grace check after timeout");
          finish(true);
          return;
        }
        if (retryTimer) clearTimeout(retryTimer);
        settled = true;
        cleanup();
        addStatusHistory(
          `timeout ${timeoutMs}мс${wrappedError ? `; wrapped error: ${wrappedError}` : ""}`
        );
        resolve(false);
      }, FINAL_STATE_CHECK_DELAY_MS);
    }, timeoutMs);
  });
}