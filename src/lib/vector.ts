import { VectorElement, Point } from '../types';

export interface RenderOptions {
  scale?: number;
  dpr?: number;
}

// Draw arrowhead helper
export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLength = Math.max(16, strokeWidth * 4.5);
  const arrowAngle = Math.PI / 8.3; // Sharp, elegant angle (~21.6 deg)

  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 10;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - arrowAngle),
    toY - headLength * Math.sin(angle - arrowAngle)
  );
  // Slightly indented back for a sleek, sharp arrow shape
  ctx.lineTo(
    toX - headLength * 0.85 * Math.cos(angle),
    toY - headLength * 0.85 * Math.sin(angle)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + arrowAngle),
    toY - headLength * Math.sin(angle + arrowAngle)
  );
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

function drawCallout(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 12) {
  const tailW = Math.min(24, w * 0.2);
  const tailH = Math.min(20, h * 0.25);
  const bodyH = h - tailH;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + bodyH - r);
  ctx.quadraticCurveTo(x + w, y + bodyH, x + w - r, y + bodyH);
  
  // Speech bubble pointer tail
  ctx.lineTo(x + w * 0.4 + tailW, y + bodyH);
  ctx.lineTo(x + w * 0.3, y + h);
  ctx.lineTo(x + w * 0.4, y + bodyH);

  ctx.lineTo(x + r, y + bodyH);
  ctx.quadraticCurveTo(x, y + bodyH, x, y + bodyH - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function renderVectorElement(
  ctx: CanvasRenderingContext2D,
  elem: VectorElement,
  imagesCache?: Record<string, HTMLImageElement>
) {
  ctx.save();

  ctx.strokeStyle = elem.color;
  ctx.fillStyle = elem.fillColor || elem.color;
  ctx.lineWidth = elem.type === 'eraser' ? Math.max(14, elem.strokeWidth * 3.5) : elem.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (elem.type === 'eraser') {
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'destination-out';
  } else if (elem.type === 'highlighter') {
    ctx.globalAlpha = elem.opacity ?? 0.4;
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.globalAlpha = elem.opacity ?? 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Rotation if specified
  if (elem.rotation && elem.width && elem.height) {
    const cx = elem.x + elem.width / 2;
    const cy = elem.y + elem.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((elem.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (elem.type) {
    case 'pen':
    case 'highlighter':
    case 'eraser': {
      const pts = elem.points || [];
      if (pts.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 1) {
          ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (pts.length === 2) {
          ctx.lineTo(pts[1].x, pts[1].y);
          ctx.stroke();
        } else {
          for (let i = 1; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) / 2;
            const yc = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
        }
      }
      break;
    }

    case 'line': {
      const x2 = elem.x2 ?? elem.x;
      const y2 = elem.y2 ?? elem.y;
      ctx.beginPath();
      ctx.moveTo(elem.x, elem.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    }

    case 'arrow': {
      const x2 = elem.x2 ?? elem.x;
      const y2 = elem.y2 ?? elem.y;
      const dx = x2 - elem.x;
      const dy = y2 - elem.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const headLength = Math.max(16, elem.strokeWidth * 4.5);
      const stopOffset = Math.min(dist * 0.8, headLength * 0.75);

      const shaftX2 = x2 - stopOffset * Math.cos(angle);
      const shaftY2 = y2 - stopOffset * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(elem.x, elem.y);
      ctx.lineTo(shaftX2, shaftY2);
      ctx.stroke();
      drawArrowHead(ctx, elem.x, elem.y, x2, y2, elem.strokeWidth);
      break;
    }

    case 'rectangle': {
      const w = elem.width ?? 0;
      const h = elem.height ?? 0;
      const r = elem.borderRadius || 0;
      ctx.beginPath();
      if (r > 0 && typeof ctx.roundRect === 'function') {
        ctx.roundRect(elem.x, elem.y, w, h, r);
      } else {
        ctx.rect(elem.x, elem.y, w, h);
      }
      if (elem.fillColor || elem.isFilled) {
        ctx.fillStyle = elem.fillColor || elem.color;
        ctx.fill();
      }
      if (elem.strokeWidth > 0) {
        ctx.strokeStyle = elem.color;
        ctx.stroke();
      }
      break;
    }

    case 'circle': {
      const w = elem.width ?? 0;
      const h = elem.height ?? 0;
      const radius = Math.sqrt(w * w + h * h);
      ctx.beginPath();
      ctx.arc(elem.x, elem.y, radius, 0, Math.PI * 2);
      if (elem.fillColor || elem.isFilled) {
        ctx.fillStyle = elem.fillColor || elem.color;
        ctx.fill();
      }
      if (elem.strokeWidth > 0) {
        ctx.strokeStyle = elem.color;
        ctx.stroke();
      }
      break;
    }

    case 'triangle': {
      const w = elem.width ?? 0;
      const h = elem.height ?? 0;
      ctx.beginPath();
      ctx.moveTo(elem.x + w / 2, elem.y);
      ctx.lineTo(elem.x, elem.y + h);
      ctx.lineTo(elem.x + w, elem.y + h);
      ctx.closePath();
      if (elem.fillColor || elem.isFilled) {
        ctx.fillStyle = elem.fillColor || elem.color;
        ctx.fill();
      }
      if (elem.strokeWidth > 0) {
        ctx.strokeStyle = elem.color;
        ctx.stroke();
      }
      break;
    }

    case 'diamond': {
      const w = elem.width ?? 0;
      const h = elem.height ?? 0;
      ctx.beginPath();
      ctx.moveTo(elem.x + w / 2, elem.y);
      ctx.lineTo(elem.x + w, elem.y + h / 2);
      ctx.lineTo(elem.x + w / 2, elem.y + h);
      ctx.lineTo(elem.x, elem.y + h / 2);
      ctx.closePath();
      if (elem.fillColor || elem.isFilled) {
        ctx.fillStyle = elem.fillColor || elem.color;
        ctx.fill();
      }
      if (elem.strokeWidth > 0) {
        ctx.strokeStyle = elem.color;
        ctx.stroke();
      }
      break;
    }

    case 'star': {
      const w = elem.width ?? 60;
      const h = elem.height ?? 60;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.42;
      drawStar(ctx, elem.x + w / 2, elem.y + h / 2, 5, outerR, innerR);
      if (elem.fillColor || elem.isFilled) {
        ctx.fillStyle = elem.fillColor || elem.color;
        ctx.fill();
      }
      if (elem.strokeWidth > 0) {
        ctx.strokeStyle = elem.color;
        ctx.stroke();
      }
      break;
    }

    case 'callout': {
      const w = elem.width ?? 180;
      const h = elem.height ?? 100;
      drawCallout(ctx, elem.x, elem.y, w, h);
      if (elem.fillColor || elem.isFilled) {
        ctx.fillStyle = elem.fillColor || '#ffffff';
        ctx.fill();
      }
      ctx.strokeStyle = elem.color;
      ctx.stroke();
      break;
    }

    case 'text': {
      if (elem.text) {
        const fontSize = elem.fontSize || 24;
        const fontFamily = elem.fontFamily || 'Inter';
        const weight = elem.fontWeight === 'bold' ? 'bold ' : '';
        const style = elem.fontStyle === 'italic' ? 'italic ' : '';
        
        ctx.font = `${style}${weight}${fontSize}px "${fontFamily}", -apple-system, sans-serif`;
        ctx.textBaseline = 'top';

        // If shape has background fill
        if (elem.fillColor) {
          const w = elem.width || 200;
          const h = elem.height || 80;
          ctx.fillStyle = elem.fillColor;
          ctx.beginPath();
          if (elem.borderRadius && typeof ctx.roundRect === 'function') {
            ctx.roundRect(elem.x, elem.y, w, h, elem.borderRadius);
          } else {
            ctx.rect(elem.x, elem.y, w, h);
          }
          ctx.fill();
        }

        ctx.fillStyle = elem.color;
        const paddingX = 14;
        const paddingY = 14;
        const lines = elem.text.split('\n');
        
        if (elem.textAlign === 'center' && elem.width) {
          ctx.textAlign = 'center';
          lines.forEach((line, index) => {
            ctx.fillText(line, elem.x + elem.width! / 2, elem.y + paddingY + index * (fontSize * 1.3));
          });
        } else if (elem.textAlign === 'right' && elem.width) {
          ctx.textAlign = 'right';
          lines.forEach((line, index) => {
            ctx.fillText(line, elem.x + elem.width! - paddingX, elem.y + paddingY + index * (fontSize * 1.3));
          });
        } else {
          ctx.textAlign = 'left';
          lines.forEach((line, index) => {
            ctx.fillText(line, elem.x + paddingX, elem.y + paddingY + index * (fontSize * 1.3));
          });
        }
      }
      break;
    }

    case 'table': {
      if (elem.tableData && elem.tableData.rows.length > 0) {
        const rows = elem.tableData.rows;
        const w = elem.width || 600;
        const h = elem.height || 200;
        const numRows = rows.length;
        const numCols = Math.max(...rows.map(r => r.length));
        const rowH = h / numRows;
        const colW = w / numCols;

        rows.forEach((row, rowIdx) => {
          row.forEach((cell, colIdx) => {
            const cellX = elem.x + colIdx * colW;
            const cellY = elem.y + rowIdx * rowH;

            // Fill cell background
            ctx.fillStyle = cell.bgColor || (rowIdx === 0 ? '#f1f5f9' : rowIdx % 2 === 0 ? '#f8fafc' : '#ffffff');
            ctx.fillRect(cellX, cellY, colW, rowH);

            // Cell border
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, colW, rowH);

            // Cell text
            if (cell.text) {
              const fSize = cell.fontSize || (rowIdx === 0 ? 18 : 16);
              ctx.font = `${cell.bold || rowIdx === 0 ? 'bold ' : ''}${fSize}px -apple-system, sans-serif`;
              ctx.fillStyle = cell.textColor || (rowIdx === 0 ? '#0f172a' : '#334155');
              ctx.textAlign = cell.align || 'left';
              ctx.textBaseline = 'middle';
              
              const tx = cell.align === 'center' ? cellX + colW / 2 : cell.align === 'right' ? cellX + colW - 12 : cellX + 12;
              ctx.fillText(cell.text, tx, cellY + rowH / 2, colW - 24);
            }
          });
        });
      }
      break;
    }

    case 'image': {
      if (elem.imageUrl) {
        const w = elem.width || 300;
        const h = elem.height || 200;
        const cachedImg = imagesCache ? imagesCache[elem.imageUrl] : null;
        if (cachedImg && cachedImg.complete) {
          if (elem.borderRadius && typeof ctx.roundRect === 'function') {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(elem.x, elem.y, w, h, elem.borderRadius);
            ctx.clip();
            ctx.drawImage(cachedImg, elem.x, elem.y, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(cachedImg, elem.x, elem.y, w, h);
          }
        }
      }
      break;
    }
  }

  ctx.restore();
}

export function renderVectorElements(
  ctx: CanvasRenderingContext2D,
  elements: VectorElement[],
  imagesCache?: Record<string, HTMLImageElement>
) {
  if (!elements) return;
  for (const elem of elements) {
    renderVectorElement(ctx, elem, imagesCache);
  }
}

