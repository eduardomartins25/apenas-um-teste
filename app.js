let bennerData = null, complementarData = null, allResults = [], edits = {}, lancamentos = [];
let currentSector = null;
let refMonth = new Date().getMonth(), refYear = new Date().getFullYear();
let sortCol = null, sortDir = 'asc';
let currentUser = null;

const $ = id => document.getElementById(id);
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const USERS = {
    admin: { pwd: atob('U3NhX0ZpbmFuY2Vpcm9fMzA3Mw=='), role: 'admin', name: 'Financeiro' },
    advogado: { pwd: atob('YWR2b2dhZG8xMjM='), role: 'advogado', name: 'Advogado' }
};

const RULES = {
    civel: {
        label: 'Cível', areaMatch: ['civel'],
        juizado: { rate: 100, maxMonths: 18, exito: { acordo: 1000, sentenca: 2000 } },
        comum: { rate: 150, maxMonths: 24, maxMonthsPericia: 36, exito: { acordo: 1250, acordoPericia: 1500, sentenca: 3000 } },
        estrategico: { proLabore: 10000, recursoTJ: 5000, recursoSTJ: 10000, agravo: 2500, reversao: 5000, exitoPct: 0.10, exitoMax: 50000 },
         html: `<div class="rule-card"><div class="rule-name">A) Juizados (JEC) <span class="rule-help" title="Casos de menor complexidade. Detectado automaticamente quando o Rito for Sumaríssimo ou Sumário, ou Ação conter PROCON.">?</span></div><div class="rule-line">Sumaríssimo / Administrativo / Procon</div><div class="rule-line"><strong>R$ 100</strong>/mês · Trava <strong>18m</strong></div><div class="rule-line">Acordo <strong>R$ 1.000</strong> · Sentença <strong>R$ 2.000</strong></div></div><div class="rule-card"><div class="rule-name">B) Comum s/ Perícia <span class="rule-help" title="Casos de rito comum (Ordinário, Comum, Especial) sem perícia. Trava de 24 meses.">?</span></div><div class="rule-line">Ordinário/Comum/Especial</div><div class="rule-line"><strong>R$ 150</strong>/mês · Trava <strong>24m</strong></div><div class="rule-line">Acordo <strong>R$ 1.250</strong> · Sentença <strong>R$ 3.000</strong></div></div><div class="rule-card"><div class="rule-name">B) Comum c/ Perícia <span class="rule-help" title="Casos comuns que possuem perícia judicial. Detectado quando Objeto ou Resumo contém 'perícia', 'pericial' ou 'perito'. Trava estendida para 36 meses.">?</span></div><div class="rule-line">+ Perícia · Trava <strong>36m</strong></div><div class="rule-line">Acordo <strong>R$ 1.500</strong> · Sentença <strong>R$ 3.000</strong></div></div><div class="rule-card"><div class="rule-name">C) Estratégico <span class="rule-help" title="Casos estratégicos com cobrança por evento. Atualmente só pode ser ativado via edição manual ou planilha complementar.">?</span></div><div class="rule-line">Agravo <strong>R$ 2.500</strong> · TJ/TRF <strong>R$ 5.000</strong></div><div class="rule-line">STJ <strong>R$ 10.000</strong> · Pró-Labore <strong>R$ 10.000</strong></div></div><div class="rule-card"><div class="rule-name">Exceções <span class="rule-help" title="PR: travas reduzidas (12m sem perícia, 24m com). Cobrança e Sem Trava: valor R$ 0 (não faturado). Proposta Apartada: valor R$ 0.">?</span></div><div class="rule-line">PR: 12m s/ perícia · 24m c/ perícia</div><div class="rule-line">Cobrança/Sem Trava: R$ 0</div></div>`
    },
    trabalhista: { label: 'Trabalhista', areaMatch: ['trabalhista'], html: '<div class="rule-card"><div class="rule-name">Trabalhista</div><div class="rule-line" style="color:var(--text-muted)">Regras a definir</div></div>' },
    tributario: { label: 'Tributário', areaMatch: ['tributario'], html: '<div class="rule-card"><div class="rule-name">Tributário</div><div class="rule-line" style="color:var(--text-muted)">Regras a definir</div></div>' }
};

// ==================== INIT ====================
function init() {
    try {
        loadLancamentos();
        loadEdits();
        initMonthSelector();
        setupEvents();
        checkAuth();
    } catch (err) {
        console.error('INIT ERROR:', err);
    }
}

function checkAuth() {
    if (sessionStorage.getItem('auth')) {
        currentUser = USERS[sessionStorage.getItem('auth')];
        showApp();
    }
}

function showApp() {
    $('login-screen').style.display = 'none';
    $('app-content').style.display = '';
    $('user-name').textContent = currentUser.name;
    $('user-role').textContent = currentUser.role === 'admin' ? 'Admin' : 'Advogado';
    document.body.className = 'role-' + currentUser.role;
    renderLancamentos();
}

