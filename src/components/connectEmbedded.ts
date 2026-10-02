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
    const unsubscribe = tonConnectUI.onStatusChange(
      (wallet) => {
        if (settled) return;
        const connected = !!wallet?.account?.address;
        addStatusHistory(connected ? "connected" : "disconnected");
        if (connected) {
          settled = true;
          unsubscribe();
          resolve(true);
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        connectError = String(err);
        addStatusHistory(`error: ${connectError}`);
        unsubscribe();
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

    addStatusHistory("connect start (official embedded path)");
    try {
      // Официальный путь: openModal() сам находит встроенный кошелёк
      // (embedded=true от isWalletBrowser) и вызывает connectEmbeddedWallet,
      // который регистрирует запись кошелька в widgetController ДО вызова
      // connector.connect(). Без регистрации обёрнутый tonConnectUI.onStatusChange
      // может тихо падать (Cannot find WalletInfo...) и useTonWallet не обновится.
      await tonConnectUI.openModal();
      addStatusHistory("openModal resolved");
    } catch (err) {
      // connectEmbeddedWallet ждёт подключения и может отклонить promise,
      // если подключение не завершилось — полагаемся на connectionDone.
      addStatusHistory(`openModal finished: ${String(err)}`);
    }

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