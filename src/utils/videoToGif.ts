import GIF from 'gif.js';

interface GifOptions {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  fit?: 'stretch' | 'contain';
  fps?: number;
  targetDurationSec?: number;
  sampleSpan?: 'first' | 'full';
  quality?: number; // 1-30, lower is better
  workers?: number;
  workerScript?: string;
}

export const convertVideoToGif = async (
  videoUrl: string,
  onProgress: (progress: number) => void,
  options: GifOptions = {}
): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    let objectUrl = '';
    let shouldRevoke = false;
    try {
      // 1. Fetch video as blob to avoid CORS issues on Canvas
      if (videoUrl.startsWith('blob:')) {
        objectUrl = videoUrl;
        shouldRevoke = false;
      } else {
        const response = await fetch(videoUrl, { referrerPolicy: 'no-referrer' });
        if (!response.ok) {
          throw new Error(`Video fetch failed: HTTP ${response.status}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const video = document.createElement('video');
      video.src = objectUrl;
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.playsInline = true;
      video.preload = 'auto';
      video.load();

      await new Promise<void>((r, rej) => {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onErr);
          r();
        };
        const onErr = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onErr);
          rej(new Error('Video load failed'));
        };
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('error', onErr);
      });

      await new Promise((r, rej) => {
        const t = window.setTimeout(() => rej(new Error('Video load timeout')), 15000);
        const onReady = () => {
          window.clearTimeout(t);
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('canplay', onReady);
          r(null);
        };
        video.addEventListener('loadeddata', onReady);
        video.addEventListener('canplay', onReady);
      });

      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      let width = options.width ?? sourceWidth;
      let height = options.height ?? sourceHeight;

      if (options.width == null && options.height == null && (options.maxWidth != null || options.maxHeight != null)) {
        const maxW = options.maxWidth ?? Number.POSITIVE_INFINITY;
        const maxH = options.maxHeight ?? Number.POSITIVE_INFINITY;
        const scale = Math.min(maxW / sourceWidth, maxH / sourceHeight, 1);
        width = Math.max(1, Math.round(sourceWidth * scale));
        height = Math.max(1, Math.round(sourceHeight * scale));
      }
      const duration = video.duration;
      const fps = options.fps ?? 10;
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('Video duration unavailable');
      }
      const outputDuration = Math.min(options.targetDurationSec ?? duration, duration);
      const sampleDuration = options.sampleSpan === 'full' ? duration : outputDuration;
      const totalFrames = Math.max(1, Math.floor(outputDuration * fps));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context failed');

      const gif = new GIF({
        workers: options.workers || 2,
        quality: options.quality || 10,
        width,
        height,
        workerScript: options.workerScript || '/gif.worker.js',
      });

      gif.on('progress', (p: number) => {
        onProgress(p);
      });

      gif.on('finished', (blob: Blob) => {
        if (shouldRevoke) URL.revokeObjectURL(objectUrl);
        resolve(blob);
      });

      let currentFrame = 0;
      const captureFrame = async () => {
        if (currentFrame >= totalFrames) {
          gif.render();
          return;
        }

        const alpha = totalFrames === 1 ? 0 : currentFrame / (totalFrames - 1);
        const safeEnd = Math.max(0, duration - 0.001);
        const time = Math.min(alpha * sampleDuration, safeEnd);
        video.currentTime = time;

        // Wait for seek
        await new Promise<void>((r, rej) => {
          const t = window.setTimeout(() => {
            cleanup();
            rej(new Error('Video seek timeout'));
          }, 15000);
          const cleanup = () => {
            window.clearTimeout(t);
            video.removeEventListener('seeked', onSeek);
            video.removeEventListener('error', onErr);
          };
          const onSeek = () => {
            cleanup();
            r();
          };
          const onErr = () => {
            cleanup();
            rej(new Error('Video seek failed'));
          };
          video.addEventListener('seeked', onSeek);
          video.addEventListener('error', onErr);
        });

        ctx.clearRect(0, 0, width, height);
        if (options.fit === 'contain') {
          const scale = Math.min(width / sourceWidth, height / sourceHeight);
          const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
          const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
          const offsetX = Math.floor((width - drawWidth) / 2);
          const offsetY = Math.floor((height - drawHeight) / 2);
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        } else {
          ctx.drawImage(video, 0, 0, width, height);
        }
        gif.addFrame(ctx, { copy: true, delay: 1000 / fps });

        currentFrame++;
        onProgress(currentFrame / totalFrames * 0.5); // First 50% is capturing
        captureFrame();
      };

      captureFrame();

    } catch (error) {
      if (shouldRevoke && objectUrl) URL.revokeObjectURL(objectUrl);
      if (typeof (error as any)?.message === 'string' && (error as any).message === 'Video load failed') {
        reject(new Error('Video load failed (possibly unsupported codec or aborted blob URL)'));
        return;
      }
      reject(error);
    }
  });
};
