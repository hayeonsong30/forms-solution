const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const globalDefaults = {
  language: '일본어', ocr: 'Gemini 2.5 Flash', review: true, confidence: 85,
  keyStyle: 'snake', blank: 'null', coords: 'normalized',
  trueMarks: ['✓', 'V'], falseMarks: ['X'],
};

const state = {
  fields: [
    field('application_date', '신청일', 'date', 422, 127, 170, 30, { required: true }),
    field('applicant_name', '신청자명', 'text', 158, 232, 170, 35, { required: true }),
    field('phone_number', '전화번호', 'text', 424, 232, 168, 35, { required: true }),
    field('organization', '단체명', 'text', 158, 276, 170, 35),
    field('participants', '이용 인원', 'number', 424, 276, 120, 35, { required: true }),
    field('usage_date', '이용일', 'date', 158, 402, 170, 35, { required: true }),
    field('usage_time', '이용 시간', 'time', 424, 402, 168, 35, { required: true }),
    field('facility', '이용 시설', 'choice', 158, 447, 434, 42, { required: true, choices: [
      { label: '회의실', value: 'meeting_room', region: { x: 170, y: 456, w: 22, h: 22 } },
      { label: '다목적실', value: 'multipurpose_room', region: { x: 261, y: 456, w: 22, h: 22 } },
      { label: '연수실', value: 'training_room', region: { x: 365, y: 456, w: 22, h: 22 } }
    ], choiceMode: 'single', choiceDetection: 'stroke', choiceConflict: 'review', multiCsvMode: 'delimiter' }),
    field('purpose', '이용 목적', 'text', 158, 500, 434, 82, { required: true, lineMode: 'multi' }),
    field('terms_agreed', '이용 규약 동의', 'check', 74, 663, 34, 30, { required: true }),
    field('applicant_signature', '신청자 서명', 'text', 166, 762, 170, 38, { required: true }),
  ],
  selected: [],
  repeats: [],
  zoom: .85,
  history: [],
  future: [],
  nextId: 3,
  optionDrawing: null,
};
const sampleTemplateState = JSON.stringify({ fields: state.fields, repeats: state.repeats });
let formName = '시설 점검 기록지';
let fieldClipboard = [];
let editorReadOnly = false;
let editorDocumentUrl = '';
let editorHasDocument = true;
let creatingBlankForm = false;
let editingRepeatId = null;

function field(key, label, type, x, y, w, h, extra = {}) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    key, label, type, x, y, w, h,
    required: false, language: globalDefaults.language, lineMode: 'single',
    suggested: false, locked: false,
    check: { trueMarks: [...globalDefaults.trueMarks], falseMarks: [...globalDefaults.falseMarks], blank: globalDefaults.blank },
    number: { format: 'integer', decimals: 1, allowNegative: false, unit: '', min: null, max: null },
    date: { input: 'auto', missingYear: 'written', output: 'iso' },
    time: { input: 'auto', minuteStep: 'free', output: 'hhmm' },
    choices: [{ label: '합격', value: 'pass', region: null }, { label: '불합격', value: 'fail', region: null }],
    choiceMode: 'single', choiceDetection: 'stroke', choiceConflict: 'review', multiCsvMode: 'delimiter',
    ...extra,
  };
}

const paper = $('#formPaper');
const layer = $('#fieldLayer');
const tree = $('#fieldTree');