function setupEvents() {
    // Login
    const loginBtn = $('login-btn');
    const loginPwd = $('login-password');
    if (loginBtn) loginBtn.addEventListener('click', tryLogin);
    if (loginPwd) { loginPwd.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); }); loginPwd.focus(); }

    // Upload Benner
    const inputBenner = $('input-benner');
    const cardBenner = $('card-benner');
    if (inputBenner) inputBenner.addEventListener('change', e => handleFileUpload(e.target.files[0], 'benner'));
    if (cardBenner) {
        cardBenner.addEventListener('dragover', e => { e.preventDefault(); cardBenner.classList.add('dragover'); });
        cardBenner.addEventListener('dragleave', () => cardBenner.classList.remove('dragover'));
        cardBenner.addEventListener('drop', e => { e.preventDefault(); cardBenner.classList.remove('dragover'); handleFileUpload(e.dataTransfer.files[0], 'benner'); });
    }

    // Upload Complementar
    const inputCompl = $('input-compl');
    const cardCompl = $('card-compl');
    if (inputCompl) inputCompl.addEventListener('change', e => handleFileUpload(e.target.files[0], 'complementar'));
    if (cardCompl) {
        cardCompl.addEventListener('dragover', e => { e.preventDefault(); cardCompl.classList.add('dragover'); });
        cardCompl.addEventListener('dragleave', () => cardCompl.classList.remove('dragover'));
        cardCompl.addEventListener('drop', e => { e.preventDefault(); cardCompl.classList.remove('dragover'); handleFileUpload(e.dataTransfer.files[0], 'complementar'); });
    }

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const panel = $('lancamentos-panel');
        if (tab === 'lancamentos') {
            if (panel) panel.style.display = 'block';
            renderTable('todos');
        } else {
            if (panel) panel.style.display = 'none';
            renderTable(tab);
        }
    }));

    // Sector
    document.querySelectorAll('.sector-btn').forEach(btn => btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) { btn.classList.remove('active'); currentSector = null; }
        else { document.querySelectorAll('.sector-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentSector = btn.dataset.sector; }
        updateRules(); if (bennerData) processAndReconcile(); else { $('table-body').innerHTML = ''; $('empty-state').style.display = currentSector ? '' : 'flex'; updateSummary(); }
    }));

    // Buttons
    const btnExport = $('btn-export');
    const btnDemo = $('btn-demo');
    const btnClear = $('btn-clear');
    const btnAddLanc = $('btn-add-lanc');
    const btnAddLancAdv = $('btn-add-lanc-adv');
    if (btnExport) btnExport.addEventListener('click', exportToExcel);
    if (btnDemo) btnDemo.addEventListener('click', loadDemoData);
    if (btnClear) btnClear.addEventListener('click', clearAllData);
    if (btnAddLanc) btnAddLanc.addEventListener('click', openLancModal);
    if (btnAddLancAdv) btnAddLancAdv.addEventListener('click', openLancModal);
    const btnClearLanc = $('btn-clear-lanc');
    if (btnClearLanc) btnClearLanc.addEventListener('click', () => { lancamentos = []; localStorage.removeItem('lancamentos'); renderLancamentos(); if (bennerData && currentSector) processAndReconcile(); showToast('info', 'Lançamentos limpos.'); });

    // Sorting
    document.addEventListener('click', e => { const th = e.target.closest('#results-table th[data-col]'); if (!th) return; const col = th.dataset.col; if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc'; else { sortCol = col; sortDir = 'asc'; } renderTable(document.querySelector('.tab-btn.active').dataset.tab); });

    // Filters
    const filterSearch = $('filter-search');
    const filterStatus = $('filter-status');
    if (filterSearch) filterSearch.addEventListener('input', () => renderTable(document.querySelector('.tab-btn.active').dataset.tab));
    if (filterStatus) filterStatus.addEventListener('change', () => renderTable(document.querySelector('.tab-btn.active').dataset.tab));
}

function tryLogin() {
    const pwd = $('login-password').value;
    for (const [key, user] of Object.entries(USERS)) {
        if (pwd === user.pwd) { sessionStorage.setItem('auth', key); currentUser = user; showApp(); return; }
    }
    $('login-error').style.display = 'block'; $('login-password').value = ''; $('login-password').focus();
}

function initMonthSelector() {
    const sel = $('ref-month'); if (!sel) return; sel.innerHTML = '';
    for (let y = refYear - 1; y <= refYear + 1; y++) for (let m = 0; m < 12; m++) {
        const o = document.createElement('option'); o.value = `${y}-${m}`; o.textContent = `${MESES[m]}/${y}`;
        if (m === refMonth && y === refYear) o.selected = true; sel.appendChild(o);
    }
    sel.addEventListener('change', () => { const [y, m] = sel.value.split('-').map(Number); refYear = y; refMonth = m; if (bennerData) processAndReconcile(); });
}

// ==================== HELPERS ====================
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
function findCol(row, ...c) { const k = Object.keys(row); for (const v of c) { const n = norm(v); const f = k.find(x => norm(x).includes(n)); if (f !== undefined) return row[f]; } return undefined; }
function parseDateValue(v) { if (!v) return null; if (v instanceof Date && !isNaN(v)) return v; if (typeof v === 'number' && v > 30000) return new Date((v - 25569) * 86400000); const s = String(v).trim(); const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) { const mo = parseInt(m[1]); return mo <= 12 ? new Date(m[3], mo - 1, m[2]) : new Date(m[3], parseInt(m[2]) - 1, mo); } return new Date(s); }
function formatBRL(v) { return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function downloadExcel(wb, fn) {
    try { const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fn; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('info', `Download: ${fn}`); } catch (e) { showToast('error', e.message); }
}

function showLoading() { const bar = $('loading-bar'); if (bar) bar.classList.add('active'); }
function hideLoading() { const bar = $('loading-bar'); if (bar) bar.classList.remove('active'); }

function readExcel(ab) {
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]]; const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let hi = -1; for (let i = 0; i < Math.min(5, raw.length); i++) { if (raw[i] && raw[i].some(c => norm(c).includes('pasta'))) { hi = i; break; } }
    if (hi === -1) { let mx = 0; for (let i = 0; i < Math.min(5, raw.length); i++) { const n = (raw[i] || []).filter(c => c != null && c !== '').length; if (n > mx) { mx = n; hi = i; } } }
    if (hi === -1) hi = 0;
    const hdr = raw[hi].map(h => String(h || '').trim()); const data = [];
    for (let i = hi + 1; i < raw.length; i++) { const r = raw[i]; if (!r || r.every(c => c == null || c === '')) continue; const o = {}; hdr.forEach((h, j) => { if (h) o[h] = r[j] !== undefined ? r[j] : ''; }); data.push(o); }
    return data;
}

function handleFileUpload(file, source) {
    if (!file) return; const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = readExcel(e.target.result);
            if (!data.length) { showToast('warning', 'Planilha vazia.'); return; }
            if (source === 'benner') {
                bennerData = data; $('card-benner').classList.add('success'); $('info-benner').querySelector('.file-name').textContent = file.name;
            } else {
                complementarData = data; $('card-compl').classList.add('success'); $('info-compl').querySelector('.file-name').textContent = file.name;
            }
            if (currentSector) { showLoading(); processAndReconcile(); hideLoading(); }
            showToast('success', `${file.name}: ${data.length} linhas`);
        } catch (err) { showToast('error', err.message); }
    };
    reader.readAsArrayBuffer(file);
}

