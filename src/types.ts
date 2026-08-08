export type Tool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'triangle' | 'pan';

export type BackgroundType = 'white' | 'cream' | 'grid' | 'ruled' | 'chalkboard' | 'blackboard';

export type VectorElementType = 
  | 'pen' 
  | 'highlighter' 
  | 'eraser' 
  | 'line' 
  | 'arrow' 
  | 'rectangle' 
  | 'circle' 
  | 'triangle' 
  | 'text' 
  | 'image';

export interface Point {
  x: number;
  y: number;
}

export interface VectorElement {
  id: string;
  type: VectorElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[]; // Array of points for freehand paths
  x2?: number; // End X for line / arrow
  y2?: number; // End Y for line / arrow
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color: string;
  strokeWidth: number;
  opacity: number;
  imageUrl?: string;
}

export interface Slide {
  id: string;
  title: string;
  type: 'blank' | 'pdf';
  backgroundType: BackgroundType;
  pdfPageNum?: number;
  pdfFileId?: string; // ID of the uploaded PDF file
  vectorElements: VectorElement[];
  undoStack: VectorElement[][];
  redoStack: VectorElement[][];
  drawingDataUrl?: string; // Legacy fallback for older saved sessions
}

export interface PDFFile {
  id: string;
  name: string;
  url: string; // Object URL or Base64 URL of the PDF
  totalPages: number;
}
