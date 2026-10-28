import { Fade, styled } from "@mui/material";
import { keyframes } from "@mui/system";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { StyledFlexColumn, StyledGrid } from "styles";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorBoundary";
import { Toolbar } from "./Toolbar";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { MobileNav } from "./MobileNav";
import { TelegramBackButton } from "./TelegramBackButton";
import { MOBILE_WIDTH, TOOLBAR_WIDTH } from "consts";
import { useAppQueryParams, useAppSettings } from "hooks/hooks";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { LatestBlock } from "components";
import { getStartParam, isTelegram } from "multisig/utils/telegram";

const useIsBeta = () => {
  const {
    query: { dev },
  } = useAppQueryParams();
  const setBeta = useAppSettings().setBeta;

  useEffect(() => {
    if (dev) {
      setBeta(true);
    }
  }, [dev, setBeta]);
};

// Служебный start_param возврата TonConnect после подтверждения в Telegram
// Wallet: приложение перезапускается с `startapp=tonconnect` (плюс id/v/trace_id
// в query). Это НЕ адрес предложения: редирект на /proposal/tonconnect стирал
// URL-hash с #tgWebAppData (launch-параметры TonConnect) и «сбрасывал»
// авторизацию кошелька — connect-event от кошелька терялся, а пользователь
// попадал на битую страницу.
function isTonConnectServiceStartParam(param: string): boolean {
  return param === "tonconnect" || param.startsWith("tonconnect-");
}

// Перенаправление из Telegram Mini App на страницу предложения, если переход
// открыт кнопкой бота («Открыть в приложении») — в start_param передан адрес.
// Компонент находиТСЯ ВНУТРИ Router, поэтому useNavigate() гарантированно
// работает. isTelegram()/getStartParam() читаются на момент вызова: SDK Telegram
// подставляется/инъектируется асинхронно, а при запуске из url-кнопки в канале
// данные могут появиться не сразу. Поэтому НЕ выходим заранее, если isTelegram()
// ещё ложен, а проверяем оба условия внутри цикла с повторными попытками.
function TelegramStartParamRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 40;

    const tryRedirect = () => {
      if (cancelled) return;
      if (isTelegram()) {
        const param = getStartParam();
        if (param) {
          // Возврат из TonConnect (кошелёк Telegram) — не редиректим и не
          // трогаем URL, чтобы TonConnect UI успел забрать launch-параметры.
          if (isTonConnectServiceStartParam(param)) return;
          navigate(`/proposal/${param}`, { replace: true });
          return;
        }
      }
      if (attempts < MAX_ATTEMPTS) {
        attempts += 1;
        setTimeout(tryRedirect, 250);
      }
    };

    tryRedirect();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}

// Длительность слайда и его кривая. Переиспользуются в анимации и в
// setTimeout, который завершает переход.
const SLIDE_DURATION_MS = 320;
const SLIDE_EASING = "cubic-bezier(0.3, 0.8, 0.2, 1)";

// Индексы вкладок нижнего меню (Главная -> ДАО -> Мультикошелек).
const mainTabIndex = (pathname: string): number | null => {
  if (pathname === "/") return 0;
  if (pathname === "/manage") return 1;
  if (pathname.startsWith("/multisig")) return 2;
  return null;
};

// Одна «сцена» сдвига. Уходящая и приходящая страницы лежат рядом внутри
// одного трека, поэтому при сдвиге выглядят как единый «поезд»: одна уезжает
// вбок, вторая выезжает ей навстречу.
const stageEnterRight = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

const stageEnterLeft = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const stageExitRight = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
`;

const stageExitLeft = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
`;

// Одна страница на сцене. Обе страницы (уходящая и приходящая) лежат рядом
// внутри абсолютно позиционированного трека.
const StyledStagePage = styled("div")({
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  minHeight: "100%",
});

// Поверхность перехода: overflow-hidden, клипы по краям при сдвиге.
const StyledCarousel = styled("div")({
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
});

const StyledTrack = styled("div")({
  position: "relative",
  width: "100%",
  height: "100%",
});

