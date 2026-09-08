import { Address } from "@ton/core";
import { useMultisigInfo } from "multisig/useMultisigInfo";
import { useMyAddress } from "multisig/useMyAddress";
import { useTonAddress } from "@tonconnect/ui-react";
import { areTonAddressesEqual } from "utils";
import { verifyDaoWithChain } from "query/hooks";
import { useEffect, useState } from "react";
import { Dao } from "types";

/**
 * Проверяет, является ли текущий кошелёк подписантом (или инициатором)
 * мультикошелька, который является издателем предложений (proposalOwner) ДАО.
 * В этом случае создание предложений идёт через заявки мультикошелька.
 *
 * Издатель сверяется с цепочкой: api.ton.vote может отдавать устаревшие роли
 * (например, proposalOwner, продублированный из owner), поэтому
 * `daoRoles.proposalOwner` используется только пока цепочка ещё не ответила.
 */
export const usePublisherMultisigSigner = (dao?: Dao | null) => {
  const walletAddress = useTonAddress();
  const myAddress = useMyAddress();
  const daoAddress = dao?.daoAddress;
  const roleProposalOwner = dao?.daoRoles?.proposalOwner;

  const [chainProposalOwner, setChainProposalOwner] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    let alive = true;
    setChainProposalOwner(undefined);
    if (!walletAddress || !daoAddress) return;
    verifyDaoWithChain(daoAddress)
      .then((verification) => {
        if (alive) setChainProposalOwner(verification.chainProposalOwner);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [daoAddress, walletAddress]);

  const proposalOwner = chainProposalOwner || roleProposalOwner;

  const isSelfPublisher =
    !!proposalOwner &&
    !!walletAddress &&
    areTonAddressesEqual(proposalOwner, walletAddress);

  const { info, loading, error } = useMultisigInfo(
    proposalOwner && walletAddress && !isSelfPublisher
      ? proposalOwner
      : undefined,
  );

  const isSigner =
    !isSelfPublisher &&
    !!info &&
    !!myAddress &&
    (info.signers.some((s: { address: Address }) =>
      s.address.equals(myAddress!),
    ) ||
      info.proposers.some((s: { address: Address }) =>
        s.address.equals(myAddress!),
      ));

  return {
    isSigner,
    multisigAddress: isSigner ? proposalOwner : undefined,
    loading,
    error,
  };
};