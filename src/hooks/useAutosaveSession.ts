import { useEffect, useState } from 'react';
import { Slide } from '../types';

const STORAGE_KEY = 'whiteboard_teacher_session';

export interface SavedSession {
  slides: Slide[];
  activeSlideIndex: number;
  pdfPageImages: Record<string, string>;
  pdfPageDimensions: Record<string, { width: number; height: number }>;
  timestamp: number;
  partialSave?: boolean;
}

export function useAutosaveSession(
  slides: Slide[],
  activeSlideIndex: number,
  pdfPageImages: Record<string, string>,
  pdfPageDimensions: Record<string, { width: number; height: number }>,
  triggerToast?: (msg: string) => void
) {
  const [hasSavedSession, setHasSavedSession] = useState<boolean>(false);

  // Check if a saved session exists on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          // Verify it's not just the initial blank whiteboard with no drawing
          const isInitialEmpty = 
            parsed.slides.length === 1 && 
            parsed.slides[0].id === 'slide-initial-whiteboard' && 
            !parsed.slides[0].drawingDataUrl;
            
          if (!isInitialEmpty) {
            setHasSavedSession(true);
          }
        }
      }
    } catch (e) {
      console.error('Failed to check saved session in localStorage:', e);
    }
  }, []);

  // Autosave when key state elements change
  useEffect(() => {
    // Avoid saving if it's only the initial clean state with no drawings
    const isInitialEmpty = 
      slides.length === 1 && 
      slides[0].id === 'slide-initial-whiteboard' && 
      !slides[0].drawingDataUrl;

    if (isInitialEmpty) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        const sessionData: SavedSession = {
          slides,
          activeSlideIndex,
          pdfPageImages,
          pdfPageDimensions,
          timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        setHasSavedSession(true);
      } catch (e: any) {
        console.warn('Failed to save complete session to localStorage:', e);
        
        // Handle QuotaExceededError (code 22 or name QuotaExceededError)
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.number === 0x8007000E) {
          try {
            // Fallback: save drawing slides and page metadata, but omit the heavy PDF background images
            const fallbackSessionData: SavedSession = {
              slides,
              activeSlideIndex,
              pdfPageImages: {}, // drop the base64 background PDF images
              pdfPageDimensions,
              timestamp: Date.now(),
              partialSave: true,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackSessionData));
            setHasSavedSession(true);
            if (triggerToast) {
              triggerToast('Session saved (whiteboards & sketches only, PDF backgrounds omitted to fit storage limits)');
            }
          } catch (innerErr) {
            console.error('Fallback save to localStorage also failed:', innerErr);
          }
        }
      }
    }, 1200); // 1.2s debounce to avoid high-frequency write operations during draws/undos

    return () => clearTimeout(timer);
  }, [slides, activeSlideIndex, pdfPageImages, pdfPageDimensions, triggerToast]);

  const loadSession = (): SavedSession | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as SavedSession;
      }
    } catch (e) {
      console.error('Failed to parse saved session:', e);
    }
    return null;
  };

  const clearSession = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHasSavedSession(false);
    } catch (e) {
      console.error('Failed to clear saved session:', e);
    }
  };

  return {
    hasSavedSession,
    loadSession,
    clearSession,
  };
}
