import { api } from "api";
import { contract } from "contract";
import _ from "lodash";
import { useNewDataStore, useSyncStore } from "store";
import {
  getDaoMetadata,
  getDaoState,
} from "ton-vote-contracts-sdk";
import { getClientV2 } from "../tonRpc";
import { Address } from "ton-core";
import { TonClient } from "ton";
import { Dao } from "types";
import {
  Logger,
  validateServerUpdateTime,
} from "utils";

const toCanonicalAddress = (address?: string) => {
  if (!address) return "";
  try {
    return Address.parse(address).toString({
      urlSafe: true,
      bounceable: false,
    });
  } catch {
    return address || "";
  }
};

export const compareDaoWithChain = async (
  daoAddress: string,
  serverDao?: Pick<Dao, "daoRoles" | "daoMetadata"> | null,
  client?: TonClient
) => {
  const connection = client || (await getClientV2());

  const daoState = await getDaoState(connection, daoAddress);

  const chainMetadataAddress = toCanonicalAddress(daoState.metadata);
  const chainOwner = toCanonicalAddress(daoState.owner);
  const chainProposalOwner = toCanonicalAddress(daoState.proposalOwner);

  const metadataIsUpToDate =
    chainMetadataAddress ===
    toCanonicalAddress(serverDao?.daoMetadata?.metadataAddress);
  const ownerIsUpToDate =
    chainOwner === toCanonicalAddress(serverDao?.daoRoles?.owner);
  const proposalOwnerIsUpToDate =
    chainProposalOwner ===
    toCanonicalAddress(serverDao?.daoRoles?.proposalOwner);

  return {
    daoState,
    chainMetadataAddress,
    chainOwner,
    chainProposalOwner,
    metadataIsUpToDate,
    isUpToDate:
      metadataIsUpToDate && ownerIsUpToDate && proposalOwnerIsUpToDate,
  };
};

const DAO_VERIFY_TTL = 60_000;

export interface DaoVerification {
  isUpToDate: boolean;
  chainMetadataAddress: string;
  chainOwner: string;
  chainProposalOwner: string;
}

const daoVerificationCache = new Map<
  string,
  { verifiedAt: number; verification: DaoVerification }
>();

export const verifyDaoWithChain = async (
  daoAddress: string,
  serverDao?: Pick<Dao, "daoRoles" | "daoMetadata"> | null,
  force = false,
  client?: TonClient
): Promise<DaoVerification> => {
  if (!force) {
    const cached = daoVerificationCache.get(daoAddress);
    if (cached && Date.now() - cached.verifiedAt < DAO_VERIFY_TTL) {
      return cached.verification;
    }
  }

  const comparison = await compareDaoWithChain(daoAddress, serverDao, client);

  const verification: DaoVerification = {
    isUpToDate: comparison.isUpToDate,
    chainMetadataAddress: comparison.chainMetadataAddress,
    chainOwner: comparison.chainOwner,
    chainProposalOwner: comparison.chainProposalOwner,
  };

  daoVerificationCache.set(daoAddress, { verifiedAt: Date.now(), verification });

  return verification;
};

export const syncDaoFromChain = async (
  serverDao: Dao,
  verification: DaoVerification,
  client?: TonClient
): Promise<Dao> => {
  const connection = client || (await getClientV2());

  const metadataArgs =
    (verification.chainMetadataAddress &&
      (await getDaoMetadata(connection, verification.chainMetadataAddress))) ||
    serverDao.daoMetadata.metadataArgs;

  return {
    ...serverDao,
    daoRoles: {
      owner: verification.chainOwner,
      proposalOwner: verification.chainProposalOwner,
    },
    daoMetadata: {
      metadataAddress: "",
      metadataArgs,
    },
  };
};

export const useNewDaoAddresses = () => {
  const { daos: newDaosAddresses, removeDao } = useNewDataStore();

  return async (daos: Dao[]) => {    
    if (_.size(newDaosAddresses)) {
      const addresses = _.map(daos, (it) => it.daoAddress);
      const client = await getClientV2();

      let promise = Promise.allSettled(
        _.map(newDaosAddresses, async (newDaoAddress) => {
          if (addresses.includes(newDaoAddress)) {
            removeDao(newDaoAddress);
          } else {
            Logger(`New DAO: ${newDaoAddress}`);
            return contract.getDao(newDaoAddress, client);
          }
        })
      );

      const newDaosMap = await promise;

      const newDaos = _.compact(
        newDaosMap.map((it, index) => {
          if (it.status === "fulfilled") {
            return it.value;
          } else {
            removeDao(newDaosAddresses[index]);
          }
        })
      );
      daos = [daos[0], ...newDaos, ...daos.slice(1)];
    }
    return daos;
  };
};

// кэш результатов сверки списка ДАО с цепочкой: чтобы не дёргать цепочку
// для каждого ДАО при каждом рефетче, повторно сверяемся только если данные
// из API изменились (сменился адрес метаданных) или истёк TTL
const DSP_DAO_LIST_TTL = 60_000;
interface ListCorrection {
  verifiedAt: number;
  serverMetadataAddress: string;
  syncedDao: Pick<Dao, "daoRoles" | "daoMetadata"> | null;
}
const daoListCorrections = new Map<string, ListCorrection>();

