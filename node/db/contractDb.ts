import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import { getLocalId } from "../config";
import path from "path";

import { Contract, ContractCandidate, File, ContractDb } from "../types";

import { getFileNames, addContractForFile, fileExistsInDb, getFileNameContractCount } from "./fileDb";

import logger from "../util/logger";

const localNodeId = getLocalId();
const contractDb = new JsonDB(new Config("./files_db/contractDb_" + localNodeId, true, true, "/"));

const fileNameWithLeastContracts = async () => {
  const files = await getFileNames();
  const fileWithLeastContracts = files.reduce<{ fileName: string; count: number }>(
    (acc, currFileName) => {
      const currCount = getFileNameContractCount(currFileName);
      if (currCount < acc.count) {
        return { fileName: currFileName, count: currCount };
      }
      return acc;
    },
    { fileName: "", count: Number.MAX_VALUE }
  );
  return fileWithLeastContracts.fileName;
};

export const getReceivedContractFilePath = (contractId: string) => {
  return path.resolve(`./files_contract/${localNodeId}_${contractId}`);
};

export const addContract = async (contractCandidate: ContractCandidate) => {
  const fileName = await fileNameWithLeastContracts()
  const fileFound = fileExistsInDb(fileName);
  if (!fileFound) {
    logger.log(
      "error",
      `ADD CONTRACT - Can't add contract ${contractCandidate.contractId} file ${fileName} doesn't exist.`
    );
    throw "File not in file db";
  }

  const contract = {
    fileName: fileName,
    fileSent: false,
    contractId: contractCandidate.contractId,
    contractNodeId: contractCandidate.contractNodeId,
  } as Contract;
  contractDb.push("/" + contract.contractId, contract);

  addContractForFile(fileName, contract.contractId);
};

export const setContractFileSent = (contractId: string) => {
  try {
    const contract = contractDb.getData("/" + contractId) as Contract;
    contractDb.push("/" + contractId, {
      ...contract,
      fileSent: true,
      fileSendingInProgress: false,
    } as Contract);
  } catch (_) {
    logger.log("error", `SET CONTRACT FILE SENT - Contract ${contractId} doesn't exist.`);
    throw "Trying to set file sent for contract that doesn't exist. Id: " + contractId;
  }
};

export const getContract = (contractId: string): Contract | undefined => {
  try {
    const contract = contractDb.getData("/" + contractId);
    return contract;
  } catch (_) {
    return undefined;
  }
};

export const getContracts = (): Contract[] => {
  const contractDbData = contractDb.getData("/") as ContractDb;
  return Object.entries(contractDbData).reduce<Contract[]>((acc, [_, contract]) => [...acc, contract], []);
};
