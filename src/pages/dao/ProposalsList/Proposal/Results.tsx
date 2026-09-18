import { Chip, styled, Typography } from "@mui/material";
import { Address } from "@ton/core";
import { useGetProposalSymbol, useProposalResults } from "hooks/hooks";
import { useDaoPageTranslations } from "i18n/hooks/useDaoPageTranslations";
import { useMemo } from "react";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { StyledAlert, StyledProposalPercent, StyledProposalResult, StyledProposalResultContent, StyledProposalResultProgress, StyledResultName, StyledTonAmount } from "../styles";

const QUORUM_PERCENT = 66;

const QUORUM_BADGE_HIDDEN_PROPOSALS = [
  "UQBaoXs1P1WGXYGJ_V1GuQCZi3iDr5wQKuJYBeiIEuOO4A9A",
];

const shouldShowQuorumBadge = (proposalAddress: string): boolean => {
  try {
    const target = Address.parse(proposalAddress).toRawString();
    return !QUORUM_BADGE_HIDDEN_PROPOSALS.some(
      (item) => Address.parse(item).toRawString() === target,
    );
  } catch {
    return true;
  }
};

export const Results = ({
  proposalAddress,
}: {
  proposalAddress: string;
}) => {
  const translations = useDaoPageTranslations();
  const results = useProposalResults(proposalAddress);
  const winnerPercent = Math.max(...results.map((it) => it.percent), 0);
  const isQuorumPassed = winnerPercent >= QUORUM_PERCENT;
  const showQuorumBadge = useMemo(
    () => shouldShowQuorumBadge(proposalAddress),
    [proposalAddress],
  );

  return (
    <StyledResults gap={10}>
      {showQuorumBadge && (
        <StyledQuorumChip
          label={isQuorumPassed ? "Кворум 2/3 пройден" : "Кворум 2/3 не пройден"}
          color={isQuorumPassed ? "success" : "warning"}
        />
      )}
      {!isQuorumPassed && (
        <StyledAlert severity="warning">
          <Typography>{translations.endedAndDidntPassedQuorum}</Typography>
        </StyledAlert>
      )}
      {results.map((result) => {
        return (
          <Result
            key={result.choice}
            title={result.choice}
            percent={result.percent}
            amount={result.amount}
          />
        );
      })}
    </StyledResults>
  );
};

const Result = ({
  title,
  percent = 0,
  amount = "",
}: {
  title: string;
  percent?: number;
  amount?: string;
}) => {
  return (
    <StyledProposalResult>
      <StyledProposalResultProgress style={{ width: `${percent}%` }} />
      <StyledProposalResultContent>
        <StyledFlexRow justifyContent="flex-start">
          <StyledResultName text={title} />
          <StyledTonAmount>
            {amount}
          </StyledTonAmount>
        </StyledFlexRow>
        <StyledProposalPercent>{percent}%</StyledProposalPercent>
      </StyledProposalResultContent>
    </StyledProposalResult>
  );
};

const StyledResults = styled(StyledFlexColumn)({
  width: "100%",
});

const StyledQuorumChip = styled(Chip)({
  width: "fit-content",
  fontWeight: 600,
});
