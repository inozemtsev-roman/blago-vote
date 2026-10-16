import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTma } from "tmaProvider";
import { isTelegram } from "multisig/utils/telegram";

const TOP_LEVEL = ["/", "/manage", "/multisig"];

// Показывает нативную кнопку «Назад» Telegram на внутренних страницах Mini App
// и прячет её на корневых. Клик использует историю приложения.
export function TelegramBackButton() {
  const tma = useTma();
  const location = useLocation();
  const navigate = useNavigate();
  const isTop = TOP_LEVEL.includes(location.pathname);

  useEffect(() => {
    if (!isTelegram() || !tma?.backButton) return;
    const canGoBack =
      isTop === false && ((window.history.state?.idx ?? 0) > 0);
    try {
      if (canGoBack) {
        tma.backButton.show();
      } else {
        tma.backButton.hide();
      }
    } catch {}
  }, [tma, location.pathname, isTop]);

  useEffect(() => {
    if (!isTelegram() || !tma?.backButton) return;
    const off = tma.backButton.onClick(() => navigate(-1));
    return () => {
      try {
        off();
      } catch {}
    };
  }, [tma, navigate]);

  return null;
}
