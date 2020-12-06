import { ContractCandidate, NodesHandler } from "../../types";
import cron from "node-cron";
import udp from "../../services/udp";
import FileManager from "../../fileManager";
import { sha1smallstr, getRandomSha1 } from "../../util/hash";
import { Logger } from "winston";

/**
 * Negotiates contracts for files that don't have any contracts.
 */
class ContractNegotiator {
  nodeHandler: NodesHandler;
  fm: FileManager;
  udpClient: udp;
  id: string;
  logger: Logger;

  contractCandidates: Array<ContractCandidate>;

  constructor(nodeHandler: NodesHandler, udpClient: udp, id: string, fm: FileManager, logger: Logger) {
    this.nodeHandler = nodeHandler;
    this.id = id;
    this.fm = fm;
    this.udpClient = udpClient;
    this.logger = logger;

    this.contractCandidates = [];

    this.udpClient.on("CONTRACT_CREATE", this.onContractCreate);
    this.udpClient.on("CONTRACT_CREATE_ACK", this.onContractCreateAck);
    this.udpClient.on("CONTRACT_PING", this.onContractPing);

    this.sendContactCreateRequests();
    cron.schedule("*/20 * * * * *", async () => {
      this.sendContactCreateRequests();
    });
    cron.schedule("*/10 * * * * *", async () => {
      this.checkCandidateContracts();
    });
  }

  /**
   * Send contract create requets for all nodes, which are seeking new contracts.
   */
  sendContactCreateRequests = async () => {
    if (this.enoughCandidates()) {
      return;
    }
    const nodes = await this.nodeHandler.getNodes();
    nodes.forEach((node) => {
      if (!node.contractRequest) {
        return;
      }

      if (node.nodeId === this.id) {
        return;
      }

      const newContract = {
        waitingAck: true,
        pingCount: 0,
        creationTime: new Date().getTime(),
        contractId: getRandomSha1(),
        contractNodeId: node.nodeId,
        contractNodeAddress: node.ip,
        contractNodePort: Number(node.port),
      } as ContractCandidate;
      this.contractCandidates = [...this.contractCandidates, newContract];
      this.udpClient.sendUdpMessage(
        `CONTRACT_CREATE:${newContract.contractId}:${newContract.contractNodeId}:${this.id}`,
        Number(newContract.contractNodePort),
        newContract.contractNodeAddress
      );
      this.logger.log("info", "SEND CONTRACT_CREATE - " + newContract.contractId);
    });
  };

  private enoughCandidates = () => {
    const filesWithoutContracts = this.fm.getFilesWithoutContract();
    if (filesWithoutContracts.length === 0) return true;
    return this.contractsWithAck().length >= filesWithoutContracts.length;
  };

  private onContractPing = async ([data1, data2]: string[]) => {
    const nodeId = data2;
    const contractId = data1;
    if (nodeId !== this.id) {
      this.logger.log("warn", `CONTRACT_PING - Wrong node id in contract`);
      return;
    }

    const contract = this.contractCandidates.find(
      (contract) => contract.contractId === contractId && !contract.waitingAck
    );

    if (!contract) {
      this.logger.log("warn", "CONTRACT_PING - Wrong message.");
      return;
    }

    if (contract.pingCount + 1 >= 3 && this.enoughCandidates()) {
      const sortedByPingCount = [...this.contractCandidates].sort((a, b) => b.pingCount - a.pingCount);
      this.contractCandidates = sortedByPingCount.slice(0, this.fm.getFilesWithoutContract().length);
    }

    if (contract.pingCount + 1 >= 10) {
      this.logger.log("info", `CONTRACT NEGOTIATION SUCCESSFULL - Add contract ${sha1smallstr(contract.contractId)}`);
      this.fm.addContract(contract, this.fm.getFilesWithoutContract()[0]);
      this.contractCandidates = this.contractCandidates.filter((c) => c.contractId != contract.contractId);
      return;
    }

    this.contractCandidates = this.contractCandidates.map((contract) => {
      if (contract.contractId === contractId) {
        return { ...contract, pingCount: contract.pingCount + 1, creationTime: new Date().getTime() };
      }
      return contract;
    });

    this.logger.log(
      "info",
      `CONTRACT_PING - Received for ${sha1smallstr(contractId)}. Pings: ${contract.pingCount + 1}`
    );
  };

