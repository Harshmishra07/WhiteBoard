import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { jsPDF } from 'jspdf';

interface ThemeColors {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
  bg1: string;
  tx1: string;
  bg2: string;
  tx2: string;
  [key: string]: string;
}

const DEFAULT_THEME_COLORS: ThemeColors = {
  dk1: '#0f172a',
  lt1: '#ffffff',
  dk2: '#1e293b',
  lt2: '#f1f5f9',
  accent1: '#2563eb',
  accent2: '#dc2626',
  accent3: '#16a34a',
  accent4: '#9333ea',
  accent5: '#0891b2',
  accent6: '#d97706',
  hlink: '#2563eb',
  folHlink: '#7c3aed',
  bg1: '#ffffff',
  tx1: '#0f172a',
  bg2: '#f8fafc',
  tx2: '#334155',
};

const PRESET_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  cyan: '#06b6d4',
  magenta: '#d946ef',
  gray: '#6b7280',
  grey: '#6b7280',
  lightgray: '#e5e7eb',
  lightgrey: '#e5e7eb',
  darkgray: '#374151',
  darkgrey: '#374151',
  orange: '#f97316',
  purple: '#a855f7',
  navy: '#1e3a8a',
  teal: '#0d9488',
  maroon: '#991b1b',
  olive: '#84cc16',
  lime: '#84cc16',
  silver: '#e2e8f0',
  gold: '#d97706',
  brown: '#78350f',
};

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

function isDarkColor(hex: string): boolean {
  if (!hex) return false;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 130;
}

async function extractThemeColors(zip: JSZip): Promise<ThemeColors> {
  const colors: ThemeColors = { ...DEFAULT_THEME_COLORS };
  const themeFile = zip.file('ppt/theme/theme1.xml');
  if (!themeFile) return colors;

  try {
    const xmlText = await themeFile.async('text');
    const doc = parseXml(xmlText);
    const clrScheme = getFirstElement(doc, 'a:clrScheme', 'clrScheme');
    if (!clrScheme) return colors;

    const getColor = (el: any): string | null => {
      if (!el) return null;
      const srgbClr = getFirstElement(el, 'a:srgbClr', 'srgbClr');
      if (srgbClr) {
        const val = srgbClr.getAttribute('val');
        if (val) return `#${val}`;
      }
      const sysClr = getFirstElement(el, 'a:sysClr', 'sysClr');
      if (sysClr) {
        const lastClr = sysClr.getAttribute('lastClr');
        if (lastClr) return `#${lastClr}`;
      }
      return null;
    };

    const schemeKeys = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
    for (const key of schemeKeys) {
      const node = getFirstElement(clrScheme, `a:${key}`, key);
      const colorVal = getColor(node);
      if (colorVal) {
        colors[key] = colorVal;
      }
    }

    colors.bg1 = colors.lt1 || '#ffffff';
    colors.tx1 = colors.dk1 || '#0f172a';
    colors.bg2 = colors.lt2 || '#f8fafc';
    colors.tx2 = colors.dk2 || '#334155';
  } catch (err) {
    console.warn('Failed to parse theme colors, using defaults:', err);
  }

  return colors;
}

function resolveColor(element: any, themeColors: ThemeColors, defaultColor = '#0f172a'): string {
  if (!element) return defaultColor;

  const srgb = getFirstElement(element, 'a:srgbClr', 'srgbClr');
  if (srgb) {
    const val = srgb.getAttribute('val');
    if (val) return `#${val}`;
  }

  const scheme = getFirstElement(element, 'a:schemeClr', 'schemeClr');
  if (scheme) {
    const val = scheme.getAttribute('val');
    if (val) {
      if (themeColors[val]) return themeColors[val];
      if (val === 'lt1' || val === 'bg1') return '#ffffff';
      if (val === 'dk1' || val === 'tx1') return '#0f172a';
      if (val === 'lt2' || val === 'bg2') return '#f8fafc';
      if (val === 'dk2' || val === 'tx2') return '#334155';
    }
  }

  const prstClr = getFirstElement(element, 'a:prstClr', 'prstClr');
  if (prstClr) {
    const val = prstClr.getAttribute('val');
    if (val && PRESET_COLORS[val.toLowerCase()]) {
      return PRESET_COLORS[val.toLowerCase()];
    }
    if (val) return val;
  }

  const sysClr = getFirstElement(element, 'a:sysClr', 'sysClr');
  if (sysClr) {
    const lastClr = sysClr.getAttribute('lastClr');
    if (lastClr) return `#${lastClr}`;
  }

  return defaultColor;
}