function buildRows() {
  if ($('#paperRows')) $('#paperRows').innerHTML = Array.from({ length: 25 }, (_, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td>${'<td></td>'.repeat(9)}</tr>`).join('');
}

function symbolFor(type) { return ({ text: 'T', number: '#', date: '日', time: '時', check: '✓', choice: '●', repeat: '↻' })[type] || '◇'; }
function typeName(type) { return ({ text: 'Text', number: 'Number', date: 'Date', time: 'Time', check: 'Check', choice: 'Selection', repeat: 'Repeat' })[type] || type; }
function fieldTypeName(f) { return f.type === 'choice' ? (f.choiceMode === 'multiple' ? 'Multi Selection' : 'Single Selection') : typeName(f.type); }
function slug(label) {
  const map = { '검사일': 'inspection_date', '담당자': 'inspector', '시간': 'time', '포장형태': 'package_type', '점검자': 'inspector_name', '합격': 'ok', '불합격': 'ng', '수량': 'quantity', '품목코드': 'item_code' };
  return map[label] || label.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_').replace(/^_|_$/g, '') || `field_${String(state.nextId).padStart(3, '0')}`;
}

function snapshot() {
  state.history.push(JSON.stringify({ fields: state.fields, repeats: state.repeats }));
  if (state.history.length > 40) state.history.shift();
  state.future = [];
}

function restore(raw) {
  const data = JSON.parse(raw); state.fields = data.fields; state.repeats = data.repeats; state.selected = [];
  render();
}

function render() {
  renderFields(); renderTree(); renderProperties();
  $('#fieldCount').textContent = state.fields.length + state.repeats.length;
  $('#selectionStatus').textContent = state.selected.length ? `${state.selected.length}개 필드 선택` : '선택 없음';
  $('#paperScale').style.transform = `scale(${state.zoom})`;
  $('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
}

function renderFields() {
  layer.innerHTML = '';
  state.repeats.forEach(r => {
    const el = document.createElement('div');
    el.className = 'field-box repeat';
    el.style.setProperty('--repeat-row-height', `${r.rowHeight || 31}px`);
    Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    el.innerHTML = `<span class="field-label">↻ ${r.label} · 기준행 × ${r.rows}행</span><span class="field-key">${r.key}[] · 행 간격 자동 ${r.rowHeight || 31}px</span>`;
    layer.append(el);
  });
  state.fields.forEach(f => {
    const el = document.createElement('div');
    el.className = `field-box ${f.type === 'check' ? 'check' : ''} ${f.suggested ? 'suggested' : ''} ${state.selected.includes(f.id) ? (state.selected.length > 1 ? 'multi-selected' : 'selected') : ''}`;
    el.dataset.id = f.id;
    Object.assign(el.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    el.innerHTML = `<span class="field-label">${f.suggested ? '✦ ' : ''}${f.label}</span><span class="field-key">${f.key} · ${fieldTypeName(f)}</span><i class="resize-handle"></i>`;
    el.addEventListener('pointerdown', startFieldPointer);
    el.addEventListener('click', e => { e.stopPropagation(); selectField(f.id, e.shiftKey || e.metaKey || e.ctrlKey); });
    layer.append(el);
    if (f.type === 'choice') (f.choices || []).forEach((option, index) => {
      if (!option.region) return;
      const hit = document.createElement('div'); hit.className = `option-region ${state.selected.includes(f.id) ? 'editable' : ''}`;
      hit.dataset.fieldId = f.id; hit.dataset.optionIndex = index;
      Object.assign(hit.style, { left: `${option.region.x}px`, top: `${option.region.y}px`, width: `${option.region.w}px`, height: `${option.region.h}px` });
      hit.innerHTML = `<span>${option.label}</span><b>${index + 1}</b>`; hit.addEventListener('pointerdown', startOptionRegionMove); layer.append(hit);
    });
  });
}

function renderTree() {
  const q = $('#fieldSearch').value.trim().toLowerCase();
  const items = state.fields.filter(f => `${f.label} ${f.key}`.toLowerCase().includes(q));
  tree.innerHTML = state.repeats.map(r => `<div class="tree-item repeat" data-repeat="${r.id}"><span class="tree-symbol">↻</span><span><b>${r.label}</b><small>${r.key}[] · ${r.rows}행</small></span></div>`).join('') + items.map(f => `
    <div class="tree-item ${state.selected.includes(f.id) ? 'selected' : ''} ${f.suggested ? 'suggested' : ''}" data-id="${f.id}" draggable="${!editorReadOnly}">
      <span class="tree-drag" title="드래그하여 순서 변경">⋮⋮</span><span class="tree-symbol">${symbolFor(f.type)}</span><span><b>${f.label}</b><small>${f.key} · ${fieldTypeName(f)}</small></span>
      <span class="tree-actions"><button data-action="copy">⧉</button><button data-action="delete">×</button></span>
    </div>`).join('');
  $$('.tree-item[data-id]', tree).forEach(el => {
    el.onclick = e => {
      const action = e.target.dataset.action;
      if (action === 'copy') return duplicateField(el.dataset.id);
      if (action === 'delete') return deleteFields([el.dataset.id]);
      selectField(el.dataset.id, e.shiftKey || e.metaKey || e.ctrlKey);
      if (e.detail === 2) focusField(el.dataset.id);
    };
    el.ondragstart = e => { if (editorReadOnly) return e.preventDefault(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('field/id', el.dataset.id); el.classList.add('dragging'); };
    el.ondragend = () => $$('.tree-item', tree).forEach(item => item.classList.remove('dragging','drag-target'));
    el.ondragover = e => { if (editorReadOnly) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; $$('.tree-item', tree).forEach(item => item.classList.remove('drag-target')); el.classList.add('drag-target'); };
    el.ondrop = e => { if (editorReadOnly) return; e.preventDefault(); const sourceId = e.dataTransfer.getData('field/id'); const targetId = el.dataset.id; if (!sourceId || sourceId === targetId) return; snapshot(); const sourceIndex = state.fields.findIndex(f => f.id === sourceId); const targetIndex = state.fields.findIndex(f => f.id === targetId); const [moved] = state.fields.splice(sourceIndex, 1); state.fields.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, moved); render(); showToast(`${moved.label} 필드 순서를 변경했습니다.`); };
  });
  $$('.tree-item[data-repeat]', tree).forEach(el => { el.onclick = () => openRepeatDialog(el.dataset.repeat); });
}

function renderProperties() {
  const f = state.fields.find(x => x.id === state.selected.at(-1));
  $('#emptyState').hidden = !!f; $('#properties').hidden = !f;
  if (!f) return;
  $('#propertyTitle').textContent = f.label;
  $('#typeChip').textContent = fieldTypeName(f);
  $('#propLabel').value = f.label; $('#propKey').value = f.key; $('#propType').value = f.type;
  $('#propRequired').checked = f.required; $('#blankPolicy').value = f.check.blank;
  $('#textSettings').hidden = f.type !== 'text'; $('#numberSettings').hidden = f.type !== 'number'; $('#checkSettings').hidden = f.type !== 'check';
  $('#dateSettings').hidden = f.type !== 'date'; $('#timeSettings').hidden = f.type !== 'time'; $('#choiceSettings').hidden = f.type !== 'choice';
  f.number ||= { format: 'integer', decimals: 1, allowNegative: false, unit: '', min: null, max: null };
  f.date ||= { input: 'auto', missingYear: 'written', output: 'iso' }; f.time ||= { input: 'auto', minuteStep: 'free', output: 'hhmm' };
  $('#numberFormat').value = f.number.format; $('#decimalPlaces').value = f.number.decimals; $('#decimalPlacesRow').hidden = f.number.format !== 'decimal';
  $('#allowNegative').checked = f.number.allowNegative; $('#numberUnit').value = f.number.unit; $('#numberMin').value = f.number.min ?? ''; $('#numberMax').value = f.number.max ?? '';
  $('#dateInputFormat').value = f.date.input; $('#dateMissingYear').value = f.date.missingYear; $('#dateOutputFormat').value = f.date.output;
  $('#timeInputFormat').value = f.time.input; $('#minuteStep').value = f.time.minuteStep; $('#timeOutputFormat').value = f.time.output;
  $('#fieldTop').value = Math.round(f.y); $('#fieldLeft').value = Math.round(f.x); $('#fieldWidth').value = Math.round(f.w); $('#fieldHeight').value = Math.round(f.h);
  if (f.type === 'choice') renderChoiceOptions(f);
  $('#choiceConflict').value = f.choiceConflict || 'review';
  $('#multiCsvMode').value = f.multiCsvMode || 'delimiter'; updateChoiceModeUI(f);
  $$('#lineMode button').forEach(b => b.classList.toggle('active', b.dataset.value === f.lineMode));
  $$('#trueMarks button').forEach(b => b.classList.toggle('selected', f.check.trueMarks.includes(b.textContent)));
  $$('#falseMarks button').forEach(b => b.classList.toggle('selected', f.check.falseMarks.includes(b.textContent)));
}

function renderChoiceOptions(f) {
  $('#choiceOptionsList').innerHTML = (f.choices || []).map((option, index) => `<div class="choice-option-row" data-option-index="${index}">
    <span class="option-number">${index + 1}</span><label>표시명<input data-option-prop="label" value="${escapeHtml(option.label)}"></label>
    <label>저장값<input data-option-prop="value" value="${escapeHtml(option.value)}"></label>
    <button class="set-option-region ${option.region ? 'connected' : ''}" data-set-region="${index}">${option.region ? '✓ 영역 연결됨' : '＋ 영역 지정'}</button>
    <button class="remove-option" data-remove-option="${index}">×</button></div>`).join('');
}

function updateChoiceModeUI(f) {
  const multiple = f.choiceMode === 'multiple';
  $$('#choiceMode button').forEach(b => b.classList.toggle('active', b.dataset.value === (f.choiceMode || 'single')));
  $('#choiceConflictRow').hidden = multiple; $('#multiCsvRow').hidden = !multiple;
  $('#choiceModeHint').textContent = multiple ? '선택된 모든 옵션 저장값이 배열로 저장됩니다.' : '선택 결과는 상위 데이터 키에 옵션 저장값 하나로 저장됩니다.';
}

function selectField(id, additive = false) {
  if (additive) state.selected = state.selected.includes(id) ? state.selected.filter(x => x !== id) : [...state.selected, id];
  else state.selected = [id];
  activateSettingsTab('field');
  render();
}

function addField(type, x, y) {
  if (editorReadOnly) return showToast('조회 전용 양식은 수정할 수 없습니다.');
  if (!editorHasDocument) return showToast('먼저 중앙 영역에 빈 양식 PDF를 업로드해 주세요.');
  const defaults = {
    text: ['새 텍스트', 'text', 130, 42], number: ['새 숫자', 'number', 90, 42],
    date: ['새 날짜', 'date', 120, 42], time: ['새 시간', 'time', 90, 42],
    check: ['새 체크', 'check', 52, 42], choice: ['새 선택', 'choice', 150, 42]
  };
  if (type === 'repeat') return openRepeatDialog();
  snapshot();
  const [label, key, w, h] = defaults[type];
  const f = field(`${key}_${String(state.nextId++).padStart(3, '0')}`, label, type, Math.max(0, Math.min(700 - w, x - w / 2)), Math.max(0, Math.min(990 - h, y - h / 2)), w, h);
  state.fields.push(f); state.selected = [f.id]; render();
  setTimeout(() => { $('#propLabel').focus(); $('#propLabel').select(); }, 20);
}

function startOptionRegionDraw(e) {
  if (!state.optionDrawing) return;
  e.preventDefault(); e.stopPropagation();
  const rect = paper.getBoundingClientRect();
  const origin = { x: (e.clientX - rect.left) / state.zoom, y: (e.clientY - rect.top) / state.zoom };
  const guide = document.createElement('div'); guide.className = 'option-region drawing'; layer.append(guide);
  const move = ev => {
    const x = (ev.clientX - rect.left) / state.zoom, y = (ev.clientY - rect.top) / state.zoom;
    Object.assign(guide.style, { left: `${Math.min(origin.x, x)}px`, top: `${Math.min(origin.y, y)}px`, width: `${Math.max(12, Math.abs(x - origin.x))}px`, height: `${Math.max(12, Math.abs(y - origin.y))}px` });
  };
  const up = ev => {
    const x = (ev.clientX - rect.left) / state.zoom, y = (ev.clientY - rect.top) / state.zoom;
    const f = state.fields.find(v => v.id === state.optionDrawing.fieldId);
    if (f) { snapshot(); f.choices[state.optionDrawing.optionIndex].region = { x: Math.min(origin.x, x), y: Math.min(origin.y, y), w: Math.max(12, Math.abs(x - origin.x)), h: Math.max(12, Math.abs(y - origin.y)) }; }
    state.optionDrawing = null; document.body.classList.remove('option-drawing'); paper.dataset.justDrew = '1';
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); render(); showToast('선택지 판정 영역을 연결했습니다.');
  };
  move(e); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function startOptionRegionMove(e) {
  if (editorReadOnly) return;
  const f = state.fields.find(item => item.id === e.currentTarget.dataset.fieldId); const option = f?.choices?.[+e.currentTarget.dataset.optionIndex];
  if (!f || !option?.region || !state.selected.includes(f.id)) return;
  e.preventDefault(); e.stopPropagation(); snapshot();
  const start = { x:e.clientX, y:e.clientY, left:option.region.x, top:option.region.y };
  const move = ev => { option.region.x = Math.max(0, Math.min(700 - option.region.w, start.left + (ev.clientX - start.x) / state.zoom)); option.region.y = Math.max(0, Math.min(990 - option.region.h, start.top + (ev.clientY - start.y) / state.zoom)); renderFields(); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); renderProperties(); showToast('선택지 영역 위치를 변경했습니다.'); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function startFieldPointer(e) {
  if (editorReadOnly) return;
  if (e.target.classList.contains('resize-handle')) return startResize(e);
  const id = e.currentTarget.dataset.id; const f = state.fields.find(x => x.id === id); if (!f || f.locked) return;
  if (!state.selected.includes(id)) selectField(id, e.shiftKey);
  e.preventDefault(); snapshot();
  const start = { x: e.clientX, y: e.clientY, positions: state.selected.map(fid => { const x = state.fields.find(v => v.id === fid); return [fid, x.x, x.y]; }) };
  const move = ev => { const dx = (ev.clientX - start.x) / state.zoom, dy = (ev.clientY - start.y) / state.zoom; start.positions.forEach(([fid, x, y]) => { const item = state.fields.find(v => v.id === fid); item.x = Math.max(0, Math.min(700 - item.w, x + dx)); item.y = Math.max(0, Math.min(990 - item.h, y + dy)); }); renderFields(); renderProperties(); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); renderTree(); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function startResize(e) {
  e.stopPropagation(); e.preventDefault(); const f = state.fields.find(x => x.id === e.currentTarget.dataset.id); snapshot();
  const start = { x: e.clientX, y: e.clientY, w: f.w, h: f.h };
  const move = ev => { f.w = Math.max(28, Math.min(700 - f.x, start.w + (ev.clientX - start.x) / state.zoom)); f.h = Math.max(20, Math.min(990 - f.y, start.h + (ev.clientY - start.y) / state.zoom)); renderFields(); renderProperties(); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function duplicateField(id = state.selected.at(-1)) {
  const f = state.fields.find(x => x.id === id); if (!f) return; snapshot();
  const identity = nextCopyIdentity(f);
  const copy = field(identity.key, identity.label, f.type, f.x + 10, f.y + 10, f.w, f.h, { ...structuredClone(f), id: crypto.randomUUID?.() || `${Date.now()}`, key: identity.key, label: identity.label, x: f.x + 10, y: f.y + 10, suggested: false });
  state.fields.push(copy); state.selected = [copy.id]; render(); showToast('필드를 복사했습니다.');
}

function copySelectedFields() {
  fieldClipboard = state.selected.map(id => state.fields.find(f => f.id === id)).filter(Boolean).map(f => structuredClone(f));
  if (fieldClipboard.length) showToast(`${fieldClipboard.length}개 필드를 복사했습니다.`);
}

function pasteCopiedFields() {
  if (!fieldClipboard.length) return showToast('복사한 필드가 없습니다.');
  snapshot();
  const copies = fieldClipboard.map(original => { const identity = nextCopyIdentity(original); const copy = { ...structuredClone(original), id:crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, key:identity.key, label:identity.label, x:Math.min(700-original.w,original.x+14), y:Math.min(990-original.h,original.y+14), suggested:false }; state.fields.push(copy); return copy; });
  state.selected = copies.map(f => f.id); render(); showToast(`${copies.length}개 필드를 붙여넣었습니다.`);
}

function uniqueKey(base) { let key = base, n = 2; while (state.fields.some(f => f.key === key)) key = `${base}_${n++}`; return key; }
function nextCopyIdentity(original) {
  const numbered = original.label.match(/^(.*)\s(\d+)$/); const baseLabel = numbered ? numbered[1] : original.label;
  const baseKey = numbered ? original.key.replace(/_\d+$/, '') : original.key;
  let n = 1; while (state.fields.some(f => f.label === `${baseLabel} ${n}`)) n++;
  return { label: `${baseLabel} ${n}`, key: uniqueKey(`${baseKey}_${n}`) };
}
function deleteFields(ids = state.selected) { if (!ids.length) return; snapshot(); state.fields = state.fields.filter(f => !ids.includes(f.id)); state.selected = []; render(); showToast(`${ids.length}개 필드를 삭제했습니다.`); }

function openRepeatDialog(repeatId = null) {
  if (editorReadOnly) return showToast('조회 전용 양식은 수정할 수 없습니다.');
  const repeat = repeatId ? state.repeats.find(r => r.id === repeatId) : null; editingRepeatId = repeat?.id || null;
  if (repeat) state.selected = [...repeat.fieldIds];
  if (state.selected.length < 2) { showToast('첫 행의 필드를 2개 이상 선택해 주세요.'); return; }
  const selected = state.selected.map(id => state.fields.find(f => f.id === id)).filter(Boolean).sort((a, b) => a.x - b.x);
  const firstRowTop = Math.min(...selected.map(f => f.y)); const firstRowBottom = Math.max(...selected.map(f => f.y + f.h)); const firstRowHeight = Math.max(16, Math.round(firstRowBottom - firstRowTop));
  if (repeat) { $('#repeatLabel').value = repeat.label; $('#repeatKey').value = repeat.key; $('#repeatRows').value = repeat.rows; $('#repeatBlank').value = repeat.blankPolicy; }
  else { $('#repeatLabel').value = '검사 내역'; $('#repeatKey').value = 'inspection_rows'; $('#repeatRows').value = 25; $('#repeatBlank').value = 'exclude'; }
  $('#repeatRowHeight').value = firstRowHeight; $('#repeatRowStatus').textContent = '첫 번째 행 크기를 동일하게 반복합니다'; $('#repeatRowValue').textContent = `선택 영역 높이 · ${firstRowHeight}px`;
  $('#repeatDialog').querySelector('h2').textContent = repeat ? '반복행 편집' : '반복행으로 묶기'; $('#confirmRepeat').textContent = repeat ? '변경사항 저장' : '반복행 생성';
  $('#selectedColumns').innerHTML = selected.map((f, i) => `<span><b>${i + 1}</b>${f.label}<small>${f.key}</small></span>`).join('');
  $('#repeatKeysPreview').textContent = selected.map(f => f.key).join(', ');
  updateRepeatPreview();
  $('#repeatDialog').hidden = false;
}

function updateRepeatPreview() {
  const rows = +$('#repeatRows').value || 1;
  $('#repeatCountPreview').textContent = rows;
  $('.repeat-range-preview span:last-child').textContent = `마지막행 ${String(rows).padStart(2, '0')}`;
}

function loadRepeatExample() {
  snapshot();
  const specs = [
    ['time', '시간', 'time', 92, 95], ['package_type', '포장형태', 'text', 188, 96], ['inspector_name', '점검자', 'text', 285, 100],
    ['foreign_object', '이물', 'check', 386, 43], ['dirt_damage', '오염·파손', 'check', 430, 43], ['package_condition', '포장상태', 'check', 474, 43],
    ['ijp', 'IJP', 'check', 518, 43], ['printing', '인쇄', 'check', 562, 43], ['card', '카드', 'check', 606, 43],
  ];
  const exampleFields = specs.map(([key, label, type, x, w]) => {
    let f = state.fields.find(item => item.key === key);
    if (!f) { f = field(key, label, type, x, 236, w, 31, { suggested: true }); state.fields.push(f); }
    return f;
  });
  state.selected = exampleFields.map(f => f.id);
  render(); openRepeatDialog(); showToast('첫 번째 행의 9개 열을 자동 배치했습니다.');
}

function createRepeat() {
  const selected = state.selected.map(id => state.fields.find(f => f.id === id)).filter(Boolean); if (selected.length < 2) return;
  if (!editingRepeatId && state.repeats.some(r => r.fieldIds.some(id => state.selected.includes(id)))) { $('#repeatDialog').hidden = true; showToast('선택한 필드는 이미 반복 그룹에 포함되어 있습니다.'); return; }
  snapshot(); const minX = Math.min(...selected.map(f => f.x)), minY = Math.min(...selected.map(f => f.y)); const maxX = Math.max(...selected.map(f => f.x + f.w));
  const rowHeight = +$('#repeatRowHeight').value || 31;
  const values = { label: $('#repeatLabel').value, key: $('#repeatKey').value, rows: +$('#repeatRows').value, rowHeight, blankPolicy: $('#repeatBlank').value, x: minX - 4, y: minY - 4, w: maxX - minX + 8, h: Math.min(990 - minY, (+$('#repeatRows').value) * rowHeight + 8), fieldIds: [...state.selected] };
  if (editingRepeatId) Object.assign(state.repeats.find(r => r.id === editingRepeatId), values); else state.repeats.push({ id: crypto.randomUUID?.() || `${Date.now()}`, ...values });
  const edited = !!editingRepeatId; editingRepeatId = null; $('#repeatDialog').hidden = true; render(); showToast(edited ? '반복행 설정을 수정했습니다.' : '반복행 그룹을 생성했습니다.');
}

function focusField(id) { const f = state.fields.find(x => x.id === id); if (!f) return; paper.scrollIntoView({ behavior: 'smooth', block: 'center' }); showToast(`${f.label} 영역을 선택했습니다.`); }
function showToast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), 2000); }

function aiRecommend() {
  if (document.body.classList.contains('ai-scanning')) return;
  document.body.classList.add('ai-scanning');
  setTimeout(() => {
    snapshot();
    const suggestions = [field('staff_note', '시설 담당자 메모', 'text', 158, 860, 434, 55, { suggested: true, lineMode: 'multi' })];
    suggestions.forEach(s => { if (!state.fields.some(f => f.key === s.key)) state.fields.push(s); });
    document.body.classList.remove('ai-scanning'); render(); showToast('추가 입력 영역 1개를 추천했습니다.');
  }, 1250);
}

function schemaPreview() {
  const basic = {}; state.fields.filter(f => !state.repeats.some(r => r.fieldIds.includes(f.id))).forEach(f => basic[f.key] = typeSchema(f));
  state.repeats.forEach(r => { const props = {}; r.fieldIds.map(id => state.fields.find(f => f.id === id)).filter(Boolean).forEach(f => props[f.key] = typeSchema(f)); basic[r.key] = { type: 'array', maxItems: r.rows, items: { type: 'object', properties: props } }; });
  $('#outputCode').textContent = JSON.stringify({ type: 'object', properties: basic }, null, 2); $('#outputDialog').hidden = false;
}
function typeSchema(f) {
  if (f.type === 'number') return { type: 'number' };
  if (f.type === 'check') return { type: ['boolean', 'null'], trueMarks: f.check.trueMarks, falseMarks: f.check.falseMarks };
  if (f.type === 'choice') {
    const values = (f.choices || []).map(v => v.value);
    return f.choiceMode === 'multiple' ? { type: 'array', uniqueItems: true, items: { type: 'string', enum: values } } : { type: ['string', 'null'], enum: [...values, null] };
  }
  if (f.type === 'date') return { type: ['string', 'null'], format: 'date' };
  if (f.type === 'time') return { type: ['string', 'null'], format: 'time' };
  return { type: 'string', mode: f.lineMode };
}

const sampleValues = {
  application_date: '2026-08-18', applicant_name: '김민준', phone_number: '010-1234-5678', organization: '푸른마을 주민회',
  participants: 12, usage_date: '2026-09-05', usage_time: '13:00', facility: 'multipurpose_room', purpose: '주민 교류 행사 및 정기 설명회',
  terms_agreed: true, applicant_signature: '김민준', staff_note: ''
};
let testValues = {};
let testSourceZoom = .55;
let testSourceUrl = null;
let activeTestFieldKey = null;
let reviewFilter = 'all';
let reviewStates = {};
let documentDetailMode = 'test';
let ocrReady = true;
let detailFormName = '시설 이용 신청서';
const initialReviewMeta = {
  phone_number: { status: 'review', reason: '숫자·하이픈 모양을 자동 보정했습니다.', raw: 'O1O-1234-567B' },
  applicant_signature: { status: 'review', reason: '서명 필기의 인식 신뢰도가 낮습니다.', raw: '김민?' },
};
const handwrittenRegions = {
  application_date:{x:515,y:132,w:130,h:28}, applicant_name:{x:180,y:208,w:190,h:38}, phone_number:{x:477,y:208,w:160,h:38},
  organization:{x:180,y:253,w:195,h:38}, participants:{x:205,y:550,w:70,h:36}, usage_date:{x:210,y:505,w:155,h:34}, usage_time:{x:390,y:505,w:190,h:34},
  facility:{x:205,y:425,w:385,h:34}, purpose:{x:210,y:465,w:380,h:38}, terms_agreed:{x:62,y:677,w:30,h:54}, applicant_signature:{x:520,y:765,w:110,h:42}
};

function openFormTest(mode = 'test') {
  documentDetailMode = typeof mode === 'string' ? mode : 'test';
  ocrReady = ['test','complete'].includes(documentDetailMode);
  testValues = Object.fromEntries(state.fields.filter(f => !state.repeats.some(r => r.fieldIds.includes(f.id))).map(f => {
    let value = documentDetailMode === 'test' ? (f.type === 'check' ? null : f.type === 'choice' && f.choiceMode === 'multiple' ? [] : '') : ocrReady ? (sampleValues[f.key] ?? (f.type === 'check' ? null : '')) : (f.type === 'check' ? null : '');
    if (f.type === 'choice' && f.choiceMode === 'multiple') value = Array.isArray(value) ? value : (value ? [value] : []);
    return [f.key, value];
  }));
  activeTestFieldKey = state.fields[0]?.key || null;
  reviewFilter = 'all'; reviewStates = Object.fromEntries(state.fields.map(f => [f.key, ocrReady && initialReviewMeta[f.key] ? { ...initialReviewMeta[f.key] } : { status: ocrReady ? ((testValues[f.key] === '' || testValues[f.key] == null) ? 'missing' : 'done') : 'pending', reason: '' }]));
  renderDocumentDetailState(); renderTestFields(); renderTestSource(); $('#outputDialog').hidden = false;
}

function renderDocumentDetailState() {
  const isPrint = documentDetailMode === 'print'; const isComplete = documentDetailMode === 'complete'; const isTest = documentDetailMode === 'test';
  $('.test-card').classList.toggle('structure-test', isTest);
  $('#detailEyebrow').textContent = isTest ? 'DATA TEST' : 'DOCUMENT DETAIL'; $('#detailTitle').textContent = isTest ? `${formName} 데이터 테스트` : detailFormName;
  $('#detailStatusBadge').textContent = isTest ? '테스트' : isPrint ? '인쇄' : isComplete ? '완료' : ocrReady ? 'OCR 완료' : '작성';
  $('#runOcrBtn').hidden = isPrint || isComplete || isTest; $('#runOcrBtn').disabled = ocrReady;
  $('#finalizeDocumentBtn').hidden = isPrint || isTest; $('#finalizeDocumentBtn').disabled = !ocrReady || isComplete;
  ['#jsonPreviewBtn','#downloadCsvBtn','#downloadExcelBtn'].forEach(selector => $(selector).disabled = !(isComplete || isTest));
  $('#testSourceUpload').hidden = !isTest; $('#rerunOcrBtn').hidden = isPrint || isTest || !ocrReady;
  $('.review-summary').hidden = isTest || isPrint || !ocrReady;
  $('.test-flow').innerHTML = isTest ? '<span class="done">1 필드 정의</span><i></i><span class="active">2 출력 구조 확인</span><i></i><span>3 CSV·Excel</span>' : '<span class="done">1 필기 수신</span><i></i><span class="active">2 OCR 결과 확인</span><i></i><span>3 최종 확정</span>';
  $('.test-values .test-section-head b').textContent = isTest ? '필드 출력 구조' : '인식된 필드값';
  $('.test-values .test-section-head small').textContent = isTest ? '필드 순서와 데이터 키가 CSV 열로 어떻게 생성되는지 확인합니다.' : 'OCR 결과를 확인·수정한 후 최종 확정합니다.';
  $('#detailActionNote').textContent = isTest ? '빈 값으로 JSON·CSV·Excel 출력 구조를 확인합니다.' : isPrint ? '필기 데이터가 아직 등록되지 않았습니다.' : isComplete ? '최종 확정된 데이터입니다.' : ocrReady ? '인식값을 확인한 뒤 최종 확정해 주세요.' : 'AI OCR을 실행하면 인식된 값이 여기에 적용됩니다.';
  $('#testSourceName').textContent = (isPrint || isTest) ? '빈 원본 양식 · 1페이지' : '스마트펜 필기 원본 · 1페이지';
  $('.test-values').classList.toggle('detail-readonly', isPrint || isTest || !ocrReady || isComplete);
}

function renderTestFields() {
  const fields = state.fields.filter(f => !state.repeats.some(r => r.fieldIds.includes(f.id))).filter(f => reviewFilter === 'all' || (reviewFilter === 'review' ? reviewStates[f.key]?.status === 'review' : ['missing','error'].includes(reviewStates[f.key]?.status)));
  $('#testFieldList').innerHTML = fields.map(f => {
    const value = testValues[f.key];
    let control = `<input data-test-key="${f.key}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}" value="${escapeHtml(value ?? '')}">`;
    if (f.type === 'choice' && f.choiceMode !== 'multiple') control = `<select data-test-key="${f.key}">${f.choices.map(v => `<option value="${v.value}" ${v.value === value || v.label === value ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
    if (f.type === 'choice' && f.choiceMode === 'multiple') control = `<div class="test-multi-options">${f.choices.map(v => `<label><input type="checkbox" data-test-key="${f.key}" data-option-value="${v.value}" ${(value || []).includes(v.value) ? 'checked' : ''}><span>${v.label}</span></label>`).join('')}</div>`;
    if (f.type === 'check') control = `<select data-test-key="${f.key}"><option value="true" ${value === true ? 'selected' : ''}>✓ true</option><option value="false" ${value === false ? 'selected' : ''}>X false</option><option value="null" ${value == null ? 'selected' : ''}>— null</option></select>`;
    const meta = reviewStates[f.key] || { status:'done', reason:'' }; const statusLabel = ({done:'인식 완료',review:'확인 필요',missing:'미입력',error:'오류',pending:'OCR 전'})[meta.status];
    return `<div class="test-field-row ${activeTestFieldKey === f.key ? 'active' : ''} status-${meta.status}" data-field-key="${f.key}"><span class="test-field-meta"><b>${f.label}${f.required ? '<em>필수</em>' : ''}</b><small>${f.key} · ${fieldTypeName(f)}</small></span>${control}<span class="review-status"><i>${statusLabel}</i>${meta.status === 'review' ? '<button data-confirm-review="'+f.key+'">확인 ✓</button>' : ''}</span>${meta.reason ? `<small class="review-reason">${meta.reason}${meta.raw ? ` <b>OCR 원문: ${meta.raw}</b>` : ''}</small>` : ''}</div>`;
  }).join('');
  $$('.test-field-row').forEach(row => row.addEventListener('click', () => focusTestSourceField(row.dataset.fieldKey)));
  $$('[data-confirm-review]').forEach(button => button.onclick = e => { e.stopPropagation(); reviewStates[button.dataset.confirmReview] = { status:'done', reason:'사용자가 확인했습니다.' }; renderTestFields(); showToast('검수 확인을 완료했습니다.'); });
  $$('[data-test-key]').forEach(el => { el.disabled = documentDetailMode === 'print' || documentDetailMode === 'test' || !ocrReady || documentDetailMode === 'complete'; el.oninput = () => { const f = state.fields.find(v => v.key === el.dataset.testKey); let value = el.value; if (f.type === 'number') value = value === '' ? null : +value; if (f.type === 'check') value = value === 'null' ? null : value === 'true'; if (f.type === 'choice' && f.choiceMode === 'multiple') value = $$(`[data-test-key="${f.key}"][data-option-value]`).filter(x => x.checked).map(x => x.dataset.optionValue); testValues[f.key] = value; renderCsvPreview(); }; });
  renderCsvPreview();
  renderReviewSummary();
}

function renderReviewSummary() {
  const values = Object.values(reviewStates); const counts = { all:values.length, done:values.filter(v => v.status === 'done').length, review:values.filter(v => v.status === 'review').length, issue:values.filter(v => ['missing','error'].includes(v.status)).length };
  $('#reviewCounts').innerHTML = `<span>전체 <b>${counts.all}</b></span><span class="done">완료 <b>${counts.done}</b></span><span class="review">확인 필요 <b>${counts.review}</b></span><span class="issue">미입력·오류 <b>${counts.issue}</b></span>`;
  $$('#reviewFilters button').forEach(b => b.classList.toggle('active', b.dataset.reviewFilter === reviewFilter));
}

function renderTestSource() {
  const canvas = $('#testSourceCanvas');
  canvas.innerHTML = '';
  const documentEl = document.createElement('div'); documentEl.className = 'test-source-document';
  if (testSourceUrl) {
    const file = $('#testSourceInput').files[0];
    if (file?.type === 'application/pdf') documentEl.innerHTML = `<embed class="test-source-media" src="${testSourceUrl}#page=1&toolbar=0" type="application/pdf">`;
    else documentEl.innerHTML = `<img class="test-source-media" src="${testSourceUrl}" alt="업로드한 작성 원본">`;
  } else if (documentDetailMode === 'print' || documentDetailMode === 'test') {
    const blank = paper.cloneNode(true); blank.removeAttribute('id'); blank.classList.add('blank-source-paper'); blank.querySelector('#fieldLayer')?.remove(); blank.querySelector('.drop-hint')?.remove(); documentEl.append(blank);
  } else documentEl.innerHTML = `<img class="test-source-media" src="assets/facility-application-handwritten.png" alt="손필기로 작성된 시설 이용 신청서">`;
  const overlay = document.createElement('div'); overlay.className = 'test-source-overlay';
  state.fields.forEach(f => { const region = !testSourceUrl && handwrittenRegions[f.key] ? handwrittenRegions[f.key] : f; const box = document.createElement('button'); box.className = `test-source-field ${activeTestFieldKey === f.key ? 'active' : ''}`; box.dataset.sourceKey = f.key; box.title = f.label; Object.assign(box.style, { left: `${region.x / 7}%`, top: `${region.y / 9.9}%`, width: `${region.w / 7}%`, height: `${region.h / 9.9}%` }); box.onclick = () => focusTestSourceField(f.key); overlay.append(box); });
  documentEl.append(overlay); documentEl.style.transform = `scale(${testSourceZoom})`; canvas.append(documentEl);
  $('#sourceZoomLabel').textContent = `${Math.round(testSourceZoom * 100)}%`;
}

function focusTestSourceField(key) {
  activeTestFieldKey = key;
  $$('.test-field-row').forEach(row => row.classList.toggle('active', row.dataset.fieldKey === key));
  $$('.test-source-field').forEach(box => box.classList.toggle('active', box.dataset.sourceKey === key));
  const fieldDef = (!testSourceUrl && handwrittenRegions[key]) || state.fields.find(f => f.key === key); const viewport = $('#testSourceViewport');
  if (fieldDef && viewport) viewport.scrollTo({ top: Math.max(0, fieldDef.y * testSourceZoom - viewport.clientHeight / 2), left: 0, behavior: 'smooth' });
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function csvEscape(value) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function exportEntries() {
  const entries = [];
  state.fields.filter(f => Object.hasOwn(testValues, f.key)).forEach(f => {
    const value = testValues[f.key];
    if (f.type !== 'choice' || f.choiceMode !== 'multiple') return entries.push([f.key, value]);
    if (f.multiCsvMode === 'columns') return f.choices.forEach(option => entries.push([`${f.key}_${option.value}`, (value || []).includes(option.value)]));
    entries.push([f.key, f.multiCsvMode === 'json' ? JSON.stringify(value || []) : (value || []).join('|')]);
  });
  return entries;
}
function currentCsv() { const entries = exportEntries(); return `${entries.map(([k]) => csvEscape(k)).join(',')}\n${entries.map(([,v]) => csvEscape(v)).join(',')}`; }

function renderCsvPreview() {
  const entries = exportEntries();
  $('#csvFieldCount').textContent = `${entries.length}개 열 · 1건`;
  $('#csvPreviewTable').innerHTML = `<thead><tr>${entries.map(([k]) => `<th>${k}</th>`).join('')}</tr></thead><tbody><tr>${entries.map(([,v]) => `<td>${escapeHtml(Array.isArray(v) ? v.join('|') : (v ?? ''))}</td>`).join('')}</tr></tbody>`;
  $('#outputCode').textContent = JSON.stringify(testValues, null, 2);
}

function downloadCsv() {
  const blob = new Blob(['\ufeff' + currentCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'facility_application_sample.csv'; a.click(); URL.revokeObjectURL(url);
  showToast('CSV 파일을 생성했습니다.');
}

function downloadExcel() {
  const entries = exportEntries(); const html = `<table><tr>${entries.map(([k]) => `<th>${escapeHtml(k)}</th>`).join('')}</tr><tr>${entries.map(([,v]) => `<td>${escapeHtml(Array.isArray(v) ? v.join('|') : (v ?? ''))}</td>`).join('')}</tr></table>`;
  const blob = new Blob(['\ufeff' + html], { type:'application/vnd.ms-excel;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'facility_application_sample.xls'; a.click(); URL.revokeObjectURL(url); showToast('기본 Excel 파일을 생성했습니다.');
}

// Click or drag & drop from Add panel.
$$('.component-card').forEach(card => {
  card.addEventListener('dragstart', e => e.dataTransfer.setData('field/type', card.dataset.type));
  card.addEventListener('click', () => {
    if (card.dataset.type === 'repeat') return openRepeatDialog();
    const offset = (state.fields.length % 6) * 16;
    addField(card.dataset.type, 350 + offset, 205 + offset);
    showToast(`${card.querySelector('b').textContent} 필드를 추가했습니다.`);
  });
});
paper.addEventListener('dragover', e => { e.preventDefault(); paper.classList.add('drag-over'); });
paper.addEventListener('dragleave', () => paper.classList.remove('drag-over'));
paper.addEventListener('drop', e => { e.preventDefault(); paper.classList.remove('drag-over'); const rect = paper.getBoundingClientRect(); addField(e.dataTransfer.getData('field/type'), (e.clientX - rect.left) / state.zoom, (e.clientY - rect.top) / state.zoom); });
paper.addEventListener('click', () => { if (paper.dataset.justDrew) { delete paper.dataset.justDrew; return; } state.selected = []; activateSettingsTab('field'); render(); });
paper.addEventListener('pointerdown', startOptionRegionDraw);

// Property events.
$('#propLabel').addEventListener('input', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; f.label = e.target.value; $('#propertyTitle').textContent = f.label; renderFields(); renderTree(); });
$('#propLabel').addEventListener('change', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f && /^\w*_\d+$/.test(f.key)) { f.key = uniqueKey(slug(e.target.value)); render(); } });
$('#propKey').addEventListener('input', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; f.key = e.target.value; $('#keyState').textContent = state.fields.filter(x => x.key === f.key).length > 1 ? '중복됨' : '사용 가능'; renderFields(); renderTree(); });
$('#propType').addEventListener('change', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; snapshot(); f.type = e.target.value; render(); });
$('#propRequired').addEventListener('change', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.required = e.target.checked; });
$('#blankPolicy').addEventListener('change', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.check.blank = e.target.value; });
$('#numberFormat').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) { f.number.format = e.target.value; $('#decimalPlacesRow').hidden = e.target.value !== 'decimal'; } };
$('#decimalPlaces').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.number.decimals = +e.target.value; };
$('#allowNegative').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.number.allowNegative = e.target.checked; };
$('#numberUnit').oninput = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.number.unit = e.target.value; };
$('#numberMin').oninput = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.number.min = e.target.value === '' ? null : +e.target.value; };
$('#numberMax').oninput = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.number.max = e.target.value === '' ? null : +e.target.value; };
$('#dateInputFormat').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.date.input = e.target.value; };
$('#dateMissingYear').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.date.missingYear = e.target.value; };
$('#dateOutputFormat').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.date.output = e.target.value; };
$('#timeInputFormat').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.time.input = e.target.value; };
$('#minuteStep').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.time.minuteStep = e.target.value; };
$('#timeOutputFormat').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.time.output = e.target.value; };
[['fieldTop','y',0,970],['fieldLeft','x',0,672],['fieldWidth','w',28,700],['fieldHeight','h',20,990]].forEach(([id, prop, min, max]) => {
  $(`#${id}`).addEventListener('input', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; let value = Math.max(min, Math.min(max, +e.target.value || 0)); if (prop === 'x') value = Math.min(value, 700 - f.w); if (prop === 'y') value = Math.min(value, 990 - f.h); if (prop === 'w') value = Math.min(value, 700 - f.x); if (prop === 'h') value = Math.min(value, 990 - f.y); f[prop] = value; renderFields(); });
});
$('#choiceOptionsList').addEventListener('input', e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); const row = e.target.closest('[data-option-index]'); if (!f || !row || !e.target.dataset.optionProp) return; f.choices[+row.dataset.optionIndex][e.target.dataset.optionProp] = e.target.value; renderFields(); });
$('#choiceOptionsList').addEventListener('click', e => {
  const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return;
  if (e.target.dataset.setRegion != null) { state.optionDrawing = { fieldId: f.id, optionIndex: +e.target.dataset.setRegion }; document.body.classList.add('option-drawing'); showToast(`${f.choices[+e.target.dataset.setRegion].label} 체크박스 영역을 문서에서 드래그하세요.`); }
  if (e.target.dataset.removeOption != null) { snapshot(); f.choices.splice(+e.target.dataset.removeOption, 1); render(); }
});
$('#addChoiceOption').onclick = () => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; snapshot(); const n = f.choices.length + 1; f.choices.push({ label: `선택지 ${n}`, value: `option_${n}`, region: null }); render(); };
$$('#choiceMode button').forEach(b => b.onclick = () => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; snapshot(); f.choiceMode = b.dataset.value; render(); });
$('#choiceConflict').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.choiceConflict = e.target.value; };
$('#multiCsvMode').onchange = e => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) f.multiCsvMode = e.target.value; };
$$('#lineMode button').forEach(b => b.onclick = () => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (f) { f.lineMode = b.dataset.value; renderProperties(); } });
$$('.mark-picker button').forEach(b => b.onclick = () => { const f = state.fields.find(x => x.id === state.selected.at(-1)); if (!f) return; const list = b.closest('#trueMarks') ? f.check.trueMarks : f.check.falseMarks; list.includes(b.textContent) ? list.splice(list.indexOf(b.textContent), 1) : list.push(b.textContent); renderProperties(); });

