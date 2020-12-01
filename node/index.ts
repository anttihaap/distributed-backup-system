import crypto from "crypto";
import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import { getRequiredEnvVar, getOptionalEnvVar } from "./util";

import { NodesHandler } from "./types";

import Tracker from "./services/tracker";
import UdpClient from "./services/udp";
import FileManager from "./fileManager";
import ContractNegotiator from "./contractNegotiator";
import ContractManager from "./contractManager";
import Peer from "./peer";

const localNodeId = Number(getRequiredEnvVar("LOCAL_NODE_ID"));

// TODO!
//const tcpServerPort = Number(getRequiredEnvVar("TCP_SERVER_PORT"));
//const tcpClientPort = Number(getRequiredEnvVar("TCP_CLIENT_PORT"));

const connectPeerHost = getOptionalEnvVar("CONNECT_PEER_HOST");
const connectPeerPort = Number(getOptionalEnvVar("CONNECT_PEER_PORT"));
// TODO: lets use this for now?
const useTracker = false;

const host = "localhost";

interface ClientConf {
  id: string;
  udpIn: number;
  host: string;
}

const clientConfigDb = new JsonDB(new Config("./db/clientConfigDb_" + localNodeId, true, true, "/"));

const getClientConf = (): ClientConf => {
  try {
    const clientConf = clientConfigDb.getData("/" + localNodeId);
    console.log('Fetching local client configuration from db.')
    return clientConf;
  } catch (err) {
    console.log('Save local client configuraiton to db.')
    const udpIn = Number(getRequiredEnvVar("UDP_PORT"));
    const id = crypto.createHash("sha1").update(`${host}:${udpIn}`).digest("hex");
    const newClientConf = {
      id: id,
      host: host,
      udpIn: udpIn,
    };
    clientConfigDb.push("/" + localNodeId, newClientConf);
    return newClientConf;
  }
};

const clientConf = getClientConf();

const udpClient = new UdpClient(clientConf.udpIn);

const getNodeHandler = (): NodesHandler => {
  if (useTracker) {
    // TODO THIS PART!
    return new Tracker(clientConf.id, clientConf.udpIn, 123);
  } else {
    return getPeerNodeHandler();
  }
};

const getPeerNodeHandler = () => {
  // Create peer node
  const createFirstPeerNode = (port: number) => {
    const peer = new Peer(clientConf.id, "localhost", port, udpClient);
    const name = peer.getId();
    console.log("First node:", name);
    return peer;
  };

  const createPeerNode = (port: number, connectToHost: string, connectToPort: number) => {
    //const idTest = process.argv[5]
    const peer = new Peer(clientConf.id, "localhost", port, udpClient);
    const name = peer.getId();
    const joinMessage = `JOIN:${name}:${host}:${clientConf.udpIn}`;
    peer.udpClient.sendUdpMessage(joinMessage, connectToPort, connectToHost);
    return peer;
  };

  if (connectPeerHost && connectPeerPort) {
    /// TEST === 4
    console.log("Joining to node", connectPeerHost, connectPeerPort);
    return createPeerNode(clientConf.udpIn, connectPeerHost, connectPeerPort);
  } else {
    console.log("Creating first node: localhost", clientConf.udpIn);
    return createFirstPeerNode(clientConf.udpIn);
  }
};

// TODO!
const nodeManager = getNodeHandler();

// Comment these if only testing peer network:
const fm = new FileManager(nodeManager, localNodeId);
const cn = new ContractNegotiator(nodeManager, udpClient, clientConf.id, fm);
const cm = new ContractManager(nodeManager, udpClient, clientConf.id, fm);

/*
// Subscribe to tracker service
const tracker = new Tracker(id, udpIn, tcpIn)


const updClient = new udp(udpIn)

const tcpServer = new TcpServer(tcpIn, '127.0.0.1');


// Set up UDP client process (listens to port udpIn)
//const udpClient = new udp(udpIn, tracker)

// TCP Client and Server are not needed until backup nodes are selected and direct communication begins?
// Set up TCP Server
/*
*/

// Set up TCP Client
/*
const clientPort: number = tcpClientPort;
const clientHost = '127.0.0.1';
tcpClient.startClient(clientPort, clientHost);

*/

// Test tcpClient
/*
const setUpTcpClientAndSendHello = () => {
  const clientPort: number = tcpClientPort;
  const clientHost = '127.0.0.1';
  tcpClient.startClient(clientPort, clientHost);
}
*/

// Testing udp messages: read input from cmd line and send an UDP message
/*
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.prompt();

rl.on('line', (line: any) => {
    switch (line.trim()) {
      case 'quit':
        process.exit(0);
        //break;
      case 'tcp':
        //setUpTcpClientAndSendHello();
        break;
      default:
        const message = Buffer.from(line);
        //udpClient.sendUdpMessageToAllContractRequest(message);
        break;
    }
    rl.prompt();

  }).on('close', () => {
    console.log('Have a great day!');
    process.exit(0);
  });

*/
