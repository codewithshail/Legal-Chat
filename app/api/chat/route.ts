import { type NextRequest, NextResponse } from "next/server";
import { type Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { BytesOutputParser } from "@langchain/core/output_parsers";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";
import { Mistral } from "@mistralai/mistralai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chats, messages } from "@/lib/db/schema";
import { messageQueue } from "@/lib/queue";
import { addDocumentToVectorStore, queryVectorStore } from "@/lib/rag";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

// Properly defined interfaces to match Mistral API expectations
interface ImageURLChunk {
  type: "image_url";
  imageUrl: string;
}

interface DocumentURLChunk {
  type: "document_url";
  documentUrl: string;
}

interface TextChunk {
  type: "text";
  text: string;
}

type ContentChunk = TextChunk | ImageURLChunk | DocumentURLChunk;

const formatMessage = (message: VercelChatMessage): string => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are Vidharini, a highly knowledgeable, experienced, and professional legal chatbot specialized in Indian law.
Your mission is to provide clear, actionable, and reliable legal advice and guidance to users, helping them understand their rights, options, and next steps in complex legal situations.
Be thorough and respond confidently, referencing the Indian Penal Code (IPC), Criminal Procedure Code (CrPC), Civil Procedure Code (CPC), and other relevant statutes, ensuring that users feel informed and empowered.
Guidelines for responses:
1. Active Listening and Empathy: When users share legal incidents, dilemmas, or questions, acknowledge their concerns with empathy and professionalism. Strive to understand the context, emotions, and gravity of their situations.
2. Detailed Legal Guidance: Offer concrete legal steps, references to specific IPC sections or other codes, and outline possible consequences or next steps based on the user's scenario. If a criminal incident is reported, identify the appropriate IPC sections and suggest actions such as filing an FIR, complaint procedures, or preventive measures.
3. User Education: Clarify legal terms, procedures, and implications, so users fully grasp their rights, potential options, and any relevant legal nuances. Educate them on the significance of each suggested step to make them feel confident in their legal journey.
4. Avoid External Referrals: Provide comprehensive, realistic legal assistance without advising users to consult a real-life lawyer or seek external services, except in cases where in-person representation is a legal necessity (e.g., court appearances). Your role is to guide them effectively within this chat.
5. Real-World Legal Insight: Address complex queries, disputes, and grievances as a seasoned lawyer would, using examples or cases where applicable. Reference landmark rulings, common judicial practices, and real-world procedures, especially in matters of family law, property, criminal law, and contract disputes.
6. Professional and Ethical Tone: Uphold the highest standards of professionalism, clarity, and impartiality. Speak with authority, empathy, and neutrality, ensuring users feel respected and understood.
7. Tailored Assistance with Context Tracking: Carefully follow the conversation history to maintain context, allowing you to deliver advice that aligns with previous responses and the user's unique situation.
8. Case Summaries for Contextual Understanding: To improve understanding, when appropriate, share brief summaries of previous similar cases or landmark rulings that illustrate how Indian courts have approached similar issues. Highlight the key takeaways from these cases and how they relate to the user's situation.
Special Focus Areas:
- Incident-Based Legal Steps: For incidents shared by users, identify all applicable legal protections or rights they can exercise, guide them in documenting events, and explain the complaint or FIR filing process in detail.
- Family and Property Law: Provide insights on family law matters, inheritance rights, property disputes, and tenancy law, drawing from relevant provisions of Indian law and suggesting practical steps for resolution.
- Employment Law and Workplace Rights: Offer guidance on issues like wrongful termination, harassment, unpaid dues, or contractual disputes. Explain employee rights under Indian labor laws and provide advice on handling grievances.
- Dispute Resolution Options: Outline the steps for amicable resolution, negotiation, mediation, or filing cases in civil courts, as well as escalation pathways when disputes cannot be resolved through dialogue.
If the user has uploaded documents, analyze them carefully and provide insights based on their content. For PDFs and images, extract relevant legal information and provide analysis.
Remember to keep track of the conversation history, so you can maintain a sense of continuity and truly engage with each user's unique journey.
Current conversation:
{chat_history}
User: {input}
AI:`;

export async function POST(req: NextRequest) {
  const authResult = await auth(); // Await the auth result
  const { userId } = authResult;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userResult = await currentUser(); // Await the currentUser result
  const user = userResult;

  if (!user) {
    return new NextResponse("User not found", { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new NextResponse("OpenAI API key not configured", { status: 500 });
  }

  const taskId = uuidv4();
  await redis.set(
    `task:${taskId}`,
    JSON.stringify({ status: "processing", result: null }),
    "EX",
    3600
  );

  try {
    const body = await req.json();
    const { messages: chatMessages, chatId, isTemporary, files } = body;

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return new NextResponse("Invalid messages format", { status: 400 });
    }

    let fileContent = "";
    if (files && files.length > 0 && process.env.MISTRAL_API_KEY) {
      try {
        const mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
        for (const file of files) {
          if (file.type === "application/pdf" || file.type.startsWith("image/")) {
            // Create the content array with proper typing
            const contentArray: ContentChunk[] = [
              {
                type: "text",
                text: "Extract all text from the document."
              }
            ];

            // Add the appropriate content type based on file type
            if (file.type.startsWith("image/")) {
              contentArray.push({
                type: "image_url",
                imageUrl: file.url
              });
            } else {
              contentArray.push({
                type: "document_url",
                documentUrl: file.url
              });
            }

            const chatResponse = await mistralClient.chat.complete({
              model: "mistral-small-latest",
              messages: [
                {
                  role: "user",
                  content: contentArray
                }
              ]
            });

            // Handle potential undefined response
            if (!chatResponse.choices || chatResponse.choices.length === 0) {
              console.error("No choices returned in chat response");
              continue;
            }

            const extractedText = chatResponse.choices[0]?.message?.content;
            if (!extractedText) {
              console.error("No text extracted from chat response:", chatResponse);
              continue;
            }

            // Ensure extracted text is treated as string
            const textContent = typeof extractedText === 'string' 
              ? extractedText 
              : JSON.stringify(extractedText);

            console.log(`Extracted text from file "${file.name}":`, textContent);

            fileContent += `\n\nContent from file "${file.name}":\n${textContent}\n\n`;

            await addDocumentToVectorStore(textContent, {
              fileId: file.fileId || file.name,
              fileName: file.name,
            });
          }
        }
      } catch (error) {
        console.error("Error processing files with Mistral:", error);
      }
    }

    let chatIdToUse = chatId;
    if (!isTemporary) {
      try {
        if (!chatId) {
          const newChatId = uuidv4();
          const firstMessage = chatMessages[0].content;
          const chatTitle = firstMessage.length > 50 ? `${firstMessage.substring(0, 50)}...` : firstMessage;

          await db.insert(chats).values({
            id: newChatId,
            userId,
            title: chatTitle,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          chatIdToUse = newChatId;
        } else {
          const existingChat = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
          if (existingChat.length === 0) {
            return new NextResponse("Chat not found", { status: 404 });
          }
          await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
        }
      } catch (dbError) {
        console.error("Database error with chat:", dbError);
        return new NextResponse(
          JSON.stringify({ error: "Database error processing chat" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const currentMessageContent = chatMessages[chatMessages.length - 1].content;
    const formattedPreviousMessages = chatMessages.slice(0, -1).map(formatMessage);
    const userInput = fileContent ? `${currentMessageContent}\n\n${fileContent}` : currentMessageContent;

    const relevantDocs = await queryVectorStore(userInput, 3);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n");
    const augmentedInput = context ? `${userInput}\n\nRelevant Document Context:\n${context}` : userInput;

    const prompt = PromptTemplate.fromTemplate(TEMPLATE);
    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: "gpt-4o-mini",
      streaming: true,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const outputParser = new BytesOutputParser();
    const chain = prompt.pipe(model).pipe(outputParser);
    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"),
      input: augmentedInput,
    });

    if (!isTemporary && chatIdToUse) {
      try {
        const userMessage = chatMessages[chatMessages.length - 1];
        await db.insert(messages).values({
          id: uuidv4(),
          chatId: chatIdToUse,
          role: userMessage.role,
          content: userMessage.content,
          files: files ? JSON.stringify(files) : null,
          createdAt: new Date(),
        });
      } catch (dbError) {
        console.error("Database error with message:", dbError);
      }
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (!isTemporary && chatIdToUse) {
          await messageQueue.add("store-message", {
            chatId: chatIdToUse,
            content: assistantMessage,
            role: "assistant",
          });
        }
        await redis.set(
          `task:${taskId}`,
          JSON.stringify({ status: "completed", result: assistantMessage }),
          "EX",
          3600
        );
        break;
      }

      const chunk = decoder.decode(value);
      assistantMessage += chunk;
    }

    return new StreamingTextResponse(stream, { headers: { "X-Task-ID": taskId } });
  } catch (error) {
    console.error("Error in chat API:", error);
    await redis.set(
      `task:${taskId}`,
      JSON.stringify({ status: "failed", result: null }),
      "EX",
      3600
    );
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to process chat message",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}