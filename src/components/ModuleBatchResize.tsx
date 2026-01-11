import React, { useState, useEffect } from 'react';
import { Dropzone } from './Dropzone';
import { useImageWorker } from '../hooks/useImageWorker';
import { downloadBlob } from '../utils/download';
import { ProgressBar } from './ProgressBar';
import { Trash2, Download, AlertCircle } from 'lucide-react';

export const ModuleBatchResize: React.FC = () => {
  const { processImage } = useImageWorker();
  const [files, setFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<{name: string, blob: Blob, url: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      processedImages.forEach(img => URL.revokeObjectURL(img.url));
    };
  }, [processedImages]);

  const handleDrop = (newFiles: File[]) => {
    setError(null);
    const validFiles = newFiles.filter(f => f.type.startsWith('image/'));
    if (validFiles.length !== newFiles.length) {
      setError('部分文件被跳过，因为它们不是图片。');
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleClear = () => {
    setFiles([]);
    setProcessedImages([]);
    setProgress(0);
    setError(null);
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    
    // Validation
    if (files.length < 8 || files.length > 24) {
      if (!confirm(`建议上传 8-24 张图片 (当前 ${files.length} 张)。是否继续?`)) {
        return;
      }
    }

    setIsProcessing(true);
    setProgress(0);
    setProcessedImages([]);
    setError(null);

    const results: {name: string, blob: Blob, url: string}[] = [];
    let completed = 0;

    try {
      for (const file of files) {
        // Validate Aspect Ratio (Optional check, strict enforcement or just resize)
        // For now, we assume we just resize to 240x240 as requested.
        
        const blob = await processImage({
          type: 'RESIZE',
          payload: {
            file,
            width: 240,
            height: 240,
            maintainAspectRatio: true,
            fillColor: 'transparent' // Or white? Usually transparent for PNG stickers
          }
        });

        results.push({
          name: file.name,
          blob,
          url: URL.createObjectURL(blob)
        });

        completed++;
        setProgress((completed / files.length) * 100);
      }
      setProcessedImages(results);
    } catch (err) {
      console.error(err);
      setError('处理过程中发生错误，请重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    if (processedImages.length === 0) return;
    
    try {
      const zipBlob = await processImage({
        type: 'ZIP',
        payload: {
          files: processedImages.map(img => ({ name: img.name, blob: img.blob }))
        }
      });
      downloadBlob(zipBlob, 'expressions_240x240.zip');
    } catch (err) {
      console.error(err);
      setError('打包下载失败。');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">批量调整 (240x240)</h3>
        {files.length > 0 && (
          <button 
            onClick={handleClear}
            className="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm"
          >
            <Trash2 className="w-4 h-4" /> 清除全部
          </button>
        )}
      </div>

      {files.length === 0 && processedImages.length === 0 && (
        <Dropzone onDrop={handleDrop} multiple={true} text="拖拽 8-24 张图片到此处" />
      )}

      {/* File List Preview (Before Processing) */}
      {files.length > 0 && processedImages.length === 0 && !isProcessing && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {files.map((file, idx) => (
              <div key={idx} className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group">
                <img 
                  src={URL.createObjectURL(file)} 
                  alt={file.name} 
                  className="w-full h-full object-cover"
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs p-1 text-center">
                  {file.name}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={processFiles}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-medium transition-colors flex items-center gap-2"
            >
              开始处理 ({files.length} 张)
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="max-w-md mx-auto py-8">
          <ProgressBar progress={progress} label="正在处理表情包..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Results */}
      {processedImages.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">处理结果预览</h4>
            <button
              onClick={handleDownloadZip}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> 一键打包下载
            </button>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {processedImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border-2 border-green-500/20">
                <img src={img.url} alt={img.name} className="w-full h-full object-contain p-1" />
              </div>
            ))}
          </div>
          
          <div className="text-center text-sm text-gray-500">
            已完成 {processedImages.length} 张图片的尺寸优化
          </div>
        </div>
      )}
    </div>
  );
};
