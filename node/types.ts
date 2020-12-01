export interface FileDbItem {
  file: File;
  contract: Contract | null;
}

export interface File {
  name: string;
  // Size in bytes
  size: Number;
}

export interface ContractDb {
  [test: string]: Contract;
}

export interface Contract {
  contractId: string;
  contractNodeId: string;
  file: File;
}

export interface PeerNode {
  id: string;
  ip: string;
  port: number;
  lastPing: number;
  //peerList: any[];
}


interface FileManager {}
