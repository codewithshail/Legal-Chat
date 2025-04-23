import { NextResponse } from "next/server";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  const taskId = params.taskId;
  const taskData = await redis.get(`task:${taskId}`);

  if (!taskData) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const { status, result } = JSON.parse(taskData);
  return NextResponse.json({ status, result });
}