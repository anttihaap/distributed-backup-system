import { NodesHandler } from "./types";
import cron from "node-cron";
import udp from "./services/udp";
import logger from "./util/logger"

import ContractProof from "./modules/contract/contractProof";
import ContractFileSender from "./modules/contract/contractFileSender";
import { sha1smallstr } from "./util/hash";
import {getContracts} from "./db/contractDb";

class ContractManager {
  contractDb: any;
  nodeHandler: NodesHandler;
  udp: udp;
  id: string;

  constructor(nodeManager: NodesHandler, udp: udp, id: string) {
    this.nodeHandler = nodeManager;
    this.udp = udp;
    this.id = id;

    cron.schedule("*/10 * * * * *", async () => {
      this.pingContracts();
    });

    const contractProof = new ContractProof(this.nodeHandler, this.udp, this.id);
    const contractFileSender = new ContractFileSender(this.nodeHandler, this.udp, this.id);
  }

  private pingContracts = async () => {
    const nodes = this.nodeHandler.getNodes();
    const pings = getContracts().map((contract) => {
      const node = nodes.find((n) => n.nodeId === contract.contractNodeId);
      if (!node) {
        logger.log(
          "warn",
          `CONTRACT PING ERROR: cant find node ${contract.contractNodeId} for contract${contract.contractId}`
        );
        return;
      }
      this.udp.sendUdpMessage(
        `CONTRACT_PING;${contract.contractId};${contract.contractNodeId}`,
        Number(node.port),
        node.ip
      );
      return sha1smallstr(contract.contractId);
    });
    if (pings.length > 0) {
      logger.log("info", `PING CONTRACTS [${pings.join(", ")}]`);
    }
  };
}

export default ContractManager;
