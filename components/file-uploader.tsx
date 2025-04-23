"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";

interface FileUploaderProps {
  onUpload: (files: { url: string; type: string; name: string; fileId?: string }[]) => void;
  onCancel: () => void;
  isUploading: boolean;
  setIsUploading: (isUploading: boolean) => void;
}

export function FileUploader({ onUpload, onCancel, isUploading, setIsUploading }: FileUploaderProps) {
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading: uploadThingUploading } = useUploadThing("ocrFileUploader", {
    onClientUploadComplete: (res) => {
      if (res) {
        const uploadedFiles = res.map((file) => ({
          url: file.url,
          type: file.type,
          name: file.name,
          fileId: file.key,
        }));
        onUpload(uploadedFiles);
        toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
        setProgress(100);
        setIsUploading(false);
      }
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
      toast.error("Upload failed. Please try again.");
      setIsUploading(false);
      setProgress(0);
    },
    onUploadProgress: (p) => {
      setProgress(p);
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsUploading(true);
      await startUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      await startUpload(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          dragActive ? "border-purple-500 bg-purple-500/10" : "border-gray-600"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {isUploading || uploadThingUploading ? (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
            <p className="text-sm text-gray-400">Uploading files...</p>
            <Progress value={progress} className="h-2 w-full" />
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
            <p className="mb-2 text-sm text-gray-400">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PDF, Images (max 4MB), or PDFs (max 16MB)</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
            <Button type="button" variant="outline" className="mt-4 border-gray-600 text-white" onClick={() => inputRef.current?.click()}>
              Select Files
            </Button>
          </>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isUploading || uploadThingUploading} className="border-gray-600 text-white">
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}