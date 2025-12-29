export interface ProcessedFile {
  id: string;
  originalName: string;
  dateProcessed: string;
  directory?: string;
  source?: string;
  files: {
    original: string;
    vocals?: string;
    accompaniment?: string;
    piano?: string;
    midi?: string;
  };
}

export interface LibraryState {
  files: ProcessedFile[];
  selectedFile: ProcessedFile | null;
  isLoading: boolean;
  error: string | null;
}

export interface AudioFiles {
  original?: string;
  vocals?: string;
  accompaniment?: string;
  piano?: string;
  midi?: string;
} 