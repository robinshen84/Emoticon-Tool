(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('ai_motion_token');
  if (!token) return;

  const respond = (payload) => {
    window.postMessage(
      {
        source: 'emoticon-tool-ext',
        ...payload,
      },
      '*'
    );
  };

  try {
    chrome.runtime.sendMessage({ type: 'GET_IMAGE_DATA', token }, (res) => {
      if (!res || res.ok !== true || typeof res.dataUrl !== 'string') {
        respond({
          type: 'AI_MOTION_IMPORT_ERROR',
          error: (res && typeof res.error === 'string' && res.error) ? res.error : '图片抓取失败',
        });
        return;
      }

      respond({ type: 'AI_MOTION_IMPORT_DATA_URL', dataUrl: res.dataUrl });

      try {
        const next = new URL(location.href);
        next.searchParams.delete('ai_motion_token');
        history.replaceState(null, '', next.toString());
      } catch {
        return;
      }
    });
  } catch {
    respond({ type: 'AI_MOTION_IMPORT_ERROR', error: '扩展通讯失败' });
  }
})();

