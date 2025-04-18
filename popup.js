const summaryDiv = document.getElementById('summary');
const copyBtn = document.getElementById('copy-summary');
const modelSelect = document.getElementById('model-select');

// モデル選択の保存・復元
chrome.storage.local.get(['openai_model'], (result) => {
  if (result.openai_model) {
    modelSelect.value = result.openai_model;
  }
});
modelSelect.addEventListener('change', () => {
  chrome.storage.local.set({ openai_model: modelSelect.value });
});

copyBtn.addEventListener('click', () => {
  // プレーンテキストとしてコピー
  const temp = document.createElement('textarea');
  temp.value = summaryDiv.innerText || summaryDiv.textContent;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  copyBtn.textContent = 'コピーしました!';
  setTimeout(() => { copyBtn.textContent = '要約をコピー'; }, 1200);
});

document.getElementById('summarize').addEventListener('click', async () => {
  summaryDiv.textContent = '要約中...';
  copyBtn.style.display = 'none';
  // アクティブタブから本文テキストを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText
  }, async (results) => {
    const text = results && results[0] && results[0].result ? results[0].result : '';
    if (!text || text.length < 20) {
      summaryDiv.textContent = '本文が取得できませんでした';
      return;
    }
    // APIキー取得
    chrome.storage.local.get(['openai_api_key', 'openai_model'], (result) => {
      const apiKey = result.openai_api_key;
      // モデルはセレクタの値を優先
      const model = modelSelect.value || result.openai_model || 'gpt-3.5-turbo';
      if (!apiKey || !apiKey.startsWith('sk-')) {
        summaryDiv.textContent = 'APIキーが未設定です。オプション画面で設定してください。';
        return;
      }
      // background.jsへ要約リクエスト
      console.log('[POPUP] sending summarize request', { textLen: text.length, model });
      chrome.runtime.sendMessage({ type: 'summarize', apiKey, text, model }, (response) => {
        console.log('[POPUP] received response', response);
        if (response && response.success) {
          // 余計な連続改行を整形
          let summaryText = response.summary.replace(/\n{3,}/g, '\n\n');
          // マークダウンならHTMLに変換して表示
          if (window.marked && /[#\-*`>\[\]]|\n/.test(summaryText)) {
            summaryDiv.innerHTML = window.marked.parse(summaryText);
          } else {
            summaryDiv.textContent = summaryText;
          }
          copyBtn.style.display = '';

          // トークン情報とモデル名の表示
          const tokenInfo = document.getElementById('token-info');
          if (response.usage) {
            tokenInfo.innerHTML = `トークン: <b>${response.usage.total_tokens}</b> （プロンプト: ${response.usage.prompt_tokens}, 生成: ${response.usage.completion_tokens}）`;
          } else {
            tokenInfo.innerHTML = `トークン情報なし`;
          }
        } else {
          summaryDiv.textContent = '要約に失敗しました: ' + (response && response.error ? response.error : '不明なエラー');
          copyBtn.style.display = 'none';
        }
      });
    });
  });
});
