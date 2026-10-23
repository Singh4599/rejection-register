// app.js — LV Spices Raw Material Rejection Register
// UI exactly like Raw Material Register
// Tracks rejected raw material batches with 10 rejection reasons

import { saveEntryToCloud, deleteEntryFromCloud, loadAllEntriesFromCloud, updateCloudBadge } from './firebase-config.js';

// ── REJECTION REASONS ──────────────────────────────────────────────────────────
const REJECTION_REASONS = [
  'Poor Quality / Inferior Material',
  'Damaged Packaging',
  'Torn / Open Bags',
  'Moisture / Wet Material',
  'Insect Infestation',
  'Fungus / Mould Contamination',
  'Foreign Matter / Impurities',
  'Unusual Smell / Colour',
  'Material Not as per Specification',
  'Expired / Shelf Life Issue'
];

// ── RAW MATERIALS & SUPPLIERS ─────────────────────────────────────────────────
const RAW_MATERIALS = [
  'Turmeric (Haldi)', 'Red Chilli (Lal Mirch)', 'Coriander (Dhania)',
  'Cumin (Jeera)', 'Black Pepper (Kali Mirch)', 'Mustard Seeds (Rai)',
  'Fenugreek (Methi)', 'Fennel Seeds (Saunf)', 'Cardamom (Elaichi)',
  'Dry Ginger (Sonth)', 'Cloves (Laung)', 'Cinnamon (Dalchini)',
  'Bay Leaf (Tej Patta)', 'Asafoetida (Hing)', 'Turmeric Powder (Haldi Powder)',
  'Chilli Powder (Mirch Powder)', 'Ajwain (Carom Seeds)', 'Kashmiri Chilli'
];

const SUPPLIERS = [
  'Ramesh Traders, Rajasthan',
  'Patel Spice Suppliers, Gujarat',
  'Kumar & Sons, Madhya Pradesh',
  'Sharma Agro Traders, Rajasthan',
  'Singh Brothers, Punjab',
  'National Spice Co., Delhi',
  'Agarwal Suppliers, UP',
  'Mehta Commodities, Gujarat'
];

const INSPECTORS = ['Rajesh Sharma', 'Vishal Chaturvedi', 'Mukesh Vora'];

const CORRECTIVE_ACTIONS = [
  'Returned to Supplier',
  'Destroyed / Disposed',
  'Released after Re-Verification',
  'Quarantined – Pending Decision',
  'Partial Acceptance – Sorted'
];

// ── STATE ─────────────────────────────────────────────────────────────────────
let allEntries = [];
let filteredEntries = [];
let currentView = 'register';
let searchQuery = '';
let activeMonth = 'ALL';
let editingId = null;
let srCounter = 1;

const MONTHS = ['APRIL','MAY','JUNE','JULY','AUG','SEP','OCT'];
const MONTH_MAP = {
  'APRIL':'2026-04','MAY':'2026-05','JUNE':'2026-06','JULY':'2026-07',
  'AUG':'2026-08','SEP':'2026-09','OCT':'2026-10'
};
const MONTH_LABEL = {
  'APRIL':'April 2026','MAY':'May 2026','JUNE':'June 2026','JULY':'July 2026',
  'AUG':'Aug 2026','SEP':'Sep 2026','OCT':'Oct 2026'
};

