import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createDaoDevFee,
  createDaoProdFee,
  IS_DEV,
  QueryKeys,
  releaseMode,
  TELEGRAM_SUPPORT_GROUP,
  TX_FEES,
} from "config";
import _ from "lodash";
import {
  createNewDaoOnProdAndDev,
  daoSetOwner,
  daoSetProposalOwner,
  metdataExists,
  newDao,
  newMetdata,
  newProposal,
  ProposalMetadata,
  ReleaseMode,
  setMetadata,
  updateProposal,
} from "ton-vote-contracts-sdk";
import { storeVote } from "ton-vote-contracts-sdk/dist/contracts/output/ton-vote_Proposal";
import { Address, beginCell, Sender, toNano } from "ton-core";
import { getClientV2 } from "../tonRpc";
import {
  useAppParams,
  useGetProposalStatusCallback,
  useGetSender,
  useRole,
} from "hooks/hooks";
import { showSuccessToast, useErrorToast } from "toasts";
import {
  useDaoQuery,
  useDaosQuery,
  useDaoStateQuery,
  useProposalQuery,
  useRegistryStateQuery,
} from "./getters";
import {
  useNewDataStore,
  useSyncStore,
  useVotePersistedStore,
  useVoteStore,
} from "store";
import { getTxFee, getIsOneWalletOneVote, Logger, normalizeTonAddress, validateAddress } from "utils";
import { CreateDaoArgs, CreateMetadataArgs, UpdateMetadataArgs } from "./types";
import { useTonAddress } from "@tonconnect/ui-react";
import { Dao, Proposal, ProposalStatus, Vote } from "types";
import { useAppNavigation } from "router/navigation";
import { contract } from "contract";
import retry from "async-retry";

export const useCreateDaoQuery = () => {
  const getSender = useGetSender();
  const registryState = useRegistryStateQuery().data;
  const showErrorToast = useErrorToast();
  const appNavigation = useAppNavigation();
  const { addDao } = useNewDataStore();

  return useMutation(
    async (args: CreateDaoArgs) => {
      const sender = getSender();
      const clientV2 = await getClientV2();

      let getPromise = () => {
        if (args.dev && !IS_DEV) {
          const txFee = createDaoProdFee + createDaoDevFee;

          return createNewDaoOnProdAndDev(
            sender,
            clientV2,
            txFee.toString(),
            args.metadataAddress,
            args.ownerAddress,
            args.proposalOwner,
            createDaoProdFee.toString(),
            createDaoDevFee.toString(),
            ReleaseMode.PRODUCTION,
            ReleaseMode.DEVELOPMENT,
          );
        }
        return newDao(
          sender,
          clientV2,
          releaseMode,
          getTxFee(
            Number(registryState?.deployAndInitDaoFee),
            TX_FEES.CREATE_DAO,
          ),
          args.metadataAddress,
          args.ownerAddress,
          args.proposalOwner,
        );
      };

      const address = await getPromise();

      if (typeof address !== "string") {
        throw new Error(
          `Ошибка создания ДАО, напишите в [службу поддержки](${TELEGRAM_SUPPORT_GROUP})`,
        );
      }

      return address;
    },
    {
      onError: (error: Error, args) => {
        showErrorToast(error);
      },
      onSuccess: (address, args) => {
        appNavigation.daoPage.root(address);
        addDao(address);
        showSuccessToast(`Пространство успешно создано`);
        args.onSuccess();
      },
    },
  );
};

export const useCreateMetadataQuery = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();


  return useMutation(
    async (args: CreateMetadataArgs) => {
      const { metadata } = args;
      const sender = getSender();
      const clientV2 = await getClientV2();

      const address = await newMetdata(
        sender,
        clientV2,
        TX_FEES.CREATE_METADATA.toString(),
        metadata,
      );

      if (typeof address !== "string") {
        throw new Error(
          `Ошибка обновления метаданных. \n Напишите в [службу поддержки](${TELEGRAM_SUPPORT_GROUP})`,
        );
      }

      return address;
    },
    {
      onError: (error: Error, args) => {
        errorToast(error);
      },
      onSuccess: (address, args) => {
        args.onSuccess(address);
      },
    },
  );
};

