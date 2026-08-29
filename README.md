# Let Study - User Manual & Operating Guide

Welcome to **Let Study**, an interactive whiteboard and PDF annotation web application built for teaching, studying, sketching, and presenting.

---

## Table of Contents

1. [How to Launch & Open the Application](#1-how-to-launch--open-the-application)
2. [User Manual: Operating the Web App](#2-user-manual-operating-the-web-app)
   - [Toolbar & Primary Drawing Tools](#toolbar--primary-drawing-tools)
   - [Adding & Changing Slide Backgrounds](#adding--changing-slide-backgrounds)
   - [Uploading & Annotating PDFs](#uploading--annotating-pdfs)
   - [Managing Slides](#managing-slides)
   - [Canvas Navigation (Pan & Zoom)](#canvas-navigation-pan--zoom)
   - [Presentation & Interface Modes](#presentation--interface-modes)
3. [Shortcuts & Quick Reference](#3-shortcuts--quick-reference)
4. [Developer Setup](#4-developer-setup)

---

## 1. How to Launch & Open the Application

### Option A: Web Browser Access
1. Open any modern web browser (**Google Chrome**, **Mozilla Firefox**, **Microsoft Edge**, or **Safari**).
2. Navigate to your deployed **Let Study** URL.
3. The app will load instantly without requiring sign-in or installation.

### Option B: Running Locally (Development Mode)
If you are running the project on your machine:
1. Ensure Node.js (v18+) is installed.
2. Open your terminal in the project root directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`.

---

## 2. User Manual: Operating the Web App

### Toolbar & Primary Drawing Tools

The top floating toolbar provides quick access to all drawing tools, styling controls, and history actions:

| Tool Icon | Tool Name | Description & Usage |
| :--- | :--- | :--- |
| **Pen** | Freehand Pen | Click and drag on the canvas to draw smooth freehand strokes. |
| **Highlighter** | Semi-Transparent Marker | Highlight key text or diagram sections with non-obscuring ink. |
| **Eraser** | Dynamic Eraser | Erase drawn paths and annotations. The eraser cursor resizes dynamically with the chosen brush size. |
| **Text (T)** | Text Box | Click anywhere on the canvas to insert a text box. Type your notes and press `Escape` or click outside when finished. |
| **Shapes** | Vector Geometry | Click the Shape tool to choose between **Arrow**, **Straight Line**, **Rectangle**, **Circle**, or **Triangle**. Drag on the canvas to draw the shape. |
| **Hand (Pan)** | Canvas Pan | Click and drag to move around the infinite canvas area without drawing. |
| **Color Picker** | Ink Palette | Select from pre-set colors (Black, White, Red, Blue, Green, Yellow, etc.) or open the custom color wheel. |
| **Brush Size** | Stroke Thickness | Slider to adjust pen width, highlighter thickness, or shape borders. |
| **Undo / Redo** | History Buttons | Revert or re-apply recent drawing actions. |
| **Clear Slide** | Trash Icon | Clears all drawing annotations on the active slide. |

---

### Adding & Changing Slide Backgrounds

**Let Study** supports multiple background board types designed for different study environments:

1. **Pure Dark Blackboard**: Pitch-black canvas with white adaptive cursors and high contrast for vibrant chalk drawing.
2. **Plain Whiteboard**: Classic clean white background.
3. **Green Chalkboard**: Traditional classroom green board.
4. **Math Grid**: Blueprint grid ideal for math equations, geometry, and graph plotting.
5. **Lined Writing Paper**: Horizontal ruled lines for structured notes and handwriting practice.
6. **Warm Cream Paper**: Soft ivory tone for comfortable long-duration reading.

**To change background on the current slide:**
- Click the **Background / Style Settings** button on the toolbar or slide drawer to select your desired board style.

---

### Uploading & Annotating PDFs & PowerPoint Presentations

1. **Import Document**: Click the **Import** button located in the right-side Slide Drawer.
2. Select any **PDF document** (`.pdf`) or **PowerPoint presentation** (`.pptx`, `.ppt`) from your device.
3. **Let Study** automatically detects the file format and converts each page or slide into an individual high-definition whiteboard slide.
4. Use the **Pen**, **Highlighter**, **Text**, or **Shapes** tools to write, mark, diagram, or highlight directly on top of the imported slides.
5. You can insert new blank whiteboards, blackboards, or math grids between imported presentation slides at any time.

---

### Managing Slides

Open the **Right Slide Drawer** by clicking the Layers/Slide Panel icon on the right edge of the screen:

- **Add New Blank Slide**: Click **+ Slide** and select the background type (Whiteboard, Black Board, Green Chalkboard, Math Grid, Warm Cream, or Ruled Lines).
- **Import Documents**: Click **Import** to import PDF workbooks or PowerPoint presentation decks with a single click.
- **Navigate Between Slides**: Click on any slide thumbnail in the drawer or use the Up/Down arrow buttons.
- **Delete Slide**: Hover over any slide thumbnail and click the **Trash** icon.

---

### Canvas Navigation (Pan & Zoom)

- **Panning (Moving the Canvas)**:
  - Select the **Pan (Hand)** tool from the toolbar and drag anywhere on the canvas.
  - Alternatively, hold down the `Spacebar` while dragging with any tool selected.
  - Mouse wheel users: Click and hold the Middle Mouse Button (scroll wheel) to pan.
- **Zooming**:
  - Scroll your mouse wheel while holding `Ctrl` (or `Cmd` on Mac) to zoom in and out.
  - On touch devices, use a pinch-to-zoom gesture on the canvas.

---

### Presentation & Interface Modes

- **Presentation Mode**: Click the **Presentation Mode** button in the top header to hide all editing panels and view your slides in distraction-free fullscreen mode.
- **Dark / Light Application Theme**: Click the **Sun / Moon** icon in the header to switch the surrounding interface theme between Dark and Light mode.

---

## 3. Shortcuts & Quick Reference

| Action | Shortcut |
| :--- | :--- |
| **Pan Canvas** | Hold `Spacebar` + Drag |
| **Zoom In / Out** | `Ctrl` + Scroll Wheel / Pinch |
| **Undo** | `Ctrl + Z` / `Cmd + Z` |
| **Redo** | `Ctrl + Y` / `Cmd + Shift + Z` |
| **Deselect Text / Exit Editing** | `Escape` |

---

## 4. Developer Setup

To modify or build the application:

```bash
# Clone or open project folder
cd let-study

# Install dependencies
npm install

# Run TypeScript linter
npm run lint

# Build for production
npm run build
```

---

*Thank you for using **Let Study**! Enjoy your teaching and learning sessions.*
