import { TonClient, TonClient4 } from "ton";
import {
  getClientV2 as sdkGetClientV2,
  getClientV4 as sdkGetClientV4,
} from "ton-vote-contracts-sdk";
import {
  CLIENT_V2_API_KEY,
  CLIENT_V4_ENDPOINT,
  DEFAULT_CLIENT_V2_ENDPOINT,
} from "config";

const ORBS_DISCOVERY_TIMEOUT_MS = 4_000;
const TONCENTER_TIMEOUT_MS = 8_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

// Общий клиент для чтения с цепочки. Раньше каждый вызов создавал новый клиент
// через orbs-дискавери (ton.access.orbs.network/mngr/nodes), а приложение
// вызывало getClientV2() десятки раз на страницу — сервис отвечал 429 и
// клиент не создавался, из-за чего страницы ДАО/предложений зависали в
// бесконечной загрузке. Теперь клиент кэшируется (один запрос к orbs на
// сессию), а при недоступности orbs используется фиксированный toncenter.
let cachedClientV2: TonClient | null = null;

export const getClientV2 = async (
  customEndpoint?: string,
  apiKey?: string
): Promise<TonClient> => {
  if (customEndpoint) {
    return new TonClient({
      endpoint: customEndpoint,
      apiKey: apiKey || CLIENT_V2_API_KEY,
      timeout: TONCENTER_TIMEOUT_MS,
    });
  }

  if (cachedClientV2) return cachedClientV2;

  try {
    cachedClientV2 = await withTimeout(
      sdkGetClientV2(),
      ORBS_DISCOVERY_TIMEOUT_MS
    );
  } catch {
    cachedClientV2 = new TonClient({
      endpoint: DEFAULT_CLIENT_V2_ENDPOINT,
      apiKey: CLIENT_V2_API_KEY,
      timeout: TONCENTER_TIMEOUT_MS,
    });
  }

  return cachedClientV2;
};

export const getSafeClientV2 = async (): Promise<TonClient | null> => {
  try {
    return await getClientV2();
  } catch {
    return null;
  }
};

export const getClientV4 = (customEndpoint?: string): Promise<TonClient4> =>
  sdkGetClientV4(customEndpoint || CLIENT_V4_ENDPOINT);