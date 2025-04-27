"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Send, Paperclip, Loader2, FileText, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FileUploader } from "@/components/file-uploader"
import { AudioRecorder } from "@/components/audio-recorder"
import type { ChatMessage } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { MessageContent } from "@/components/message-content"

interface ChatContainerProps {
  chatId: string | null
  isTemporary: boolean
}

export function ChatContainer({ chatId, isTemporary }: ChatContainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<{ url: string; type: string; name: string; fileId?: string }[]>([])
  const [showUploader, setShowUploader] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (chatId) {
      fetchChatHistory(chatId)
    } else {
      setMessages([])
      if (!isTemporary) {
        const newSessionId = uuidv4()
        setSessionId(newSessionId)
      }
    }
  }, [chatId, isTemporary])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchChatHistory = async (id: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/chats/${id}`)
      if (!response.ok) throw new Error("Failed to fetch chat history")
      const data = await response.json()
      setMessages(data.messages || [])
      setSessionId(id)
    } catch (error) {
      console.error("Error fetching chat history:", error)
      toast.error("Failed to load chat history. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      files: uploadedFiles,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setUploadedFiles([])
    setShowUploader(false)
    setIsLoading(true)

    try {
      console.log("Sending message to API...")
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatId: !isTemporary ? chatId || sessionId : null,
          isTemporary,
          files: uploadedFiles,
        }),
      })

      console.log("API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error(`Failed to get response: ${response.status} ${errorText}`)
      }

      const responseData = await response.json()
      console.log("API response data:", responseData)

      const taskId = response.headers.get("X-Task-ID") || responseData.taskId
      if (!taskId) {
        console.error("No task ID found in response")
        throw new Error("Task ID not found in response")
      }

      console.log("Task ID:", taskId)

      const assistantMessageId = Date.now().toString()
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date().toISOString() },
      ])

      let assistantMessage = ""
      let pollAttempts = 0
      const maxPollAttempts = 30 // Maximum number of polling attempts

      while (pollAttempts < maxPollAttempts) {
        pollAttempts++
        console.log(`Polling attempt ${pollAttempts}...`)

        try {
          const pollResponse = await fetch(`/api/chat/poll/${taskId}`)
          console.log("Poll response status:", pollResponse.status)

          if (!pollResponse.ok) {
            console.error("Poll response error:", pollResponse.status)
            throw new Error(`Polling failed with status: ${pollResponse.status}`)
          }

          const pollData = await pollResponse.json()
          console.log("Poll data:", pollData)

          if (pollData.status === "completed") {
            assistantMessage = pollData.result
            setMessages((prev) => {
              const newMessages = [...prev]
              const lastIndex = newMessages.findIndex((m) => m.id === assistantMessageId)
              if (lastIndex !== -1) {
                newMessages[lastIndex] = { ...newMessages[lastIndex], content: assistantMessage }
              }
              return newMessages
            })
            break
          } else if (pollData.status === "failed") {
            throw new Error("Task failed")
          }
        } catch (pollError) {
          console.error("Error during polling:", pollError)
          // Continue polling despite errors
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      if (pollAttempts >= maxPollAttempts) {
        throw new Error("Response timed out. Please try again.")
      }

      if (!isTemporary && !chatId && sessionId) {
        router.push(`/chat/${sessionId}`)
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to get response")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (files: { url: string; type: string; name: string; fileId?: string }[]) => {
    setUploadedFiles((prev) => [...prev, ...files])
    setIsUploading(false)
    setShowUploader(false)
  }

  const handleTranscriptionComplete = (text: string) => {
    setInput(text)
    setShowVoiceRecorder(false)
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-900">
      <header className="bg-gray-800 p-4 text-white border-b border-gray-700">
        <h1 className="text-xl font-bold">
          {isLoading && !messages.length ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </div>
          ) : isTemporary ? (
            "Temporary Chat"
          ) : chatId ? (
            "Chat History"
          ) : (
            "New Chat"
          )}
        </h1>
      </header>

      <ScrollArea className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-4 pb-20">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] text-center text-gray-400">
              <FileText className="h-16 w-16 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Legal Assistant</h2>
              <p className="max-w-md">
                Upload legal documents or ask questions about Indian law. I can help with legal advice, document
                analysis, and more.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] p-4 rounded-lg ${
                    message.role === "user" ? "bg-purple-600 text-white" : "bg-gray-700 text-white"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-center mb-2">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src="/placeholder.svg?height=32&width=32" alt="AI" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold">Legal Assistant</span>
                    </div>
                  )}
                  <MessageContent message={message} />
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <p className="text-xs w-full opacity-70">Uploaded files:</p>
                      {message.files.map((file, idx) => (
                        <span key={idx} className="text-xs bg-gray-800 px-2 py-1 rounded">
                          {file.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {showUploader && (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <FileUploader
            onUpload={handleFileUpload}
            onCancel={() => setShowUploader(false)}
            isUploading={isUploading}
            setIsUploading={setIsUploading}
          />
        </div>
      )}

      {showVoiceRecorder && !showUploader && (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <p className="text-white">Record your message</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVoiceRecorder(false)}
              className="border-gray-600 text-white"
            >
              Cancel
            </Button>
          </div>
          <div className="mt-4 flex justify-center">
            <AudioRecorder
              onTranscriptionComplete={handleTranscriptionComplete}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
            />
          </div>
        </div>
      )}

      <footer className="sticky bottom-0 bg-gray-800 p-4 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="flex space-x-2 max-w-4xl mx-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setShowUploader(!showUploader)
              setShowVoiceRecorder(false)
            }}
            disabled={isLoading || isUploading || isRecording}
            className="border-gray-600 text-white"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setShowVoiceRecorder(!showVoiceRecorder)
              setShowUploader(false)
            }}
            disabled={isLoading || isUploading || isRecording}
            className="border-gray-600 text-white"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading || isUploading || isRecording}
            className="flex-1 bg-gray-700 border-gray-600 text-white"
          />
          <Button
            type="submit"
            disabled={isLoading || isUploading || isRecording || (!input.trim() && uploadedFiles.length === 0)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </form>

        {uploadedFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 max-w-4xl mx-auto">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="bg-gray-700 text-white text-xs px-2 py-1 rounded flex items-center">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1"
                  onClick={() => setUploadedFiles((files) => files.filter((_, i) => i !== index))}
                >
                  <span className="sr-only">Remove</span>×
                </Button>
              </div>
            ))}
          </div>
        )}
      </footer>
    </div>
  )
}
