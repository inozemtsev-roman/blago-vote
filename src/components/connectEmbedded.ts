import type { TonConnectUI } from "@tonconnect/ui";
import { showToast } from "toasts";
import { setConnectDebug } from "connectDebug";

const GRADOSPHERA_WALLET_APP_NAME = "gradospherawallet";
const EMBEDDED_CONNECT_TIMEOUT_MS = 5000;

export async function tryConnectEmbeddedWallet(
  tonConnectUI: TonConnectUI,
): Promise<boolean> {
  const t0 = performance.now();

  // Быстрая проверка: мы во фрейме и мост установлен — только тогда есть смысл
  // пробовать встроенный коннект. Если нет, сразу уходим в обычный флоу.
  const inFrame = window.parent !== window;
  const hasBridge = !!(window as any).mytonwallet?.tonconnect;
  if (!(inFrame && hasBridge)) {
    setConnectDebug({ fallback: "нет встроенного кошелька (не во фрейме кошелька)" });
    return false;
  }

  try {
    const wallets = await tonConnectUI.getWallets();
    const target = wallets.find(
      (wallet) => wallet.appName === GRADOSPHERA_WALLET_APP_NAME
    );

    setConnectDebug({
      gotTarget: !!target,
      targetInjected: !!(target as any)?.injected,
      targetEmbedded: !!(target as any)?.embedded,
    });

    if (!target || !("jsBridgeKey" in target)) {
      setConnectDebug({ fallback: "gradospherawallet не найден в списке кошельков" });
      return false;
    }

    const hasJsProvider =
      target.injected ||
      target.embedded ||
      !!(window as any)[target.jsBridgeKey]?.tonconnect;
    setConnectDebug({ hasJsProvider });
    if (!hasJsProvider) {
      setConnectDebug({ fallback: "нет js-провайдера у gradospherawallet" });
      return false;
    }

    await Promise.race([
      tonConnectUI.connector.connect({ jsBridgeKey: target.jsBridgeKey }),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("Embedded connect timeout")),
          EMBEDDED_CONNECT_TIMEOUT_MS
        )
      ),
    ]);

    setConnectDebug({
      connectResult: true,
      connectMs: Math.round(performance.now() - t0),
    });
    return true;
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