import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Move, Lock, Unlock, Check, X, RotateCcw } from 'lucide-react';
import { Tool, BackgroundType, Slide, VectorElement, Point } from '../types';
import { renderVectorElement, renderVectorElements } from '../lib/vector';

interface DrawingCanvasProps {
  currentSlide: Slide;
  tool: Tool;
  color: string;
  brushSize: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  pdfPageImage?: string; // Rendered page background image data URL
  pendingImage?: string | null;
  onClearPendingImage?: () => void;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  panOffset: { x: number; y: number };
  onSaveVectorElements: (
    vectorElements: VectorElement[],
    undoStack: VectorElement[][],
    redoStack: VectorElement[][]
  ) => void;
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvasSize: { width: number; height: number };
}

interface ImageOverlay {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  keepAspect: boolean;
}

export default function DrawingCanvas({
  currentSlide,
  tool,
  color,
  brushSize,
  opacity,
  fontSize,
  fontFamily,
  pdfPageImage,
  pendingImage,
  onClearPendingImage,
  scale,
  setScale,
  panOffset,
  onSaveVectorElements,
  setPanOffset,
  canvasSize,
}: DrawingCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Active vector element being drawn live
  const [activeElement, setActiveElement] = useState<VectorElement | null>(null);
  const activeElementRef = useRef<VectorElement | null>(null);
  activeElementRef.current = activeElement;

  // Cached preloaded images for vector image elements
  const loadedImagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Floating Text tool state
  const [textInput, setTextInput] = useState<{ x: number; y: number; val: string } | null>(null);
  const [textContainerSize, setTextContainerSize] = useState<{ width: number; height: number }>({
    width: 480,
    height: 220,
  });
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Floating Image Overlay State
  const [imageOverlay, setImageOverlay] = useState<ImageOverlay | null>(null);

  const { width, height } = canvasSize;

  // High-DPI Device Pixel Ratio handling:
  // Base DPR from window devicePixelRatio, scaled up dynamically when zooming in
  // so vector drawings are always rendered crisp and high-resolution at any zoom level.
  const baseDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // Initialize image overlay when pendingImage arrives
  useEffect(() => {
    if (pendingImage) {
      const img = new Image();
      img.src = pendingImage;
      img.onload = () => {
        const natW = img.naturalWidth || 600;
        const natH = img.naturalHeight || 400;
        const aspect = natW / natH;

        const initW = Math.min(500, Math.max(200, width * 0.45));
        const initH = initW / aspect;

        const posX = Math.max(20, (width - initW) / 2);
        const posY = Math.max(20, (height - initH) / 2);

        setImageOverlay({
          url: pendingImage,
          x: posX,
          y: posY,
          width: initW,
          height: initH,
          naturalWidth: natW,
          naturalHeight: natH,
          keepAspect: true,
        });
      };
    }
  }, [pendingImage, width, height]);

  // Handle moving the image overlay
  const handleImageMoveStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    if (!imageOverlay || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    if (!containerRect.width || !containerRect.height) return;

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startX = imageOverlay.x;
    const startY = imageOverlay.y;

    const scaleX = width / containerRect.width;
    const scaleY = height / containerRect.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = ((moveEv.clientX - startPointerX) * scaleX) / scale;
      const dy = ((moveEv.clientY - startPointerY) * scaleY) / scale;

      setImageOverlay((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(-prev.width + 50, Math.min(width - 50, startX + dx)),
          y: Math.max(-prev.height + 50, Math.min(height - 50, startY + dy)),
        };
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Handle resizing the image overlay
  const handleImageResizeStart = (
    e: React.PointerEvent<HTMLDivElement>,
    direction: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's' | 'w' | 'n'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!imageOverlay || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    if (!containerRect.width || !containerRect.height) return;

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startX = imageOverlay.x;
    const startY = imageOverlay.y;
    const startW = imageOverlay.width;
    const startH = imageOverlay.height;
    const aspect = imageOverlay.naturalWidth / imageOverlay.naturalHeight;
    const keepAspect = imageOverlay.keepAspect;

    const scaleX = width / containerRect.width;
    const scaleY = height / containerRect.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = ((moveEv.clientX - startPointerX) * scaleX) / scale;
      const dy = ((moveEv.clientY - startPointerY) * scaleY) / scale;

      let newW = startW;
      let newH = startH;
      let newX = startX;
      let newY = startY;

      if (direction.includes('e')) {
        newW = Math.max(60, startW + dx);
      }
      if (direction.includes('w')) {
        const calcW = Math.max(60, startW - dx);
        newX = startX + (startW - calcW);
        newW = calcW;
      }
      if (direction.includes('s')) {
        newH = Math.max(60, startH + dy);
      }
      if (direction.includes('n')) {
        const calcH = Math.max(60, startH - dy);
        newY = startY + (startH - calcH);
        newH = calcH;
      }

      if (keepAspect) {
        if (direction === 'e' || direction === 'w') {
          newH = newW / aspect;
        } else if (direction === 's' || direction === 'n') {
          newW = newH * aspect;
        } else {
          newH = newW / aspect;
          if (direction.includes('n')) {
            newY = startY + (startH - newH);
          }
        }
      }

      setImageOverlay((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        };
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Commit image onto vector layer
  const commitImage = () => {
    if (!imageOverlay) return;
    
    // Preload image
    const img = new Image();
    img.src = imageOverlay.url;
    loadedImagesRef.current[imageOverlay.url] = img;

    const newImageElement: VectorElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'image',
      x: imageOverlay.x,
      y: imageOverlay.y,
      width: imageOverlay.width,
      height: imageOverlay.height,
      imageUrl: imageOverlay.url,
      color: '#000000',
      strokeWidth: 1,
      opacity: 1.0,
    };

    const currentElements = currentSlide.vectorElements || [];
    const newElements = [...currentElements, newImageElement];
    const newUndo = [...(currentSlide.undoStack || []), currentElements];

    onSaveVectorElements(newElements, newUndo, []);
    setImageOverlay(null);
    if (onClearPendingImage) onClearPendingImage();
  };

  // Cancel image upload
  const cancelImage = () => {
    setImageOverlay(null);
    if (onClearPendingImage) onClearPendingImage();
  };

  // Resize handler for Text box overlay
  const handleResizeStart = (
    e: React.PointerEvent<HTMLDivElement>,
    direction: 'e' | 's' | 'se' | 'w'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = textContainerSize.width;
    const startHeight = textContainerSize.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - startX) / scale;
      const dy = (moveEv.clientY - startY) / scale;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction === 'e' || direction === 'se') {
        newWidth = Math.max(260, startWidth + dx);
      }
      if (direction === 's' || direction === 'se') {
        newHeight = Math.max(100, startHeight + dy);
      }
      if (direction === 'w') {
        newWidth = Math.max(260, startWidth - dx);
      }

      setTextContainerSize({ width: newWidth, height: newHeight });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Drag-to-move handler for Text box overlay
  const handleMoveStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    if (!textInput || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    if (!containerRect.width || !containerRect.height) return;

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startX = textInput.x;
    const startY = textInput.y;

    const scaleX = width / containerRect.width;
    const scaleY = height / containerRect.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = ((moveEv.clientX - startPointerX) * scaleX) / scale;
      const dy = ((moveEv.clientY - startPointerY) * scaleY) / scale;

      setTextInput((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(0, Math.min(width - 50, startX + dx)),
          y: Math.max(0, Math.min(height - 50, startY + dy)),
        };
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Background transition state
  const [bgOpacity, setBgOpacity] = useState(1);
  const [prevBgOpacity, setPrevBgOpacity] = useState(0);
  const lastBgType = useRef<BackgroundType>(currentSlide.backgroundType);
  const lastSlideId = useRef<string>(currentSlide.id);

  // 1. Redraw Background Canvas whenever background style or camera scale changes
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;
    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    bgCanvas.width = Math.round(width * scale * baseDpr);
    bgCanvas.height = Math.round(height * scale * baseDpr);

    const isSameSlide = lastSlideId.current === currentSlide.id;
    const isBgTypeChanged = lastBgType.current !== currentSlide.backgroundType;

    if (isSameSlide && isBgTypeChanged && !pdfPageImage) {
      const prevBgCanvas = prevBgCanvasRef.current;
      if (prevBgCanvas) {
        prevBgCanvas.width = Math.round(width * scale * baseDpr);
        prevBgCanvas.height = Math.round(height * scale * baseDpr);
        const prevCtx = prevBgCanvas.getContext('2d');
        if (prevCtx) {
          prevCtx.setTransform(scale * baseDpr, 0, 0, scale * baseDpr, 0, 0);
          prevCtx.imageSmoothingEnabled = true;
          prevCtx.imageSmoothingQuality = 'high';
          prevCtx.clearRect(0, 0, width, height);
          prevCtx.drawImage(bgCanvas, 0, 0, width, height);
        }
      }

      renderBlankBackground(ctx, width, height, currentSlide.backgroundType);

      setPrevBgOpacity(1);
      setBgOpacity(0);

      const timer = setTimeout(() => {
        setPrevBgOpacity(0);
        setBgOpacity(1);
      }, 50);

      lastBgType.current = currentSlide.backgroundType;
      return () => clearTimeout(timer);
    } else {
      if (pdfPageImage) {
        const img = new Image();
        img.src = pdfPageImage;
        img.onload = () => {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

          ctx.setTransform(scale * baseDpr, 0, 0, scale * baseDpr, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        };
      } else {
        renderBlankBackground(ctx, width, height, currentSlide.backgroundType);
      }
      setBgOpacity(1);
      setPrevBgOpacity(0);
    }

    lastBgType.current = currentSlide.backgroundType;
    lastSlideId.current = currentSlide.id;
  }, [currentSlide.backgroundType, currentSlide.id, pdfPageImage, width, height, baseDpr, scale]);

  // 2. Centralized Vector Render function
  const renderVectorCanvas = useCallback(() => {
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return;
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;

    // Set backing resolution to match device pixel ratio and scale
    drawingCanvas.width = Math.round(width * scale * baseDpr);
    drawingCanvas.height = Math.round(height * scale * baseDpr);

    // Clear entire backing canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

    // Apply scale transformation directly to 2D Context
    ctx.setTransform(
      scale * baseDpr, 0,
      0, scale * baseDpr,
      0, 0
    );

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Legacy data URL fallback if existing from previous session
    if (currentSlide.drawingDataUrl && (!currentSlide.vectorElements || currentSlide.vectorElements.length === 0)) {
      const img = new Image();
      img.src = currentSlide.drawingDataUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
      };
    }

    // Render all vector objects natively in World Space
    renderVectorElements(ctx, currentSlide.vectorElements || [], loadedImagesRef.current);

    // Render currently active live drawing vector element
    if (activeElementRef.current) {
      renderVectorElement(ctx, activeElementRef.current, loadedImagesRef.current);
    }
  }, [currentSlide.vectorElements, currentSlide.drawingDataUrl, width, height, baseDpr, scale]);

  // Re-render vector canvas whenever vector objects, active element, slide, zoom scale, or panOffset change
  useEffect(() => {
    renderVectorCanvas();
  }, [currentSlide.id, currentSlide.vectorElements, activeElement, scale, panOffset, renderVectorCanvas]);

  // Auto-focusing on text input when opened
  useEffect(() => {
    if (textInput && textInputRef.current) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [textInput?.x, textInput?.y]);

  const renderBlankBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, type: BackgroundType) => {
    const bw = Math.round(w * scale * baseDpr);
    const bh = Math.round(h * scale * baseDpr);

    // Clear backing canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);

    // Fill background color across backing buffer
    if (type === 'chalkboard') {
      ctx.fillStyle = '#143d28';
      ctx.fillRect(0, 0, bw, bh);
    } else if (type === 'blackboard') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, bw, bh);
    } else if (type === 'cream') {
      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, 0, bw, bh);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, bw, bh);
    }

    // Apply scale transformation for grid/pattern rendering in world space (0..w, 0..h)
    ctx.setTransform(
      scale * baseDpr, 0,
      0, scale * baseDpr,
      0, 0
    );

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    switch (type) {
      case 'chalkboard':
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        for (let i = 0; i < 24; i++) {
          ctx.beginPath();
          ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 120 + 30, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'blackboard':
        // Pure solid black background, no extra decorative shapes/designs
        break;
      case 'grid':
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        break;
      case 'ruled':
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.lineWidth = 1.5;
        const spacing = 32;
        const topMargin = spacing * 3;
        for (let y = topMargin; y < h; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(150, 0);
        ctx.lineTo(150, h);
        ctx.stroke();
        break;
    }
  };

  // Synchronize scale and panOffset in refs for non-stale event listeners
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;

  interface PinchState {
    dist: number;
    scale: number;
    worldMidX: number;
    worldMidY: number;
  }
  const pinchStartRef = useRef<PinchState | null>(null);

  // Mouse wheel scroll zoom listener (zooms centered around mouse cursor position)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;

      // Exponential zoom factor
      const zoomFactor = Math.exp(-e.deltaY * 0.002);

      const currentScale = scaleRef.current;
      const currentPan = panOffsetRef.current;

      // Calculate world coordinates under cursor before zoom
      const worldX = (focalX - currentPan.x) / currentScale;
      const worldY = (focalY - currentPan.y) / currentScale;

      const newScale = Math.min(Math.max(currentScale * zoomFactor, 0.1), 5.0);

      // Keep world coordinate under cursor at the same screen position
      const newPanX = focalX - worldX * newScale;
      const newPanY = focalY - worldY * newScale;

      setScale(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [setScale, setPanOffset]);

  // Touch gesture listener for 2-finger pinch zoom and 2-finger pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const rect = container.getBoundingClientRect();
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const screenMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const screenMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

        const currentScale = scaleRef.current;
        const currentPan = panOffsetRef.current;

        pinchStartRef.current = {
          dist: Math.max(dist, 10),
          scale: currentScale,
          worldMidX: (screenMidX - currentPan.x) / currentScale,
          worldMidY: (screenMidY - currentPan.y) / currentScale,
        };

        setIsDrawing(false);
        setIsPanning(false);
        setActiveElement(null);
      } else if (e.touches.length !== 2) {
        pinchStartRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        if (!pinchStartRef.current) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const rect = container.getBoundingClientRect();
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const screenMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
          const screenMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

          const currentScale = scaleRef.current;
          const currentPan = panOffsetRef.current;

          pinchStartRef.current = {
            dist: Math.max(dist, 10),
            scale: currentScale,
            worldMidX: (screenMidX - currentPan.x) / currentScale,
            worldMidY: (screenMidY - currentPan.y) / currentScale,
          };
        } else {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const rect = container.getBoundingClientRect();
          const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const currentScreenMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
          const currentScreenMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

          const factor = currentDist / pinchStartRef.current.dist;
          const newScale = Math.min(Math.max(pinchStartRef.current.scale * factor, 0.1), 5.0);

          const newPanX = currentScreenMidX - pinchStartRef.current.worldMidX * newScale;
          const newPanY = currentScreenMidY - pinchStartRef.current.worldMidY * newScale;

          setScale(newScale);
          setPanOffset({ x: newPanX, y: newPanY });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartRef.current = null;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [setScale, setPanOffset]);

  // Convert SCREEN coordinates to WORLD coordinates
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return { x: 0, y: 0 };

    const rect = drawingCanvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('changedTouches' in e && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    // Convert Screen coordinates into WORLD coordinates
    const x = screenX / scale;
    const y = screenY / scale;

    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length >= 2) {
      return;
    }

    const target = e.target as HTMLElement;
    if (target && (target.id === 'text-tool-input' || target.closest('#text-tool-container'))) {
      return;
    }

    const coords = getCanvasCoords(e);

    if (textInput) {
      commitText();
      if (tool === 'text') {
        setTextContainerSize({ width: 480, height: 220 });
        setTextInput({
          x: coords.x,
          y: coords.y,
          val: '',
        });
      }
      return;
    }

    if (tool === 'pan') {
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPanStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
      return;
    }

    if (tool === 'text') {
      setTextContainerSize({ width: 480, height: 220 });
      setTextInput({
        x: coords.x,
        y: coords.y,
        val: '',
      });
      return;
    }

    setIsDrawing(true);
    setDragStart(coords);

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      const newElem: VectorElement = {
        id: `freehand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: tool,
        x: coords.x,
        y: coords.y,
        points: [coords],
        color,
        strokeWidth: brushSize,
        opacity: tool === 'highlighter' ? opacity : 1.0,
      };
      setActiveElement(newElem);
    } else if (
      tool === 'line' ||
      tool === 'arrow' ||
      tool === 'rectangle' ||
      tool === 'circle' ||
      tool === 'triangle'
    ) {
      const newElem: VectorElement = {
        id: `shape-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: tool,
        x: coords.x,
        y: coords.y,
        x2: coords.x,
        y2: coords.y,
        width: 0,
        height: 0,
        color,
        strokeWidth: brushSize,
        opacity: 1.0,
      };
      setActiveElement(newElem);
    }
  };

  const drawMove = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length >= 2) {
      return;
    }

    if (isPanning) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPanOffset({
        x: clientX - panStart.x,
        y: clientY - panStart.y,
      });
      return;
    }

    if (!isDrawing || !activeElement) return;

    const coords = getCanvasCoords(e);

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      const pts = activeElement.points ? [...activeElement.points] : [];
      const lastPt = pts[pts.length - 1];

      // Add point if distance threshold is met
      if (!lastPt || Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) >= 1.0) {
        pts.push(coords);
        setActiveElement({
          ...activeElement,
          points: pts,
        });
      }
    } else if (
      tool === 'line' ||
      tool === 'arrow' ||
      tool === 'rectangle' ||
      tool === 'circle' ||
      tool === 'triangle'
    ) {
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;

      setActiveElement({
        ...activeElement,
        x2: coords.x,
        y2: coords.y,
        width: dx,
        height: dy,
      });
    }
  };

  const stopDrawing = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeElement) {
      const currentElements = currentSlide.vectorElements || [];
      const newElements = [...currentElements, activeElement];
      const newUndo = [...(currentSlide.undoStack || []), currentElements];

      onSaveVectorElements(newElements, newUndo, []);
      setActiveElement(null);
    }
  };

  // Text tool commit
  const commitText = () => {
    if (!textInput) return;
    const valToCommit = textInput.val.trim();
    if (!valToCommit) {
      setTextInput(null);
      return;
    }

    const newTextElement: VectorElement = {
      id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'text',
      x: textInput.x,
      y: textInput.y,
      text: textInput.val,
      fontSize,
      fontFamily,
      color,
      strokeWidth: 1,
      opacity: 1.0,
    };

    const currentElements = currentSlide.vectorElements || [];
    const newElements = [...currentElements, newTextElement];
    const newUndo = [...(currentSlide.undoStack || []), currentElements];

    onSaveVectorElements(newElements, newUndo, []);
    setTextInput(null);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitText();
    } else if (e.key === 'Escape') {
      textInput && setTextInput(null);
    }
  };

  const getCursorStyle = () => {
    const isBlackboard = currentSlide.backgroundType === 'blackboard';
    const mainColor = isBlackboard ? '#ffffff' : '#000000';
    const outlineColor = isBlackboard ? '#000000' : '#ffffff';

    if (tool === 'pan') {
      const openHandSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0 M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6 M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8 M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83l1.76 1.76' fill='${mainColor}' stroke='${outlineColor}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/></svg>`;

      const closedHandSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M18 11a2 2 0 0 0-2-2 2 2 0 0 0-2 2 M14 10a2 2 0 0 0-2-2 2 2 0 0 0-2 2 M10 10.5a2 2 0 0 0-2-2 2 2 0 0 0-2 2 M18 10a2 2 0 0 1 2 2v2a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-2-2a2 2 0 0 1 2.83-2.83l1.16 1.16' fill='${mainColor}' stroke='${outlineColor}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/></svg>`;

      const handSvg = isPanning ? closedHandSvg : openHandSvg;
      const fallback = isPanning ? 'grabbing' : 'grab';
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(handSvg)}") 12 12, ${fallback}`;
    }

    if (tool === 'eraser') {
      const eraserWidth = Math.max(14, Math.round(brushSize * 3.5 * scale));
      const cursorSize = Math.min(128, Math.max(14, eraserWidth));
      const half = Math.round(cursorSize / 2);
      const strokeW = Math.max(1, Math.min(3, Math.round(cursorSize / 12)));
      const rx = Math.max(2, Math.round(cursorSize / 5));
      const eraserSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}' viewBox='0 0 ${cursorSize} ${cursorSize}' fill='none'><rect x='1' y='1' width='${cursorSize - 2}' height='${cursorSize - 2}' rx='${rx}' fill='${mainColor}' stroke='${outlineColor}' stroke-width='${strokeW}'/></svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(eraserSvg)}") ${half} ${half}, pointer`;
    }

    if (tool === 'pen') {
      const penSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'><path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' fill='${mainColor}' stroke='${outlineColor}' stroke-width='1.8' stroke-linejoin='round'/><path d='M15 5l4 4' stroke='${outlineColor}' stroke-width='1.5'/><polygon points='2,22 4.5,17.5 6.5,19.5' fill='#f59e0b'/><polygon points='2,22 3.2,19.8 4.2,20.8' fill='${mainColor}'/></svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(penSvg)}") 2 22, crosshair`;
    }

    if (tool === 'text') {
      const textSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'><path d='M7 4h10M12 4v16M9 20h6' stroke='${outlineColor}' stroke-width='3.5' stroke-linecap='round'/><path d='M7 4h10M12 4v16M9 20h6' stroke='${mainColor}' stroke-width='2' stroke-linecap='round'/></svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(textSvg)}") 12 12, text`;
    }

    const crosshairSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'><path d='M12 2v8M12 14v8M2 12h8M14 12h8' stroke='${outlineColor}' stroke-width='3' stroke-linecap='round'/><path d='M12 2v8M12 14v8M2 12h8M14 12h8' stroke='${mainColor}' stroke-width='1.5' stroke-linecap='round'/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(crosshairSvg)}") 12 12, crosshair`;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden select-none bg-slate-900/5 backdrop-blur-3xl flex items-center justify-center"
      style={{
        cursor: getCursorStyle(),
      }}
      onMouseDown={startDrawing}
      onMouseMove={drawMove}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={drawMove}
      onTouchEnd={stopDrawing}
    >
      {/* Canvas Viewport Container */}
      <div
        className="absolute shadow-2xl rounded-sm overflow-hidden"
        style={{
          left: `${panOffset.x}px`,
          top: `${panOffset.y}px`,
          width: `${width * scale}px`,
          height: `${height * scale}px`,
        }}
      >
        {/* Previous Background Transition Canvas */}
        <canvas
          ref={prevBgCanvasRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 ease-in-out"
          style={{ opacity: prevBgOpacity, width: `${width * scale}px`, height: `${height * scale}px` }}
        />

        {/* Current Background Canvas */}
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 ease-in-out"
          style={{ opacity: bgOpacity, width: `${width * scale}px`, height: `${height * scale}px` }}
        />

        {/* Vector Drawing Canvas */}
        <canvas
          ref={drawingCanvasRef}
          className="absolute inset-0 touch-none"
          style={{ width: `${width * scale}px`, height: `${height * scale}px` }}
        />

        {/* FLOATING TEXT TOOL EDITOR OVERLAY */}
        {textInput && (
          <div
            id="text-tool-container"
            className="absolute z-30 group animate-scale-up"
            style={{
              left: `${textInput.x * scale}px`,
              top: `${textInput.y * scale}px`,
              width: `${textContainerSize.width * scale}px`,
              height: `${textContainerSize.height * scale}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-blue-500/80 flex flex-col overflow-hidden">
              {/* Header Bar */}
              <div
                className="bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between cursor-move text-xs select-none"
                onPointerDown={handleMoveStart}
              >
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px]">
                  <Move size={12} className="text-blue-500" />
                  <span>Text Box (Press Enter or click Check to add)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={commitText}
                    className="p-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-xs cursor-pointer"
                    title="Commit Text to Board"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setTextInput(null)}
                    className="p-1 rounded bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-600 transition-all cursor-pointer"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Text Input Area */}
              <textarea
                ref={textInputRef}
                id="text-tool-input"
                value={textInput.val}
                onChange={(e) => setTextInput({ ...textInput, val: e.target.value })}
                onKeyDown={handleTextKeyDown}
                placeholder="Type your whiteboard notes here..."
                className="w-full h-full p-3 resize-none outline-none border-none bg-transparent text-slate-900 leading-relaxed font-medium placeholder:text-slate-400 placeholder:italic"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: fontFamily,
                  color: color,
                }}
              />

              {/* Resize Handle East */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-blue-400/40"
                onPointerDown={(e) => handleResizeStart(e, 'e')}
              />
              {/* Resize Handle South */}
              <div
                className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-blue-400/40"
                onPointerDown={(e) => handleResizeStart(e, 's')}
              />
              {/* Resize Handle South-East Corner */}
              <div
                className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize flex items-center justify-center bg-blue-500 rounded-tl-sm text-white shadow-xs"
                onPointerDown={(e) => handleResizeStart(e, 'se')}
              >
                <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-white" />
              </div>
            </div>
          </div>
        )}

        {/* FLOATING IMAGE OVERLAY CONTROLS */}
        {imageOverlay && (
          <div
            id="image-overlay-container"
            className="absolute z-30 group border-2 border-blue-500 border-dashed rounded-lg shadow-2xl bg-white/10 backdrop-blur-xs transition-all"
            style={{
              left: `${imageOverlay.x * scale}px`,
              top: `${imageOverlay.y * scale}px`,
              width: `${imageOverlay.width * scale}px`,
              height: `${imageOverlay.height * scale}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Image Preview */}
            <img
              src={imageOverlay.url}
              alt="Uploaded annotation overlay"
              className="w-full h-full object-contain pointer-events-none rounded-md"
            />

            {/* Header Drag Handle Bar */}
            <div
              className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white border border-slate-700 px-3 py-1 rounded-full shadow-lg flex items-center gap-2 text-xs cursor-move z-40"
              onPointerDown={handleImageMoveStart}
            >
              <Move size={12} className="text-blue-400" />
              <span className="text-[11px] font-medium">Position Image</span>
              <div className="w-px h-3 bg-slate-700 my-auto mx-0.5" />
              <button
                onClick={commitImage}
                className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              >
                <Check size={11} />
                <span>Place</span>
              </button>
              <button
                onClick={cancelImage}
                className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white text-[10px] cursor-pointer transition-all"
              >
                <X size={11} />
              </button>
            </div>

            {/* Corner Resize Handles */}
            <div
              className="absolute -bottom-2 -right-2 w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-md cursor-se-resize hover:scale-125 transition-transform"
              onPointerDown={(e) => handleImageResizeStart(e, 'se')}
            />
            <div
              className="absolute -bottom-2 -left-2 w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-md cursor-sw-resize hover:scale-125 transition-transform"
              onPointerDown={(e) => handleImageResizeStart(e, 'sw')}
            />
            <div
              className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-md cursor-ne-resize hover:scale-125 transition-transform"
              onPointerDown={(e) => handleImageResizeStart(e, 'ne')}
            />
            <div
              className="absolute -top-2 -left-2 w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-md cursor-nw-resize hover:scale-125 transition-transform"
              onPointerDown={(e) => handleImageResizeStart(e, 'nw')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