// ==================== PROCESSING ====================
function processAndReconcile() {
    if (!currentSector) return;
    allResults = [];
    const refDate = new Date(refYear, refMonth, 1);

    // Build complementar map
    const complMap = new Map();
    if (complementarData) complementarData.forEach(row => {
        const pasta = String(findCol(row, 'pasta') || '').trim();
        if (pasta) complMap.set(pasta, row);
    });

    // Build lançamentos map
    const lancMap = new Map();
    lancamentos.forEach(l => { if (l.pasta) lancMap.set(l.pasta, l); });

    if (bennerData) {
        bennerData.forEach(row => {
        const pasta = String(findCol(row, 'pasta') || '').trim();
        if (!pasta) return;

        const edit = edits[pasta] || {};
        const compl = complMap.get(pasta) || null;
        const lanc = lancMap.get(pasta) || null;

        // Merge: complementar overrides edit, lançamento adds bonus
        const mergedEdit = { ...edit };
        if (compl) {
            const cObs = String(findCol(compl, 'obs', 'observacao') || '').trim();
            const cClass = norm(findCol(compl, 'classificacao', 'classificação'));
            const cBonus = parseFloat(findCol(compl, 'bonus')) || 0;
            const cTrava = String(findCol(compl, 'trava') || '').trim();
            const cNaoCobrar = norm(findCol(compl, 'nao cobrar', 'nao_cobrar'));
            if (cObs) mergedEdit.obs = cObs;
            if (cClass) mergedEdit.classificacao = cClass;
            if (cBonus > 0) mergedEdit.bonus = (mergedEdit.bonus || 0) + cBonus;
            if (cTrava) mergedEdit.trava = cTrava;
            if (cNaoCobrar === 'sim' || cNaoCobrar === '1' || cNaoCobrar === 'true') mergedEdit.naoCobrar = true;
        }
        if (lanc) {
            if (lanc.obs) mergedEdit.obs = mergedEdit.obs ? `${mergedEdit.obs}; ${lanc.obs}` : lanc.obs;
            if (lanc.naoCobrar) mergedEdit.naoCobrar = true;
            if (lanc.valores && lanc.valores.length) {
                const lancTotal = lanc.valores.reduce((a, v) => a + v.valor, 0);
                if (lancTotal > 0) mergedEdit.bonus = (mergedEdit.bonus || 0) + lancTotal;
            } else if (lanc.valor) {
                mergedEdit.bonus = (mergedEdit.bonus || 0) + lanc.valor;
            }
        }

        const calc = calcBilling(row, refDate, mergedEdit);
        allResults.push({
            chave: pasta, processo: String(findCol(row, 'numero do processo') || pasta),
            area: String(findCol(row, 'area do direito') || 'N/A'), areaNorm: norm(findCol(row, 'area do direito')),
            acao: String(findCol(row, 'acao') || 'N/A'), rito: String(findCol(row, 'rito') || 'N/A'),
            situacao: String(findCol(row, 'situacao', 'situação') || 'N/A'),
            advogado: String(findCol(row, 'advogado interno') || 'N/A'),
            empreendimento: String(findCol(row, 'empreendimento') || 'N/A'),
            spe: String(findCol(row, 'spe') || 'N/A'),
            categoria: calc.categoria, mensal: calc.mensal, exito: calc.exito, bonus: calc.bonus, total: calc.total,
            detalhe: calc.descricao, calcDetail: calc, originalRow: row,
            statusInfo: calc.statusInfo, detection: calc.detection, edit: mergedEdit,
            hasCompl: !!compl, hasLanc: !!lanc,
            travaDisplay: calc.regras.trava > 0 ? `${calc.regras.mesesUsados}/${calc.regras.trava}m` : '—',
            obsDisplay: mergedEdit.obs || '—'
        });
    });

    }

    // Add standalone lançamentos (no matching Benner row)
    const usedPastas = new Set(allResults.map(i => i.chave));
    lancamentos.forEach(l => {
        if (!l.pasta || usedPastas.has(l.pasta)) return;
        const total = l.naoCobrar ? 0 : ((l.valores || []).reduce((a, v) => a + v.valor, 0));
        allResults.push({
            chave: l.pasta, processo: l.pasta,
            area: 'Lançamento', areaNorm: 'lançamento',
            acao: '—', rito: '—',
            situacao: '—',
            advogado: '—',
            empreendimento: '—',
            spe: '—',
            categoria: l.naoCobrar ? 'Não Cobrar' : 'Lançamento',
            mensal: 0, exito: 0, bonus: total, total: total,
            detalhe: l.obs || 'Lançamento manual',
            calcDetail: { regras: { tipo: 'Lançamento', pericia: '—', mesesUsados: 0, mesesRestantes: 0, trava: 0, isPR: false }, descricao: l.obs || 'Lançamento manual' },
            originalRow: {},
            statusInfo: l.naoCobrar ? { label: 'Não Cobrar', cls: 'status-x' } : { label: 'Lançamento', cls: 'status-green' },
            detection: 'manual',
            edit: { obs: l.obs || '', bonus: total, naoCobrar: l.naoCobrar },
            hasCompl: false, hasLanc: true,
            travaDisplay: '—',
            obsDisplay: l.obs || '—'
        });
    });

    $('empty-state').style.display = 'none'; $('btn-export').removeAttribute('disabled');
    updateRules(); renderTable(document.querySelector('.tab-btn.active').dataset.tab); updateSummary();
}

