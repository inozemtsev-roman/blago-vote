import { Fade, styled } from "@mui/material";
import { keyframes } from "@mui/system";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { StyledFlexColumn, StyledGrid } from "styles";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorBoundary";
import { Toolbar } from "./Toolbar";
import { ReactNode, useEffect, useRef } from "react";
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

// Индексы страниц нижнего меню (Главная -> ДАО -> Мультикошелек). Нужны, чтобы
// понять направление слайда при переходе между вкладками.
const mainTabIndex = (pathname: string): number | null => {
  if (pathname === "/") return 0;
  if (pathname === "/manage") return 1;
  if (pathname.startsWith("/multisig")) return 2;
  return null;
};

const slideFromRight = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideFromLeft = keyframes`
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const SlideWrapper = styled("div", {
  shouldForwardProp: (prop) => prop !== "$dir",
})<{ $dir: "left" | "right" | "none" }>(({ $dir }) => ({
  width: "100%",
  // fill-mode "backwards": предзапуск сдвинутого состояния без «вспышки»,
  // но после анимации transform снимается (иначе он создаёт containing block
  // для position: fixed внутри страниц).
  animation:
    $dir === "none"
      ? "none"
      : `${$dir === "right" ? slideFromRight : slideFromLeft} 0.28s ease backwards`,
}));

// Слайд-переход между вкладками нижнего меню. Оборачивает <Outlet/> и
// перемонтируется по смене пути, запуская анимацию в нужную сторону.
function AnimatedOutlet() {
  const location = useLocation();
  const index = mainTabIndex(location.pathname);
  const prevIndexRef = useRef<number | null>(index);

  let dir: "left" | "right" | "none" = "none";
  if (
    prevIndexRef.current !== null &&
    index !== null &&
    prevIndexRef.current !== index
  ) {
    dir = index > prevIndexRef.current ? "right" : "left";
  }

  useEffect(() => {
    prevIndexRef.current = index;
  }, [index]);

  return (
    <SlideWrapper key={location.pathname} $dir={dir}>
      <Outlet />
    </SlideWrapper>
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
