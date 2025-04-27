export interface Chat {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  chatId?: string
  role: "user" | "assistant"
  content: string
  files?: { url: string; type: string; name: string; fileId?: string }[]
  createdAt: string
}

export interface Memory {
  type: string
  value: string
  timestamp: number
  confidence: number
}

export interface MemoryStore {
  [key: string]: Memory[]
}
