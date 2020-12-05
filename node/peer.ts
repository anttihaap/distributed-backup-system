import cron from 'node-cron';
import udp from './services/udp';
import { NodesHandler, Node } from './types';

class Peer implements NodesHandler {
  id: string;
  ip: string;
  port: number;
  predecessor: string = '';   // ID:HOST:PORT
  successor: string = '';     // ID:HOST:PORT
  udpClient: any;

  nodes: Node[];
  contractRequest: boolean;

  constructor(id: string, ip: string, port: number, udpClient: udp) {
    this.id = id;
    this.ip = ip;
    this.port = port;

    this.nodes = [];
    this.contractRequest = false;

    this.udpClient = udpClient;
    // udp address is automatically set to 'localhost' for all nodes in udp.ts

    // ping the whole nodeList with 10 sec intervals to keep node alive
    // -> could be improved with shorted lists, if thousands of nodes...
    // pinging frequently allows for a few dropped messages since TTL is 1 minute
    // TODO: find the best frequencies for pings and updates
    cron.schedule('*/10 * * * * *', () => {
      this.sendPing()
    })

    // Update nodeList every 1 minute (maybe this should be done more frequently?)
    cron.schedule('* * * * *', () => {

      // remove expired nodes
      const filteredNodes = this.nodes.filter(node => node.lastUpdate! + (60 * 1000) >= new Date().getTime())
      this.nodes = filteredNodes

      // Update successor node, if needed:
      let successorIdValue = parseInt(this.successor.split(':')[0], 16)
      const nodeIds = filteredNodes.map(n => parseInt(n.nodeId, 16))

      if (!nodeIds.includes(successorIdValue)) {
        const greaterThanThisList = nodeIds.filter(n => n > parseInt(this.id, 16))
        if (greaterThanThisList.length === 0) {       // jos ei suurempia -> valitse seuraajaksi pienin
          successorIdValue = Math.min(...nodeIds)
        } else {
          successorIdValue = Math.min(...greaterThanThisList)
        }

        const successorNode = this.nodes.find(n => n.nodeId === successorIdValue.toString(16))
        if (successorNode !== undefined) {
          const newSuccessor = `${successorNode.nodeId}:${successorNode.ip}:${successorNode.port}`
          this.addSuccessor(newSuccessor)
        }
      }
      // Update predecessor, if needed
      let predecessorIdValue = parseInt(this.predecessor.split(':')[0], 16)

      if (!nodeIds.includes(predecessorIdValue)) {
        const smallerThanThisList = nodeIds.filter(n => n < parseInt(this.id, 16))
        if (smallerThanThisList.length === 0) {
          predecessorIdValue = Math.max(...nodeIds)
        } else {
          predecessorIdValue = Math.max(...smallerThanThisList)
        }

        const predecessorNode = this.nodes.find(n => n.nodeId === predecessorIdValue.toString(16))
        if (predecessorNode !== undefined) {
          const newPredecessor = `${predecessorNode.nodeId}:${predecessorNode.ip}:${predecessorNode.port}`
          this.addPredecessor(newPredecessor)
        }
      }
      // Special case: a new node with the highest value id has joined -> update node with the smallest value id
      if (parseInt(this.id, 16) < Math.min(...nodeIds) && Math.max(...nodeIds) > predecessorIdValue) {
        const predecessorNode = this.nodes.find(n => parseInt(n.nodeId, 16) === Math.max(...nodeIds))
        if (predecessorNode !== undefined) {
        const newPredecessor = `${predecessorNode.nodeId}:${predecessorNode.ip}:${predecessorNode.port}`
        this.addPredecessor(newPredecessor)
        }
      }

      console.log('Updated nodelist', this.nodes)
      console.log('Predecessor: ', this.predecessor, 'Successor: ', this.successor)
    })

    // listen to and react to emitted messages (from udpClient)

    this.udpClient.on('join', (data: any) => {
      this.handleJoin(data.message)
    })

    this.udpClient.on('first_ack', (data: any) => {
      this.handleFirstAck(data.message)
    })

    this.udpClient.on('ack_join', (data:any) => {
      this.handleAck(data.message)
    })

    this.udpClient.on('notify', (data:any) => {
      this.handleNotify(data.message)
    })

    this.udpClient.on('ping', (data: any) => {
      this.handlePing(data.message)
    })

    this.udpClient.on('new_node', (data: any) => {
      this.handleNotifyNext(data.message)
    })
  }

