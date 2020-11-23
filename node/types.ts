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
  [test: string]: Contract;
}

export interface ContractCandidate {
  creationTime: number;
  pingCount: number;
  contractId: string;
  contractNodeId: string;
  contractNodePort: number;
  contractNodeAddress: string;
}

export interface Contract {
  contractId: string;
  contractNodeId: string;
  contractNodePort: number;
  contractNodeAddress: string;
  file: File;
}


interface FileManager {}
