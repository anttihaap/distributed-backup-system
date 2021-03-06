import cron from "node-cron";
import { Logger } from "winston";
import { getAmountOfContractsWanted, getFileNames, fileExistsInDb, fileSize, addFileWithoutContract } from "./db/fileDb"

import { NodesHandler } from "./types";

import logger from "./util/logger";
import { getAmountOfContractsPerFile } from "./config";

class FileManager {
  nodeHandler: NodesHandler;
  logger: Logger;

  constructor(nodeHandler: NodesHandler) {
    this.nodeHandler = nodeHandler;
    this.logger = logger;

    this.syncFiles();
    cron.schedule("*/5 * * * * *", async () => {
      this.syncFiles();
    });
  }

  syncFiles = async () => {
    const files = await getFileNames();
    files.forEach((fileName: string) => {
      if (!fileExistsInDb(fileName)) {
        this.logger.log("info", `ADD file ${fileName} to db`)
        addFileWithoutContract(fileName, fileSize(fileName))
      }
    });
    const shouldContactRequest = getAmountOfContractsWanted() > 0;
    if (this.nodeHandler.getRequestingContracts() !== shouldContactRequest) {
      this.logger.log("info", `SET is requesting contracts: ${shouldContactRequest}`);
      this.nodeHandler.setRequestingContracts(getAmountOfContractsWanted() > 0);
    }
  };
}

export default FileManager;