// The editor keeps only selected-field settings; document-wide settings are system defaults.
function activateSettingsTab() { $('#fieldSettingsPane').hidden = false; }
$$('.settings-tabs button').forEach(b => b.onclick = () => activateSettingsTab(b.dataset.settingsTab));

// Buttons and tabs.
$('#duplicateBtn').onclick = () => duplicateField(); $('#deleteBtn').onclick = () => deleteFields(); $('#groupBtn').onclick = openRepeatDialog; $('#confirmRepeat').onclick = createRepeat; $('#repeatExampleBtn').onclick = loadRepeatExample; $('#repeatRows').oninput = updateRepeatPreview; $('#aiBtn').onclick = aiRecommend; $('#testBtn').onclick = () => openFormTest('test'); $('#downloadCsvBtn').onclick = downloadCsv; $('#downloadExcelBtn').onclick = downloadExcel; $('#rerunOcrBtn').onclick = () => { showToast('필기 데이터를 다시 인식했습니다.'); renderTestFields(); }; $('#jsonPreviewBtn').onclick = () => $('#outputCode').classList.toggle('show');
$('#runOcrBtn').onclick = () => { $('#runOcrBtn').disabled = true; $('#runOcrBtn').textContent = 'AI OCR 처리 중…'; $('#detailActionNote').textContent = 'Gemini가 필드 영역별 필기를 인식하고 있습니다.'; setTimeout(() => { ocrReady = true; testValues = { ...sampleValues }; reviewStates = Object.fromEntries(state.fields.map(f => [f.key, initialReviewMeta[f.key] ? { ...initialReviewMeta[f.key] } : { status:(testValues[f.key] === '' || testValues[f.key] == null) ? 'missing' : 'done', reason:'' }])); $('#runOcrBtn').textContent = '✓ OCR 완료'; renderDocumentDetailState(); renderTestFields(); showToast('AI OCR 결과를 인식된 필드값에 적용했습니다.'); }, 900); };
$('#finalizeDocumentBtn').onclick = () => { documentDetailMode = 'complete'; renderDocumentDetailState(); renderTestFields(); showToast('문서를 최종 확정했습니다. 다운로드가 활성화되었습니다.'); };
$('#copyFieldBtn').onclick = copySelectedFields; $('#pasteFieldBtn').onclick = pasteCopiedFields; $('#deleteFieldQuickBtn').onclick = () => deleteFields();
$('#sourceZoomIn').onclick = () => { testSourceZoom = Math.min(.9, testSourceZoom + .1); renderTestSource(); };
$('#sourceZoomOut').onclick = () => { testSourceZoom = Math.max(.3, testSourceZoom - .1); renderTestSource(); };
$('#testSourceUpload').onclick = () => $('#testSourceInput').click();
$('#testSourceInput').onchange = e => { const file = e.target.files[0]; if (!file) return; if (testSourceUrl) URL.revokeObjectURL(testSourceUrl); testSourceUrl = URL.createObjectURL(file); $('#testSourceName').textContent = `${file.name} · 1페이지`; renderTestSource(); showToast('작성 원본을 불러왔습니다.'); };
$$('#reviewFilters button').forEach(button => button.onclick = () => { reviewFilter = button.dataset.reviewFilter; renderTestFields(); });
$$('.close-dialog').forEach(b => b.onclick = () => $('#repeatDialog').hidden = true); $$('.close-output').forEach(b => b.onclick = () => $('#outputDialog').hidden = true);
$$('.property-section-title').forEach(b => b.onclick = () => { const body = b.nextElementSibling; body.style.display = getComputedStyle(body).display === 'none' ? 'block' : 'none'; });
$('#fieldSearch').oninput = renderTree; $('#zoomIn').onclick = () => { state.zoom = Math.min(1.25, state.zoom + .1); render(); }; $('#zoomOut').onclick = () => { state.zoom = Math.max(.55, state.zoom - .1); render(); }; $('#fitBtn').onclick = () => { state.zoom = .78; render(); };
$('#undoBtn').onclick = () => { if (!state.history.length) return; state.future.push(JSON.stringify({ fields: state.fields, repeats: state.repeats })); restore(state.history.pop()); };
$('#redoBtn').onclick = () => { if (!state.future.length) return; state.history.push(JSON.stringify({ fields: state.fields, repeats: state.repeats })); restore(state.future.pop()); };
$('#finishBtn').onclick = () => { const duplicates = state.fields.filter((f, i, a) => a.findIndex(x => x.key === f.key) !== i); if (duplicates.length) return showToast('중복된 데이터 키를 먼저 수정해 주세요.'); showToast('편집을 완료했습니다. 템플릿 초안이 저장되었습니다.'); };
function setEditorDocumentState(hasDocument) {
  editorHasDocument = hasDocument;
  document.body.classList.toggle('editor-no-document', !hasDocument);
  $('#editorUploadEmpty').hidden = hasDocument;
  $('#paperScale').hidden = !hasDocument;
  $('#uploadPdfBtn').textContent = hasDocument ? '↑ PDF 교체' : '↑ PDF 업로드';
  if (!hasDocument) $('.left-footer span').textContent = '업로드된 PDF 없음';
}
function loadEditorPdf(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') return showToast('PDF 파일만 업로드할 수 있습니다.');
  if (file.size > 20 * 1024 * 1024) return showToast('20MB 이하의 PDF를 선택해 주세요.');
  if (creatingBlankForm) {
    state.fields = []; state.repeats = []; state.selected = []; state.history = []; state.future = [];
    layer.innerHTML = ''; tree.innerHTML = '';
  }
  if (editorDocumentUrl) URL.revokeObjectURL(editorDocumentUrl);
  editorDocumentUrl = URL.createObjectURL(file);
  const preview = $('#editorPdfPreview');
  preview.src = `${editorDocumentUrl}#page=1&toolbar=0&navpanes=0`; preview.hidden = false; preview.style.display = 'block';
  paper.classList.add('uploaded-document'); $('.left-footer span').textContent = file.name;
  setEditorDocumentState(true); creatingBlankForm = false; render(); showToast('빈 양식을 불러왔습니다. 이제 필드를 추가할 수 있습니다.');
}
function openNewBlankEditor() {
  creatingBlankForm = true;
  state.fields = []; state.repeats = []; state.selected = []; state.history = []; state.future = [];
  formName = '이름 없는 양식'; editorReadOnly = false;
  paper.classList.remove('uploaded-document'); $('#editorPdfPreview').hidden = true; $('#editorPdfPreview').style.display = 'none'; $('#editorPdfPreview').removeAttribute('src');
  setEditorDocumentState(false); showAppView('editor'); render();
}
$('#uploadPdfBtn').onclick = () => $('#pdfInput').click();
$('#editorUploadDropzone').onclick = () => $('#pdfInput').click();
$('#pdfInput').onchange = e => { loadEditorPdf(e.target.files[0]); e.target.value = ''; };
['dragenter','dragover'].forEach(type => $('#editorUploadDropzone').addEventListener(type, e => { e.preventDefault(); $('#editorUploadDropzone').classList.add('drag-over'); }));
['dragleave','drop'].forEach(type => $('#editorUploadDropzone').addEventListener(type, e => { e.preventDefault(); $('#editorUploadDropzone').classList.remove('drag-over'); if (type === 'drop') loadEditorPdf(e.dataTransfer.files[0]); }));

