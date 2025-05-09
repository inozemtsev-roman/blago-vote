import { Box, styled } from "@mui/material";
import { Status, AppTooltip, HiddenProposal } from "components";
import {
  useAppParams,
  useAppQueryParams,
  useProposalStatus,
  useRole,
} from "hooks/hooks";
import _ from "lodash";
import { useAppNavigation } from "router/navigation";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { Proposal as ProposalType, ProposalStatus } from "types";
import { parseLanguage } from "utils";
import { ProposalLoader } from "../../ProposalLoader";
import removeMd from "remove-markdown";

import {
  StyledAddressDisplay,
  StyledMarkdown,
  StyledProposal,
  StyledProposalTitle,
} from "../styles";
import { useDaoQuery, useProposalQuery } from "query/getters";
import { mock } from "mock/mock";
import { useMemo } from "react";
import { useIntersectionObserver } from "react-intersection-observer-hook";
import { ProposalTimeline } from "./ProposalTimeline";
import { Results } from "./Results";

const useHideProposal = (proposalAddress: string) => {
  const { query } = useAppQueryParams();

  const { data: proposal, isLoading: isProposalLoading } = useProposalQuery(proposalAddress);
  const { data: dao, isLoading: isDaoLoading } = useDaoQuery(proposal?.daoAddress || "");

  const { proposalStatus } = useProposalStatus(proposalAddress);
  const title = proposal?.metadata?.title?.toLowerCase();
  const description = proposal?.metadata?.description.toLowerCase();

  // Если данные еще загружаются, не скрываем предложение
  if (isProposalLoading || isDaoLoading || !proposal || !dao) {
    return false;
  }

  const { isProposalPublisher, isOwner } = useRole(dao.daoRoles);

  console.log("Checking if proposal should be hidden:", {
    proposalAddress,
    proposalStatus,
    queryState: query.proposalState,
    querySearch: query.search,
    isHidden: proposal?.metadata?.hide,
    isProposalPublisher,
    isOwner,
    isProposalLoading,
    isDaoLoading
  });

  const filters = useMemo(
    () => [title, description, proposalAddress],
    [title, description, proposalAddress]
  );

  if (query.proposalState && query.proposalState !== proposalStatus) {
    console.log("Proposal hidden due to state filter");
    return true;
  }

  if (
    query.search &&
    !filters.some((it) => {
      return it?.toLowerCase().includes(query.search!.toLowerCase());
    })
  ) {
    console.log("Proposal hidden due to search filter");
    return true;
  }

  if (!proposal?.metadata?.hide) {
    console.log("Proposal is not marked as hidden");
    return false;
  }
  
  if (!isProposalPublisher && !isOwner) {
    console.log("Proposal hidden due to user roles");
    return true;
  }

  console.log("Proposal should be visible");
  return false;
};

export const Proposal = ({ proposalAddress }: { proposalAddress: string }) => {
  const { proposalPage } = useAppNavigation();
  const { daoAddress } = useAppParams();
  const [ref, { entry }] = useIntersectionObserver();
  const isVisible = entry && entry.isIntersecting;

  const proposalQuery = useProposalQuery(proposalAddress, {
    disabled: !isVisible,
  });

  const { data: proposal, isLoading: isProposalLoading, error } = proposalQuery;
  const { data: dao, isLoading: isDaoLoading } = useDaoQuery(proposal?.daoAddress || "");

  // Если данные загружаются или есть ошибка, показываем загрузчик
  if (isProposalLoading || isDaoLoading) {
    return <ProposalLoader />;
  }

  if (error || !proposal || !dao) {
    return null;
  }

  const { proposalStatus, proposalStatusText } = useProposalStatus(proposalAddress);
  const hideProposal = useHideProposal(proposalAddress);
  
  const description = useMemo(
    () => parseLanguage(proposal?.metadata?.description, "en"),
    [proposal?.metadata?.description]
  );
  const title = useMemo(
    () => parseLanguage(proposal?.metadata?.title),
    [proposal?.metadata?.title]
  );

  const onClick = () => {
    if (daoAddress && proposalAddress) {
      proposalPage.root(daoAddress, proposalAddress);
    }
  };

  if (hideProposal) {
    return null;
  }

  return (
    <div onClick={onClick} ref={ref} style={{ width: "100%" }}>
      <StyledProposal>
        <StyledFlexColumn alignItems="flex-start" gap={20}>
          <StyledFlexRow justifyContent="space-between">
            <AppTooltip text="Proposal address" placement="right">
              <StyledProposalAddress address={proposalAddress} padding={10} />
            </AppTooltip>
            <StyledFlexRow style={{ width: "auto" }} gap={15}>
              <HiddenProposal proposal={proposal} />
              <Status status={proposalStatusText} />
            </StyledFlexRow>
          </StyledFlexRow>

          <StyledFlexColumn alignItems="flex-start">
            <StyledProposalTitle variant="h4">
              {title}
              {mock.isMockProposal(proposalAddress) && (
                <small style={{ opacity: 0.5 }}> (Mock)</small>
              )}
            </StyledProposalTitle>
            <StyledMarkdown
              sx={{
                display: "-webkit-box",
                overflow: "hidden",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                wordBreak: "break-word",
              }}
            >
              {removeMd(description || "", {
                useImgAltText: true,
              })}
            </StyledMarkdown>
          </StyledFlexColumn>

          {proposalStatus === ProposalStatus.CLOSED && proposal && (
            <Results proposalAddress={proposalAddress} />
          )}
          <ProposalTimeline
            proposalMetadata={proposal?.metadata}
            status={proposalStatus}
          />
        </StyledFlexColumn>
      </StyledProposal>
    </div>
  );
};

const StyledProposalAddress = styled(StyledAddressDisplay)({
  opacity: 0.7,
  p: {
    fontSize: 14,
  },
});
