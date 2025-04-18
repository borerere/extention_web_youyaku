// YouTube字幕（文字起こし）抽出用ユーティリティ
// ページ内から字幕テキスト全文を取得する
async function getYoutubeTranscriptText() {
  console.log('[YT Transcript] START getYoutubeTranscriptText');
  // 1. transcriptパネルが既に開いている場合はそのまま取得
  let transcriptPanel = document.querySelector('ytd-transcript-renderer');
  if (transcriptPanel) console.log('[YT Transcript] transcriptPanel already open');
  if (!transcriptPanel) {
    // 2. 「...」メニューをクリックして「文字起こしを表示」を探す
    const moreBtn = document.querySelector('tp-yt-paper-button#expand, ytd-button-renderer[button-renderer="MORE"] button, ytd-menu-renderer ytd-menu-service-item-renderer');
    if (moreBtn) {
      console.log('[YT Transcript] Found moreBtn, clicking');
      moreBtn.click();
    } else {
      console.log('[YT Transcript] moreBtn NOT found');
    }
    // メニューが開くのを待つ
    await new Promise(r => setTimeout(r, 300));
    // 3. 「文字起こしを表示」項目を探してクリック（より確実に）
    let items = [];
    for (let i = 0; i < 10; ++i) {
      await new Promise(r => setTimeout(r, 200));
      items = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer'));
      if (items.length > 0) {
        console.log(`[YT Transcript] Menu items appeared after ${i+1} tries`);
        break;
      }
    }
    const transcriptItem = items.find(el =>
      (el.innerText && (el.innerText.includes('文字起こし') || el.innerText.includes('Transcript')))
      || (el.getAttribute('aria-label') && el.getAttribute('aria-label').includes('文字起こし'))
      || (el.getAttribute('title') && el.getAttribute('title').includes('文字起こし'))
    );
    if (transcriptItem) {
      console.log('[YT Transcript] transcriptItem found, clicking');
    } else {
      console.log('[YT Transcript] transcriptItem NOT found, will try fallback');
    }
    if (transcriptItem) {
      transcriptItem.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
      console.log('[YT Transcript] Clicked transcriptItem');
      // パネルが出るまで待つ
      for (let i = 0; i < 10; ++i) {
        await new Promise(r => setTimeout(r, 300));
        transcriptPanel = document.querySelector('ytd-transcript-renderer');
        if (transcriptPanel) {
          console.log(`[YT Transcript] transcriptPanel appeared after clicking transcriptItem (${i+1} tries)`);
          break;
        }
      }
    } else {
      // try to find and click <button> with aria-label or innerText including '文字起こし'
      const transcriptBtn = Array.from(document.querySelectorAll('button')).find(btn =>
        (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').includes('文字起こし')) ||
        (btn.innerText && btn.innerText.includes('文字起こし'))
      );
      if (transcriptBtn) {
        console.log('[YT Transcript] Found <button> with aria-label or innerText 文字起こし, clicking:', transcriptBtn);
        transcriptBtn.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
        // パネルが出るまで待つ
        for (let i = 0; i < 10; ++i) {
          await new Promise(r => setTimeout(r, 300));
          transcriptPanel = document.querySelector('ytd-transcript-renderer');
          if (transcriptPanel) {
            console.log(`[YT Transcript] transcriptPanel appeared after clicking <button> 文字起こし (${i+1} tries)`);
            break;
          }
        }
      } else {
        // fallback: try clicking the touch feedback shape (for some menu UIs)
        const fallbackBtn = document.querySelector('.yt-spec-touch-feedback-shape--touch-response .yt-spec-touch-feedback-shape__fill');
        if (fallbackBtn) {
          fallbackBtn.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
          console.log('[YT Transcript] Fallback: clicked .yt-spec-touch-feedback-shape__fill');
          // パネルが出るまで待つ
          for (let i = 0; i < 10; ++i) {
            await new Promise(r => setTimeout(r, 300));
            transcriptPanel = document.querySelector('ytd-transcript-renderer');
            if (transcriptPanel) {
              console.log(`[YT Transcript] transcriptPanel appeared after fallbackBtn (${i+1} tries)`);
              break;
            }
          }
        } else {
          console.log('[YT Transcript] Fallback: .yt-spec-touch-feedback-shape__fill NOT found');
        }
      }
    }
  }
  if (transcriptPanel) {
    console.log('[YT Transcript] transcriptPanel found, extracting lines');
    let segments = [];
    for (let i = 0; i < 10; ++i) {
      segments = Array.from(transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer'));
      if (segments.length > 0) {
        console.log(`[YT Transcript] Found ${segments.length} ytd-transcript-segment-renderer (after wait ${i} tries)`);
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    if (segments.length > 0) {
      const texts = segments.map(seg => {
        const textSpan = seg.querySelector('.segment-text');
        if (textSpan) return textSpan.textContent.trim();
        // fallback: 2番目のspan
        const spans = seg.querySelectorAll('span');
        return spans.length > 1 ? spans[1].textContent.trim() : seg.innerText.trim();
      });
      console.log(`[YT Transcript] Extracted ${texts.length} lines from segment-text`);
      return texts.join('\n');
    } else {
      console.log('[YT Transcript] transcriptPanel found but no segments after waiting. transcriptPanel.innerText:', transcriptPanel.innerText);
    }
  }
  // 旧UI: transcript-body/segment
  const oldPanel = document.querySelector('.transcript-body');
  if (oldPanel) {
    console.log('[YT Transcript] oldPanel found, extracting lines');
    const lines = Array.from(oldPanel.querySelectorAll('.segment-text'));
    if (lines.length) {
      console.log(`[YT Transcript] Extracted ${lines.length} lines from oldPanel`);
      return lines.map(span => span.textContent.trim()).join('\n');
    } else {
      console.log('[YT Transcript] oldPanel found but no lines');
    }
  }
  // 見つからない場合
  console.log('[YT Transcript] Transcript NOT found, returning empty string');
  return '';
}

// windowにグローバル公開
window.getYoutubeTranscriptText = getYoutubeTranscriptText;


// windowにグローバル公開
window.getYoutubeTranscriptText = getYoutubeTranscriptText;
