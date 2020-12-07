import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import path from "path";
import fs from "fs";
import util from "util";

import { File, FileDbItem, FilesDb } from "../types";

import { getLocalId, getAmountOfContractsPerFile } from "../config";
import logger from "../util/logger";
const localNodeId = getLocalId();

const amountOfContractsPerFile = getAmountOfContractsPerFile();

const fileDb = new JsonDB(new Config("./files_db/fileDb_" + localNodeId, true, true, "/"));

export const getFilePath = (fileName: string) => {
  return path.resolve(`./files/${localNodeId}/${fileName}`);
};

const readFileNames = async () => {
  const dirPath = path.resolve(`./files/${localNodeId}`);
  const files = util.promisify(fs.readdir)(dirPath);
  return files;
};

export const fileSize = (fileName: string): number => {
  const filePath = getFilePath(fileName)
  return fs.statSync(filePath).size;
};

export const getFileNames = async () => {
  return await readFileNames();
};

export const removeContractFromFile = async (contractId: string, fileName: string) => {
  const file = fileDb.getData("/" + fileName) as FileDbItem;
  const updatedFileContracts = file.contracts.filter((c) => c !== contractId);
  fileDb.push("/" + fileName, { ...file, contracts: updatedFileContracts });
};

export const getFileNameContractCount = (fileName: string) => {
  try {
    const file = fileDb.getData("/" + fileName) as FileDbItem;
    return file.contracts.length;
  } catch (_) {
    logger.log("error", "File does not exist");
    throw "File does not exist";
  }
};


export const addContractForFile = (fileName: string, contractId: string) => {
  const data = fileDb.getData("/" + fileName) as FileDbItem;
  fileDb.push("/" + fileName, { ...data, contracts: [...data.contracts, contractId] });
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
    contracts: [],
  } as FileDbItem);
};

export const getAmountOfContractsWanted = (): number => {
  const test = fileDb.getData("/") as FilesDb;
  return Object.entries(test).reduce<number>((acc, [currKey, currFile]) => {
    return acc + (amountOfContractsPerFile - currFile.contracts.length);
  }, 0);
};

export const existsFilesWithoutContract = (): boolean => {
  return getAmountOfContractsWanted() > 0;
};
