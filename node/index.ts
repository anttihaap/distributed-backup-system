import contractManager from './contractManager';

import readline from 'readline';
import Tracker from './services/tracker';
import tcpServer from './services/tcpServer';
import tcpClient from './services/tcpClient';
import udp from './services/udp';
const uuid = require('uuid')

const udpIn = parseInt(process.env.UDP_PORT || "fail")
//const tcpServerPort = parseInt(process.env.TCP_SERVER_PORT || "fail")
//const tcpClientPort = parseInt(process.env.TCP_CLIENT_PORT || "fail")
const localNodeId = parseInt(process.env.LOCAL_NODE_ID || "fail");
const id: string = process.env.NODE_ID || uuid.v4();


// Subscribe to tracker service
const tracker = new Tracker(id, udpIn)

const cm = new contractManager(tracker, udpIn, id, localNodeId)

// Set up UDP client process (listens to port udpIn)
//const udpClient = new udp(udpIn, tracker)

// TCP Client and Server are not needed until backup nodes are selected and direct communication begins?
// Set up TCP Server
/*
const port = tcpServerPort;
const host = '127.0.0.1';
tcpServer.startServer(port, host);
*/

/*
// Set up TCP Client
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
