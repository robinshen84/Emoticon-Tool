const MENU_ID = 'emoticon-tool-generate-motion';
const STORE_KEY = 'imageStoreV1';
const TOOL_PAGE = 'https://robinshen84.github.io/Emoticon-Tool/';
const ICON_URL = 'https://robinshen84.github.io/Emoticon-Tool/logo.png';

const storageArea = (chrome.storage && chrome.storage.session) ? chrome.storage.session : chrome.storage.local;

const storageGet = (key) => new Promise((resolve) => {
  try {
    storageArea.get(key, (items) => resolve(items || {}));
  } catch {
    resolve({});
  }
});

const storageSet = (items) => new Promise((resolve) => {
  try {
    storageArea.set(items, () => resolve());
  } catch {
    resolve();
  }
});

const createToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const blobToDataUrl = async (blob) => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const type = blob.type || 'application/octet-stream';
  return `data:${type};base64,${base64}`;
};

const cleanupStore = async () => {
  const now = Date.now();
  const { [STORE_KEY]: store } = await storageGet(STORE_KEY);
  if (!store || typeof store !== 'object') return;
  const next = {};
  for (const [k, v] of Object.entries(store)) {
    if (!v || typeof v !== 'object') continue;
    const createdAt = typeof v.createdAt === 'number' ? v.createdAt : 0;
    if (now - createdAt < 10 * 60 * 1000) next[k] = v;
  }
  await storageSet({ [STORE_KEY]: next });
};

const setToolbarIconFromRemote = async () => {
  try {
    const res = await fetch(ICON_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const sizes = [16, 32, 48, 128];
    const imageData = {};
    for (const size of sizes) {
      if (typeof OffscreenCanvas === 'undefined') return;
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, size, size);
      const scale = Math.min(size / bitmap.width, size / bitmap.height);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const x = Math.round((size - w) / 2);
      const y = Math.round((size - h) / 2);
      ctx.drawImage(bitmap, x, y, w, h);
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }
    chrome.action.setIcon({ imageData }, () => {});
  } catch {
    return;
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: '用 Emoticon-Tool 生成动图',
        contexts: ['image'],
      },
      () => {}
    );
  });
  setToolbarIconFromRemote();
});

chrome.runtime.onStartup?.addListener(() => {
  setToolbarIconFromRemote();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const srcUrl = typeof info.srcUrl === 'string' ? info.srcUrl : '';
  if (!srcUrl) return;

  const token = createToken();
  let record = { createdAt: Date.now() };

  try {
    await cleanupStore();
    const res = await fetch(srcUrl, { credentials: 'include' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    record = { ...record, dataUrl };
  } catch (e) {
    record = { ...record, error: '图片抓取失败：可能需要登录/防盗链/被站点限制。' };
  }

  const { [STORE_KEY]: store } = await storageGet(STORE_KEY);
  const next = store && typeof store === 'object' ? store : {};
  next[token] = record;
  await storageSet({ [STORE_KEY]: next });

  const target = `${TOOL_PAGE}?ai_motion_token=${encodeURIComponent(token)}`;
  chrome.tabs.create({ url: target });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message && typeof message === 'object' ? message.type : '';
  if (type !== 'GET_IMAGE_DATA') return;
  const token = message && typeof message === 'object' ? message.token : '';
  if (typeof token !== 'string' || !token) {
    sendResponse({ ok: false, error: 'missing token' });
    return true;
  }

  (async () => {
    const { [STORE_KEY]: store } = await storageGet(STORE_KEY);
    if (!store || typeof store !== 'object' || !store[token]) {
      sendResponse({ ok: false, error: 'not found' });
      return;
    }
    const record = store[token];
    const next = { ...store };
    delete next[token];
    await storageSet({ [STORE_KEY]: next });

    const dataUrl = record && typeof record === 'object' ? record.dataUrl : null;
    const error = record && typeof record === 'object' ? record.error : null;
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      sendResponse({ ok: true, dataUrl });
      return;
    }
    sendResponse({ ok: false, error: typeof error === 'string' ? error : 'unknown error' });
  })();

  return true;
});

setToolbarIconFromRemote();
