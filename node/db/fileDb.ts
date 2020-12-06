import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import path from "path";
import fs from "fs";
import util from "util";

import { File, FileDbItem } from "../types";

import { getLocalId } from "../config";
const localNodeId = getLocalId();

const fileDb = new JsonDB(new Config("./files_db/fileDb_" + localNodeId, true, true, "/"));

const readFileNames = async () => {
  const dirPath = path.resolve("./files");
  const files = util.promisify(fs.readdir)(dirPath);
  return files;
};

export const fileSize = (fileName: string): number => {
  const filePath = path.resolve("./files/" + fileName);
  return fs.statSync(filePath).size;
};

export const getFileNames = async () => {
  return await readFileNames();
}

export const getFilePath = (fileName: string) => {
  return path.resolve("./files/" + fileName);
};

export const addContractForFile = (fileName: string, contractId: string) => {
  fileDb.push("/" + fileName + "/contract", contractId);
};

export const fileExistsInDb = (fileName: string): boolean => {
  try {
    fileDb.getData("/" + fileName);
    return true;
  } catch (_) {
    return false;
  }
};

export const addFileWithoutContract = (fileName: string, size: number) => {
  fileDb.push("/" + fileName, {
    fileName: fileName,
    contract: null,
  } as FileDbItem)
}

export const getFileNamesWithoutContract = (): string[] => {
  const files = [];
  for (const [_, value] of Object.entries(fileDb.getData("/"))) {
    const { fileName, contract } = value as FileDbItem;
    if (!contract) {
      files.push(fileName);
    }
  }
  return files;
};

export const existsFilesWithoutContract = (): boolean => {
  return getFileNamesWithoutContract().length > 0;
};
