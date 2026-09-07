import { Address } from "@ton/core";
import { useMultisigInfo } from "multisig/useMultisigInfo";
import { useMyAddress } from "multisig/useMyAddress";
import { useTonAddress } from "@tonconnect/ui-react";
import { areTonAddressesEqual } from "utils";

/**
 * Проверяет, является ли текущий кошелёк подписантом (или инициатором)
 * мультикошелька, который является издателем предложений (proposalOwner) ДАО.
 * В этом случае создание предложений идёт через заявки мультикошелька.
 */
export const usePublisherMultisigSigner = (proposalOwner?: string) => {
  const walletAddress = useTonAddress();
  const myAddress = useMyAddress();

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