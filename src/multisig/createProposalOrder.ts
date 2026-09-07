import { Address, Cell, beginCell, fromNano } from "@ton/core";
import {
  getClientV2,
  getDaoState,
  ProposalMetadata,
} from "ton-vote-contracts-sdk";
import { ProposalDeployer } from "ton-vote-contracts-sdk/dist/contracts/output/ton-vote_ProposalDeployer";
import { TX_FEES } from "config";
import { getTxFee } from "utils";

// opcodes сообщений контракта ДАО (см. ton-vote-contracts-sdk)
const OP_DEPLOY_AND_INIT_PROPOSAL = 1496883659;
const OP_FWD_MSG = 1690551268;

// SDK собран на отдельном инстансе ton-core, поэтому ячейки/адреса оттуда
// конвертируются в @ton/core через строки/BOC (бит-в-бит идентично newProposal).
const toAtCell = (cell?: unknown): Cell | null =>
  cell ? Cell.fromBase64((cell as Cell).toBoc().toString("base64")) : null;

export interface CreateProposalOrder {
  orderBoc: string;
  feeTon: string;
}

/**
 * Собирает тело сообщения FwdMsg, которым мультикошелёк-издатель (proposalOwner)
 * создаёт предложение на контракте ДАО (точно так же, как newProposal из
 * ton-vote-contracts-sdk). Возвращает BOC для заявки «Произвольная заявка».
 */
export const buildCreateProposalOrder = async (params: {
  daoAddress: string;
  metadata: ProposalMetadata;
}): Promise<CreateProposalOrder> => {
  const { daoAddress, metadata } = params;

  const client = await getClientV2();
  const daoState = await getDaoState(client, daoAddress);

  const deployerInit = await ProposalDeployer.fromInit(Address.parse(daoAddress));
  const isDeployed = await client.isContractDeployed(deployerInit.address);

  const code = isDeployed ? null : deployerInit.init?.code ?? null;
  const data = isDeployed ? null : deployerInit.init?.data ?? null;

  const body = beginCell()
    .storeUint(OP_DEPLOY_AND_INIT_PROPOSAL, 32)
    .storeUint(BigInt(metadata.proposalStartTime), 64)
    .storeUint(BigInt(metadata.proposalEndTime), 64)
    .storeUint(BigInt(metadata.proposalSnapshotTime), 64)
    .storeStringRefTail(JSON.stringify(metadata.votingSystem))
    .storeStringRefTail(JSON.stringify(metadata.votingPowerStrategies))
    .storeStringRefTail(metadata.title)
    .storeRef(
      beginCell()
        .storeStringRefTail(metadata.description)
        .storeStringRefTail(metadata.quorum)
        .storeBit(metadata.hide)
        .endCell(),
    )
    .endCell();

  const fwdMsg = beginCell()
    .storeUint(OP_FWD_MSG, 32)
    .storeBit(true)
    .storeAddress(Address.parse(deployerInit.address.toRawString()))
    .storeInt(0n, 257)
    .storeInt(64n, 257)
    .storeBit(true)
    .storeRef(body);

  fwdMsg.storeBit(code ? true : false);
  if (code) fwdMsg.storeRef(toAtCell(code)!);
  fwdMsg.storeBit(data ? true : false);
  if (data) fwdMsg.storeRef(toAtCell(data)!);

  const feeTon = getTxFee(
    Number(fromNano(daoState.fwdMsgFee)),
    TX_FEES.FORWARD_MSG,
  );

  return {
    orderBoc: fwdMsg.endCell().toBoc().toString("base64"),
    feeTon,
  };
};