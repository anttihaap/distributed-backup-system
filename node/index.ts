/*
import contractManager from './contractManager';
const cm = new contractManager()
console.log(cm.getFilesWithoutContract())
*/

import readline from 'readline';
import tracker from './services/tracker';
import tcpServer from './services/tcpServer';
import tcpClient from './services/tcpClient';
import udp from './services/udp';

import Peer from './peer'

const udpIn = Number(process.argv[2]);
//const tcpServerPort = Number(process.argv[3]);
//const tcpClientPort = Number(process.argv[4]);    // For testing, pending better implementation...
//const id = process.argv[5];

// Subscribe to tracker service
// TODO: /ping
//tracker.subscribe(udpIn, id)

// Set up UDP client process (listens to port udpIn)
const udpClient = new udp(udpIn, tracker)

// peer
import crypto from 'crypto'
const hash = crypto.createHash('sha256').update(`localhost:${udpIn}`).digest('hex')
const peer = new Peer(hash, 'localhost', udpIn);
const name = peer.getId();
console.log('I am', name);

const hash2 = crypto.createHash('sha256').update(`localhost:8888`).digest('hex')
const peer2 = new Peer(hash2, 'localhost', 8888)
peer.addPeer(peer2);
const info = peer.getNodeInfo();
console.log('INFO', info)


/*
// TCP Client and Server are not needed until backup nodes are selected and direct communication begins?
// Set up TCP Server
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
/*
// Test tcpClient
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
      //case 'tcp':
      //  setUpTcpClientAndSendHello();
      //  break;
      default:
        const message = Buffer.from(line);
        udpClient.sendUdpMessageToAll(message);
        break;
    }
    rl.prompt();

  }).on('close', () => {
    console.log('Have a great day!');
    process.exit(0);
  });
