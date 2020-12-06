import fs from "fs";
import crypto from "crypto";
import cron from "node-cron";
import logger from "../../util/logger"

import FileManager from "../../fileManager";
import { NodesHandler } from "../../types";
import Udp from "../../services/udp";
import { sha1smallstr, checksumFile, checksumPartFile, getRandomInt } from "../../util/hash";

// Ask proof for 2 mins
const TTLofProof = 2 * 60 * 1000;

interface ContractProof {
  contractId: string;
  middlePointForSha1: number;
  expectedStartSha1: string;
  expectedEndSha1: string;
  creationUnixTime: number;
}

class ContractProofModule {
  fm: FileManager;
  nodeManager: NodesHandler;
  udpClient: Udp;

  proofRequestList: ContractProof[];

  constructor(
    nodeManager: NodesHandler,
    udpClient: Udp,
    id: string,
    fm: FileManager,
  ) {
    this.nodeManager = nodeManager;
    this.udpClient = udpClient;
    this.fm = fm;

    this.proofRequestList = [];
    this.udpClient.on("CONTRACT_PROOF", this.handleContractProof);
    this.udpClient.on("CONTRACT_PROOF_ACK", this.handleContractProofAck);

    cron.schedule("*/20 * * * * *", async () => {
      this.askForProof();
      this.checkTTLofProofs();
    });
  }

  private askForProof = async () => {
    this.fm
      .getContracts()
      .filter((contract) => contract.fileSent)
      .forEach(async (contract) => {
        const existingProof = this.proofRequestList.find((c) => c.contractId === contract.contractId);
        const node = this.nodeManager.getNodes().find((n) => n.nodeId === contract.contractNodeId);
        if (!node) {
          logger.log(
            "warn",
            `CONTRACT_PROOF: can't find node ${contract.contractNodeId} for contract ${sha1smallstr(
              contract.contractId
            )}`
          );
          return;
        }
        if (existingProof) {
          logger.log(
            "info",
            `CONTRACT_PROOF - send EXISTING - ${sha1smallstr(
              contract.contractId
            )}. Expecting start hash: ${sha1smallstr(existingProof.expectedStartSha1)} and end hash: ${sha1smallstr(
              existingProof.expectedEndSha1
            )}`
          );
          this.udpClient.sendUdpMessage(
            `CONTRACT_PROOF:${contract.contractId}:${existingProof.middlePointForSha1}`,
            Number(node.port),
            node.ip
          );
        } else {
          const contractFilePath = this.fm.getFilePath(contract.file.name);
          const fileStats = fs.statSync(contractFilePath);
          const middlePoint = getRandomInt(fileStats.size);
          const { sha1start, sha1end } = await this.createHashesWithMiddlePoint(contractFilePath, middlePoint);

          const test = this.nodeManager.getNode(contract.contractNodeId);
          if (!test) {
            return;
          }

          logger.log(
            "info",
            `CONTRACT_PROOF - send NEW - ${sha1smallstr(contract.contractId)}. Expecting start hash: ${sha1smallstr(
              sha1start
            )} and end hash: ${sha1smallstr(sha1end)}`
          );

          this.proofRequestList = [
            ...this.proofRequestList,
            {
              contractId: contract.contractId,
              middlePointForSha1: middlePoint,
              expectedStartSha1: sha1start,
              expectedEndSha1: sha1end,
              creationUnixTime: new Date().getTime(),
            },
          ];
          this.udpClient.sendUdpMessage(
            `CONTRACT_PROOF:${contract.contractId}:${middlePoint}`,
            Number(node.port),
            node.ip
          );
        }
      });
  };

  private checkTTLofProofs = async () => {
    this.proofRequestList.forEach((proofReq) => {
      if (proofReq.creationUnixTime + TTLofProof < new Date().getTime()) {
        logger.log(
          "warn",
          `CONTRACT PROOF not received in time for contract ${sha1smallstr(proofReq.contractId)}`
        );
        this.proofRequestList = this.proofRequestList.filter((proof) => proof.contractId === proofReq.contractId);
      }
    });
  };

  private handleContractProof = async ([contractId, middlepoint]: string[]) => {
    const contract = this.fm.getContract(contractId);
    if (!contract) {
      logger.log("warn", "CONTRACT_PROOF - No contract:", contractId);
      return;
    }
    const node = this.nodeManager.getNodes().find((n) => n.nodeId === contract.contractNodeId);
    if (!node) {
      logger.log(
        "warn",
        `CONTRACT PROOF error: cant find node ${contract.contractNodeId} for contract ${contract.contractId}`
      );
      return;
    }
    const contractFilePath = this.fm.getReceivedContractFilePath(contract.contractId);

    const { sha1start, sha1end } = await this.createHashesWithMiddlePoint(contractFilePath, Number(middlepoint));
    logger.log(
      "info",
      `CONTRACT_PROOF - RECEIVED for ${sha1smallstr(
        contract.contractId
      )} with middlepoint ${middlepoint}. Answering sha1start ${sha1smallstr(sha1start)}, sha1end ${sha1smallstr(
        sha1end
      )}`
    );

    this.udpClient.sendUdpMessage(
      `CONTRACT_PROOF_ACK:${contract.contractId}:${middlepoint}:${sha1start}:${sha1end}`,
      Number(node.port),
      node.ip
    );
  };

  private handleContractProofAck = ([contractId, middlePointForSha1, sha1Start, sha1End]: string[]) => {
    const contractProof = this.proofRequestList.find((proof) => proof.contractId === contractId);
    if (!contractProof) {
      logger.log("info", `CONTRACT_PROOF_ACK - WRONG proof received - ${sha1smallstr(contractId)}`);
      return;
    }

    if (
      contractProof.middlePointForSha1 !== Number(middlePointForSha1) ||
      contractProof.expectedStartSha1 !== sha1Start ||
      contractProof.expectedEndSha1 !== sha1End
    ) {
      logger.log(
        "info",
        `CONTRACT_PROOF_ACK - WRONG proof. Expecting for middlepoint ${
          contractProof.middlePointForSha1
        } sha1Start ${sha1smallstr(contractProof.expectedEndSha1)} and sha1end: ${sha1smallstr(
          contractProof.expectedEndSha1
        )}. Recieved middlepoint ${sha1smallstr(middlePointForSha1)} with sha1Start ${sha1smallstr(
          sha1Start
        )} and sha1End ${sha1smallstr(sha1End)}.`
      );
    } else {
      logger.log("info", `CONTRACT_PROOF_ACK for ${sha1smallstr(contractId)} - Successfull proof received.`);
      this.proofRequestList = this.proofRequestList.filter((proof) => proof.contractId !== contractId);
    }
  };

  private createHashesWithMiddlePoint = async (
    filePath: string,
    middlePoint: number
  ): Promise<{ sha1start: string; sha1end: string }> => {
    const fileStats = fs.statSync(filePath);
    const sha1start = await checksumPartFile(filePath, 0, middlePoint);
    const sha1end = await checksumPartFile(filePath, middlePoint, fileStats.size);
    return { sha1start, sha1end };
  };
}

export default ContractProofModule;
