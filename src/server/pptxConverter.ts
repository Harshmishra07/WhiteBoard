import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { PptxRenderer } from 'pptx-svg';

export interface ConvertedSlide {
  slideNumber: number;
  title: string;
  width: number;
  height: number;
  aspectRatio: number;
  svg: string;
  dataUrl: string;
  extractedText: string;
}

export interface PptxConversionResult {
  slideCount: number;
  slides: ConvertedSlide[];
  width: number;
  height: number;
  aspectRatio: number;
}

let cachedWasmBuffer: ArrayBuffer | null = null;

function getWasmBuffer(): ArrayBuffer {
  if (!cachedWasmBuffer) {
    const wasmPath = path.resolve(process.cwd(), 'node_modules/pptx-svg/dist/main.wasm');
    const fileBuf = fs.readFileSync(wasmPath);
    cachedWasmBuffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
  }
  return cachedWasmBuffer;
}

function parseXml(xmlString: string): any {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

function getElements(parent: any, ...tagNames: string[]): any[] {
  if (!parent || !parent.getElementsByTagName) return [];
  const results: any[] = [];
  for (const name of tagNames) {
    const list = parent.getElementsByTagName(name);
    if (list) {
      for (let i = 0; i < list.length; i++) {
        results.push(list[i]);
      }
    }
  }
  return results;
}

function getFirstElement(parent: any, ...tagNames: string[]): any | null {
  if (!parent || !parent.getElementsByTagName) return null;
  for (const name of tagNames) {
    const list = parent.getElementsByTagName(name);
    if (list && list.length > 0) {
      return list[0];
    }
  }
  return null;
}

/**
 * Extract slide dimensions from presentation.xml in EMU
 */
async function getSlideDimensionsFromZip(zip: JSZip): Promise<{ widthEmu: number; heightEmu: number; aspectRatio: number; targetWidth: number; targetHeight: number }> {
  const defaultDim = { widthEmu: 12192000, heightEmu: 6858000, aspectRatio: 16 / 9, targetWidth: 1920, targetHeight: 1080 };
  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) return defaultDim;

  try {
    const xmlText = await presFile.async('text');
    const doc = parseXml(xmlText);
    const sldSz = getFirstElement(doc, 'p:sldSz', 'sldSz');
    if (sldSz) {
      const cx = parseInt(sldSz.getAttribute('cx') || '0', 10);
      const cy = parseInt(sldSz.getAttribute('cy') || '0', 10);
      if (cx > 0 && cy > 0) {
        const aspect = cx / cy;
        // Standardize base slide resolution to 1920 width with exact aspect ratio
        const targetWidth = 1920;
        const targetHeight = Math.round(1920 / aspect);
        return {
          widthEmu: cx,
          heightEmu: cy,
          aspectRatio: aspect,
          targetWidth,
          targetHeight,
        };
      }
    }
  } catch (err) {
    console.warn('Could not read slide dimensions from presentation.xml:', err);
  }

  return defaultDim;
}

/**
 * Extract text and title for a specific slide XML
 */
