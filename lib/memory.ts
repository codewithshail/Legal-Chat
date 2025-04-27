  // Add memory system for AI to remember important user information
  import IORedis from "ioredis";

  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  const MEMORY_EXPIRY = 60 * 60 * 24 * 30; // 30 days

  interface MemoryItem {
    type: string;
    value: string;
    timestamp: number;
    confidence: number;
  }

  export async function storeMemory(userId: string, key: string, value: string, type: string, confidence = 0.8) {
    const memoryKey = `memory:${userId}`;
    const item: MemoryItem = {
      type,
      value,
      timestamp: Date.now(),
      confidence,
    };
    
    try {
      // Get existing memories
      const existingMemoriesStr = await redis.hget(memoryKey, key);
      let memories: MemoryItem[] = [];
      
      if (existingMemoriesStr) {
        memories = JSON.parse(existingMemoriesStr);
        // If same type exists, update it
        const existingIndex = memories.findIndex(m => m.type === type);
        if (existingIndex >= 0) {
          // Only update if new confidence is higher
          if (item.confidence > memories[existingIndex].confidence) {
            memories[existingIndex] = item;
          }
        } else {
          memories.push(item);
        }
      } else {
        memories = [item];
      }
      
      await redis.hset(memoryKey, key, JSON.stringify(memories));
      await redis.expire(memoryKey, MEMORY_EXPIRY);
      
      return true;
    } catch (error) {
      console.error("Error storing memory:", error);
      return false;
    }
  }

  export async function getMemories(userId: string): Promise<Record<string, MemoryItem[]>> {
    const memoryKey = `memory:${userId}`;
    
    try {
      const allMemories = await redis.hgetall(memoryKey);
      const result: Record<string, MemoryItem[]> = {};
      
      for (const [key, value] of Object.entries(allMemories)) {
        result[key] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      console.error("Error retrieving memories:", error);
      return {};
    }
  }

  export async function extractMemories(text: string): Promise<Record<string, string>> {
    // Simple pattern matching for common personal information
    const patterns = {
      name: /my name is ([A-Za-z\s]+)/i,
      email: /my email (?:address )?is ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      phone: /my (?:phone|mobile) (?:number )?is ([0-9+\s-]{10,15})/i,
      location: /(?:i live in|i am from|i reside in) ([A-Za-z\s,]+)/i,
      occupation: /(?:i work as|i am a|my job is) ([A-Za-z\s]+)/i,
    };
    
    const memories: Record<string, string> = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        memories[key] = match[1].trim();
      }
    }
    
    return memories;
  }
  