interface CreateProposalArgs {
  metadata: Partial<ProposalMetadata>;
  onSuccess: (value: string) => void;
}

export const useCreateProposalQuery = () => {
  const { daoAddress } = useAppParams();

  const dao = useDaoQuery(daoAddress).data;
  const getSender = useGetSender();
  const daoState = useDaoStateQuery(dao?.daoAddress).data;
  const { isOwner, isProposalPublisher } = useRole(dao?.daoRoles);
  const showErrorToast = useErrorToast();


  return useMutation(
    async (args: CreateProposalArgs) => {
      const allowed = isOwner || isProposalPublisher;

      const { metadata } = args;
      const sender = getSender();
      if (!allowed) {
        throw new Error("Вы не можете создать предложение");
      }
      const address = await newProposal(
        sender,
        await getClientV2(),
        getTxFee(Number(daoState?.fwdMsgFee), TX_FEES.FORWARD_MSG),
        dao?.daoAddress!,
        metadata as ProposalMetadata,
      );

      if (typeof address !== "string") {
        throw new Error(
          `Ошибка при создании предложения. \n Напишите в [службу поддержки](${TELEGRAM_SUPPORT_GROUP})`,
        );
      }

      return address;
    },
    {
      onError: (error: Error, args) => {
        showErrorToast(error);
      },
      onSuccess: (address, args) => {
        showSuccessToast("Предложение успешно создано");
        args.onSuccess(address);
      },
    },
  );
};

export const useSetDaoOwnerQuery = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();
  const { setDaoUpdateMillis } = useSyncStore();
  const { daoAddress } = useAppParams();

  const refetch = useDaoQuery(daoAddress).refetch;

  return useMutation(
    async ({
      newOwner,
    }: {
      newOwner?: string;
      onError: (value: string) => void;
    }) => {
      if (!newOwner) {
        throw new Error("Требуется адрес основателя");
      }
      if (!validateAddress(newOwner)) {
        throw new Error("Неправильный адрес основателя");
      }
      const clientV2 = await getClientV2();
      await daoSetOwner(
        getSender(),
        clientV2,
        daoAddress,
        TX_FEES.BASE.toString(),
        newOwner,
      );
      setDaoUpdateMillis(daoAddress);
      return refetch();
    },
    {
      onError: (error, args) => {
        errorToast(error);
        args.onError("Ошибка при смене основателя");
      },
    },
  );
};

export const useSetDaoPublisherQuery = () => {
  const getSender = useGetSender();
  const { setDaoUpdateMillis } = useSyncStore();
  const { daoAddress } = useAppParams();
  const { refetch: refetchDao } = useDaoQuery(daoAddress);

  const errorToast = useErrorToast();

  return useMutation(
    async ({
      newOwner,
    }: {
      newOwner?: string;
      onError: (value: string) => void;
    }) => {
      if (!newOwner) {
        throw new Error("Требуется адрес владельца предложения");
      }
      if (!validateAddress(newOwner)) {
        throw new Error("Неправильный адрес основателя");
      }

      const clientV2 = await getClientV2();
      await daoSetProposalOwner(
        getSender(),
        clientV2,
        TX_FEES.BASE.toString(),
        daoAddress,
        newOwner,
      );
      setDaoUpdateMillis(daoAddress);
      return refetchDao();
    },
    {
      onError: (error: Error, args) => {
        args.onError(error.message);
        errorToast(error);
      },
    },
  );
};

