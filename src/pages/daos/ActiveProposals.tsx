import { useQueries } from "@tanstack/react-query";
import { Box, styled, Typography } from "@mui/material";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";
import { IoTriangle } from "react-icons/io5";
import { QueryKeys } from "config";
import _ from "lodash";
import moment from "moment";
import { useMemo, useState } from "react";
import { api } from "api";
import { useAppNavigation } from "router/navigation";
import { StyledFlexColumn, StyledFlexRow, StyledSkeletonLoader } from "styles";
import { parseLanguage } from "utils";
import { FEATURED_DAOS } from "whitelisted";
import { useDaosQuery } from "query/getters";
import { MOBILE_WIDTH } from "consts";

interface ActiveProposal {
  proposalAddress: string;
  daoName: string;
  endTime: number;
  startTime: number;
  votesCount: number;
  title: string;
  description: string;
  leadingChoice: string;
  totalChoices: string[];
}

interface ActiveProposal {
  proposalAddress: string;
  daoName: string;
  endTime: number;
  startTime: number;
  votesCount: number;
  title: string;
}

const ActiveProposalsLoader = () => {
  return (
    <StyledSection>
      <StyledFlexColumn gap={0} alignItems="flex-start" style={{ width: "100%" }}>
        <StyledSkeletonLoader style={{ width: 200, height: 24, marginBottom: 16 }} />
        {_.range(0, 3).map((_, i) => (
          <StyledTableRow key={i}>
            <StyledSkeletonLoader style={{ width: "100%", height: 40 }} />
          </StyledTableRow>
        ))}
      </StyledFlexColumn>
    </StyledSection>
  );
};

const SortIcon = ({ direction }: { direction: "asc" | "desc" }) => {
  return direction === "asc" ? (
    <IoArrowUp size={14} style={{ marginLeft: 4 }} />
  ) : (
    <IoArrowDown size={14} style={{ marginLeft: 4 }} />
  );
};

const ActiveProposalRow = ({
  proposalAddress,
  daoName,
  endTime,
  votesCount,
  title,
  description,
  leadingChoice,
  totalChoices,
}: Omit<ActiveProposal, "startTime">) => {
  const { proposalPage } = useAppNavigation();

  const isPositive = totalChoices.length > 0 && leadingChoice === totalChoices[0];

  const onClick = () => {
    proposalPage.root(proposalAddress);
  };

  const formattedEndDate = moment.unix(endTime).format("DD.MM.YYYY");
  const shortDescription = description
    ? description.substring(0, 80) + (description.length > 80 ? "..." : "")
    : "";

  return (
    <StyledTableRow onClick={onClick}>
      <StyledTableCell style={{ flex: 3 }}>
        <StyledFlexColumn alignItems="flex-start" gap={2}>
          <StyledProposalTitle>{title}</StyledProposalTitle>
          {shortDescription && (
            <StyledProposalDescription>{shortDescription}</StyledProposalDescription>
          )}
          <StyledDaoName>{daoName}</StyledDaoName>
        </StyledFlexColumn>
      </StyledTableCell>
      <StyledTableCellCenter style={{ flex: 1.5 }}>
        <StyledEndDate>{formattedEndDate}</StyledEndDate>
      </StyledTableCellCenter>
      <StyledTableCellCenter style={{ flex: 1 }}>
        <StyledFlexColumn alignItems="center" gap={2}>
          <IoTriangle
            size={12}
            color={isPositive ? "#4caf50" : "#f44336"}
          />
          <StyledVotesCount>{votesCount}</StyledVotesCount>
        </StyledFlexColumn>
      </StyledTableCellCenter>
    </StyledTableRow>
  );
};