function seedRng(seed) {
  let s = seed; return () => { s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff; };
}
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function fmtDate(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function getMonthKey(dateStr) {
  const m = dateStr.substring(5,7);
  return Object.entries(MONTH_MAP).find(([k,v]) => v === `2026-${m}`)?.[0] || 'OCT';
}

// ── DATA GENERATION ───────────────────────────────────────────────────────────
function generateEntries() {
  const entries = [];
  const today = new Date();
  let sr = 1;

  // Generate 2-4 rejections per month from April 2026
  MONTHS.forEach(mk => {
    const prefix = MONTH_MAP[mk];
    const [yr, mo] = prefix.split('-').map(Number);
    const firstOfMonth = new Date(yr, mo-1, 1);
    if (firstOfMonth > today) return;

    const count = 2 + Math.floor(seedRng(yr*100+mo)() * 3); // 2-4 per month
    for (let i = 0; i < count; i++) {
      const rng = seedRng(yr * 1000 + mo * 37 + i * 13);
      const day = 2 + Math.floor(rng() * 26);
      const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(Math.min(day, 28)).padStart(2,'0')}`;
      const rejDate = new Date(dateStr + 'T00:00:00');
      if (rejDate > today) return;

      const reasonIdx = Math.floor(rng() * REJECTION_REASONS.length);
      const matIdx    = Math.floor(rng() * RAW_MATERIALS.length);
      const supIdx    = Math.floor(rng() * SUPPLIERS.length);
      const inspIdx   = Math.floor(rng() * INSPECTORS.length);
      const caIdx     = Math.floor(rng() * CORRECTIVE_ACTIONS.length);
      const qty       = (5 + Math.floor(rng() * 95));
      const invNo     = `INV-${yr.toString().slice(2)}${String(mo).padStart(2,'0')}-${String(Math.floor(1000+rng()*9000))}`;
      const batchNo   = `RM-${yr.toString().slice(2)}${String(mo).padStart(2,'0')}${String(Math.floor(100+rng()*900))}`;

      entries.push({
        id: `RR-${dateStr}-${String(i+1).padStart(2,'0')}`,
        srNo: sr++,
        date: dateStr,
        displayDate: fmtDate(dateStr),
        monthKey: mk,
        rawMaterial: RAW_MATERIALS[matIdx],
        supplierName: SUPPLIERS[supIdx],
        invoiceNo: invNo,
        batchNo,
        quantityKg: qty,
        rejectionReason: REJECTION_REASONS[reasonIdx],
        correctiveAction: CORRECTIVE_ACTIONS[caIdx],
        inspectedBy: INSPECTORS[inspIdx],
        remarks: '',
        isGenerated: true
      });
    }
  });
  return entries.sort((a,b) => b.date.localeCompare(a.date));
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const cloudData = await loadAllEntriesFromCloud();
    const cloudMap = {};
    cloudData.forEach(e => { cloudMap[e.id] = e; });
    const gen = generateEntries();
    gen.forEach(e => {
      if (!cloudMap[e.id]) cloudMap[e.id] = e;
      else cloudMap[e.id] = { ...e, ...cloudMap[e.id] };
    });
    allEntries = Object.values(cloudMap).sort((a,b) => b.date.localeCompare(a.date));
    allEntries.forEach((e,i) => e.srNo = i+1);
  } catch(err) {
    allEntries = generateEntries();
  }
  updateStats();
  renderMonthTabs();
  applyFilter();
  switchView('register');
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const el = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  el('stat-total', allEntries.length);
  el('stat-this-month', allEntries.filter(e => {
    const cur = new Date().getMonth();
    const keys = ['','','','APRIL','MAY','JUNE','JULY','AUG','SEP','OCT','NOV','DEC'];
    return e.monthKey === keys[cur+1] || e.monthKey === keys[cur] ;
  }).length);

  const totalKg = allEntries.reduce((s,e) => s + (Number(e.quantityKg)||0), 0);
  el('stat-kg', totalKg.toLocaleString() + ' KG');

  // Top reason
  const reasonCount = {};
  allEntries.forEach(e => { reasonCount[e.rejectionReason] = (reasonCount[e.rejectionReason]||0)+1; });
  const topReason = Object.entries(reasonCount).sort((a,b) => b[1]-a[1])[0];
  el('stat-top-reason', topReason ? topReason[0].split('/')[0].trim() : '—');
}

// ── MONTH TABS ────────────────────────────────────────────────────────────────
function renderMonthTabs() {
  const bar = document.getElementById('month-tab-bar');
  if (!bar) return;
  const allBtn = `<button class="month-tab-btn ${activeMonth==='ALL'?'active':''}" onclick="setMonth('ALL')">All</button>`;
  const tabs = MONTHS.map(mk => {
    const cnt = allEntries.filter(e => e.monthKey === mk).length;
    if (!cnt) return '';
    return `<button class="month-tab-btn ${activeMonth===mk?'active':''}" onclick="setMonth('${mk}')">${mk} <span class="month-tab-cnt">${cnt}</span></button>`;
  }).join('');
  bar.innerHTML = allBtn + tabs;
}

window.setMonth = function(mk) {
  activeMonth = mk;
  renderMonthTabs();
  applyFilter();
};

// ── FILTER ────────────────────────────────────────────────────────────────────
function applyFilter() {
  const q = searchQuery.toLowerCase();
  filteredEntries = allEntries.filter(e => {
    const inMonth = activeMonth === 'ALL' || e.monthKey === activeMonth;
    if (!q) return inMonth;
    return inMonth && (
      e.rawMaterial?.toLowerCase().includes(q) ||
      e.supplierName?.toLowerCase().includes(q) ||
      e.invoiceNo?.toLowerCase().includes(q) ||
      e.rejectionReason?.toLowerCase().includes(q) ||
      e.batchNo?.toLowerCase().includes(q)
    );
  });
  renderTable();
}

window.onSearch = function(v) { searchQuery = v; applyFilter(); };

// ── TABLE RENDER ──────────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('rejection-tbody');
  if (!tbody) return;

  if (!filteredEntries.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state-row">
      No rejection records found. <a href="javascript:void(0)" onclick="switchView('add')" style="color:var(--danger);font-weight:700;">+ Add New Record</a>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filteredEntries.map(e => {
    const reasonClass = getRejectionClass(e.rejectionReason);
    const caClass = getCAClass(e.correctiveAction);
    return `
    <tr class="entry-row" id="row-${e.id}">
      <td class="col-sr">${e.srNo}</td>
      <td class="col-date"><strong>${esc(e.displayDate)}</strong></td>
      <td class="col-material">
        <div class="material-name-primary">${esc(e.rawMaterial)}</div>
        <div class="lot-badge">Batch: ${esc(e.batchNo)}</div>
      </td>
      <td class="col-supplier">
        <div class="supplier-name">${esc(e.supplierName)}</div>
        <div class="invoice-ref">${esc(e.invoiceNo)}</div>
      </td>
      <td class="col-qty"><strong>${e.quantityKg} KG</strong></td>
      <td class="col-reason">
        <span class="rejection-reason-badge ${reasonClass}">${esc(e.rejectionReason)}</span>
      </td>
      <td class="col-ca">
        <span class="corrective-action-badge ${caClass}">${esc(e.correctiveAction)}</span>
      </td>
      <td class="col-inspector">${esc(e.inspectedBy)}</td>
      <td class="col-remarks">${esc(e.remarks) || '<span style="color:#CBD5E1">—</span>'}</td>
      <td class="col-actions">
        <button class="action-btn edit-btn" onclick="openEditModal('${e.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="action-btn delete-btn" onclick="deleteEntry('${e.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function getRejectionClass(reason) {
  if (!reason) return '';
  const r = reason.toLowerCase();
  if (r.includes('insect') || r.includes('fungus') || r.includes('mould')) return 'reason-critical';
  if (r.includes('expired') || r.includes('foreign') || r.includes('smell')) return 'reason-warning';
  if (r.includes('moisture') || r.includes('torn') || r.includes('damaged')) return 'reason-orange';
  return 'reason-default';
}

function getCAClass(ca) {
  if (!ca) return '';
  const c = ca.toLowerCase();
  if (c.includes('returned')) return 'ca-returned';
  if (c.includes('destroy')) return 'ca-destroyed';
  if (c.includes('released')) return 'ca-released';
  if (c.includes('quarantine')) return 'ca-quarantine';
  return 'ca-default';
}

// ── VIEW SWITCHER ─────────────────────────────────────────────────────────────
window.switchView = function(view) {
  currentView = view;
  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`view-${view}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  const navEl = document.querySelector(`.nav-link[data-view="${view}"]`);
  if (navEl) navEl.classList.add('active');

  if (view === 'add' && !editingId) resetAddForm();
  closeSidebar();
};

// ── SIDEBAR TOGGLE ────────────────────────────────────────────────────────────
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
};
window.closeSidebar = function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
};

// ── ADD FORM ──────────────────────────────────────────────────────────────────
function resetAddForm() {
  editingId = null;
  const g = id => document.getElementById(id);
  if (g('form-title')) g('form-title').textContent = 'New Rejection Entry';
  if (g('f-date')) g('f-date').value = new Date().toISOString().split('T')[0];
  if (g('f-material')) g('f-material').value = '';
  if (g('f-supplier')) g('f-supplier').value = '';
  if (g('f-invoice')) g('f-invoice').value = '';
  if (g('f-batch')) g('f-batch').value = '';
  if (g('f-qty')) g('f-qty').value = '';
  if (g('f-inspector')) g('f-inspector').value = INSPECTORS[0];
  if (g('f-remarks')) g('f-remarks').value = '';
  // Clear reason radio and CA radio
  document.querySelectorAll('input[name="f-reason"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="f-ca"]').forEach(r => r.checked = false);
}

window.openEditModal = function(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return;
  editingId = id;
  const g = i => document.getElementById(i);
  if (g('form-title')) g('form-title').textContent = 'Edit Rejection Record';
  if (g('f-date')) g('f-date').value = entry.date;
  if (g('f-material')) g('f-material').value = entry.rawMaterial;
  if (g('f-supplier')) g('f-supplier').value = entry.supplierName;
  if (g('f-invoice')) g('f-invoice').value = entry.invoiceNo;
  if (g('f-batch')) g('f-batch').value = entry.batchNo;
  if (g('f-qty')) g('f-qty').value = entry.quantityKg;
  if (g('f-inspector')) g('f-inspector').value = entry.inspectedBy;
  if (g('f-remarks')) g('f-remarks').value = entry.remarks || '';

  document.querySelectorAll('input[name="f-reason"]').forEach(r => {
    r.checked = r.value === entry.rejectionReason;
  });
  document.querySelectorAll('input[name="f-ca"]').forEach(r => {
    r.checked = r.value === entry.correctiveAction;
  });
  switchView('add');
};

window.saveEntry = async function() {
  const g = i => document.getElementById(i);
  const dateVal = g('f-date')?.value;
  const material = g('f-material')?.value?.trim();
  const supplier = g('f-supplier')?.value?.trim();
  if (!dateVal || !material || !supplier) {
    alert('Date, Raw Material and Supplier are required.');
    return;
  }

  const selectedReason = document.querySelector('input[name="f-reason"]:checked')?.value;
  const selectedCA     = document.querySelector('input[name="f-ca"]:checked')?.value;
  if (!selectedReason) { alert('Please select a Rejection Reason.'); return; }
  if (!selectedCA)     { alert('Please select a Corrective Action.'); return; }

  const mk = getMonthKey(dateVal);
  const id = editingId || `RR-${dateVal}-${Date.now().toString().slice(-5)}`;

  const entry = {
    id, date: dateVal, displayDate: fmtDate(dateVal), monthKey: mk,
    rawMaterial: material,
    supplierName: supplier,
    invoiceNo: g('f-invoice')?.value?.trim() || '',
    batchNo: g('f-batch')?.value?.trim() || '',
    quantityKg: Number(g('f-qty')?.value) || 0,
    rejectionReason: selectedReason,
    correctiveAction: selectedCA,
    inspectedBy: g('f-inspector')?.value || INSPECTORS[0],
    remarks: g('f-remarks')?.value?.trim() || '',
    isGenerated: false
  };

  if (editingId) {
    const idx = allEntries.findIndex(e => e.id === editingId);
    if (idx !== -1) allEntries[idx] = entry;
  } else {
    allEntries.unshift(entry);
    allEntries.sort((a,b) => b.date.localeCompare(a.date));
    allEntries.forEach((e,i) => e.srNo = i+1);
  }

  const btn = g('save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  await saveEntryToCloud(entry);
  if (btn) { btn.disabled = false; btn.textContent = 'Save Record'; }

  editingId = null;
  updateStats();
  renderMonthTabs();
  applyFilter();
  switchView('register');
};

window.deleteEntry = async function(id) {
  if (!confirm('Delete this rejection record?')) return;
  allEntries = allEntries.filter(e => e.id !== id);
  allEntries.forEach((e,i) => e.srNo = i+1);
  await deleteEntryFromCloud(id);
  updateStats();
  renderMonthTabs();
  applyFilter();
};

window.cancelForm = function() { switchView('register'); editingId = null; };

// ── EXCEL EXPORT ──────────────────────────────────────────────────────────────
window.exportExcel = function() {
  const rows = filteredEntries.length ? filteredEntries : allEntries;
  if (!rows.length) { alert('No records to export'); return; }
  const headers = [
    'Sr.No', 'Date', 'Raw Material', 'Supplier Name', 'Invoice No.',
    'Batch No.', 'Qty Rejected (KG)', 'Reason for Rejection',
    'Corrective Action', 'Inspected By', 'Remarks'
  ];
  const data = [headers, ...rows.map(e => [
    e.srNo, e.displayDate, e.rawMaterial, e.supplierName,
    e.invoiceNo, e.batchNo, e.quantityKg,
    e.rejectionReason, e.correctiveAction, e.inspectedBy, e.remarks
  ])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [5,11,20,22,14,14,12,30,24,16,20].map(w => ({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rejection Register');
  XLSX.writeFile(wb, 'LV_Spices_Rejection_Register.xlsx');
};

window.printRegister = function() { window.print(); };

document.addEventListener('DOMContentLoaded', () => { init(); });
