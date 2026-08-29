import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { convertPptxToPdfBuffer } from './src/server/pptToPdf';
import { convertPptxToSvgSlides } from './src/server/pptxConverter';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parser
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Convert PPTX to High-Fidelity SVG Slides endpoint
  app.post('/api/convert-pptx-to-slides', upload.single('file'), async (req, res) => {
    try {
      let fileBuffer: ArrayBuffer | null = null;

      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer.buffer.slice(
          req.file.buffer.byteOffset,
          req.file.buffer.byteOffset + req.file.buffer.byteLength
        );
      } else if (req.body && req.body.fileBase64) {
        const base64Data = req.body.fileBase64.replace(/^data:.*?;base64,/, '');
        const nodeBuf = Buffer.from(base64Data, 'base64');
        fileBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return res.status(400).json({ error: 'No PowerPoint presentation file provided.' });
      }

      console.log(`[PPTX-SVG] Converting presentation to SVG slides (${fileBuffer.byteLength} bytes)...`);
      const result = await convertPptxToSvgSlides(fileBuffer);
      console.log(`[PPTX-SVG] Successfully converted ${result.slideCount} slides!`);

      return res.json({
        success: true,
        slideCount: result.slideCount,
        width: result.width,
        height: result.height,
        aspectRatio: result.aspectRatio,
        slides: result.slides,
      });
    } catch (err: any) {
      console.error('[PPTX-SVG] Conversion error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to convert PowerPoint presentation to SVG slides.',
      });
    }
  });

  // Convert PPTX to PDF endpoint
  app.post('/api/convert-ppt-to-pdf', upload.single('file'), async (req, res) => {
    try {
      let fileBuffer: ArrayBuffer | null = null;

      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer.buffer.slice(
          req.file.buffer.byteOffset,
          req.file.buffer.byteOffset + req.file.buffer.byteLength
        );
      } else if (req.body && req.body.fileBase64) {
        const base64Data = req.body.fileBase64.replace(/^data:.*?;base64,/, '');
        const nodeBuf = Buffer.from(base64Data, 'base64');
        fileBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return res.status(400).json({ error: 'No PowerPoint presentation file provided.' });
      }

      console.log(`[PPT2PDF] Converting presentation (${fileBuffer.byteLength} bytes)...`);
      const pdfBytes = await convertPptxToPdfBuffer(fileBuffer);
      console.log(`[PPT2PDF] Conversion complete (${pdfBytes.byteLength} bytes PDF generated)`);

      // Return PDF binary stream
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="converted-presentation.pdf"');
      res.setHeader('Content-Length', pdfBytes.byteLength.toString());
      return res.end(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error('[PPT2PDF] Conversion error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to convert PowerPoint presentation to PDF.',
      });
    }
  });

  // API 404 fallback (prevents /api/* requests from returning index.html)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Global API error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error('[API Error]:', err);
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Study Whiteboard Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
