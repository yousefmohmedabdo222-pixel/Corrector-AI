import { useState, FormEvent, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import ReactMarkdown from 'react-markdown';
import { 
  UploadCloud, Loader2, AlertCircle, Wrench, Code2, 
  CheckCircle2, Sparkles, Copy, Check, FileCode, Download,
  CheckSquare, Square, Search, ShieldAlert, ChevronDown, ChevronUp, FileText
} from 'lucide-react';

interface ZipFileItem {
  path: string;
  size: number;
  included: boolean;
  isBinaryOrHeavy: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ 
    explanation: string; 
    modifiedFiles?: { path: string; content: string }[]; 
    zipBase64: string; 
  } | null>(null);
  const [typedExplanation, setTypedExplanation] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // ZIP Inspection & File Filter States
  const [zipFiles, setZipFiles] = useState<ZipFileItem[]>([]);
  const [isInspectingZip, setIsInspectingZip] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(true);
  const [fileSearch, setFileSearch] = useState('');
  
  // Modal States for Legal & AdSense readiness
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'about' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  const handleCopyCode = (content: string, path: string) => {
    navigator.clipboard.writeText(content);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const processZipFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsInspectingZip(true);
    try {
      const zip = await JSZip.loadAsync(selectedFile);
      const items: ZipFileItem[] = [];
      zip.forEach((relativePath, entry) => {
        if (!entry.dir) {
          const isBinaryOrHeavy = 
            relativePath.includes('node_modules/') ||
            relativePath.includes('.git/') ||
            relativePath.includes('dist/') ||
            relativePath.includes('build/') ||
            relativePath.includes('.next/') ||
            !!relativePath.match(/\.(png|jpg|jpeg|gif|svg|ico|mp4|exe|dll|zip|tar|gz|pdf|woff|woff2|ttf|eot)$/i);

          const uncompressedSize = (entry as any)._data?.uncompressedSize || 0;
          items.push({
            path: relativePath,
            size: uncompressedSize,
            included: !isBinaryOrHeavy,
            isBinaryOrHeavy,
          });
        }
      });
      setZipFiles(items);
      setShowFilePreview(true);
    } catch (err) {
      console.error('Error reading zip archive:', err);
      setError('تعذر قراءة ملف ZIP. يرجى التأكد من أن الملف غير تالف.');
    } finally {
      setIsInspectingZip(false);
    }
  };

  const toggleFileIncluded = (path: string) => {
    setZipFiles(prev =>
      prev.map(f => (f.path === path ? { ...f, included: !f.included } : f))
    );
  };

  const selectAllFiles = (included: boolean) => {
    setZipFiles(prev => prev.map(f => ({ ...f, included })));
  };

  const autoFilterHeavyFiles = () => {
    setZipFiles(prev =>
      prev.map(f => ({ ...f, included: !f.isBinaryOrHeavy }))
    );
  };

  // Typewriter effect when result is updated
  useEffect(() => {
    if (!result?.explanation) {
      setTypedExplanation('');
      setIsTyping(false);
      return;
    }

    const text = result.explanation;
    let i = 0;
    setTypedExplanation('');
    setIsTyping(true);

    const timer = setInterval(() => {
      i += 3; // Stream 3 characters per tick for fast responsive feel
      if (i >= text.length) {
        setTypedExplanation(text);
        setIsTyping(false);
        clearInterval(timer);
      } else {
        setTypedExplanation(text.slice(0, i));
      }

      if (terminalBodyRef.current) {
        terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
      }
    }, 12);

    return () => clearInterval(timer);
  }, [result]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/zip' || droppedFile.name.endsWith('.zip'))) {
      processZipFile(droppedFile);
    } else {
      setError('الرجاء رفع ملف بصيغة ZIP فقط.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processZipFile(selectedFile);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('يرجى رفع ملف المشروع (ZIP).');
      return;
    }
    if (!description.trim()) {
      setError('يرجى إدخال وصف للمشكلة.');
      return;
    }

    const includedCount = zipFiles.filter(f => f.included).length;
    if (zipFiles.length > 0 && includedCount === 0) {
      setError('يرجى تحديد ملف واحد على الأقل للتحليل.');
      return;
    }

    setLoading(true);
    setLoadingStep(1);
    setError(null);
    setResult(null);
    setTypedExplanation('');

    // Simulated progress step updates for instant feedback
    const step2Timer = setTimeout(() => setLoadingStep(2), 1200);
    const step3Timer = setTimeout(() => setLoadingStep(3), 2800);

    const excludedFiles = zipFiles.filter(f => !f.included).map(f => f.path);

    // Generate a clean, filtered ZIP on client side to keep payload under Vercel's 4.5MB limit
    let fileToUpload: File = file;
    if (zipFiles.length > 0) {
      try {
        const originalZip = await JSZip.loadAsync(file);
        const filteredZip = new JSZip();

        for (const item of zipFiles) {
          if (item.included) {
            const entry = originalZip.file(item.path);
            if (entry) {
              const content = await entry.async('arraybuffer');
              filteredZip.file(item.path, content);
            }
          }
        }

        const blob = await filteredZip.generateAsync({ type: 'blob' });

        if (blob.size > 4.5 * 1024 * 1024) {
          setError(`حجم الملفات المحددة (${formatBytes(blob.size)}) يتجاوز الحد الأقصى المسموح به على Vercel (4.5 ميغابايت). يرجى إلغاء تحديد بعض الملفات الكبيرة أو الصور.`);
          setLoading(false);
          clearTimeout(step2Timer);
          clearTimeout(step3Timer);
          return;
        }

        fileToUpload = new File([blob], file.name, { type: 'application/zip' });
      } catch (zipErr: any) {
        console.warn('Zip filter notice:', zipErr);
      }
    }

    const formData = new FormData();
    formData.append('project', fileToUpload);
    formData.append('description', description);
    formData.append('excludedFiles', JSON.stringify(excludedFiles));

    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        body: formData,
      });

      let data;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        const cleanServerText = responseText.replace(/<[^>]*>?/gm, '').trim();
        if (cleanServerText.includes('FUNCTION_INVOCATION_TIMEOUT') || res.status === 504) {
          throw new Error('استغرقت معالجة المشروع وقتاً أطول من مهلة الخادم (504 Timeout).\n\n💡 نصائح للحل السريع:\n1. اضغط على زر (حماية 🛡️) في قائمة الملفات لاستبعاد الملفات الثقيلة والمجلدات غير الضرورية (مثل node_modules أو الصور).\n2. حدد فقط الملفات ذات الصلة بالمشكلة لإتمام التحليل بسرعة فائقة.');
        }
        if (!res.ok) {
          throw new Error(`خطأ من الخادم (${res.status}): ${cleanServerText.slice(0, 180) || 'تعذر معالجة الطلب على Vercel.'}`);
        } else {
          throw new Error('استجابة الخادم غير صالحة.');
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || 'حدث خطأ أثناء معالجة المشروع.');
      }

      setLoadingStep(4);
      setResult(data);
    } catch (err: any) {
      let errMsg = err.message || 'فشل الاتصال بالخادم.';
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Load failed')) {
        errMsg = 'تعذر الاتصال بالخادم (Failed to fetch). قد يرجع ذلك لعدة أسباب:\n• انقطاع مؤقت أو بطء في شبكة الاتصال.\n• استغرق رفع أو معالجة الملف وقتاً أطول من المهلة المحددة.\n• حجم الـ ZIP كبير جداً. نوصي باستخدام زر (حماية 🛡️) لاستبعاد الملفات الضخمة والملفات الثنائية ثم إعادة المحاولة.';
      }
      setError(errMsg);
    } finally {
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.zipBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${result.zipBase64}`;
    link.download = `fixed_${file?.name || 'project.zip'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div dir="rtl" className="flex flex-col min-h-screen w-full bg-slate-50 text-slate-900 font-sans">
      <nav className="flex items-center justify-between px-6 lg:px-8 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">مصلح المشاريع الذكي</h1>
            <p className="text-xs text-slate-500 font-medium">مدعوم بواسطة Gemini AI</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-xs font-semibold">جاهز للعمل</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6">
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1">
            <h2 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-500" />
              تحليل وإصلاح مشروعك
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 flex flex-col flex-1 pr-1">
              <div
                className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 lg:p-8 transition-colors cursor-pointer h-40 lg:h-48 shrink-0 ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept=".zip,application/zip" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <UploadCloud className={`w-10 h-10 lg:w-12 lg:h-12 mb-3 ${file ? 'text-indigo-500' : 'text-slate-400'}`} />
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">اسحب وافلت ملف ZIP هنا</p>
                    <p className="text-xs text-slate-400 mt-1">أو اضغط لاختيار الملف من جهازك</p>
                  </div>
                )}
              </div>

              {/* ZIP Inspection & File Selection Panel */}
              {isInspectingZip ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center flex items-center justify-center gap-2 text-xs text-slate-600 shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>جارٍ قراءة محتويات ملف ZIP وحساب الأحجام...</span>
                </div>
              ) : zipFiles.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden text-xs shrink-0">
                  {/* Inspector Header Bar */}
                  <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <FileCode className="w-4 h-4 text-indigo-600" />
                      <span>معاينة وتحكم في الملفات</span>
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[11px]">
                        {zipFiles.filter(f => f.included).length} / {zipFiles.length} مفعّل
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilePreview(!showFilePreview)}
                      className="text-slate-500 hover:text-slate-800 transition-colors p-1"
                      title="طي/بسط القائمة"
                    >
                      {showFilePreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {showFilePreview && (
                    <div className="p-3 space-y-3">
                      {/* Quick Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => selectAllFiles(true)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded font-medium text-slate-700 flex items-center gap-1 transition-colors"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                            <span>تحديد الكل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => selectAllFiles(false)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded font-medium text-slate-700 flex items-center gap-1 transition-colors"
                          >
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>إلغاء الكل</span>
                          </button>
                          <button
                            type="button"
                            onClick={autoFilterHeavyFiles}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded font-medium text-indigo-700 flex items-center gap-1 transition-colors"
                            title="تصفية تلقائية لحماية الحصة المتاحة"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                            <span>حماية 🛡️</span>
                          </button>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">
                          الحجم: {formatBytes(zipFiles.filter(f => f.included).reduce((acc, f) => acc + f.size, 0))}
                        </span>
                      </div>

                      {/* Search input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="البحث في اسم الملف..."
                          value={fileSearch}
                          onChange={(e) => setFileSearch(e.target.value)}
                          className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Scrollable Files List */}
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]" dir="ltr">
                        {zipFiles
                          .filter(f => !fileSearch || f.path.toLowerCase().includes(fileSearch.toLowerCase()))
                          .map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => toggleFileIncluded(item.path)}
                              className={`flex items-center justify-between p-1.5 rounded cursor-pointer border transition-colors ${
                                item.included
                                  ? 'bg-white border-slate-200 hover:border-indigo-300'
                                  : 'bg-slate-100/70 border-slate-200 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={item.included}
                                  onChange={() => {}} // Handled by parent div
                                  className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 cursor-pointer"
                                />
                                <span className={`truncate text-left ${item.included ? 'text-slate-800 font-medium' : 'text-slate-500 line-through'}`}>
                                  {item.path}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {item.isBinaryOrHeavy && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-sans font-semibold" dir="rtl">
                                    مستبعد 🛡️
                                  </span>
                                )}
                                <span className="text-slate-400 text-[10px]">
                                  {formatBytes(item.size)}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex-1 min-h-[100px] flex flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-2">وصف المشكلة</label>
                <textarea
                  className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                  placeholder="اشرح المشكلة التي تواجهها في المشروع..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-200 shrink-0">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="mt-2 space-y-4 shrink-0">
                <button
                  type="submit"
                  disabled={loading || !file || !description.trim()}
                  className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التحليل...</span>
                    </>
                  ) : (
                    <>
                      <span>بدء التحليل</span>
                      <Code2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-indigo-900 p-6 rounded-xl text-white shadow-lg shrink-0 hidden lg:block">
            <h3 className="font-bold text-indigo-200 mb-2 uppercase tracking-widest text-xs">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Gemini AI</span>
                <span className="text-indigo-300 font-mono italic">Online</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Analysis Engine</span>
                <span className="text-indigo-300 font-mono italic">{loading ? 'Running...' : 'Standby'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 min-h-[450px]">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[400px]">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center shrink-0" dir="ltr">
              <span className="text-sm font-bold text-slate-700">Analysis Terminal</span>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              </div>
            </div>
            
            <div ref={terminalBodyRef} className="p-4 lg:p-6 font-mono text-sm overflow-y-auto space-y-4 flex-1 flex flex-col" dir="ltr">
              {loading || result ? (
                <>
                  {/* Terminal Header Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                    <div className="flex gap-2">
                      <span className="text-indigo-600 font-bold">[{new Date().toLocaleTimeString()}]</span>
                      <span>Task Execution Engine: Gemini 3.7 Flash</span>
                    </div>
                    {loading && (
                      <span className="text-amber-600 font-bold flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    )}
                  </div>

                  {/* Terminal Status Lines */}
                  <div className="space-y-2 text-xs font-mono bg-slate-900 text-slate-200 p-4 rounded-lg border border-slate-800 shadow-inner" dir="rtl">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">&gt;</span>
                      <span className="text-slate-300">جارٍ فك الضغط وقراءة الملفات...</span>
                      <span className="mr-auto font-bold text-emerald-400">✓</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">&gt;</span>
                      <span className="text-slate-300">تحليل البنية وفحص الكود...</span>
                      {loadingStep >= 2 ? (
                        <span className="mr-auto font-bold text-emerald-400">✓</span>
                      ) : (
                        <span className="mr-auto text-amber-400 animate-pulse">⏳</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">&gt;</span>
                      <span className="text-slate-300">البحث عن السبب الجذري والمعالجة بواسطة Gemini 3.7 Flash...</span>
                      {loadingStep >= 3 ? (
                        <span className="mr-auto font-bold text-emerald-400">✓</span>
                      ) : (
                        <span className="mr-auto text-amber-400 animate-pulse">⏳</span>
                      )}
                    </div>

                    {result && (
                      <div className="flex items-center gap-2 text-emerald-400 pt-1 border-t border-slate-800">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold">تم العثور على الحل وإنشاء الحزمة المصححة جاهزة للتحميل! ✓</span>
                      </div>
                    )}
                  </div>

                  {/* Live Streamed Report / Explanation */}
                  {result && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex-1 overflow-y-auto space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200" dir="rtl">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></span>
                          <span className="font-bold text-slate-800 text-base">تقرير الإصلاح المباشر (Live Report)</span>
                        </div>
                        <div className="prose prose-slate prose-sm rtl:prose-reverse max-w-none text-slate-800 leading-relaxed font-sans text-sm [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-indigo-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_code]:bg-indigo-50 [&_code]:text-indigo-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_code]:border [&_code]:border-indigo-100 [&_strong]:text-slate-900 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_li]:my-1" dir="rtl">
                          <ReactMarkdown>
                            {typedExplanation}
                          </ReactMarkdown>
                          {isTyping && (
                            <span className="inline-block w-2 h-4 bg-indigo-600 ml-1 animate-pulse align-middle"></span>
                          )}
                        </div>
                      </div>

                      {/* Modified Files Cards with Copy Buttons */}
                      {result.modifiedFiles && result.modifiedFiles.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 space-y-3" dir="rtl">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              <FileCode className="w-4 h-4 text-indigo-600" />
                              الملفات المعدلة والمصصحة ({result.modifiedFiles.length}):
                            </h4>
                          </div>

                          <div className="space-y-3" dir="ltr">
                            {result.modifiedFiles.map((modFile, idx) => (
                              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-slate-800/80 px-3 py-2 flex items-center justify-between border-b border-slate-700/60">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <span className="text-xs font-mono text-slate-200 truncate">{modFile.path}</span>
                                  </div>
                                  <button
                                    onClick={() => handleCopyCode(modFile.content, modFile.path)}
                                    className="px-2.5 py-1 text-xs font-sans font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center gap-1.5 shrink-0"
                                    title="نسخ الكود"
                                  >
                                    {copiedPath === modFile.path ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-bold" dir="rtl">تم النسخ ✓</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                                        <span dir="rtl">نسخ الكود</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin scrollbar-thumb-slate-700">
                                  <code>{modFile.content}</code>
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Download Package Bar */}
                  {result && (
                    <div className="pt-3 border-t border-slate-100 shrink-0" dir="ltr">
                      <h4 className="text-slate-800 font-bold mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Final Resolution Package
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="p-3 lg:p-4 bg-slate-100 rounded-lg flex items-center gap-4 flex-1 overflow-hidden">
                          <div className="bg-white p-2 rounded shadow-sm hidden sm:block">
                            <Code2 className="w-8 h-8 text-indigo-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500">Filename</p>
                            <p className="text-sm font-bold text-slate-800 tracking-tight font-sans truncate">fixed_{file?.name || 'project.zip'}</p>
                          </div>
                          <div className="ml-auto text-right whitespace-nowrap">
                            <p className="text-xs text-slate-500">Status</p>
                            <p className="text-sm font-bold text-emerald-600">Ready</p>
                          </div>
                        </div>
                        <button 
                          onClick={handleDownload}
                          className="bg-indigo-600 text-white px-5 lg:px-7 py-3 lg:py-4 rounded-lg font-bold shadow-lg hover:bg-indigo-700 flex flex-col items-center leading-tight transition-colors shrink-0"
                        >
                          <span className="text-base lg:text-lg uppercase tracking-wider">Download</span>
                          <span className="text-[10px] opacity-80 hidden sm:inline">Includes Fixed Code</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <Code2 className="w-12 h-12 text-slate-300 mb-3" />
                  <span className="italic font-sans text-sm text-slate-500">النظام جاهز لاستقبال مشروعك وتحليله.</span>
                  <span className="text-xs text-slate-400 mt-1 font-sans">سيتم بث خطوات الفحص والنتيجة مباشرة هنا حرفاً بحرف.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* SEO Content Section for Google Search Console & AdSense */}
      <section className="bg-slate-50 border-t border-slate-200 py-12 px-6 lg:px-12 text-slate-800 shrink-0" dir="rtl">
        <div className="max-w-6xl mx-auto space-y-10">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              كيف يعمل مصلح المشاريع الذكي؟
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              ارفع مشروعك كملف ZIP، اشرح المشكلة، وسيقوم الذكاء الاصطناعي (Gemini) بتحليل البنية وتحديد السبب الجذري وتقديم الكود المصحح جاهزاً للتحميل.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                هل كودي آمن؟
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                نعم، الملفات تُعالج لإجراء التحليل فقط ولا يتم تخزينها أو مشاركتها على الإطلاق. تظل أكوادك وحق ملكيتك الفكرية محمية بالكامل.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                ما اللغات والتقنيات المدعومة؟
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                يدعم مصلح الأكواد كافة لغات واطارات العمل البرمجية، بما في ذلك: JavaScript, TypeScript, Python, HTML, CSS, JSON, React, Vue, Node.js, Express, PHP والمزيد.
              </p>
            </div>
          </div>

          {/* FAQs Section */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="text-indigo-600">❓</span>
              أسئلة شائعة (FAQ)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">1. هل استخدام المنصة مجاني؟</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  نعم، المنصة مجانية تماماً ومتاحة للمطورين لفحص الأكواد وإصلاح الأخطاء بسهولة وسرعة.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">2. كم عدد الملفات التي يمكن تحليلها؟</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  يمكنك رفع حزمة ZIP كاملة تحوي عشرات أو مئات الملفات، مع إمكانية استخدام أداة (المعاينة والحماية 🛡️) لاستبعاد الحزم الثقيلة مثل node_modules لتسريع عملية التحليل.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">3. ماذا لو لم يعمل الإصلاح من المرة الأولى؟</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  يمكنك إعادة محاولة التحليل مع إرفاق وصف أكثر تفصيلاً للمشكلة أو اسم الملف والدالة المسببة للخطأ لمساعدة الذكاء الاصطناعي على الوصول للحجم والدقة المثاليين.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      <footer className="px-6 lg:px-8 py-3 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center text-[10px] sm:text-[11px] font-semibold text-slate-500 tracking-wider shrink-0 gap-3" dir="rtl">
        <div className="flex items-center gap-4 text-xs font-normal">
          <button 
            onClick={() => setActiveModal('privacy')}
            className="text-slate-600 hover:text-indigo-600 transition-colors underline underline-offset-2"
          >
            سياسة الخصوصية
          </button>
          <span>•</span>
          <button 
            onClick={() => setActiveModal('terms')}
            className="text-slate-600 hover:text-indigo-600 transition-colors underline underline-offset-2"
          >
            شروط الاستخدام
          </button>
          <span>•</span>
          <button 
            onClick={() => setActiveModal('about')}
            className="text-slate-600 hover:text-indigo-600 transition-colors underline underline-offset-2"
          >
            عن المنصة
          </button>
        </div>
        <div className="text-slate-500 font-mono text-[10px]" dir="ltr">
          Designed by Youssef Mohamed Abdel Fattah | AI REPAIR ENGINE v2.4.0
        </div>
      </footer>

      {/* Legal & Information Modals (AdSense & Search Console Compliant) */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-800" dir="rtl">
            <div className="p-4 px-6 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {activeModal === 'privacy' && 'سياسة الخصوصية (Privacy Policy)'}
                {activeModal === 'terms' && 'شروط الاستخدام (Terms of Service)'}
                {activeModal === 'about' && 'عن المنصة ومصلح الأكواد الذكي'}
              </h3>
              <button 
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm leading-relaxed text-slate-700">
              {activeModal === 'privacy' && (
                <>
                  <p className="font-semibold text-slate-900">نحن نحترم خصوصيتك وأمان بياناتك البرمجية بشكل كامل:</p>
                  <ul className="list-disc pr-5 space-y-2">
                    <li><strong>حماية الكود:</strong> الملفات التي تقوم برفعها تُستخدم فقط لغرض التحليل والتصليح المؤقت ولا يتم تخزينها نهائياً أو مشاركتها مع أي طرف ثالث.</li>
                    <li><strong>ملفات الكوكيز والإعلانات:</strong> قد نستخدم خدمات Google AdSense لعرض إعلانات مخصصة. تستخدم Google ملفات كوكيز لعرض الإعلانات بناءً على زياراتك للموقع.</li>
                    <li><strong>الأمان:</strong> جميع عمليات نقل الملفات مشفرة بالكامل عبر اتصالات SSL/TLS الآمنة.</li>
                  </ul>
                </>
              )}

              {activeModal === 'terms' && (
                <>
                  <p className="font-semibold text-slate-900">شروط وإرشادات الاستخدام:</p>
                  <ul className="list-disc pr-5 space-y-2">
                    <li>المنصة مخصصة لمساعدة المطورين على تصحيح أخطاء المشاريع البرمجية وتوليد الأكواد المصححة.</li>
                    <li>يتحمل المستخدم المسؤولية الكاملة عن التأكد من مراجعة التعديلات قبل استخدامها في البيئات الإنتاجية (Production).</li>
                    <li>يُحظر استخدام الخدمة لرفع أية ملفات ضارة أو برمجيات خبيثة.</li>
                  </ul>
                </>
              )}

              {activeModal === 'about' && (
                <>
                  <p className="font-semibold text-slate-900">عن مصلح الأكواد الذكي:</p>
                  <p>منصة برمجية متطورة تعتمد على نموذج الذكاء الاصطناعي الأحدث Gemini 3.7 Flash لفحص وإصلاح الثغرات والأخطاء في المشاريع المرفوقة بصيغة ZIP، مع توفير تقارير تفصيلية وإعادة تحميل الحزم المصححة بنقرة واحدة.</p>
                  <p className="text-xs text-slate-500 pt-2 border-t">تطوير وتصميم: يوسف محمد عبد الفتاح | جاهز للاستضافة على Vercel وGoogle Search Console وGoogle AdSense.</p>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-left" dir="ltr">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors text-xs"
              >
                إغلاق (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
