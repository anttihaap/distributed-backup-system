import { File, FileDbItem, ContractDb, ContractCandidate } from "./types";
import cron from "node-cron";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import path from "path";
import Tracker from "./services/tracker";
import udp from "./services/udp";
import FileManager from "./fileManager";

const uuid = require("uuid");

interface ContractCandidates {
  [contractId: string]: ContractCandidate;
}

class ContractManager {
  contractDb: any;
  tracker: Tracker;
  fm: FileManager;
  udp: udp;
  id: string;
  //waitingForContractCreate: boolean;

  sentContractCandidates: ContractCandidates;
  receivedContractCandidates: ContractCandidates;

  constructor(tracker: Tracker, udpIn: number, id: string, localNodeId: number) {
    this.tracker = tracker;
    this.udp = new udp(udpIn, this.tracker, this.onUdpMessage.bind(this));
    this.fm = new FileManager(tracker, localNodeId);
    this.id = id;
    this.sentContractCandidates = {};
    this.receivedContractCandidates = {};

    this.sendContactCreateRequests();
    cron.schedule("*/20 * * * * *", async () => {
      this.sendContactCreateRequests();
    });
    cron.schedule("*/10 * * * * *", async () => {
      this.checkCandidateContracts();
    });
  }

  getContracts(): ContractDb {
    return this.contractDb.getData("/") as ContractDb;
  }

  sendContactCreateRequests = async () => {
    const filesWithoutContract = this.fm.getFilesWithoutContract().length;
    if (filesWithoutContract === 0) return;
    if (filesWithoutContract > Object.keys(this.receivedContractCandidates).length) {
      this.udp.sendContractCreateToAll(this.id);
    } else {
      console.log("dont send");
    }
  };

  private onUdpMessage = async (msg: any, info: any) => {
    const [type, data1, data2, data3] = msg.toString().split(";");
    if (type === "CONTRACT_PING") {
      this.onContractPing([data1, data2, data3]);
      return;
    }

    const shouldContactRequest = this.fm.getFilesWithoutContract().length > 0;

    // Happy with everything
    if (!shouldContactRequest) return;

    if (type === "CONTRACT_CREATE_ACK") {
      this.onContractCreateAck([data1, data2, data3], info);
    } else if (type === "CONTRACT_CREATE") {
      this.onContractCreate([data1, data2], info);
    }
  };

  private onContractPing = async ([data1, data2]: string[]) => {
    const nodeId = data2;
    const contractId = data1;
    if (nodeId !== this.id) {
      console.log(`CONTRACT_PING - ERROR: wrong node id in contract`);
      console.log("  wrong contract id in...");
      return;
    }

    const sentCandidate = this.sentContractCandidates[contractId];
    const shouldContactRequest = this.fm.getFilesWithoutContract().length > 0;
    if (
      sentCandidate &&
      shouldContactRequest &&
      Object.keys(this.receivedContractCandidates).length < this.fm.getFilesWithoutContract().length
    ) {
      console.log("ADD CONTRACT -", sentCandidate.contractId);
      this.receivedContractCandidates[contractId] = this.sentContractCandidates[contractId];
      delete this.sentContractCandidates[contractId];
      return;
    }

    const shouldContactRequest2 = this.fm.getFilesWithoutContract().length > 0;
    const receivedContractCandidate = this.receivedContractCandidates[contractId];
    if (receivedContractCandidate && shouldContactRequest2) {
      console.log("PING UP CONTRACT - ", receivedContractCandidate.contractId, "- ping: ", receivedContractCandidate.pingCount);
      const pingCount = receivedContractCandidate.pingCount;
      if (pingCount > 3) {
        if (Object.keys(this.receivedContractCandidates).length > this.fm.getFilesWithoutContract().length) {
          console.log("old");
          console.log(this.receivedContractCandidates);
          const newCandidates: ContractCandidates = {};
          const sortedCandidates = Object.entries(this.receivedContractCandidates).sort(
            (a: [string, ContractCandidate], b: [string, ContractCandidate]) => {
              return b[1].pingCount - a[1].pingCount;
            }
          );
          let i;
          for (i = 0; i < this.fm.getFilesWithoutContract().length; i++) {
            const [id, candidate] = sortedCandidates[0];
            newCandidates[id] = candidate;
          }
          this.receivedContractCandidates = newCandidates;
          console.log("new");
          console.log(this.receivedContractCandidates);
        }
      }
      if (pingCount > 10) {
        this.fm.addContract(receivedContractCandidate, this.fm.getFilesWithoutContract()[0]);
        delete this.receivedContractCandidates[contractId];
      }

      this.receivedContractCandidates[contractId] = {
        ...this.receivedContractCandidates[contractId],
        pingCount: pingCount + 1,
        creationTime: new Date().getTime(),
      };

      if (this.fm.getFilesWithoutContract().length == 0) {
        this.receivedContractCandidates = {};
        this.sentContractCandidates = {};
      }
    } else {
      console.log("NOT ADDING CONTRACT");
    }
  };

