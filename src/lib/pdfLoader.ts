// Script loader for pdf.js CDN

let pdfjsPromise: Promise<any> | null = null;

export function loadPdfJS(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.hasOwnProperty('pdfjsLib')) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        // Configure worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      } else {
        reject(new Error('PDF.js loaded but pdfjsLib is not defined on window'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load PDF.js from CDN'));
    };

    document.head.appendChild(script);
  });

  return pdfjsPromise;
}

export interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads a PDF file and returns the total page count
 */
export async function getPdfInfo(pdfUrl: string): Promise<number> {
  const pdfjsLib = await loadPdfJS();
  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

/**
 * Renders a specific page of a PDF file to a Data URL
 */
export async function renderPdfPage(pdfUrl: string, pageNum: number, maxDimension = 1920): Promise<RenderedPage> {
  const pdfjsLib = await loadPdfJS();
  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNum);

  // Get viewport at default scale (1.0)
  let viewport = page.getViewport({ scale: 1.0 });

  // Calculate appropriate scale to render at target resolution
  const width = viewport.width;
  const height = viewport.height;
  const currentMax = Math.max(width, height);
  const scale = currentMax > 0 ? maxDimension / currentMax : 1.0;

  viewport = page.getViewport({ scale: scale });

  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get 2D context for offscreen canvas');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render PDF page into canvas context
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  // Convert to JPEG for smaller storage size/memory footprint than PNG
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  return {
    dataUrl,
    width: viewport.width,
    height: viewport.height,
  };
}
