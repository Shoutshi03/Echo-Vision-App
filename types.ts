
export interface Transcription {
  text: string;
  type: 'user' | 'model';
  timestamp: number;
}

export enum SessionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  ANALYZING = 'ANALYZING',
  SEARCHING = 'SEARCHING'
}

export type AppMode = 'LIVE' | 'GALLERY';
