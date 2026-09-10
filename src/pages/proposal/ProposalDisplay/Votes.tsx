import { Box, Chip, Fade, styled, Typography, useTheme } from "@mui/material";
import {
  AddressDisplay,
  AppTooltip,
  Button,
  List,
  LoadingContainer,
  LoadMore,
  NumberDisplay,
  TitleContainer,
} from "components";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import {
  nFormatter,
  normalizeTonAddress,
  parseLanguage,
  toNoBounceAddress,
} from "utils";
import { PAGE_SIZE } from "config";
import { Vote } from "types";
import { fromNano } from "ton";
import { useMemo, useState } from "react";
import moment from "moment";
import _ from "lodash";
import { CSVLink } from "react-csv";

import { GrDocumentCsv } from "react-icons/gr";
import { useProposalPageTranslations } from "i18n/hooks/useProposalPageTranslations";
import { useTonAddress } from "@tonconnect/ui-react";
import { useCsvData, useWalletVote } from "../hooks";
import {
  useAppParams,
  useGetProposalSymbol,
  useIsOneWalletOneVote,
} from "hooks/hooks";
import { useProposalQuery } from "query/getters";

const ContainerHeader = () => {
  const { proposalAddress } = useAppParams();
  const { data } = useProposalQuery(proposalAddress);
  
  const totalTonAmount =
    data?.proposalResult?.totalWeight ||
    data?.proposalResult?.totalWeights ||
    "0";
  
  const votesLength = _.size(data?.votes);
  const isOneWalletOneVote = useIsOneWalletOneVote(proposalAddress);
  const tonAmount = useMemo(() => {
    return nFormatter(Number(fromNano(totalTonAmount)));
  }, [totalTonAmount]);


  const symbol = useGetProposalSymbol(proposalAddress);
  const hideSymbol = isOneWalletOneVote;

  return (
    <StyledContainerHeader>
      <StyledChip
        label={
          <>
            <NumberDisplay value={votesLength} /> гол.
          </>
        }
      />
      <StyledFlexRow style={{ width: "unset" }} gap={10}>
        {!hideSymbol && (
          <Typography className="total" style={{ fontWeight: 600 }}>
            {tonAmount} {symbol}
          </Typography>
        )}
        <DownloadCSV />
      </StyledFlexRow>
    </StyledContainerHeader>
  );
};

const ConnectedWalletVote = () => {
  const { proposalAddress } = useAppParams();

  const { data, dataUpdatedAt } = useProposalQuery(proposalAddress);
  const walletVote = useWalletVote(data?.votes, dataUpdatedAt);
  const symbol = useGetProposalSymbol(proposalAddress);
  const isOneWalletOneVote = useIsOneWalletOneVote(proposalAddress);

  return (
    <VoteComponent
      hideVotingPower={!!isOneWalletOneVote}
      symbol={symbol}
      data={walletVote}
      isCurrentUser
    />
  );
};

const StyledContainerHeader = styled(StyledFlexRow)({
  flex: 1,
  justifyContent: "space-between",
  ".total": {
    fontSize: 14,
  },
  "@media (max-width: 600px)": {
    ".total": {
      fontSize: 13,
    },
  },
});

export function Votes() {
  const connectedAddress = normalizeTonAddress(useTonAddress());
  const [votesShowAmount, setShowVotesAMount] = useState(PAGE_SIZE);
  const translations = useProposalPageTranslations();
  const { proposalAddress } = useAppParams();

  const { data, isLoading } = useProposalQuery(proposalAddress);

  // Всегда показываем голоса от новых к старым, независимо от порядка,
  // в котором их вернул сервер или локальное хранилище.
  const votes = useMemo(
    () => _.orderBy(data?.votes, "timestamp", "desc"),
    [data?.votes]
  );

  const isOneWalletOneVote = useIsOneWalletOneVote(proposalAddress);

  const symbol = useGetProposalSymbol(proposalAddress);
  const showMoreVotes = () => {
    setShowVotesAMount((prev) => prev + PAGE_SIZE);
  };

  if (isLoading) {
    return <LoadingContainer />;
  }

  return (
    <StyledContainer
      title={translations.recentVotes}
      headerComponent={<ContainerHeader />}
    >
      <List
        isLoading={isLoading}
        isEmpty={!isLoading && !_.size(data?.votes)}
        emptyComponent={<Empty />}
      >
        <StyledList gap={0}>
          <ConnectedWalletVote />
          {votes?.map((vote, index) => {
            if (
              index >= votesShowAmount ||
              normalizeTonAddress(vote.address) === connectedAddress
            )
              return null;
            return (
              <VoteComponent
                hideVotingPower={!!isOneWalletOneVote}
                symbol={symbol}
                data={vote}
                key={vote.address}
              />
            );
          })}
        </StyledList>
      </List>

      <StyledLoadMore
        totalItems={_.size(data?.votes)}
        amountToShow={votesShowAmount}
        showMore={showMoreVotes}
        limit={PAGE_SIZE}
      />
    </StyledContainer>
  );
}

