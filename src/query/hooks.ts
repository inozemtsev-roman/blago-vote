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

export const compareDaoMetadataWithChain = async (
  daoAddress: string,
  apiMetadataAddress: string,
  client?: TonClient
) => {
  const connection = client || (await getClientV2());

  const daoState = await getDaoState(connection, daoAddress);

  const chainMetadataAddress = toCanonicalAddress(daoState.metadata);

  return {
    chainMetadataAddress,
    isUpToDate:
      chainMetadataAddress === toCanonicalAddress(apiMetadataAddress),
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

          const comparison = await compareDaoMetadataWithChain(
            dao.daoAddress,
            dao.daoMetadata?.metadataAddress || "",
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

