// ページ最上部に「要約」ボタンを表示＋拡張機能
(function() {
  if (window.__youyaku_btn_injected) return;
  window.__youyaku_btn_injected = true;

  // ボタン作成
  const btn = document.createElement('button');
  btn.textContent = '要約';
  btn.id = '__youyaku_btn';
  Object.assign(btn.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
    padding: '10px 24px', fontSize: '1.1em', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  });
  document.body.appendChild(btn);

  // 結果表示用のオーバーレイ
  const overlay = document.createElement('div');
  overlay.id = '__youyaku_result';
  Object.assign(overlay.style, {
    position: 'fixed', top: '56px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
    minWidth: '320px', maxWidth: 'min(90vw, 600px)', background: '#fff', color: '#222', border: '1px solid #1976d2', borderRadius: '8px', padding: '18px 44px 18px 18px', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', display: 'none', whiteSpace: 'pre-wrap', fontSize: '1em', lineHeight: '1.6', cursor: 'move'
  });
  document.body.appendChild(overlay);

  // 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    position: 'absolute', top: '8px', right: '12px', background: 'transparent', color: '#1976d2', border: 'none', fontSize: '1.3em', cursor: 'pointer', fontWeight: 'bold'
  });
  overlay.appendChild(closeBtn);
  closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });

  // ドラッグ移動機能
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  overlay.addEventListener('mousedown', function(e) {
    if (e.target !== overlay) return; // 枠のみドラッグ可
    isDragging = true;
    dragOffsetX = e.clientX - overlay.getBoundingClientRect().left;
    dragOffsetY = e.clientY - overlay.getBoundingClientRect().top;
    overlay.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    overlay.style.left = (e.clientX - dragOffsetX + overlay.offsetWidth/2) + 'px';
    overlay.style.top = (e.clientY - dragOffsetY) + 'px';
    overlay.style.transform = 'translateX(-50%)';
  });
  window.addEventListener('mouseup', function() {
    isDragging = false;
    overlay.style.cursor = 'move';
  });

  btn.addEventListener('click', async () => {
    overlay.style.display = 'block';
    overlay.textContent = '要約中...';
    overlay.appendChild(closeBtn); // 再追加（textContentで消えないように）
    // 選択範囲優先
    let text = '';
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 20) {
      text = selection.toString();
    } else {
      // 本文抽出（main/article/コンテンツ系セレクタ優先）
      const selectors = [
        'article',
        'main',
        '#content, .content, .main-content, .article, .post, #main, .entry-content'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.length > 200) {
          text = el.innerText;
          break;
        }
      }
      if (!text) text = document.body.innerText;
    }
    if (!text || text.length < 20) {
      overlay.textContent = '本文が取得できませんでした';
      overlay.appendChild(closeBtn);
      return;
    }
    // APIキー・モデル取得
    chrome.storage.local.get(['openai_api_key', 'openai_model'], (result) => {
      const apiKey = result.openai_api_key;
      const model = result.openai_model || 'gpt-3.5-turbo';
      if (!apiKey || !apiKey.startsWith('sk-')) {
        overlay.textContent = 'APIキーが未設定です。オプション画面で設定してください。';
        overlay.appendChild(closeBtn);
        return;
      }
      // background.jsへ要約リクエスト
      chrome.runtime.sendMessage({ type: 'summarize', apiKey, text, model }, (response) => {
        if (response && response.success) {
          overlay.textContent = response.summary;
        } else {
          overlay.textContent = '要約に失敗しました: ' + (response && response.error ? response.error : '不明なエラー');
        }
        overlay.appendChild(closeBtn);
      });
    });
  });
})();
