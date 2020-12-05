import axios from "axios"; // for http requests
import cron from "node-cron";
import { NodesHandler } from "../types";
import { Node } from '../types'

const trackerIp = "http://localhost:3000";

class Tracker implements NodesHandler {
  id: string;
  updIn: number;
  contractRequest: boolean;
  nodes: Node[];

  constructor(id: string, updIn: number, tcpIn: number) {
    this.id = id;
    this.updIn = updIn;
    this.contractRequest = false;
    this.nodes = [];

    console.log("TMP NODE ID", this.id)

    axios
      .post(`${trackerIp}/subscribe`, {
        port: updIn,
        nodeId: id,
        tcpPort: tcpIn,
      })
      .then((res: any) => {
        console.log(`Tracker responded with status code: ${res.status}`);
      })
      .catch((error: any) => {
        throw error;
      });

    this.fetchNodes();
    cron.schedule("*/10 * * * * *", async () => {
      this.fetchNodes();
    });

    cron.schedule("*/5 * * * * *", async () => {
      axios.post(`${trackerIp}/ping`, {
        port: this.updIn,
        nodeId: this.id,
        tcpPort: tcpIn,
        contractRequest: !!this.contractRequest,
      });
    });
  }

  fetchNodes = async () => {
    const res = await axios.get(`${trackerIp}/nodes`);
    this.nodes = res.data;
  };

  setRequestingContracts = (bool: boolean) => {
    this.contractRequest = bool;
  };

  getRequestingContracts = (): boolean => this.contractRequest;

  getNodes = (): Node[] => {
    return this.nodes;
  };

  getNode = (nodeId: string): Node | undefined => {
    return this.nodes.find(node => node.nodeId === nodeId)
  }
}

export default Tracker;
