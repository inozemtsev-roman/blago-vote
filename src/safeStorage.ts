import type { IStorage } from "@tonconnect/sdk";

class InMemoryStorage implements IStorage {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Storage для SDK TonConnect, который не может сломать подключение.
 *
 * В кросс-доменном iframe (приложение открыто внутри кошелька) доступ
 * к localStorage может быть заблокирован браузером/WebView, и прямой
 * `localStorage.setItem` бросит SecurityError. SDK вызывает `setItem`
 * внутри `_connect` (updateSession) ДО выдачи события `connect`, поэтому
 * такое исключение молча убивает подключение: мост получает connect OK,
 * а connector.wallet так и не выставляется.
 *
 * Здесь каждый вызов обёрнут в try/catch с фолбэком на in-memory хранилище —
 * SDK всегда сможет завершить подключение, а при доступном localStorage
 * сессия персистится как обычно.
 */
export function createSafeTonConnectStorage(): IStorage {
  const memory = new InMemoryStorage();

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const value = window.localStorage.getItem(key);
        return value;
      } catch {
        return memory.getItem(key);
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        return memory.setItem(key, value);
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        window.localStorage.removeItem(key);
      } catch {
        return memory.removeItem(key);
      }
    },
  };
}