window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (editorReadOnly && !$('#editorView').hidden) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected.length) deleteFields();
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateField(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelectedFields(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteCopiedFields(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? $('#redoBtn').click() : $('#undoBtn').click(); }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && state.selected.length) { e.preventDefault(); snapshot(); const d = e.shiftKey ? 10 : 1; state.selected.forEach(id => { const f = state.fields.find(x => x.id === id); if (e.key === 'ArrowLeft') f.x -= d; if (e.key === 'ArrowRight') f.x += d; if (e.key === 'ArrowUp') f.y -= d; if (e.key === 'ArrowDown') f.y += d; }); render(); }
});

// End-to-end demo navigation: template → capture → review/export.
let reviewReturnView = 'records';
function showAppView(view) {
  const views = { dashboard:$('#dashboardView'), forms:$('#formsView'), records:$('#recordsView'), editor:$('#editorView') };
  Object.entries(views).forEach(([key, el]) => { if (el) el.hidden = key !== view; });
  $('#editorToolbar').hidden = view !== 'editor'; $('#editorHeaderActions').hidden = view !== 'editor';
  const navView = view === 'editor' ? 'forms' : view === 'review' ? reviewReturnView : view; $$('.main-navigation button').forEach(b => b.classList.toggle('active', b.dataset.appView === navView));
  const copy = {
    dashboard:['대시보드','양식과 스마트펜 문서의 처리 현황을 확인합니다.'],
    forms:['양식 관리','데이터 수집 양식을 만들고 관리합니다.'],
    records:['문서 조회','인쇄·작성·완료 상태의 문서를 조회하고 데이터를 가져옵니다.'],
    editor:[formName,'양식 이름을 클릭해 수정할 수 있습니다. · 자동 저장'],
    review:['데이터 검수','손필기 원본과 추출값을 비교하고 최종 확정합니다.']
  }[view];
  $('#documentTitle b').textContent = copy[0]; $('#documentTitle span').textContent = copy[1]; $('#headerBackBtn').style.visibility = view === 'editor' ? 'visible' : 'hidden';
  $('#documentTitle b').contentEditable = view === 'editor' ? 'true' : 'false'; $('#documentTitle b').classList.toggle('editable-form-name', view === 'editor');
  if (view === 'editor') {
    $('#documentTitle b').contentEditable = editorReadOnly ? 'false' : 'true'; $('#documentTitle b').classList.toggle('editable-form-name', !editorReadOnly);
    document.body.classList.toggle('editor-read-only', editorReadOnly); $('#finishBtn').hidden = editorReadOnly; $('.save-state').textContent = editorReadOnly ? '조회 전용 · 수정할 수 없음' : '변경사항 저장됨';
  } else document.body.classList.remove('editor-read-only');
}

