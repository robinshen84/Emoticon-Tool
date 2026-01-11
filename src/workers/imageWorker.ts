import JSZip from 'jszip';
import type { WorkerTask, WorkerResponse } from '../types';

self.onmessage = async (e: MessageEvent<WorkerTask>) => {
  const { type, id, payload } = e.data;

  try {
    let result: Blob;
    switch (type) {
      case 'RESIZE':
        result = await resizeImage(payload);
        break;
      case 'CROP':
        result = await cropImage(payload);
        break;
      case 'ZIP':
        result = await createZip(payload);
        break;
      default:
        throw new Error(`Unknown message type: ${(e.data as any).type}`);
    }
    const response: WorkerResponse = { type: 'SUCCESS', id, payload: result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = { type: 'ERROR', id, error: (error as Error).message };
    self.postMessage(response);
  }
};

async function resizeImage(payload: Extract<WorkerTask, { type: 'RESIZE' }>['payload']): Promise<Blob> {
  const { file, width, height, maintainAspectRatio, fillColor } = payload;
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  if (maintainAspectRatio) {
    // Fill background
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, width, height);
    }

    // Calculate scale and position
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const drawWidth = bitmap.width * scale;
    const drawHeight = bitmap.height * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    ctx.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
  } else {
    ctx.drawImage(bitmap, 0, 0, width, height);
  }
  
  // Use 'image/png' for best quality/transparency support by default, or use original type
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return canvas.convertToBlob({ type, quality: 0.9 });
}

async function cropImage(payload: Extract<WorkerTask, { type: 'CROP' }>['payload']): Promise<Blob> {
  const { file, width, height, cropX, cropY, cropWidth, cropHeight } = payload;
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Draw the cropped portion from the source image to the entire canvas
  ctx.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
  
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return canvas.convertToBlob({ type, quality: 0.9 });
}

async function createZip(payload: Extract<WorkerTask, { type: 'ZIP' }>['payload']): Promise<Blob> {
  const zip = new JSZip();
  payload.files.forEach(f => {
    zip.file(f.name, f.blob);
  });
  return zip.generateAsync({ type: 'blob' });
}