  private onContractCreateAck = async ([data1, data2, data3]: string[], info: any) => {
    const contractid = data1;
    const receiveNodeId = data2;
    const nodeId = data3;
    if (receiveNodeId !== this.id) {
      console.log("CONTRACT_CREATE_ACK - ERROR: wrong nodeid");
    } else {
      console.log("CONTRACT_CREATE_ACK - Add to recieved contract candidates");
      const nodeAddress = info.address;
      const nodePort = info.port;
      if (
        !this.receivedContractCandidates[contractid] &&
        Object.keys(this.receivedContractCandidates).length < this.fm.getFilesWithoutContract().length
      ) {
        console.log("add recieved");
        this.receivedContractCandidates[contractid] = {
          pingCount: 0,
          creationTime: new Date().getTime(),
          contractId: contractid,
          contractNodeId: nodeId,
          contractNodeAddress: nodeAddress,
          contractNodePort: nodePort,
        };
      }
    }
  };

  private onContractCreate = async ([data1, data2]: string[], info: any) => {
    const receiveNodeId = data1;
    const nodeId = data2;
    if (receiveNodeId !== this.id) {
      console.log("CONTRACT_CREATE - ERROR: wrong nodeid");
    } else {
      console.log("CONTRACT_CREATE - Send ACK");
      const contractId = uuid.v4();
      const nodeAddress = info.address;
      const nodePort = info.port;
      if (!this.sentContractCandidates[contractId]) {
        this.sentContractCandidates[contractId] = {
          pingCount: 0,
          creationTime: new Date().getTime(),
          contractId: contractId,
          contractNodeId: nodeId,
          contractNodeAddress: nodeAddress,
          contractNodePort: nodePort,
        };
      }
      this.udp.sendUdpMessage(`CONTRACT_CREATE_ACK;${contractId};${nodeId};${this.id}`, info.port, info.address);
    }
  };

  /*
    Ping candidate contracts. If node 
  */
  checkCandidateContracts = async () => {
    this.checkTTLCandidateContracts();
    this.pingCandidateContracts();
  };

  private checkTTLCandidateContracts = async () => {
    for (const [id, value] of Object.entries(this.receivedContractCandidates)) {
      if (value.creationTime + 30 * 1000 < new Date().getTime()) {
        console.log("DELETE OLD CONTRACT CANDIDATE -", id);
        delete this.receivedContractCandidates[id];
      }
    }

    for (const [id, value] of Object.entries(this.sentContractCandidates)) {
      if (value.creationTime + 30 * 1000 < new Date().getTime()) {
        console.log("DELETE OLD CONTRACT CANDIDATE -", id);
        delete this.sentContractCandidates[id];
      }
    }
  };

  private pingCandidateContracts = async () => {
    console.log("PING CANDIDATES");
    for (const [_, value] of Object.entries(this.fm.getContracts())) {
      this.udp.sendUdpMessage(
        `CONTRACT_PING;${value.contractId};${value.contractNodeId}`,
        value.contractNodePort,
        value.contractNodeAddress
      );
    }
    for (const [_, value] of Object.entries(this.receivedContractCandidates)) {
      this.udp.sendUdpMessage(
        `CONTRACT_PING;${value.contractId};${value.contractNodeId}`,
        value.contractNodePort,
        value.contractNodeAddress
      );
    }

    for (const [_, value] of Object.entries(this.sentContractCandidates)) {
      this.udp.sendUdpMessage(
        `CONTRACT_PING;${value.contractId};${value.contractNodeId}`,
        value.contractNodePort,
        value.contractNodeAddress
      );
    }
  };
}

export default ContractManager;