function openFormEditor(name, readOnly = false) {
  formName = name; editorReadOnly = readOnly; creatingBlankForm = false;
  const sample = JSON.parse(sampleTemplateState); state.fields = sample.fields; state.repeats = sample.repeats; state.selected = []; state.history = []; state.future = [];
  paper.classList.remove('uploaded-document'); $('#editorPdfPreview').hidden = true; $('#editorPdfPreview').style.display = 'none'; $('#editorPdfPreview').removeAttribute('src');
  $('.left-footer span').textContent = name === '시설 이용 신청서' ? '시설_이용_신청서.pdf' : '시설_점검_기록지.pdf';
  setEditorDocumentState(true); showAppView('editor'); render();
}

function openReviewPage(returnView = 'records', mode = 'written') {
  reviewReturnView = returnView; showAppView('review'); openFormTest(mode); $('#outputDialog').classList.add('page-mode');
}

function closeReview() {
  const dialog = $('#outputDialog'); dialog.hidden = true;
  if (dialog.classList.contains('page-mode')) { dialog.classList.remove('page-mode'); showAppView(reviewReturnView); }
}

$$('.main-navigation button').forEach(button => button.onclick = () => showAppView(button.dataset.appView));
$$('#dashboardScope button').forEach(button => button.onclick = () => {
  const isSystem = button.dataset.dashboardScope === 'system';
  $$('#dashboardScope button').forEach(item => item.classList.toggle('active', item === button));
  $('#customerDashboard').hidden = isSystem; $('#systemDashboard').hidden = !isSystem;
  $('#dashboardDescription').textContent = isSystem ? '전체 고객사·사용자·AI OCR 운영 현황을 확인합니다.' : '우리 회사의 양식·문서·AI OCR 사용 현황을 확인합니다.';
});
$('#dashboardRecordsBtn').onclick = () => showAppView('records');
$('#dashboardFormsBtn').onclick = () => showAppView('forms');
$('#dashboardNewFormBtn').onclick = openNewBlankEditor;
$('#dashboardImportBtn').onclick = () => { showAppView('records'); $('#dataImportDialog').hidden = false; };
$('#documentTitle b').addEventListener('input', e => { if ($('#editorView').hidden) return; formName = e.currentTarget.textContent.trim() || '이름 없는 양식'; });
function activateFormRow(row, name, readOnly) { row.onclick = e => { if (e.target.closest('button,select,input')) return; openFormEditor(name, readOnly); }; row.onkeydown = e => { if (e.target.closest('button,select,input')) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFormEditor(name, readOnly); } }; }
activateFormRow($('#draftFormRow'), '시설 점검 기록지', false); activateFormRow($('#printableFormRow'), '시설 이용 신청서', true);
$('#headerBackBtn').onclick = () => showAppView('forms');
$('#printTemplateBtn').onclick = () => showToast('NCode 인쇄 파일을 준비했습니다. 실제 프린터 연결은 다음 단계에서 적용합니다.');
$('#printStatusSelect').onchange = e => { const printable = e.target.value === 'printable'; e.target.classList.toggle('printable', printable); e.target.classList.toggle('not-printable', !printable); $('#printStatusReason').textContent = printable ? '프린트 허용' : '사용자가 프린트 중지'; $('#printTemplateBtn').disabled = !printable; showToast(printable ? '이 양식을 프린트 가능 상태로 변경했습니다.' : '이 양식의 신규 프린트를 중지했습니다.'); };
$('#newTemplateBtn').onclick = openNewBlankEditor;
$('#openDataImportBtn').onclick = () => $('#dataImportDialog').hidden = false;
$('#closeDataImport').onclick = () => $('#dataImportDialog').hidden = true;
let selectedPenPage = 1;
$$('[data-pen-page]').forEach(button => button.onclick = () => {
  selectedPenPage = +button.dataset.penPage; $$('[data-pen-page]').forEach(b => b.classList.toggle('active', b === button));
  $('#selectedPenPageLabel').textContent = `선택 페이지 ${selectedPenPage} / 3`; $('#selectedPenPageImage').alt = `스마트펜 필기 원본 ${selectedPenPage}페이지`;
  $('.pen-source-preview em').textContent = `Page ${selectedPenPage}`;
});
function importPenDocuments(count) {
  const rows = Array.from({ length: count }, (_, i) => `<tr><td>${13052 + i}</td><td><b>시설 이용 신청서</b><small>facility_application</small></td><td>1</td><td>김민준<small>jimin.kim@neolab.net</small></td><td><span class="document-state write">작성</span></td><td>2026.08.18 15:20<small>2026.08.18 15:${String(21 + i).padStart(2,'0')}</small></td><td><button class="view-record">조회</button></td></tr>`).join('');
  $('#documentRows').insertAdjacentHTML('afterbegin', rows); $('#dataImportDialog').hidden = true;
  $('#totalDocumentCount').textContent = +$('#totalDocumentCount').textContent + count; $('#writeDocumentCount').textContent = +$('#writeDocumentCount').textContent + count;
  const total = +$('#totalDocumentCount').textContent; const written = +$('#writeDocumentCount').textContent;
  $('#dashboardTotalDocuments').firstChild.nodeValue = String(total); $('#dashboardWriteCount').firstChild.nodeValue = String(written);
  showToast(`${count}장의 필기 데이터를 문서 목록에 등록했습니다.`);
}
$('#importOnePage').onclick = () => { importPenDocuments(1); showToast(`${selectedPenPage}페이지 필기 데이터를 문서 목록에 등록했습니다.`); }; $('#importAllPages').onclick = () => importPenDocuments(3);
$('#documentRows').onclick = e => { const button = e.target.closest('.view-record'); if (!button) return; const stateEl = button.closest('tr').querySelector('.document-state'); const mode = stateEl?.classList.contains('print') ? 'print' : stateEl?.classList.contains('complete') ? 'complete' : 'written'; openReviewPage('records', mode); };
$$('.close-output').forEach(button => button.onclick = closeReview);
$('#finishBtn').onclick = () => { const duplicates = state.fields.filter((f, i, a) => a.findIndex(x => x.key === f.key) !== i); if (duplicates.length) return showToast('중복된 데이터 키를 먼저 수정해 주세요.'); showToast('편집을 완료했습니다. 완료된 양식은 더 이상 수정할 수 없습니다.'); setTimeout(() => showAppView('forms'), 700); };

buildRows(); render(); showAppView('dashboard');
