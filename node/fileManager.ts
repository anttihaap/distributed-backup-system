import cron from "node-cron";
import util from "util";
import path from "path";
import fs from "fs";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";

import { File, FileDbItem, ContractDb, Contract, ContractCandidate } from "./types";
import Tracker from "./services/tracker";

class FileManager {
  fileDb: any;
  contractDb: any;
  tracker: Tracker;

  constructor(tracker: Tracker, localNodeId: number) {
    this.fileDb = new JsonDB(new Config("./db/fileDb_" + localNodeId, true, true, "/"));
    this.contractDb = new JsonDB(new Config("./db/contractDb_" + localNodeId, true, true, "/"));
    this.tracker = tracker;

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
      throw "File not in file db";
    }

    const contract = {
      file,
      contractId: contractCandidate.contractId,
      contractNodeId: contractCandidate.contractNodeId,
      contractNodeAddress: contractCandidate.contractNodeAddress,
      contractNodePort: contractCandidate.contractNodePort
    } as Contract;
    this.contractDb.push("/" + contract.contractId, contract);
    this.fileDb.push("/" + file.name + "/contract", contract.contractId);
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

  getContracts(): Contract[] {
    return this.contractDb.getData('/') 
  }

  syncFiles = async () => {
    console.log("SYNC FILES");
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
    if (this.tracker.getContactRequest() !== shouldContactRequest) {
      console.log("SET is requesting contracts:", shouldContactRequest);
      this.tracker.setContractRequest(this.getFilesWithoutContract().length > 0);
    }
  };
}

export default FileManager;
