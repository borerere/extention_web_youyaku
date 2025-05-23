// コマンド（ショートカット）で要約（再実装）
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[COMMAND] onCommand fired:', command);

  if (command === 'summarize_page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    // アクティブタブから本文取得
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 本文抽出の改良: main/article/コンテンツ系セレクタ優先
        const selectors = [
          'article',
          'main',
          '#content, .content, .main-content, .article, .post, #main, .entry-content'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText && el.innerText.length > 200) {
            return el.innerText;
          }
        }
        return document.body.innerText;
      }
    }, async (results) => {
      const text = results && results[0] && results[0].result ? results[0].result : '';
      if (!text || text.length < 20) {
        chrome.notifications.create({
          type: 'basic', iconUrl: 'icon128.png', title: '要約失敗', message: '本文が取得できませんでした'
        });
        return;
      }
      // APIキーとモデル取得
      chrome.storage.local.get(['openai_api_key', 'openai_model'], async (result) => {
        const apiKey = result.openai_api_key;
        const model = result.openai_model || 'gpt-3.5-turbo';
        if (!apiKey || !apiKey.startsWith('sk-')) {
          chrome.notifications.create({
            type: 'basic', iconUrl: 'icon128.png', title: '要約失敗', message: 'APIキー未設定（オプション画面で設定）'
          });
          return;
        }
        // 要約API呼び出し
        let prompt = '';
        if (message.mode === 'markdown') {
          prompt = `次の文章を日本語でマークダウン形式で構造化要約してください。見出し・箇条書き・表などを活用し、重要な点を分かりやすくまとめてください。\n\n${text.slice(0, 3000)}`;
        } else {
          prompt = `次の文章を日本語で3文程度に要約してください。\n\n${text.slice(0, 3000)}`;
        }
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'あなたは優秀な日本語要約AIです。' },
                { role: 'user', content: prompt }
              ],
              max_tokens: 1024,
              temperature: 0.5
            })
          });
          let data = null;
          try { data = await res.clone().json(); } catch {}
          let summary = '要約失敗';
          if (res.ok && data && data.choices && data.choices[0] && data.choices[0].message.content) {
            summary = data.choices[0].message.content.trim();
          } else if (data && data.error && data.error.message) {
            summary = 'APIエラー: ' + data.error.message;
          }
          chrome.notifications.create({
            type: 'basic', iconUrl: 'icon128.png', title: 'ページ要約', message: summary.slice(0, 400)
          });
        } catch (e) {
          chrome.notifications.create({
            type: 'basic', iconUrl: 'icon128.png', title: '要約失敗', message: e.message
          });
        }
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'followup') {
    (async () => {
      try {
        const { apiKey, model, summary, question, history } = message;
        const useModel = model || 'gpt-3.5-turbo';
        // 会話履歴を展開
        let messages = [
          { role: 'system', content: 'あなたは優秀な日本語要約AIです。' },
          { role: 'user', content: `以下は要約結果です。\n${summary}` }
        ];
        if (Array.isArray(history)) {
          for (const h of history) {
            if (h.role && h.content) messages.push(h);
          }
        }
        messages.push({ role: 'user', content: `この要約について: ${question}（日本語で答えてください）` });
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: useModel,
            messages,
            max_tokens: 1024,
            temperature: 0.5
          })
        });
        let data = null;
        try { data = await res.clone().json(); } catch {}
        if (!res.ok || !data || !data.choices || !data.choices[0] || !data.choices[0].message.content) {
          sendResponse({ success: false, error: 'APIエラー' });
          return;
        }
        sendResponse({ success: true, answer: data.choices[0].message.content.trim(), isMarkdown: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'summarize') {
    const { apiKey, text, model } = message;
    const useModel = model || 'gpt-3.5-turbo';
    console.log('[BG] summarize request', { apiKey: apiKey ? apiKey.slice(0,8)+'...' : 'none', textLen: text.length, model: useModel });
    (async () => {
      let prompt = '';
      if (message.mode === 'markdown') {
        prompt = `次の文章を日本語でマークダウン形式で構造化要約してください。見出し・箇条書き・表などを活用し、重要な点を分かりやすくまとめてください。\n\n${text.slice(0, 3000)}`;
      } else {
        prompt = `次の文章を日本語で3文程度に要約してください。\n\n${text.slice(0, 3000)}`;
      }
      try {
        console.log('[BG] OpenAI API fetch start', { promptLen: prompt.length });
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: useModel,
            messages: [
              { role: 'system', content: 'あなたは優秀な日本語要約AIです。' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1024,
            temperature: 0.5
          })
        });
        console.log('[BG] OpenAI API response status', res.status);
        let data = null;
        try {
          data = await res.clone().json();
        } catch (jsonErr) {
          console.error('[BG] OpenAI API JSON parse error', jsonErr);
        }
        if (!res.ok) {
          console.error('[BG] OpenAI API error', { status: res.status, statusText: res.statusText, data });
          throw new Error('APIエラー: ' + res.status + ' ' + res.statusText + (data && data.error ? ' - ' + data.error.message : ''));
        }
        const summary = data && data.choices && data.choices[0] && data.choices[0].message.content ? data.choices[0].message.content.trim() : '要約失敗';
        const usage = data && data.usage ? data.usage : null;
        console.log('[BG] summary result', summary, usage);
        sendResponse({ success: true, summary, usage, model: useModel });
      } catch (e) {
        console.error('[BG] summarize error', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // async response
  }
});
