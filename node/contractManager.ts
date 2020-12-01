import { File, Node, FileDbItem, ContractDb, ContractCandidate, NodesHandler } from "./types";
import cron from "node-cron";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import path from "path";
import Tracker from "./services/tracker";
import udp from "./services/udp";
import FileManager from "./fileManager";
import net from 'net';
import fs from "fs";

class ContractManager {
  contractDb: any;
  nodeHandler: NodesHandler;
  fm: FileManager;
  udp: udp;
  id: string;

  contractCandidates: Array<ContractCandidate>;

  constructor(nodeManager: NodesHandler, udp: udp, id: string, fm: FileManager) {
    this.nodeHandler = nodeManager;
    this.udp = udp;
    this.fm = fm;
    this.id = id;

    this.contractCandidates = [];
    cron.schedule("*/10 * * * * *", async () => {
      this.pingContracts();
    });

    cron.schedule("*/30 * * * * *", async () => {
      this.checkContractsWithoutFileSent();
    });
  }

  private checkContractsWithoutFileSent = async () => {
    // TODO: logic here to start sending files for contracts
  };

  private pingContracts = async () => {
    console.log("PING CONTRACTS");
    this.fm.getContracts().forEach((contract) => {
      this.udp.sendUdpMessage(
        `CONTRACT_PING;${contract.contractId};${contract.contractNodeId}`,
        contract.contractNodePort,
        contract.contractNodeAddress
      );
    });
  };
}

export default ContractManager;
