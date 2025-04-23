"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { ChatMessage } from "@/lib/types";
import { FileIcon, FileTextIcon } from "lucide-react";
import Image from "next/image";

interface MessageContentProps {
  message: ChatMessage;
}

export function MessageContent({ message }: MessageContentProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const renderFilePreview = (file: { url: string; type: string; name: string }) => {
    if (file.type.startsWith("image/")) {
      return (
        <div key={file.url} className="relative mb-2">
          <div
            className="cursor-pointer relative h-40 w-full max-w-xs rounded overflow-hidden"
            onClick={() => setExpandedImage(file.url)}
          >
            <Image src={file.url || "/placeholder.svg"} alt={file.name} fill className="object-cover" />
          </div>
          <span className="text-xs text-gray-300 mt-1 block">{file.name}</span>
        </div>
      );
    } else if (file.type === "application/pdf") {
      return (
        <div key={file.url} className="mb-2">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
          >
            <FileTextIcon className="h-5 w-5 mr-2 text-red-400" />
            <span className="text-sm truncate text-white">{file.name}</span>
          </a>
        </div>
      );
    } else {
      return (
        <div key={file.url} className="mb-2">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
          >
            <FileIcon className="h-5 w-5 mr-2 text-blue-400" />
            <span className="text-sm truncate text-white">{file.name}</span>
          </a>
        </div>
      );
    }
  };

  return (
    <div>
      {message.files && message.files.length > 0 && <div className="mb-4">{message.files.map(renderFilePreview)}</div>}
      <ReactMarkdown
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <SyntaxHighlighter {...(props as any)} style={vscDarkPlus} language={match[1]} PreTag="div">
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {message.content}
      </ReactMarkdown>
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <Image
              src={expandedImage || "/placeholder.svg"}
              alt="Expanded image"
              width={1200}
              height={800}
              className="object-contain"
            />
            <button
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1"
              onClick={() => setExpandedImage(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}