const StyledLoadMore = styled(LoadMore)({
  marginTop: 20,
  width: "90%",
  marginLeft: "auto",
  marginRight: "auto",
  marginBottom: 20,
});

const Empty = () => {
  const translations = useProposalPageTranslations();
  return (
    <StyledNoVotes>
      <Typography>{translations.noVotes}</Typography>
    </StyledNoVotes>
  );
};

const DownloadCSV = () => {
  const { proposalAddress } = useAppParams();
  const { data } = useProposalQuery(proposalAddress);
  const csvData = useCsvData();
  const translations = useProposalPageTranslations();

  return (
    <CSVLink data={csvData} filename={parseLanguage(data?.metadata?.title)}>
      <AppTooltip text={translations.downloadCsv} placement="top">
        <StyledIcon style={{ width: 18, height: 18 }} />
      </AppTooltip>
    </CSVLink>
  );
};

const StyledIcon = styled(GrDocumentCsv)(({ theme }) => ({
  "*": {
    stroke: theme.palette.text.primary,
  },
}));

const VoteComponent = ({
  data,
  symbol,
  hideVotingPower,
  isCurrentUser,
}: {
  data?: Vote;
  symbol?: string;
  hideVotingPower: boolean;
  isCurrentUser?: boolean;
}) => {
  const translations = useProposalPageTranslations();
  if (!data) return null;
  const { address, votingPower, vote, hash, timestamp } = data;

  const displayAddress = toNoBounceAddress(address);

  return (
    <StyledAppTooltip
      text={`${moment.unix(timestamp).utc().fromNow()}`}
      placement="top"
    >
      <StyledVote justifyContent="flex-start">
        <StyledAddressWrapper>
          <StyledAddressDisplay
            address={address}
            displayText={displayAddress}
          />
          {isCurrentUser && (
            <StyledYouChip>{translations.you}</StyledYouChip>
          )}
        </StyledAddressWrapper>
        <Typography
          className="vote"
          style={{ textAlign: hideVotingPower ? "right" : "center" }}
        >
          {_.isArray(vote) ? vote.join(", ") : vote}
        </Typography>
        {!hideVotingPower && (
          <Typography className="voting-power">
            {nFormatter(Number(votingPower))} {symbol}
          </Typography>
        )}
      </StyledVote>
    </StyledAppTooltip>
  );
};

const StyledAppTooltip = styled(AppTooltip)({
  width: "100%",
});

const StyledAddressDisplay = styled(AddressDisplay)({
  justifyContent: "flex-start",
});

const StyledAddressWrapper = styled(StyledFlexRow)({
  width: 160,
  justifyContent: "flex-start",
  gap: 8,
});

const StyledYouChip = styled("span")(({ theme }) => ({
  flexShrink: 0,
  padding: "1px 8px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  color: theme.palette.mode === "light" ? "#fff" : "#fff",
  background: theme.palette.primary.main,
}));

const StyledNoVotes = styled(Box)({
  padding: "20px",
  p: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: 600,
  },
});

const StyledVote = styled(StyledFlexRow)({
  borderBottom: "0.5px solid rgba(114, 138, 150, 0.16)",
  padding: "15px 25px",
  gap: 10,
  ".vote": {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ".voting-power": {
    width: 160,
    textAlign: "right",
    gap: 5,
    whiteSpace: "nowrap",
    ".number-display": {
      flex: 1,
    },
  },

  "@media (max-width: 850px)": {
    alignItems: "flex-start",
    flexWrap: "wrap",

    ".address": {
      maxWidth: "60%",
    },
    ".date": {},
    ".vote": {
      flex: "unset",
      marginLeft: "auto",
      maxWidth: "40%",
      textAlign: "right",
    },
    ".voting-power": {
      width: "100%",
      textAlign: "left",
      justifyContent: "flex-start",
      ".number-display ": {
        flex: "unset",
        maxWidth: "70%",
      },
    },
  },
});

const StyledList = styled(StyledFlexColumn)({});

const StyledContainer = styled(TitleContainer)({
  ".title-container-children": {
    padding: 0,
  },
});

const StyledChip = styled(Chip)({
  height: 28,
  "*": {
    fontWeight: 600,
    fontSize: 13,
  },
});
