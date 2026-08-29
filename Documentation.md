# Let Study - Interactive Whiteboard, PDF & PPT Annotator

## Overview

**Let Study** is a modern, high-performance web application designed for interactive teaching, presentation, and study sessions. It provides an intuitive canvas for sketching, taking notes, creating vector shapes, and annotating multi-page PDF documents and PowerPoint (PPT/PPTX) presentations.

---

## Key Features

### 1. Canvas & Background Styles
- **Plain Whiteboard**: Traditional clean white canvas for high contrast.
- **Dark Blackboard**: Pure black board optimized for white and vibrant chalk-like ink.
- **Green Chalkboard**: Classic deep-green classroom chalkboard.
- **Warm Cream Paper**: Soft-toned background suited for extended reading and note-taking.
- **Math/Graph Grid**: Blueprint-style coordinate grid for technical drawings and math equations.
- **Lined Writing Paper**: Notebook-style ruled lines for handwriting and structured notes.

### 2. Comprehensive Drawing & Annotation Tools
- **Freehand Pen**: Smooth stroke rendering with configurable thickness and color.
- **Highlighter**: Semi-transparent marker tool for emphasizing text and shapes.
- **Vector Shapes**:
  - **Arrow**: Sharp, vector-calculated arrows with miter joints and indented head geometry.
  - **Line**: Straight vector lines.
  - **Rectangle, Circle, & Triangle**: Standard geometric shape tools.
- **Text Insertion**: Interactive text blocks with custom sizing, colors, and line breaks.
- **Precision Eraser**: Dynamic circular eraser scaled according to brush size.
- **Pan & Zoom**: Fluid canvas navigation with mouse dragging or pinch-to-zoom gestures.

### 3. Adaptive Cursor System
- **Dynamic Color Adaptation**: Drawing cursors automatically adjust based on the current slide background:
  - **Black Cursors**: Used on light boards (White, Cream, Grid, Ruled).
  - **White Cursors**: Used on dark boards (Blackboard, Green Chalkboard).
- **Tool-Specific Indicators**: Custom SVG cursors for Pen, Eraser, Text, Pan (Open/Closed hand), and Precision Crosshairs.

### 4. Multi-Document Import (PDF & PowerPoint)
- **PDF Document Import**: Load multi-page PDF files, which are automatically parsed and rendered page-by-page into full-resolution whiteboard slides.
- **PowerPoint Presentation Import (PPTX / PPT)**: Client-side extraction of shapes, text frames, theme colors, tables, and media from PPTX presentation archives rendered directly onto high-definition canvas slides.
- **Slide Interspersing**: Insert blank whiteboards, blackboards, or math grids between imported slides for working out equations or writing side-notes.
- **Slide Navigation**: Rearrange, add, duplicate, or delete slides with the slide drawer on the right.
- **Export Capabilities**: Export individual high-resolution PNG images or compile all annotated slides back into a combined multi-page PDF document.

### 5. UI & Ergonomics
- **Dark & Light Interface Modes**: Comfortable theme switching for night or daylight environments.
- **Header Collapsing**: Maximize active screen real estate for teaching and tablet devices.
- **Undo / Redo History**: Complete action tracking per slide to allow easy revision.
- **Local Autosave**: Protects work and drawing timelines against accidental tab closures.

---

## Tech Stack & Architecture

- **Frontend Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Processing**: `pdfjs-dist`
- **Animations**: `framer-motion`

---

## Project Structure

```
├── index.html                  # HTML Entry Point
├── metadata.json               # App Metadata & Capabilities
├── package.json                # Project Dependencies & Scripts
├── src/
│   ├── main.tsx                # Application Bootstrapper
│   ├── App.tsx                 # Core Application Layout & State Container
│   ├── types.ts                # Shared TypeScript Interfaces & Data Models
│   ├── components/
│   │   ├── DrawingCanvas.tsx   # Canvas Engine, Rendering Logic, & Cursor Handlers
│   │   ├── Toolbar.tsx         # Primary Tool Palette (Pen, Shapes, Colors, Sizes)
│   │   ├── SlideSelector.tsx   # Right-Side Slide Drawer & Background Switcher
│   │   └── StyleSettings.tsx  # Secondary Toolbar for Backgrounds & Color Options
│   └── lib/
│       ├── vector.ts           # Vector Math, Shape Geometries, & Arrow Renderer
│       └── pdfUtils.ts         # PDF File Parsing & Canvas Rasterization Utilities
└── Documentation.md            # Project Documentation
```

---

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **bun**

### Installation
```bash
npm install
```

### Development Server
Run the local dev server:
```bash
npm run dev
```

### Build for Production
Compile the production bundle:
```bash
npm run build
```

---

## License

Created with Google AI Studio.
