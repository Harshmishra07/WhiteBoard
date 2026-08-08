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

export function renderVectorElement(
  ctx: CanvasRenderingContext2D,
  elem: VectorElement,
  imagesCache?: Record<string, HTMLImageElement>
) {
  ctx.save();

  ctx.strokeStyle = elem.color;
  ctx.fillStyle = elem.color;
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
      ctx.beginPath();
      ctx.rect(elem.x, elem.y, w, h);
      ctx.stroke();
      break;
    }

    case 'circle': {
      const w = elem.width ?? 0;
      const h = elem.height ?? 0;
      const radius = Math.sqrt(w * w + h * h);
      ctx.beginPath();
      ctx.arc(elem.x, elem.y, radius, 0, Math.PI * 2);
      ctx.stroke();
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
      ctx.stroke();
      break;
    }

    case 'text': {
      if (elem.text) {
        const fontSize = elem.fontSize || 24;
        const fontFamily = elem.fontFamily || 'Inter';
        ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
        ctx.fillStyle = elem.color;
        ctx.textBaseline = 'top';
        const paddingX = 14;
        const paddingY = 14;
        const lines = elem.text.split('\n');
        lines.forEach((line, index) => {
          ctx.fillText(line, elem.x + paddingX, elem.y + paddingY + index * (fontSize * 1.25));
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
          ctx.drawImage(cachedImg, elem.x, elem.y, w, h);
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
