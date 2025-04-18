const apikeyInput = document.getElementById('apikey');
const modelSelect = document.getElementById('model');
const statusDiv = document.getElementById('status');

// ショートカット設定ページを開く
const shortcutBtn = document.getElementById('open-shortcut-settings');
if (shortcutBtn) {
  shortcutBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

// 保存されているAPIキー・モデルを表示
chrome.storage.local.get(['openai_api_key', 'openai_model'], (result) => {
  if(result.openai_api_key) {
    apikeyInput.value = result.openai_api_key;
  }
  if(result.openai_model) {
    modelSelect.value = result.openai_model;
  }
});

document.getElementById('save').addEventListener('click', () => {
  const key = apikeyInput.value.trim();
  const model = modelSelect.value;
  chrome.storage.local.set({ openai_api_key: key, openai_model: model }, () => {
    statusDiv.textContent = '保存しました';
    setTimeout(() => statusDiv.textContent = '', 1500);
  });
});
