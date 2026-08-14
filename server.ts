import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';

const app = express();

// Multer configured with 4.5MB limit for Vercel Serverless payload safety
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 4.5 * 1024 * 1024 } 
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const uploadMiddleware = upload.single('project');

app.post(['/api/fix', '/fix'], (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'حجم الملف أصلح كبيراً بالنسبة لـ Vercel. الحد الأقصى المسموح به لرفع الملفات على Vercel هو 4.5 ميغابايت.' });
      }
      return res.status(400).json({ error: `حدث خطأ أثناء الرفع: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء استقبال الملف.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'لم يتم رفع أي مشروع أو الملف فارغ.' });
    }
    const problemDescription = req.body.description || '';
    if (!problemDescription.trim()) {
      return res.status(400).json({ error: 'يرجى كتابة وصف المشكلة.' });
    }

    let excludedFiles: string[] = [];
    if (req.body.excludedFiles) {
      try {
        excludedFiles = typeof req.body.excludedFiles === 'string'
          ? JSON.parse(req.body.excludedFiles)
          : req.body.excludedFiles;
      } catch (e) {
        console.error('Error parsing excludedFiles:', e);
      }
    }

    const rawApiKey = process.env.GEMINI_API_KEY || '';
    const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return res.status(500).json({ 
        error: 'مفتاح GEMINI_API_KEY غير مضاف في متغيرات البيئة (Environment Variables) على Vercel. يرجى إضافة GEMINI_API_KEY في إعدادات Vercel وإعادة التعيين (Redeploy).' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Parse the uploaded zip file safely
    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch (zipErr: any) {
      return res.status(400).json({ error: 'ملف ZIP المرفوع غير صالح أو تالف.' });
    }

    const zipEntries = zip.getEntries();
    const filesToAnalyze: { path: string, content: string }[] = [];

    // Filter files to avoid sending binaries, heavy logs, or node_modules to Gemini
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const entryName = entry.entryName;

        // Skip user-excluded files
        if (Array.isArray(excludedFiles) && excludedFiles.includes(entryName)) {
          continue;
        }

        // Skip common heavy directories and binary files
        if (
          entryName.includes('node_modules/') ||
          entryName.includes('.git/') ||
          entryName.includes('dist/') ||
          entryName.includes('build/') ||
          entryName.includes('.next/') ||
          entryName.match(/\.(png|jpg|jpeg|gif|svg|ico|mp4|exe|dll|zip|tar|gz|pdf|woff|woff2|ttf|eot|lock)$/i)
        ) {
          continue;
        }
        
        try {
          const content = entry.getData().toString('utf8');
          // Ensure we only process text files
          if (!content.includes('\u0000')) {
            filesToAnalyze.push({
              path: entryName,
              content: content.slice(0, 12000), // Trim content length for fast response
            });
            if (filesToAnalyze.length >= 20) break; // Maximum 20 files safety limit
          }
        } catch (e) {
          // Skip file if reading fails
        }
      }
    }

    if (filesToAnalyze.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على ملفات برمجية صالحة للتحليل في المشروع.' });
    }

    // Prepare prompt for Gemini
    const prompt = `
أنت مهندس برمجيات خبير. يقوم المستخدم بتوفير ملفات مشروع برمجي ووصف لمشكلة يواجهها.
مهمتك هي تحليل المشروع وتحديد سبب المشكلة وإصلاحها.

وصف المشكلة:
${problemDescription}

ملفات المشروع:
${filesToAnalyze.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}

قم بإرجاع كائن JSON حصراً يحتوي على:
1. explanation: شرح مفصل للمشكلة وكيفية حلها باللغة العربية.
2. modifiedFiles: مصفوفة تحتوي على الملفات المعدلة (لكل عنصر path و content بالكامل).
`;

    // Candidate models list: primary gemini-3.7-flash with fallback models
    const candidateModels = [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash'
    ];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                explanation: {
                  type: Type.STRING,
                  description: 'شرح مفصل وواضح باللغة العربية للمشكلة وحلها.',
                },
                modifiedFiles: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: 'مسار الملف الذي تم تعديله' },
                      content: { type: Type.STRING, description: 'محتوى الملف بالكامل بعد الإصلاح' },
                    },
                    required: ['path', 'content'],
                  },
                },
              },
              required: ['explanation', 'modifiedFiles'],
            },
          },
        });

        if (response && response.text) {
          break; // Successfully got response
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed, trying next...`, err?.message || err);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("فشل توليد الاستجابة من Gemini API.");
    }

    const result = JSON.parse(response.text);

    // Reconstruct the ZIP with modified files
    const outZip = new AdmZip(req.file.buffer); 
    if (Array.isArray(result.modifiedFiles)) {
      for (const modFile of result.modifiedFiles) {
        if (modFile.path && typeof modFile.content === 'string') {
          outZip.updateFile(modFile.path, Buffer.from(modFile.content, 'utf8'));
        }
      }
    }

    const outBuffer = outZip.toBuffer();
    const base64Zip = outBuffer.toString('base64');

    return res.json({
      explanation: result.explanation || 'تم إصلاح المشروع بنجاح.',
      modifiedFiles: result.modifiedFiles || [],
      zipBase64: base64Zip,
    });

  } catch (error: any) {
    console.error('Error fixing project:', error);
    let errorMessage = error?.message || 'حدث خطأ أثناء معالجة المشروع بواسطة Gemini.';
    if (error?.message?.includes('API key') || error?.message?.includes('apiKey')) {
      errorMessage = 'مفتاح GEMINI_API_KEY غير صحيح أو غير صالح. يرجى التأكد منه في Vercel Environment Variables.';
    } else if (error?.message?.includes('Quota exceeded') || error?.message?.includes('429')) {
      errorMessage = 'عذراً، لقد تم تجاوز الحد المسموح به لطلبات Gemini API (Rate Limit). يرجى المحاولة لاحقاً.';
    }
    return res.status(500).json({ error: errorMessage });
  }
});

// Setup logic for Vercel vs AI Studio Preview
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  // Local development mode with Vite middleware
  import('vite').then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    const port = process.env.PORT || 3000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Development server running on port ${port}`);
    });
  }).catch((err) => {
    console.error('Vite import skipped in serverless/production', err);
  });
} else if (!process.env.VERCEL) {
  // Production mode (AI Studio Cloud Run)
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Production server running on port ${port}`);
  });
}

// Export the Express app for Vercel Serverless
export default app;
