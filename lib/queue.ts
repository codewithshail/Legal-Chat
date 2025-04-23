import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

export const messageQueue = new Queue("message-queue", { connection });

export async function startMessageWorker() {
  new Worker(
    "message-queue",
    async (job) => {
      const { chatId, content, role } = job.data;
      await db.insert(messages).values({
        id: uuidv4(),
        chatId,
        role,
        content,
        createdAt: new Date(),
      });
    },
    { connection }
  );
}