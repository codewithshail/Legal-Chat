"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatContainer } from "@/components/chat-container";
import { SidebarInset } from "@/components/ui/sidebar";

interface ChatLayoutProps {
  initialChatId?: string;
}

export function ChatLayout({ initialChatId }: ChatLayoutProps) {
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId || null);
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);

  const handleNewChat = () => {
    setActiveChatId(null);
    setIsTemporaryChat(false);
  };

  const handleTemporaryChat = () => {
    setActiveChatId(null);
    setIsTemporaryChat(true);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setIsTemporaryChat(false);
  };

  return (
    <div className="flex h-screen w-full">
      <AppSidebar
        onNewChat={handleNewChat}
        onTemporaryChat={handleTemporaryChat}
        onSelectChat={handleSelectChat}
        activeChatId={activeChatId}
      />
      <SidebarInset className="flex-1 h-full">
        <ChatContainer chatId={activeChatId} isTemporary={isTemporaryChat} />
      </SidebarInset>
    </div>
  );
}