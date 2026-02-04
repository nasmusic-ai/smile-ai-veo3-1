import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// Helper to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type VideoQuality = 'fast' | 'high';

// Safe accessor for environment variables with fallback
export const getEnvApiKey = (): string | undefined => {
  try {
    const envKey = process.env.API_KEY;
    if (envKey && !envKey.includes("UNUSED_PLACEHOLDER") && !envKey.includes("INSERT_API_KEY")) {
      return envKey;
    }
    // Fallback to the specific key provided by user to fix configuration issues
    return "AIzaSyClN9faPK0phC6OB3OD-ODQiPTsivvjdfE";
  } catch {
    return "AIzaSyClN9faPK0phC6OB3OD-ODQiPTsivvjdfE";
  }
};

export const generateVeoVideo = async (
  imageBase64: string,
  mimeType: string,
  prompt: string,
  aspectRatio: AspectRatio,
  quality: VideoQuality,
  onProgress: (status: string) => void
): Promise<Blob> => {
  
  const apiKey = getEnvApiKey();
  
  // Fail fast if the key is the placeholder or missing
  // This explicitly prevents "UNUSED_PLACEHOLDER_FOR_API_KEY" from reaching the API
  if (!apiKey || apiKey.includes("UNUSED_PLACEHOLDER") || apiKey.includes("INSERT_API_KEY")) {
     throw new Error("Invalid API Key: The environment contains a placeholder key. Please connect a valid Google Cloud API key.");
  }

  // 1. Initialize API with the environment key (injected after user selection)
  const ai = new GoogleGenAI({ apiKey });

  // Determine model based on quality selection
  const modelName = quality === 'high' 
    ? 'veo-3.1-generate-preview' 
    : 'veo-3.1-fast-generate-preview';

  onProgress(`Initializing request with ${modelName}...`);

  // 2. Start the generation operation
  let operation = await ai.models.generateVideos({
    model: modelName,
    prompt: prompt || "Animate this image cinematically", // Fallback prompt if empty
    image: {
      imageBytes: imageBase64,
      mimeType: mimeType, 
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p', // Current limitation for fast-preview often 720p or 1080p, sticking to docs default/safe
      aspectRatio: aspectRatio,
    }
  });

  // 3. Poll for completion
  onProgress("Rendering video... This may take a minute.");
  
  while (!operation.done) {
    await wait(10000); // Poll every 10 seconds
    onProgress("Still dreaming... Refining frames...");
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  if (operation.error) {
    throw new Error(`Generation failed: ${operation.error.message || 'Unknown error'}`);
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo?.video?.uri) {
    throw new Error("No video URI returned from the API.");
  }

  onProgress("Downloading final video...");

  // 4. Fetch the actual video content
  // IMPORTANT: We must append the API Key to the download URL
  const downloadUrl = `${generatedVideo.video.uri}&key=${apiKey}`;
  
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  const videoBlob = await response.blob();
  return videoBlob;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};