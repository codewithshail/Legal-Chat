

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChatLayout } from "@/components/chat-layout";

export default function ChatPage({ params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) {
    return redirect("/sign-in");
  }

  return <ChatLayout initialChatId={params.id} />;
}