export const useUpdateDaoMetadataQuery = () => {
  const getSender = useGetSender();
  const { setDaoUpdateMillis } = useSyncStore();
  const queryClient = useQueryClient();
  const refetchDaos = useDaosQuery().refetch;
  const { daoAddress } = useAppParams();

  const refetchUpdatedDao = useDaoQuery(daoAddress).refetch;

  const errorToast = useErrorToast();


  return useMutation(
    async (args: UpdateMetadataArgs) => {
      const { metadata, daoAddress } = args;

      const sender = getSender();
      const clientV2 = await getClientV2();

      const metadataAddress = await newMetdata(
        sender,
        clientV2,
        TX_FEES.CREATE_METADATA.toString(),
        metadata,
      );

      if (typeof metadataAddress !== "string") {
        throw new Error("Не удалось обновить метаданные");
      }

      const address = await setMetadata(
        sender,
        clientV2,
        TX_FEES.SET_METADATA.toString(),
        daoAddress,
        metadataAddress,
      );

      if (typeof address !== "string") {
        throw new Error("Ошибка обновления метаданных");
      }
      return address;
    },
    {
      onError: (error: Error, args) => {
        errorToast(error);
      },
      onSuccess: (_, args) => {
        showSuccessToast("Метаданные обновлены");
        // сразу подставляем новые метаданные (название, описание и т.п.)
        // в кэш, не дожидаясь повторного запроса к API — индексёр может ещё
        // отдавать старые данные, а повторный запрос уже пойдёт на цепочку
        // (см. metadataLastUpdate в useDaoQuery)
        queryClient.setQueryData<Dao | null>(
          [QueryKeys.DAO, args.daoAddress],
          (currentDao) => {
            if (!currentDao) return currentDao;
            return {
              ...currentDao,
              daoMetadata: {
                ...currentDao.daoMetadata,
                metadataArgs: args.metadata,
              },
            };
          }
        );
        setDaoUpdateMillis(args.daoAddress);
        refetchDaos();
        refetchUpdatedDao();
      },
    },
  );
};

const sendVoteMessage = async (
  sender: Sender,
  proposalAddress: string,
  vote: string,
) => {
  if (!sender.address) {
    throw new Error("Not connected");
  }

  const body = beginCell()
    .store(storeVote({ $$type: "Vote", comment: vote }))
    .endCell();

  await sender.send({
    to: Address.parse(proposalAddress),
    value: toNano(TX_FEES.VOTE_FEE.toString()),
    body,
  });
};

export const useVote = () => {
  const getSender = useGetSender();
  const { proposalAddress } = useAppParams();
  const store = useVotePersistedStore();
  const { data: proposal } = useProposalQuery(proposalAddress);
  const queryClient = useQueryClient();
  const successCallback = useVoteSuccessCallback(proposalAddress);
  const walletAddress = useTonAddress();

  const errorToast = useErrorToast();
  const { setIsVoting } = useVoteStore();


  return useMutation(
    async (vote: string) => {
      if (!proposal) {
        throw new Error("Предложение не найдено");
      }
      setIsVoting(true);
      const sender = getSender();

      // Отправка голоса не должна зависеть от RPC-клиента: тело сообщения Vote
      // собирается локально, а сама транзакция уходит через TonConnect (кошелёк
      // сам взаимодействует с цепочкой). Раньше здесь вызывалась
      // proposalSendMessage из SDK, которая перед отправкой делала get-method'ы
      // через orbs-дискавери — при недоступности/429 orbs голосование молча
      // «зависало» либо падало с ошибкой про fetch(mngr/nodes).
      //
      // Мутация завершается сразу после отправки транзакции — уведомление
      // «Ваш голос принят» показывается незамедлительно, а пересчёт результатов
      // и обновление кэша выполняются в фоне (onSuccess), не блокируя UI.
      await sendVoteMessage(sender, proposalAddress!, vote);
      return vote;
    },
    {
      onSuccess: async (vote) => {
        if (!proposal) return;

        // Мгновенно добавляем новый голос в «Последние голоса» (и показываем его
        // в шапке для подключённого кошелька), не дожидаясь пересчёта результатов
        // по цепочке — он может идти долго или упасть из-за RPC, из-за чего голос
        // долго «не отображался», хотя уже виден в контракте.
        const isOneWalletOneVote = getIsOneWalletOneVote(
          proposal.metadata?.votingPowerStrategies,
        );
        if (walletAddress) {
          const optimisticVote: Vote = {
            address: walletAddress,
            vote,
            votingPower: isOneWalletOneVote ? "1" : "0",
            timestamp: Math.floor(Date.now() / 1000),
            hash: "",
          };
          queryClient.setQueryData(
            [QueryKeys.PROPOSAL, proposalAddress],
            (prev?: Proposal | null) => {
              if (!prev) return prev;
              const votes = _.filter(
                prev.votes || [],
                (v) =>
                  normalizeTonAddress(v.address) !==
                  normalizeTonAddress(walletAddress),
              );
              return {
                ...prev,
                votes: _.orderBy(
                  [optimisticVote, ...votes],
                  "timestamp",
                  "desc",
                ),
              };
            },
          );
        }

        try {
          const values = await successCallback(proposal);
          if (!values) return;

          const { proposalResults, vote: walletVote, maxLt } = values;

          queryClient.setQueryData(
            [QueryKeys.PROPOSAL, proposalAddress],
            (prev?: any) => {
              const votes = _.filter(
                prev?.votes,
                (v) => v.address !== walletVote.address,
              );
              return {
                ...prev,
                proposalResult: proposalResults,
                votes: [walletVote, ...votes],
              };
            },
          );

          Logger(
            `успешное голосование вручную обновляет запрос предложения и настраивает локальное хранилище`,
          );
          Logger(maxLt, "maxLt");
          Logger(walletVote, "walletVote");
          Logger(proposalResults, "results");
          // we save this data in local storage, and display it untill the server is up to date
          store.setValues(proposalAddress, maxLt, walletVote, proposalResults);
        } catch (error) {
          Logger("Failed to update proposal results after vote:", error);
          errorToast(
            `Вы успешно проголосовали за ${vote}, но нам не удалось обновить результаты, напишите в [службу поддержки](${TELEGRAM_SUPPORT_GROUP})`,
            12_000,
          );
        }
      },
      onSettled: () => {
        setIsVoting(false);
      },
      onError: (error: Error, vote: string) => {
        errorToast(error, 8_000);
      },
    },
  );
};

