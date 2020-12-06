import net from "net";
import fs, { WriteStream } from "fs";
import FileManager from "../fileManager";
import { Logger } from "winston";

class TcpServer {
  server: net.Server;
  fm: FileManager;
  logger: Logger;

  constructor(tcpPort: number, host: string, fm: FileManager, logger: Logger) {
    this.server = net.createServer();
    this.fm = fm;
    this.logger = logger;

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
          const filePath = fm.getReceivedContractFilePath(contractId);
          fileWriteStream = fs.createWriteStream(filePath);
          fileWriteStream.write(fileData);
        } else {
          receivedMetadata.push(data);
        }
      });

      socket.on("end", () => {
        const contractId = Buffer.concat(receivedMetadata);
        this.logger.log("info", `FILE RECEIVED for contract ${contractId}.`);
      });

      socket.on("error", (error) => {
        this.logger.log("warn", `FILE RECEIVE FAILED - ${error}`);
      });
    });
  }
}
export default TcpServer;
