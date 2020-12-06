import crypto from 'crypto';
import fs from 'fs';

export const sha1smallstr = (sha1: string) => {
  return sha1.slice(0, 5) + "...";
};

export function checksumFile(path: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(path);
    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function checksumPartFile(path: string, start: number, end: number) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(path, { start: start, end: end });

    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * Math.floor(max));
}

export const getRandomSha1 = () => {
  const dateStr = new Date().valueOf().toString();
  const random = Math.random().toString();
  return crypto
    .createHash("sha1")
    .update(dateStr + random)
    .digest("hex");
};