import net from "net";
import fs, { WriteStream } from "fs";
import { getReceivedContractFilePath } from "../db/contractDb";
import logger from "../util/logger";

class TcpServer {
  server: net.Server;

  constructor(tcpPort: number, host: string) {
    this.server = net.createServer();

    this.server.listen(tcpPort, host, () => {
      console.log("TCP server started");
    });

    this.server.on("connection", (socket: net.Socket) => {
      let fileWriteStream: null | WriteStream = null;
      //let receivedFileData: Buffer[] = [];
      let receivedMetadata: Buffer[] = [];
      let receivedType: boolean = false;
      socket.on("data", (data) => {
        if (receivedType) {
          fileWriteStream?.write(data);
          return;
        }
        const indexOfDelimiter = data.toString("utf-8").indexOf(":");
        if (indexOfDelimiter !== -1) {
          const metaData = data.slice(0, indexOfDelimiter);
          const fileData = data.slice(indexOfDelimiter + 1, data.length);
          receivedMetadata.push(metaData);
          receivedType = true;

          const contractId = Buffer.concat(receivedMetadata).toString();
          const filePath = getReceivedContractFilePath(contractId);
          fileWriteStream = fs.createWriteStream(filePath);
          fileWriteStream.write(fileData);
        } else {
          receivedMetadata.push(data);
        }
      });

      socket.on("end", () => {
        const contractId = Buffer.concat(receivedMetadata);
        logger.log("info", `FILE RECEIVED for contract ${contractId}.`);
      });

      socket.on("error", (error) => {
        logger.log("warn", `FILE RECEIVE FAILED - ${error}`);
      });
    });
  }
}
export default TcpServer;
