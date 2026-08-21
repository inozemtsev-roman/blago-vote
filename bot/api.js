import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { config, log } from "./config.js";

const agent = config.proxy ? new SocksProxyAgent(config.proxy) : undefined;

const client = axios.create({
  baseURL: config.apiBase,
  timeout: 30_000,
  httpsAgent: agent,
  proxy: false,
});

export async function fetchDaos() {
  try {
    const res = await client.get("/daos");
    return res.data || [];
  } catch (err) {
    log("Failed to fetch DAOs:", err.message);
    return [];
  }
}

export async function fetchProposal(proposalAddress) {
  try {
    const res = await client.get(`/proposal/${proposalAddress}`);
    return res.data;
  } catch (err) {
    log(`Failed to fetch proposal ${proposalAddress}:`, err.message);
    return null;
  }
}

export async function fetchDao(daoAddress) {
  try {
    const res = await client.get(`/dao/${daoAddress}`);
    return res.data;
  } catch (err) {
    log(`Failed to fetch DAO ${daoAddress}:`, err.message);
    return null;
  }
}
