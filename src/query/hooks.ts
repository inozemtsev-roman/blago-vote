import { api } from "api";
import { contract } from "contract";
import _ from "lodash";
import { useNewDataStore, useSyncStore } from "store";
import {
  getClientV2,
  getDaoMetadata,
} from "ton-vote-contracts-sdk";
import { Dao } from "types";
import {
  Logger,
  validateServerUpdateTime,
} from "utils";
import { useCallback } from "react";

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
  const { getDaoUpdateMillis } = useSyncStore();

  return async (daos: Dao[]) => {
    const promise = await Promise.allSettled(
      _.map(daos, async (dao): Promise<Dao> => {
        const metadataLastUpdate = getDaoUpdateMillis(dao.daoAddress);
        let metadataArgs = dao.daoMetadata.metadataArgs;
        const isServerUpToDate = await getIsServerUpToDate(metadataLastUpdate);

        if (!isServerUpToDate) {
          metadataArgs = await getDaoMetadata(
            await getClientV2(),
            dao.daoMetadata.metadataAddress
          );
        }

        return {
          ...dao,
          daoMetadata: {
            metadataAddress: "",
            metadataArgs,
          },
        };
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
  const newDataStore = useNewDataStore();

  return useCallback(
    (daoAddress: string, currentProposals: string[]) => {
      console.log("Adding new proposals for DAO:", daoAddress);
      console.log("New proposals in local storage:", newDataStore.proposals[daoAddress]);
      console.log("Current proposals:", currentProposals);
      
      if (!newDataStore.proposals[daoAddress]) {
        console.log("No new proposals found in storage");
        return currentProposals;
      }

      const newProposals = newDataStore.proposals[daoAddress];
      console.log("New proposals from storage:", newProposals);
      
      const uniqueProposals = _.uniq([...currentProposals, ...newProposals]);
      console.log("Combined unique proposals:", uniqueProposals);
      
      return uniqueProposals;
    },
    [newDataStore.proposals]
  );
};

