import net from "net";
import fs, { WriteStream } from "fs";
import path from "path";

class TcpServer {
  server: net.Server;

  constructor(tcpPort: number, host: string) {
    this.server = net.createServer();
    this.server.listen(tcpPort, host, () => {
      console.log("TCP server started");
    });

    this.server.on("connection", (socket: net.Socket) => {
      console.log("connection");
      let fileWriteStream: null | WriteStream = null;
      //let receivedFileData: Buffer[] = [];
      let receivedMetadata: Buffer[] = [];
      let receivedType: boolean = false;
      socket.on("data", (data) => {
        if (receivedType) {
          fileWriteStream?.write(data)
          return
        }


        const indexOfDelimiter = data.toString("utf-8").indexOf(";");
        if (indexOfDelimiter !== -1) {
          const metaData = data.slice(0, indexOfDelimiter + 2);
          const fileData = data.slice(indexOfDelimiter + 1, data.length);
          receivedMetadata.push(metaData);
          fileWriteStream = fs.createWriteStream(path.resolve("./files_contract/" + parseInt(process.env.LOCAL_NODE_ID || "fail") + "_" + Buffer.concat(receivedMetadata).toString()))
          fileWriteStream.write(fileData)
          receivedType = true;

          const concatMeta = Buffer.concat(receivedMetadata);
          console.log("METADATA", concatMeta);
        } else {
          receivedMetadata.push(data)
        }
      });

      socket.on("end", () => {
        const test2 = Buffer.concat(receivedMetadata);
        console.log("metadata", test2.toString());
      });

      socket.on("error", (error) => {
        console.log("ERROR", error);
      });
    });
  }
}
export default TcpServer;
