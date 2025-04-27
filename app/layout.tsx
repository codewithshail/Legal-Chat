import type React from "react"
import "./globals.css"
import { Toaster } from "sonner"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ClerkProvider } from "@clerk/nextjs"

export const metadata = {
title: "Legal Document Chatbot",
description: "Chat with your legal documents using AI",
}

export default function RootLayout({
children,
}: {
children: React.ReactNode
}) {
return (
  <ClerkProvider>
    <html lang="en" suppressHydrationWarning>
      <body className="dark:bg-gray-900 bg-gray-900">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SidebarProvider>
            {children}
            <Toaster />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  </ClerkProvider>
)
}
