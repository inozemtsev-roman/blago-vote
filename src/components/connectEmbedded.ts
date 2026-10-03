import type { TonConnectUI } from "@tonconnect/ui";
import { showToast } from "toasts";
import {
  addStatusHistory,
  addSdkError,
  setConnectDebug,
  dumpConnectDebug,
} from "connectDebug";
import { getLastEmbeddedConnectResponse } from "tonConnectBridge";

const GRADOSPHERA_WALLET_APP_NAME = "gradospherawallet";
// Race с таймаутом (максимум удержания state-poller'а — 60с).
const EMBEDDED_CONNECT_TIMEOUT_MS = 60000;
// Как часто проверять факт подключения по состоянию (не только по колбэкам).
const CONNECTED_POLL_MS = 150;
// Пауза после появления адреса в SDK, чтобы успел сработать wrapped-колбэк UI.
const WRAPPED_SYNC_GRACE_MS = 500;
// Финальный grace после таймаута: SDK мог доставить connect ровно в момент
// таймаута (poll-цикл мог промахнуться) — даём один короткий шанс.
const FINAL_STATE_CHECK_DELAY_MS = 300;

// Единый признак «подключены»: состояние SDK и UI без ожидания колбэков.
// Wrapped onStatusChange в бандле @tonconnect/ui может молча падать (TDZ
// в bundle кошелька / Cannot find WalletInfo), поэтому состояние важнее.
// Проверяем максимально широко ВСЕ возможные пути хранения адреса.
function isEmbeddedConnected(tonConnectUI: TonConnectUI): boolean {
  const ui = tonConnectUI as any;
  const conn = ui.connector as any;
  const addr =
    conn?.wallet?.account?.address ||
    conn?.walletInfo?.account?.address ||
    ui.wallet?.account?.address ||
    ui.wallet?.address ||
    ui.walletInfo?.account?.address ||
    ui.account?.address ||
    (ui.connected && (ui.wallet?.account?.address || ui.account?.address));
  return !!addr;
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
    connectorHasWallet: !!tonConnectUI.connector?.wallet?.account?.address,
    uiHasWallet: !!tonConnectUI.wallet?.account?.address,
    uiConnected: tonConnectUI.connected,
    bridgeHasTonconnect: !!(window as any).mytonwallet?.tonconnect,
    jsBridgeKeyTarget: (target as any)?.jsBridgeKey,
  };
}

// Fallback против TDZ-бага в bundle кошелька: SDK получает connect OK, но
// обработка событий падает ДО присвоения connector.wallet (доказано дампом:
// connectorHasWallet=false при bridge `connect OK items=[ton_addr]`).
// Если мост подтвердил адрес — материализуем wallet сами (та же форма, что
// строит SDK в onWalletConnected: device/provider/account). Сеттер connector.wallet
// нотифицирует подписчиков SDK, включая внутреннюю подписку UI, поэтому кнопка
// и useTonWallet обновятся штатно, а sendTransaction работает через живой provider.
function materializeWalletIfNeeded(tonConnectUI: TonConnectUI): boolean {
  if (isEmbeddedConnected(tonConnectUI)) return true;

  const response = getLastEmbeddedConnectResponse() as
    | {
        event?: string;
        payload?: {
          items?: {
            name?: string;
            address?: string;
            network?: string;
            publicKey?: string;
            walletStateInit?: string;
          }[];
          device?: unknown;
        };
      }
    | null
    | undefined;
  if (!response || response.event !== "connect" || !response.payload) {
    return false;
  }

  const item = (response.payload.items ?? []).find(
    (it) => it?.name === "ton_addr"
  );
  if (!item?.address) return false;

  const wallet = {
    device: response.payload.device ?? {},
    provider: "injected",
    account: {
      address: item.address,
      chain: item.network ?? "mainnet",
      walletStateInit: item.walletStateInit ?? "",
      publicKey: item.publicKey ?? "",
    },
  };

  const conn = tonConnectUI.connector as unknown as {
    wallet: unknown;
  };
  try {
    conn.wallet = wallet;
    addStatusHistory("materialized wallet from bridge connect response");
  } catch (e) {
    addSdkError(`materialize wallet failed: ${String(e)}`);
  }
  return isEmbeddedConnected(tonConnectUI);
}

