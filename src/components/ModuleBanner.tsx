import React, { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dropzone } from './Dropzone';
import { useImageWorker } from '../hooks/useImageWorker';
import { downloadBlob } from '../utils/download';
import { Trash2, Download, RefreshCw, AlertCircle, Scan, Move } from 'lucide-react';

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

type FixedCropModuleProps = {
  title: string;
  targetWidth: number;
  targetHeight: number;
  dropText: string;
  actionText: string;
  previewText: string;
  downloadText: string;
  downloadPrefix: string;
};

const FixedCropModule: React.FC<FixedCropModuleProps> = ({
  title,
  targetWidth,
  targetHeight,
  dropText,
  actionText,
  previewText,
  downloadText,
  downloadPrefix,
}) => {
  const { processImage } = useImageWorker();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'auto' | 'custom'>('auto');

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [previewUrl, processedUrl]);

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setCroppedAreaPixels(area);
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
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setMode('auto');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setProcessedBlob(null);
    setError(null);
  };

  const processFixedCrop = async () => {
    if (!file || !previewUrl) return;

    setIsProcessing(true);
    setError(null);

    try {
      let cropX: number;
      let cropY: number;
      let cropWidth: number;
      let cropHeight: number;

      if (mode === 'custom' && croppedAreaPixels) {
        cropX = croppedAreaPixels.x;
        cropY = croppedAreaPixels.y;
        cropWidth = croppedAreaPixels.width;
        cropHeight = croppedAreaPixels.height;
      } else {
        const img = new Image();
        img.src = previewUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const targetRatio = targetWidth / targetHeight;
        const sourceRatio = img.width / img.height;

        if (sourceRatio > targetRatio) {
          cropHeight = img.height;
          cropWidth = img.height * targetRatio;
          cropX = (img.width - cropWidth) / 2;
          cropY = 0;
        } else {
          cropWidth = img.width;
          cropHeight = img.width / targetRatio;
          cropX = 0;
          cropY = (img.height - cropHeight) / 2;
        }
      }

      const blob = await processImage({
        type: 'CROP',
        payload: {
          file,
          width: targetWidth,
          height: targetHeight,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
        },
      });

      setProcessedBlob(blob);
      setProcessedUrl(URL.createObjectURL(blob));
    } catch {
      setError('处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (processedBlob) {
      downloadBlob(processedBlob, `${downloadPrefix}_${file?.name || 'image'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{title}</h3>
        {file && (
          <button
            onClick={handleClear}
            className="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm"
          >
            <Trash2 className="w-4 h-4" /> 清除
          </button>
        )}
      </div>

      {!file && <Dropzone onDrop={handleDrop} multiple={false} text={dropText} />}

      {file && previewUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-500">裁剪模式</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('auto')}
                className={`flex-1 p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                  mode === 'auto'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <Scan className="w-5 h-5" />
                <span className="text-sm font-medium">自动裁剪</span>
              </button>
              <button
                onClick={() => setMode('custom')}
                className={`flex-1 p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                  mode === 'custom'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <Move className="w-5 h-5" />
                <span className="text-sm font-medium">手动调整</span>
              </button>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-4 h-[300px] relative">
              {mode === 'custom' ? (
                <div className="absolute inset-0">
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={targetWidth / targetHeight}
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
                onClick={processFixedCrop}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {actionText}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-500">{previewText}</h4>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-4 min-h-[300px]">
              {processedUrl ? (
                <img src={processedUrl} alt="Processed" className="max-w-full shadow-lg" />
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
                  <Download className="w-4 h-4" /> {downloadText}
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

export const ModuleBanner: React.FC = () => (
  <FixedCropModule
    title="表情上架横幅 (750x400)"
    targetWidth={750}
    targetHeight={400}
    dropText="拖拽一张横幅原图到此处"
    actionText="生成横幅"
    previewText="效果预览 (750x400)"
    downloadText="下载横幅"
    downloadPrefix="banner_750x400"
  />
);

export const ModuleDonationGuide: React.FC = () => (
  <FixedCropModule
    title="赞赏引导图 (750x560)"
    targetWidth={750}
    targetHeight={560}
    dropText="拖拽一张赞赏引导图原图到此处"
    actionText="生成引导图"
    previewText="效果预览 (750x560)"
    downloadText="下载引导图"
    downloadPrefix="donation_guide_750x560"
  />
);

export const ModuleDonationThanks: React.FC = () => (
  <FixedCropModule
    title="赞赏致谢图 (750x750)"
    targetWidth={750}
    targetHeight={750}
    dropText="拖拽一张赞赏致谢图原图到此处"
    actionText="生成致谢图"
    previewText="效果预览 (750x750)"
    downloadText="下载致谢图"
    downloadPrefix="donation_thanks_750x750"
  />
);
