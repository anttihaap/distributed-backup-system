import winston, { format } from "winston";
import { getLocalId } from "../config";

const id = getLocalId();

const logger = winston.createLogger({
  level: "info",
  format: format.combine(format.simple(), format.timestamp(),
    format.printf(log => `${log.timestamp}: ${log.level}: ${log.message}`)),
  transports: [
    // Log to console
    new winston.transports.Console({ format: format.combine(format.colorize(), format.simple(),
      format.timestamp(), format.printf(log => `${log.level}: ${log.message}`)) }),
    // Log to file(s)
    new winston.transports.File({ filename: `./logs/${id}_error.log`, level: "error" }),
    new winston.transports.File({ filename: `./logs/${id}_all.log` }),
  ],
})

export default logger;

/* Usage:
logger.log("info", "message");
logger.log("warn", "message");
logger.log("error", "message");

OR

logger.info("message");
logger.warn("message");
logger.error("message");
*/
