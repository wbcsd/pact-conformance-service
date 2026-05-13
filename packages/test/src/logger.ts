import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const pinoInstance = pino(
  isProduction
    ? { level: process.env.LOG_LEVEL ?? "info" }
    : {
        level: process.env.LOG_LEVEL ?? "debug",
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

const logger =
  process.env.LOG_OUTPUT === "console"
    ? console
    : {
        info: wrap("info"),
        error: wrap("error"),
        warn: wrap("warn"),
        debug: wrap("debug"),
      };

export default logger;
