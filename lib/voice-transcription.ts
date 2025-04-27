  // Add voice transcription functionality
  import { v4 as uuidv4 } from "uuid";
  import IORedis from "ioredis";

  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

  interface TranscriptionResult {
    text: string;
    taskId: string;
  }

  export async function transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
    const taskId = uuidv4();
    
    try {
      // Store task status in Redis
      await redis.set(
        `transcription:${taskId}`,
        JSON.stringify({ status: "processing", result: null }),
        "EX",
        3600
      );
      
      // Call Replicate API for transcription
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        },
        body: JSON.stringify({
          version: "3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
          input: {
            task: "transcribe",
            audio: audioUrl,
            language: "None",
            timestamp: "chunk",
            batch_size: 64,
            diarise_audio: false
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.status}`);
      }
      
      const prediction = await response.json();
      
      // Poll for results
      let result = null;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
        });
        
        if (!statusResponse.ok) {
          throw new Error(`Replicate API status error: ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === "succeeded") {
          result = statusData.output;
          break;
        } else if (statusData.status === "failed") {
          throw new Error("Transcription failed");
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      if (!result) {
        throw new Error("Transcription timed out");
      }
      
      // Extract text from result
      let transcribedText = "";
      if (Array.isArray(result)) {
        transcribedText = result.join(" ");
      } else if (typeof result === "string") {
        transcribedText = result;
      } else if (result.text) {
        transcribedText = result.text;
      }
      
      // Update Redis with completed status
      await redis.set(
        `transcription:${taskId}`,
        JSON.stringify({ status: "completed", result: transcribedText }),
        "EX",
        3600
      );
      
      return { text: transcribedText, taskId };
    } catch (error) {
      console.error("Transcription error:", error);
      
      // Update Redis with failed status
      await redis.set(
        `transcription:${taskId}`,
        JSON.stringify({ status: "failed", result: null }),
        "EX",
        3600
      );
      
      throw error;
    }
  }

  export async function getTranscriptionStatus(taskId: string): Promise<{ status: string; result: string | null }> {
    try {
      const data = await redis.get(`transcription:${taskId}`);
      
      if (!data) {
        return { status: "not_found", result: null };
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error("Error getting transcription status:", error);
      return { status: "error", result: null };
    }
  }
  