async function extractSlideMetadata(zip: JSZip, slideIdx: number): Promise<{ title: string; extractedText: string }> {
  let title = '';
  let extractedText = '';

  const slideFile = zip.file(`ppt/slides/slide${slideIdx + 1}.xml`);
  if (!slideFile) return { title: `Slide ${slideIdx + 1}`, extractedText: '' };

  try {
    const xmlText = await slideFile.async('text');
    const doc = parseXml(xmlText);
    const spElements = getElements(doc, 'p:sp', 'sp');

    const textBlocks: string[] = [];

    for (const sp of spElements) {
      const nvSpPr = getFirstElement(sp, 'p:nvSpPr', 'nvSpPr');
      const ph = getFirstElement(nvSpPr, 'p:ph', 'ph');
      const phType = ph?.getAttribute('type') || '';

      const txBody = getFirstElement(sp, 'p:txBody', 'txBody');
      if (!txBody) continue;

      const paragraphs = getElements(txBody, 'a:p', 'p');
      let shapeText = '';

      for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const p = paragraphs[pIdx];
        const pPr = getFirstElement(p, 'a:pPr', 'pPr');
        const lvl = parseInt(pPr?.getAttribute('lvl') || '0', 10);
        const buNone = getFirstElement(pPr, 'a:buNone', 'buNone');
        const buChar = getFirstElement(pPr, 'a:buChar', 'buChar')?.getAttribute('char');
        const buAutoNum = getFirstElement(pPr, 'a:buAutoNum', 'buAutoNum');

        let bulletPrefix = '';
        if (!buNone) {
          if (buChar) bulletPrefix = `${buChar} `;
          else if (buAutoNum) bulletPrefix = `${pIdx + 1}. `;
          else if (lvl > 0) bulletPrefix = '• '.repeat(lvl);
        }

        const runs = getElements(p, 'a:r', 'r');
        let pText = '';
        if (runs.length > 0) {
          runs.forEach((r) => {
            const t = getFirstElement(r, 'a:t', 't')?.textContent || '';
            pText += t;
          });
        } else {
          const tNodes = getElements(p, 'a:t', 't');
          pText = tNodes.map((n) => n.textContent || '').join('');
        }

        if (pText.trim()) {
          shapeText += (bulletPrefix ? bulletPrefix : '') + pText.trim() + '\n';
        }
      }

      if (shapeText.trim()) {
        textBlocks.push(shapeText.trim());
        if (!title && (phType === 'title' || phType === 'ctrTitle')) {
          title = shapeText.trim().split('\n')[0];
        }
      }
    }

    if (!title && textBlocks.length > 0) {
      title = textBlocks[0].split('\n')[0].substring(0, 60);
    }

    extractedText = textBlocks.join('\n\n');
  } catch (err) {
    console.warn(`Failed to extract text from slide ${slideIdx + 1}:`, err);
  }

  return {
    title: title || `Slide ${slideIdx + 1}`,
    extractedText: extractedText || '',
  };
}

/**
 * Converts a PowerPoint .pptx ArrayBuffer into high-fidelity SVG slides
 */
export async function convertPptxToSvgSlides(arrayBuffer: ArrayBuffer): Promise<PptxConversionResult> {
  const wasmBuffer = getWasmBuffer();
  const renderer = new PptxRenderer();
  await renderer.init(wasmBuffer);

  const info = await renderer.loadPptx(arrayBuffer);
  const slideCount = info.slideCount || renderer.getSlideCount();

  const zip = await JSZip.loadAsync(arrayBuffer);
  const dimensions = await getSlideDimensionsFromZip(zip);

  const convertedSlides: ConvertedSlide[] = [];

  for (let i = 0; i < slideCount; i++) {
    const rawSvg = renderer.renderSlideSvg(i);
    
    // Fallback or validation if SVG failed
    let svgContent = rawSvg;
    if (!svgContent || svgContent.startsWith('ERROR:')) {
      console.warn(`[PPTX] Error rendering slide ${i + 1}:`, svgContent);
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.targetWidth}" height="${dimensions.targetHeight}" viewBox="0 0 ${dimensions.targetWidth} ${dimensions.targetHeight}"><rect width="100%" height="100%" fill="#ffffff"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#64748b">Slide ${i + 1}</text></svg>`;
    }

    // Ensure the SVG has viewBox for fluid high-DPI scaling
    if (!svgContent.includes('viewBox=')) {
      const widthMatch = svgContent.match(/width="([^"]+)"/);
      const heightMatch = svgContent.match(/height="([^"]+)"/);
      const svgW = widthMatch ? parseFloat(widthMatch[1]) : dimensions.targetWidth;
      const svgH = heightMatch ? parseFloat(heightMatch[1]) : dimensions.targetHeight;
      svgContent = svgContent.replace('<svg ', `<svg viewBox="0 0 ${svgW} ${svgH}" `);
    }

    const { title, extractedText } = await extractSlideMetadata(zip, i);
    
    // Generate clean base64 data URL
    const svgBase64 = Buffer.from(svgContent, 'utf-8').toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    convertedSlides.push({
      slideNumber: i + 1,
      title: title || `Slide ${i + 1}`,
      width: dimensions.targetWidth,
      height: dimensions.targetHeight,
      aspectRatio: dimensions.aspectRatio,
      svg: svgContent,
      dataUrl,
      extractedText,
    });
  }

  return {
    slideCount,
    slides: convertedSlides,
    width: dimensions.targetWidth,
    height: dimensions.targetHeight,
    aspectRatio: dimensions.aspectRatio,
  };
}
