let analysisData = null;
let takeHome = 0;
let debtsData = [];

// ── STEP 1 ──
document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('upload-status').innerHTML = '<span style="color:#12AAED">Reading your salary slip...</span>';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/ocr', { method: 'POST', body: formData });
    const json = await res.json();

    if (json.success && json.data.take_home) {
      takeHome = json.data.take_home;
      document.getElementById('take-home-display').textContent = `₹${takeHome.toLocaleString('en-IN')}`;
      document.getElementById('take-home-input').value = takeHome;
      document.getElementById('salary-result').classList.remove('hidden');
      document.getElementById('step1-next').classList.remove('hidden');
      document.getElementById('skip-ocr').classList.add('hidden');
      document.getElementById('upload-status').innerHTML = '<span style="color:#10b981">✓ Detected successfully</span>';
    } else {
      document.getElementById('upload-status').innerHTML = '<span style="color:orange">Could not auto-detect. Enter manually.</span>';
      showManualEntry();
    }
  } catch {
    document.getElementById('upload-status').innerHTML = '<span style="color:red">Error reading file.</span>';
    showManualEntry();
  }
});

function showManualEntry() {
  document.getElementById('manual-entry').classList.remove('hidden');
  document.getElementById('step1-next').classList.remove('hidden');
  document.getElementById('skip-ocr').classList.add('hidden');
}

function goToStep2() {
  const fromOCR = parseFloat(document.getElementById('take-home-input').value);
  const fromManual = parseFloat(document.getElementById('take-home-manual')?.value);
  takeHome = fromOCR || fromManual || 0;

  if (!takeHome) { alert('Please enter your take-home salary.'); return; }

  document.getElementById('step-1').classList.add('hidden');
  document.getElementById('step-2').classList.remove('hidden');
  if (document.querySelectorAll('.debt-row').length === 0) addDebtRow();
}

// ── STEP 2 ──
function addDebtRow() {
  const list = document.getElementById('debts-list');
  const row = document.createElement('div');
  row.className = 'debt-row';
  row.innerHTML = `
    <input type="text" placeholder="e.g. HDFC Credit Card"/>
    <input type="number" placeholder="e.g. 80000"/>
    <input type="number" placeholder="e.g. 18"/>
    <input type="number" placeholder="e.g. 3500"/>
    <button class="remove-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

async function runAnalysis() {
  const rows = document.querySelectorAll('.debt-row');
  debtsData = [];

  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0].value.trim();
    const total = parseFloat(inputs[1].value);
    const rate = parseFloat(inputs[2].value);
    const emi = parseFloat(inputs[3].value);
    if (name && total && rate && emi) {
      debtsData.push({ name, total_amount: total, interest_rate: rate, monthly_emi: emi });
    }
  });

  if (debtsData.length === 0) { alert('Add at least one debt with all fields filled.'); return; }

  document.getElementById('step-2').classList.add('hidden');
  document.getElementById('loader').classList.remove('hidden');

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ take_home: takeHome, debts: debtsData })
    });
    const json = await res.json();

    if (json.success) {
      analysisData = json.data;
      document.getElementById('loader').classList.add('hidden');
      document.getElementById('step-3').classList.remove('hidden');
      renderResults(json.data);
      drawDebtMap();

      sessionStorage.setItem('schwing_analysis', JSON.stringify(analysisData));
      sessionStorage.setItem('schwing_debts', JSON.stringify(debtsData));
      sessionStorage.setItem('schwing_takehome', String(takeHome));
    } else {
      throw new Error('Analysis failed');
    }
  } catch {
    alert('Something went wrong. Try again.');
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
  }
}

// ── STEP 3: SUMMARY ──
function renderResults(data) {
  document.getElementById('summary-box').innerHTML = `
    <div class="summary-box">
      <p class="summary-text">${data.summary}</p>
      <div class="stats-row">
        <div class="stat"><div class="value">₹${(data.monthly_surplus || 0).toLocaleString('en-IN')}</div><div class="label">Monthly Surplus</div></div>
        <div class="stat"><div class="value">${data.avalanche?.months_to_debt_free || '—'}mo</div><div class="label">Debt-Free (Avalanche)</div></div>
        <div class="stat"><div class="value">${data.snowball?.months_to_debt_free || '—'}mo</div><div class="label">Debt-Free (Snowball)</div></div>
      </div>
      <p class="rec-text"><strong>Recommendation:</strong> ${(data.recommendation || '').toUpperCase()} — ${data.recommendation_reason || ''}</p>
    </div>
  `;
}

function goToResults() {
  window.location.href = '/results';
}

// ── SPIDER MAP: branches floating out from center ──
function drawDebtMap() {
  const canvas = document.getElementById('debt-map');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.36;

  const totalEMI = debtsData.reduce((s, d) => s + d.monthly_emi, 0);
  const surplus = takeHome - totalEMI;
  const colors = ['#ef4444','#f97316','#eab308','#8b5cf6','#3b82f6','#ec4899','#14b8a6'];

  const nodes = [...debtsData];
  if (surplus > 0) {
    nodes.push({ name: 'Savings / Surplus', monthly_emi: surplus, isSurplus: true });
  }

  const angleStep = (2 * Math.PI) / nodes.length;

  // Draw branches first (so nodes sit on top)
  nodes.forEach((debt, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const nx = cx + radius * Math.cos(angle);
    const ny = cy + radius * Math.sin(angle);
    const color = debt.isSurplus ? '#10b981' : colors[i % colors.length];
    const thickness = Math.max(2, Math.min(12, (debt.monthly_emi / takeHome) * 50));

    // Curved branch
    const midX = cx + (nx - cx) * 0.5 + (ny - cy) * 0.15;
    const midY = cy + (ny - cy) * 0.5 - (nx - cx) * 0.15;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(midX, midY, nx, ny);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Draw nodes + labels
  nodes.forEach((debt, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const nx = cx + radius * Math.cos(angle);
    const ny = cy + radius * Math.sin(angle);
    const color = debt.isSurplus ? '#10b981' : colors[i % colors.length];

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(nx, ny, 38, 0, Math.PI * 2);
    ctx.fillStyle = color + '22';
    ctx.fill();

    // Node circle
    ctx.beginPath();
    ctx.arc(nx, ny, 30, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // EMI amount inside node
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`₹${Math.round(debt.monthly_emi / 1000)}k`, nx, ny);

    // Debt name label outside node
    const labelDist = 56;
    const lx = nx + labelDist * Math.cos(angle);
    const ly = ny + labelDist * Math.sin(angle);

    ctx.fillStyle = '#2D5F6E';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, debt.name, lx, ly, 110, 15);
  });

  // Center "YOU" node
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.fillStyle = '#12AAED22';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#2D5F6E';
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU', cx, cy - 8);
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText(`₹${Math.round(takeHome / 1000)}k`, cx, cy + 10);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let lines = [];
  let line = '';
  words.forEach((word, i) => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = test;
    }
  });
  lines.push(line.trim());

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

// ── EXPORT ──
async function exportPDF() {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ take_home: takeHome, debts: debtsData, analysis: analysisData })
  });

  if (res.ok) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schwing_debt_plan.pdf';
    a.click();
  } else {
    alert('PDF export failed.');
  }
}