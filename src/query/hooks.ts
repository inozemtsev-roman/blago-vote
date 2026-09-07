import { api } from "api";
import { contract } from "contract";
import _ from "lodash";
import { useNewDataStore, useSyncStore } from "store";
import {
  getClientV2,
  getDaoMetadata,
  getDaoState,
} from "ton-vote-contracts-sdk";
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

export const useIsDaosUpToDate = () => {
  const { getDaoUpdateMillis, removeDaoUpdateMillis } = useSyncStore();

  return async (daos: Dao[]) => {
    const promise = await Promise.allSettled(
      _.map(daos, async (dao): Promise<Dao> => {
        const metadataLastUpdate = getDaoUpdateMillis(dao.daoAddress);

        if (!metadataLastUpdate) {
          return dao;
        }

        try {
          const client = await getClientV2();

          const comparison = await compareDaoWithChain(
            dao.daoAddress,
            dao,
            client
          );

          if (comparison.isUpToDate) {
            removeDaoUpdateMillis(dao.daoAddress);
            return dao;
          }

          if (!comparison.chainMetadataAddress) {
            return dao;
          }

          const metadataArgs = await getDaoMetadata(
            client,
            comparison.chainMetadataAddress
          );

          return {
            ...dao,
            daoRoles: {
              owner: comparison.chainOwner,
              proposalOwner: comparison.chainProposalOwner,
            },
            daoMetadata: {
              metadataAddress: "",
              metadataArgs,
            },
          };
        } catch (error) {
          Logger(
            `Failed to verify DAO ${dao.daoAddress} on chain:`,
            error
          );
          return dao;
        }
      })
    );

    return _.compact(
      promise.map((it) => {
        if (it.status === "fulfilled") {
          return it.value;
        } else {
          return null;
        }
      })
    );
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

