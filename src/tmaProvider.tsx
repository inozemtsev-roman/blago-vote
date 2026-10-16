import { createContext, useContext, useEffect, useState } from "react";
import { initTma } from "./tma";

type TmaApi = ReturnType<typeof initTma>;

const TmaContext = createContext<TmaApi>(null);

export function TmaProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<TmaApi>(null);

  useEffect(() => {
    const a = initTma();
    setApi(a);
    return () => {
      if (!a) return;
      const tryUnmount = (component: unknown) => {
        try {
          (component as { unmount?: () => void })?.unmount?.();
        } catch {
          // ignore
        }
      };
      tryUnmount(a.miniApp);
      tryUnmount(a.themeParams);
      tryUnmount(a.backButton);
      tryUnmount(a.closingBehavior);
      tryUnmount(a.mainButton);
      tryUnmount(a.secondaryButton);
    };
  }, []);

  return <TmaContext.Provider value={api}>{children}</TmaContext.Provider>;
}

export function useTma() {
  return useContext(TmaContext);
}
