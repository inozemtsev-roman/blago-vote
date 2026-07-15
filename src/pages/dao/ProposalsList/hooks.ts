import { useQueries } from "@tanstack/react-query";
import { api } from "api";
import { QueryKeys } from "config";
import _ from "lodash";
import { mock } from "mock/mock";
import { useMemo } from "react";
import { Proposal } from "types";

type ProposalByAddress = Record<string, Proposal | null | undefined>;

export const getProposalStartTime = (proposal?: Proposal | null) => {
  const value = Number(proposal?.metadata?.proposalStartTime);
  return Number.isFinite(value) ? value : 0;
};

export const sortProposalAddressesByStartTime = (
  proposalAddresses: string[] = [],
  proposalsByAddress: ProposalByAddress = {}
) => {
  return _.orderBy(
    proposalAddresses,
    (proposalAddress) =>
      getProposalStartTime(proposalsByAddress[proposalAddress]),
    "desc"
  );
};

export const useSortedProposalAddresses = (proposalAddresses?: string[]) => {
  const addresses = proposalAddresses || [];

  const proposalQueries = useQueries({
    queries: addresses.map((proposalAddress) => ({
      queryKey: [QueryKeys.PROPOSAL, proposalAddress, "start-time"],
      queryFn: async () => {
        const mockProposal = mock.getMockProposal(proposalAddress);
        if (mockProposal) {
          return mockProposal;
        }

        return (await api.getProposal(proposalAddress)) || null;
      },
      enabled: !!proposalAddress,
      staleTime: 30_000,
      retry: false,
    })),
  });

  return useMemo(() => {
    const proposalsByAddress = _.reduce(
      proposalQueries,
      (acc, query, index) => {
        const proposalAddress = addresses[index];
        if (!proposalAddress) {
          return acc;
        }
        acc[proposalAddress] = query.data as Proposal | null | undefined;
        return acc;
      },
      {} as ProposalByAddress
    );

    return sortProposalAddressesByStartTime(addresses, proposalsByAddress);
  }, [addresses, proposalQueries]);
};
