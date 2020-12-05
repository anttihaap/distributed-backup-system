export interface Node {
  nodeId: string;
  ip: string;
  port: string;
  tcpPort: string;
  contractRequest: boolean;
  lastUpdate?: number;
}

export interface FileDbItem {
  file: File;
  contract: string | null;
}

export interface File {
  name: string;
  // Size in bytes
  size: Number;
}

export interface ContractDb {
  [nodeId: string]: Contract;
}

export interface ContractCandidate {
  creationTime: number;
  waitingAck: boolean;
  pingCount: number;
  contractId: string;
  contractNodeId: string;
  contractNodePort: number;
  contractNodeAddress: string;
}

export interface Contract {
  contractId: string;
  contractNodeId: string;
  file: File;
  fileSent: boolean;
  fileSendingInProgress: boolean;
}

export interface NodesHandler {
  getNodes: () => Node[];
  getNode: (id: string) => Node | undefined;
  setRequestingContracts: (bool: boolean) => void; 
  getRequestingContracts: () => boolean;
}


interface FileManager {}
