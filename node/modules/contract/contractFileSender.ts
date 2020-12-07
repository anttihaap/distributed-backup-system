import cron from "node-cron";

import { NodesHandler } from "../../types";
import Udp from "../../services/udp";
import { sendFile } from "../../services/tcpClient";
import { sha1smallstr } from "../../util/hash";

import { getContracts, setContractFileSent, removeContract } from "../../db/contractDb";
import { getFilePath } from "../../db/fileDb";

import logger from "../../util/logger";
import { checkServerIdentity } from "tls";

interface ContractFileSentList {
  contractId: string;
  sentFailCount: number;
}

class ContractFileSender {
  nodesHandler: NodesHandler;
  udpClient: Udp;

  contractFailures: ContractFileSentList[];

  constructor(nodesHandler: NodesHandler, udpClient: Udp, id: string) {
    this.nodesHandler = nodesHandler;
    this.udpClient = udpClient;

    this.contractFailures = [];

    cron.schedule("*/30 * * * * *", async () => {
      this.checkContractsWithoutFileSent();
      this.checkFailedAttempts();
    });
  }

  private checkContractsWithoutFileSent = async () => {
    const contractsWithoutFileSent = getContracts().filter((contract) => !contract.fileSent);
    if (contractsWithoutFileSent.length === 0) return;

    contractsWithoutFileSent.forEach((contract) => {
      const contractNode = this.nodesHandler.getNode(contract.contractNodeId);
      if (!contractNode) {
        logger.log(
          "warn",
          `CONTRACT FILE SENT - Error for ${sha1smallstr(contract.contractId)} - Can't find node ${
            contract.contractNodeId
          } for contract
          `
        );
        this.addFailureForContract(contract.contractId);
        return;
      }
      sendFile(
        contract,
        Number(contractNode.port) - 1,
        contractNode.ip,
        getFilePath(contract.fileName),
        this.onFileSentSuccess.bind(this),
        this.onFileSentError.bind(this)
      );
    });
  };

  private onFileSentSuccess = (contractId: string) => {
    logger.log("info", `CONTRACT FILE SEND - Successful for ${sha1smallstr(contractId)}`);
    setContractFileSent(contractId);
  };

  private onFileSentError = (contractId: string, err: Error) => {
    logger.log("warn", `CONTRACT FILE SEND ERROR: for ${sha1smallstr(contractId)} - Error: ${err}`);
    this.addFailureForContract(contractId);
  };

  private addFailureForContract = (contractId: string) => {
    const failures = this.contractFailures.find((c) => c.contractId === contractId);
    if (!failures) {
      this.contractFailures = [...this.contractFailures, { contractId, sentFailCount: 1 }];
    } else {
      this.contractFailures = this.contractFailures.map((c) => {
        if (c.contractId === contractId) {
          return { ...failures, sentFailCount: failures.sentFailCount + 1 };
        }
        return c;
      });
    }
  };

  private checkFailedAttempts = () => {
    const contractsWithTooManyfailures = this.contractFailures.reduce<string[]>((acc, cf) => {
      if (cf.sentFailCount >= 3) {
        removeContract(cf.contractId);
        this.contractFailures = this.contractFailures.filter((contract) => contract.contractId === cf.contractId);
        return [...acc, cf.contractId];
      }
      return acc;
    }, []);
    // Too many failures!!!
    if (contractsWithTooManyfailures.length > 1) {
      contractsWithTooManyfailures.forEach((contractId) => {
        logger.log("error", `REMOVE CONTRACT ${sha1smallstr(contractId)} - Reason: 3 failures to send file.`);
      });
    }
  };
}

export default ContractFileSender;
