/*
import contractManager from './contractManager';
const cm = new contractManager()
console.log(cm.getFilesWithoutContract())


import readline from 'readline';
import tracker from './services/tracker';
import tcpServer from './services/tcpServer';
import tcpClient from './services/tcpClient';
import udp from './services/udp';
*/

import crypto from 'crypto'
import Peer from './peer'

const udpIn = Number(process.argv[2]);
const host = 'localhost'
/*
const tcpServerPort = Number(process.argv[3]);
const tcpClientPort = Number(process.argv[4]);    // For testing, pending better implementation...
const id = process.argv[5];
*/

// args: [2]: own port, [3]: remote host, [4]: remote port (TESTING: [5] id)

// Create peer node
const createFirstPeerNode = (port: number) => {
  const hash = crypto.createHash('sha1').update(`localhost:${udpIn}`).digest('hex')     
  //const idTest = process.argv[3]
  const peer = new Peer(hash, 'localhost', port);
  const name = peer.getId();
  console.log('First node:', name)
}

const createPeerNode = (port: number, connectToHost: string, connectToPort: number) => {
  const hash = crypto.createHash('sha1').update(`localhost:${port}`).digest('hex')
  //const idTest = process.argv[5]
  const peer = new Peer(hash, 'localhost', port);
  const name = peer.getId();
  const joinMessage = `JOIN:${name}:${host}:${udpIn}`
  peer.udpClient.sendUdpMessage(joinMessage, connectToPort, connectToHost)
}

if (process.argv.length == 3) {                                                                               /// TEST === 4
  console.log('Creating first node: localhost', udpIn);
  createFirstPeerNode(udpIn);
} else {
  console.log('Joining to node', process.argv[3], Number(process.argv[4]))
  createPeerNode(udpIn, process.argv[3], Number(process.argv[4]));
}

/*
// Subscribe to tracker service
// TODO: /ping
tracker.subscribe(udpIn, id)

// Set up UDP client process (listens to port udpIn)
const udpClient = new udp(udpIn, tracker)

// TCP Client and Server are not needed until backup nodes are selected and direct communication begins?
// Set up TCP Server
const port = tcpServerPort;
const host = '127.0.0.1';
tcpServer.startServer(port, host);


// Set up TCP Client
const clientPort: number = tcpClientPort;
const clientHost = '127.0.0.1';
tcpClient.startClient(clientPort, clientHost);


// Test tcpClient
const setUpTcpClientAndSendHello = () => {
  const clientPort: number = tcpClientPort;
  const clientHost = '127.0.0.1';
  tcpClient.startClient(clientPort, clientHost);
}

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
        setUpTcpClientAndSendHello();
        break;
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

*/
