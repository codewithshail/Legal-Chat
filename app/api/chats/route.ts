import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
const authResult = await auth(); // Await the auth result
const { userId } = authResult;

if (!userId) {
  return new NextResponse("Unauthorized", { status: 401 });
}

try {
  const userChats = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(chats.updatedAt);

  return NextResponse.json(userChats);
} catch (error) {
  console.error("Error fetching chats:", error);
  return new NextResponse("Internal Server Error", { status: 500 });
}
}