async function parseRelationships(zip: JSZip, relsPath: string): Promise<Record<string, string>> {
  const relsMap: Record<string, string> = {};
  const relsFile = zip.file(relsPath);
  if (!relsFile) return relsMap;

  try {
    const xmlText = await relsFile.async('text');
    const doc = parseXml(xmlText);
    const relElements = getElements(doc, 'Relationship');

    relElements.forEach((rel: any) => {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) {
        let fullPath = target;
        if (target.startsWith('../')) {
          fullPath = 'ppt/' + target.replace('../', '');
        } else if (!target.startsWith('ppt/')) {
          fullPath = 'ppt/' + target;
        }
        relsMap[id] = fullPath;
      }
    });
  } catch (err) {
    console.warn(`Failed to parse relationships at ${relsPath}:`, err);
  }

  return relsMap;
}

async function loadMediaAssets(zip: JSZip): Promise<Record<string, { base64: string; format: string }>> {
  const mediaMap: Record<string, { base64: string; format: string }> = {};
  const mediaFiles = Object.keys(zip.files).filter((path) => path.startsWith('ppt/media/'));

  for (const path of mediaFiles) {
    const file = zip.file(path);
    if (!file) continue;

    try {
      const ext = path.split('.').pop()?.toUpperCase() || 'PNG';
      const base64 = await file.async('base64');
      const format = ext === 'JPG' ? 'JPEG' : ext;
      mediaMap[path] = { base64: `data:image/${ext.toLowerCase()};base64,${base64}`, format };
    } catch (err) {
      console.warn(`Failed to load media asset: ${path}`, err);
    }
  }

  return mediaMap;
}

async function getSlideDimensions(zip: JSZip): Promise<{ widthPt: number; heightPt: number; widthEmu: number; heightEmu: number }> {
  const defaultDim = { widthPt: 960, heightPt: 540, widthEmu: 12192000, heightEmu: 6858000 };
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
        const widthPt = cx / 12700;
        const heightPt = cy / 12700;
        return { widthPt, heightPt, widthEmu: cx, heightEmu: cy };
      }
    }
  } catch (err) {
    console.warn('Failed to read slide dimensions from presentation.xml:', err);
  }

  return defaultDim;
}

async function getSlidePaths(zip: JSZip): Promise<string[]> {
  const slidePaths: string[] = [];
  const presFile = zip.file('ppt/presentation.xml');
  const presRels = await parseRelationships(zip, 'ppt/_rels/presentation.xml.rels');

  if (presFile) {
    try {
      const presXml = await presFile.async('text');
      const presDoc = parseXml(presXml);
      const sldIdList = getElements(presDoc, 'p:sldId', 'sldId');

      sldIdList.forEach((sld: any) => {
        const rId = sld.getAttribute('r:id') || sld.getAttribute('id');
        if (rId && presRels[rId]) {
          let path = presRels[rId];
          if (!path.startsWith('ppt/')) path = 'ppt/' + path;
          if (zip.file(path)) {
            slidePaths.push(path);
          }
        }
      });
    } catch (err) {
      console.warn('Failed to parse presentation slide list:', err);
    }
  }

  if (slidePaths.length === 0) {
    const allSlideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });
    slidePaths.push(...allSlideFiles);
  }

  return slidePaths;
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolves the bounding box (in points) for any shape, matching layout/master placeholders
 */
