import pino from "pino";
import pinoHttp from "pino-http";
import config from "./config";

const isProduction = process.env.NODE_ENV === "production";

const pinoInstance = pino(
  isProduction
    ? { level: config.LOG_LEVEL ?? "info" }
    : {
        level: config.LOG_LEVEL ?? "debug",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }
);

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
    console.log(`${req.method} ${req.url}`);
    next();
  } : 
  pinoHttp({ logger: pinoInstance });

export { loggerMiddleware };
export default logger;
