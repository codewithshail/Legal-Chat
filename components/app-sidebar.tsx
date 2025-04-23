"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { MessageSquare, Plus, Clock, Trash2, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInput,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import type { Chat } from "@/lib/types";
import { toast } from "sonner";

interface AppSidebarProps {
  onNewChat: () => void;
  onTemporaryChat: () => void;
  onSelectChat: (chatId: string) => void;
  activeChatId: string | null;
}

export function AppSidebar({ onNewChat, onTemporaryChat, onSelectChat, activeChatId }: AppSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch("/api/chats");
        if (!response.ok) throw new Error("Failed to fetch chats");
        const data = await response.json();
        setChats(data);
      } catch (error) {
        console.error("Error fetching chats:", error);
        toast.error("Failed to load chat history...");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, []);

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete chat");
      setChats(chats.filter((chat) => chat.id !== chatId));
      toast.success("Chat deleted successfully...");
      if (activeChatId === chatId) onNewChat();
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Failed to delete the chat...");
    }
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const confirmDelete = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  const filteredChats = chats.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSignOut = () => {
    router.push("/sign-in");
  };

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="bg-gray-900 border-r border-gray-700"
    >
      <SidebarHeader className={isCollapsed ? "p-2" : "p-4"}>
        {!isCollapsed && (
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Legal Assistant</h1>
            <SidebarTrigger />
          </div>
        )}
        <div className={isCollapsed ? "p-1" : "p-2 mt-2"}>
          <Button
            onClick={onNewChat}
            className={`w-full bg-purple-600 hover:bg-purple-700 text-white ${isCollapsed ? "p-1" : ""}`}
            size={isCollapsed ? "icon" : "default"}
          >
            <Plus className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">New Chat</span>}
          </Button>
        </div>
        <div className={isCollapsed ? "p-1" : "p-2"}>
          <Button
            onClick={onTemporaryChat}
            variant="outline"
            className={`w-full border-gray-600 text-white ${isCollapsed ? "p-1" : ""}`}
            size={isCollapsed ? "icon" : "default"}
          >
            <Clock className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Temporary Chat</span>}
          </Button>
        </div>
        {!isCollapsed && (
          <div className="p-2">
            <SidebarInput
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 text-white border-gray-600"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel className="text-gray-400">Recent Chats</SidebarGroupLabel>}
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <SidebarMenu>
                {isLoading ? (
                  Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <SidebarMenuItem key={i}>
                        <div className="animate-pulse flex items-center p-2">
                          <div className="h-4 w-4 bg-gray-600 rounded-full mr-2"></div>
                          <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                        </div>
                      </SidebarMenuItem>
                    ))
                ) : filteredChats.length > 0 ? (
                  filteredChats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectChat(chat.id);
                          router.push(`/chat/${chat.id}`);
                        }}
                        isActive={activeChatId === chat.id}
                        tooltip={chat.title}
                        className="text-white hover:bg-gray-800"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className={isCollapsed ? "hidden" : "truncate"}>{chat.title}</span>
                        {!isCollapsed && (
                          <span className="ml-auto text-xs text-gray-400">
                            {formatDistanceToNow(new Date(chat.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </SidebarMenuButton>
                      {!isCollapsed && (
                        <SidebarMenuAction onClick={(e) => confirmDelete(chat.id, e)} showOnHover>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuItem>
                  ))
                ) : (
                  !isCollapsed && (
                    <div className="p-4 text-center text-gray-500">
                      {searchQuery ? "No matching chats found" : "No chats yet"}
                    </div>
                  )
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="p-2 flex items-center justify-between">
          <UserButton afterSignOutUrl="/sign-in" />
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 text-white" />
          </Button>
        </div>
      </SidebarFooter>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this chat? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => chatToDelete && handleDeleteChat(chatToDelete)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}