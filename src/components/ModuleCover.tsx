import React, { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dropzone } from './Dropzone';
import { useImageWorker } from '../hooks/useImageWorker';
import { downloadBlob } from '../utils/download';
import { Trash2, Download, RefreshCw, AlertCircle, Maximize, Scan, Move } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

export const ModuleCover: React.FC = () => {
  const { processImage } = useImageWorker();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modes: 'fill' (Auto Center), 'custom' (Manual Crop), 'fit' (Resize with padding)
  const [mode, setMode] = useState<'fill' | 'custom' | 'fit'>('fill');

  // Cropper state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [previewUrl, processedUrl]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleDrop = (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      if (!f.type.startsWith('image/')) {
        setError('请上传图片文件');
        return;
      }
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setProcessedUrl(null);
      setProcessedBlob(null);
      setError(null);
      // Reset crop state
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setProcessedBlob(null);
    setError(null);
  };

  const processCover = async () => {
    if (!file || !previewUrl) return;

    setIsProcessing(true);
    setError(null);

    try {
      let blob: Blob;

      if (mode === 'fit') {
        // Fit logic (Resize with aspect ratio maintained)
        blob = await processImage({
          type: 'RESIZE',
          payload: {
            file,
            width: 240,
            height: 240,
            maintainAspectRatio: true,
            fillColor: 'transparent'
          }
        });
      } else {
        // Crop logic (for both 'fill' and 'custom')
        let cropX, cropY, cropWidth, cropHeight;

        if (mode === 'custom' && croppedAreaPixels) {
          // Use manual crop data
          cropX = croppedAreaPixels.x;
          cropY = croppedAreaPixels.y;
          cropWidth = croppedAreaPixels.width;
          cropHeight = croppedAreaPixels.height;
        } else {
          // Auto Center logic ('fill')
          const img = new Image();
          img.src = previewUrl;
          await new Promise((resolve) => { img.onload = resolve; });
          
          const targetRatio = 1; // Square
          const sourceRatio = img.width / img.height;

          if (sourceRatio > targetRatio) {
            cropHeight = img.height;
            cropWidth = img.height;
            cropX = (img.width - cropWidth) / 2;
            cropY = 0;
          } else {
            cropWidth = img.width;
            cropHeight = img.width;
            cropX = 0;
            cropY = (img.height - cropHeight) / 2;
          }
        }

        blob = await processImage({
          type: 'CROP',
          payload: {
            file,
            width: 240,
            height: 240,
            cropX: cropX!,
            cropY: cropY!,
            cropWidth: cropWidth!,
            cropHeight: cropHeight!
          }
        });
      }

      setProcessedBlob(blob);
      setProcessedUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      setError('处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (processedBlob) {
      downloadBlob(processedBlob, `cover_240x240_${file?.name || 'image'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">表情封面 (240x240)</h3>
        {file && (
          <button 
            onClick={handleClear}
            className="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm"
          >
            <Trash2 className="w-4 h-4" /> 清除
          </button>
        )}
      </div>

      {!file && (
        <Dropzone onDrop={handleDrop} multiple={false} text="拖拽一张封面原图到此处" />
      )}

      {file && previewUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-500">裁剪模式</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('fill')}
                className={`flex-1 p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${mode === 'fill' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
              >
                <Scan className="w-5 h-5" />
                <span className="text-sm font-medium">自动居中</span>
              </button>
              <button
                onClick={() => setMode('custom')}
                className={`flex-1 p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${mode === 'custom' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
              >
                <Move className="w-5 h-5" />
                <span className="text-sm font-medium">手动裁剪</span>
              </button>
              <button
                onClick={() => setMode('fit')}
                className={`flex-1 p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${mode === 'fit' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
              >
                <Maximize className="w-5 h-5" />
                <span className="text-sm font-medium">完整保留</span>
              </button>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-4 h-[300px] relative">
              {mode === 'custom' ? (
                <div className="absolute inset-0">
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
              ) : (
                <img src={previewUrl} alt="Original" className="max-w-full max-h-full object-contain" />
              )}
            </div>

            {mode === 'custom' && (
              <div className="space-y-1">
                <label className="text-xs text-gray-500">缩放</label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                onClick={processCover}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                生成封面
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-500">效果预览 (240x240)</h4>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-4 min-h-[300px]">
              {processedUrl ? (
                <div className="relative w-[240px] h-[240px] bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600">
                  <img src={processedUrl} alt="Processed" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="text-gray-400 text-sm">点击左侧按钮生成预览</div>
              )}
            </div>
            {processedUrl && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleDownload}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> 下载封面
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
    </div>
  );
};
