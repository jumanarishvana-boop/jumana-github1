const apiKeyInput = document.getElementById('api-key');
const analyzeBtn = document.getElementById('analyze-btn');
const statusDiv = document.getElementById('status');

chrome.storage.local.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    apiKeyInput.value = result.geminiApiKey;
  }
});

analyzeBtn.onclick = async () => {
  statusDiv.textContent = '';
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusDiv.textContent = 'Please enter your Grok API key.';
    statusDiv.style.color = 'red';
    return;
  }
  analyzeBtn.disabled = true;
  statusDiv.textContent = 'Starting analysis...';
  statusDiv.style.color = '#333';
  try {
    await new Promise((resolve) => chrome.storage.local.set({ geminiApiKey: apiKey }, resolve));
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found.');
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_LOADING' });
    const productData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT_DATA' }, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error('Could not scrape product data.'));
        resolve(resp);
      });
    });
    if (!productData || !productData.title) throw new Error('Could not extract product data.');
    statusDiv.textContent = 'Contacting Grok AI...';
    const aiResp = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'ANALYZE_PRODUCT', apiKey, productData }, (resp) => {
        if (!resp || !resp.success) return reject(new Error(resp?.error || 'Grok API error.'));
        resolve(resp.result);
      }); 
    });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scoreData) => {
        const ECO_WIDGET_ID = 'eco-score-widget';
        const old = document.getElementById(ECO_WIDGET_ID);
        if (old) old.remove();

        const score = scoreData.score;
        const circleColor = score >= 75 ? '#2e7d32' : score >= 50 ? '#f57f17' : '#c62828';
        const gradeColor = score >= 75 ? '#e8f5e9' : score >= 50 ? '#fff8e1' : '#ffebee';

        const barColor = (v) => {
          if (v >= 70) return 'linear-gradient(90deg,#66bb6a,#2e7d32)';
          if (v >= 40) return 'linear-gradient(90deg,#ffb74d,#f57f17)';
          return 'linear-gradient(90deg,#ef9a9a,#c62828)';
        };

        const certs = scoreData.certifications_found || scoreData.certifications || [];
        const certHTML = Array.isArray(certs) && certs.length > 0
          ? `<div style="margin-top:10px;padding:10px;background:#f1f8e9;border-radius:8px;border-left:4px solid #7cb342;">
              <b style="color:#33691e;">🏅 Certifications Found:</b>
              <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">
                ${certs.map(c => `<span style="background:#c5e1a5;color:#33691e;padding:3px 10px;border-radius:20px;font-size:0.82em;font-weight:bold;">${c}</span>`).join('')}
              </div>
            </div>`
          : `<div style="margin-top:10px;padding:8px 10px;background:#fff3e0;border-radius:8px;border-left:4px solid #ff9800;font-size:0.85em;color:#e65100;">⚠️ No certifications found</div>`;

        const widget = document.createElement('div');
        widget.id = ECO_WIDGET_ID;
        widget.style.cssText = 'position:fixed!important;bottom:24px!important;right:24px!important;z-index:2147483647!important;width:350px!important;background:#f9fbe7!important;border:2px solid #4caf50!important;border-radius:14px!important;box-shadow:0 6px 28px rgba(46,125,50,0.25)!important;font-family:Arial,sans-serif!important;color:#222!important;max-height:90vh!important;overflow-y:auto!important;';

        widget.innerHTML = `
          <div style="background:linear-gradient(135deg,#2e7d32,#66bb6a);color:#fff;padding:14px 16px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:1em;font-weight:bold;">🌿 Eco-Score Analysis</span>
            <button onclick="this.closest('#eco-score-widget').remove()" style="background:none;border:none;color:#fff;font-size:1.4em;cursor:pointer;line-height:1;">×</button>
          </div>
          <div style="padding:16px;">
            <div style="display:flex;justify-content:center;margin-bottom:14px;">
              <div style="width:100px;height:100px;border-radius:50%;background:${circleColor};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);">
                <span style="font-size:2em;font-weight:bold;color:#fff;">${score}</span>
                <span style="font-size:1em;color:#fff;font-weight:bold;">${scoreData.grade}</span>
              </div>
            </div>
            <div style="margin-bottom:14px;color:#444;font-size:0.88em;text-align:center;line-height:1.6;background:${gradeColor};padding:10px;border-radius:8px;">${scoreData.summary.split('.')[0]}.</div>
            <div style="margin-bottom:6px;">
              ${Object.entries(scoreData.breakdown).map(([k,v]) => `
                <div style="display:flex;align-items:center;margin-bottom:8px;">
                  <span style="width:115px;color:#2e7d32;font-size:0.85em;font-weight:bold;">${k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
                  <div style="flex:1;background:#dcedc8;border-radius:6px;height:12px;margin:0 8px;overflow:hidden;">
                    <div style="width:${v}%;height:100%;background:${barColor(v)};border-radius:6px;"></div>
                  </div>
                  <span style="font-size:0.85em;font-weight:bold;color:#333;">${v}</span>
                </div>
              `).join('')}
            </div>
            ${certHTML}
            ${scoreData.greenwash ? `<div style="background:#fff9c4;color:#f57f17;border-left:5px solid #ffd600;padding:10px;margin-top:10px;border-radius:6px;font-size:0.87em;">⚠️ <b>Greenwashing:</b> ${scoreData.greenwash_reason}</div>` : ''}
            <div style="background:#e8f5e9;border-radius:8px;padding:10px;margin-top:10px;border-left:4px solid #4caf50;">
              <b style="color:#2e7d32;">💡 Tips:</b>
              <ul style="margin:6px 0 0 16px;padding:0;font-size:0.87em;color:#333;">${scoreData.tips.map(t=>`<li style="margin-bottom:4px;">${t}</li>`).join('')}</ul>
            </div>
          </div>
        `;
        document.body.appendChild(widget);
      },
      args: [aiResp]
    });
    statusDiv.textContent = 'Eco-Score displayed!';
    statusDiv.style.color = '#388e3c';
    const ecoScoreDiv = document.getElementById('eco-score-value');
    if (aiResp && aiResp.score !== undefined) {
      ecoScoreDiv.textContent = 'Eco-Score: ' + aiResp.score;
      ecoScoreDiv.style.color = '#388e3c';
    } else {
      ecoScoreDiv.textContent = 'Eco-Score unavailable.';
      ecoScoreDiv.style.color = 'red';
    }
  } catch (err) {
    statusDiv.textContent = err.message;
    statusDiv.style.color = 'red';
  } finally {
    analyzeBtn.disabled = false;
  }
};