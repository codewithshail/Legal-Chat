import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { transcribeAudio, getTranscriptionStatus } from "@/lib/voice-transcription";

export async function POST(req: NextRequest) {
  const authResult = await auth();
  const { userId } = authResult;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return new NextResponse("Replicate API token not configured", { status: 500 });
  }

  try {
    const body = await req.json();
    const { audioUrl } = body;

    if (!audioUrl) {
      return new NextResponse("Audio URL is required", { status: 400 });
    }

    const result = await transcribeAudio(audioUrl);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Transcription error:", error);
    return new NextResponse(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to transcribe audio" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(req: NextRequest) {
  const authResult = await auth();
  const { userId } = authResult;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  
  if (!taskId) {
    return new NextResponse("Task ID is required", { status: 400 });
  }

  try {
    const status = await getTranscriptionStatus(taskId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error getting transcription status:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to get transcription status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

