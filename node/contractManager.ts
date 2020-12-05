import { NodesHandler } from "./types";
import cron from "node-cron";
import udp from "./services/udp";
import FileManager from "./fileManager";

import ContractProof from "./modules/contract/contractProof";
import ContractFileSender from "./modules/contract/contractFileSender";
import { sha1smallstr } from "./util/hash";

class ContractManager {
  contractDb: any;
  nodeHandler: NodesHandler;
  fm: FileManager;
  udp: udp;
  id: string;

  constructor(localNodeId: number, nodeManager: NodesHandler, udp: udp, id: string, fm: FileManager) {
    this.nodeHandler = nodeManager;
    this.udp = udp;
    this.fm = fm;
    this.id = id;

    cron.schedule("*/10 * * * * *", async () => {
      this.pingContracts();
    });

    const contractProof = new ContractProof(localNodeId, this.nodeHandler, this.udp, this.id, this.fm);
    const contractFileSender = new ContractFileSender(this.nodeHandler, this.udp, this.id, this.fm);
  }

  private pingContracts = async () => {
    const nodes = this.nodeHandler.getNodes();
    const pings = this.fm.getContracts().map((contract) => {
      const node = nodes.find(n => n.nodeId === contract.contractNodeId)
      if (!node) {
        console.log(`CONTRACT PING ERROR: cant find node ${contract.contractNodeId} for contract${contract.contractId}`)
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
      console.log(`PING CONTRACTS [${pings.join(", ")}]`);
    }
  };
}

export default ContractManager;
