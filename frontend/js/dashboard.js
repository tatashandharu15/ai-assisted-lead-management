let chartStatus, chartChannel;

function initBackendHint() {
  const b = getCurrentBackend();
  document.getElementById('backend-hint').innerHTML =
    `Connected via: <span class="active-col mono" style="color:${b.color}">${b.label} :${b.port}</span>`;
}

function trendBadge(pct) {
  if (pct >= 80) return `<span class="trend-badge hi">${Icons.trendUp(14)}<span>High</span></span>`;
  if (pct >= 50) return `<span class="trend-badge mid">${Icons.trendFlat(14)}<span>Medium</span></span>`;
  return `<span class="trend-badge lo">${Icons.trendDown(14)}<span>Low</span></span>`;
}

async function loadDashboard() {
  initBackendHint();
  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = `<div class="stats-grid"><div class="stat-card" style="--stat-color:#94a3b8"><div class="stat-label">Loading</div><div class="stat-value">…</div></div></div>`;
  try {
    const data = await api('/dashboard');
    const byStatus = data.by_status || {};
    const byChannel = data.by_channel || {};
    const total = Object.values(byStatus).reduce((s, v) => s + (+v || 0), 0);
    const won = +byStatus.closed_won || 0;
    const lost = +byStatus.closed_lost || 0;
    const oppty = +byStatus.opportunity || 0;
    const qual = +byStatus.qualified || 0;
    const newL = +byStatus.new || 0;
    const contacted = +byStatus.contacted || 0;
    const connected = +byStatus.connected || 0;
    const winRate = total ? (won / total * 100) : 0;

    const cards = [
      { label: 'Total Leads',      val: total,              sub: 'in pipeline',                                      color: '#6366f1', iconHtml: Icons.users(20) },
      { label: 'Closed Won',       val: won,                sub: `Win rate ${winRate.toFixed(1)}%`,                color: STATUS_COLORS.closed_won,    iconHtml: Icons.trophy(20) },
      { label: 'Closed Lost',      val: lost,               sub: `${total ? (lost/total*100).toFixed(1) : 0}% of total`, color: STATUS_COLORS.closed_lost, iconHtml: Icons.ban(20) },
      { label: 'Opportunities',    val: oppty,              sub: 'deal-stage in progress',                           color: STATUS_COLORS.opportunity, iconHtml: Icons.target(20) },
      { label: 'Qualified',        val: qual,               sub: 'fit & interest confirmed',                          color: STATUS_COLORS.qualified,   iconHtml: Icons.checkShield(20) },
      { label: 'New + Contacted',  val: newL + contacted,   sub: `New ${newL} · Contacted ${contacted}`,             color: STATUS_COLORS.contacted,   iconHtml: Icons.userPlus(20) },
      { label: 'Connected',        val: connected,          sub: 'response established',                              color: STATUS_COLORS.connected,   iconHtml: Icons.zap(20) },
    ];
    statsEl.innerHTML = `<div class="stats-grid">${cards.map(c => `
      <div class="stat-card" style="--stat-color:${c.color}">
        <div class="stat-icon">${c.iconHtml}</div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.val.toLocaleString()}</div>
        <div class="stat-sub">${c.sub}</div>
      </div>`).join('')}</div>`;

    const labels = STATUS_ORDER.map(s => STATUS_LABEL[s]);
    const vals = STATUS_ORDER.map(s => +byStatus[s] || 0);
    const colors = STATUS_ORDER.map(s => STATUS_COLORS[s]);
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(document.getElementById('chartStatus'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderColor: '#1e293b', borderWidth: 3, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 12 }, padding: 14, boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed.toLocaleString()}  (${total ? (c.parsed/total*100).toFixed(1) : 0}%)` } }
        }
      }
    });

    const clabels = CHANNEL_ORDER.slice();
    const cvals = clabels.map(c => +byChannel[c] || 0);
    const ccolors = CHANNEL_COLORS.slice();
    if (chartChannel) chartChannel.destroy();
    chartChannel = new Chart(document.getElementById('chartChannel'), {
      type: 'bar',
      data: { labels: clabels, datasets: [{ label: 'Leads by source channel', data: cvals, backgroundColor: ccolors, borderRadius: 8, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: '#33415555' } }
        }
      }
    });

    const funnel = STATUS_ORDER.map((s, i) => {
      const v = +byStatus[s] || 0;
      const prev = i === 0 ? total : (+byStatus[STATUS_ORDER[i - 1]] || total);
      const stageConv = prev ? (v / prev * 100) : 0;
      const totalConv = total ? (v / total * 100) : 0;
      return { stage: STATUS_LABEL[s], count: v, stageConv, totalConv, color: STATUS_COLORS[s] };
    });
    document.getElementById('funnelTable').innerHTML = `
      <thead><tr>
        <th>Stage</th><th># Leads</th><th>% of Total</th><th>Stage-to-stage Conversion</th><th>Visual</th>
      </tr></thead>
      <tbody>${funnel.map(f => `
        <tr>
          <td>${statusBadge(f.stage.replace(/ .*/,'').toLowerCase()) || ''} <strong>${f.stage}</strong></td>
          <td class="mono"><strong>${f.count.toLocaleString()}</strong></td>
          <td>${f.totalConv.toFixed(1)}%</td>
          <td>${f.stageConv.toFixed(1)}% ${trendBadge(f.stageConv)}</td>
          <td style="min-width:200px"><div class="prog" style="--c1:${f.color};--c2:${f.color};opacity:0.85"><div class="fill" style="width:${f.totalConv}%"></div></div></td>
        </tr>`).join('')}
      </tbody>
    `;
    showToast(`Dashboard loaded from ${getCurrentBackend().label} · ${total.toLocaleString()} leads`, getCurrentBackend().color);
  } catch (err) {
    statsEl.innerHTML = `<div class="panel" style="border-color:#ef444455"><div class="empty"><div class="ico">${Icons.alertOct(42)}</div><div class="t">Backend unreachable</div><div class="s">${escapeHtml(err.message)}<br><br><button class="btn primary" onclick="reloadPageData()">${Icons.rotateCw(14)} Retry</button></div></div></div>`;
  }
}

window.reloadPageData = loadDashboard;

renderHeader('dashboard');
onBackendSwitch(loadDashboard);
loadDashboard();
