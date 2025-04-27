import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { chats, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
const authResult = await auth(); // Await the auth result
const { userId } = authResult;

if (!userId) {
  return new NextResponse("Unauthorized", { status: 401 });
}

const chatId = params.id;

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

  // Fetch messages for this chat
  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  // Parse files JSON if present
  const parsedMessages = chatMessages.map(message => ({
    ...message,
    files: message.files ? JSON.parse(message.files) : undefined
  }));

  return NextResponse.json({ ...chat[0], messages: parsedMessages });
} catch (error) {
  console.error("Error fetching chat:", error);
  return new NextResponse("Internal Server Error", { status: 500 });
}
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
const authResult = await auth();
const { userId } = authResult;

if (!userId) {
  return new NextResponse("Unauthorized", { status: 401 });
}

const chatId = params.id;

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

  await db.delete(chats).where(eq(chats.id, chatId));
  return new NextResponse(null, { status: 204 });
} catch (error) {
  console.error("Error deleting chat:", error);
  return new NextResponse("Internal Server Error", { status: 500 });
}
}
