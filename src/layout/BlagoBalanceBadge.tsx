import { styled } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTonAddress } from "@tonconnect/ui-react";
import {
  BLAGO_JETTON_ADDRESS,
  BLAGO_JETTON_DECIMALS,
  IS_TESTNET,
} from "multisig/constants";
import { MOBILE_WIDTH } from "consts";

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

// Небольшой бедж с балансом жетонов «Благо» подключённого кошелька.
// Отображается слева от кнопки «Кошелёк», пока кошелёк подключён.
export function BlagoBalanceBadge() {
  const address = useTonAddress();
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
  );
  if (!text) return null;

  return (
    <StyledBadge title={`${text} Благо`}>
      {text} Благо
    </StyledBadge>
  );
}

const StyledBadge = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  height: 32,
  padding: "0 12px",
  borderRadius: 40,
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
  flexShrink: 0,
  color: theme.palette.primary.main,
  background:
    theme.palette.mode === "dark"
      ? "rgba(48,105,255,0.16)"
      : "rgba(48,105,255,0.10)",
  border: `1px solid ${theme.palette.primary.main}`,
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    height: 36,
    padding: "0 8px",
    fontSize: 12,
  },
}));
