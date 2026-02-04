export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  POLLING = 'POLLING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface GeneratedVideo {
  uri: string;
  mimeType: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isApproved: boolean;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  timestamp: number;
}

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
}

// Augment the existing AIStudio type from the environment
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}