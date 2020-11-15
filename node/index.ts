/*
import contractManager from './contractManager';
const cm = new contractManager()
console.log(cm.getFilesWithoutContract())
*/

const readline = require('readline');
const dgram = require('dgram');
const udpClient = dgram.createSocket('udp4');
const net = require('net');
const axios = require('axios'); // for http requests


const udpIn = process.argv[2];
const udpOut = process.argv[3];
const tcpServerPort = process.argv[4];
const tcpClientPort = process.argv[5];    // For testing, pending better implementation...
const id = process.argv[6];

const trackerIp = 'http://localhost:3000';
let nodeList = {};

// Start a new node: node index.js <udpIn> <udpOut> <tcpIn> <tcpOut> <nodeId>

// Subscribe to tracker
axios
  .post(`${trackerIp}/subscribe`, {
    port: udpIn,
    nodeId: id,
  })
  .then((res: any) => {
    console.log(`Tracker responded with status code: ${res.status}`);

  })
  .catch((error: any) => {
    console.error(error)
  })

// Fetch nodes from tracker
axios.get(`${trackerIp}/nodes`)
  .then((res: any) => {
    const response = JSON.stringify(res.data);
    console.log(`NODES: ${response}`);

    nodeList = response;
  })


// Set up UDP client process (listens to port udpIn, sends to port(s) udpOut)
// TODO: send to nodeList
udpClient.bind({
    address: 'localhost',
    port: udpIn,
  });

udpClient.on('message', (msg: any, info: any) => {
    console.log('Received message :' + msg.toString());
    console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);    
});

const sendUdpMessage = (message: any) => {
    udpClient.send(message, 0, message.length, udpOut, 'localhost', (error: any) => {
    
        if(error) {
            console.log('ERROR');
            udpClient.close();
        } else {
            console.log('Sent message: ' + message.toString());
        }
    });
}

// Set up TCP Server
const port = tcpServerPort;
const host = '127.0.0.1';

const server = net.createServer();
server.listen(port, host, () => {
    console.log(`Server started on ${host}:${port}`);
})

server.on('connection', (socket: any) => {
  console.log(`New connection to ${socket.remotePort}`);

  socket.on('data', (data: any) => {
      console.log(`Client msg: ${data}`);
      socket.write('Server received your message: ' + data.toString())
  });

  socket.on('close', () => {
      console.log(`Client on port ${socket.remotePort} closed the connection.`);
  });

  socket.on('error', (error: any) => {
      console.error(`Something went wrong: ${error}`);
  });
})

// Set up TCP Client
// When starting the first client, connection fails because a server does not exist yet.
// Node logic not implemented yet -> tcp client (and server) can be set up when needed.

const clientPort = tcpClientPort;
const clientHost = '127.0.0.1';

const client = new net.Socket();

client.connect(clientPort, clientHost, () => {
    console.log(`Connected to server on ${clientHost}:${clientPort}`);
    client.write('Hello world!');
})

client.on('data', (data: any) => {
    console.log(`Server says : ${data} `);

});

client.on('close', () => {
    console.log('Connection closed');

});

client.on('error', (error: any) => {
    console.error(`Connection error ${error}`);
});

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
      default:
        const message = Buffer.from(line);
        sendUdpMessage(message);
        break;
    }
    rl.prompt();

  }).on('close', () => {
    console.log('Have a great day!');
    process.exit(0);
  });
