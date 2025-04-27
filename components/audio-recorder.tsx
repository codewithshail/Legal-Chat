"use client";

import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
}

export function AudioRecorder({ onTranscriptionComplete, isRecording, setIsRecording }: AudioRecorderProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { startUpload } = useUploadThing("ocrFileUploader");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      
      // Create a File object from the Blob
      const file = new File([audioBlob], "recording.wav", { type: "audio/wav" });
      
      // Upload the audio file
      const uploadResult = await startUpload([file]);
      
      if (!uploadResult || uploadResult.length === 0) {
        throw new Error("Failed to upload audio file");
      }
      
      const audioUrl = uploadResult[0].url;
      
      // Send to transcription API
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl }),
      });
      
      if (!response.ok) {
        throw new Error("Transcription request failed");
      }
      
      const { taskId } = await response.json();
      
      // Poll for transcription result
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`/api/transcribe?taskId=${taskId}`);
        const statusData = await statusResponse.json();
        
        if (statusData.status === "completed" && statusData.result) {
          onTranscriptionComplete(statusData.result);
          break;
        } else if (statusData.status === "failed") {
          throw new Error("Transcription failed");
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error("Transcription timed out");
      }
      
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center space-x-2">
      {isRecording ? (
        <>
          <span className="text-red-500 animate-pulse mr-2">{formatTime(recordingTime)}</span>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={stopRecording}
            disabled={isTranscribing}
          >
            <Square className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={startRecording}
          disabled={isTranscribing}
          className="border-gray-600 text-white"
        >
          {isTranscribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}

