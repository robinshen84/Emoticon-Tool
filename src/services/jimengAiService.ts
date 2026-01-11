import axios, { type AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';

// Configuration
const DEFAULT_API_BASE = '/api/volc';
const STORAGE_KEY_ACCESS_KEY = 'jimeng_access_key';
const STORAGE_KEY_SECRET_KEY = 'jimeng_secret_key';

// Volcengine Service Constants
// 'cv' is commonly used for Visual Intelligence APIs. 
// If this fails, check ResponseMetadata.Service in error logs.
const SERVICE = 'cv'; 
const REGION = 'cn-north-1';
const VERSION = '2022-08-31';
const HOST = 'visual.volcengineapi.com';

interface JimengTaskResponse {
  ResponseMetadata: {
    RequestId: string;
    Action: string;
    Version: string;
    Service: string;
    Region: string;
    Error?: {
      Code: string;
      Message: string;
    };
  };
  Result?: {
    TaskId?: string;
    task_id?: string;
    Status?: string; // "Pending" | "Running" | "Succeeded" | "Failed"
    status?: string;
    Progress?: number;
    progress?: number;
    RespData?: string; // JSON string containing video URL
    ResultUrl?: string;
    video_url?: string;
  };
}

export class JimengAiService {
  private accessKey: string = '';
  private secretKey: string = '';
  private baseUrl: string = DEFAULT_API_BASE;
  private client: AxiosInstance;

  constructor() {
    this.accessKey = localStorage.getItem(STORAGE_KEY_ACCESS_KEY) || '';
    this.secretKey = localStorage.getItem(STORAGE_KEY_SECRET_KEY) || '';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  setKeys(ak: string, sk: string) {
    this.accessKey = ak.trim();
    this.secretKey = sk.trim();
    localStorage.setItem(STORAGE_KEY_ACCESS_KEY, this.accessKey);
    localStorage.setItem(STORAGE_KEY_SECRET_KEY, this.secretKey);
  }

  getKeys() {
    return { accessKey: this.accessKey, secretKey: this.secretKey };
  }

  // HMAC-SHA256 helper
  private hmac(key: string | CryptoJS.lib.WordArray, msg: string) {
    return CryptoJS.HmacSHA256(msg, key);
  }

  // Calculate Signature
  private sign(method: string, params: Record<string, string>, bodyStr: string) {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('Missing Access Key or Secret Key');
    }

    const now = new Date();
    const xDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
    const shortDate = xDate.substring(0, 8); // YYYYMMDD
    const CONTENT_TYPE = 'application/json'; // Removed charset to avoid mismatch

    // 1. Canonical Request
    
    // Sort query params
    const query = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');

    const contentHash = CryptoJS.SHA256(bodyStr).toString(CryptoJS.enc.Hex);

    const canonicalHeaders = [
      `content-type:${CONTENT_TYPE}`,
      `host:${HOST}`,
      `x-content-sha256:${contentHash}`,
      `x-date:${xDate}`
    ].join('\n');

    const signedHeaders = 'content-type;host;x-content-sha256;x-date';

    const canonicalRequest = [
      method,
      '/',
      query,
      canonicalHeaders,
      '', // Empty line after headers
      signedHeaders,
      contentHash
    ].join('\n');

    // 2. String to Sign
    const credentialScope = `${shortDate}/${REGION}/${SERVICE}/request`;
    const stringToSign = [
      'HMAC-SHA256',
      xDate,
      credentialScope,
      CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex)
    ].join('\n');

    // 3. Calculate Signature
    // Volcengine uses secretKey directly (no prefix like AWS4)
    const kDate = this.hmac(this.secretKey, shortDate);
    const kRegion = this.hmac(kDate, REGION);
    const kService = this.hmac(kRegion, SERVICE);
    const kSigning = this.hmac(kService, 'request');
    const signature = this.hmac(kSigning, stringToSign).toString(CryptoJS.enc.Hex);

    const authorization = `HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Debug Log (for troubleshooting signature mismatch)
    console.log('--- Jimeng API Signature Debug ---');
    console.log('Canonical Request:', JSON.stringify(canonicalRequest));
    console.log('String to Sign:', JSON.stringify(stringToSign));
    console.log('Authorization:', authorization);
    console.log('----------------------------------');

    return {
      headers: {
        'Content-Type': CONTENT_TYPE,
        'X-Content-Sha256': contentHash,
        'X-Date': xDate,
        'Authorization': authorization,
      },
      query
    };
  }

  private extractTaskId(payload: any): string | undefined {
    const candidates = [
      payload?.Result?.TaskId,
      payload?.Result?.task_id,
      payload?.result?.TaskId,
      payload?.result?.task_id,
      payload?.Data?.TaskId,
      payload?.Data?.task_id,
      payload?.data?.TaskId,
      payload?.data?.task_id,
    ];

    for (const v of candidates) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  async generateVideo(base64Image: string, prompt: string): Promise<string> {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('Please set Access Key and Secret Key first');
    }

    // Clean Base64 string
    const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const params = {
      Action: 'CVSync2AsyncSubmitTask',
      Version: VERSION,
    };

    // Body based on Volcengine Video Generation documentation
          // req_key: 'jimeng_i2v_first_v30' for Image-to-Video (Video Gen 3.0)
      // req_key: 'jimeng_t2v_v30' for Text-to-Video (Video Gen 3.0)
      const body: any = {
        req_key: cleanedBase64 ? 'jimeng_i2v_first_v30' : 'jimeng_t2v_v30',
        prompt: prompt || 'Animate this image',
      };

          if (cleanedBase64) {
            body.binary_data_base64 = [cleanedBase64];
          }
    
    // Explicitly stringify body to ensure consistency between hash and network request
    const bodyStr = JSON.stringify(body);

    const { headers, query } = this.sign('POST', params, bodyStr);

    try {
      // Pass bodyStr directly to axios to prevent it from re-stringifying/modifying
      // Note: axios treats string data as-is if content-type is set
      const response = await this.client.post<JimengTaskResponse>(`/?${query}`, bodyStr, { headers });
      
      // Check for non-standard error formats in 200 OK responses
      if (response.data && (response.data as any).code === 50400) {
           throw new Error(`Service Error (50400): The Jimeng service returned 'Access Denied'. This often means the 'Jimeng' service itself is not activated on your account, even if IAM permissions are correct. Please go to Volcengine Console > Visual Intelligence > Jimeng and ensure the service is 'Activated' (Open).`);
      }

      if (response.data.ResponseMetadata && response.data.ResponseMetadata.Error) {
        throw new Error(`API Error: ${response.data.ResponseMetadata.Error.Message}`);
      }

      const taskId = this.extractTaskId(response.data);
      if (!taskId) {
        const payload = response.data as any;
        const hint = JSON.stringify(
          {
            ResponseMetadata: payload?.ResponseMetadata,
            keys: payload ? Object.keys(payload) : undefined,
            ResultKeys: payload?.Result ? Object.keys(payload.Result) : undefined,
            dataKeys: payload?.data ? Object.keys(payload.data) : undefined,
          },
          null,
          2
        );
        throw new Error(`No TaskId returned from Jimeng API. Response shape: ${hint}`);
      }

      return taskId;
    } catch (error: any) {
      console.error('Jimeng API Error:', JSON.stringify(error.response?.data || error.message, null, 2));
      
      // Handle 50400 in catch block if status code is not 200
      if (error.response?.data?.code === 50400) {
          throw new Error(`Service Error (50400): The Jimeng service returned 'Access Denied'. This often means the 'Jimeng' service itself is not activated on your account, even if IAM permissions are correct. Please go to Volcengine Console > Visual Intelligence > Jimeng and ensure the service is 'Activated' (Open).`);
      }

      const errorData = error.response?.data?.ResponseMetadata?.Error;
      if (errorData) {
        if (errorData.Code === 'AccessDenied') {
          throw new Error(`Permission Denied: Your Access Key lacks permission for 'cv:CVSync2AsyncSubmitTask'. Please attach the 'CVFullAccess' or 'VisualFullAccess' policy in Volcengine IAM.`);
        }
        throw new Error(`API Error: ${errorData.Message}`);
      }
      throw error;
    }
  }

  async checkTaskStatus(taskId: string, reqKey: string = 'jimeng_i2v_first_v30'): Promise<{ status: 'pending' | 'running' | 'succeeded' | 'failed'; videoUrl?: string; progress?: number }> {
    const params = {
      Action: 'CVSync2AsyncGetResult',
      Version: VERSION,
    };

    const body = {
      req_key: reqKey,
      task_id: taskId,
    };
    
    // Explicitly stringify body
    const bodyStr = JSON.stringify(body);

    const { headers, query } = this.sign('POST', params, bodyStr);

    try {
      const response = await this.client.post<JimengTaskResponse>(`/?${query}`, bodyStr, { headers });

      const payload: any = response.data;
      const metaError =
        payload?.ResponseMetadata?.Error ??
        payload?.response_metadata?.error ??
        payload?.ResponseMetadata?.error;
      if (metaError) {
        const message = metaError.Message ?? metaError.message ?? 'Unknown error';
        throw new Error(`API Error: ${message}`);
      }

      const statusRaw =
        payload?.Result?.Status ??
        payload?.Result?.status ??
        payload?.data?.Status ??
        payload?.data?.status ??
        payload?.Result?.State ??
        payload?.data?.state;

      const progressRaw =
        payload?.Result?.Progress ??
        payload?.Result?.progress ??
        payload?.data?.Progress ??
        payload?.data?.progress;

      const progress = typeof progressRaw === 'number' ? progressRaw : undefined;

      const statusLower = String(statusRaw ?? '').toLowerCase();
      const isSucceeded = ['succeeded', 'success', 'done'].includes(statusLower);
      const isFailed = ['failed', 'failure', 'error'].includes(statusLower);
      const isRunning = ['running', 'processing'].includes(statusLower);

      if (isSucceeded) {
        let videoUrl =
          payload?.Result?.ResultUrl ??
          payload?.Result?.video_url ??
          payload?.data?.ResultUrl ??
          payload?.data?.video_url ??
          '';

        if (!videoUrl && payload?.Result?.RespData) {
          try {
            const respData = JSON.parse(payload.Result.RespData);
            videoUrl = respData.video_url || respData.result_url || respData.url || '';
          } catch {
          }
        }

        return { status: 'succeeded', videoUrl: videoUrl || undefined, progress: progress ?? 100 };
      }

      if (isFailed) {
        return { status: 'failed', progress: progress ?? 0 };
      }

      return { status: isRunning ? 'running' : 'pending', progress: progress ?? 0 };
    } catch (error: any) {
      console.error('Jimeng Check Status Error:', JSON.stringify(error.response?.data || error.message || error, null, 2));
      throw error;
    }
  }
}

export const jimengService = new JimengAiService();
