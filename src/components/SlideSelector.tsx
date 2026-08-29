import React, { useState, useRef, useEffect } from 'react';
import { BackgroundType, Slide } from '../types';
import {
  Plus,
  Trash2,
  FileText,
  Upload,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Presentation,
} from 'lucide-react';

interface SlideSelectorProps {
  slides: Slide[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddBlankSlide: (backgroundType: BackgroundType) => void;
  onDeleteSlide: (index: number) => void;
  onUploadDocument: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingDocument: boolean;
  pdfPageImages: Record<string, string>; // keyed by `slide.pdfFileId-slide.pdfPageNum`
  isDarkMode?: boolean;
}

export default function SlideSelector({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddBlankSlide,
  onDeleteSlide,
  onUploadDocument,
  isUploadingDocument,
  pdfPageImages,
  isDarkMode = false,
}: SlideSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);

  // Close Slide Selector and Add Menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMinimized(true);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerDocumentUpload = () => {
    fileInputRef.current?.click();
  };

  const getBackgroundClass = (bgType: string) => {
    switch (bgType) {
      case 'white':
        return 'bg-white';
      case 'cream':
        return 'bg-[#FAF7F0]';
      case 'grid':
        return 'bg-white bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] bg-[size:8px_8px]';
      case 'ruled':
        return 'bg-[#FAF7F0] bg-[linear-gradient(to_bottom,transparent_9px,#E2E8F0_10px)] bg-[size:100%_10px]';
      case 'chalkboard':
        return 'bg-[#123022] text-emerald-100';
      case 'blackboard':
        return 'bg-black text-white';
      default:
        return 'bg-white';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      {/* Hidden Document file uploader input (PDF and PPT/PPTX) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onUploadDocument}
        accept=".pdf,.pptx,.ppt,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        id="document-file-uploader"
      />

      {/* Slide Dock Vertical Control Pill */}
      <div className={`flex flex-col items-center gap-1 p-1 rounded-2xl border shadow-xl backdrop-blur-md transition-all select-none ${
        isDarkMode
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-100'
          : 'bg-white/95 border-slate-200/90 text-slate-800'
      }`}>
        {/* Previous Slide Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (activeSlideIndex > 0) onSelectSlide(activeSlideIndex - 1);
          }}
          disabled={activeSlideIndex === 0}
          className={`p-1.5 rounded-xl transition-all ${
            activeSlideIndex === 0
              ? 'opacity-30 cursor-not-allowed'
              : isDarkMode
              ? 'hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer active:scale-95'
              : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer active:scale-95'
          }`}
          title="Previous Slide"
        >
          <ChevronUp size={16} />
        </button>

        {/* Slide Counter & Panel Toggle Button */}
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
            !isMinimized
              ? 'bg-blue-600 text-white shadow-xs'
              : isDarkMode
              ? 'hover:bg-slate-800/80 text-slate-200'
              : 'hover:bg-slate-100/80 text-slate-800'
          }`}
          title={isMinimized ? "Show Slides Panel" : "Hide Slides Panel"}
          id="btn-show-slides-panel"
        >
          <Layers size={18} className={!isMinimized ? 'text-white' : 'text-blue-500'} />
          <span className="text-[10px] font-bold tracking-tight mt-0.5 font-mono">
            {activeSlideIndex + 1}/{slides.length}
          </span>
        </button>

        {/* Next Slide Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (activeSlideIndex < slides.length - 1) onSelectSlide(activeSlideIndex + 1);
          }}
          disabled={activeSlideIndex === slides.length - 1}
          className={`p-1.5 rounded-xl transition-all ${
            activeSlideIndex === slides.length - 1
              ? 'opacity-30 cursor-not-allowed'
              : isDarkMode
              ? 'hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer active:scale-95'
              : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer active:scale-95'
          }`}
          title="Next Slide"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Flyout Expanded Slides Drawer Panel */}
      {!isMinimized && (
        <div
          className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 w-64 md:w-72 max-h-[82vh] h-[640px] rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col p-3 gap-2.5 z-50 animate-slide-in select-none ${
            isDarkMode
              ? 'bg-slate-900/98 border-slate-700/80 text-slate-100'
              : 'bg-white/98 border-slate-200/90 text-slate-800'
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-1.5">
              <Layers size={16} className="text-blue-500" />
              <div className="text-xs font-bold tracking-tight">Slide Deck</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}>
                {slides.length}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsMinimized(true)}
              className={`p-1 rounded-xl transition-all cursor-pointer ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Close Slides Panel"
              id="btn-close-slides-panel"
            >
              <X size={15} />
            </button>
          </div>

          {/* Action Buttons Bar: Single unified Import button and Slide button */}
          <div className="flex items-center gap-2" ref={addMenuRef}>
            <button
              onClick={triggerDocumentUpload}
              disabled={isUploadingDocument}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-semibold rounded-xl shadow-xs transition-all hover:shadow active:scale-95 cursor-pointer"
              title="Import PDF document or PowerPoint (.pptx, .ppt) presentation"
              id="btn-import-document"
            >
              <Upload size={12} />
              <span>Import</span>
            </button>

            <div className="relative flex-1">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className={`w-full flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold rounded-xl border transition-all hover:shadow active:scale-95 cursor-pointer ${
                  showAddMenu
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Add New Whiteboard Slide"
                id="btn-add-slide-menu"
              >
                <Plus size={12} />
                <span>Slide</span>
              </button>

              {/* Add Slide Type Flyout Menu */}
              {showAddMenu && (
                <div
                  className={`absolute right-0 top-full mt-2 p-1.5 rounded-2xl border shadow-2xl flex flex-col gap-0.5 w-44 backdrop-blur-xl z-50 ${
                    isDarkMode
                      ? 'bg-slate-900/98 border-slate-700 text-slate-100'
                      : 'bg-white/98 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Insert Background
                  </div>
                  {[
                    { id: 'white', label: 'Plain White' },
                    { id: 'grid', label: 'Math Grid' },
                    { id: 'blackboard', label: 'Black Board' },
                    { id: 'chalkboard', label: 'Green Chalkboard' },
                    { id: 'cream', label: 'Warm Cream' },
                    { id: 'ruled', label: 'Ruled Lines' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => {
                        onAddBlankSlide(bg.id as any);
                        setShowAddMenu(false);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                        isDarkMode
                          ? 'hover:bg-slate-800 text-slate-200'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full border border-slate-400/60" />
                      <span>{bg.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Progress Indicator */}
          {isUploadingDocument && (
            <div className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] font-medium text-blue-500 animate-pulse text-center">
              Importing slides from document...
            </div>
          )}

          <div className={`h-[1px] w-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-150'}`} />

          {/* Vertical Scrollable Slide Thumbnails List without ugly scrollbar */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-0.5 [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slides.map((slide, idx) => {
              const isActive = idx === activeSlideIndex;
              const docImgKey = slide.pdfFileId && slide.pdfPageNum ? `${slide.pdfFileId}-${slide.pdfPageNum}` : '';
              const docImgSrc = docImgKey ? pdfPageImages[docImgKey] : null;

              return (
                <div
                  key={slide.id}
                  onClick={() => onSelectSlide(idx)}
                  className={`relative group flex flex-col gap-1.5 shrink-0 rounded-xl border p-1.5 cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'border-blue-500/90 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm ring-2 ring-blue-500/20'
                      : isDarkMode
                      ? 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/60'
                      : 'border-slate-200/80 bg-slate-50/80 hover:border-slate-300 hover:bg-white'
                  }`}
                  id={`slide-card-${slide.id}`}
                >
                  {/* Thumbnail Image Box */}
                  <div className={`relative w-full aspect-[16/10] rounded-xl overflow-hidden border flex items-center justify-center transition-colors ${
                    isDarkMode ? 'border-slate-800/80 bg-slate-950' : 'border-slate-200/80 bg-slate-100'
                  }`}>
                    {(slide.type === 'pdf' || slide.type === 'ppt') && docImgSrc ? (
                      <div className="relative w-full h-full bg-white">
                        <img
                          src={docImgSrc}
                          alt={`page-${slide.pdfPageNum}`}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        {slide.drawingDataUrl && (
                          <img
                            src={slide.drawingDataUrl}
                            alt="drawings"
                            className="absolute inset-0 w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <span className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md text-[8px] text-white font-mono border ${
                          slide.type === 'ppt' ? 'bg-orange-950/80 border-orange-700/40' : 'bg-slate-900/80 border-slate-700/40'
                        }`}>
                          {slide.type === 'ppt' ? `PPT ${slide.pdfPageNum}` : `PDF P.${slide.pdfPageNum}`}
                        </span>
                      </div>
                    ) : slide.type === 'pdf' ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <FileText size={18} className="text-amber-500 animate-pulse" />
                        <span className="text-[9px] text-amber-600 font-mono font-medium">Page {slide.pdfPageNum}</span>
                      </div>
                    ) : slide.type === 'ppt' ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Presentation size={18} className="text-orange-500 animate-pulse" />
                        <span className="text-[9px] text-orange-600 font-mono font-medium">Slide {slide.pdfPageNum}</span>
                      </div>
                    ) : (
                      <div className={`relative w-full h-full flex items-center justify-center ${getBackgroundClass(slide.backgroundType)}`}>
                        {slide.drawingDataUrl && (
                          <img
                            src={slide.drawingDataUrl}
                            alt="drawings"
                            className="absolute inset-0 w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-900/75 border border-slate-700/30 rounded-md text-[8px] text-white font-medium capitalize">
                          {slide.backgroundType}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer label & Delete Action */}
                  <div className="flex items-center justify-between pt-1.5 px-1 text-[11px]">
                    <span className={`truncate font-medium ${isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <span className="font-mono text-slate-400 mr-1">{idx + 1}.</span>
                      {slide.title}
                    </span>

                    {slides.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSlide(idx);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all cursor-pointer ${
                          isDarkMode
                            ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/60'
                            : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                        }`}
                        title="Delete slide"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
