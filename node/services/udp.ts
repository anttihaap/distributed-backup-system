import dgram from "dgram";
import Tracker from "./tracker";

class Udp {
  udpClient: any;
  tracker: Tracker;
  port: number;

  constructor(udpIn: number, tracker: any, onMessage: any) {
    this.tracker = tracker;
    this.port = udpIn;

    this.udpClient = dgram.createSocket("udp4");
    this.udpClient.bind({
      address: "localhost",
      port: udpIn,
    });

    this.udpClient.on("message", onMessage)
  }

  sendUdpMessage = (message: string, udpHostPort: number, host: string) => {
    this.udpClient.send(message, 0, message.length, udpHostPort, host, (error: any) => {
      if (error) {
        console.log("ERROR");
        this.udpClient.close();
      } else {
        console.log("Sent message: " + message.toString() + " to " + host + ":" + udpHostPort);
      }
    });
  };

  sendContractCreateToAll = async (nodeId: string) => {
    //TODO: send message only to nodes that want to create contracts
    const list = await this.tracker.getNodes()

    for (const node in list) {
      if (node != nodeId) {
        const { ip, port } = list[node]
        this.sendUdpMessage(`CONTRACT_CREATE;${node};${nodeId}`, port, ip)
      }
    }
  }

  sendUdpMessageToAllContractRequest = async (message: string) => {
    const listOfcontractRequest = await this.tracker.getNodes();
    //console.log(Object.values(listOfcontractRequest).filter(r => r. === 1));
    for (let node in listOfcontractRequest) {
      if (listOfcontractRequest[node].port != this.port) {
        this.sendUdpMessage(message, listOfcontractRequest[node].port, listOfcontractRequest[node].ip);
      }
    }
  };
}

export default Udp;