  handleJoin(message: string) {
    const messageData = message.split(':')
    const peerId = messageData[1]
    const peerHost = messageData[2]
    const peerPort = messageData[3]

    const predecessorData = this.predecessor.split(':')
    const predecessorId = predecessorData[0]
    const predecessorIp = predecessorData[1]
    const predecessorPort = predecessorData[2]

    const successorData = this.successor.split(':')
    const successorId = successorData[0]
    const successorIp = successorData[1]
    const successorPort = successorData[2]

    const contractReq = false         // Will be updated after PINGs

    const newPeer = `${peerId}:${peerHost}:${peerPort}`

    if (this.nodes.length < 1) {                                   // the first node
      
      this.addPredecessor(newPeer)
      this.addSuccessor(newPeer)
      this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)

      // send ack --> the first pair is a special case, does not notify
      this.udpClient.sendUdpMessage(`FIRST_ACK:${this.id}:${this.ip}:${this.port}`, peerPort, peerHost)

      console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred:${this.predecessor} and succ:${this.successor} 1`)
    
    } else {

      const ackString = `ACK_JOIN:${this.id}:${this.ip}:${this.port}:${predecessorId}:${predecessorIp}:${predecessorPort}`
      
      // Found the place, this node is the predecessor
      if (parseInt(this.id, 16) > parseInt(peerId, 16) && parseInt(peerId, 16) > parseInt(predecessorId, 16)) {
        this.addPredecessor(newPeer)
        this.udpClient.sendUdpMessage(ackString, peerPort, peerHost)  
        this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)
      } 
      // Found the place, the ring started over
      else if (parseInt(this.id, 16) < parseInt(predecessorId, 16) && parseInt(peerId, 16) < parseInt(this.id, 16)) {
        this.addPredecessor(newPeer)
        this.udpClient.sendUdpMessage(ackString, peerPort, peerHost)
        this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)
      }
      // If joining with the highest id value
      else if (parseInt(peerId, 16) > parseInt(this.id, 16) && parseInt(peerId, 16) > parseInt(successorId, 16)
        && parseInt(this.id, 16) > parseInt(successorId, 16)) {
        const ackStringLast = `ACK_JOIN:${successorId}:${successorIp}:${successorPort}:${this.id}:${this.ip}:${this.port}`
        this.addSuccessor(newPeer)
        this.udpClient.sendUdpMessage(ackStringLast, peerPort, peerHost)
        this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)
      }
      // Special case: the third node joins
      else if (predecessorId === successorId && parseInt(peerId, 16) < parseInt(successorId, 16)) {        
        this.addSuccessor(newPeer)
        this.udpClient.sendUdpMessage(message, successorPort, successorIp)
        this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)
      }
      // Not the right place, send JOIN forward to predecessor
      else {
        this.udpClient.sendUdpMessage(message, successorPort, successorIp)
      }
      console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred: ${this.predecessor} and succ: ${this.successor}`)
    }
  }

  handleFirstAck(message: string) {                      // Don't send NOTIFY, set first peer
    const messageData = message.split(':')
    const peerId = messageData[1]
    const peerHost = messageData[2]
    const peerPort = messageData[3]

    const contractReq = false     // Will be updated after PINGs

    const newPeer = `${peerId}:${peerHost}:${peerPort}`

    this.addPredecessor(newPeer)
    this.addSuccessor(newPeer)
    this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)

    console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred: ${this.predecessor} and succ: ${this.successor}`)
  }

  handleAck(message: string) {
    const messageData = message.split(':')
    const peerId = messageData[1]
    const peerHost = messageData[2]
    const peerPort = messageData[3]
    const predecessorId = messageData[4]
    const predecessorHost = messageData[5]
    const predecessorPort = messageData[6]

    const contractReq = false     // Will be updated after PINGs

    const newPeer = `${peerId}:${peerHost}:${peerPort}`
    const newPredecessor = `${predecessorId}:${predecessorHost}:${predecessorPort}`

    this.addPredecessor(newPredecessor)
    this.addSuccessor(newPeer)
    this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)
    this.addNodeToNodeList(predecessorId, predecessorHost, predecessorPort, contractReq)

    const notifyPredecessorString = `NOTIFY:${this.id}:${this.ip}:${this.port}`
    this.udpClient.sendUdpMessage(notifyPredecessorString, predecessorPort, predecessorHost)

    console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred: ${this.predecessor} and succ: ${this.successor}`)

    const notifyAll = `NEW_NODE:${this.id}:${this.ip}:${this.port}`
    this.udpClient.sendUdpMessage(notifyAll, peerPort, peerHost)
  }

  handleNotify(message:string) {
    const messageData = message.split(':')
    const peerId = messageData[1]
    const peerHost = messageData[2]
    const peerPort = messageData[3]
    const contractReq = false         // Will be updated after PING received

    const newPeer = `${peerId}:${peerHost}:${peerPort}`

    this.addSuccessor(newPeer)
    this.addNodeToNodeList(peerId, peerHost, peerPort, contractReq)

    console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred: ${this.predecessor} and succ: ${this.successor}`)
  }

  sendPing() {
    this.nodes.forEach((peerNode) => {
      const pingString = `PING:${this.id}:${this.ip}:${this.port}:${this.contractRequest}`
      this.udpClient.sendUdpMessage(pingString, peerNode.port, peerNode.ip)
    })
  }

  handlePing(message: any) {
    // Update nodeList last pinged times
    const nodeIds = this.nodes.map(n => n.nodeId)
    const messageData = message.split(':')
    const nodeId = messageData[1]
    const contractReqString = messageData[4]

    const bool = (str: string) => {
      return str === 'true'
    }

    if (nodeIds.includes(nodeId)) {
    const updatedList = this.nodes.map(node => (node.nodeId === nodeId
      ? { ...node, contractRequest: bool(contractReqString), lastUpdate: new Date().getTime() } : node));
    this.nodes = updatedList

    } else {
      const messageData = message.split(':')
      this.addNodeToNodeList(messageData[1], messageData[2], messageData[3], bool(contractReqString))
    }
  }

  notifyNext(message: any) {
    const succHost = this.successor.split(':')[1]
    const succPort = this.successor.split(':')[2]
    this.udpClient.sendUdpMessage(message, succPort, succHost)
  }

  handleNotifyNext(message: any) {
    const messageData = message.split(':')
    const id = messageData[1]
    const host = messageData[2]
    const port = messageData[3]
    const contractReq = messageData[4]

    if (id === this.id) {
      console.log('CIRCLE COMPLETED; NOTIFIED ALL')
    } else {
      console.log('ADDING NEW NODE, PASSING THE MESSAGE TO SUCCESSOR')
      this.addNodeToNodeList(id, host, port, contractReq)
      this.notifyNext(message)
    }
  }

  getId() {
    return this.id
  }

  getNodes(): Node[] {
    return this.nodes
  }

  getNode = (nodeId: string): Node | undefined => {
    return this.nodes.find(node => node.nodeId === nodeId)
  }

  setRequestingContracts(bool: boolean) {
    this.contractRequest = bool;
  }

  getRequestingContracts() {
    return this.contractRequest;
  }

  addPredecessor(peer: string) {
    this.predecessor = peer;
  }

  addSuccessor(peer: string) {
    this.successor = peer;
  }

  // TODO: how to select tcp port number?
  addNodeToNodeList(id: string, ip: string, port: string, contractRequest: boolean) {
    const tcpPort = (parseInt(port) - 1).toString()

    const newPeerNode = {
      nodeId: id,
      ip: ip,
      port: port,
      tcpPort: tcpPort,
      contractRequest: contractRequest,
      lastUpdate: new Date().getTime()
    }
    const nodeIds = this.nodes.map(node => node.nodeId)
    if (!nodeIds.includes(id)) {
      this.nodes.push(newPeerNode);
    }
  }
}

export default Peer