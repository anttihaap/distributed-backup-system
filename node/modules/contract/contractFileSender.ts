import cron from "node-cron";
import { Logger } from "winston";

import { NodesHandler } from "../../types";
import Udp from "../../services/udp";
import FileManager from "../../fileManager";
import { sendFile } from "../../services/tcpClient";
import { sha1smallstr } from "../../util/hash";

interface ContractFileSentList {
  contractId: string;
  sentFailCount: number;
}

class ContractFileSender {
  nodesHandler: NodesHandler;
  udpClient: Udp;
  fm: FileManager;
  logger: Logger;

  contractFailures: ContractFileSentList[];

  constructor(nodesHandler: NodesHandler, udpClient: Udp, id: string, fm: FileManager, logger: Logger) {
    this.nodesHandler = nodesHandler;
    this.udpClient = udpClient;
    this.fm = fm;
    this.logger = logger;

    this.contractFailures = [];

    cron.schedule("*/30 * * * * *", async () => {
      this.checkContractsWithoutFileSent();
      this.checkFailedAttempts();
    });
  }

  private checkContractsWithoutFileSent = async () => {
    const contractsWithoutFileSent = this.fm
      .getContracts()
      .filter((contract) => !contract.fileSent && !contract.fileSendingInProgress);
    if (contractsWithoutFileSent.length === 0) return;

    contractsWithoutFileSent.forEach((contract) => {
      const contractNode = this.nodesHandler.getNode(contract.contractNodeId);
      if (!contractNode) {
        // TODO!!!!
        this.logger.log(
          "warn",
          `CONTRACT PROOF - Can't send proof. Can't find node ${contract.contractNodeId} for contract ${sha1smallstr(
            contract.contractId
          )}`
        );
        return;
      }
      sendFile(
        contract,
        Number(contractNode.port) - 1,
        contractNode.ip,
        this.fm.getFilePath(contract.file.name),
        this.onFileSentSuccess.bind(this),
        this.onFileSentError.bind(this)
      );
    });
  };

  private onFileSentSuccess = (contractId: string) => {
    this.logger.log("info", `CONTRACT FILE SEND - Successful for ${sha1smallstr(contractId)}`);
    this.fm.setContractFileSent(contractId);
  };

  private onFileSentError = (contractId: string, err: Error) => {
    this.logger.log("warn", `CONTRACT FILE SEND - ERROR for ${sha1smallstr(contractId)} - Error: ${err}`);
    const failures = this.contractFailures.find((c) => c.contractId === contractId);
    if (!failures) {
      this.contractFailures = [...this.contractFailures, { contractId, sentFailCount: 1 }];
    } else {
      this.contractFailures = this.contractFailures.map((c) => {
        if (c.contractId === contractId) {
          return failures;
        }
        return c;
      });
    }
  };

  private checkFailedAttempts = () => {
    const contractsWithTooManyfailures = this.contractFailures.reduce<string[]>((acc, cf) => {
      if (cf.sentFailCount >= 3) {
        return [...acc, cf.contractId];
      }
      return acc;
    }, []);
    // Too many failures!!!
    if (contractsWithTooManyfailures.length > 1) {
      this.logger.log("warn", "TOO MANY FAILURES FOR SENDING FILE. TODO SOMETHING.");
    }
  };
}

export default ContractFileSender;
