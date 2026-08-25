(() => {
  const REFRESH_MS = 10000;
  let refreshTimer = null;
  let painelAberto = false;

  const style = document.createElement('style');
  style.textContent = `
    .status-overlay{position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,.58);padding:12px;display:none;overflow:auto}
    .status-modal{max-width:720px;margin:20px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.28)}
    .status-head{background:var(--primary);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .status-head strong{font-size:18px}
    .status-head button{width:auto;min-height:36px;margin:0;padding:6px 10px;background:rgba(255,255,255,.18)}
    .status-body{padding:14px;background:#f7f8fa}
    .status-updated{text-align:center;color:var(--muted);font-size:12px;margin-bottom:10px}
    .status-section{background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px;margin-top:10px}
    .status-section h3{margin:0 0 10px;font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
    .status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
    .status-card{background:#f7f8fa;border-radius:13px;padding:12px;text-align:center}
    .status-card .k{font-size:11px;color:var(--muted);margin-bottom:4px}
    .status-card .v{font-size:28px;font-weight:800;line-height:1.05}
    .status-card .s{font-size:11px;color:var(--muted);margin-top:4px}
    .status-highlight{background:#e8f0fe}
    .status-highlight .v{color:#174ea6}
    .status-warning{background:#fff4e5;border:1px solid #f9ab00}
    .status-danger{background:#fce8e6;border:1px solid var(--danger)}
    .status-ok{background:#e6f4ea;border:1px solid #81c995}
    .status-bar{height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:10px}
    .status-bar > div{height:100%;width:0;background:var(--success);transition:width .25s}
    .status-note{font-size:12px;color:var(--muted);margin-top:8px;text-align:center}
    .status-overbooking{margin-top:10px;border-radius:12px;padding:12px;background:#fce8e6;border-left:4px solid var(--danger);font-weight:700;color:#a50e0e}
    .status-actions{display:flex;gap:8px;margin-top:12px}
    .status-actions button{margin:0}
    @media(max-width:520px){.status-grid{grid-template-columns:1fr 1fr}.status-card.total{grid-column:1 / -1}.status-card .v{font-size:25px}}
  `;
  document.head.appendChild(style);

  const operatorBar = document.querySelector('.operator-bar');
  if (operatorBar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '📊 Status da Entrada';
    btn.onclick = abrirStatusEntrada;
    operatorBar.appendChild(btn);
  }

  const overlay = document.createElement('div');
  overlay.id = 'statusOverlay';
  overlay.className = 'status-overlay';
  overlay.innerHTML = `
    <div class="status-modal">
      <div class="status-head">
        <strong>📊 Status da Entrada</strong>
        <button type="button" id="statusClose">Fechar</button>
      </div>
      <div class="status-body" id="statusBody">
        <div class="status-updated">Carregando informações...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('statusClose').onclick = fecharStatusEntrada;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fecharStatusEntrada();
  });

  async function abrirStatusEntrada(){
    painelAberto = true;
    if (typeof scanEnabled !== 'undefined') scanEnabled = false;
    overlay.style.display = 'block';
    await atualizarStatusEntrada();
    pararTimer();
    refreshTimer = setInterval(atualizarStatusEntrada, REFRESH_MS);
  }

  function fecharStatusEntrada(){
    painelAberto = false;
    overlay.style.display = 'none';
    pararTimer();
    if (typeof cameraStarted !== 'undefined' && cameraStarted && typeof scanEnabled !== 'undefined') {
      scanEnabled = true;
    }
  }

  function pararTimer(){
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  async function atualizarStatusEntrada(){
    if (!painelAberto) return;
    const body = document.getElementById('statusBody');
    try {
      const d = await api('statusEntrada');
      if (!painelAberto) return;
      renderStatus(body, d);
    } catch (error) {
      body.innerHTML = `
        <div class="alert error"><b>❌ Não foi possível atualizar o painel.</b><br>${escapeHtml(error?.message || String(error))}</div>
        <div class="status-actions"><button type="button" onclick="window.atualizarStatusEntradaAgora()">Tentar novamente</button></div>
      `;
    }
  }

  function renderStatus(body, d){
    const reservas = d.reservas || {};
    const entradas = d.entradas || {};
    const ocupacao = Number(d.ocupacaoPercentual || 0);
    const comparecimento = Number(d.comparecimentoPercentual || 0);
    const capacidade = Number(d.capacidade || 458);
    const ocupClass = ocupacao >= 100 ? 'status-danger' : ocupacao >= 90 ? 'status-warning' : 'status-ok';
    const barWidth = Math.min(100, Math.max(0, ocupacao));
    const barColor = ocupacao >= 100 ? 'var(--danger)' : ocupacao >= 90 ? '#f9ab00' : 'var(--success)';
    const atualizado = d.atualizadoEm ? new Date(d.atualizadoEm).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : 'agora';

    body.innerHTML = `
      <div class="status-updated">Atualizado às ${escapeHtml(atualizado)} · atualização automática a cada 10 segundos</div>

      <div class="status-section">
        <h3>Reservas</h3>
        <div class="status-grid">
          ${card('Adultos reservados', reservas.adultos, '')}
          ${card('Crianças reservadas', reservas.menores, '')}
          ${card('Total reservado', reservas.total, '', 'total status-highlight')}
        </div>
      </div>

      <div class="status-section">
        <h3>Entradas realizadas</h3>
        <div class="status-grid">
          ${card('Adultos que entraram', entradas.adultos, '')}
          ${card('Crianças que entraram', entradas.menores, '')}
          ${card('Total de entradas', entradas.total, '', 'total status-highlight')}
          ${card('Comparecimento', formatPercent(comparecimento), 'sobre o total reservado')}
          ${card('Ainda aguardados', d.aguardados, 'reservados que ainda não entraram')}
        </div>
      </div>

      <div class="status-section ${ocupClass}">
        <h3>Capacidade do teatro</h3>
        <div class="status-grid">
          ${card('Capacidade física', capacidade, 'lugares')}
          ${card('Ocupação atual', formatPercent(ocupacao), 'entradas ÷ capacidade')}
          ${card('Lugares disponíveis', d.lugaresDisponiveis, 'neste momento', 'total')}
        </div>
        <div class="status-bar"><div style="width:${barWidth}%;background:${barColor}"></div></div>
        <div class="status-note">${ocupacao >= 100 ? 'Capacidade física atingida ou ultrapassada.' : ocupacao >= 90 ? 'Atenção: ocupação próxima da capacidade máxima.' : 'Ocupação dentro da capacidade física.'}</div>
        ${Number(d.overbooking || 0) > 0 ? `<div class="status-overbooking">⚠️ Overbooking das reservas: ${Number(d.overbooking)} pessoa(s) acima da capacidade de ${capacidade}.</div>` : ''}
      </div>

      <div class="status-actions">
        <button type="button" onclick="window.atualizarStatusEntradaAgora()">🔄 Atualizar agora</button>
      </div>
    `;
  }

  function card(label, value, small, extraClass=''){
    return `<div class="status-card ${extraClass}"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(String(value ?? 0))}</div>${small ? `<div class="s">${escapeHtml(small)}</div>` : ''}</div>`;
  }

  function formatPercent(v){
    return `${Number(v || 0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
  }

  window.atualizarStatusEntradaAgora = atualizarStatusEntrada;
  window.abrirStatusEntrada = abrirStatusEntrada;
  window.fecharStatusEntrada = fecharStatusEntrada;
})();