function calcBilling(row, refDate, edit) {
    const area = norm(findCol(row, 'area do direito'));
    const nat = norm(findCol(row, 'natureza'));
    const rito = norm(findCol(row, 'rito'));
    const sit = norm(findCol(row, 'situacao', 'situação'));
    const tipoEnc = norm(findCol(row, 'tipo de encerramento'));
    const obj = norm(findCol(row, 'objeto principal'));
    const resumo = norm(findCol(row, 'resumo'));
    const acao = norm(findCol(row, 'acao'));
    const cadDate = parseDateValue(findCol(row, 'data do cadastro'));
    const encDate = parseDateValue(findCol(row, 'data encerramento'));
    const regional = norm(findCol(row, 'regional'));
    const obsText = norm(edit.obs || '');
    const bennerObs = norm(findCol(row, 'observacao', 'obs', 'observação', 'motivo'));
    const rowText = Object.values(row).map(v => norm(String(v || ''))).filter(Boolean).join(' ');
    const allText = [obj, resumo, acao, bennerObs, rowText].filter(Boolean).join(' ');

    const z = (c, d, s, det) => ({ categoria: c, mensal: 0, exito: 0, bonus: 0, total: 0, descricao: d, regras: { tipo: 'N/A', pericia: '—', mesesUsados: 0, mesesRestantes: 0, trava: 0 }, statusInfo: s || { label: c, cls: 'status-gray' }, detection: det || 'auto' });

    if (edit.naoCobrar) return z('Não Cobrar', edit.obs || 'Não cobrar', { label: 'Não Cobrar', cls: 'status-x' }, 'manual');
    if (!area.includes('civel')) return z('Fora do Contrato', `Área: ${area}`, { label: 'Fora do Contrato', cls: 'status-gray' }, 'auto');

    const ritoNorm = norm(rito);
    const travaRaw = String(findCol(row, 'trava') || '').toLowerCase();
    const isCobrancaObs = bennerObs === 'cobranca' || bennerObs.startsWith('cobranca ');
    const isPropostaObs = bennerObs === 'proposta apartada' || bennerObs.startsWith('proposta apartada ');
    if (ritoNorm.includes('cobranca') || isCobrancaObs || travaRaw.includes('cobranca') || travaRaw.includes('sem trava')) return z('Sem Cobrança', 'Cobrança', { label: 'Sem Cobrança', cls: 'status-gray' }, 'auto');
    if (isPropostaObs || travaRaw.includes('proposta apartada')) return z('Proposta Apartada', 'Proposta Apartada', { label: 'Proposta Apartada', cls: 'status-gray' }, 'auto');

    // Force JEC when Ação/BennerObs/Obs contains JEC or PROCON (overrides rito/natureza)
    const forceJEC = acao.includes('procon') || bennerObs.includes('jec') || bennerObs.includes('procon') || obsText.includes('jec') || obsText.includes('procon');

    // Extrajudicial: Administrativo sem JEC/PROCON = não cobrar
    if (!nat.includes('judicial') && !forceJEC) return z('Extrajudicial', 'Administrativo', { label: 'Extrajudicial', cls: 'status-blue' }, 'auto');

    const isEncerrado = sit.includes('encerrado') || sit.includes('baixa');
    let mesesUsados = 0;
    if (cadDate) { const end = isEncerrado && encDate ? encDate : refDate; mesesUsados = Math.max(0, (end.getFullYear() - cadDate.getFullYear()) * 12 + (end.getMonth() - cadDate.getMonth())); }

    const hasPericiaField = norm(findCol(row, 'classificacao', 'classificação')).includes('pericia');
    const hasPericiaText = [obj, resumo].some(t => t.includes('pericia') || t.includes('pericial') || t.includes('perito'));
    const hasPericia = edit.pericia !== undefined ? edit.pericia : (hasPericiaField || hasPericiaText);
    const isPR = regional.includes('parana') || regional.includes('pr') || /\bpr\b/.test(obsText);
    const isEstrategico = travaRaw.includes('estrategico') || obsText.includes('estrategico');
    const isJ = ritoNorm.includes('sumarissimo') || ritoNorm.includes('sumario') || forceJEC;
    const ritoConflict = !ritoNorm.includes('sumarissimo') && !ritoNorm.includes('sumario') && forceJEC;
    const needsReview = allText.includes('duplicidade') || allText.includes('duplo') || allText.includes('erro de cadastro') || allText.includes('cadastro duplo') || allText.includes('confirmar rito') || allText.includes('aditivo') || obsText.includes('duplicidade') || obsText.includes('erro de cadastro') || obsText.includes('confirmar rito') || obsText.includes('aditivo');

    let trava = 0;
    const editTrava = edit.trava ? parseInt(edit.trava) : null;
    if (editTrava) trava = editTrava;
    else if (isJ) trava = RULES.civel.juizado.maxMonths;
    else if (isPR) trava = hasPericia ? 24 : 12;
    else trava = hasPericia ? RULES.civel.comum.maxMonthsPericia : RULES.civel.comum.maxMonths;

    const mesesRestantes = Math.max(0, trava - mesesUsados);
    const atingiuTrava = mesesUsados >= trava;

    let detection = 'auto';
    if (isEstrategico) detection = 'revisar';
    else if (ritoConflict) detection = 'revisar';
    else if (needsReview) detection = 'revisar';
    else if (forceJEC && !nat.includes('judicial')) detection = 'revisar';
    if (edit.obs || edit.bonus || edit.naoCobrar) detection = 'manual';

    let statusInfo;
    if (isEncerrado) statusInfo = { label: 'Encerrado', cls: 'status-gray' };
    else if (atingiuTrava) statusInfo = { label: 'Trava Atingida', cls: 'status-red' };
    else if (mesesRestantes <= 2 && mesesRestantes > 0) statusInfo = { label: `Trava em ${mesesRestantes}m`, cls: 'status-yellow' };
    else statusInfo = { label: 'Ativo', cls: 'status-green' };

    let rate, exitoCfg;
    if (isJ) { rate = RULES.civel.juizado.rate; exitoCfg = RULES.civel.juizado.exito; }
    else { rate = RULES.civel.comum.rate; exitoCfg = hasPericia ? { acordo: RULES.civel.comum.exito.acordoPericia, sentenca: RULES.civel.comum.exito.sentenca } : RULES.civel.comum.exito; }

    const mensal = (isEncerrado || atingiuTrava) ? 0 : rate;
    let exito = 0, bonus = 0, d = [];
    if (mensal > 0) d.push(`R$ ${rate}/mês · ${mesesUsados}/${trava}m`);
    else if (atingiuTrava && !isEncerrado) d.push(`Trava atingida (${trava}m)`);

    if (isEncerrado) {
        if (tipoEnc.includes('acordo')) { exito = exitoCfg.acordo; d.push(`Êxito Acordo: ${formatBRL(exito)}`); }
        else if (tipoEnc.includes('senten')) { exito = exitoCfg.sentenca; d.push(`Êxito Sentença: ${formatBRL(exito)}`); }
    }

    if (isEstrategico && !isEncerrado) {
        const est = RULES.civel.estrategico;
        if (obsText.includes('agravo')) { bonus += est.agravo; d.push(`Agravo: ${formatBRL(est.agravo)}`); }
        if (obsText.includes('tj') || obsText.includes('trf')) { bonus += est.recursoTJ; d.push(`Recurso TJ/TRF: ${formatBRL(est.recursoTJ)}`); }
        if (obsText.includes('stj') || obsText.includes('resp')) { bonus += est.recursoSTJ; d.push(`Recurso STJ: ${formatBRL(est.recursoSTJ)}`); }
        if (obsText.includes('reversao') || obsText.includes('liminar')) { bonus += est.reversao; d.push(`Reversão: ${formatBRL(est.reversao)}`); }
        if (obsText.includes('pro labore')) { bonus += est.proLabore; d.push(`Pró-Labore: ${formatBRL(est.proLabore)}`); }
    }

    if (edit.bonus && edit.bonus > 0) { bonus += edit.bonus; d.push(`Bônus: ${formatBRL(edit.bonus)}`); }

    const cat = isJ ? 'Juizado' : (isEstrategico ? 'Estratégico' : 'Comum');
    return {
        categoria: cat, mensal, exito, bonus, total: mensal + exito + bonus,
        descricao: d.join(' + ') || '—',
        regras: { tipo: cat, pericia: hasPericia ? 'Sim' : 'Não', mesesUsados, mesesRestantes, trava, isPR },
        statusInfo, detection
    };
}

