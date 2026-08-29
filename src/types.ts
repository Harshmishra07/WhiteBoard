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
  | 'star'
  | 'callout'
  | 'diamond'
  | 'text' 
  | 'image'
  | 'table';

export interface Point {
  x: number;
  y: number;
}

export interface TableCellData {
  text: string;
  bgColor?: string;
  textColor?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
}

export interface TableData {
  rows: TableCellData[][];
  colWidths?: number[];
  rowHeights?: number[];
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
  fontWeight?: 'normal' | 'bold' | string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color: string; // Stroke color or text color
  fillColor?: string; // Optional background fill for shapes / cards
  isFilled?: boolean;
  strokeWidth: number;
  opacity: number;
  imageUrl?: string;
  borderRadius?: number;
  rotation?: number;
  tableData?: TableData;
}

export interface Slide {
  id: string;
  title: string;
  type: 'blank' | 'pdf' | 'ppt';
  backgroundType: BackgroundType;
  pdfPageNum?: number;
  pdfFileId?: string; // ID of the uploaded PDF or PPT file
  pptSlideNum?: number;
  pptFileId?: string;
  originalWidth?: number;
  originalHeight?: number;
  aspectRatio?: number;
  svgContent?: string;
  extractedText?: string; // Raw structured text content of slide for AI Assistant & search
  notesText?: string; // Speaker notes or extra annotations
  vectorElements: VectorElement[];
  undoStack: VectorElement[][];
  redoStack: VectorElement[][];
  drawingDataUrl?: string; // Legacy fallback for older saved sessions
}

export interface DocumentFile {
  id: string;
  name: string;
  type: 'pdf' | 'ppt';
  url?: string;
  totalPages: number;
}

export interface PDFFile {
  id: string;
  name: string;
  url: string; // Object URL or Base64 URL of the PDF
  totalPages: number;
}

