'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import LoadingSpinner from './LoadingSpinner';

interface FileUploadZoneProps {
  onFileSelect: (files: File[]) => void;
  selectedFiles: File[];
  onFileRemove?: (fileToRemove: File) => void;
  maxFiles?: number;
  description?: string;
  showDetails?: boolean;
  isLoading?: boolean;
}

const FileUploadZone = ({ 
  onFileSelect, 
  selectedFiles, 
  onFileRemove,
  maxFiles = 10,
  description,
  showDetails = false,
  isLoading = false
}: FileUploadZoneProps) => {
  const [error, setError] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > 25 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 25MB limit`);
        return false;
      }
      if (file.type !== 'application/pdf') {
        setError(`File "${file.name}" is not a PDF`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setError('');
      onFileSelect(validFiles);
    }
  }, [onFileSelect]);

  const handleRemove = (file: File) => {
    if (onFileRemove) {
      onFileRemove(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles,
    multiple: maxFiles > 1,
    disabled: isLoading
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 transition-colors
          ${isDragActive ? 'border-[#7469B6] bg-[#7469B6] bg-opacity-10' : 'border-gray-300 hover:border-gray-400'}
          ${error ? 'border-red-500 bg-red-50' : ''}
          ${isLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-600">Processing files...</p>
            </div>
          ) : (
            <div className="text-gray-600">
              {isDragActive ? (
                <p>Drop the PDF here...</p>
              ) : (
                <div>
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-lg">{description || `Drag and drop PDF ${maxFiles > 1 ? 'files' : 'file'} here, or click to select`}</p>
                </div>
              )}
            </div>
          )}
          {showDetails && !isLoading && (
            <>
              <p className="text-sm text-gray-500">Supported format: PDF</p>
              {maxFiles > 1 && (
                <p className="text-sm text-gray-500">Upload up to {maxFiles} files at once</p>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-4 rounded-lg shadow-sm overflow-hidden">
          <div className="max-h-[200px] overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-white border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">Size: {formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(file);
                  }}
                  className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                  title="Remove file"
                  disabled={isLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone; 