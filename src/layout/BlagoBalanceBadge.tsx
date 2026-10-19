import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton, styled, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTonAddress } from "@tonconnect/ui-react";
import {
  BLAGO_JETTON_ADDRESS,
  BLAGO_JETTON_DECIMALS,
  IS_TESTNET,
} from "multisig/constants";
import { MOBILE_WIDTH } from "consts";
import { openLink, openTelegramLink } from "multisig/utils/telegram";
import { useCopyToClipboard } from "hooks/hooks";
import { Button } from "components";

const formatBalance = (balance: string, decimals: number): string => {
  if (!balance) return "";
  try {
    const value = BigInt(balance);
    if (decimals <= 0) return value.toLocaleString("ru-RU");
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const frac = value % divisor;
    if (frac === 0n) return whole.toLocaleString("ru-RU");
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return whole.toLocaleString("ru-RU") + "," + fracStr;
  } catch {
    return "";
  }
};

const REFETCH_MS = 60 * 1000;

// Кошелёк ДАО Градосфера в Telegram — отсюда выдают жетон Благо.
const WALLET_BOT_URL = "https://t.me/wallet_gradosphera_bot/open";

// Небольшой бедж с балансом жетонов «Благо» подключённого кошелька.
// Отображается слева от кнопки «Кошелёк», пока кошелёк подключён.
// По клику открывает нижнюю панель с информацией по жетону.
export function BlagoBalanceBadge() {
  const address = useTonAddress();
  const [panelOpen, setPanelOpen] = useState(false);
  const { data } = useQuery(
    ["blagoBalance", address],
    async () => {
      const { fetchJettonBalance } = await import(
        "multisig/utils/MultisigRegistry"
      );
      return fetchJettonBalance(BLAGO_JETTON_ADDRESS, address, IS_TESTNET);
    },
    {
      enabled: !!address,
      staleTime: REFETCH_MS,
      refetchInterval: REFETCH_MS,
      retry: 1,
    }
  );

  if (!address) return null;
  const text = formatBalance(
    typeof data === "string" ? data : "",
    BLAGO_JETTON_DECIMALS
  ) || "—";

  return (
    <>
      <StyledBadge
        as="button"
        type="button"
        title="Жетон Благо — подробности"
        onClick={() => setPanelOpen(true)}
      >
        {text} Благо
      </StyledBadge>
      <BlagoPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        balanceText={text}
      />
    </>
  );
}

const BADGE_GREEN = "#4bb34b";

const StyledBadge = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  height: 32,
  padding: "0 12px",
  borderRadius: 40,
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
  flexShrink: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  color: BADGE_GREEN,
  background:
    theme.palette.mode === "dark"
      ? "rgba(75,179,75,0.16)"
      : "rgba(75,179,75,0.10)",
  border: `1px solid ${BADGE_GREEN}`,
  "&:hover": {
    background:
      theme.palette.mode === "dark"
        ? "rgba(75,179,75,0.26)"
        : "rgba(75,179,75,0.18)",
  },
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    height: 36,
    padding: "0 8px",
    fontSize: 12,
  },
}));

// Нижняя панель с информацией по жетону Благо — по образцу
// gradosphera-wallet/dev/panel.html: фиксирована внизу, скругление сверху,
// открытие/закрытие — slide-up трансформом (0.5s cubic-bezier), полупрозрачный
// бэкдроп. Рендерится порталом в body, чтобы перекрывать нижнее меню (z 30).
function BlagoPanel({
  open,
  onClose,
  balanceText,
}: {
  open: boolean;
  onClose: () => void;
  balanceText: string;
}) {
  const [, copy] = useCopyToClipboard();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleGet = () => {
    if (!openTelegramLink(WALLET_BOT_URL)) {
      openLink(WALLET_BOT_URL);
    }
  };

  const handleCopyAddress = () => {
    copy(BLAGO_JETTON_ADDRESS);
  };

  return createPortal(
    <>
      <StyledBackdrop className={open ? "show" : ""} onClick={onClose} />
      <StyledPanel
        className={open ? "open" : "closed"}
        onClick={(e) => e.stopPropagation()}
      >
        <StyledPanelContent>
          <StyledPanelHeader>
            <Typography className="panel-title">Жетон Благо</Typography>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Закрыть"
              className="panel-close"
            >
              ✕
            </IconButton>
          </StyledPanelHeader>

          <StyledBalance>
            {balanceText} <span>Благо</span>
          </StyledBalance>

          <Typography className="panel-description">
            Жетон управления Градосферой: 1 жетон = 1 голос. Начисляется за
            подключение и активацию кошелька ДАО Градосфера.
          </Typography>

          <StyledInfoRow>
            <span className="label">Адрес жетона</span>
            <button
              type="button"
              className="value code"
              onClick={handleCopyAddress}
              title="Нажмите, чтобы скопировать"
            >
              {BLAGO_JETTON_ADDRESS}
            </button>
          </StyledInfoRow>
          <StyledInfoRow>
            <span className="label">Сеть</span>
            <span className="value">
              {IS_TESTNET ? "TON Testnet" : "TON Mainnet"}
            </span>
          </StyledInfoRow>
          <StyledInfoRow>
            <span className="label">Точность</span>
            <span className="value">
              {BLAGO_JETTON_DECIMALS} (1 жетон = 1 голос)
            </span>
          </StyledInfoRow>

          <StyledGetButton onClick={handleGet}>
            Получить жетон Благо за подключение и активацию кошелька ДАО
            Градосфера
          </StyledGetButton>
        </StyledPanelContent>
      </StyledPanel>
    </>,
    document.body
  );
}

const StyledBackdrop = styled("div")({
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
  zIndex: 120,
  willChange: "opacity",
  "&.show": {
    opacity: 1,
    pointerEvents: "auto",
  },
});

const StyledPanel = styled("div")(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: "50%",
  right: "auto",
  width: "100%",
  maxWidth: 560,
  height: "68%",
  boxSizing: "border-box",
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
  borderRadius: "15px 15px 0 0",
  border: `1px solid ${theme.palette.divider}`,
  borderBottom: "none",
  overflow: "hidden",
  zIndex: 121,
  willChange: "transform",
  transition: "transform 0.5s cubic-bezier(0.3, 0.8, 0.2, 1)",
  // Центрируем по горизонтали через translateX, чтобы анимация Y не мешала.
  transform: "translateX(-50%) translateY(100%)",
  "&.open": {
    transform: "translateX(-50%) translateY(0)",
  },
}));

const StyledPanelContent = styled("div")({
  padding: 20,
  height: "100%",
  boxSizing: "border-box",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 14,
});

const StyledPanelHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  ".panel-title": {
    fontSize: 20,
    fontWeight: 800,
    color: theme.typography.h2.color,
  },
  ".panel-close": {
    color: theme.palette.text.secondary,
  },
}));

const StyledBalance = styled("div")(({ theme }) => ({
  fontSize: 34,
  fontWeight: 800,
  color: BADGE_GREEN,
  span: {
    fontSize: 18,
    fontWeight: 700,
  },
}));

const StyledInfoRow = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  ".label": {
    fontSize: 13,
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  ".value": {
    fontSize: 14,
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: 0,
    color: theme.palette.text.primary,
    font: "inherit",
  },
  ".code": {
    fontFamily: "monospace",
    fontSize: 13,
    wordBreak: "break-all",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
  },
}));

const StyledGetButton = styled(Button)({
  width: "100%",
  marginTop: "auto",
  whiteSpace: "normal",
  lineHeight: 1.3,
  padding: "12px 20px",
});