export const ActiveProposals = () => {
  const { data: allDaos = [], isLoading: daosLoading } = useDaosQuery();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const featuredProposalAddresses = useMemo(() => {
    const addresses: { proposalAddress: string; daoAddress: string }[] = [];
    FEATURED_DAOS.forEach((daoAddress: string) => {
      const dao = allDaos.find((d: any) => d.daoAddress === daoAddress);
      if (dao?.daoProposals) {
        dao.daoProposals.forEach((pa: string) => {
          addresses.push({ proposalAddress: pa, daoAddress });
        });
      }
    });
    return addresses;
  }, [allDaos]);

  const proposalQueries = useQueries({
    queries: featuredProposalAddresses.map(({ proposalAddress }: { proposalAddress: string }) => ({
      queryKey: [QueryKeys.PROPOSAL, proposalAddress, "active-check"],
      queryFn: async () => {
        return (await api.getProposal(proposalAddress)) || null;
      },
      enabled: !!proposalAddress,
      staleTime: 30_000,
      retry: false,
    })),
  });

  const activeProposals = useMemo(() => {
    const now = Date.now();
    const proposals: ActiveProposal[] = featuredProposalAddresses
      .filter(({ proposalAddress }: { proposalAddress: string }, index: number) => {
        const query = proposalQueries[index];
        if (!query?.data) return false;
        const metadata = (query.data as any)?.metadata;
        if (!metadata) return false;
        const startTime = Number(metadata.proposalStartTime) * 1000;
        const endTime = Number(metadata.proposalEndTime) * 1000;
        return startTime <= now && endTime > now;
      })
      .map(({ proposalAddress, daoAddress }: { proposalAddress: string; daoAddress: string }) => {
        const idx = featuredProposalAddresses.findIndex(
          (a: { proposalAddress: string }) => a.proposalAddress === proposalAddress
        );
        const proposalData = proposalQueries[idx]?.data as any;
        const metadata = proposalData?.metadata;
        const endTime = Number(metadata?.proposalEndTime) || 0;
        const startTime = Number(metadata?.proposalStartTime) || 0;
        const votesCount = _.size(proposalData?.votes) || 0;
        const choices = metadata?.votingSystem?.choices || [];
        const votesByChoice: Record<string, number> = {};
        _.forEach(proposalData?.votes || [], (currentVote: any) => {
          const rawVotes = _.isArray(currentVote.vote) ? currentVote.vote : [currentVote.vote];
          _.forEach(rawVotes, (rawVoteValue: any) => {
            const value = String(rawVoteValue ?? "").trim();
            if (!value) return;
            const numIdx = Number(value);
            if (!Number.isNaN(numIdx)) {
              const choice = choices[numIdx] || choices[numIdx - 1];
              if (choice) { votesByChoice[choice] = (votesByChoice[choice] || 0) + 1; return; }
            }
            const matched = _.find(choices, (c: string) => c.toLowerCase() === value.toLowerCase());
            if (matched) { votesByChoice[matched] = (votesByChoice[matched] || 0) + 1; }
          });
        });
        const leadingChoice = _.maxBy(_.entries(votesByChoice), ([, v]) => v)?.[0] || "";
        const dao = allDaos.find((d: any) => d.daoAddress === daoAddress);
        const daoName = parseLanguage(dao?.daoMetadata?.metadataArgs?.name);
        const title = parseLanguage(metadata?.title);
        const description = parseLanguage(metadata?.description, "en")
          .split("\n")
          .filter((line: string) => !line.match(/^\*?\*?Место проведения:\*?\*?/))
          .join("\n");
        return { proposalAddress, daoName, endTime, startTime, votesCount, title, description, leadingChoice, totalChoices: choices };
      });
    return _.orderBy(proposals, "endTime", sortDirection);
  }, [featuredProposalAddresses, proposalQueries, allDaos, sortDirection]);

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  if (daosLoading) {
    return <ActiveProposalsLoader />;
  }

  if (!activeProposals.length) {
    return null;
  }

  return (
    <StyledSection>
      <StyledFlexColumn gap={0} alignItems="flex-start" style={{ width: "100%" }}>
        <StyledActiveProposalsTitle>Активные предложения</StyledActiveProposalsTitle>
        <StyledTableHeader>
          <StyledHeaderCell style={{ flex: 3 }}>Предложение</StyledHeaderCell>
          <StyledHeaderCellCenter style={{ flex: 1.5 }} onClick={toggleSort} clickable>
            Дата окончания <SortIcon direction={sortDirection} />
          </StyledHeaderCellCenter>
          <StyledHeaderCellRight style={{ flex: 1 }}>Голоса</StyledHeaderCellRight>
        </StyledTableHeader>
        {activeProposals.map((proposal: ActiveProposal) => (
          <ActiveProposalRow
            key={proposal.proposalAddress}
            proposalAddress={proposal.proposalAddress}
            daoName={proposal.daoName}
            endTime={proposal.endTime}
            votesCount={proposal.votesCount}
            title={proposal.title}
            description={proposal.description}
            leadingChoice={proposal.leadingChoice}
            totalChoices={proposal.totalChoices}
          />
        ))}
      </StyledFlexColumn>
    </StyledSection>
  );
};

const StyledSection = styled(Box)({
  width: "100%",
});

const StyledActiveProposalsTitle = styled(Typography)(({ theme }) => ({
  fontSize: 20,
  fontWeight: 800,
  color: theme.typography.h2.color,
  marginBottom: 12,
}));

const StyledTableHeader = styled(StyledFlexRow)(({ theme }) => ({
  width: "100%",
  padding: "10px 16px",
  borderBottom: `2px solid ${theme.palette.divider}`,
  alignItems: "center",
}));

const StyledHeaderCell = styled(Typography)({
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  opacity: 0.5,
});

const StyledHeaderCellCenter = styled(StyledHeaderCell)<{ clickable?: boolean }>(
  ({ clickable, theme }) => ({
    textAlign: "center",
    cursor: clickable ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: clickable ? "none" : "auto",
    "&:hover": clickable
      ? { color: theme.palette.primary.main }
      : {},
  })
);

const StyledHeaderCellRight = styled(StyledHeaderCell)({
  textAlign: "center",
});

const StyledTableRow = styled(StyledFlexRow)(({ theme }) => ({
  width: "100%",
  padding: "14px 16px",
  cursor: "pointer",
  alignItems: "center",
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: "background 0.15s",
  "&:hover": {
    background:
      theme.palette.mode === "light"
        ? "rgba(0, 136, 204, 0.04)"
        : "rgba(255, 255, 255, 0.04)",
  },
}));

const StyledTableCell = styled(Box)({
  display: "flex",
  alignItems: "center",
});

const StyledTableCellCenter = styled(Box)({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100%",
});

const StyledTableCellRight = styled(Box)({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
});

const StyledProposalTitle = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 700,
  color: theme.typography.h2.color,
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    fontSize: 14,
  },
}));

const StyledDaoName = styled(Typography)({
  fontSize: 12,
  fontWeight: 600,
  opacity: 0.5,
});

const StyledProposalDescription = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  fontWeight: 500,
  opacity: 0.5,
  lineHeight: "18px",
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    fontSize: 12,
  },
}));

const StyledEndDate = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  fontWeight: 600,
  color: theme.palette.primary.main,
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    fontSize: 13,
  },
}));

const StyledVotesCount = styled(Typography)(({ theme }) => ({
  fontSize: 18,
  fontWeight: 800,
  textAlign: "center",
  width: "100%",
  color: theme.typography.h2.color,
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    fontSize: 16,
  },
}));
