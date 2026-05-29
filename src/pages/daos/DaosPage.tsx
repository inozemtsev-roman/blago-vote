import { List, LoadMore } from "components";
import {
  StyledEmptyText,
  StyledFlexColumn,
  StyledFlexRow,
  StyledSkeletonLoader,
} from "styles";
import {
  StyledDao,
  StyledDaoContent,
  StyledDaosAmount,
  StyledDaosList,
  StyledEmptyList,
  StyledHeader,
  StyledNewDao,
  StyledSearch,
} from "./styles";
import { isDaoWhitelisted, nFormatter } from "utils";
import { Dao } from "types";
import { useMemo } from "react";
import _ from "lodash";
import { PRIMARY_DAO_ADDRESS } from "whitelisted";
import { DAOS_LIMIT, useDaosListLimit } from "./store";
import { useAppQueryParams, useMobile } from "hooks/hooks";
import { DaoListItem } from "./Dao";
import { useDaosPageTranslations } from "i18n/hooks/useDaosPageTranslations";
import { useDaosQuery } from "query/getters";
import { useAppNavigation } from "router/navigation";
import { Page } from "wrappers";
import { Typography } from "@mui/material";

const sortDaos = (daos: Dao[]) => {
  const primary = _.find(daos, { daoAddress: PRIMARY_DAO_ADDRESS });
  const others = _.orderBy(
    _.filter(daos, (it) => it.daoAddress !== PRIMARY_DAO_ADDRESS),
    (it) => it.daoId ?? Number.MAX_SAFE_INTEGER,
    "asc"
  );
  return primary ? [primary, ...others] : others;
};

const filterDaos = (daos: Dao[], searchValue: string) => {
  let filtered = _.filter(daos, (it) => isDaoWhitelisted(it.daoAddress));

  if (!searchValue) return sortDaos(filtered);
  
  const nameFilter = _.filter(filtered, (it) =>
    it.daoMetadata.metadataArgs.name
      .toLowerCase()
      .includes(searchValue.toLowerCase())
  );
  const addressFilter = _.filter(filtered, (it) =>
    it.daoAddress.toLowerCase().includes(searchValue.toLowerCase())
  );

  const proposalsFilter = _.filter(filtered, (it) => {
    let res = false;
    _.forEach(it.daoProposals, (it) => {
      if (it.toLowerCase().includes(searchValue.toLowerCase())) {
        res = true;
      }
    });
    return res;
  });

  return sortDaos(
    _.uniqBy(
      [...nameFilter, ...addressFilter, ...proposalsFilter],
      "daoAddress"
    )
  );
};

export function DaosPage() {
  const { data = [], isLoading, dataUpdatedAt } = useDaosQuery();
  const { limit, loadMore } = useDaosListLimit();
  const mobile = useMobile();

  const { query, setSearch } = useAppQueryParams();

  const searchValue = query.search || "";

  const onSearchInputChange = (value: string) => {
    setSearch(value);
  };
  const translations = useDaosPageTranslations();

  const filteredDaos = useMemo(
    () => filterDaos(data, searchValue),
    [searchValue, dataUpdatedAt]
  );

  const emptyList = !isLoading && !_.size(filteredDaos);
  return (
    <Page hideBack={true}>
      <StyledFlexColumn alignItems="flex-start" gap={mobile ? 15 : 24}>
        <StyledHeader>
          <StyledSearch
            initialValue={query.search || ""}
            onChange={onSearchInputChange}
            placeholder={translations.searchForDAO}
          />
          <StyledDaosAmount>
            {nFormatter(_.size(data))} {translations.spaces}
          </StyledDaosAmount>
        </StyledHeader>
        <StyledFlexColumn gap={25}>
          <List
            isLoading={isLoading}
            isEmpty={!!emptyList}
            loader={<ListLoader />}
            emptyComponent={
              <StyledEmptyList>
                <StyledFlexRow>
                  <StyledEmptyText>{translations.noSpaces}</StyledEmptyText>
                </StyledFlexRow>
              </StyledEmptyList>
            }
          >
            <StyledDaosList>
              {filteredDaos.map((dao, index) => {
                if (index > limit) return null;
                return <DaoListItem key={dao.daoAddress} dao={dao} />;
              })}
              <NewDao />
            </StyledDaosList>
          </List>

          <LoadMore
            totalItems={_.size(filteredDaos)}
            amountToShow={limit}
            showMore={loadMore}
            limit={DAOS_LIMIT}
          />
        </StyledFlexColumn>
      </StyledFlexColumn>
    </Page>
  );
}

export default DaosPage;

const NewDao = () => {
  const { createSpace } = useAppNavigation();

  return (
    <StyledNewDao onClick={() => createSpace.root()}>
      <StyledDaoContent hover className="container">
        <StyledFlexColumn className="flex">
          <Typography>Создать новое пространство для ДАО</Typography>
        </StyledFlexColumn>
      </StyledDaoContent>
    </StyledNewDao>
  );
};

const ListLoader = () => {
  return (
    <StyledDaosList>
      {_.range(0, 1).map((it, i) => {
        return (
          <StyledDao key={i}>
            <StyledDaoContent>
              <StyledFlexColumn>
                <StyledSkeletonLoader
                  style={{ borderRadius: "50%", width: 70, height: 70 }}
                />
                <StyledSkeletonLoader style={{ width: "70%" }} />
                <StyledSkeletonLoader />
              </StyledFlexColumn>
            </StyledDaoContent>
          </StyledDao>
        );
      })}
    </StyledDaosList>
  );
};
