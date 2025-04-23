import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await auth(); // Await the auth result
  const { userId } = authResult;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resolvedParams = await params; // Await the params
  const chatId = resolvedParams.id;

  try {
    const chat = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (chat.length === 0) {
      return new NextResponse("Chat not found", { status: 404 });
    }

    if (chat[0].userId !== userId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    return NextResponse.json(chat[0]);
  } catch (error) {
    console.error("Error fetching chat:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}