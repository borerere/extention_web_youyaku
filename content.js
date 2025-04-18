// ページ最上部に「要約」ボタンを表示＋拡張機能
(function() {
  if (window.__youyaku_btn_injected) return;
  window.__youyaku_btn_injected = true;

  // 2つの要約ボタンを作成
  const btnSimple = document.createElement('button');
  btnSimple.textContent = '3行の簡単要約';
  btnSimple.id = '__youyaku_btn_simple';
  Object.assign(btnSimple.style, {
    position: 'fixed', top: '12px', left: 'calc(50% - 92px)', zIndex: 99999,
    padding: '10px 18px', fontSize: '1.05em', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginRight: '8px'
  });
  const btnMd = document.createElement('button');
  btnMd.textContent = 'マークダウン構造化要約';
  btnMd.id = '__youyaku_btn_md';
  Object.assign(btnMd.style, {
    position: 'fixed', top: '12px', left: 'calc(50% + 92px)', zIndex: 99999,
    padding: '10px 18px', fontSize: '1.05em', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  });
  document.body.appendChild(btnSimple);
  document.body.appendChild(btnMd);

  // 結果表示用のオーバーレイ
  const overlay = document.createElement('div');
  overlay.id = '__youyaku_result';
  Object.assign(overlay.style, {
    position: 'fixed', top: '56px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
    minWidth: '320px', maxWidth: 'min(90vw, 600px)', background: '#fff', color: '#222', border: '1px solid #1976d2', borderRadius: '8px', padding: '18px 44px 18px 18px', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', display: 'none', whiteSpace: 'pre-wrap', fontSize: '1em', lineHeight: '1.6', cursor: 'move',
    overflowY: 'scroll',
    overflowX: 'auto',
    maxHeight: '60vh',
    minHeight: '60px',
    boxSizing: 'border-box'
  });
  // Chrome用カスタムスクロールバー
  const style = document.createElement('style');
  style.textContent = `
    #__youyaku_result::-webkit-scrollbar {
      width: 10px;
      background: #f9f9f9;
    }
    #__youyaku_result::-webkit-scrollbar-thumb {
      background: #bbb;
      border-radius: 4px;
      min-height: 20px;
    }
    #__youyaku_result::-webkit-scrollbar-track {
      background: #f9f9f9;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);
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

  // marked.js（CDN）を読み込む（初回のみ）
  let markedLoaded = false;
  function ensureMarkedJs() {
    return Promise.resolve();
  }

  // 共通要約実行関数
  async function runYouyaku(mode) {
    overlay.style.display = 'block';
    overlay.textContent = '要約中...';
    overlay.appendChild(closeBtn); // 再追加（textContentで消えないように）
    // 選択範囲優先
    let text = '';
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 20) {
      text = selection.toString();
    } else if (/^https:\/\/(www\.)?youtube\.com\//.test(window.location.href)) {
      // YouTubeページなら字幕取得
      text = await window.getYoutubeTranscriptText();
      if (!text || text.length < 20) {
        overlay.textContent = '字幕（文字起こし）が取得できませんでした。動画に字幕があるか、YouTubeのUIが対応しているかご確認ください。';
        overlay.appendChild(closeBtn);
        return;
      }
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
      chrome.runtime.sendMessage({ type: 'summarize', apiKey, text, model, mode }, async (response) => {
        if (response && response.success) {
          if (mode === 'markdown') {
            await ensureMarkedJs();
            overlay.innerHTML = '';
            overlay.appendChild(closeBtn);
            // Convert markdown to HTML and style
            const html = window.marked ? window.marked.parse(response.summary) : response.summary;
            const mdDiv = document.createElement('div');
            mdDiv.innerHTML = html;
            mdDiv.style.fontSize = '1.15em';
            mdDiv.style.lineHeight = '1.7';
            mdDiv.style.marginTop = '10px';
            mdDiv.style.wordBreak = 'break-word';
            mdDiv.querySelectorAll('h1,h2,h3').forEach(h => { h.style.color = '#1976d2'; h.style.margin = '12px 0 4px 0'; });
            mdDiv.querySelectorAll('ul,ol').forEach(l => { l.style.marginLeft = '1.5em'; });
            overlay.appendChild(mdDiv);
            // トークン情報表示
            const tokenDiv = document.createElement('div');
            tokenDiv.style.fontSize = '0.95em';
            tokenDiv.style.color = '#666';
            tokenDiv.style.marginTop = '8px';
            if (response.usage) {
              tokenDiv.innerHTML = `モデル: <b>${response.model}</b>　/　トークン: <b>${response.usage.total_tokens}</b> （プロンプト: ${response.usage.prompt_tokens}, 生成: ${response.usage.completion_tokens}）`;
            } else {
              tokenDiv.innerHTML = `モデル: <b>${response.model || ''}</b>　/　トークン情報なし`;
            }
            overlay.appendChild(tokenDiv);
          } else {
            overlay.textContent = response.summary;
            overlay.appendChild(closeBtn);
            // トークン情報表示
            const tokenDiv = document.createElement('div');
            tokenDiv.style.fontSize = '0.95em';
            tokenDiv.style.color = '#666';
            tokenDiv.style.marginTop = '8px';
            if (response.usage) {
              tokenDiv.innerHTML = `モデル: <b>${response.model}</b>　/　トークン: <b>${response.usage.total_tokens}</b> （プロンプト: ${response.usage.prompt_tokens}, 生成: ${response.usage.completion_tokens}）`;
            } else {
              tokenDiv.innerHTML = `モデル: <b>${response.model || ''}</b>　/　トークン情報なし`;
            }
            overlay.appendChild(tokenDiv);
          }
        } else {
          overlay.textContent = '要約に失敗しました: ' + (response && response.error ? response.error : '不明なエラー');
          overlay.appendChild(closeBtn);
        }
      });
    });
  }

  // ボタンイベント
  btnSimple.addEventListener('click', () => runYouyaku('simple'));
  btnMd.addEventListener('click', () => runYouyaku('markdown'));

})();
