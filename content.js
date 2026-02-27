const ECO_WIDGET_ID = 'eco-score-widget';

function createLoadingWidget() {
  removeEcoWidget();
  const widget = document.createElement('div');
  widget.id = ECO_WIDGET_ID;
  widget.innerHTML = `
    <div class="eco-score-header">
      <span>Eco-Score Analysis</span>
      <button class="eco-score-close">×</button>
    </div>
    <div class="eco-score-body">
      <div class="eco-score-spinner"></div>
      <div>Analyzing product sustainability...</div>
    </div>
  `;
  document.body.appendChild(widget);
  widget.querySelector('.eco-score-close').onclick = removeEcoWidget;
}

function createScoreWidget(data) {
  removeEcoWidget();
  const widget = document.createElement('div');
  widget.id = ECO_WIDGET_ID;
  widget.innerHTML = `
    <div class="eco-score-header">
      <span>🌿 Eco-Score: <b>${data.score} (${data.grade})</b></span>
      <button class="eco-score-close">×</button>
    </div>
    <div class="eco-score-body">
      <div class="eco-score-summary">${data.summary}</div>
      <div class="eco-score-breakdown">
        ${Object.entries(data.breakdown).map(([k, v]) => `
          <div class="eco-score-breakdown-row">
            <span>${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            <div class="eco-score-bar-bg"><div class="eco-score-bar" style="width:${v}%"></div></div>
            <span>${v}</span>
          </div>
        `).join('')}
      </div>
      ${data.greenwash ? `<div class="eco-score-greenwash">⚠️ <b>Greenwashing Warning:</b> ${data.greenwash_reason}</div>` : ''}
      <div class="eco-score-tips">
        <b>💡 Tips:</b>
        <ul>${data.tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
      </div>
    </div>
  `;
  document.body.appendChild(widget);
  widget.querySelector('.eco-score-close').onclick = removeEcoWidget;
}

function removeEcoWidget() {
  const el = document.getElementById(ECO_WIDGET_ID);
  if (el) el.remove();
}

function scrapeAmazon() {
  const title = document.getElementById('productTitle')?.innerText.trim() || '';
  const brand = document.querySelector('#bylineInfo')?.innerText.trim() || '';
  const category = Array.from(document.querySelectorAll('#wayfinding-breadcrumbs_container ul.a-unordered-list a')).map(a => a.innerText.trim()).join(' > ') || '';
  const description = document.getElementById('productDescription')?.innerText.trim() || document.querySelector('#feature-bullets')?.innerText.trim() || '';
  const specTable = document.getElementById('productDetails_techSpec_section_1') || document.getElementById('productDetails_detailBullets_sections1');
  const specifications = specTable ? specTable.innerText.trim() : '';
  const material = Array.from(document.querySelectorAll('tr th, tr td')).find(el => /material/i.test(el.innerText))?.nextElementSibling?.innerText.trim() || '';
  return { title, brand, category, description, specifications, material };
}

function scrapeFlipkart() {
  const title = document.querySelector('span.VU-ZEz, h1.yhB1nd, ._9E25nV, span._35KyD6')?.innerText.trim() ||
    document.querySelector('h1')?.innerText.trim() || '';
  const brand = document.querySelector('span.mEh187, a.cnfYTp, ._2whKao')?.innerText.trim() || '';
  const category = Array.from(document.querySelectorAll('a.R0cyWM, a._2whKao, nav a'))
    .map(a => a.innerText.trim()).filter(t => t).join(' > ') || '';
  const description = document.querySelector('div._1mXcCf, div.yN+eNr, div._4gvKMe, div.RmoJbe')?.innerText.trim() ||
    document.querySelector('div[class*="description"], div[class*="Description"]')?.innerText.trim() || '';
  const specTable = document.querySelector('table._14cfVK, div._3k-BhJ, div[class*="specifi"]');
  const specifications = specTable ? specTable.innerText.trim() : '';
  const material = Array.from(document.querySelectorAll('td, li, div'))
    .find(el => /material/i.test(el.innerText) && el.innerText.length < 50)
    ?.nextElementSibling?.innerText.trim() || '';
  return { title, brand, category, description, specifications, material };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PRODUCT_DATA') {
    let data = {};
    if (location.hostname.includes('amazon.')) {
      data = scrapeAmazon();
    } else if (location.hostname.includes('flipkart.')) {
      data = scrapeFlipkart();
    }
    sendResponse(data);
  } else if (request.type === 'SHOW_LOADING') {
    createLoadingWidget();
    sendResponse({ success: true });
  } else if (request.type === 'SHOW_ECO_SCORE') {
    createScoreWidget(request.data);
    sendResponse({ success: true });
  }
  return true;
});