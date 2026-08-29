import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Slide, Tool, BackgroundType, VectorElement } from './types';
import { getPdfInfo, renderPdfPage } from './lib/pdfLoader';
import { loadPptPresentation } from './lib/pptLoader';
import { renderVectorElements } from './lib/vector';

import DrawingCanvas from './components/DrawingCanvas';
import Toolbar from './components/Toolbar';
import SlideSelector from './components/SlideSelector';

import { useAutosaveSession } from './hooks/useAutosaveSession';

import {
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
  ChevronUp,
  ChevronDown,
  History,
  Sun,
  Moon,
  Tv,
  FileUp,
  Keyboard,
  MousePointer,
  Sparkles,
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
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Style and drawing states
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>('#ef4444');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [opacity, setOpacity] = useState<number>(0.45);
  const [fontSize, setFontSize] = useState<number>(24);
  const [fontFamily, setFontFamily] = useState<string>('Inter');

  // Zoom & Pan states
  const [scale, setScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [pdfPageImages, setPdfPageImages] = useState<Record<string, string>>({});
  const [pdfPageDimensions, setPdfPageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [isUploadingPpt, setIsUploadingPpt] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  // Panel Collapsed States for maximizing whiteboard workspace
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const activeSlide = slides[activeSlideIndex] || slides[0];

  const triggerToast = useCallback((msg: string) => {
    setShowNotification(msg);
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  }, []);

  const { hasSavedSession, loadSession, clearSession } = useAutosaveSession(
    slides,
    activeSlideIndex,
    pdfPageImages,
    pdfPageDimensions,
    triggerToast
  );

  const handleLoadSession = () => {
    const session = loadSession();
    if (session) {
      setSlides(session.slides);
      setActiveSlideIndex(session.activeSlideIndex || 0);
      setPdfPageImages(session.pdfPageImages || {});
      setPdfPageDimensions(session.pdfPageDimensions || {});
      triggerToast('Restored previous whiteboard session!');
    }
  };

  // Helper: Tool selection with specific tool defaults
  const handleSelectTool = useCallback((newTool: Tool) => {
    setTool(newTool);
    if (newTool === 'highlighter') {
      if (brushSize < 16) {
        setBrushSize(24);
      }
      if (color === '#ef4444' || color === '#000000' || color === '#ffffff' || color === '#3b82f6') {
        setColor('#facc15');
      }
      setOpacity(0.4);
    } else if (newTool === 'pen') {
      if (brushSize > 16) {
        setBrushSize(5);
      }
      if (color === '#facc15' || color === '#fef08a') {
        setColor('#ef4444');
      }
    }
  }, [brushSize, color]);

  // Helper: Get active canvas size dynamically
  const getActiveCanvasSize = useCallback((slide: Slide) => {
    if (slide.originalWidth && slide.originalHeight) {
      return { width: slide.originalWidth, height: slide.originalHeight };
    }
    if ((slide.type === 'pdf' || slide.type === 'ppt') && slide.pdfFileId && slide.pdfPageNum) {
      const pageKey = `${slide.pdfFileId}-${slide.pdfPageNum}`;
      const dimensions = pdfPageDimensions[pageKey];
      if (dimensions) {
        return dimensions;
      }
    }
    return { width: 1920, height: 1080 };
  }, [pdfPageDimensions]);

  const activeCanvasSize = getActiveCanvasSize(activeSlide);

  // Auto-fit to screen calculation
  const triggerAutoFit = useCallback((canvasW: number, canvasH: number) => {
    const workspace = document.getElementById('canvas-workspace');
    if (!workspace) return false;
    const viewW = workspace.clientWidth;
    const viewH = workspace.clientHeight;

    if (viewW <= 0 || viewH <= 0) return false;

    const padding = 48;
    const targetW = viewW - padding;
    const targetH = viewH - padding;

    const scaleX = targetW / canvasW;
    const scaleY = targetH / canvasH;
    const newScale = Math.max(0.1, Math.min(scaleX, scaleY, 2.5));

    const offsetX = (viewW - canvasW * newScale) / 2;
    const offsetY = (viewH - canvasH * newScale) / 2;

    setScale(newScale);
    setPanOffset({ x: offsetX, y: offsetY });
    return true;
  }, []);

  // Fit screen on load, change slide, panel toggle, or workspace container resize
  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | null = null;

    const attemptFit = () => {
      if (!active) return;
      const workspace = document.getElementById('canvas-workspace');
      if (workspace && workspace.clientWidth > 0 && workspace.clientHeight > 0) {
        triggerAutoFit(activeCanvasSize.width, activeCanvasSize.height);

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
      }
    };

    const timer = setTimeout(attemptFit, 60);

    return () => {
      active = false;
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [activeSlideIndex, isHeaderCollapsed, isFullscreen, triggerAutoFit, activeCanvasSize.width, activeCanvasSize.height]);

  // Undo / Redo logic
  const handleUndo = useCallback(() => {
    setSlides((prevSlides) => {
      const slide = prevSlides[activeSlideIndex];
      if (!slide || !slide.undoStack || slide.undoStack.length === 0) return prevSlides;

      const newUndo = [...slide.undoStack];
      const previousState = newUndo.pop() || [];
      const newRedo = [...(slide.redoStack || []), slide.vectorElements || []];

      const updatedSlides = [...prevSlides];
      updatedSlides[activeSlideIndex] = {
        ...slide,
        vectorElements: previousState,
        undoStack: newUndo,
        redoStack: newRedo,
      };
      return updatedSlides;
    });
  }, [activeSlideIndex]);

  const handleRedo = useCallback(() => {
    setSlides((prevSlides) => {
      const slide = prevSlides[activeSlideIndex];
      if (!slide || !slide.redoStack || slide.redoStack.length === 0) return prevSlides;

      const newRedo = [...slide.redoStack];
      const nextState = newRedo.pop() || [];
      const newUndo = [...(slide.undoStack || []), slide.vectorElements || []];

      const updatedSlides = [...prevSlides];
      updatedSlides[activeSlideIndex] = {
        ...slide,
        vectorElements: nextState,
        undoStack: newUndo,
        redoStack: newRedo,
      };
      return updatedSlides;
    });
  }, [activeSlideIndex]);

  // Keyboard Shortcuts (Undo: Ctrl+Z / Cmd+Z, Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z, Tools, Navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;

      // Undo & Redo Shortcuts
      if (isModifier) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      // Slide Navigation
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (activeSlideIndex < slides.length - 1) {
          setActiveSlideIndex(activeSlideIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (activeSlideIndex > 0) {
          setActiveSlideIndex(activeSlideIndex - 1);
        }
      } else if (e.key.toLowerCase() === 'p') {
        handleSelectTool('pen');
      } else if (e.key.toLowerCase() === 'h') {
        handleSelectTool('highlighter');
      } else if (e.key.toLowerCase() === 'e') {
        handleSelectTool('eraser');
      } else if (e.key.toLowerCase() === 't') {
        handleSelectTool('text');
      } else if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'm') {
        handleSelectTool('pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlideIndex, slides.length, handleSelectTool, handleUndo, handleRedo]);

  // Vector elements save handler
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

  const handleClearSlide = () => {
    const slide = slides[activeSlideIndex];
    if (!slide || ((!slide.vectorElements || slide.vectorElements.length === 0) && !slide.drawingDataUrl)) return;

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

  // Zoom helpers
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

    const vX = viewW / 2;
    const vY = viewH / 2;

    const nextScale = Math.min(Math.max(scale + delta, 0.2), 4.0);
    const cX = (vX - panOffset.x) / scale;
    const cY = (vY - panOffset.y) / scale;

    setPanOffset({
      x: vX - cX * nextScale,
      y: vY - cY * nextScale,
    });
    setScale(nextScale);
  };

  // Add blank slide
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
    setActiveSlideIndex(slides.length);
    triggerToast(`Added blank ${bgType} board`);
  };

  // Delete slide
  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return;

    const slideTitle = slides[index].title;
    const newSlides = slides.filter((_, i) => i !== index);

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

  // Background style
  const handleSetBackgroundType = (type: BackgroundType) => {
    const updatedSlides = [...slides];
    updatedSlides[activeSlideIndex] = {
      ...slides[activeSlideIndex],
      backgroundType: type,
    };
    setSlides(updatedSlides);
  };

  // Unified Document Uploader (PowerPoint PPTX/PPT and PDF)
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPpt =
      fileName.endsWith('.pptx') ||
      fileName.endsWith('.ppt') ||
      file.type.includes('powerpoint') ||
      file.type.includes('presentationml');
    const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf';

    if (isPpt) {
      setIsUploadingPpt(true);
      triggerToast('Parsing PowerPoint (.pptx) vector elements & slides...');

      try {
        // 1. Primary: Native Client-side PPTX Vector & Layout Parser
        const renderedSlides = await loadPptPresentation(file, (current, total, msg) => {
          triggerToast(msg);
        });

        if (renderedSlides && renderedSlides.length > 0) {
          const fileId = `ppt-${Date.now()}`;
          const newSlidesToAppend: Slide[] = [];
          const renderedImages: Record<string, string> = {};
          const renderedDimensions: Record<string, { width: number; height: number }> = {};
          const baseName = file.name.replace(/\.(pptx|ppt)$/i, '');

          renderedSlides.forEach((slide) => {
            const pageKey = `${fileId}-${slide.slideNumber}`;
            renderedImages[pageKey] = slide.dataUrl;
            renderedDimensions[pageKey] = {
              width: slide.width,
              height: slide.height,
            };

            const pageTitle =
              slide.title && slide.title !== 'PowerPoint Slide'
                ? `${baseName} - ${slide.title}`
                : `${baseName} - Slide ${slide.slideNumber}`;

            newSlidesToAppend.push({
              id: `slide-ppt-${fileId}-${slide.slideNumber}`,
              title: pageTitle,
              type: 'ppt',
              backgroundType: 'white',
              pdfPageNum: slide.slideNumber,
              pdfFileId: fileId,
              pptSlideNum: slide.slideNumber,
              pptFileId: fileId,
              originalWidth: slide.width,
              originalHeight: slide.height,
              aspectRatio: slide.aspectRatio,
              svgContent: slide.svgContent,
              extractedText: slide.extractedText || '',
              vectorElements: slide.vectorElements || [],
              drawingDataUrl: undefined,
              undoStack: [],
              redoStack: [],
            });
          });

          setPdfPageImages((prev) => ({ ...prev, ...renderedImages }));
          setPdfPageDimensions((prev) => ({ ...prev, ...renderedDimensions }));

          const isInitialEmptySlide =
            slides.length === 1 &&
            slides[0].id === 'slide-initial-whiteboard' &&
            !slides[0].drawingDataUrl &&
            slides[0].vectorElements.length === 0;

          if (isInitialEmptySlide) {
            setSlides(newSlidesToAppend);
            setActiveSlideIndex(0);
          } else {
            setSlides((prev) => [...prev, ...newSlidesToAppend]);
            setActiveSlideIndex(slides.length);
          }

          triggerToast(`Loaded ${renderedSlides.length} editable PowerPoint slides!`);
        } else {
          // Fallback to backend PDF conversion if vector parse produced 0 slides
          triggerToast('Converting presentation via backend converter...');
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/convert-ppt-to-pdf', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const pdfBlob = await response.blob();
            const fileUrl = URL.createObjectURL(pdfBlob);
            const totalPages = await getPdfInfo(fileUrl);
            const fileId = `ppt-pdf-${Date.now()}`;
            const newSlidesToAppend: Slide[] = [];
            const renderedImages: Record<string, string> = {};
            const renderedDimensions: Record<string, { width: number; height: number }> = {};
            const baseName = file.name.replace(/\.(pptx|ppt)$/i, '');

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
              const renderedPage = await renderPdfPage(fileUrl, pageNum, 1920);
              const pageKey = `${fileId}-${pageNum}`;
              renderedImages[pageKey] = renderedPage.dataUrl;
              renderedDimensions[pageKey] = {
                width: renderedPage.width,
                height: renderedPage.height,
              };

              newSlidesToAppend.push({
                id: `slide-ppt-${fileId}-${pageNum}`,
                title: `${baseName} - Slide ${pageNum}`,
                type: 'ppt',
                backgroundType: 'white',
                pdfPageNum: pageNum,
                pdfFileId: fileId,
                pptSlideNum: pageNum,
                pptFileId: fileId,
                vectorElements: [],
                drawingDataUrl: undefined,
                undoStack: [],
                redoStack: [],
              });
            }

            setPdfPageImages((prev) => ({ ...prev, ...renderedImages }));
            setPdfPageDimensions((prev) => ({ ...prev, ...renderedDimensions }));
            setSlides((prev) => [...prev, ...newSlidesToAppend]);
            triggerToast(`Loaded ${totalPages} slides from presentation!`);
          }
        }
      } catch (err: any) {
        console.error(err);
        alert(`Error loading PowerPoint presentation: ${err.message || err}`);
      } finally {
        setIsUploadingPpt(false);
        if (e.target) e.target.value = '';
      }
    } else if (isPdf) {
      setIsUploadingPdf(true);
      triggerToast('Reading PDF document structure...');

      try {
        const fileUrl = URL.createObjectURL(file);
        const totalPages = await getPdfInfo(fileUrl);
        const fileId = `pdf-${Date.now()}`;

        const newSlidesToAppend: Slide[] = [];
        const renderedImages: Record<string, string> = {};
        const renderedDimensions: Record<string, { width: number; height: number }> = {};

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          triggerToast(`Rendering page ${pageNum} of ${totalPages}...`);
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

        setPdfPageImages((prev) => ({ ...prev, ...renderedImages }));
        setPdfPageDimensions((prev) => ({ ...prev, ...renderedDimensions }));

        const isInitialEmptySlide =
          slides.length === 1 &&
          slides[0].id === 'slide-initial-whiteboard' &&
          !slides[0].drawingDataUrl &&
          slides[0].vectorElements.length === 0;

        if (isInitialEmptySlide) {
          setSlides(newSlidesToAppend);
          setActiveSlideIndex(0);
        } else {
          setSlides((prev) => [...prev, ...newSlidesToAppend]);
          setActiveSlideIndex(slides.length);
        }

        triggerToast(`Loaded ${totalPages} pages from PDF!`);
      } catch (err: any) {
        console.error(err);
        alert(`Error loading PDF: ${err.message || err}`);
      } finally {
        setIsUploadingPdf(false);
        if (e.target) e.target.value = '';
      }
    } else {
      alert('Please upload a valid PDF (.pdf) or PowerPoint (.pptx, .ppt) presentation.');
      if (e.target) e.target.value = '';
    }
  };

  // Merged offscreen canvas renderer for exporting
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

      // Draw background image if PDF/PPT
      if ((slide.type === 'pdf' || slide.type === 'ppt') && slide.pdfFileId && slide.pdfPageNum) {
        const pageKey = `${slide.pdfFileId}-${slide.pdfPageNum}`;
        const bgImgSrc = pdfPageImages[pageKey];
        if (bgImgSrc) {
          const bgImg = new Image();
          bgImg.src = bgImgSrc;
          bgImg.onload = () => {
            ctx.drawImage(bgImg, 0, 0, size.width, size.height);
            drawForeground();
          };
          bgImg.onerror = () => {
            drawSolidBackground();
            drawForeground();
          };
          return;
        }
      }

      drawSolidBackground();
      drawForeground();

      function drawSolidBackground() {
        if (!ctx) return;
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
        }
      }

      function drawForeground() {
        if (!ctx) return;
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

  // Export current slide as PNG
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

  // Export entire presentation/lesson as PDF
  const handleExportEntirePDF = async () => {
    triggerToast('Compiling presentation slides into PDF...');

    try {
      let doc: jsPDF | null = null;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        triggerToast(`Rendering page ${i + 1} of ${slides.length} in PDF...`);
        const canvas = await renderSlideToMergedCanvas(slide);

        const widthPx = canvas.width;
        const heightPx = canvas.height;

        const orientation = widthPx >= heightPx ? 'landscape' : 'portrait';
        const format = [widthPx * 0.264583, heightPx * 0.264583];

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
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
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
        doc.save(`Presentation_Lesson_${Date.now()}.pdf`);
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
    <div
      className={`flex flex-col h-screen w-screen transition-colors duration-200 overflow-hidden font-sans ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* HEADER NAVBAR BAR */}
      {!isHeaderCollapsed && (
        <header
          className={`flex items-center justify-between px-4 py-2 border-b h-14 shrink-0 select-none shadow-xs z-30 transition-colors duration-200 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Title branding block */}
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <Presentation size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">
                <span className={isDarkMode ? 'text-slate-100' : 'text-slate-900'}>Let's Study</span>
              </h1>
            </div>
          </div>

          {/* Load Previous Session Button */}
          {hasSavedSession && (
            <button
              onClick={handleLoadSession}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs ${
                isDarkMode
                  ? 'bg-amber-950/20 hover:bg-amber-900/30 border-amber-900/50 text-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
              }`}
              title="Restore your previously autosaved whiteboard session"
              id="btn-load-session"
            >
              <History size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
              <span>Restore Session</span>
            </button>
          )}

          {/* Workspace controls & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Zoom Controls */}
            <div
              className={`flex items-center rounded-xl p-0.5 border transition-colors duration-200 ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                onClick={() => adjustZoom(-0.15)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => adjustZoom(0.15)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <div className={`h-3.5 w-[1px] mx-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <button
                onClick={() => triggerAutoFit(activeCanvasSize.width, activeCanvasSize.height)}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Reset Zoom to Fit Canvas"
              >
                <Maximize2 size={13} />
                <span>Fit</span>
              </button>
            </div>

            <div className={`h-4 w-[1px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportSlideImage}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="Save current slide as PNG image"
                id="btn-export-png"
              >
                <Download size={13} />
                <span className="hidden md:inline">PNG</span>
              </button>

              <button
                onClick={handleExportEntirePDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Export all annotated slides and whiteboards as PDF document"
                id="btn-export-pdf"
              >
                <FileDown size={13} />
                <span>Export PDF</span>
              </button>
            </div>

            <div className={`h-4 w-[1px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                isDarkMode
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              id="btn-toggle-darkmode"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Help button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Help & Shortcuts guide"
              id="btn-help-modal"
            >
              <HelpCircle size={17} />
            </button>

            {/* Hide Header Button */}
            <button
              onClick={() => setIsHeaderCollapsed(true)}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Hide Header (Maximize Workspace)"
              id="btn-hide-header"
            >
              <ChevronUp size={17} />
            </button>
          </div>
        </header>
      )}

      {/* CORE WORKSPACE CANVAS */}
      <div className="flex flex-1 overflow-hidden w-full relative">
        <div
          id="canvas-workspace"
          className={`flex-1 h-full relative overflow-hidden flex flex-col transition-colors duration-200 ${
            isDarkMode ? 'bg-slate-950' : 'bg-slate-100/90'
          }`}
        >
          {/* Floating Left Side Panel (Drawing Toolbar) */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-auto flex items-center">
            <Toolbar
              activeTool={tool}
              setActiveTool={handleSelectTool}
              canUndo={(activeSlide.undoStack || []).length > 0}
              canRedo={(activeSlide.redoStack || []).length > 0}
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
              hasPdfBackground={activeSlide.type === 'pdf' || activeSlide.type === 'ppt'}
              isDarkMode={isDarkMode}
            />
          </div>

          {/* Show Header button when collapsed */}
          {isHeaderCollapsed && (
            <button
              onClick={() => setIsHeaderCollapsed(false)}
              className={`absolute top-0 left-1/2 -translate-x-1/2 z-50 border-x border-b w-12 h-6 rounded-b-xl shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer group ${
                isDarkMode
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                  : 'bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200'
              }`}
              title="Show Header"
              id="btn-show-header"
            >
              <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
            </button>
          )}

          {/* Drawing Canvas */}
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
                (activeSlide.type === 'pdf' || activeSlide.type === 'ppt') &&
                activeSlide.pdfFileId &&
                activeSlide.pdfPageNum
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
              onUploadDocument={handleUploadDocument}
              isUploadingDocument={isUploadingPdf || isUploadingPpt}
              pdfPageImages={pdfPageImages}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {showNotification && (
        <div
          className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 text-white font-medium px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs transition-opacity animate-fade-in ${
            isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-900'
          }`}
        >
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* Help & Shortcuts Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in select-text p-4">
          <div
            className={`border max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between px-6 py-4 border-b ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Presentation size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    PowerPoint & Whiteboard Guide
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[75vh]">
              {/* Feature highlight */}
              <div className="rounded-xl p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                  <Sparkles size={14} className="text-indigo-500" />
                  <span>Native PowerPoint (.pptx) & PDF Vectors</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  Upload PowerPoint or PDF files. The engine renders slides as high-resolution native vector elements. You can zoom in indefinitely without loss of crispness, add pen and highlighter annotations, and place custom text notes.
                </p>
              </div>

              {/* Navigation & Gestures */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                  <MousePointer size={14} className="text-indigo-500" />
                  <span>Touchpad & Mouse Gestures</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span>Touchpad Pinch / Wheel:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">Zoom centered on cursor</span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span>Two-finger Drag / Shift + Wheel:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">Pan workspace</span>
                  </div>
                </div>
              </div>

              {/* Keyboard Shortcuts */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 mb-2.5">
                  <Keyboard size={14} className="text-indigo-500" />
                  <span>Keyboard Shortcuts</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Undo:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      Ctrl+Z / ⌘Z
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Redo:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      Ctrl+Y / ⌘⇧Z
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Pen Tool:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      P
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Highlighter:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      H
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Eraser:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      E
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Text Box:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      T
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Pan / Hand:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      V / M
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Next / Prev:</span>
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
                      ← / →
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`px-6 py-3.5 border-t flex justify-end items-center ${
                isDarkMode
                  ? 'bg-slate-900/90 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-2 px-5 rounded-xl shadow-xs transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
