import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

interface DropzoneProps {
  onDrop: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  text?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({ 
  onDrop, 
  accept = "image/*", 
  multiple = false, 
  className = "",
  text = "拖拽文件到此处或点击上传"
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onDrop(files);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onDrop(files);
    }
    // Reset value so same file can be selected again if needed
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors
        flex flex-col items-center justify-center gap-4 text-center
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'}
        ${className}
      `}
    >
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
      />
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
        <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400" />
      </div>
      <div>
        <p className="font-medium text-gray-700 dark:text-gray-200">{text}</p>
        <p className="text-sm text-gray-500 mt-1">
          {multiple ? "支持批量上传" : "支持单个文件"}
        </p>
      </div>
    </div>
  );
};
