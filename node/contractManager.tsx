import { File, FileDbItem, ContractDb, Contract } from "./types";
import cron from "node-cron";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import path from "path";
import fs from "fs";
import util from "util";

class ContractManager {
  contractDb: any;
  fileDb: any;

  constructor() {
    this.contractDb = new JsonDB(new Config("contractDb", true, true, "/"));
    this.fileDb = new JsonDB(new Config("fileDb", true, true, "/"));

    cron.schedule("*/5 * * * * *", async () => {
      this.syncFiles();
    });
  }

  getContracts(): ContractDb {
    return this.contractDb.getData("/") as ContractDb;
  }

  getFilesWithoutContract(): File[] {
    const files = [];
    for (const [_, value] of Object.entries(this.fileDb.getData("/"))) {
      const {file, contract} = value as FileDbItem
      if (!contract) {
        files.push(file)
      }
    }
    return files
  }

  addContract(contractId: String, contractNodeId: String, file: File) {
    try {
      this.fileDb.getData("/" + file.name);
    } catch (_) {
      throw "File not in file db";
    }

    const contract = {
      file,
      contractId,
      contractNodeId,
    } as Contract;
    this.contractDb.push("/" + contractId, contract);
    this.fileDb.push("/" + file.name + "/contract", contract);
  }

  private readFiles = async () => {
    const dirPath = path.resolve("./files");
    const files = util.promisify(fs.readdir)(dirPath);
    return files;
  };

  private fileSize = (fileName: string): Number => {
    const filePath = path.resolve("./files/" + fileName);
    return fs.statSync(filePath).size
  }

  syncFiles = async () => {
    const files = await this.readFiles();
    files.forEach((fileName: any) => {
      try {
        this.fileDb.getData("/" + fileName);
      } catch {
        const newFileDbItem = {
          file: {
            name: fileName,
            size: this.fileSize(fileName)
          },
          contract: null

        } as FileDbItem;
        this.fileDb.push("/" + fileName, newFileDbItem)
      }
    });
  };
}

export default ContractManager;
