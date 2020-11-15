import dgram from 'dgram';

class Udp {
  udpClient: any;
  tracker: any;
  port: number;

  constructor(udpIn: number, tracker: any) {
    this.tracker = tracker;
    this.port = udpIn;

    this.udpClient = dgram.createSocket('udp4')
    this.udpClient.bind({
      address: 'localhost',
      port: udpIn,
    });
      
    this.udpClient.on('message', (msg: any, info: any) => {
      console.log('Received message :' + msg.toString());
      console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);    
    });
  }

  sendUdpMessage = (message: any, udpHostPort: number, host: string) => {
    this.udpClient.send(message, 0, message.length, udpHostPort, host, (error: any) => {
      if(error) {
        console.log('ERROR');
        this.udpClient.close();
      } else {
        console.log('Sent message: ' + message.toString() + ' to ' + host + ':' + udpHostPort);
      }
    });
  }
  
  sendUdpMessageToAll = async (message: any) => {
    const list = await this.tracker.getNodes()
    for (let node in list) {
      console.log(node)
      if (list[node].port != this.port) {
        this.sendUdpMessage(message, list[node].port, list[node].ip)
      }
    }
  }
}

export default Udp
