import { useEffect, useRef } from 'react';
import type { WorkerTask, WorkerResponse } from '../types';
import ImageWorker from '../workers/imageWorker?worker';

export function useImageWorker() {
  const workerRef = useRef<Worker | null>(null);
  const promisesRef = useRef<Map<string, { resolve: (blob: Blob) => void; reject: (err: Error) => void }>>(new Map());

  useEffect(() => {
    const worker = new ImageWorker();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, id } = e.data;
      const promise = promisesRef.current.get(id);
      if (promise) {
        if (type === 'SUCCESS') {
          promise.resolve(e.data.payload);
        } else {
          promise.reject(new Error(e.data.error));
        }
        promisesRef.current.delete(id);
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  const processImage = (task: Omit<WorkerTask, 'id'>) => {
    return new Promise<Blob>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const id = crypto.randomUUID();
      promisesRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({ ...task, id });
    });
  };

  return { processImage };
}