// ==================== RENDERING ====================
function getFiltered(tab) {
    if (!currentSector) return [];
    const r = RULES[currentSector];
    const searchEl = $('filter-search');
    const statusEl = $('filter-status');
    const search = searchEl ? norm(searchEl.value) : '';
    const statusFilter = statusEl ? statusEl.value : '';

    return allResults.filter(i => {
        if (i.areaNorm === 'lançamento') return true;
        if (!r.areaMatch.some(m => i.areaNorm.includes(m))) return false;
        if (tab === 'faturamento') { if (i.mensal <= 0 && i.bonus <= 0) return false; }
        else if (tab === 'divergencias') { if (i.detection !== 'revisar' && i.detection !== 'manual') return false; }

        if (search && !norm(i.chave).includes(search) && !norm(i.processo).includes(search) && !norm(i.advogado).includes(search)) return false;

        if (statusFilter) {
            const sl = i.statusInfo.label.toLowerCase();
            if (statusFilter === 'ativo' && !sl.includes('ativo') && !sl.includes('trava em')) return false;
            if (statusFilter === 'encerrado' && !sl.includes('encerrado')) return false;
            if (statusFilter === 'trava' && !sl.includes('trava atingida')) return false;
            if (statusFilter === 'nao-cobrar' && !sl.includes('não cobrar')) return false;
        }

        return true;
    });
}

