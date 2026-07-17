import { useQueries } from "@tanstack/react-query";
import { styled, Typography } from "@mui/material";
import { Status } from "components";
import { QueryKeys } from "config";
import _ from "lodash";
import moment from "moment";
import { useMemo } from "react";
import { useIntersectionObserver } from "react-intersection-observer-hook";
import { api } from "api";
import { useAppNavigation } from "router/navigation";
import { StyledFlexColumn, StyledFlexRow, StyledSkeletonLoader } from "styles";
import { parseLanguage } from "utils";
import { FEATURED_DAOS } from "whitelisted";
import removeMd from "remove-markdown";
import { useDaosQuery, useProposalQuery } from "query/getters";
import { useProposalStatus } from "hooks/hooks";
import {
  StyledActiveProposalsSection,
  StyledActiveProposalCard,
  StyledActiveProposalTitle,
  StyledActiveProposalDescription,
  StyledActiveProposalDaoName,
  StyledActiveProposalEndDate,
} from "./styles";

const ActiveProposalsLoader = () => {
  return (
    <StyledActiveProposalsSection>
      <StyledFlexColumn gap={12} alignItems="flex-start" style={{ width: "100%" }}>
        <StyledSkeletonLoader style={{ width: 200, height: 24 }} />
        {_.range(0, 2).map((_, i) => (
          <StyledActiveProposalCard key={i}>
            <StyledFlexColumn gap={8} alignItems="flex-start">
              <StyledSkeletonLoader style={{ width: "60%", height: 20 }} />
              <StyledSkeletonLoader style={{ width: "90%", height: 16 }} />
            </StyledFlexColumn>
          </StyledActiveProposalCard>
        ))}
      </StyledFlexColumn>
    </StyledActiveProposalsSection>
  );
};

const ActiveProposalCard = ({
  proposalAddress,
  daoName,
  endTime,
}: {
  proposalAddress: string;
  daoName: string;
  endTime: number;
}) => {
  const [ref, { entry }] = useIntersectionObserver();
  const isVisible = entry && entry.isIntersecting;
  const { proposalPage } = useAppNavigation();

  const { data: proposal, isLoading } = useProposalQuery(proposalAddress, {
    disabled: !isVisible,
  });
  const { proposalStatusText } = useProposalStatus(proposalAddress);

  const title = useMemo(
    () => parseLanguage(proposal?.metadata?.title),
    [proposal?.metadata?.title]
  );
  const description = useMemo(
    () =>
      parseLanguage(proposal?.metadata?.description, "en")
        .split("\n")
        .filter((line: string) => !line.match(/^\*?\*?Место проведения:\*?\*?/))
        .join("\n"),
    [proposal?.metadata?.description]
  );

  const onClick = () => {
    proposalPage.root(proposalAddress);
  };

  const formattedEndDate = moment.unix(endTime).format("DD.MM.YYYY HH:mm");

  return (
    <div ref={ref} onClick={onClick} style={{ width: "100%", cursor: "pointer" }}>
      {isLoading ? (
        <StyledActiveProposalCard>
          <StyledFlexColumn gap={8} alignItems="flex-start">
            <StyledSkeletonLoader style={{ width: "60%", height: 20 }} />
            <StyledSkeletonLoader style={{ width: "90%", height: 16 }} />
          </StyledFlexColumn>
        </StyledActiveProposalCard>
      ) : (
        <StyledActiveProposalCard>
          <StyledFlexColumn gap={6} alignItems="flex-start">
            <StyledFlexRow justifyContent="space-between" style={{ width: "100%" }}>
              <StyledActiveProposalDaoName>{daoName}</StyledActiveProposalDaoName>
              <Status status={proposalStatusText} />
            </StyledFlexRow>
            <StyledActiveProposalTitle>{title}</StyledActiveProposalTitle>
            <StyledActiveProposalEndDate>
              Окончание: {formattedEndDate}
            </StyledActiveProposalEndDate>
            <StyledActiveProposalDescription>
              {removeMd(description || "", { useImgAltText: true })}
            </StyledActiveProposalDescription>
          </StyledFlexColumn>
        </StyledActiveProposalCard>
      )}
    </div>
  );
};

export const ActiveProposals = () => {
  const { data: allDaos = [], isLoading: daosLoading } = useDaosQuery();

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
    const proposals = featuredProposalAddresses
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
        const query = featuredProposalAddresses.findIndex(
          (a: { proposalAddress: string }) => a.proposalAddress === proposalAddress
        );
        const metadata = (proposalQueries[query]?.data as any)?.metadata;
        const endTime = Number(metadata?.proposalEndTime) || 0;
        const dao = allDaos.find((d: any) => d.daoAddress === daoAddress);
        const daoName = parseLanguage(dao?.daoMetadata?.metadataArgs?.name);
        return { proposalAddress, daoName, endTime };
      });
    return _.orderBy(proposals, "endTime", "asc");
  }, [featuredProposalAddresses, proposalQueries, allDaos]);

  if (daosLoading) {
    return <ActiveProposalsLoader />;
  }

  if (!activeProposals.length) {
    return null;
  }

  return (
    <StyledActiveProposalsSection>
      <StyledFlexColumn gap={12} alignItems="flex-start" style={{ width: "100%" }}>
        <StyledActiveProposalsTitle>Активные предложения</StyledActiveProposalsTitle>
        {activeProposals.map(({ proposalAddress, daoName, endTime }: { proposalAddress: string; daoName: string; endTime: number }) => (
          <ActiveProposalCard
            key={proposalAddress}
            proposalAddress={proposalAddress}
            daoName={daoName}
            endTime={endTime}
          />
        ))}
      </StyledFlexColumn>
    </StyledActiveProposalsSection>
  );
};

const StyledActiveProposalsTitle = styled(Typography)(({ theme }) => ({
  fontSize: 20,
  fontWeight: 800,
  color: theme.typography.h2.color,
  marginBottom: 4,
}));