  private onContractCreateAck = async ([contractId, receiveNodeId, nodeId]: string[], info: any) => {
    if (receiveNodeId !== this.id) {
      this.logger.log("warn", "CONTRACT_CREATE_ACK - Wrong nodeid");
      return;
    }

    if (this.enoughCandidates()) {
      this.logger.log(
        "warn",
        `CONTRACT_CREATE_ACK received - Reject contract ${sha1smallstr(contractId)}. Enough contract candidates.`
      );
    }

    const contract = this.contractCandidates.find(
      (contract) => contract.contractNodeId === nodeId && contract.contractId === contractId && contract.waitingAck
    );

    if (!contract) {
      this.logger.log("warn", "CONTRACT_CREATE_ACK - Wrong message.");
      return;
    }

    this.logger.log("info", `CONTRACT_CREATE_ACK received - Start pinging candidate ${sha1smallstr(contractId)}`);
    this.contractCandidates = this.contractCandidates.map((c) => {
      if (c.contractId === contractId) {
        return { ...c, creationTime: new Date().getTime(), waitingAck: false };
      }
      return c;
    });
  };

  private onContractCreate = async ([contractId, receiveNodeId, nodeId]: string[], info: any) => {
    if (receiveNodeId !== this.id) {
      this.logger.log("warn", "CONTRACT_CREATE - ERROR: wrong nodeid");
      return;
    }
    if (this.enoughCandidates()) {
      this.logger.log(
        "warn",
        `CONTRACT_CREATE received - REJECT contract ${sha1smallstr(contractId)}. Enough contract candidates.`
      );
      return;
    }

    console.log(`CONTRACT_CREATE received - Respond with ACK. Start pinging contract ${sha1smallstr(contractId)}`);

    const nodeAddress = info.address;
    const nodePort = info.port;
    const newContract = {
      waitingAck: false,
      pingCount: 0,
      creationTime: new Date().getTime(),
      contractId: contractId,
      contractNodeId: nodeId,
      contractNodeAddress: nodeAddress,
      contractNodePort: nodePort,
    };
    this.contractCandidates = [...this.contractCandidates, newContract];
    this.udpClient.sendUdpMessage(
      `CONTRACT_CREATE_ACK:${newContract.contractId}:${nodeId}:${this.id}`,
      info.port,
      info.address
    );
  };

  /*
    Ping candidate contracts. If node 
  */
  checkCandidateContracts = async () => {
    this.checkTTLCandidateContracts();
    this.pingCandidateContracts();
  };

  private contractsWithPings = () => {
    return this.contractCandidates.filter((c) => c.pingCount > 0);
  };

  private contractsWithAck = () => {
    return this.contractCandidates.filter((c) => !c.waitingAck);
  };

  private checkTTLCandidateContracts = async () => {
    this.contractCandidates = this.contractCandidates.reduce<Array<ContractCandidate>>((acc, curr) => {
      if (curr.creationTime + 30 * 1000 < new Date().getTime()) {
        return acc;
      }
      return [...acc, curr];
    }, []);
  };

  private pingCandidateContracts = async () => {
    const pings = this.contractCandidates.reduce<string[]>((acc, contract) => {
      if (contract.waitingAck) {
        return acc;
      }
      this.udpClient.sendUdpMessage(
        `CONTRACT_PING:${contract.contractId}:${contract.contractNodeId}`,
        contract.contractNodePort,
        contract.contractNodeAddress
      );
      return [...acc, sha1smallstr(contract.contractId)];
    }, []);
    if (pings.length > 0) {
      this.logger.log("warn", `CONTRACT_PINGS sent for [${pings.join(", ")}]`);
    }
  };
}

export default ContractNegotiator;