// Слайд-переход между вкладками нижнего меню. Во время перехода уходящая
// страница остаётся смонтированной: её элемент (<Outlet />) сохраняется в
// состояние до смены location и рендерится второй сценой, поэтому обе
// страницы скользят одновременно. Внутри вкладки (без смены индекса)
// уходящей сцены нет.
function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const index = mainTabIndex(location.pathname);
  const prevIndexRef = useRef<number | null>(index);
  // Элемент уходящей страницы; пока не null — рендерится вторая сцена.
  const [exitOutlet, setExitOutlet] = useState<ReactNode>(null);
  const [direction, setDirection] = useState<"left" | "right">("left");

  // Самый свежий outlet для предыдущей страницы.
  const outletRef = useRef(outlet);
  useEffect(() => {
    outletRef.current = outlet;
  }, [outlet]);

useEffect(() => {
    const prevIndex = prevIndexRef.current;

    if (prevIndex !== null && index !== null && prevIndex !== index) {
      // Переход между вкладками — берём снимок прежней страницы.
      setExitOutlet(outletRef.current);
      setDirection(index > prevIndex ? "right" : "left");

      const timeout = setTimeout(() => {
        setExitOutlet(null);
      }, SLIDE_DURATION_MS);

      return () => clearTimeout(timeout);
    }

    prevIndexRef.current = index;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, location.pathname]);

  if (exitOutlet) {
    return (
      <StyledCarousel>
        <StyledTrack>
          <StyledStagePage
            style={{
              animation: `${
                direction === "right" ? stageExitRight : stageExitLeft
              } ${SLIDE_DURATION_MS}ms ${SLIDE_EASING} both`,
              pointerEvents: "none",
            }}
          >
            {exitOutlet}
          </StyledStagePage>
          <StyledStagePage
            style={{
              animation: `${
                direction === "right" ? stageEnterRight : stageEnterLeft
              } ${SLIDE_DURATION_MS}ms ${SLIDE_EASING} both`,
            }}
          >
            {outlet}
          </StyledStagePage>
        </StyledTrack>
      </StyledCarousel>
    );
  }

  return (
    <StyledCarousel>
      <StyledTrack>
        <StyledStagePage>{outlet}</StyledStagePage>
      </StyledTrack>
    </StyledCarousel>
  );
}

function Layout({ children }: { children?: ReactNode }) {
  useIsBeta();

  return (
    <>
      <Fade in={true} timeout={500}>
        <StyledContainer>
          <Toolbar />
          <Navbar />
          <ErrorBoundary
            fallbackRender={(props) => <ErrorFallback {...props} />}
          >
            <StyledContent>
              {children}
              <AnimatedOutlet />
              <Footer />
            </StyledContent>
          </ErrorBoundary>
        </StyledContainer>
      </Fade>
      <TelegramStartParamRedirect />
      <TelegramBackButton />
      <MobileNav />
      {/* <LatestBlock /> */}
      <Toaster
        toastOptions={{
          className: "toast",
        }}
      />
    </>
  );
}

const Wrapped = ({ children }: { children?: ReactNode }) => {
  return (
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Layout>{children}</Layout>
      <ReactQueryDevtools />
    </QueryParamProvider>
  );
};

const StyledContent = styled(StyledGrid)({
  paddingTop: 100,
  paddingBottom: 24,
  flex: 1,
  paddingLeft: TOOLBAR_WIDTH,
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    paddingTop: 80,
    paddingLeft: 0,
    paddingBottom: `calc(${TOOLBAR_WIDTH + 24}px + env(safe-area-inset-bottom, 0px))`,
  },
});

const StyledContainer = styled(StyledFlexColumn)({
  // В Telegram Mini App 100vh включает скрытую область; используем высоту
  // стабильного viewport из tma.js, с fallback на 100vh вне Telegram.
  minHeight: "var(--tg-viewport-stable-height, 100vh)",
  gap: 0,
  display: "flex",
});

export default Wrapped;