export async function tryConnectEmbeddedWallet(
  tonConnectUI: TonConnectUI,
): Promise<boolean> {
  const t0 = performance.now();

  const inFrame = window.parent !== window;
  const hasBridge = !!(window as any).mytonwallet?.tonconnect;

  // state-first: поллер стартует СРАЗУ в начале функции — до getWallets()/поиска
  // target. Он ловит адрес в ЛЮБОМ поле подключения независимо от колбэков и TDZ.
  const pending = startConnectionWait(tonConnectUI, EMBEDDED_CONNECT_TIMEOUT_MS);

  if (!(inFrame && hasBridge)) {
    pending.cancel();
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
      pending.cancel();
      setConnectDebug({ fallback: "gradospherawallet не найден в списке кошельков" });
      return false;
    }

    const hasJsProvider = !!(window as any)[target.jsBridgeKey]?.tonconnect;
    setConnectDebug({ hasJsProvider, ...snapshotStatus(tonConnectUI, target) });
    if (!hasJsProvider) {
      pending.cancel();
      setConnectDebug({ fallback: "нет js-провайдера у gradospherawallet" });
      return false;
    }

    // Уже подключены по состоянию — поллер, вероятно, уже зарезолвил ok=true;
    // просто быстро возвращаем результат.
    if (isEmbeddedConnected(tonConnectUI)) {
      addStatusHistory("already connected by state");
      const connected = await pending.ok;
      setConnectDebug({
        connectResult: connected,
        connectMs: Math.round(performance.now() - t0),
        ...snapshotStatus(tonConnectUI, target),
      });
      return connected;
    }

    addStatusHistory("connect start (raw connector.connect)");
    // Прямой SDK-путь: он доказуемо доходит до кошелька и получает connect OK
    // (мост фиксирует methodResponse). Официальный openModal()-путь вызывает
    // TDZ в bundle кошелька (ReferenceError: can't access lexical declaration
    // 'l' before initialization) — это не мешает детекции по состоянию ниже.
    //
    // TDZ/ошибки SDK здесь НЕ фатальны: ловим, логируем, поллер продолжает
    // работать до появления адреса или таймаута. Исключение НЕ резолвит false.
    try {
      tonConnectUI.connector.connect({ jsBridgeKey: target.jsBridgeKey });
    } catch (e) {
      const msg = String(e);
      addSdkError(msg);
      addStatusHistory(isTdzError(msg) ? "connector.connect sync TDZ (игнорируем)" : `connector.connect sync error: ${msg}`);
    }

    const ok = await pending.ok;

    if (!ok) {
      // Финальная проверка по актуальному состоянию ПРЯМО перед тостом/фолбэком:
      // мост мог прислать connect OK, но SDK доставить wallet чуть позже таймаута —
      // тогда никакого обычного подключения не открываем, возвращаем connected.
      let nowConnected = isEmbeddedConnected(tonConnectUI);
      // Последний рубеж против TDZ-бага: мост подтвердил адрес → материализуем wallet.
      if (!nowConnected) {
        nowConnected = materializeWalletIfNeeded(tonConnectUI);
        if (nowConnected) {
          addStatusHistory("resolved by materialized wallet before fallback");
        }
      }
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
    if (!connected) pending.cancel();
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

// Стартует state-poller + подписки сразу (синхронно). Резолвит true при ПЕРВОМ
// появлении адреса в любом поле (isConnected) — независимо от ошибок колбэков.
// cancel() — для ранних выходов (не embedded, нет target и т.п.): резолвит false.
function startConnectionWait(
  tonConnectUI: TonConnectUI,
  timeoutMs: number,
): { ok: Promise<boolean>; cancel: () => void } {
  let settled = false;
  let wrappedError: string | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let poll: number | undefined;
  let timeout: number | undefined;
  let resolveOk!: (value: boolean) => void;
  const ok = new Promise<boolean>((resolve) => {
    resolveOk = resolve;
  });

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
    setConnectDebug({ pollResolvedByState: byState });
    addStatusHistory(byState ? "resolved by state (not callback)" : "resolved by callback");
    resolveOk(true);
  };

  // «Сырой» статус коннектора (SDK-уровень): срабатывает, когда SDK получил
  // от кошелька connect OK и выставил connector.wallet — без обёртки UI.
  const unsubscribeRaw = tonConnectUI.connector.onStatusChange(
    (wallet) => {
      if (settled) return;
      if (wallet?.account?.address || isEmbeddedConnected(tonConnectUI)) {
        addStatusHistory("connector wallet appears");
        finish(true);
        return;
      }
    },
    (err) => {
      // SDK-ошибка подключения (connect_error). НЕ фатальна и НЕ резолвит false:
      // если адрес уже есть — резолвим true; TDZ/иные ошибки не блокируют поллер.
      if (settled) return;
      if (isEmbeddedConnected(tonConnectUI)) {
        finish(true);
        return;
      }
      // Основной сценарий TDZ-бага: SDK упал на обработке connect OK. Мост уже
      // подтвердил адрес — материализуем wallet из bridge-ответа, если получилось.
      if (materializeWalletIfNeeded(tonConnectUI)) {
        addStatusHistory("materialized on raw SDK error");
        finish(true);
        return;
      }
      const msg = String(err);
      if (isTdzError(msg)) {
        addStatusHistory("SDK TDZ (игнорируем), состояние проверяем поллингом");
        return;
      }
      const stack = err instanceof Error ? err.stack ?? "" : "";
      addSdkError(stack ? `${msg}\n${stack}` : msg);
      addStatusHistory(`SDK connect/status error (не фатально): ${msg}`);
    }
  );

  // Обёрнутый статус UI: как раз тот путь, по которому обновляется useTonWallet
  // и кнопка. Ошибка обёртки НЕ отменяет успешный результат.
  const unsubscribeWrapped = tonConnectUI.onStatusChange(
    (wallet) => {
      if (settled) return;
      if (wallet?.account?.address || isEmbeddedConnected(tonConnectUI)) {
        addStatusHistory("ui wallet appears");
        finish(true);
        return;
      }
      addStatusHistory("disconnected");
    },
    (err) => {
      if (settled) return;
      if (isEmbeddedConnected(tonConnectUI)) {
        finish(true);
        return;
      }
      if (materializeWalletIfNeeded(tonConnectUI)) {
        addStatusHistory("materialized on wrapped error");
        finish(true);
        return;
      }
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
  let lastPollFlags = "";
  const pollTick = () => {
    if (settled) return;
    const hasConnWallet = !!tonConnectUI.connector?.wallet?.account?.address;
    const hasUiWallet = !!tonConnectUI.wallet?.account?.address;
    const connected = !!tonConnectUI.connected;
    const flags = `${hasConnWallet}${hasUiWallet}${connected}`;
    if (flags !== lastPollFlags) {
      lastPollFlags = flags;
      addStatusHistory(
        `poll check: hasConnWallet=${hasConnWallet} hasUiWallet=${hasUiWallet} connected=${connected}`
      );
    }
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
      // TDZ-баг: SDK так и не выставил wallet. Если мост подтвердил connect OK —
      // материализуем адрес сами в последний момент перед фолбэком.
      if (materializeWalletIfNeeded(tonConnectUI)) {
        addStatusHistory("resolved by materialized wallet (timeout grace)");
        finish(true);
        return;
      }
      if (retryTimer) clearTimeout(retryTimer);
      settled = true;
      cleanup();
      setConnectDebug({ pollResolvedByState: false });
      addStatusHistory(
        `timeout ${timeoutMs}мс${wrappedError ? `; wrapped error: ${wrappedError}` : ""}`
      );
      resolveOk(false);
    }, FINAL_STATE_CHECK_DELAY_MS);
  }, timeoutMs);

  const cancel = () => {
    if (settled) return;
    settled = true;
    if (retryTimer) clearTimeout(retryTimer);
    cleanup();
    setConnectDebug({ pollResolvedByState: false });
    resolveOk(false);
  };

  return { ok, cancel };
}