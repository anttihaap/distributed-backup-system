import crypto from "crypto";
import { ContractCandidate, NodesHandler } from "./types";
import cron from "node-cron";
import Tracker from "./services/tracker";
import udp from "./services/udp";
import FileManager from "./fileManager";

/**
 * Negotiates contracts for files that don't have any contracts.
 */
class ContractNegotiator {
  nodeHandler: NodesHandler;
  fm: FileManager;
  udpClient: udp;
  id: string;

  contractCandidates: Array<ContractCandidate>;

  constructor(nodeHandler: NodesHandler, udpClient: udp, id: string, fm: FileManager) {
    this.nodeHandler = nodeHandler;
    this.id = id;
    this.fm = fm;
    this.udpClient = udpClient;

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

      const dateStr = (new Date()).valueOf().toString();
      const random = Math.random().toString();
      const randomHash = crypto.createHash('sha1').update(dateStr + random).digest('hex');

      const newContract = {
        waitingAck: true,
        pingCount: 0,
        creationTime: new Date().getTime(),
        contractId: randomHash,
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
      console.log('SEND CONTRACT_CREATE - ' + newContract.contractId)
    });
  };

  private enoughCandidates = () => {
    const filesWithoutContracts = this.fm.getFilesWithoutContract();
    if (filesWithoutContracts.length === 0) return true;
    return this.contractsWithPings().length >= filesWithoutContracts.length;
  };


  private onContractPing = async ([data1, data2]: string[]) => {
    const nodeId = data2;
    const contractId = data1;
    if (nodeId !== this.id) {
      console.log(`CONTRACT_PING - ERROR: wrong node id in contract`);
      console.log("  wrong contract id in...");
      return;
    }

    const contract = this.contractCandidates.find(
      (contract) => contract.contractId === contractId && !contract.waitingAck
    );

    if (!contract) {
      console.log("CONTRACT_PING - Wrong message.");
      return;
    }

    if (contract.pingCount + 1 >= 3 && this.enoughCandidates()) {
      const sortedByPingCount = [...this.contractCandidates].sort((a, b) => b.pingCount - a.pingCount)
      this.contractCandidates = sortedByPingCount.slice(0, this.fm.getFilesWithoutContract().length)
    }

    if (contract.pingCount + 1 >= 10) {
      console.log("CONTRACT ADDED -", contract.contractId);
      this.fm.addContract(contract, this.fm.getFilesWithoutContract()[0]);
      this.contractCandidates = this.contractCandidates.filter((c) => c.contractId != contract.contractId);
    }

    this.contractCandidates = this.contractCandidates.map((contract) => {
      if (contract.contractId === contractId) {
        return { ...contract, pingCount: contract.pingCount + 1, creationTime: new Date().getTime() };
      }
      return contract;
    });

    console.log(`CONTRACT_PING - Pings: ${contract.pingCount + 1} - Contract: ${contractId}`);
  };

  private onContractCreateAck = async ([contractId, receiveNodeId, nodeId]: string[], info: any) => {
    if (receiveNodeId !== this.id) {
      console.log("CONTRACT_CREATE_ACK - ERROR: wrong nodeid");
      return;
    }

    if (this.enoughCandidates()) {
      console.log("CONTRACT_CREATE_ACK - Reject. Enough contract candidates.");
    }

    const contract = this.contractCandidates.find(
      (contract) => contract.contractNodeId === nodeId && contract.contractId === contractId && contract.waitingAck
    );

    if (!contract) {
      console.log("CONTRACT_CREATE_ACK - Wrong message.");
      // Wrong ACK for us
      return;
    }

    console.log("CONTRACT_CREATE_ACK - Successfull ack of message");
    this.contractCandidates = this.contractCandidates.map((c) => {
      if (c.contractId === contractId) {
        return { ...c, creationTime: new Date().getTime(), waitingAck: false };
      }
      return c;
    });
  };

  private onContractCreate = async ([contractId, receiveNodeId, nodeId]: string[], info: any) => {
    if (receiveNodeId !== this.id) {
      console.log("CONTRACT_CREATE - ERROR: wrong nodeid");
      return;
    }
    console.log("CONTRACT_CREATE - Send ACK");

    if (this.enoughCandidates()) {
      console.log("CONTRACT_CREATE - Reject. Enough contract candidates.");
    }

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

  private checkTTLCandidateContracts = async () => {
    this.contractCandidates = this.contractCandidates.reduce<Array<ContractCandidate>>((acc, curr) => {
      if (curr.creationTime + 30 * 1000 < new Date().getTime()) {
        return acc;
      }
      return [...acc, curr];
    }, []);
  };

  private pingCandidateContracts = async () => {
    console.log("PING CANDIDATES");
    this.contractCandidates.forEach((contract) => {
      if (!contract.waitingAck) {
        console.log("PINGING -", contract.contractId);
        this.udpClient.sendUdpMessage(
          `CONTRACT_PING:${contract.contractId}:${contract.contractNodeId}`,
          contract.contractNodePort,
          contract.contractNodeAddress
        );
      }
    });
  };
}

export default ContractNegotiator;
