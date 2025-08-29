import pino from "pino";
import pinoHttp from "pino-http";
import config from "../config";

const pinoInstance = pino({
  ...(config.NODE_ENV !== "production"
    ? {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }
    : { level: "info" }),
});

const wrap = (method: "info" | "error" | "warn" | "debug") =>
  (message: any, meta?: any) => {
    if (meta) {
      pinoInstance[method](meta, message);
    } else {
      pinoInstance[method](message);
    }
  };

const logger = config.LOG_OUTPUT === "console" ? console : {
  info: wrap("info"),
  error: wrap("error"),
  warn: wrap("warn"),
  debug: wrap("debug"),
};

const loggerMiddleware = config.LOG_OUTPUT === "console" ? 
  (req: any, res: any, next: any) => {
    next();
  } : 
  pinoHttp({ logger: pinoInstance });

export { loggerMiddleware };
export default logger;
