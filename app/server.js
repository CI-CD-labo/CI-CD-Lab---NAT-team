const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: 6379,
});

app.get("/api/health", async (req, res) => {
  const pong = await redis.ping();
  res.json({ status: "ok", redis: pong, pod: process.env.HOSTNAME });
});

app.get("/api/visits", async (req, res) => {
  const count = await redis.incr("visits");
  res.json({ visits: count, pod: process.env.HOSTNAME });
});

app.get("/api/messages", async (req, res) => {
  const msgs = await redis.lrange("messages", 0, -1);
  res.json(msgs.map((m) => JSON.parse(m)));
});

app.post("/api/messages", async (req, res) => {
  const msg = {
    text: req.body.text,
    pod: process.env.HOSTNAME,
    time: new Date().toISOString(),
  };
  await redis.lpush("messages", JSON.stringify(msg));
  res.status(201).json(msg);
});

app.listen(3000, () => console.log("Backend running on :3000"));
