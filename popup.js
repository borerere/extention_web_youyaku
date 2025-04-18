const summaryDiv = document.getElementById('summary');
const copyBtn = document.getElementById('copy-summary');
const modelSelect = document.getElementById('model-select');
const excludeBtn = document.getElementById('exclude-domain');
const excludedListDiv = document.getElementById('excluded-domains-list');

// 除外ドメインリストの保存・取得（chrome.storage.localに保存）
async function getExcludedDomains() {
  return new Promise(resolve => {
    chrome.storage.local.get(['excluded_domains'], (result) => {
      resolve(Array.isArray(result.excluded_domains) ? result.excluded_domains : []);
    });
  });
}
async function setExcludedDomains(domains) {
  return new Promise(resolve => {
    chrome.storage.local.set({ excluded_domains: domains }, resolve);
  });
}
async function renderExcludedDomains() {
  const domains = await getExcludedDomains();
  // 現在タブのドメインが除外対象ならボタン非表示
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let domain = '';
  if (tab && tab.url) {
    try { domain = new URL(tab.url).hostname; } catch {}
  }
  if (domain && domains.includes(domain)) {
    excludeBtn.style.display = 'none';
  } else {
    excludeBtn.style.display = '';
  }
  if (domains.length === 0) {
    excludedListDiv.textContent = '';
    return;
  }
  excludedListDiv.innerHTML = '<b>除外ドメイン:</b> ' + domains.map(d => `<span style="margin-right:8px;">${d}</span>`).join('');
}
renderExcludedDomains();

excludeBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  const url = new URL(tab.url);
  const domain = url.hostname;
  let domains = await getExcludedDomains();
  if (!domains.includes(domain)) {
    domains.push(domain);
    await setExcludedDomains(domains);
    renderExcludedDomains();
    // ボタン非表示
    excludeBtn.style.display = 'none';
  } else {
    excludeBtn.textContent = '既に除外済み';
    setTimeout(() => { excludeBtn.textContent = 'このドメインを除外'; }, 1500);
  }
});

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
  // 除外ドメイン判定
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  const url = new URL(tab.url);
  const domain = url.hostname;
  const excluded = await getExcludedDomains();
  if (excluded.includes(domain)) {
    summaryDiv.textContent = `このドメイン（${domain}）は除外設定されています。`;
    copyBtn.style.display = 'none';
    return;
  }
  summaryDiv.textContent = '要約中...';
  copyBtn.style.display = 'none';
  // アクティブタブから本文テキストを取得
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
