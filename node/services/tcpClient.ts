import net from "net";
import fs from "fs";

import { Node, Contract } from "../types";

const sendFile = (
  contract: Contract,
  tcpPort: number,
  ip: string,
  filePath: string,
  onSuccess: (contractId: string) => void,
  onFail: (contractId: string, err: Error) => void
) => {
  const client = new net.Socket();

  client.connect(tcpPort, ip, () => {
    client.write(contract.contractId + ":");

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", function (err) {
      onFail(contract.contractId, err);
    });

    fileStream.on("open", function () {
      fileStream.pipe(client);
    });
  });
  client.on("end", () => {
    onSuccess(contract.contractId)
  });
  client.on("error", (err) => {
    onFail(contract.contractId, err);
  });
};

export { sendFile };
