import dgram from 'dgram';
import { EventEmitter } from 'events';

class Udp extends EventEmitter {
  udpClient: any;
  port: number;

  constructor(udpIn: number) {
    super();
    this.port = udpIn;

    this.udpClient = dgram.createSocket("udp4");
    this.udpClient.bind({
      address: "localhost",
      port: udpIn,
    });
      
    this.udpClient.on('message', (msg: any, info: any) => {

      const message = msg.toString().split(':')
      const [command, data1, data2, data3] = message;
      const connectingNodePort = info.port;  // keep track when message is forwarded, message stays the same,
      const connectingNodeIp = info.address; // this is always the sender, joining node passed on in msg string

      switch (command) {
        case 'JOIN':
          this.emit('join', { port: connectingNodePort, ip: connectingNodeIp, message: msg.toString()})
          break;
        case 'ACK_JOIN':
          this.emit('ack_join', { message: msg.toString()}) // the joining node will receive this and then NOTIFY the new predecessor
          break;
        case 'NOTIFY':    // notify the new predecessor NOTIFY:ID:HOST:PORT
          this.emit('notify', { message: msg.toString() })
          break;
        case 'FIRST_ACK':
          this.emit('first_ack', {message: msg.toString()})
          break;
        case 'PING':
          this.emit('ping', {message: msg.toString()})
          break;
        case 'NEW_NODE':
          this.emit('new_node', {message: msg.toString()})
          break;
      case "CONTRACT_CREATE":
        this.emit("CONTRACT_CREATE", [data1, data2, data3], info);
        break;
      case "CONTRACT_CREATE_ACK":
        this.emit("CONTRACT_CREATE_ACK", [data1, data2, data3], info);
        break;
      case "CONTRACT_PING":
        this.emit("CONTRACT_PING", [data1, data2, data3], info);
        break;
      default:
          break;
      }
     // console.log('Received message:' + msg.toString());
     // console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);
    });
  }

  sendUdpMessage = (message: string, udpHostPort: number, host: string) => {
    this.udpClient.send(message, 0, message.length, udpHostPort, host, (error: any) => {
      if (error) {
        console.log("ERROR");
        this.udpClient.close();
      } else {
        //console.log('Sent message: ' + message.toString() + ' to ' + host + ':' + udpHostPort);
      }
    });
  }
}

export default Udp;
