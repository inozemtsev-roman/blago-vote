import { createContext, useContext, useEffect, useState } from "react";
import { initTma } from "./tma";

const TmaContext = createContext<ReturnType<typeof initTma> | null>(null);

export function TmaProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<ReturnType<typeof initTma> | null>(null);

  useEffect(() => {
    const a = initTma();
    setApi(a);
    return () => {
      try {
        a.miniApp?.unmount?.();
      } catch {}
      try {
        a.viewport?.unmount?.();
      } catch {}
      try {
        a.themeParams?.unmount?.();
      } catch {}
      try {
        a.backButton?.unmount?.();
      } catch {}
      try {
        a.closingBehavior?.unmount?.();
      } catch {}
    };
  }, []);

  return <TmaContext.Provider value={api}>{children}</TmaContext.Provider>;
}

export function useTma() {
  return useContext(TmaContext);
}
