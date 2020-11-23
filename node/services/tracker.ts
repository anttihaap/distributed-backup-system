import axios from "axios"; // for http requests
import cron from "node-cron";

const trackerIp = "http://localhost:3000";

interface Nodes {
  [nodeId: string]: any;
}

class Tracker {
  id: string;
  updIn: number;
  contractRequest: boolean;
  nodes: Nodes;

  constructor(id: string, updIn: number) {
    this.id = id;
    this.updIn = updIn;
    this.contractRequest = false;
    this.nodes = [];

    axios
      .post(`${trackerIp}/subscribe`, {
        port: updIn,
        nodeId: id,
      })
      .then((res: any) => {
        console.log(`Tracker responded with status code: ${res.status}`);
      })
      .catch((error: any) => {
        throw error;
      });

    cron.schedule("*/5 * * * * *", async () => {
      axios.post(`${trackerIp}/ping`, {
        port: this.updIn,
        nodeId: this.id,
        contractRequest: !!this.contractRequest,
      });
    });
  }

  setContractRequest = (bool: boolean) => {
    this.contractRequest = bool;
  };

  getContactRequest = (): boolean => this.contractRequest;

  getNodes = async (): Promise<Nodes[]> => {
    const res = await axios.get(`${trackerIp}/nodes`);
    return res.data as Nodes[];
  };
}

export default Tracker;
