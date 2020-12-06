import path from "path";
import fs from "fs";
import { getRequiredEnvVar } from "./util/env";

const localNodeId = Number(getRequiredEnvVar("LOCAL_NODE_ID"));

const rawConfig = fs.readFileSync(path.resolve("config.json"));
const config = JSON.parse(rawConfig.toString());

interface GeneralConfig {
  useTracker: boolean;
}

interface LocalNodeConfig {
  id: string;
  port: number;
  connectionPeerHost?: string;
  connectionPeerPort?: number;
}

export const getLocalId = (): number => {
  return localNodeId;
}

export const getAmountOfContractsPerFile = (): number => {
  if (config.amountOfContractsPerFile === undefined) {
    throw "Add amountOfContractsPerFile to config";
  }
  return config.amountOfContractsPerFile;
}

export const getGeneralConfig = () => {
  if (config.useTracker === undefined) {
    throw "Add useTracker to config";
  }
  return { useTracker: config.useTracker } as GeneralConfig;
};

export const getLocalNodeConfig = () => {
  console.log(config);
  if (config.localNodes === undefined) {
    throw "Add localNodes to config";
  }
  if (!Array.isArray(config.localNodes)) {
    throw "Config localNodes needs to be an array";
  }
  const localNodeConfig = config.localNodes.find((n: any) => n.id === localNodeId);
  if (!localNodeConfig) {
    throw "Missing local node config for id: " + localNodeId;
  }

  return localNodeConfig as LocalNodeConfig;
};
