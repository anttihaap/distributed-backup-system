import cron from 'node-cron';
import udp from './services/udp';
import { PeerNode } from './types';

/**
 * IF testing with manually entered id values (e.g. integers), remember to remove hex string (16) values
 * from parseInt() and toString() functions
 */

class Peer {
  id: string;
  ip: string;
  port: number;
  predecessor: string = '';   // ID:HOST:PORT
  successor: string = '';     // ID:HOST:PORT
  udpClient: any;
  nodeList: PeerNode[] = [];
  
  constructor(id: string, ip: string, port: number) {
    this.id = id;
    this.ip = ip;
    this.port = port;

    this.udpClient = new udp(this.port);
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
      const filteredNodes = this.nodeList.filter(node => node.lastPing + (60 * 1000) >= new Date().getTime())
      this.nodeList = filteredNodes
      
      // Update successor node, if needed:
      let successorIdValue = parseInt(this.successor.split(':')[0], 16)
      const nodeIds = filteredNodes.map(n => parseInt(n.id, 16))

      if (!nodeIds.includes(successorIdValue)) {
        const greaterThanThisList = nodeIds.filter(n => n > parseInt(this.id, 16))
        if (greaterThanThisList.length === 0) {       // jos ei suurempia -> valitse seuraajaksi pienin
          successorIdValue = Math.min(...nodeIds)
        } else {
          successorIdValue = Math.min(...greaterThanThisList)
        }
        
        const successorNode = this.nodeList.find(n => n.id === successorIdValue.toString(16))
        if (successorNode !== undefined) {
          const newSuccessor = `${successorNode.id}:${successorNode.ip}:${successorNode.port}`
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

        const predecessorNode = this.nodeList.find(n => n.id === predecessorIdValue.toString(16))
        if (predecessorNode !== undefined) {
          const newPredecessor = `${predecessorNode.id}:${predecessorNode.ip}:${predecessorNode.port}`
          this.addPredecessor(newPredecessor)
        }
      }
      // Special case: a new node with the highest value id has joined -> update node with the smallest value id
      if (parseInt(this.id, 16) < Math.min(...nodeIds) && Math.max(...nodeIds) > predecessorIdValue) {
        const predecessorNode = this.nodeList.find(n => parseInt(n.id, 16) === Math.max(...nodeIds))
        if (predecessorNode !== undefined) {
        const newPredecessor = `${predecessorNode.id}:${predecessorNode.ip}:${predecessorNode.port}`
        this.addPredecessor(newPredecessor)
        }
      }

      console.log('Updated nodelist', this.nodeList)
      console.log('Predecessor: ', this.predecessor, 'Successor: ', this.successor)
    })

    // listen to and react to emitted messages (from udpClient)

    this.udpClient.on('join', (data: any) => {
      this.handleJoin(data.port)
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

    const newPeer = `${peerId}:${peerHost}:${peerPort}`

    if (this.nodeList.length < 1) {                                   // the first node
      
      this.addPredecessor(newPeer)
      this.addSuccessor(newPeer)
      this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))

      // send ack --> the first pair is a special case, does not notify
      this.udpClient.sendUdpMessage(`FIRST_ACK:${this.id}:${this.ip}:${this.port}`, peerPort, peerHost)

      console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred:${this.predecessor} and succ:${this.successor} 1`)
    
    } else {

      const ackString = `ACK_JOIN:${this.id}:${this.ip}:${this.port}:${predecessorId}:${predecessorIp}:${predecessorPort}`
      
      // Found the place, this node is the predecessor
      if (parseInt(this.id, 16) > parseInt(peerId, 16) && parseInt(peerId, 16) > parseInt(predecessorId, 16)) {
        this.addPredecessor(newPeer)
        this.udpClient.sendUdpMessage(ackString, peerPort, peerHost)  
        this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))
      } 
      // Found the place, the ring started over
      else if (parseInt(this.id, 16) < parseInt(predecessorId, 16) && parseInt(peerId, 16) < parseInt(this.id, 16)) {
        this.addPredecessor(newPeer)
        this.udpClient.sendUdpMessage(ackString, peerPort, peerHost)
        this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))
      }
      // If joining with the highest id value
      else if (parseInt(peerId, 16) > parseInt(this.id), 16 && parseInt(peerId, 16) > parseInt(successorId, 16)
        && parseInt(this.id, 16) > parseInt(successorId, 16)) {
        const ackStringLast = `ACK_JOIN:${successorId}:${successorIp}:${successorPort}:${this.id}:${this.ip}:${this.port}`
        this.addSuccessor(newPeer)
        this.udpClient.sendUdpMessage(ackStringLast, peerPort, peerHost)
        this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))
      }
      // Special case: the third node joins
      else if (predecessorId === successorId && parseInt(peerId, 16) < parseInt(successorId, 16)) {        
        this.addSuccessor(newPeer)
        this.udpClient.sendUdpMessage(message, successorPort, successorIp)
        this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))
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

    const newPeer = `${peerId}:${peerHost}:${peerPort}`

    this.addPredecessor(newPeer)
    this.addSuccessor(newPeer)
    this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))

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

    const newPeer = `${peerId}:${peerHost}:${peerPort}`
    const newPredecessor = `${predecessorId}:${predecessorHost}:${predecessorPort}`

    this.addPredecessor(newPredecessor)
    this.addSuccessor(newPeer)
    this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))
    this.addNodeToNodeList(predecessorId, predecessorHost, parseInt(predecessorPort))

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

    const newPeer = `${peerId}:${peerHost}:${peerPort}`

    this.addSuccessor(newPeer)
    this.addNodeToNodeList(peerId, peerHost, parseInt(peerPort))

    console.log('\x1b[36m%s\x1b[0m', `I am ${this.id}, my peers are pred: ${this.predecessor} and succ: ${this.successor}`)
  }

  sendPing() {
    this.nodeList.forEach((peerNode) => {
      this.udpClient.sendUdpMessage(`PING:${this.id}:${this.ip}:${this.port}`, peerNode.port, peerNode.ip)
    })
  }

  handlePing(message: any) {
    // Update nodeList last pinged times
    const nodeIds = this.nodeList.map(n => n.id)
    const nodeId = message.split(':')[1]

    if (nodeIds.includes(nodeId)) {
    const updatedList = this.nodeList.map(node => (node.id === nodeId ? { ...node, lastPing: new Date().getTime() } : node));
    this.nodeList = updatedList

    } else {
      const messageData = message.split(':')
      this.addNodeToNodeList(messageData[1], messageData[2], messageData[3])
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

    if (id === this.id) {
      console.log('CIRCLE COMPLETED; NOTIFIED ALL')
    } else {
      console.log('ADDING NEW NODE, PASSING THE MESSAGE TO SUCCESSOR')
      this.addNodeToNodeList(id, host, port)
      this.notifyNext(message)
    }
  }

  getId() {
    return this.id
  }

  addPredecessor(peer: string) {
    this.predecessor = peer;
  }

  addSuccessor(peer: string) {
    this.successor = peer;
  }

  addNodeToNodeList(id: string, ip: string, port: number) {
    const newPeerNode = {
      id: id,
      ip: ip,
      port: port,
      lastPing: new Date().getTime()
    }
    const nodeIds = this.nodeList.map(node => node.id)
    if (!nodeIds.includes(id)) {
      this.nodeList.push(newPeerNode);
    }
  }
}

export default Peer
