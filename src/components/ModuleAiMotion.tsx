import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Film, Settings, AlertCircle, CheckCircle, Download, X } from 'lucide-react';
import { Dropzone } from './Dropzone';
import { ProgressBar } from './ProgressBar';
import { jimengService } from '../services/jimengAiService';
import { convertVideoToGif } from '../utils/videoToGif';
import { downloadUrl } from '../utils/download';

type ModuleAiMotionProps = {
  externalImageUrl?: string | null;
  externalImageDataUrl?: string | null;
  externalImportError?: string | null;
  initialPrompt?: string | null;
};

export const ModuleAiMotion: React.FC<ModuleAiMotionProps> = ({ externalImageUrl, externalImageDataUrl, externalImportError, initialPrompt }) => {
  const storageKey = 'ai-motion-state-v1';
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('让图片动起来，保持文字不变');
  
  const [status, setStatus] = useState<'idle' | 'uploading' | 'generating' | 'polling' | 'success' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const lastImportedRef = useRef<string | null>(null);
  
  // const [logs, setLogs] = useState<ApiLog[]>([]);

  useEffect(() => {
    const keys = jimengService.getKeys();
    setAccessKey(keys.accessKey);
    setSecretKey(keys.secretKey);
    // setBaseUrl(jimengService.getBaseUrl());
  }, []);

  useEffect(() => {
    if (!externalImportError) return;
    setStatus('failed');
    setError(externalImportError);
    setStatusMsg(externalImportError);
  }, [externalImportError]);

  useEffect(() => {
    if (typeof initialPrompt === 'string' && initialPrompt.trim()) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { prompt?: unknown; videoUrl?: unknown; gifUrl?: unknown };
      if (typeof saved.prompt === 'string') setPrompt(saved.prompt);
      if (typeof saved.videoUrl === 'string') setVideoUrl(saved.videoUrl);
      if (typeof saved.gifUrl === 'string') setGifUrl(saved.gifUrl);
      if (typeof saved.videoUrl === 'string') {
        setStatus('success');
        setProgress(100);
        setStatusMsg('已恢复上次生成结果');
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          prompt,
          videoUrl,
          gifUrl,
        })
      );
    } catch {
      return;
    }
  }, [prompt, videoUrl, gifUrl]);

  useEffect(() => {
    if (!videoUrl || !showVideoPreview) return;
    const el = videoRef.current;
    if (!el) return;
    el.setAttribute('referrerpolicy', 'no-referrer');
  }, [videoUrl, showVideoPreview]);

  useEffect(() => {
    if (!showVideoPreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowVideoPreview(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showVideoPreview]);

  const handleSaveSettings = async () => {
    jimengService.setKeys(accessKey, secretKey);
    // jimengService.setBaseUrl(baseUrl);
    setShowSettings(false);
  };

  const handleFileDrop = useCallback((files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      if (!f.type.startsWith('image/')) {
        setError('请上传图片文件');
        return;
      }
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setError(null);
      setVideoUrl(null);
      setGifUrl(null);
      setStatus('idle');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!externalImageUrl) return;
      try {
        setError(null);
        setStatusMsg('正在读取网页图片...');
        setProgress(0);

        const res = await fetch(externalImageUrl);
        if (!res.ok) throw new Error(`下载失败（${res.status}）`);
        const blob = await res.blob();
        const type = blob.type || 'image/png';

        const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : type === 'image/gif' ? 'gif' : type === 'image/png' ? 'png' : 'png';
        const fileName = `web-image.${ext}`;
        const f = new File([blob], fileName, { type });
        handleFileDrop([f]);
        setStatusMsg('');
      } catch (e: any) {
        setStatus('failed');
        setError('读取网页图片失败：可能被站点限制跨域。可先保存图片到本地再上传。');
        setStatusMsg(e?.message ? String(e.message) : '');
      }
    };
    load();
  }, [externalImageUrl, handleFileDrop]);

  useEffect(() => {
    const load = async () => {
      if (!externalImageDataUrl) return;
      if (lastImportedRef.current === externalImageDataUrl) return;
      lastImportedRef.current = externalImageDataUrl;
      try {
        setError(null);
        setStatusMsg('正在导入图片...');
        setProgress(0);

        const res = await fetch(externalImageDataUrl);
        const blob = await res.blob();
        const type = blob.type || 'image/png';
        const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : type === 'image/gif' ? 'gif' : type === 'image/png' ? 'png' : 'png';
        const fileName = `web-image.${ext}`;
        const f = new File([blob], fileName, { type });
        handleFileDrop([f]);
        setStatusMsg('');
      } catch (e: any) {
        setStatus('failed');
        setError('导入图片失败');
        setStatusMsg(e?.message ? String(e.message) : '');
      }
    };
    load();
  }, [externalImageDataUrl, handleFileDrop]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const pollTask = async (tid: string, reqKey: string) => {
    setStatus('polling');
    let attempts = 0;
    const maxAttempts = 120; // 120 * 2s = 4 mins timeout
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStatus('failed');
        setError('生成超时，请稍后重试');
        return;
      }
      
      try {
        const result = await jimengService.checkTaskStatus(tid, reqKey);
        setStatusMsg(`任务进行中: ${result.progress}%`);
        
        if (result.status === 'succeeded' && result.videoUrl) {
          setVideoUrl(result.videoUrl);
          setStatus('success');
          setProgress(100);
          setStatusMsg('生成成功');
        } else if (result.status === 'failed') {
          throw new Error('生成失败');
        } else {
          // Continue polling
          attempts++;
          setProgress(result.progress || 0);
          setTimeout(poll, 2000);
        }
      } catch (err: any) {
        setStatus('failed');
        setError(err.message || '查询任务失败');
      }
    };
    
    poll();
  };

  const handleGenerate = async () => {
    if ((!file && !prompt) || !accessKey || !secretKey) {
       if (!file && !prompt) setError('请上传图片或输入提示词');
       return;
    }
    
    try {
      setStatus('uploading');
      setProgress(10);
      setError(null);
      
      let base64 = '';
      if (file) {
        setStatusMsg('正在处理图片...');
        base64 = await fileToBase64(file);
      }
      
      setStatus('generating');
      setStatusMsg('正在提交即梦 AI 任务...');
      setProgress(20);
      
      const tid = await jimengService.generateVideo(base64, prompt);
      
      // Determine reqKey used
      // Note: Must match logic in jimengAiService.ts
      const reqKey = base64 ? 'jimeng_i2v_first_v30' : 'jimeng_t2v_v30';
      
      setStatusMsg('任务已提交，等待处理...');
      setProgress(30);
      
      pollTask(tid, reqKey);
      
    } catch (err: any) {
            setStatus('failed');
            // Try to extract detailed error message from API response
            const fullError = err.message;
            setError(fullError || '生成请求失败');
            setStatusMsg(fullError);
            console.error('Generation failed:', err);
          }
  };

  const handleConvertToGif = async () => {
    if (!videoUrl) return;
    
    try {
      setStatus('generating');
      setStatusMsg('正在转换GIF...');
      setProgress(0);
      
      const maxBytes = 500 * 1024;
      const attempts = [
        { width: 240, height: 240, fit: 'contain' as const, fps: 10, quality: 12, targetDurationSec: 3, sampleSpan: 'first' as const },
        { width: 240, height: 240, fit: 'contain' as const, fps: 8, quality: 15, targetDurationSec: 3, sampleSpan: 'first' as const },
        { width: 240, height: 240, fit: 'contain' as const, fps: 6, quality: 18, targetDurationSec: 3, sampleSpan: 'first' as const },
        { width: 240, height: 240, fit: 'contain' as const, fps: 5, quality: 22, targetDurationSec: 3, sampleSpan: 'first' as const },
        { width: 240, height: 240, fit: 'contain' as const, fps: 4, quality: 26, targetDurationSec: 3, sampleSpan: 'first' as const },
        { width: 240, height: 240, fit: 'contain' as const, fps: 3, quality: 30, targetDurationSec: 3, sampleSpan: 'first' as const },
        { width: 240, height: 240, fit: 'contain' as const, fps: 3, quality: 30, targetDurationSec: 2, sampleSpan: 'first' as const },
      ];

      let chosen: Blob | null = null;
      let lastBlob: Blob | null = null;

      for (let i = 0; i < attempts.length; i++) {
        setStatusMsg(`正在转换GIF（压缩尝试 ${i + 1}/${attempts.length}）...`);
        setProgress(0);
        const blob = await convertVideoToGif(
          videoUrl,
          (p) => {
            setProgress(Math.round(p * 100));
          },
          attempts[i]
        );
        lastBlob = blob;
        if (blob.size <= maxBytes) {
          chosen = blob;
          break;
        }
      }

      if (!chosen) {
        const kb = lastBlob ? Math.round(lastBlob.size / 1024) : 0;
        throw new Error(`压缩后仍大于500KB（当前约 ${kb}KB）`);
      }
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('GIF 读取失败'));
        reader.readAsDataURL(chosen);
      });

      setGifUrl(dataUrl);
      setStatus('success');
      setStatusMsg('转换完成');
      
    } catch (err: any) {
      setStatus('failed');
      setError('GIF转换失败: ' + err.message);
    }
  };

  const handleClearResult = () => {
    setVideoUrl(null);
    setGifUrl(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    setStatusMsg('');
  };

  const handleOpenInNewTab = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.referrerPolicy = 'no-referrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {showVideoPreview && videoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVideoPreview(false);
          }}
        >
          <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="font-medium text-gray-700 dark:text-gray-200">视频预览</div>
              <button
                onClick={() => setShowVideoPreview(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                autoPlay
                className="w-full max-h-[75vh] rounded-lg bg-black"
              />
            </div>
          </div>
        </div>
      )}
      {/* Header & Settings */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Film className="w-6 h-6 text-purple-500" />
          即梦 AI (Jimeng) 动图生成
        </h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          title="API 设置"
        >
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl space-y-4 border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium mb-1">Access Key (Volcengine)</label>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600"
              placeholder="请输入火山引擎 Access Key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secret Key (Volcengine)</label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600"
              placeholder="请输入火山引擎 Secret Key"
            />
          </div>
          
          <div className="flex justify-between items-center">
            <button
              onClick={handleSaveSettings}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              保存设置
            </button>
          </div>
        </div>
      )}

      {(!accessKey || !secretKey) && !showSettings && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl flex items-center gap-3 text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="w-5 h-5" />
          <span>请先点击右上角设置图标配置 Access Key 和 Secret Key</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          <Dropzone
            onDrop={handleFileDrop}
            accept="image/*"
            text="上传静态图片 (JPG/PNG)"
            className="h-64"
          />
          
          {previewUrl && (
            <div className="relative group">
              <img src={previewUrl} alt="Preview" className="w-full h-64 object-contain rounded-lg bg-black/5" />
              <button 
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div>
             <label className="block text-sm font-medium mb-1">提示词 (Prompt)</label>
             <textarea 
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600 h-20"
               placeholder="描述希望生成的视频内容..."
             />
          </div>

          <button
            onClick={handleGenerate}
            disabled={(!file && !prompt) || !accessKey || !secretKey || status === 'uploading' || status === 'generating' || status === 'polling'}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {status === 'generating' || status === 'polling' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                处理中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始生成视频
              </>
            )}
          </button>

          {status !== 'idle' && (
            <div className="space-y-2">
              <ProgressBar 
                progress={progress} 
                label={status === 'failed' ? '生成失败' : (statusMsg.length > 50 ? '处理中...' : statusMsg)} 
              />
              {status === 'failed' && (
                <div className="mt-2">
                  <p className="text-red-500 text-sm font-medium mb-1">{error}</p>
                  <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-40 font-mono whitespace-pre-wrap break-all">
                    {statusMsg}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Output */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-h-[400px] flex flex-col gap-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            生成结果
          </h3>

          {videoUrl ? (
            <div className="space-y-4">
              <button
                onClick={handleClearResult}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                清除生成结果
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVideoPreview(true)}
                  type="button"
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  预览 MP4
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  type="button"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  新窗口打开
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadUrl(videoUrl!, 'jimeng-video.mp4')}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  下载 MP4
                </button>
                <button
                  onClick={handleConvertToGif}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Film className="w-4 h-4" />
                  转为 GIF
                </button>
              </div>
            </div>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
               <Film className="w-12 h-12 mb-2 opacity-50" />
               <p>视频生成结果将显示在这里</p>
             </div>
          )}

          {gifUrl && (
            <div className="space-y-4 pt-4 border-t dark:border-gray-700">
               <h4 className="font-medium text-sm text-gray-500">GIF 预览</h4>
               <img src={gifUrl} alt="Generated GIF" className="w-full rounded-lg shadow-lg" />
               <button
                  onClick={() => downloadUrl(gifUrl!, 'jimeng-motion.gif')}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  下载 GIF
                </button>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};
