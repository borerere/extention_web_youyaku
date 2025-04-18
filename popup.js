document.getElementById('summarize').addEventListener('click', async () => {
  const summaryDiv = document.getElementById('summary');
  summaryDiv.textContent = '要約中...';
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
      const model = result.openai_model || 'gpt-3.5-turbo';
      if (!apiKey || !apiKey.startsWith('sk-')) {
        summaryDiv.textContent = 'APIキーが未設定です。オプション画面で設定してください。';
        return;
      }
      // background.jsへ要約リクエスト
      console.log('[POPUP] sending summarize request', { textLen: text.length, model });
      chrome.runtime.sendMessage({ type: 'summarize', apiKey, text, model }, (response) => {
        console.log('[POPUP] received response', response);
        if (response && response.success) {
          summaryDiv.textContent = response.summary;
        } else {
          summaryDiv.textContent = '要約に失敗しました: ' + (response && response.error ? response.error : '不明なエラー');
        }
      });
    });
  });
});