export const useIsDaosUpToDate = () => {
  const { getDaoUpdateMillis, removeDaoUpdateMillis } = useSyncStore();

  const reconcile = async (
    dao: Dao,
    client: TonClient,
    metadataLastUpdate: number | undefined
  ): Promise<Dao> => {
    const daoAddress = dao.daoAddress;
    const serverAddress = dao.daoMetadata?.metadataAddress || "";
    const cached = daoListCorrections.get(daoAddress);

    // недавно уже сверялись, данные из API не менялись — применяем результат повторно
    if (
      !metadataLastUpdate &&
      cached &&
      cached.serverMetadataAddress === serverAddress &&
      Date.now() - cached.verifiedAt < DSP_DAO_LIST_TTL
    ) {
      return cached.syncedDao ? { ...dao, ...cached.syncedDao } : dao;
    }

    try {
      const comparison = await compareDaoWithChain(daoAddress, dao, client);

      let syncedDao: Pick<Dao, "daoRoles" | "daoMetadata"> | null = null;

      if (!comparison.isUpToDate && comparison.chainMetadataAddress) {
        const metadataArgs = await getDaoMetadata(
          client,
          comparison.chainMetadataAddress
        );
        syncedDao = {
          daoRoles: {
            owner: comparison.chainOwner,
            proposalOwner: comparison.chainProposalOwner,
          },
          daoMetadata: {
            metadataAddress: "",
            metadataArgs,
          },
        };
      } else if (metadataLastUpdate) {
        removeDaoUpdateMillis(daoAddress);
      }

      daoListCorrections.set(daoAddress, {
        verifiedAt: Date.now(),
        serverMetadataAddress: serverAddress,
        syncedDao,
      });

      return syncedDao ? { ...dao, ...syncedDao } : dao;
    } catch (error) {
      Logger(`Failed to verify DAO ${daoAddress} on chain:`, error);
      return dao;
    }
  };

  return async (daos: Dao[], onDaoCorrected?: (dao: Dao) => void) => {
    let client: TonClient;
    try {
      client = await getClientV2();
    } catch (error) {
      // RPC недоступен — оставляем данные из API как есть
      Logger("Failed to create client for DAO verification:", error);
      return daos;
    }

    // список ДАО нельзя блокировать десятками запросов к цепочке (RPC может
    // отвечать секундами): сначала применяем уже известные исправления, а
    // перепроверку остальных выполняем в фоне, обновляя кэш по мере готовности
    const corrected: Dao[] = [];
    const pending: Array<Promise<void>> = [];

    daos.forEach((dao) => {
      const metadataLastUpdate = getDaoUpdateMillis(dao.daoAddress);
      const serverAddress = dao.daoMetadata?.metadataAddress || "";
      const cached = daoListCorrections.get(dao.daoAddress);
      const applyFresh = (d: Dao): Dao =>
        cached && cached.syncedDao
          ? { ...d, ...cached.syncedDao }
          : d;

      if (
        !metadataLastUpdate &&
        cached &&
        cached.serverMetadataAddress === serverAddress &&
        Date.now() - cached.verifiedAt < DSP_DAO_LIST_TTL
      ) {
        corrected.push(applyFresh(dao));
        return;
      }

      corrected.push(dao);
      pending.push(
        reconcile(dao, client, metadataLastUpdate).then((synced) => {
          if (onDaoCorrected) onDaoCorrected(synced);
        })
      );
    });

    // сверяемся порциями, чтобы не обрушить публичные RPC разом, и не
    // блокируем отрисовку списка — результат применяем в фоне по мере готовности
    const CHUNK_SIZE = 15;
    const sweep = async () => {
      try {
        for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
          await Promise.allSettled(pending.slice(i, i + CHUNK_SIZE));
        }
      } catch (error) {
        Logger("DAO list background sync error:", error);
      }
    };
    void sweep();

    return corrected;
  };
};

export const getIsServerUpToDate = async (itemLastUpdateTime?: number) => {
  if (!itemLastUpdateTime) return true;
  if (itemLastUpdateTime) {
    const serverLastUpdate = await api.getUpdateTime();

    if (!validateServerUpdateTime(serverLastUpdate, itemLastUpdateTime)) {
      Logger("server is not updated, fetching from contract");
      return false;
    } else {
      return true;
    }
  }
};

export const useDaoNewProposals = () => {
  const { proposals: newProposals, removeProposal } = useNewDataStore();

  return (daoAddress: string, proposals: string[]) => {
    const newDaoPoposals = newProposals[daoAddress];
    
    
    // if no new proposals reutrn current proposals
    if (!_.size(newDaoPoposals)) return proposals;
    _.forEach(newDaoPoposals, (newDaoProposal) => {
      // if server already return new proposal, delete from local storage
      if (proposals.includes(newDaoProposal)) {
        removeProposal(daoAddress, newDaoProposal);
      } else {
        // if server dont return new proposal, add to proposals
        proposals.push(newDaoProposal);
      }
    });

    return _.uniq(proposals);
  };
};

