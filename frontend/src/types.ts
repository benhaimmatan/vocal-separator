export interface ProcessedFile {
  id: string;
  originalName: string;
  dateProcessed: string;
  directory: string;
  files: {
    original: string;
    vocals: string | null;
    accompaniment: string | null;
    piano?: string;
  };
}

export interface LibraryState {
  files: ProcessedFile[];
  selectedFile: ProcessedFile | null;
  isLoading: boolean;
  error: string | null;
}

export interface OutputOptions {
  vocals: boolean;
  accompaniment: boolean;
}

export interface YouTubeDownloadRequest {
  url: string;
  outputOptions: OutputOptions;
} 