function sortResults(arr) {
    if (!sortCol) return arr;
    return [...arr].sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (va == null) va = ''; if (vb == null) vb = '';
        if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderTable(tab) {
    const tbody = $('table-body'); tbody.innerHTML = '';
    if (!currentSector) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem;">Selecione um setor.</td></tr>`; return; }
    const f = sortResults(getFiltered(tab));
    if (!f.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum processo.</td></tr>`; return; }

    document.querySelectorAll('#results-table th[data-col]').forEach(th => { th.classList.remove('sort-asc', 'sort-desc'); if (th.dataset.col === sortCol) th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc'); });

    f.forEach(item => {
        const tr = document.createElement('tr'); tr.className = 'clickable-row';
        const travaClass = item.calcDetail.regras.mesesRestantes <= 2 && item.calcDetail.regras.mesesRestantes > 0 && item.mensal > 0 ? 'trava-alert' : '';
        const detCls = item.detection === 'manual' ? 'badge-neutral' : (item.detection === 'revisar' ? 'badge-warning' : 'badge-success');
        const detLabel = item.detection === 'manual' ? 'Manual' : (item.detection === 'revisar' ? 'Revisar' : 'Auto');
        const totalDisplay = item.total > 0 ? formatBRL(item.total) : '<span style="color:var(--text-muted)">—</span>';
        const srcIcons = [];
        if (item.hasCompl) srcIcons.push('📋');
        if (item.hasLanc) srcIcons.push('✏️');
        const src = srcIcons.length ? `<span style="font-size:0.7rem;margin-left:3px;" title="${item.hasCompl ? 'Planilha Complementar' : ''}${item.hasLanc ? ' Lançamento Manual' : ''}">${srcIcons.join('')}</span>` : '';
        tr.innerHTML = `
            <td><strong>${item.chave}</strong>${src}</td>
            <td style="font-size:0.68rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.processo}">${item.processo}</td>
            <td>${item.rito}</td>
            <td><span class="status-dot ${item.statusInfo.cls}"></span>${item.statusInfo.label}</td>
            <td class="${travaClass}">${item.travaDisplay}</td>
            <td style="font-weight:700;">${totalDisplay}</td>
            <td><span class="badge ${detCls}">${detLabel}</span></td>
            <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.62rem;color:var(--text-muted);" title="${item.obsDisplay}">${item.obsDisplay}</td>
            <td><button class="btn-edit" data-pasta="${item.chave}" title="Editar">✏️</button></td>
        `;
        tr.addEventListener('click', e => { if (!e.target.closest('.btn-edit')) toggleDetail(tr, item); });
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.dataset.pasta); }));
}

function toggleDetail(tr, item) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('detail-row')) { next.remove(); tr.classList.remove('expanded'); return; }
    document.querySelectorAll('.detail-row').forEach(r => r.remove());
    document.querySelectorAll('.clickable-row.expanded').forEach(r => r.classList.remove('expanded'));
    tr.classList.add('expanded');
    const r = item.calcDetail.regras;
    const dtr = document.createElement('tr'); dtr.className = 'detail-row';
    dtr.innerHTML = `<td colspan="10"><div class="detail-content">
        <div class="detail-grid">
            <div class="detail-item"><span class="label">Regra</span><span class="value">${r.tipo}</span></div>
            <div class="detail-item"><span class="label">Perícia</span><span class="value">${r.pericia}</span></div>
            <div class="detail-item"><span class="label">Trava</span><span class="value">${r.trava}m</span></div>
            <div class="detail-item"><span class="label">Usados</span><span class="value">${r.mesesUsados}m</span></div>
            <div class="detail-item"><span class="label">Restantes</span><span class="value">${r.mesesRestantes}m</span></div>
            <div class="detail-item"><span class="label">PR</span><span class="value">${r.isPR ? 'Sim' : 'Não'}</span></div>
            <div class="detail-item"><span class="label">Advogado</span><span class="value">${item.advogado}</span></div>
            <div class="detail-item"><span class="label">SPE</span><span class="value">${item.spe}</span></div>
            <div class="detail-item"><span class="label">Origem</span><span class="value">${item.hasCompl ? 'Complementar' : ''}${item.hasLanc ? ' Lançamento' : ''}${!item.hasCompl && !item.hasLanc ? 'Benner' : ''}</span></div>
        </div>
        <div style="margin-top:0.2rem;font-size:0.62rem;color:var(--text-secondary);">${item.calcDetail.descricao}</div>
    </div></td>`;
    tr.after(dtr);
}

function updateSummary() {
    if (!currentSector) { $('sum-faturar').textContent = 'R$ 0,00'; $('sum-conciliados').textContent = '0'; $('sum-divergencias').textContent = '0'; return; }
    const f = allResults.filter(i => RULES[currentSector].areaMatch.some(m => i.areaNorm.includes(m)));
    const ativos = f.filter(i => i.mensal > 0 || i.bonus > 0);
    const revisar = f.filter(i => i.detection === 'revisar' || i.detection === 'manual').length;
    $('sum-faturar').textContent = formatBRL(ativos.reduce((a, i) => a + i.total, 0));
    $('sum-conciliados').textContent = `${ativos.length} de ${f.length}`;
    $('sum-divergencias').textContent = revisar;
}

function updateRules() { const el = $('rules-content'); if (el) el.innerHTML = currentSector ? (RULES[currentSector].html || '') : '<div class="rule-card"><div class="rule-line" style="color:var(--text-muted)">Selecione um setor</div></div>'; }

// ==================== EDIT MODAL ====================
function openEditModal(pasta) {
    const item = allResults.find(i => i.chave === pasta); if (!item) return;
    const edit = edits[pasta] || {};
    const modal = document.createElement('div'); modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
        <div class="modal-header"><h3>${pasta}</h3><button class="modal-close">&times;</button></div>
        <div class="modal-body">
            <div class="modal-info"><span>${item.rito}</span><span>${item.situacao}</span><span>${item.advogado}</span></div>
            <div class="modal-field"><label>Classificação</label><select id="edit-class"><option value="" ${!edit.classificacao ? 'selected' : ''}>Automático</option><option value="sem pericia" ${edit.classificacao === 'sem pericia' ? 'selected' : ''}>Sem Perícia</option><option value="com pericia" ${edit.classificacao === 'com pericia' ? 'selected' : ''}>Com Perícia</option></select></div>
            <div class="modal-field"><label>Obs</label><textarea id="edit-obs" rows="2" placeholder="Ex: JEC - Administrativo, Estratégico - Agravo">${edit.obs || ''}</textarea></div>
            <div class="modal-row"><div class="modal-field"><label>Bônus (R$)</label><input type="number" id="edit-bonus" value="${edit.bonus || ''}" placeholder="0"></div><div class="modal-field"><label>Trava</label><select id="edit-trava"><option value="" ${!edit.trava ? 'selected' : ''}>Automático</option><option value="12" ${edit.trava === '12' ? 'selected' : ''}>12m</option><option value="18" ${edit.trava === '18' ? 'selected' : ''}>18m</option><option value="24" ${edit.trava === '24' ? 'selected' : ''}>24m</option><option value="36" ${edit.trava === '36' ? 'selected' : ''}>36m</option></select></div></div>
            <div class="modal-check"><label class="check-label"><input type="checkbox" id="edit-nao-cobrar" ${edit.naoCobrar ? 'checked' : ''}><span>Não cobrar (zerar)</span></label></div>
            <div class="modal-preview"><span>Mensal: <strong>${formatBRL(item.mensal)}</strong></span><span>Êxito: <strong>${formatBRL(item.exito)}</strong></span><span>Bônus: <strong>${formatBRL(item.bonus)}</strong></span><span>Total: <strong>${formatBRL(item.total)}</strong></span></div>
        </div>
        <div class="modal-footer"><button class="btn btn-sm btn-outline" id="edit-reset">Resetar</button><button class="btn btn-sm btn-primary" id="edit-save">Salvar</button></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#edit-save').addEventListener('click', () => {
        const ne = {};
        const cls = modal.querySelector('#edit-class').value;
        const obs = modal.querySelector('#edit-obs').value.trim();
        const bonus = parseFloat(modal.querySelector('#edit-bonus').value) || 0;
        const trava = modal.querySelector('#edit-trava').value;
        const nc = modal.querySelector('#edit-nao-cobrar').checked;
        if (cls) ne.classificacao = cls; if (obs) ne.obs = obs; if (bonus > 0) ne.bonus = bonus;
        if (trava) ne.trava = trava; if (nc) ne.naoCobrar = true;
        if (cls || obs || bonus || trava || nc) edits[pasta] = ne; else delete edits[pasta];
        saveEdits();
        modal.remove(); processAndReconcile(); showToast('success', `${pasta} atualizado`);
    });
    modal.querySelector('#edit-reset').addEventListener('click', () => { delete edits[pasta]; saveEdits(); modal.remove(); processAndReconcile(); showToast('info', `${pasta} resetado`); });
}

// ==================== LANÇAMENTOS ====================
function loadLancamentos() { try { lancamentos = JSON.parse(localStorage.getItem('lancamentos') || '[]'); } catch { lancamentos = []; } }
function saveLancamentos() { localStorage.setItem('lancamentos', JSON.stringify(lancamentos)); renderLancamentos(); }

function loadEdits() { try { edits = JSON.parse(localStorage.getItem('edits') || '{}'); } catch { edits = {}; } }
function saveEdits() { localStorage.setItem('edits', JSON.stringify(edits)); }

function renderLancamentos() {
    const totalGeral = lancamentos.reduce((a, l) => {
        if (l.naoCobrar) return a;
        return a + (l.valores || []).reduce((s, v) => s + v.valor, 0);
    }, 0);

    const empty = '<div class="lanc-empty">Nenhum lançamento. Clique em "+ Novo" para adicionar.</div>';
    const html = lancamentos.length ? lancamentos.map((l, i) => {
        const total = (l.valores || []).reduce((a, v) => a + v.valor, 0);
        const parts = (l.valores || []).map(v => v.desc ? `${v.desc} ${formatBRL(v.valor)}` : formatBRL(v.valor));
        const right = l.naoCobrar ? '<span class="lanc-nc">Não cobrar</span>' : (parts.length ? parts.join(' + ') : formatBRL(0));
        return `<div class="lanc-row">
            <span class="lanc-pasta">${l.pasta}</span>
            <span class="lanc-obs" title="${l.obs || ''}">${l.obs || ''}</span>
            <span class="lanc-right">${right}</span>
            <button class="lanc-del" data-idx="${i}" title="Excluir">✕</button>
        </div>`;
    }).join('') : empty;

    ['lanc-list', 'lanc-list-adv'].forEach(id => {
        const el = $(id); if (!el) return;
        el.innerHTML = html;
        el.querySelectorAll('.lanc-del').forEach(btn => btn.addEventListener('click', () => {
            lancamentos.splice(parseInt(btn.dataset.idx), 1);
            saveLancamentos();
            if (bennerData && currentSector) processAndReconcile();
            showToast('info', 'Lançamento removido');
        }));
    });

    const totalAdv = $('lanc-adv-total');
    if (totalAdv) totalAdv.innerHTML = lancamentos.length ? `<span>${lancamentos.length} lançamento(s)</span><strong>${formatBRL(totalGeral)}</strong>` : '';
    const countAdv = $('lanc-adv-count');
    if (countAdv) countAdv.textContent = lancamentos.length ? `${lancamentos.length} registro(s)` : 'Nenhum registro';
}

function openLancModal() {
    const modal = document.createElement('div'); modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">
        <div class="modal-header"><h3><svg class="icon"><use href="#i-file-plus"/></svg> Novo Lançamento</h3><button class="modal-close">&times;</button></div>
        <div class="modal-body">
            <div class="modal-row" style="grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div class="modal-field"><label>Pasta</label><input type="text" id="lanc-pasta" placeholder="Pasta.0001" autofocus></div>
                <div class="modal-field"><label>Observação</label><input type="text" id="lanc-obs" placeholder="Motivo"></div>
            </div>
            <div class="lanc-valores-section">
                <label>Valores</label>
                <div id="lanc-vals"></div>
                <button class="btn-add-row" id="lanc-add-row">+ Adicionar linha</button>
            </div>
            <label class="check-sm"><input type="checkbox" id="lanc-nc"> Não cobrar esta pasta</label>
        </div>
        <div class="modal-footer">
            <button class="btn btn-sm btn-outline modal-close-btn">Cancelar</button>
            <button class="btn btn-sm btn-primary" id="lanc-save">Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);

    const vals = modal.querySelector('#lanc-vals');
    function addRow(d = '', v = '') {
        const row = document.createElement('div'); row.className = 'val-row';
        row.innerHTML = `<input type="text" class="val-desc" placeholder="Descrição" value="${d}"><input type="number" class="val-amt" placeholder="R$" value="${v}"><button class="val-del">✕</button>`;
        vals.appendChild(row);
        row.querySelector('.val-del').onclick = () => row.remove();
    }
    addRow('Mensal', '');
    modal.querySelector('#lanc-add-row').onclick = () => addRow();
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.querySelector('#lanc-nc').onchange = e => { vals.style.opacity = e.target.checked ? 0.3 : 1; vals.style.pointerEvents = e.target.checked ? 'none' : ''; };
    modal.querySelector('#lanc-save').onclick = () => {
        const pasta = modal.querySelector('#lanc-pasta').value.trim();
        if (!pasta) { showToast('warning', 'Informe a pasta.'); return; }
        const obs = modal.querySelector('#lanc-obs').value.trim();
        const nc = modal.querySelector('#lanc-nc').checked;
        const valores = [];
        if (!nc) vals.querySelectorAll('.val-row').forEach(r => {
            const d = r.querySelector('.val-desc').value.trim();
            const v = parseFloat(r.querySelector('.val-amt').value) || 0;
            if (d || v > 0) valores.push({ desc: d || 'Valor', valor: v });
        });
        lancamentos.push({ pasta, obs, valores, naoCobrar: nc, data: new Date().toISOString() });
        saveLancamentos(); modal.remove();
        if (bennerData && currentSector) processAndReconcile();
        const total = valores.reduce((a, v) => a + v.valor, 0);
        showToast('success', `${pasta}: ${nc ? 'Não cobrar' : formatBRL(total)}`);
    };
}

// ==================== EXPORT ====================
function exportToExcel() {
    if (!currentSector) { showToast('warning', 'Selecione um setor.'); return; }
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    const f = getFiltered(activeTab);
    if (!f.length) { showToast('warning', 'Nenhum processo.'); return; }
    const data = f.map(i => ({
        'Pasta': i.chave, 'Processo': i.processo, 'Ação': i.acao, 'Rito': i.rito,
        'Status': i.statusInfo.label, 'Categoria': i.categoria,
        'Classificação': i.edit.classificacao || 'Auto', 'Obs': i.edit.obs || '',
        'Meses Usados': i.calcDetail.regras.mesesUsados, 'Trava': i.calcDetail.regras.trava,
        'Meses Restantes': i.calcDetail.regras.mesesRestantes,
        'Mensal': i.mensal, 'Êxito': i.exito, 'Bônus': i.bonus, 'Total': i.total,
        'Origem': i.hasCompl ? 'Complementar' : (i.hasLanc ? 'Lançamento' : 'Benner'),
        'Detecção': i.detection === 'manual' ? 'Manual' : (i.detection === 'revisar' ? 'Revisar' : 'Automático')
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');
    downloadExcel(wb, `Faturamento_${RULES[currentSector].label}_${MESES[refMonth]}${refYear}.xlsx`);
}

// ==================== DEMO ====================
function getDemoBenner() {
    return [
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0001', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Em andamento', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0001', 'Ação': 'Cobrança', 'Rito (CIVEL)': 'Sumaríssimo', 'Advogado Interno': 'Eduardo', 'Empreendimento': 'GOETE', 'Spe': 'GOETE SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '3/6/2026', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'COBRANÇA', 'Resumo': '', 'Trava': '' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0002', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Em andamento', 'Natureza': 'Administrativo', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0002', 'Ação': 'Notificação', 'Rito (CIVEL)': 'Administrativo', 'Advogado Interno': 'Amanda', 'Empreendimento': 'DONA LAURA', 'Spe': 'DONA LAURA SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '5/22/2026', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'RESCISÃO', 'Resumo': '', 'Trava': '' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0003', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Em andamento', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0003', 'Ação': 'Indenizatória', 'Rito (CIVEL)': 'Comum', 'Advogado Interno': 'Luize', 'Empreendimento': 'MANOEL GOMES', 'Spe': 'MANOEL GOMES SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '12/6/2025', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'INDENIZAÇÃO', 'Resumo': 'Perícia judicial determinada', 'Trava': '' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0004', 'Área Do Direito': 'Trabalhista', 'Situação (TODOS)': 'Em andamento', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0004', 'Ação': 'Reclamação', 'Rito (CIVEL)': 'Sumaríssimo', 'Advogado Interno': 'Talita', 'Empreendimento': 'GOETE', 'Spe': 'GOETE SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '5/19/2026', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'VERBAS', 'Resumo': '', 'Trava': '' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0005', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Encerrado', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0005', 'Ação': 'Rescisão', 'Rito (CIVEL)': 'Ordinário', 'Advogado Interno': 'Eduardo', 'Empreendimento': 'FLORENCIO', 'Spe': 'FLORENCIO SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '10/6/2024', 'Data Encerramento (TODOS)': '4/6/2026', 'Tipo De Encerramento': 'Sentença', 'Objeto Principal (TODOS)': 'RESCISÃO', 'Resumo': '', 'Trava': '' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0006', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Em andamento', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0006', 'Ação': 'Cobrança', 'Rito (CIVEL)': 'Comum', 'Advogado Interno': 'Amanda', 'Empreendimento': 'GOETE', 'Spe': 'GOETE SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '6/6/2024', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'COBRANÇA', 'Resumo': '', 'Trava': 'Cobrança - Sem Trava' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0012', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Encerrado', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0012', 'Ação': 'Indenizatória', 'Rito (CIVEL)': 'Comum', 'Advogado Interno': 'Eduardo', 'Empreendimento': 'GOETE', 'Spe': 'GOETE SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '5/6/2025', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'Duplicidade - Erro de Cadastro', 'Resumo': '', 'Trava': '' },
        { 'Pasta  (FINS DE ANÁLISE INTERNA)': 'Pasta.0060', 'Área Do Direito': 'Cível', 'Situação (TODOS)': 'Em andamento', 'Natureza': 'Judicial', 'Número Do Processo  (FINS DE ANÁLISE INTERNA)': '1000000-00.2026.0.00.0060', 'Ação': 'Proposta Apartada', 'Rito (CIVEL)': 'Sumaríssimo', 'Advogado Interno': 'Amanda', 'Empreendimento': 'DONA LAURA', 'Spe': 'DONA LAURA SPE LTDA', 'Regional': 'Sul', 'Data Do Cadastro (TODOS)': '3/6/2026', 'Tipo De Encerramento': '', 'Objeto Principal (TODOS)': 'Proposta Apartada', 'Resumo': '', 'Trava': '' }
    ];
}

function loadDemoData() { bennerData = getDemoBenner(); edits = {}; $('card-benner').classList.add('success'); $('info-benner').querySelector('.file-name').textContent = 'Benner_Demo.xlsx'; if (currentSector) processAndReconcile(); showToast('success', 'Demo carregado'); }

function clearAllData() {
    bennerData = null; complementarData = null; allResults = []; edits = {};
    $('input-benner').value = ''; $('input-compl').value = '';
    $('card-benner').classList.remove('success'); $('card-compl').classList.remove('success');
    $('info-benner').style.display = 'none'; $('info-benner').querySelector('.file-name').textContent = '';
    $('info-compl').style.display = 'none'; $('info-compl').querySelector('.file-name').textContent = '';
    $('table-body').innerHTML = ''; $('empty-state').style.display = 'flex';
    $('sum-faturar').textContent = 'R$ 0,00'; $('sum-conciliados').textContent = '0'; $('sum-divergencias').textContent = '0';
    $('btn-export').setAttribute('disabled', 'true'); $('rules-content').innerHTML = '';
    document.querySelectorAll('.detail-row').forEach(r => r.remove());
    document.querySelectorAll('.clickable-row.expanded').forEach(r => r.classList.remove('expanded'));
    const searchEl = $('filter-search'); if (searchEl) searchEl.value = '';
    const statusEl = $('filter-status'); if (statusEl) statusEl.value = '';
    showToast('info', 'Dados limpos.');
}

function clearAllDataAndLanc() {
    lancamentos = []; localStorage.removeItem('lancamentos');
    renderLancamentos();
    clearAllData();
    showToast('info', 'Todos os dados limpos (incluindo lançamentos).');
}

function showToast(type, msg) {
    const icons = { success: 'i-check', error: 'i-x', info: 'i-info', warning: 'i-alert' };
    const t = document.createElement('div'); t.className = `toast toast-${type}`;
    t.innerHTML = `<svg class="icon"><use href="#${icons[type] || 'i-info'}"/></svg> ${msg}`;
    $('toast-container').appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 200); }, 3000);
}

init();