function resolveShapeBounds(
  sp: any,
  layoutDoc: any | null,
  masterDoc: any | null,
  scaleX: number,
  scaleY: number,
  widthPt: number,
  heightPt: number
): { bounds: Bounds; phType: string; isPlaceholder: boolean } {
  const spPr = getFirstElement(sp, 'p:spPr', 'spPr');
  const nvSpPr = getFirstElement(sp, 'p:nvSpPr', 'nvSpPr');
  const ph = getFirstElement(nvSpPr, 'p:ph', 'ph');
  const phType = ph?.getAttribute('type') || '';
  const phIdx = ph?.getAttribute('idx') || '';
  const isPlaceholder = !!ph;

  // 1. Direct shape xfrm
  const xfrm = getFirstElement(spPr, 'a:xfrm', 'xfrm');
  const off = getFirstElement(xfrm, 'a:off', 'off');
  const ext = getFirstElement(xfrm, 'a:ext', 'ext');

  if (off && ext) {
    const cx = parseInt(ext.getAttribute('cx') || '0', 10);
    const cy = parseInt(ext.getAttribute('cy') || '0', 10);
    if (cx > 0 && cy > 0) {
      const x = parseInt(off.getAttribute('x') || '0', 10) * scaleX;
      const y = parseInt(off.getAttribute('y') || '0', 10) * scaleY;
      const w = cx * scaleX;
      const h = cy * scaleY;
      return { bounds: { x, y, w, h }, phType, isPlaceholder };
    }
  }

  // 2. Inherit from Layout doc
  if (isPlaceholder && layoutDoc) {
    const layoutShapes = getElements(layoutDoc, 'p:sp', 'sp');
    for (const lsp of layoutShapes) {
      const lNvSpPr = getFirstElement(lsp, 'p:nvSpPr', 'nvSpPr');
      const lPh = getFirstElement(lNvSpPr, 'p:ph', 'ph');
      if (!lPh) continue;

      const lPhType = lPh.getAttribute('type') || '';
      const lPhIdx = lPh.getAttribute('idx') || '';

      const isMatch =
        (phIdx && phIdx === lPhIdx) ||
        (phType && phType === lPhType) ||
        (!phType && !lPhType && phIdx === lPhIdx);

      if (isMatch) {
        const lSpPr = getFirstElement(lsp, 'p:spPr', 'spPr');
        const lXfrm = getFirstElement(lSpPr, 'a:xfrm', 'xfrm');
        const lOff = getFirstElement(lXfrm, 'a:off', 'off');
        const lExt = getFirstElement(lXfrm, 'a:ext', 'ext');
        if (lOff && lExt) {
          const cx = parseInt(lExt.getAttribute('cx') || '0', 10);
          const cy = parseInt(lExt.getAttribute('cy') || '0', 10);
          if (cx > 0 && cy > 0) {
            return {
              bounds: {
                x: parseInt(lOff.getAttribute('x') || '0', 10) * scaleX,
                y: parseInt(lOff.getAttribute('y') || '0', 10) * scaleY,
                w: cx * scaleX,
                h: cy * scaleY,
              },
              phType: phType || lPhType,
              isPlaceholder: true,
            };
          }
        }
      }
    }
  }

  // 3. Inherit from Master doc
  if (isPlaceholder && masterDoc) {
    const masterShapes = getElements(masterDoc, 'p:sp', 'sp');
    for (const msp of masterShapes) {
      const mNvSpPr = getFirstElement(msp, 'p:nvSpPr', 'nvSpPr');
      const mPh = getFirstElement(mNvSpPr, 'p:ph', 'ph');
      if (!mPh) continue;

      const mPhType = mPh.getAttribute('type') || '';
      if (phType && phType === mPhType) {
        const mSpPr = getFirstElement(msp, 'p:spPr', 'spPr');
        const mXfrm = getFirstElement(mSpPr, 'a:xfrm', 'xfrm');
        const mOff = getFirstElement(mXfrm, 'a:off', 'off');
        const mExt = getFirstElement(mXfrm, 'a:ext', 'ext');
        if (mOff && mExt) {
          const cx = parseInt(mExt.getAttribute('cx') || '0', 10);
          const cy = parseInt(mExt.getAttribute('cy') || '0', 10);
          if (cx > 0 && cy > 0) {
            return {
              bounds: {
                x: parseInt(mOff.getAttribute('x') || '0', 10) * scaleX,
                y: parseInt(mOff.getAttribute('y') || '0', 10) * scaleY,
                w: cx * scaleX,
                h: cy * scaleY,
              },
              phType,
              isPlaceholder: true,
            };
          }
        }
      }
    }
  }

  // 4. Proportional fallback bounds based on placeholder role
  if (phType === 'title' || phType === 'ctrTitle' || phIdx === '0') {
    return {
      bounds: {
        x: widthPt * 0.06,
        y: heightPt * 0.08,
        w: widthPt * 0.88,
        h: heightPt * 0.16,
      },
      phType: 'title',
      isPlaceholder: true,
    };
  }

  if (phType === 'subTitle') {
    return {
      bounds: {
        x: widthPt * 0.08,
        y: heightPt * 0.28,
        w: widthPt * 0.84,
        h: heightPt * 0.20,
      },
      phType: 'subTitle',
      isPlaceholder: true,
    };
  }

  if (phType === 'body' || phIdx === '1' || isPlaceholder) {
    return {
      bounds: {
        x: widthPt * 0.06,
        y: heightPt * 0.26,
        w: widthPt * 0.88,
        h: heightPt * 0.65,
      },
      phType: 'body',
      isPlaceholder: true,
    };
  }

  return {
    bounds: {
      x: widthPt * 0.06,
      y: heightPt * 0.10,
      w: widthPt * 0.88,
      h: heightPt * 0.80,
    },
    phType,
    isPlaceholder,
  };
}

