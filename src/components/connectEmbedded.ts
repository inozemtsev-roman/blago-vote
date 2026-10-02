import type { TonConnectUI } from "@tonconnect/ui";
import { showToast } from "toasts";
import { addStatusHistory, setConnectDebug } from "connectDebug";

const GRADOSPHERA_WALLET_APP_NAME = "gradospherawallet";
// 60с: дать пользователю время подтвердить подключение в окне кошелька.
const EMBEDDED_CONNECT_TIMEOUT_MS = 60000;

export async function tryConnectEmbeddedWallet(
  tonConnectUI: TonConnectUI,
): Promise<boolean> {
  const t0 = performance.now();

  const inFrame = window.parent !== window;
  const hasBridge = !!(window as any).mytonwallet?.tonconnect;
  if (!(inFrame && hasBridge)) {
    setConnectDebug({ fallback: "нет встроенного кошелька (не во фрейме кошелька)" });
    return false;
  }

  let settled = false;
  let connectError: string | undefined;

  const connectionDone = new Promise<boolean>((resolve) => {
    // «Сырой» статус коннектора (SDK-уровень): срабатывает, когда SDK получил
    // от кошелька connect OK и выставил connector.wallet — без обёртки UI.
    const unsubscribeRaw = tonConnectUI.connector.onStatusChange((wallet) => {
      if (settled) return;
      if (wallet?.account?.address) {
        const uiStatus = tonConnectUI.wallet?.account?.address;
        addStatusHistory(
          `connector connected${uiStatus ? "" : " (UI не синхронизирован — ждём wrapped-колбэк)"}`
        );
        if (!uiStatus) {
          // Обёрнутый tonConnectUI.onStatusChange мог тихо упасть
          // (Cannot find WalletInfo...) — разрешаем поток, но кнопка,
          // читающая useTonWallet, обновится только если сработает UI-колбэк.
          settled = true;
          unsubscribeWrapped();
          resolve(true);
        }
      }
    });
    const unsubscribeWrapped = tonConnectUI.onStatusChange(
      (wallet) => {
        if (settled) return;
        const connected = !!wallet?.account?.address;
        addStatusHistory(connected ? "connected" : "disconnected");
        if (connected) {
          settled = true;
          unsubscribeRaw();
          unsubscribeWrapped();
          resolve(true);
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        connectError = String(err);
        addStatusHistory(`error: ${connectError}`);
        unsubscribeRaw();
        unsubscribeWrapped();
        resolve(false);
      }
    );
  });

  try {
    const wallets = await tonConnectUI.getWallets();
    const target = wallets.find(
      (wallet) => wallet.appName === GRADOSPHERA_WALLET_APP_NAME
    );

    setConnectDebug({
      gotTarget: !!target,
      targetInjected: !!(target as any)?.injected,
      targetEmbedded: !!(target as any)?.embedded,
      targetAppName: target?.appName,
      hasJsProviderByKey: !!(target && (window as any)[(target as any).jsBridgeKey]?.tonconnect),
    });

    if (!target || !("jsBridgeKey" in target)) {
      setConnectDebug({ fallback: "gradospherawallet не найден в списке кошельков" });
      return false;
    }

    const hasJsProvider = !!(window as any)[target.jsBridgeKey]?.tonconnect;
    setConnectDebug({ hasJsProvider });
    if (!hasJsProvider) {
      setConnectDebug({ fallback: "нет js-провайдера у gradospherawallet" });
      return false;
    }

    addStatusHistory("connect start (raw connector.connect)");
    // Прямой SDK-путь: именно он доказуемо доходит до кошелька и получает
    // connect OK (мост фиксирует methodResponse). Официальный openModal()-путь
    // кошелька с openModal/v3 вызывает TDZ в бандле кошелька
    // (ReferenceError: can't access lexical declaration 'l' before initialization).
    tonConnectUI.connector.connect({ jsBridgeKey: target.jsBridgeKey });

    const ok = await Promise.race([
      connectionDone,
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), EMBEDDED_CONNECT_TIMEOUT_MS)
      ),
    ]);

    setConnectDebug({
      connectResult: ok ? true : null,
      connectError: ok ? "" : "таймаут/ошибка (нет статуса connected)",
      connectMs: Math.round(performance.now() - t0),
    });

    if (!ok) {
      addStatusHistory(
        "не получили connected: кнопка останется неподключенной — проверь APP_NAME кошелька (MyTonWallet vs Gradosphera Wallet)"
      );
    }
    return ok;
  } catch (e) {
    setConnectDebug({
      connectResult: false,
      connectError: String(e),
      connectMs: Math.round(performance.now() - t0),
      fallback: "embedded connect не сработал",
    });
    console.warn("Не удалось подключиться через встроенный кошелёк:", e);

    if (inFrame) {
      showToast(
        "Встроенный кошелёк не ответил на запрос. Открываем обычное подключение.",
        { duration: 6000, position: "top-center" }
      );
    }
    return false;
  }
}