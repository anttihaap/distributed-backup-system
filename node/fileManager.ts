import cron from "node-cron";
import util from "util";
import path from "path";
import fs from "fs";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import logger from "./util/logger";
import { File, FileDbItem, ContractDb, Contract, ContractCandidate, NodesHandler } from "./types";
import { getLocalId } from "./config";

class FileManager {
  localNodeId: number;
  fileDb: any;
  contractDb: any;
  nodeHandler: NodesHandler;

  constructor(nodeHandler: NodesHandler) {
    this.localNodeId = getLocalId();
    this.fileDb = new JsonDB(new Config("./files_db/fileDb_" + this.localNodeId, true, true, "/"));
    this.contractDb = new JsonDB(new Config("./files_db/contractDb_" + this.localNodeId, true, true, "/"));
    this.nodeHandler = nodeHandler;

    this.syncFiles();
    cron.schedule("*/5 * * * * *", async () => {
      this.syncFiles();
    });
  }

  private readFiles = async () => {
    const dirPath = path.resolve("./files");
    const files = util.promisify(fs.readdir)(dirPath);
    return files;
  };

  private fileSize = (fileName: string): Number => {
    const filePath = path.resolve("./files/" + fileName);
    return fs.statSync(filePath).size;
  };

  addContract(contractCandidate: ContractCandidate, file: File) {
    try {
      this.fileDb.getData("/" + file.name);
    } catch (_) {
      logger.log(
        "error",
        `ADD CONTRACT - Can't add contract ${contractCandidate.contractId} file ${file.name} doesn't exist.`
      );
      throw "File not in file db";
    }

    const contract = {
      file,
      fileSent: false,
      contractId: contractCandidate.contractId,
      contractNodeId: contractCandidate.contractNodeId,
    } as Contract;
    this.contractDb.push("/" + contract.contractId, contract);
    this.fileDb.push("/" + file.name + "/contract", contract.contractId);
  }

  setContractFileSent(contractId: string) {
    try {
      const contract = this.contractDb.getData("/" + contractId) as Contract;
      this.contractDb.push("/" + contractId, {
        ...contract,
        fileSent: true,
        fileSendingInProgress: false,
      } as Contract);
    } catch (_) {
      logger.log("error", `SET CONTRACT FILE SENT - Contract ${contractId} doesn't exist.`)
      throw "Trying to set file sent for contract that doesn't exist. Id: " + contractId;
    }
  }

  getFilesWithoutContract(): File[] {
    const files = [];
    for (const [_, value] of Object.entries(this.fileDb.getData("/"))) {
      const { file, contract } = value as FileDbItem;
      if (!contract) {
        files.push(file);
      }
    }
    return files;
  }

  existsFilesWithoutContract(): boolean {
    return this.getFilesWithoutContract().length > 0;
  }

  getFilePath = (fileName: string) => {
    return path.resolve("./files/" + fileName);
  };

  getReceivedContractFilePath = (contractId: string) => {
    return path.resolve(`./files_contract/${this.localNodeId}_${contractId}`);
  };

  /**
   * Convert database to a list.
   */
  getContracts(): Contract[] {
    const contractDbData = this.contractDb.getData("/") as ContractDb;
    return Object.entries(contractDbData).reduce<Contract[]>((acc, [_, contract]) => [...acc, contract], []);
  }

  getContract(contractId: string): Contract | undefined {
    try {
      const contract = this.contractDb.getData("/" + contractId);
      return contract;
    } catch (_) {
      return undefined;
    }
  }

  syncFiles = async () => {
    logger.log("info", "SYNC FILES");

    const files = await this.readFiles();
    files.forEach((fileName: any) => {
      try {
        this.fileDb.getData("/" + fileName);
      } catch {
        const newFileDbItem = {
          file: {
            name: fileName,
            size: this.fileSize(fileName),
          },
          contract: null,
        } as FileDbItem;
        this.fileDb.push("/" + fileName, newFileDbItem);
      }
    });
    const shouldContactRequest = this.getFilesWithoutContract().length > 0;
    if (this.nodeHandler.getRequestingContracts() !== shouldContactRequest) {
      logger.log("info", "SET is requesting contracts:", shouldContactRequest);
      this.nodeHandler.setRequestingContracts(this.getFilesWithoutContract().length > 0);
    }
  };
}

export default FileManager;
