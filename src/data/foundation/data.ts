import { Proposal } from "types";
import _ from "lodash";

export const FOUNDATION_DAO_ADDRESS =
  "EQCb8dxevgHhBnsTodJKXaCrafplHzAHf1V2Adj0GVlhA5xI";

export const shouldHideVerify = (_address: string) => false;

export const getFoundationProposals = async (): Promise<{
  [key: string]: Proposal;
}> => {
  return {};
};
