const Redis = require("ioredis");
const { redisLogger } = require('../../utils/logger/index');

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: 0, // optional
});

redisClient.on("connect", () => {
  redisLogger.info("Connected to Redis", { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT });
});

redisClient.on("error", (err) => {
  redisLogger.error("Redis connection error", { error: err.message, stack: err.stack });
});

module.exports = redisClient;