/**
 * Converts a PPTX ArrayBuffer into a clean, high-contrast PDF Uint8Array
 */
export async function convertPptxToPdfBuffer(pptxBuffer: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(pptxBuffer);

  const themeColors = await extractThemeColors(zip);
  const mediaMap = await loadMediaAssets(zip);
  const { widthPt, heightPt, widthEmu, heightEmu } = await getSlideDimensions(zip);
  const slidePaths = await getSlidePaths(zip);

  if (slidePaths.length === 0) {
    throw new Error('No slides found in the PowerPoint presentation.');
  }

  const pdf = new jsPDF({
    orientation: widthPt >= heightPt ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [widthPt, heightPt],
    compress: true,
  });

  const scaleX = widthPt / widthEmu;
  const scaleY = heightPt / heightEmu;

  for (let i = 0; i < slidePaths.length; i++) {
    if (i > 0) {
      pdf.addPage([widthPt, heightPt], widthPt >= heightPt ? 'landscape' : 'portrait');
    }

    const slidePath = slidePaths[i];
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;

    const xmlText = await slideFile.async('text');
    const slideDoc = parseXml(xmlText);

    // Slide Relationships
    const slideFilename = slidePath.split('/').pop() || `slide${i + 1}.xml`;
    const slideRels = await parseRelationships(zip, `ppt/slides/_rels/${slideFilename}.rels`);

    // Linked layout & master documents
    let layoutDoc: any | null = null;
    let masterDoc: any | null = null;
    const layoutPath = Object.values(slideRels).find((p) => p.includes('slideLayout'));
    if (layoutPath && zip.file(layoutPath)) {
      try {
        const lXml = await zip.file(layoutPath)!.async('text');
        layoutDoc = parseXml(lXml);
        const lFilename = layoutPath.split('/').pop();
        const layoutRels = await parseRelationships(zip, `ppt/slideLayouts/_rels/${lFilename}.rels`);
        const masterPath = Object.values(layoutRels).find((p) => p.includes('slideMaster'));
        if (masterPath && zip.file(masterPath)) {
          const mXml = await zip.file(masterPath)!.async('text');
          masterDoc = parseXml(mXml);
        }
      } catch (err) {
        console.warn('Failed to parse linked layout/master in PDF conversion:', err);
      }
    }

    // 1. Slide Background
    let slideBgColor = '#ffffff';
    const bgNode = getFirstElement(slideDoc, 'p:bg', 'bg') || (layoutDoc && getFirstElement(layoutDoc, 'p:bg', 'bg'));
    if (bgNode) {
      const solidFill = getFirstElement(bgNode, 'a:solidFill', 'solidFill');
      if (solidFill) {
        slideBgColor = resolveColor(solidFill, themeColors, '#ffffff');
      }
    }

    // Fill slide canvas background
    pdf.setFillColor(slideBgColor);
    pdf.rect(0, 0, widthPt, heightPt, 'F');

    // 2. Render Slide Background Image (if any)
    const bgBlip = getFirstElement(bgNode, 'a:blip', 'blip');
    if (bgBlip) {
      const embedId = bgBlip.getAttribute('r:embed');
      const mediaPath = embedId ? slideRels[embedId] : null;
      if (mediaPath && mediaMap[mediaPath]) {
        try {
          const asset = mediaMap[mediaPath];
          pdf.addImage(asset.base64, asset.format, 0, 0, widthPt, heightPt);
        } catch (e) {
          console.warn('Failed to add background image to PDF:', e);
        }
      }
    }

    // 3. Render Pictures (<p:pic>)
    const picNodes = getElements(slideDoc, 'p:pic', 'pic');
    for (const pic of picNodes) {
      const spPr = getFirstElement(pic, 'p:spPr', 'spPr');
      const xfrm = getFirstElement(spPr, 'a:xfrm', 'xfrm');
      const off = getFirstElement(xfrm, 'a:off', 'off');
      const ext = getFirstElement(xfrm, 'a:ext', 'ext');

      if (!off || !ext) continue;

      const x = parseInt(off.getAttribute('x') || '0', 10) * scaleX;
      const y = parseInt(off.getAttribute('y') || '0', 10) * scaleY;
      const w = parseInt(ext.getAttribute('cx') || '0', 10) * scaleX;
      const h = parseInt(ext.getAttribute('cy') || '0', 10) * scaleY;

      const blip = getFirstElement(pic, 'a:blip', 'blip');
      const embedId = blip?.getAttribute('r:embed');
      const mediaPath = embedId ? slideRels[embedId] : null;

      if (mediaPath && mediaMap[mediaPath] && w > 0 && h > 0) {
        try {
          const asset = mediaMap[mediaPath];
          pdf.addImage(asset.base64, asset.format, x, y, w, h);
        } catch (e) {
          console.warn('Failed to add image element to PDF:', e);
        }
      }
    }

    // 4. Render Shapes and Text Containers (<p:sp>)
    const shapeNodes = getElements(slideDoc, 'p:sp', 'sp');

    for (const sp of shapeNodes) {
      const { bounds, phType, isPlaceholder } = resolveShapeBounds(
        sp,
        layoutDoc,
        masterDoc,
        scaleX,
        scaleY,
        widthPt,
        heightPt
      );

      const { x, y, w, h } = bounds;
      if (w <= 0 || h <= 0) continue;

      const spPr = getFirstElement(sp, 'p:spPr', 'spPr');
      const txBody = getFirstElement(sp, 'p:txBody', 'txBody');
      const nvSpPr = getFirstElement(sp, 'p:nvSpPr', 'nvSpPr');
      const cNvSpPr = getFirstElement(nvSpPr, 'p:cNvSpPr', 'cNvSpPr');
      const isTxBox = cNvSpPr?.getAttribute('txBox') === '1';
      const isTitlePh = phType === 'title' || phType === 'ctrTitle';

      // Shape Fill
      const solidFill = getFirstElement(spPr, 'a:solidFill', 'solidFill');
      const noFill = getFirstElement(spPr, 'a:noFill', 'noFill');
      const schemeClr = getFirstElement(solidFill, 'a:schemeClr', 'schemeClr')?.getAttribute('val');
      const srgbClr = getFirstElement(solidFill, 'a:srgbClr', 'srgbClr')?.getAttribute('val');

      let shapeBgColor: string | null = null;

      if (solidFill && !noFill) {
        const isDarkTextDefault = schemeClr === 'tx1' || schemeClr === 'tx2' || schemeClr === 'dk1' || schemeClr === 'dk2';

        if (txBody || isTxBox || isPlaceholder) {
          if (!isDarkTextDefault && schemeClr && schemeClr.startsWith('accent')) {
            shapeBgColor = themeColors[schemeClr] || null;
          } else if (!isDarkTextDefault && srgbClr && srgbClr.toLowerCase() !== '000000' && srgbClr.toLowerCase() !== '1e293b') {
            shapeBgColor = `#${srgbClr}`;
          } else if (schemeClr === 'bg2' || schemeClr === 'lt2') {
            shapeBgColor = themeColors[schemeClr] || '#f8fafc';
          }
        } else {
          if (!isDarkTextDefault || isDarkColor(slideBgColor)) {
            const resolved = resolveColor(solidFill, themeColors, '#e2e8f0');
            if (resolved !== '#000000' || w < widthPt * 0.9) {
              shapeBgColor = resolved;
            }
          }
        }
      }

      if (shapeBgColor) {
        pdf.setFillColor(shapeBgColor);
        pdf.rect(x, y, w, h, 'F');
      }

      // Shape Border / Outline
      const ln = getFirstElement(spPr, 'a:ln', 'ln');
      const lnNoFill = getFirstElement(ln, 'a:noFill', 'noFill');
      if (ln && !lnNoFill) {
        const lnSolidFill = getFirstElement(ln, 'a:solidFill', 'solidFill');
        if (lnSolidFill) {
          const borderColor = resolveColor(lnSolidFill, themeColors, '#cbd5e1');
          pdf.setDrawColor(borderColor);
          pdf.setLineWidth(1);
          pdf.rect(x, y, w, h, 'S');
        }
      }

      // Render Text (<p:txBody>)
      if (txBody) {
        const bodyPr = getFirstElement(txBody, 'a:bodyPr', 'bodyPr');
        const anchor = bodyPr?.getAttribute('anchor') || (isTitlePh ? 'ctr' : 't');

        const lInsPt = bodyPr?.getAttribute('lIns') ? parseInt(bodyPr.getAttribute('lIns'), 10) / 12700 : 8;
        const tInsPt = bodyPr?.getAttribute('tIns') ? parseInt(bodyPr.getAttribute('tIns'), 10) / 12700 : 6;
        const rInsPt = bodyPr?.getAttribute('rIns') ? parseInt(bodyPr.getAttribute('rIns'), 10) / 12700 : 8;

        const maxTextWidth = Math.max(40, w - (lInsPt + rInsPt));
        const paragraphs = getElements(txBody, 'a:p', 'p');

        const parsedParas: Array<{
          lines: string[];
          fontSizePt: number;
          isBold: boolean;
          isItalic: boolean;
          textColor: string;
          alignOpt: 'left' | 'center' | 'right';
          lvl: number;
        }> = [];

        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
          const p = paragraphs[pIdx];
          const pPr = getFirstElement(p, 'a:pPr', 'pPr');
          const algn = pPr?.getAttribute('algn') || (isTitlePh ? 'ctr' : 'l');
          const lvl = parseInt(pPr?.getAttribute('lvl') || '0', 10);

          const buCharNode = getFirstElement(pPr, 'a:buChar', 'buChar');
          const buChar = buCharNode?.getAttribute('char');
          const buNone = getFirstElement(pPr, 'a:buNone', 'buNone');
          const buAutoNum = getFirstElement(pPr, 'a:buAutoNum', 'buAutoNum');

          let bulletPrefix = '';
          if (!buNone) {
            if (buChar) bulletPrefix = `${buChar} `;
            else if (buAutoNum) bulletPrefix = `${pIdx + 1}. `;
            else if (lvl > 0 || (phType === 'body' && paragraphs.length > 1)) bulletPrefix = '• ';
          }

          const runs = getElements(p, 'a:r', 'r');
          let paraText = '';
          let fontSizePt = isTitlePh ? 28 : phType === 'subTitle' ? 18 : 14;
          let isBold = isTitlePh;
          let isItalic = false;

          let textColor =
            shapeBgColor && isDarkColor(shapeBgColor)
              ? '#ffffff'
              : themeColors.tx1 || '#0f172a';

          if (runs.length > 0) {
            runs.forEach((r: any) => {
              const tNode = getFirstElement(r, 'a:t', 't');
              if (tNode?.textContent) {
                paraText += tNode.textContent;
              }

              const rPr = getFirstElement(r, 'a:rPr', 'rPr');
              if (rPr) {
                const sz = rPr.getAttribute('sz');
                if (sz) fontSizePt = Math.max(9, Math.min(48, Math.round(parseInt(sz, 10) / 100)));
                if (rPr.getAttribute('b') === '1') isBold = true;
                if (rPr.getAttribute('b') === '0') isBold = false;
                if (rPr.getAttribute('i') === '1') isItalic = true;

                const runFill = getFirstElement(rPr, 'a:solidFill', 'solidFill');
                if (runFill) {
                  const resolvedRunColor = resolveColor(runFill, themeColors, textColor);
                  if (shapeBgColor && isDarkColor(shapeBgColor) && (resolvedRunColor === '#000000' || resolvedRunColor === '#0f172a')) {
                    textColor = '#ffffff';
                  } else {
                    textColor = resolvedRunColor;
                  }
                }
              }
            });
          } else {
            const tNodes = getElements(p, 'a:t', 't');
            paraText = tNodes.map((n: any) => n.textContent || '').join('');
          }

          if (!paraText.trim()) continue;

          if (shapeBgColor && isDarkColor(shapeBgColor) && (textColor === '#000000' || textColor === '#0f172a' || textColor === '#1e293b')) {
            textColor = '#ffffff';
          }

          const fontStyle = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
          pdf.setFont('helvetica', fontStyle);
          pdf.setFontSize(fontSizePt);

          const indentX = lvl * 14;
          const availableWidth = Math.max(20, maxTextWidth - indentX);
          const fullText = bulletPrefix + paraText;
          const lines = pdf.splitTextToSize(fullText, availableWidth);

          let alignOpt: 'left' | 'center' | 'right' = 'left';
          if (algn === 'ctr') alignOpt = 'center';
          else if (algn === 'r') alignOpt = 'right';

          parsedParas.push({
            lines,
            fontSizePt,
            isBold,
            isItalic,
            textColor,
            alignOpt,
            lvl,
          });
        }

        let totalTextHeight = 0;
        parsedParas.forEach((item) => {
          totalTextHeight += item.lines.length * (item.fontSizePt * 1.3) + 4;
        });

        let currentY = y + tInsPt + (parsedParas[0]?.fontSizePt || 14) * 0.8;
        if (anchor === 'ctr' && h > totalTextHeight) {
          currentY = y + (h - totalTextHeight) / 2 + (parsedParas[0]?.fontSizePt || 14) * 0.8;
        } else if (anchor === 'b' && h > totalTextHeight) {
          currentY = y + h - totalTextHeight + (parsedParas[0]?.fontSizePt || 14) * 0.8;
        }

        for (const item of parsedParas) {
          const fontStyle = item.isBold && item.isItalic ? 'bolditalic' : item.isBold ? 'bold' : item.isItalic ? 'italic' : 'normal';
          pdf.setFont('helvetica', fontStyle);
          pdf.setFontSize(item.fontSizePt);
          pdf.setTextColor(item.textColor);

          const indentX = item.lvl * 14;
          let startX = x + lInsPt + indentX;
          if (item.alignOpt === 'center') {
            startX = x + w / 2;
          } else if (item.alignOpt === 'right') {
            startX = x + w - rInsPt;
          }

          for (const line of item.lines) {
            if (currentY > y + h + 30) break;
            pdf.text(line, startX, currentY, { align: item.alignOpt });
            currentY += item.fontSizePt * 1.3;
          }

          currentY += 4;
        }
      }
    }

    // 5. Render Tables (<a:tbl>)
    const graphicFrames = getElements(slideDoc, 'p:graphicFrame', 'graphicFrame');
    for (const gf of graphicFrames) {
      const xfrm = getFirstElement(gf, 'p:xfrm', 'xfrm');
      const off = getFirstElement(xfrm, 'a:off', 'off');
      const ext = getFirstElement(xfrm, 'a:ext', 'ext');
      if (!off || !ext) continue;

      const x = parseInt(off.getAttribute('x') || '0', 10) * scaleX;
      const y = parseInt(off.getAttribute('y') || '0', 10) * scaleY;
      const w = parseInt(ext.getAttribute('cx') || '0', 10) * scaleX;
      const h = parseInt(ext.getAttribute('cy') || '0', 10) * scaleY;

      const tbl = getFirstElement(gf, 'a:tbl', 'tbl');
      if (!tbl) continue;

      const rows = getElements(tbl, 'a:tr', 'tr');
      if (rows.length === 0) continue;

      const rowH = h / rows.length;

      rows.forEach((row: any, rowIdx: number) => {
        const cells = getElements(row, 'a:tc', 'tc');
        const colW = w / Math.max(1, cells.length);

        cells.forEach((cell: any, colIdx: number) => {
          const cellX = x + colIdx * colW;
          const cellY = y + rowIdx * rowH;

          pdf.setFillColor(rowIdx === 0 ? '#f1f5f9' : '#ffffff');
          pdf.rect(cellX, cellY, colW, rowH, 'F');

          pdf.setDrawColor('#cbd5e1');
          pdf.setLineWidth(1);
          pdf.rect(cellX, cellY, colW, rowH, 'S');

          const tNodes = getElements(cell, 'a:t', 't');
          const cellText = tNodes.map((n: any) => n.textContent || '').join(' ').trim();

          if (cellText) {
            pdf.setFont('helvetica', rowIdx === 0 ? 'bold' : 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(rowIdx === 0 ? '#0f172a' : '#334155');
            const cellLines = pdf.splitTextToSize(cellText, colW - 12);
            pdf.text(cellLines[0] || '', cellX + 6, cellY + rowH / 2 + 3);
          }
        });
      });
    }
  }

  const arrayBuffer = pdf.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}
