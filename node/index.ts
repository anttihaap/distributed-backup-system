import crypto from "crypto";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import { getRequiredEnvVar, getOptionalEnvVar } from "./util/env";
import { getLocalNodeConfig, getGeneralConfig, getLocalId } from "./config";
import logger from "./util/logger";

import { NodesHandler } from "./types";

import Tracker from "./services/tracker";
import UdpClient from "./services/udp";
import TcpServer from "./services/tcpServer";
import FileManager from "./fileManager";
import ContractManager from "./contractManager";
import Peer from "./peer";

// TODO: lets use this for now?
const host = "localhost";

const generalClientConfig = getGeneralConfig();
const localClientConfig = getLocalNodeConfig();
const localClientNodeIdDb = new JsonDB(new Config("./files_db/localClientNodeIdDb" + getLocalId(), true, true, "/"));

const getClientHash = (): string => {
  try {
    const id = localClientNodeIdDb.getData("/" + getLocalId());
    console.log(`Using saved node id: ${id}`);
    return id;
  } catch (err) {
    const id = crypto.createHash("sha1").update(`${host}:${localClientConfig.port}`).digest("hex").slice(0, 6);
    console.log(`Create new node id: ${id}`);
    localClientNodeIdDb.push("/" + localClientConfig.id, id);
    return id;
  }
};

const nodeId = getClientHash();

const udpClient = new UdpClient(localClientConfig.port);

const getNodeHandler = (): NodesHandler => {
  if (generalClientConfig.useTracker) {
    return new Tracker(nodeId, localClientConfig.port, localClientConfig.port - 1);
  } else {
    return getPeerNodeHandler();
  }
};

const getPeerNodeHandler = () => {
  //
  // Create peer node
  const createFirstPeerNode = (port: number) => {
    const peer = new Peer(nodeId, "localhost", port, udpClient);
    const name = peer.getId();
    logger.info("Created the first node")
    return peer;
  };

  const createPeerNode = (port: number, connectToHost: string, connectToPort: number) => {
    const peer = new Peer(nodeId, "localhost", port, udpClient);
    const name = peer.getId();
    const joinMessage = `JOIN:${name}:${host}:${localClientConfig.port}`;
    peer.udpClient.sendUdpMessage(joinMessage, connectToPort, connectToHost);
    logger.info(`NETWORK - Sent JOIN to ${connectToHost}:${connectToPort}`);
    return peer;
  };

  if (localClientConfig.connectionPeerHost && localClientConfig.connectionPeerPort) {
    console.log("Joining to node", localClientConfig.connectionPeerHost, localClientConfig.connectionPeerPort);
    return createPeerNode(localClientConfig.port, localClientConfig.connectionPeerHost, localClientConfig.connectionPeerPort);
  } else {
    console.log("Creating first node: localhost", localClientConfig.port);
    return createFirstPeerNode(localClientConfig.port);
  }
};

const nodeManager = getNodeHandler();
const fm = new FileManager(nodeManager);
const cm = new ContractManager(nodeManager, udpClient, nodeId);

const ts = new TcpServer(localClientConfig.port - 1, host);
