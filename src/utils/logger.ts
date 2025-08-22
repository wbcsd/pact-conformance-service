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

const wrap =
  (method: "info" | "error" | "warn" | "debug") =>
  (message: string, meta?: any) => {
    if (meta) {
      pinoInstance[method](meta, message);
    } else {
      pinoInstance[method](message);
    }
  };

const logger = {
  info: wrap("info"),
  error: wrap("error"),
  warn: wrap("warn"),
  debug: wrap("debug"),
};

const loggerMiddleware = pinoHttp({ logger: pinoInstance });

export { loggerMiddleware };
export default logger;
