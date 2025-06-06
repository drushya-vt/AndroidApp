export type RootStackParamList = {
  Calendar: undefined;
  Transcription: undefined;
  TranscriptChat: undefined; 
  AskAllMemories: undefined;
  MemoryDetail: { memoryId?: string; mode?: 'view' | 'capture'; title?: string; timestamp?: string};
};