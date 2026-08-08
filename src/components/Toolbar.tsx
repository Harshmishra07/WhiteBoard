import React, { useState, useRef, useEffect } from 'react';
import { BackgroundType, Tool } from '../types';
import {
  Pen,
  Highlighter,
  Eraser,
  Type,
  Minus,
  ArrowRight,
  Square,
  Circle as CircleIcon,
  Triangle,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Maximize,
  Shapes,
  Check,
  Palette,
  Sliders,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onFitScreen: () => void;
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
  onUploadImage?: (dataUrl: string) => void;
  hasPdfBackground?: boolean;
  isDarkMode?: boolean;
}

const COLOR_PRESETS = [
  '#000000', // Black
  '#ffffff', // White
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

const BRUSH_SIZES = [2, 5, 10, 16, 24, 32];
const FONT_SIZES = [16, 20, 24, 32, 48, 64, 72];
const FONT_FAMILIES = [
  { label: 'Sans-Serif', value: 'Inter' },
  { label: 'Serif', value: 'Georgia' },
  { label: 'Monospace', value: 'JetBrains Mono' },
  { label: 'Comic Sans', value: 'Comic Sans MS' },
];

export default function Toolbar({
  activeTool,
  setActiveTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onFitScreen,
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
  onUploadImage,
  hasPdfBackground = false,
  isDarkMode = false,
}: ToolbarProps) {
  const [activePopover, setActivePopover] = useState<'none' | 'shapes' | 'color' | 'brush' | 'opacity' | 'text' | 'board'>('none');
  const [isNear, setIsNear] = useState<boolean>(true);
  
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadImage) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onUploadImage(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const basicTools = [
    { id: 'pen', label: 'Pen', icon: Pen },
    { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'text', label: 'Text Tool', icon: Type },
    { id: 'pan', label: 'Pan Canvas (Hand)', icon: Hand },
  ];

  const shapeTools = [
    { id: 'line', label: 'Straight Line', icon: Minus },
    { id: 'arrow', label: 'Arrow', icon: ArrowRight },
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'circle', label: 'Circle', icon: CircleIcon },
    { id: 'triangle', label: 'Triangle', icon: Triangle },
  ];

  const isShapeActive = shapeTools.some((s) => s.id === activeTool);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopover('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Proximity fade in/out on mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!toolbarRef.current) return;
      const rect = toolbarRef.current.getBoundingClientRect();
      const dist = Math.hypot(
        Math.max(rect.left - e.clientX, 0, e.clientX - rect.right),
        Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom)
      );
      setIsNear(dist < 180 || activePopover !== 'none');
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [activePopover]);

  const togglePopover = (popover: 'shapes' | 'color' | 'brush' | 'opacity' | 'text' | 'board') => {
    setActivePopover((prev) => (prev === popover ? 'none' : popover));
  };

  const activeShapeObj = shapeTools.find((s) => s.id === activeTool);
  const ShapeIcon = activeShapeObj ? activeShapeObj.icon : Shapes;

  return (
    <div
      ref={toolbarRef}
      onMouseEnter={() => setIsNear(true)}
      className={`relative flex items-center transition-all duration-300 ease-in-out ${
        isNear ? 'opacity-100 scale-100 translate-x-0' : 'opacity-40 scale-95 -translate-x-1 hover:opacity-100 hover:scale-100 hover:translate-x-0'
      }`}
    >
      {/* Main Unified Floating Tool Dock in 2-Column Grid */}
      <div
        className={`p-2 rounded-[28px] border shadow-[0_12px_36px_rgba(0,0,0,0.12)] backdrop-blur-xl select-none transition-all duration-200 grid grid-cols-2 gap-1.5 items-center justify-center ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 text-slate-100'
            : 'bg-white/95 border-slate-200/80 text-slate-800'
        }`}
      >
        {/* SECTION 1: Drawing Tools (2 Columns) */}
        {basicTools.map((t) => {
          const IconComponent = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTool(t.id as Tool);
                setActivePopover('none');
              }}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isDarkMode
                  ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
              title={t.label}
              id={`tool-btn-${t.id}`}
            >
              <IconComponent size={19} strokeWidth={2} />
            </button>
          );
        })}

        {/* Upload Image Button */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
            isDarkMode
              ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
          title="Upload & Insert Image"
          id="tool-btn-upload-image"
        >
          <ImageIcon size={19} strokeWidth={2} />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="hidden"
          />
        </button>

        {/* Shapes Menu Toggle Button with Flyout Popover */}
        <div className="relative">
          <button
            onClick={() => togglePopover('shapes')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
              isShapeActive || activePopover === 'shapes'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : isDarkMode
                ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
            title="Shapes & Lines"
            id="tool-btn-shapes"
          >
            <ShapeIcon size={19} strokeWidth={2} className={activeTool === 'line' ? 'rotate-[-45deg]' : ''} />
          </button>

          {/* Shapes Side Flyout Menu */}
          {activePopover === 'shapes' && (
            <div
              className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl border shadow-2xl flex flex-col gap-1 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-left-2 duration-150 ${
                isDarkMode
                  ? 'bg-slate-900/98 border-slate-700 text-slate-100'
                  : 'bg-white/98 border-slate-200 text-slate-800'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                Shapes & Lines
              </div>
              {shapeTools.map((s) => {
                const IconComponent = s.icon;
                const isActive = activeTool === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveTool(s.id as Tool);
                      setActivePopover('none');
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    title={s.label}
                  >
                    <IconComponent size={17} className={s.id === 'line' ? 'rotate-[-45deg]' : ''} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider across 2 columns */}
        <div className={`col-span-2 w-full h-[1px] my-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200/80'}`} />

        {/* SECTION 2: Color & Style Options */}
        {/* Color Button & Popover */}
        <div className="relative">
          <button
            onClick={() => togglePopover('color')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activePopover === 'color'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : isDarkMode
                ? 'hover:bg-slate-800/80'
                : 'hover:bg-slate-100/80'
            }`}
            title="Color Palette"
            id="tool-btn-color"
          >
            <div className="relative flex items-center justify-center">
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-md transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
              />
              {color.toLowerCase() === '#ffffff' && (
                <div className="absolute inset-0 rounded-full border border-slate-400" />
              )}
            </div>
          </button>

          {/* Color Flyout Popover */}
          {activePopover === 'color' && (
            <div
              className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl border shadow-2xl w-56 flex flex-col gap-3 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-xl z-50 ${
                isDarkMode ? 'bg-slate-900/98 border-slate-700 text-slate-100' : 'bg-white/98 border-slate-200 text-slate-800'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                <span>Color Palette</span>
                <span className="font-mono text-xs uppercase" style={{ color: color }}>{color}</span>
              </div>

              {/* Preset Swatches */}
              <div className="grid grid-cols-4 gap-2 items-center justify-center">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setColor(preset);
                    }}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                      color.toLowerCase() === preset.toLowerCase()
                        ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900 scale-105'
                        : ''
                    } ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
                    style={{ backgroundColor: preset }}
                    title={`Color: ${preset}`}
                  >
                    {color.toLowerCase() === preset.toLowerCase() && (
                      <Check
                        size={14}
                        className={preset === '#ffffff' ? 'text-slate-900' : 'text-white'}
                        style={{ filter: preset === '#ffffff' ? 'none' : 'drop-shadow(0px 1px 2px rgba(0,0,0,0.6))' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className={`pt-2 border-t flex items-center gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div
                  className="relative flex-1 h-9 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 transition-opacity"
                  title="Custom Color Picker"
                >
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#000000'}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                  <Palette size={14} className="text-white drop-shadow pointer-events-none" />
                  <span className="text-xs font-semibold text-white drop-shadow pointer-events-none">Custom Color</span>
                </div>
              </div>
            </div>
          )}
        </div>

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
            title="Adjust Stroke Size"
            id="tool-btn-brush-size"
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
                <span className="flex items-center gap-1.5"><Sliders size={13} /> Stroke Size</span>
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
                    { id: 'cream', label: 'Warm Cream Paper', badgeBg: 'bg-[#FAF7F0] border-amber-200' },
                    { id: 'grid', label: 'Math/Graph Grid', badgeBg: 'bg-slate-100 border-sky-300' },
                    { id: 'ruled', label: 'Lined Writing Paper', badgeBg: 'bg-[#FAF7F0] border-red-200' },
                    { id: 'chalkboard', label: 'Green Chalkboard', badgeBg: 'bg-[#123022] border-teal-700' },
                    { id: 'blackboard', label: 'Dark Blackboard', badgeBg: 'bg-[#121212] border-slate-600' },
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

        {/* Conditional Opacity or Text Settings button (if active tool needs it) */}
        {activeTool === 'highlighter' ? (
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
        ) : activeTool === 'text' ? (
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
        ) : null}

        {/* Divider across 2 columns */}
        <div className={`col-span-2 w-full h-[1px] my-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200/80'}`} />

        {/* SECTION 3: Action Controls (Undo, Redo, Zoom, Clear) */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 ${
            canUndo
              ? isDarkMode
                ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white hover:scale-105 active:scale-95 cursor-pointer'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 hover:scale-105 active:scale-95 cursor-pointer'
              : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
          id="btn-undo"
        >
          <Undo2 size={18} strokeWidth={2} />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 ${
            canRedo
              ? isDarkMode
                ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white hover:scale-105 active:scale-95 cursor-pointer'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 hover:scale-105 active:scale-95 cursor-pointer'
              : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
          id="btn-redo"
        >
          <Redo2 size={18} strokeWidth={2} />
        </button>

        <button
          onClick={onFitScreen}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
            isDarkMode
              ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
          title="Fit Canvas to Screen"
          id="btn-fit-screen"
        >
          <Maximize size={18} strokeWidth={2} />
        </button>

        <button
          onClick={onClear}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40`}
          title="Clear Slide Content"
          id="btn-clear-canvas"
        >
          <Trash2 size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
