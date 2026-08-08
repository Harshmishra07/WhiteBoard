import React, { useState, useRef, useEffect } from 'react';
import { BackgroundType, Tool } from '../types';
import { Palette, Layers, Type, Sliders, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';

interface StyleSettingsProps {
  tool: Tool;
  color: string;
  setColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  backgroundType: BackgroundType;
  setBackgroundType: (type: BackgroundType) => void;
  hasPdfBackground: boolean;
  isDarkMode?: boolean;
}

const BRUSH_SIZES = [2, 5, 10, 16, 24, 32];
const FONT_SIZES = [16, 20, 24, 32, 48, 64, 72];
const FONT_FAMILIES = [
  { label: 'Sans-Serif', value: 'Inter' },
  { label: 'Serif', value: 'Georgia' },
  { label: 'Monospace', value: 'JetBrains Mono' },
  { label: 'Comic Sans', value: 'Comic Sans MS' },
];

export default function StyleSettings({
  tool,
  color,
  setColor,
  brushSize,
  setBrushSize,
  opacity,
  setOpacity,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  backgroundType,
  setBackgroundType,
  hasPdfBackground,
  isDarkMode = false,
}: StyleSettingsProps) {
  const [activePopover, setActivePopover] = useState<'none' | 'color' | 'brush' | 'opacity' | 'text' | 'board'>('none');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isNear, setIsNear] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePopover('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Proximity fade in/out on mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dist = Math.hypot(
        Math.max(rect.left - e.clientX, 0, e.clientX - rect.right),
        Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom)
      );
      setIsNear(dist < 160 || activePopover !== 'none');
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [activePopover]);

  const togglePopover = (popover: 'color' | 'brush' | 'opacity' | 'text' | 'board') => {
    setActivePopover((prev) => (prev === popover ? 'none' : popover));
  };

  if (isMinimized) {
    return (
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md ${
            isDarkMode
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-100'
              : 'bg-white/90 hover:bg-slate-50 border-slate-200/90 text-slate-800'
          }`}
          title="Show Style Panel"
          id="btn-show-style-panel"
        >
          <div className="relative flex items-center justify-center">
            <Palette size={20} className="text-blue-500" />
            <span
              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 shadow-xs"
              style={{ backgroundColor: color }}
            />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsNear(true)}
      className={`relative transition-all duration-300 ease-in-out ${
        isNear
          ? 'opacity-100 scale-100 translate-x-0'
          : 'opacity-30 scale-95 -translate-x-1 hover:opacity-100 hover:scale-100 hover:translate-x-0'
      }`}
    >
      {/* Vertical Style Dock for Left Side Panel */}
      <div
        className={`p-2 rounded-[28px] border shadow-[0_12px_36px_rgba(0,0,0,0.08)] backdrop-blur-xl select-none transition-all duration-200 flex flex-col items-center gap-1.5 ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 text-slate-100'
            : 'bg-white/95 border-slate-200/80 text-slate-800'
        }`}
      >
        {/* Brush Size Button & Popover */}
        <div className="relative">
          <button
            onClick={() => togglePopover('brush')}
            className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activePopover === 'brush'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : isDarkMode
                ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
            title="Adjust Brush Size"
          >
            <Sliders size={15} />
            <span className="text-[9px] font-mono font-bold leading-none mt-0.5">{brushSize}</span>
          </button>

          {activePopover === 'brush' && (
            <div
              className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl border shadow-2xl w-64 flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-xl z-50 ${
                isDarkMode ? 'bg-slate-900/98 border-slate-700 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Sliders size={13} /> Brush Size</span>
                <span className="font-mono text-blue-500">{brushSize}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-slate-200 dark:bg-slate-800"
              />
              <div className="flex gap-1">
                {BRUSH_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setBrushSize(size);
                      setActivePopover('none');
                    }}
                    className={`flex-1 py-1 text-[11px] font-mono rounded-lg border text-center transition-all cursor-pointer ${
                      brushSize === size
                        ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-xs'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Opacity Button (if Highlighter active) */}
        {tool === 'highlighter' && (
          <div className="relative">
            <button
              onClick={() => togglePopover('opacity')}
              className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                activePopover === 'opacity'
                  ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-500/25'
                  : isDarkMode
                  ? 'text-yellow-400 hover:bg-slate-800/80'
                  : 'text-yellow-700 hover:bg-yellow-50/80'
              }`}
              title="Adjust Transparency"
            >
              <span className="text-[10px] font-mono font-bold">{Math.round(opacity * 100)}%</span>
            </button>

            {activePopover === 'opacity' && (
              <div
                className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl border shadow-2xl w-56 flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-xl z-50 ${
                  isDarkMode ? 'bg-slate-900/98 border-slate-700 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-yellow-500 uppercase tracking-wider">
                  <span>Transparency</span>
                  <span className="font-mono">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-yellow-500 bg-slate-200 dark:bg-slate-800"
                />
              </div>
            )}
          </div>
        )}

        {/* Text Settings Button (if Text Tool active) */}
        {tool === 'text' && (
          <div className="relative">
            <button
              onClick={() => togglePopover('text')}
              className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                activePopover === 'text'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isDarkMode
                  ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
              title="Text Options"
            >
              <Type size={15} />
              <span className="text-[9px] font-mono font-bold leading-none mt-0.5">{fontSize}</span>
            </button>

            {activePopover === 'text' && (
              <div
                className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl border shadow-2xl w-64 flex flex-col gap-3 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-xl z-50 ${
                  isDarkMode ? 'bg-slate-900/98 border-slate-700 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-medium font-sans">Font Style</span>
                  <div className="grid grid-cols-2 gap-1">
                    {FONT_FAMILIES.map((font) => (
                      <button
                        key={font.value}
                        onClick={() => setFontFamily(font.value)}
                        className={`py-1 px-2 text-xs rounded border transition-all truncate cursor-pointer ${
                          fontFamily === font.value
                            ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                            : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-medium font-sans">Font Size ({fontSize}px)</span>
                  <div className="grid grid-cols-4 gap-1">
                    {FONT_SIZES.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setFontSize(size);
                          setActivePopover('none');
                        }}
                        className={`py-1 text-xs font-mono rounded border text-center transition-all cursor-pointer ${
                          fontSize === size
                            ? 'bg-blue-600 text-white border-blue-500 font-bold'
                            : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Board Style Button */}
        <div className="relative">
          <button
            onClick={() => togglePopover('board')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activePopover === 'board'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : isDarkMode
                ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
            title="Change Board Style"
          >
            <Layers size={18} strokeWidth={2} />
          </button>

          {activePopover === 'board' && (
            <div
              className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 p-3 rounded-2xl border shadow-2xl w-60 flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-xl z-50 ${
                isDarkMode ? 'bg-slate-900/98 border-slate-700 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Layers size={13} /> Board Background
              </div>

              {hasPdfBackground ? (
                <div className={`text-xs border rounded-xl p-2.5 leading-relaxed ${
                  isDarkMode ? 'text-amber-400 bg-amber-950/20 border-amber-900/50' : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}>
                  PDF page slide background active
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {[
                    { id: 'white', label: 'Plain Whiteboard', badgeBg: 'bg-white border-slate-300' },
                    { id: 'blackboard', label: 'Dark Blackboard', badgeBg: 'bg-black border-slate-700' },
                    { id: 'chalkboard', label: 'Green Chalkboard', badgeBg: 'bg-[#123022] border-teal-700' },
                    { id: 'cream', label: 'Warm Cream Paper', badgeBg: 'bg-[#FAF7F0] border-amber-200' },
                    { id: 'grid', label: 'Math/Graph Grid', badgeBg: 'bg-slate-100 border-sky-300' },
                    { id: 'ruled', label: 'Lined Writing Paper', badgeBg: 'bg-[#FAF7F0] border-red-200' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => {
                        setBackgroundType(bg.id as BackgroundType);
                        setActivePopover('none');
                      }}
                      className={`flex items-center gap-2 p-1.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                        backgroundType === bg.id
                          ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-xs'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-md border shrink-0 ${bg.badgeBg}`} />
                      <span>{bg.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

