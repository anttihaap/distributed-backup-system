import { NodesHandler } from "./types";
import cron from "node-cron";
import udp from "./services/udp";
import logger from "./util/logger";

import ContractNegotiator from "./modules/contract/contractNegotiator";
import ContractProof from "./modules/contract/contractProof";
import ContractFileSender from "./modules/contract/contractFileSender";
import { sha1smallstr } from "./util/hash";
import { getContracts, getContract, updateContractLastPing, setContractWaitingRecovery, removeContract } from "./db/contractDb";

// 1 min
const CONTRACT_TTL = 1 * 60 * 1000;

class ContractManager {
  contractDb: any;
  nodeHandler: NodesHandler;
  udpClient: udp;
  id: string;

  contractNegotiator: ContractNegotiator;

  constructor(nodeManager: NodesHandler, udp: udp, id: string) {
    this.nodeHandler = nodeManager;
    this.udpClient = udp;
    this.id = id;

    cron.schedule("*/10 * * * * *", async () => {
      this.checkRecoveryTTL();
      this.pingContracts();
      this.checkContractPings();
    });

    this.udpClient.on("CONTRACT_PING", this.onContractPing);

    this.contractNegotiator = new ContractNegotiator(this.nodeHandler, this.udpClient, this.id);
    const contractProof = new ContractProof(this.nodeHandler, this.udpClient, this.id);
    const contractFileSender = new ContractFileSender(this.nodeHandler, this.udpClient, this.id);
  }

  private onContractPing = async ([contractId, nodeId]: string[]) => {
    if (nodeId !== this.id) {
      logger.log("warn", `CONTRACT_PING - Wrong node id in contract`);
    }
    const contract = getContract(contractId);

    if (!contract) {
      this.contractNegotiator.onCandidatePing([contractId, nodeId]);
      return;
    }

    if (contract.waitingNodeRecovery) {
      // TODO RECOVER!
      logger.log("info", `CONTRACT ${sha1smallstr(contractId)} RECOVERED`);
      setContractWaitingRecovery(contract.contractId, false);
    }

    updateContractLastPing(contractId);
    logger.log("info", `CONTRACT PING - Received for ${sha1smallstr(contractId)}.`);
  };

  private pingContracts = async () => {
    const nodes = this.nodeHandler.getNodes();
    const pings = getContracts()
      .map((contract) => {
        const node = nodes.find((n) => n.nodeId === contract.contractNodeId);
        if (!node) {
          logger.log(
            "warn",
            `CONTRACT PING ERROR: cant find node ${contract.contractNodeId} for contract${contract.contractId}`
          );
          return;
        }
        this.udpClient.sendUdpMessage(
          `CONTRACT_PING:${contract.contractId}:${contract.contractNodeId}`,
          Number(node.port),
          node.ip
        );
        return sha1smallstr(contract.contractId);
      });
    if (pings.length > 0) {
      logger.log("info", `PING CONTRACTS [${pings.join(", ")}]`);
    }
  };

  private checkContractPings = async () => {
    const contracts = getContracts().filter(c => !c.waitingNodeRecovery).forEach((contract) => {
      if (contract.lastPingTime + CONTRACT_TTL < new Date().getTime()) {
        const recoveryTimeInMins = (new Date().getTime() - contract.creationTime) / 1000 / 60;
        logger.log("warn", `CONTRACT PING TIME OUT - ${contract.contractId}. Will wait for recovery ${recoveryTimeInMins} mins.`);
        setContractWaitingRecovery(contract.contractId, true);
      }
    });
  };

  private checkRecoveryTTL = async () => {
    getContracts().filter(c => c.waitingNodeRecovery).forEach(c => {
      if (!c.waitingNodeRecoveryStartTime) {
        logger.log("error", "CONTRACT waitingNodeRecoveryStartTime not set. Will delete contract.")
        removeContract(c.contractId);
        return;
      }
      const maxWaitTime = c.waitingNodeRecoveryStartTime - c.creationTime;
      if (c.waitingNodeRecoveryStartTime + maxWaitTime < new Date().getTime()) {
        logger.log("error", `CONTRACT NOT RECOVERED IN TIME. DELETE CONTRACT ${sha1smallstr(c.contractId)}`)
        removeContract(c.contractId);
      }
    })
  }
}

export default ContractManager;
