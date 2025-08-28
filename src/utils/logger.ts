import pino from "pino";
import pinoHttp from "pino-http";

const pinoInstance = pino({
  ...(process.env.NODE_ENV !== "production"
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

const logger = process.env.LOG_OUTPUT === "console" ? console : {
  info: wrap("info"),
  error: wrap("error"),
  warn: wrap("warn"),
  debug: wrap("debug"),
};

const loggerMiddleware = process.env.LOG_OUTPUT === "console" ? 
  (req: any, res: any, next: any) => {
    next();
  } : 
  pinoHttp({ logger: pinoInstance });

export { loggerMiddleware };
export default logger;