export const useUpdateProposalMutation = () => {
  const getSender = useGetSender();
  const errorToast = useErrorToast();
  const { setProposalUpdateMillis } = useSyncStore();
  const { proposalAddress, daoAddress } = useAppParams();

  const getProposalStatus = useGetProposalStatusCallback();

  const { refetch } = useProposalQuery(proposalAddress!);
  const { proposalPage } = useAppNavigation();

  return useMutation(
    async (metadata: ProposalMetadata) => {
      const proposalQuery = await refetch();
      const { proposalStatus } = getProposalStatus(
        proposalQuery.data?.metadata!,
      );

      if (proposalStatus !== ProposalStatus.NOT_STARTED) {
        throw new Error(
          "Proposal is already started, you cant edit it anymore",
        );
      }

      const sender = getSender();
      const client = await getClientV2();
      const resolvedDaoAddress = daoAddress || proposalQuery.data?.daoAddress;
      if (!resolvedDaoAddress) {
        throw new Error("DAO address is missing");
      }

      await updateProposal(
        sender,
        client,
        TX_FEES.FORWARD_MSG.toString(),
        resolvedDaoAddress,
        proposalAddress!,
        metadata,
      );
    },
    {
      onSuccess: () => {
        showSuccessToast("Предложение обновлено");
        setProposalUpdateMillis(proposalAddress!);
        proposalPage.root(proposalAddress!);
      },
      onError: (error: Error) => {
        errorToast(error);
      },
    },
  );
};

export const useVoteSuccessCallback = (proposalAddress: string) => {
  const walletAddress = useTonAddress();


  return async (proposal: Proposal) => {
    const promise = async (bail: any, attempt: number) => {
      Logger(`getting proposal results after vote, attempt ${attempt} `);
      if (!proposal.metadata || !walletAddress) return;

      try {
        const result = await contract.getProposalResultsAfterVote({
          proposalAddress,
          walletAddress,
          proposal,
        });

        if (!result || _.isEmpty(result)) {
          throw new Error("Empty results");
        }

        return result;
      } catch (error) {
        if (attempt > 5) {
          const message = error instanceof Error ? error.message : "";
        }
        Logger(error);
        throw error;
      }
    };

    return retry(promise, { retries: 5, minTimeout: 2000 });
  };
};
