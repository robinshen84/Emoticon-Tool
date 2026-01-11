export type WorkerTaskType = 'RESIZE' | 'CROP' | 'ZIP';

export interface ResizeTask {
  type: 'RESIZE';
  id: string;
  payload: {
    file: File;
    width: number;
    height: number;
    maintainAspectRatio?: boolean;
    fillColor?: string; // If aspect ratio maintained, fill color for padding
  };
}

export interface CropTask {
  type: 'CROP';
  id: string;
  payload: {
    file: File;
    width: number;
    height: number;
    cropX: number;
    cropY: number;
    cropWidth: number;
    cropHeight: number;
  };
}

export interface ZipTask {
  type: 'ZIP';
  id: string;
  payload: {
    files: { name: string; blob: Blob }[];
  };
}

export type WorkerTask = ResizeTask | CropTask | ZipTask;

export interface WorkerSuccessResponse {
  type: 'SUCCESS';
  id: string;
  payload: Blob;
}

export interface WorkerErrorResponse {
  type: 'ERROR';
  id: string;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
