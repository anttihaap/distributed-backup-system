import { PeerNode } from './types';

class Peer {
  id: string;
  ip: string;
  port: number;
  peerList: Peer[] = [];  
  
  constructor(id: string, ip: string, port: number ) {
    this.id = id;
    this.ip = ip;
    this.port = port;
  }

  getId() {
    return this.id
  }

  getNodeInfo(): PeerNode {
    return { id: this.id, ip: this.ip, port: this.port, peerList: this.peerList }
  }

  addPeer(peer: Peer) {
    this.peerList.push(peer)
  }

}

export default Peer
