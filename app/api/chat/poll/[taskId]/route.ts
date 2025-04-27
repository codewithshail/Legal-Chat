import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import IORedis from "ioredis"

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379")

export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  const authResult = await auth()
  const { userId } = authResult

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const taskId = params.taskId

  if (!taskId) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  try {
    const taskData = await redis.get(`task:${taskId}`)

    if (!taskData) {
      return NextResponse.json({ status: "not_found" }, { status: 404 })
    }

    const { status, result } = JSON.parse(taskData)
    return NextResponse.json({ status, result })
  } catch (error) {
    console.error("Error polling task:", error)
    return NextResponse.json({ status: "error", error: "Failed to poll task" }, { status: 500 })
  }
}
