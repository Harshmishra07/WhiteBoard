import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Slide, Tool, BackgroundType, VectorElement } from './types';
import { getPdfInfo, renderPdfPage } from './lib/pdfLoader';
import { renderVectorElements } from './lib/vector';

import DrawingCanvas from './components/DrawingCanvas';
import Toolbar from './components/Toolbar';
import SlideSelector from './components/SlideSelector';

import { useAutosaveSession } from './hooks/useAutosaveSession';

import {
  Sparkles,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileDown,
  Info,
  HelpCircle,
  Presentation,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  History,
  Sun,
  Moon,
} from 'lucide-react';

const INITIAL_SLIDE: Slide = {
  id: 'slide-initial-whiteboard',
  title: 'Whiteboard',
  type: 'blank',
  backgroundType: 'white',
  vectorElements: [],
  drawingDataUrl: undefined,
  undoStack: [],
  redoStack: [],
};

export default function App() {
  const [slides, setSlides] = useState<Slide[]>([INITIAL_SLIDE]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('board-dark-mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('board-dark-mode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);
  
  // Style and drawing states
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>('#ef4444'); // Start with Red - ideal for teachers to correct/point
  const [brushSize, setBrushSize] = useState<number>(5);
  const [opacity, setOpacity] = useState<number>(0.45); // highlighter opacity
  const [fontSize, setFontSize] = useState<number>(24);
  const [fontFamily, setFontFamily] = useState<string>('Inter');

  // Zoom & Pan states
  const [scale, setScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [pdfPageImages, setPdfPageImages] = useState<Record<string, string>>({});
  const [pdfPageDimensions, setPdfPageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  // Panel Collapsed States for maximizing whiteboard workspace
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);

  const activeSlide = slides[activeSlideIndex];

  // Helper: Tool selection with specific tool defaults
  const handleSelectTool = useCallback((newTool: Tool) => {
    setTool(newTool);
    if (newTool === 'highlighter') {
      if (brushSize < 16) {
        setBrushSize(24);
      }
      if (color === '#ef4444' || color === '#000000' || color === '#ffffff' || color === '#3b82f6') {
        setColor('#facc15'); // vibrant highlight yellow
      }
      setOpacity(0.40);
    } else if (newTool === 'pen') {
      if (brushSize > 16) {
        setBrushSize(5);
      }
      if (color === '#facc15' || color === '#fef08a') {
        setColor('#ef4444'); // red pen for correcting/annotating
      }
    }
  }, [brushSize, color]);

  // Helper: Get active canvas size dynamically
  const getActiveCanvasSize = useCallback((slide: Slide) => {
    if (slide.type === 'pdf' && slide.pdfFileId && slide.pdfPageNum) {
      const pageKey = `${slide.pdfFileId}-${slide.pdfPageNum}`;
      const dimensions = pdfPageDimensions[pageKey];
      if (dimensions) {
        return dimensions;
      }
    }
    return { width: 1920, height: 1080 }; // standard presentation size (16:9)
  }, [pdfPageDimensions]);

  const activeCanvasSize = getActiveCanvasSize(activeSlide);

  // Default 100% zoom centering logic
  const centerAt100Percent = useCallback((canvasW: number, canvasH: number) => {
    const workspace = document.getElementById('canvas-workspace');
    if (!workspace) return false;
    const viewW = workspace.clientWidth;
    const viewH = workspace.clientHeight;

    if (viewW <= 0 || viewH <= 0) return false;

    const targetScale = 1.0;
    const offsetX = (viewW - canvasW * targetScale) / 2;
    const offsetY = (viewH - canvasH * targetScale) / 2;

    setScale(targetScale);
    setPanOffset({ x: offsetX, y: offsetY });
    return true;
  }, []);

  // Auto-fit to screen calculation
  const triggerAutoFit = useCallback((canvasW: number, canvasH: number) => {
    const workspace = document.getElementById('canvas-workspace');
    if (!workspace) return false;
    const viewW = workspace.clientWidth;
    const viewH = workspace.clientHeight;

    if (viewW <= 0 || viewH <= 0) return false; // Guard against 0 or negative dimensions

    const padding = 48; // comfortable viewing padding
    const targetW = viewW - padding;
    const targetH = viewH - padding;

    const scaleX = targetW / canvasW;
    const scaleY = targetH / canvasH;
    const newScale = Math.max(0.1, Math.min(scaleX, scaleY, 2.5)); // Ensure positive, sensible minimum scale

    // Centering offsets
    const offsetX = (viewW - canvasW * newScale) / 2;
    const offsetY = (viewH - canvasH * newScale) / 2;

    setScale(newScale);
    setPanOffset({ x: offsetX, y: offsetY });
    return true;
  }, []);

  // Fit screen on load, change slide, panel toggle, or workspace container resize
  useEffect(() => {
    let active = true;
    let retryTimeout: NodeJS.Timeout;
    let resizeObserver: ResizeObserver | null = null;

    const attemptFit = () => {
      if (!active) return;
      
      const workspace = document.getElementById('canvas-workspace');
      if (workspace && workspace.clientWidth > 0 && workspace.clientHeight > 0) {
        // Successfully centered and fitted the page!
        triggerAutoFit(activeCanvasSize.width, activeCanvasSize.height);
        
        // Register ResizeObserver if not already registered
        if (!resizeObserver) {
          resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const { width: viewW, height: viewH } = entry.contentRect;
              if (viewW > 0 && viewH > 0) {
                triggerAutoFit(activeCanvasSize.width, activeCanvasSize.height);
              }
            }
          });
          resizeObserver.observe(workspace);
        }
      } else {
        // Retry shortly if workspace is not in DOM yet or has 0 dimensions
        retryTimeout = setTimeout(attemptFit, 100);
      }
    };

    attemptFit();

    return () => {
      active = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      clearTimeout(retryTimeout);
    };
  }, [
    activeSlideIndex,
    activeCanvasSize.width,
    activeCanvasSize.height,
    triggerAutoFit,
  ]);

  // Toast notifier
  const triggerToast = useCallback((msg: string) => {
    setShowNotification(msg);
  }, []);

  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  // Autosave Session Hook
  const { hasSavedSession, loadSession, clearSession } = useAutosaveSession(
    slides,
    activeSlideIndex,
    pdfPageImages,
    pdfPageDimensions,
    triggerToast
  );

  const handleLoadSession = () => {
    const saved = loadSession();
    if (saved) {
      setSlides(saved.slides);
      setActiveSlideIndex(saved.activeSlideIndex);
      setPdfPageImages(saved.pdfPageImages || {});
      setPdfPageDimensions(saved.pdfPageDimensions || {});
      if (saved.partialSave) {
        triggerToast('Previous whiteboard drawings restored! (PDF backgrounds were too large to restore)');
      } else {
        triggerToast('Previous session loaded successfully!');
      }
    } else {
      triggerToast('No saved session found.');
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcut keys if writing in text inputs
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'p') {
        setTool('pen');
        triggerToast('Selected tool: Pen');
      } else if (e.key.toLowerCase() === 'h') {
        setTool('highlighter');
        triggerToast('Selected tool: Highlighter');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
        triggerToast('Selected tool: Eraser');
      } else if (e.key.toLowerCase() === 't') {
        setTool('text');
        triggerToast('Selected tool: Text Annotation');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlideIndex, slides]);

  // Undo / Redo Actions
  const handleUndo = () => {
    const slide = slides[activeSlideIndex];
    const undoStack = slide.undoStack || [];
    if (undoStack.length === 0) return;

    const newUndo = [...undoStack];
    const previousState = newUndo.pop() || [];
    const currentState = slide.vectorElements || [];
    const newRedo = [currentState, ...(slide.redoStack || [])];

    const updatedSlides = [...slides];
    updatedSlides[activeSlideIndex] = {
      ...slide,
      vectorElements: previousState,
      undoStack: newUndo,
      redoStack: newRedo,
    };
    setSlides(updatedSlides);
    triggerToast('Action Undone');
  };

  const handleRedo = () => {
    const slide = slides[activeSlideIndex];
    const redoStack = slide.redoStack || [];
    if (redoStack.length === 0) return;

    const newRedo = [...redoStack];
    const nextState = newRedo.shift() || [];
    const currentState = slide.vectorElements || [];
    const newUndo = [...(slide.undoStack || []), currentState];

    const updatedSlides = [...slides];
    updatedSlides[activeSlideIndex] = {
      ...slide,
      vectorElements: nextState,
      undoStack: newUndo,
      redoStack: newRedo,
    };
    setSlides(updatedSlides);
    triggerToast('Action Redone');
  };

  // Save vector elements state
  const saveVectorElements = (
    vectorElements: VectorElement[],
    undoStack: VectorElement[][],
    redoStack: VectorElement[][]
  ) => {
    const updatedSlides = [...slides];
    updatedSlides[activeSlideIndex] = {
      ...slides[activeSlideIndex],
      vectorElements,
      undoStack,
      redoStack,
    };
    setSlides(updatedSlides);
  };

  // Clear current drawing
  const handleClearSlide = () => {
    const slide = slides[activeSlideIndex];
    if ((!slide.vectorElements || slide.vectorElements.length === 0) && !slide.drawingDataUrl) return;

    // Push current state to undo before clearing
    const currentElements = slide.vectorElements || [];
    const newUndo = [...(slide.undoStack || []), currentElements];
    const updatedSlides = [...slides];
    updatedSlides[activeSlideIndex] = {
      ...slide,
      vectorElements: [],
      drawingDataUrl: undefined,
      undoStack: newUndo,
      redoStack: [],
    };
    setSlides(updatedSlides);
    triggerToast('Drawings Cleared (Undo is available!)');
  };

  // Symmetrically adjust zoom centered around the viewport midpoint
  const adjustZoom = (delta: number) => {
    const workspace = document.getElementById('canvas-workspace');
    if (!workspace) {
      setScale((prev) => Math.min(Math.max(prev + delta, 0.2), 4.0));
      return;
    }

    const viewW = workspace.clientWidth;
    const viewH = workspace.clientHeight;
    if (viewW <= 0 || viewH <= 0) {
      setScale((prev) => Math.min(Math.max(prev + delta, 0.2), 4.0));
      return;
    }

    // Midpoint of the visible viewport
    const vX = viewW / 2;
    const vY = viewH / 2;

    // Use current scale and panOffset to calculate new values
    const nextScale = Math.min(Math.max(scale + delta, 0.2), 4.0);
    const cX = (vX - panOffset.x) / scale;
    const cY = (vY - panOffset.y) / scale;

    setPanOffset({
      x: vX - cX * nextScale,
      y: vY - cY * nextScale,
    });
    setScale(nextScale);
  };

  const handleZoomIn = () => {
    adjustZoom(0.15);
  };

  const handleZoomOut = () => {
    adjustZoom(-0.15);
  };

  // Add standard blank whiteboard slide
  const handleAddBlankSlide = (bgType: BackgroundType) => {
    const newId = `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSlide: Slide = {
      id: newId,
      title: bgType.charAt(0).toUpperCase() + bgType.slice(1) + ' Board',
      type: 'blank',
      backgroundType: bgType,
      vectorElements: [],
      drawingDataUrl: undefined,
      undoStack: [],
      redoStack: [],
    };

    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length); // auto transition to new slide
    triggerToast(`Added blank ${bgType} board`);
  };

  // Delete slide
  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return;

    const slideTitle = slides[index].title;
    const newSlides = slides.filter((_, i) => i !== index);
    
    // Adjust active pointer
    let newIndex = activeSlideIndex;
    if (activeSlideIndex >= newSlides.length) {
      newIndex = newSlides.length - 1;
    } else if (activeSlideIndex === index && index > 0) {
      newIndex = index - 1;
    }

    setSlides(newSlides);
    setActiveSlideIndex(newIndex);
    triggerToast(`Deleted slide "${slideTitle}"`);
  };

  // Set Background Type
  const handleSetBackgroundType = (type: BackgroundType) => {
    const updatedSlides = [...slides];
    updatedSlides[activeSlideIndex] = {
      ...slides[activeSlideIndex],
      backgroundType: type,
    };
    setSlides(updatedSlides);
  };

  // PDF Uploader and process page converter
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF document.');
      return;
    }

    setIsUploadingPdf(true);
    triggerToast('Reading PDF structure...');

    try {
      const fileUrl = URL.createObjectURL(file);
      const totalPages = await getPdfInfo(fileUrl);
      const fileId = `pdf-${Date.now()}`;
      
      const newSlidesToAppend: Slide[] = [];
      const renderedImages: Record<string, string> = {};
      const renderedDimensions: Record<string, { width: number; height: number }> = {};

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        triggerToast(`Rendering page ${pageNum} of ${totalPages}...`);
        
        // Render page with maximum dimension cap (e.g., 1600px for superb quality & memory efficiency)
        const renderedPage = await renderPdfPage(fileUrl, pageNum, 1600);
        const pageKey = `${fileId}-${pageNum}`;

        renderedImages[pageKey] = renderedPage.dataUrl;
        renderedDimensions[pageKey] = {
          width: renderedPage.width,
          height: renderedPage.height,
        };

        const pageTitle = `${file.name.replace('.pdf', '')} - P. ${pageNum}`;
        newSlidesToAppend.push({
          id: `slide-pdf-${fileId}-${pageNum}`,
          title: pageTitle,
          type: 'pdf',
          backgroundType: 'white',
          pdfPageNum: pageNum,
          pdfFileId: fileId,
          vectorElements: [],
          drawingDataUrl: undefined,
          undoStack: [],
          redoStack: [],
        });
      }

      // Update slide collection and rendered maps
      setPdfPageImages((prev) => ({ ...prev, ...renderedImages }));
      setPdfPageDimensions((prev) => ({ ...prev, ...renderedDimensions }));
      
      // If the current slide is just the initial empty un-sketched whiteboard, replace it!
      // Otherwise, append the PDF pages. This makes it smooth and clutter-free on first upload.
      const isInitialEmptySlide = 
        slides.length === 1 && 
        slides[0].id === 'slide-initial-whiteboard' && 
        !slides[0].drawingDataUrl;

      if (isInitialEmptySlide) {
        setSlides(newSlidesToAppend);
        setActiveSlideIndex(0);
      } else {
        setSlides((prev) => [...prev, ...newSlidesToAppend]);
        setActiveSlideIndex(slides.length); // Focus onto the first appended page
      }

      triggerToast(`Loaded ${totalPages} pages from PDF!`);
    } catch (err: any) {
      console.error(err);
      alert(`Error loading PDF: ${err.message || err}`);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Combined offscreen canvas renderer for exporting
  const renderSlideToMergedCanvas = (slide: Slide): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const size = getActiveCanvasSize(slide);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(canvas);
        return;
      }

      // Draw background
      if (slide.type === 'pdf' && slide.pdfFileId && slide.pdfPageNum) {
        const pageKey = `${slide.pdfFileId}-${slide.pdfPageNum}`;
        const bgImgSrc = pdfPageImages[pageKey];
        if (bgImgSrc) {
          const bgImg = new Image();
          bgImg.src = bgImgSrc;
          bgImg.onload = () => {
            ctx.drawImage(bgImg, 0, 0, size.width, size.height);
            drawForeground();
          };
          return;
        }
      }

      // Fallback: Draw solid/textured background for Blank slides
      ctx.fillStyle = 
        slide.backgroundType === 'chalkboard'
          ? '#143d28'
          : slide.backgroundType === 'blackboard'
          ? '#000000'
          : slide.backgroundType === 'cream' || slide.backgroundType === 'ruled'
          ? '#fdfbf7'
          : '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);

      if (slide.backgroundType === 'grid') {
        // Draw grid
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = gridSize; x < size.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size.height);
          ctx.stroke();
        }
        for (let y = gridSize; y < size.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size.width, y);
          ctx.stroke();
        }
      } else if (slide.backgroundType === 'ruled') {
        // Draw lines
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.lineWidth = 1.5;
        const spacing = 32;
        const topMargin = spacing * 3;
        for (let y = topMargin; y < size.height; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size.width, y);
          ctx.stroke();
        }
        // Red line
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(150, 0);
        ctx.lineTo(150, size.height);
        ctx.stroke();
      } else if (slide.backgroundType === 'chalkboard') {
        // Add subtle chalkboard noise/dust
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        for (let i = 0; i < 20; i++) {
          ctx.beginPath();
          ctx.arc(Math.random() * size.width, Math.random() * size.height, Math.random() * 120 + 30, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawForeground();

      function drawForeground() {
        // Draw legacy bitmap if present
        if (slide.drawingDataUrl) {
          const drawImg = new Image();
          drawImg.src = slide.drawingDataUrl;
          drawImg.onload = () => {
            ctx.drawImage(drawImg, 0, 0, size.width, size.height);
            renderVectorElements(ctx, slide.vectorElements || []);
            resolve(canvas);
          };
          drawImg.onerror = () => {
            renderVectorElements(ctx, slide.vectorElements || []);
            resolve(canvas);
          };
        } else {
          renderVectorElements(ctx, slide.vectorElements || []);
          resolve(canvas);
        }
      }
    });
  };

  // Export current slide as image file
  const handleExportSlideImage = async () => {
    triggerToast('Preparing slide image...');
    const canvas = await renderSlideToMergedCanvas(activeSlide);
    const dataUrl = canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `Slide_${activeSlideIndex + 1}_${activeSlide.title.replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
    triggerToast('Slide image exported!');
  };

  // Compile entire slide collection into a high-quality PDF document
  const handleExportEntirePDF = async () => {
    triggerToast('Compiling slide layouts into PDF document...');
    
    try {
      let doc: jsPDF | null = null;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        triggerToast(`Rendering page ${i + 1} of ${slides.length} in PDF...`);
        const canvas = await renderSlideToMergedCanvas(slide);
        
        const widthPx = canvas.width;
        const heightPx = canvas.height;
        
        // Match PDF aspect ratio to individual page canvases
        const orientation = widthPx >= heightPx ? 'landscape' : 'portrait';
        const format = [widthPx * 0.264583, heightPx * 0.264583]; // convert pixels to mm (0.264583mm per pixel)

        if (i === 0) {
          doc = new jsPDF({
            orientation,
            unit: 'mm',
            format,
            compress: true,
          });
        } else if (doc) {
          doc.addPage(format, orientation);
        }

        if (doc) {
          const imgData = canvas.toDataURL('image/jpeg', 0.85); // Compress in JPEG for compact sizes
          doc.addImage(
            imgData,
            'JPEG',
            0,
            0,
            widthPx * 0.264583,
            heightPx * 0.264583,
            undefined,
            'FAST'
          );
        }
      }

      if (doc) {
        doc.save(`Lesson_Notes_${Date.now()}.pdf`);
        triggerToast('Multi-page lesson PDF generated and saved!');
      }
    } catch (err: any) {
      console.error(err);
      alert('Could not compile PDF: ' + err.message);
    }
  };

  const currentCanvasW = activeCanvasSize.width;
  const currentCanvasH = activeCanvasSize.height;

  return (
    <div className={`flex flex-col h-screen w-screen transition-colors duration-200 overflow-hidden font-sans ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* HEADER NAVBAR BAR */}
      {!isHeaderCollapsed && (
        <header className={`flex items-center justify-between px-4 py-2 border-b h-14 shrink-0 select-none shadow-sm z-30 transition-colors duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Title branding block */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-500/25">
              <Presentation size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none flex items-center gap-1.5">
                <span className={isDarkMode ? 'text-slate-100' : 'text-slate-900'}>Let Study</span>
              </h1>
              <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Sketch, annotate, and write on standard whiteboards or multi-page PDFs
              </p>
            </div>
          </div>

          {/* Load Previous Session Button */}
          {hasSavedSession && (
            <button
              onClick={handleLoadSession}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-md transition-all active:scale-95 cursor-pointer shadow-sm animate-pulse hover:animate-none ${
                isDarkMode
                  ? 'bg-amber-950/20 hover:bg-amber-900/30 border-amber-900/50 text-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
              }`}
              title="Restore your previously autosaved whiteboard session"
              id="btn-load-session"
            >
              <History size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
              <span>Load Previous Session</span>
            </button>
          )}

          {/* Workspace controls & Zooming buttons */}
          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className={`flex items-center rounded-md p-0.5 border transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-850 border-slate-750' : 'bg-slate-50 border-slate-200'
            }`}>
              <button
                onClick={handleZoomOut}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={handleZoomIn}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <div className={`h-4 w-[1px] mx-1 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-200'}`} />
              <button
                onClick={() => triggerAutoFit(activeCanvasSize.width, activeCanvasSize.height)}
                className={`p-1.5 rounded transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Reset Zoom to Fit Canvas"
              >
                <Maximize2 size={13} />
                <span>Fit</span>
              </button>
            </div>

            <div className={`h-5 w-[1px] mx-1 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-200'}`} />

            {/* Export dropdown / buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSlideImage}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-md transition-all active:scale-95 cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
                }`}
                title="Save current board page as PNG"
                id="btn-export-png"
              >
                <Download size={14} />
                <span className="hidden md:inline">Save Image</span>
              </button>

              <button
                onClick={handleExportEntirePDF}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Export all annotated pages and slides as a combined PDF document"
                id="btn-export-pdf"
              >
                <FileDown size={14} />
                <span>Export Lesson (PDF)</span>
              </button>
            </div>

            <div className={`h-5 w-[1px] mx-1 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-200'}`} />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isDarkMode 
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-800' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode (Classroom)"}
              id="btn-toggle-darkmode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Interactive Help button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Help & Shortcuts guide"
              id="btn-help-modal"
            >
              <HelpCircle size={20} />
            </button>

            {/* Hide Header Button */}
            <button
              onClick={() => setIsHeaderCollapsed(true)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Hide Header"
              id="btn-hide-header"
            >
              <ChevronUp size={20} />
            </button>
          </div>

        </header>
      )}

      {/* CORE WORKSPACE PANEL LAYOUT */}
      <div className="flex flex-1 overflow-hidden w-full relative">
        
        {/* CENTER COMPONENT: Drawing Canvas & Floating Overlay Controls */}
        <div id="canvas-workspace" className={`flex-1 h-full relative overflow-hidden flex flex-col transition-colors duration-200 ${
          isDarkMode ? 'bg-slate-950' : 'bg-slate-100'
        }`}>
          {/* Floating Left Side Panel (Unified Drawing & Style Toolbar) */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-auto flex items-center">
            <Toolbar
              activeTool={tool}
              setActiveTool={handleSelectTool}
              canUndo={activeSlide.undoStack.length > 0}
              canRedo={activeSlide.redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClearSlide}
              onFitScreen={() => triggerAutoFit(currentCanvasW, currentCanvasH)}
              color={color}
              setColor={setColor}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              opacity={opacity}
              setOpacity={setOpacity}
              fontSize={fontSize}
              setFontSize={setFontSize}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              backgroundType={activeSlide.backgroundType}
              setBackgroundType={handleSetBackgroundType}
              onUploadImage={(dataUrl) => setPendingImage(dataUrl)}
              hasPdfBackground={activeSlide.type === 'pdf'}
              isDarkMode={isDarkMode}
            />
          </div>

          {/* Collapse/Expand Top Header Arrow (Only visible when header is collapsed) */}
          {isHeaderCollapsed && (
            <button
              onClick={() => setIsHeaderCollapsed(false)}
              className={`absolute top-0 left-1/2 -translate-x-1/2 z-50 border-x border-b w-12 h-6 rounded-b-md shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer group ${
                isDarkMode
                  ? 'bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
                  : 'bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200'
              }`}
              title="Show Header"
              id="btn-show-header"
            >
              <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
            </button>
          )}

          <div key={activeSlide.id} className="w-full h-full relative animate-slide-switch">
            <DrawingCanvas
              currentSlide={activeSlide}
              tool={tool}
              color={color}
              brushSize={brushSize}
              opacity={opacity}
              fontSize={fontSize}
              fontFamily={fontFamily}
              pendingImage={pendingImage}
              onClearPendingImage={() => setPendingImage(null)}
              pdfPageImage={
                activeSlide.type === 'pdf' && activeSlide.pdfFileId && activeSlide.pdfPageNum
                  ? pdfPageImages[`${activeSlide.pdfFileId}-${activeSlide.pdfPageNum}`]
                  : undefined
              }
              scale={scale}
              setScale={setScale}
              panOffset={panOffset}
              setPanOffset={setPanOffset}
              onSaveVectorElements={saveVectorElements}
              canvasSize={activeCanvasSize}
            />
          </div>

          {/* Floating Right Side Panel (Slide Selector) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 pointer-events-auto">
            <SlideSelector
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onSelectSlide={setActiveSlideIndex}
              onAddBlankSlide={handleAddBlankSlide}
              onDeleteSlide={handleDeleteSlide}
              onUploadPdf={handleUploadPdf}
              isUploadingPdf={isUploadingPdf}
              pdfPageImages={pdfPageImages}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

      </div>

      {/* FLOATING ACTION NOTIFICATIONS / TOAST */}
      {showNotification && (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 text-white font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs transition-opacity animate-fade-in ${
          isDarkMode ? 'bg-slate-800 border border-slate-750' : 'bg-slate-900'
        }`}>
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* INSTRUCTIONAL GUIDE HELP MODAL OVERLAY */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in select-text">
          <div className={`border max-w-xl w-full mx-4 rounded-xl shadow-2xl overflow-hidden transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-slate-100' 
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-150'
            }`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                <Info size={18} className="text-blue-500" />
                Teacher Whiteboard & Shortcuts Guide
              </h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 text-sm overflow-y-auto max-h-[70vh]">
              
              <div>
                <h3 className="font-bold text-blue-500 mb-1.5">🎨 Key App Features:</h3>
                <ul className={`list-disc list-inside space-y-1.5 ${isDarkMode ? 'text-slate-350' : 'text-slate-600'}`}>
                  <li><strong>Multi-Page Classroom PDF Sketching:</strong> Import any PDF file. The app converts each page into a whiteboard slide. Draw, circle, annotate, and teach right on top of your workbooks!</li>
                  <li><strong>Slide Interspersing:</strong> Insert new chalkboard, math grid, or plain ruled paper whiteboard slides <i>between</i> your PDF slides to work out formulas or write notes!</li>
                  <li><strong>Interactive Highlighter:</strong> Emphasize important text on PDFs using the transparent highlighter tool.</li>
                  <li><strong>Multi-Page PDF Notes Export:</strong> Complete your lecture, then compile your annotated PDF slides and custom whiteboards together back into a single multi-page PDF notes document to share with your students!</li>
                  <li><strong>Durable Undos & Redos:</strong> Every whiteboard page maintains its own timeline, protecting your notes.</li>
                </ul>
              </div>

              <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-100'} />

              <div>
                <h3 className="font-bold text-blue-500 mb-2">⌨️ Presentation Keyboard Shortcuts:</h3>
                <div className={`grid grid-cols-2 gap-3 text-xs font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <div className={`flex justify-between border-b pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-sans`}>Draw Pen:</span>
                    <span className={`px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>P</span>
                  </div>
                  <div className={`flex justify-between border-b pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-sans`}>Highlighter:</span>
                    <span className={`px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>H</span>
                  </div>
                  <div className={`flex justify-between border-b pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-sans`}>Eraser:</span>
                    <span className={`px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>E</span>
                  </div>
                  <div className={`flex justify-between border-b pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-sans`}>Add Text:</span>
                    <span className={`px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>T</span>
                  </div>
                  <div className={`flex justify-between border-b pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-sans`}>Undo Action:</span>
                    <span className={`px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>Ctrl + Z</span>
                  </div>
                  <div className={`flex justify-between border-b pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-sans`}>Redo Action:</span>
                    <span className={`px-1.5 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>Ctrl + Y</span>
                  </div>
                </div>
              </div>

              <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-100'} />

              <div className={`p-3 rounded border text-xs leading-relaxed ${
                isDarkMode 
                  ? 'bg-blue-950/20 border-blue-900/40 text-blue-300' 
                  : 'bg-blue-50/50 border-blue-100 text-slate-600'
              }`}>
                <strong>💡 Quick Tip:</strong> Use the <strong>Hand tool (Pan)</strong> or pinch-to-zoom on your tablet to drag and move the board around to sketch small details, then click <strong>Fit</strong> in the header to center everything again instantly.
              </div>

            </div>

            <div className={`px-6 py-4 border-t flex justify-end transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-150'
            }`}>
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-md shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Get Writing!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
