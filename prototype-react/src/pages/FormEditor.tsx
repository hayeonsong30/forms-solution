import { useEffect, useRef, useState } from 'react'
import { Card, Button } from '../components/ui'
import { FieldLibrary } from '../components/FieldLibrary'
import type { ArmedType } from '../components/FieldLibrary'
import { FieldPropertiesPanel } from '../components/FieldPropertiesPanel'
import { GroupPropertiesPanel } from '../components/GroupPropertiesPanel'
import { TopEditBar } from '../components/TopEditBar'
import { PdfFieldCanvas } from '../components/PdfFieldCanvas'
import { kotobukiFieldHints } from '../data/kotobukiFieldHints'
import { itsuwaGroupHint } from '../data/itsuwaGroupHints'
import { downloadXlsx } from '../lib/exportXlsx'
import type { DetectedField, OptionRegion, RepeatingGroupDefinition } from '../types'

type SampleKind = 'kotobuki' | 'itsuwa'

const SAMPLES: Record<SampleKind, { url: string; name: string }> = {
  kotobuki: { url: '/samples/kotobuki-facility-booking.pdf', name: 'サンプル＿施設利用申込書.pdf (고토부키)' },
  itsuwa: { url: '/samples/itsuwa-template.pdf', name: '入庫品質検査表.pdf (ITSUWA)' },
}

function expandColumns(fields: DetectedField[]) {
  return fields.flatMap((f) =>
    (f.type === 'multiple-choice' || f.type === 'single-choice') && f.options
      ? f.options.map((o) => `${f.excelColumn}_${o}`)
      : [f.excelColumn]
  )
}

function downloadTemplateXlsx(fields: DetectedField[], fileName: string) {
  const headers = expandColumns(fields)
  downloadXlsx(`${fileName.replace(/\.pdf$/i, '')}_template.xlsx`, headers)
}

let runCounter = 0
let manualCounter = 0
let manualGroupCounter = 0
let copyCounter = 0
let optionCounter = 0

function defaultOptionRegions(rect: { x: number; y: number; w: number; h: number }, options: string[]): OptionRegion[] {
  const boxSize = Math.max(10, Math.min(16, rect.h - 4))
  return options.map((option, i) => ({
    option,
    x: rect.x + 4,
    y: rect.y + 4 + i * (boxSize + 6),
    w: boxSize,
    h: boxSize,
  }))
}

interface Snapshot {
  fields: DetectedField[]
  groups: RepeatingGroupDefinition[]
}

export function FormEditor() {
  const [pdfSource, setPdfSource] = useState<File | string | null>(null)
  const [fileName, setFileName] = useState('')
  const [sampleKind, setSampleKind] = useState<SampleKind | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  const [fields, setFields] = useState<DetectedField[]>([])
  const [groups, setGroups] = useState<RepeatingGroupDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [armed, setArmed] = useState<ArmedType | null>(null)
  const [groupArmed, setGroupArmed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [zoom, setZoom] = useState(90)
  const [justSaved, setJustSaved] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

  const history = useRef<Snapshot[]>([{ fields: [], groups: [] }])
  const historyIndex = useRef(0)

  function commit(next: Snapshot) {
    history.current = history.current.slice(0, historyIndex.current + 1)
    history.current.push(next)
    historyIndex.current += 1
    setFields(next.fields)
    setGroups(next.groups)
  }
  function commitFields(next: DetectedField[]) {
    commit({ fields: next, groups })
  }
  function commitGroups(next: RepeatingGroupDefinition[]) {
    commit({ fields, groups: next })
  }
  function undo() {
    if (historyIndex.current === 0) return
    historyIndex.current -= 1
    const snap = history.current[historyIndex.current]
    setFields(snap.fields)
    setGroups(snap.groups)
  }
  function redo() {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current += 1
    const snap = history.current[historyIndex.current]
    setFields(snap.fields)
    setGroups(snap.groups)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selected = fields.find((f) => f.id === selectedId) ?? null
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null

  function resetToUpload() {
    setPdfSource(null)
    setFields([])
    setGroups([])
    setSelectedId(null)
    setSelectedGroupId(null)
    setSelectedColumnId(null)
    setSelectedOptionIndex(null)
    setNaturalSize(null)
    setManualMode(false)
    setArmed(null)
    setGroupArmed(false)
    history.current = [{ fields: [], groups: [] }]
    historyIndex.current = 0
  }

  function loadFile(file: File) {
    setPdfSource(file)
    setFileName(file.name)
    setSampleKind(null)
    setFields([])
    setGroups([])
    setSelectedId(null)
    setSelectedGroupId(null)
    setSelectedColumnId(null)
    setSelectedOptionIndex(null)
    setNaturalSize(null)
    history.current = [{ fields: [], groups: [] }]
    historyIndex.current = 0
  }

  function loadSample(kind: SampleKind) {
    setPdfSource(SAMPLES[kind].url)
    setFileName(SAMPLES[kind].name)
    setSampleKind(kind)
    setFields([])
    setGroups([])
    setSelectedId(null)
    setSelectedGroupId(null)
    setSelectedColumnId(null)
    setSelectedOptionIndex(null)
    setNaturalSize(null)
    history.current = [{ fields: [], groups: [] }]
    historyIndex.current = 0
  }

  function runAi() {
    if (!naturalSize) return

    // 재실행은 "추가"가 아니라 "AI 결과 교체" — 그대로 두면 그룹은 같은 id로 중복 생성되어
    // React key가 충돌하고, 필드는 계속 쌓여서 캔버스에 중복 박스가 겹친다.
    // 이미 AI 결과가 있으면(=재실행) 사용자 확인을 받고 기존 AI 항목만 교체한다. 수동 추가 항목은 유지.
    const hasExistingAi = fields.some((f) => f.source === 'ai') || groups.some((g) => g.source === 'ai')
    if (
      hasExistingAi &&
      !window.confirm('AI 인식 결과를 다시 생성하면 기존 AI 필드·반복행이 새 결과로 교체됩니다. 수동으로 추가한 항목은 유지됩니다. 계속할까요?')
    ) {
      return
    }

    setAnalyzing(true)
    setTimeout(() => {
      runCounter += 1
      if (sampleKind === 'kotobuki') {
        const reviewNeeded = new Set(['F.ORG', 'F.PURPOSE', 'F.EQUIPMENT', 'F.DETAILS'])
        const generated: DetectedField[] = kotobukiFieldHints.map((h) => ({
          id: `${h.id}#${runCounter}`,
          label: h.label,
          type: h.type,
          variant: h.variant,
          excelColumn: h.excelColumn,
          options: h.options,
          optionRegions: h.optionRegions?.map((o) => ({
            option: o.option,
            x: (o.xPct / 100) * naturalSize.width,
            y: (o.yPct / 100) * naturalSize.height,
            w: (o.wPct / 100) * naturalSize.width,
            h: (o.hPct / 100) * naturalSize.height,
          })),
          confirmed: !reviewNeeded.has(h.id),
          source: 'ai' as const,
          x: (h.xPct / 100) * naturalSize.width,
          y: (h.yPct / 100) * naturalSize.height,
          w: (h.wPct / 100) * naturalSize.width,
          h: (h.hPct / 100) * naturalSize.height,
        }))
        commitFields([...fields.filter((f) => f.source !== 'ai'), ...generated])
      } else if (sampleKind === 'itsuwa') {
        const h = itsuwaGroupHint
        const groupH = (h.hPct / 100) * naturalSize.height
        const group: RepeatingGroupDefinition = {
          id: h.id,
          label: h.label,
          dataKey: h.id,
          x: (h.xPct / 100) * naturalSize.width,
          y: (h.yPct / 100) * naturalSize.height,
          w: (h.wPct / 100) * naturalSize.width,
          h: groupH,
          columns: h.columns,
          maxRows: h.maxRows,
          rowHeight: groupH / h.maxRows,
          rowLabelWidthPct: h.rowLabelWidthPct,
          excludeHeaderRow: h.excludeHeaderRow,
          source: 'ai',
        }
        commitGroups([...groups.filter((g) => g.source !== 'ai'), group])
        setSelectedGroupId(group.id)
      } else {
        // 학습되지 않은 임의 업로드 — 일반적인 위치 추정(휴리스틱)만 제공
        const generated: DetectedField[] = Array.from({ length: 6 }, (_, i) => ({
          id: `H.NEW_${runCounter}_${i}`,
          label: `AI 추천 필드 ${i + 1} (검토 필요)`,
          type: 'shorttext' as const,
          excelColumn: `field_${i + 1}`,
          confirmed: false,
          source: 'ai' as const,
          x: naturalSize.width * 0.08,
          y: naturalSize.height * (0.14 + i * 0.11),
          w: naturalSize.width * 0.5,
          h: naturalSize.height * 0.035,
        }))
        commitFields([...fields.filter((f) => f.source !== 'ai'), ...generated])
      }
      setAnalyzing(false)
    }, 1500)
  }

  function handleManualCreate(rect: { x: number; y: number; w: number; h: number }) {
    if (groupArmed) {
      manualGroupCounter += 1
      const groupId = `repeat_group_${manualGroupCounter}`
      const group: RepeatingGroupDefinition = {
        id: groupId,
        label: `반복행 그룹 ${manualGroupCounter}`,
        dataKey: groupId,
        columns: [],
        maxRows: 5,
        rowHeight: rect.h / 5,
        source: 'manual',
        ...rect,
      }
      commitGroups([...groups, group])
      setSelectedGroupId(group.id)
      setSelectedId(null)
      setSelectedColumnId(null)
      setSelectedOptionIndex(null)
      return
    }
    if (!armed) return
    manualCounter += 1
    const isChoice = armed.leaf.type === 'multiple-choice' || armed.leaf.type === 'single-choice'
    const options = isChoice ? ['옵션 1', '옵션 2'] : undefined
    const field: DetectedField = {
      id: `M.NEW_${manualCounter}`,
      label: `${armed.leaf.label}${armed.variant ? ` (${armed.variant})` : ''}`,
      type: armed.leaf.type,
      variant: armed.variant,
      excelColumn: `field_${manualCounter}`,
      confirmed: true,
      source: 'manual',
      options,
      optionRegions: options ? defaultOptionRegions(rect, options) : undefined,
      ...rect,
    }
    commitFields([...fields, field])
    setSelectedId(field.id)
    setSelectedGroupId(null)
    setSelectedColumnId(null)
    setSelectedOptionIndex(null)
  }

  function updateSelected(patch: Partial<DetectedField>) {
    if (!selected) return
    commitFields(fields.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)))
  }

  // 캔버스에서 드래그로 이동·리사이즈한 결과를 반영 — 드래그 종료 시 한 번만 호출되어 히스토리에 1건만 쌓임
  function updateFieldRect(id: string, rect: { x: number; y: number; w: number; h: number }) {
    commitFields(fields.map((f) => (f.id === id ? { ...f, ...rect } : f)))
  }
  function updateGroupRect(id: string, rect: { x: number; y: number; w: number; h: number }) {
    commitGroups(groups.map((g) => (g.id === id ? { ...g, ...rect } : g)))
  }

  function deleteSelected() {
    if (!selected) return
    commitFields(fields.filter((f) => f.id !== selected.id))
    setSelectedId(null)
    setSelectedOptionIndex(null)
  }

  function duplicateSelected() {
    if (!selected) return
    copyCounter += 1
    const copy: DetectedField = {
      ...selected,
      id: `${selected.id}_copy${copyCounter}`,
      x: selected.x + 14,
      y: selected.y + 14,
      optionRegions: selected.optionRegions?.map((o) => ({ ...o })),
      options: selected.options ? [...selected.options] : undefined,
    }
    commitFields([...fields, copy])
    setSelectedId(copy.id)
    setSelectedOptionIndex(null)
  }

  function updateSelectedGroup(patch: Partial<RepeatingGroupDefinition>) {
    if (!selectedGroup) return
    commitGroups(groups.map((g) => (g.id === selectedGroup.id ? { ...g, ...patch } : g)))
  }

  function deleteSelectedGroup() {
    if (!selectedGroup) return
    commitGroups(groups.filter((g) => g.id !== selectedGroup.id))
    setSelectedGroupId(null)
    setSelectedColumnId(null)
  }

  function duplicateSelectedGroup() {
    if (!selectedGroup) return
    copyCounter += 1
    const newId = `${selectedGroup.id}_copy${copyCounter}`
    const copy: RepeatingGroupDefinition = {
      ...selectedGroup,
      id: newId,
      dataKey: newId,
      x: selectedGroup.x + 14,
      y: selectedGroup.y + 14,
      columns: selectedGroup.columns.map((c) => ({ ...c })),
    }
    commitGroups([...groups, copy])
    setSelectedGroupId(copy.id)
    setSelectedColumnId(null)
  }

  // 옵션(체크박스) 단위 조작 — 선택된 필드의 optionRegions 배열만 다룬다
  function updateOptionRect(index: number, rect: { x: number; y: number; w: number; h: number }) {
    if (!selected?.optionRegions) return
    const optionRegions = selected.optionRegions.map((o, i) => (i === index ? { ...o, ...rect } : o))
    commitFields(fields.map((f) => (f.id === selected.id ? { ...f, optionRegions } : f)))
  }

  function duplicateOption(index: number) {
    if (!selected?.optionRegions) return
    optionCounter += 1
    const base = selected.optionRegions[index]
    const newOption = `${base.option} ${optionCounter}`
    const newRegion: OptionRegion = { option: newOption, x: base.x + 10, y: base.y + base.h + 6, w: base.w, h: base.h }
    const optionRegions = [...selected.optionRegions.slice(0, index + 1), newRegion, ...selected.optionRegions.slice(index + 1)]
    const options = [...(selected.options ?? []).slice(0, index + 1), newOption, ...(selected.options ?? []).slice(index + 1)]
    commitFields(fields.map((f) => (f.id === selected.id ? { ...f, optionRegions, options } : f)))
    setSelectedOptionIndex(index + 1)
  }

  function deleteOption(index: number) {
    if (!selected) return
    const optionRegions = selected.optionRegions?.filter((_, i) => i !== index)
    const options = selected.options?.filter((_, i) => i !== index)
    commitFields(fields.map((f) => (f.id === selected.id ? { ...f, optionRegions, options } : f)))
    setSelectedOptionIndex(null)
  }

  function addOption() {
    if (!selected) return
    optionCounter += 1
    const newOption = `옵션 ${optionCounter}`
    const last = selected.optionRegions?.[selected.optionRegions.length - 1]
    const newRegion: OptionRegion = last
      ? { option: newOption, x: last.x + 10, y: last.y + last.h + 6, w: last.w, h: last.h }
      : { option: newOption, x: selected.x + 4, y: selected.y + 4, w: 14, h: 14 }
    const optionRegions = [...(selected.optionRegions ?? []), newRegion]
    const options = [...(selected.options ?? []), newOption]
    commitFields(fields.map((f) => (f.id === selected.id ? { ...f, optionRegions, options } : f)))
    setSelectedOptionIndex(optionRegions.length - 1)
  }

  const confirmedCount = fields.filter((f) => f.confirmed).length

  return (
    <section>
      <div className="mb-[18px] flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight">양식 편집</h1>
          <p className="text-[12.5px] text-ink-sub mt-0.5">PDF 업로드 → AI 자동 편집 또는 수동 편집으로 필드·반복행을 정의 → Excel 템플릿 생성</p>
        </div>
        {pdfSource && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={undo} disabled={historyIndex.current === 0}>↶ Undo</Button>
            <Button size="sm" onClick={redo} disabled={historyIndex.current >= history.current.length - 1}>↷ Redo</Button>
            <Button size="sm" onClick={resetToUpload}>⤴ 다른 PDF 업로드</Button>
          </div>
        )}
      </div>

      {!pdfSource && (
        <Card className="p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-soft text-primary flex items-center justify-center text-2xl">⬆</div>
          <div className="font-bold text-[15px]">양식 PDF를 업로드하세요</div>
          <div className="text-[12.5px] text-ink-sub max-w-md">
            실제 PDF 파일을 올리면 그대로 렌더링됩니다. 업로드 후 상단에서 "AI 자동 편집"으로 필드·반복행을 추천받거나
            "수동 편집"을 켜고 직접 영역을 드래그해 필드 또는 반복행 그룹을 그릴 수 있습니다.
          </div>
          <label className="mt-2 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-[13px] font-semibold cursor-pointer hover:bg-primary-dark">
            PDF 파일 선택
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) loadFile(f)
              }}
            />
          </label>
          <div className="text-[11px] text-ink-faint">또는</div>
          <div className="flex gap-2">
            <Button onClick={() => loadSample('kotobuki')}>샘플 PDF — 고토부키 施設利用申込書</Button>
            <Button onClick={() => loadSample('itsuwa')}>샘플 PDF — ITSUWA 入庫品質検査表 (반복행)</Button>
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            샘플은 AI가 미리 검증한 정확한 위치를 보여줍니다. 직접 업로드한 PDF는 일반적인 위치 추정만 제공되니 검토가 필요합니다.
          </div>
        </Card>
      )}

      {pdfSource && (
        <>
          <TopEditBar
            fileName={fileName}
            onRunAi={runAi}
            aiDisabled={analyzing || !naturalSize}
            manualMode={manualMode}
            onManualModeChange={(v) => {
              setManualMode(v)
              if (!v) {
                setArmed(null)
                setGroupArmed(false)
              }
            }}
            zoom={zoom}
            onZoom={setZoom}
            onSave={() => {
              setJustSaved(true)
              setTimeout(() => setJustSaved(false), 1500)
            }}
            savedTick={justSaved ? 1 : 0}
            onGenerateTemplate={() => setShowTemplate(true)}
          />

          <div className="grid grid-cols-[240px_1fr_300px] gap-4 items-start">
            <FieldLibrary
              manualMode={manualMode}
              armed={armed}
              onArm={(a) => {
                setArmed(a)
                setSelectedId(null)
                setSelectedOptionIndex(null)
              }}
              groupArmed={groupArmed}
              onArmGroup={(v) => {
                setGroupArmed(v)
                setSelectedGroupId(null)
                setSelectedColumnId(null)
              }}
            />

            <div className="flex flex-col gap-3">
              <PdfFieldCanvas
                source={pdfSource}
                fields={fields}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id)
                  setSelectedGroupId(null)
                  setSelectedColumnId(null)
                  setSelectedOptionIndex(null)
                }}
                onUpdateField={updateFieldRect}
                onDuplicateField={duplicateSelected}
                onDeleteField={deleteSelected}
                selectedOptionIndex={selectedOptionIndex}
                onSelectOption={(fieldId, index) => {
                  setSelectedId(fieldId)
                  setSelectedGroupId(null)
                  setSelectedColumnId(null)
                  setSelectedOptionIndex(index)
                }}
                onUpdateOption={updateOptionRect}
                onDuplicateOption={duplicateOption}
                onDeleteOption={deleteOption}
                groups={groups}
                selectedGroupId={selectedGroupId}
                onSelectGroup={(id) => {
                  setSelectedGroupId(id)
                  setSelectedId(null)
                  setSelectedColumnId(null)
                  setSelectedOptionIndex(null)
                }}
                onDuplicateGroup={duplicateSelectedGroup}
                onDeleteGroup={deleteSelectedGroup}
                selectedColumnId={selectedColumnId}
                onSelectColumn={setSelectedColumnId}
                onUpdateGroup={updateGroupRect}
                zoom={zoom}
                manualMode={manualMode}
                armed={armed}
                groupArmed={groupArmed}
                onCreate={handleManualCreate}
                onReady={setNaturalSize}
                analyzing={analyzing}
              />
              <div className="text-[11.5px] text-ink-sub flex items-center gap-3">
                <span>감지된 필드 {fields.length}개</span>
                <span>· 확인됨 {confirmedCount} / {fields.length}</span>
                <span>· 반복행 그룹 {groups.length}개</span>
                {sampleKind && <span className="text-new font-semibold">· 검증된 샘플</span>}
              </div>
            </div>

            {selectedGroup ? (
              <GroupPropertiesPanel
                group={selectedGroup}
                onChange={updateSelectedGroup}
                onDelete={deleteSelectedGroup}
                onDuplicate={duplicateSelectedGroup}
                activeColumnId={selectedColumnId}
              />
            ) : (
              <FieldPropertiesPanel
                field={selected}
                onChange={updateSelected}
                onDelete={deleteSelected}
                onDuplicate={selected ? duplicateSelected : undefined}
                activeOptionIndex={selectedOptionIndex}
                onSelectOption={setSelectedOptionIndex}
                onDuplicateOption={duplicateOption}
                onDeleteOption={deleteOption}
                onAddOption={addOption}
              />
            )}
          </div>
        </>
      )}

      {showTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50" onClick={() => setShowTemplate(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="font-bold text-[15px]">Excel 템플릿 미리보기</div>
              <button onClick={() => setShowTemplate(false)} className="text-ink-sub hover:bg-[#F1F2F6] w-7 h-7 rounded-md">✕</button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              <p className="text-[12px] text-ink-sub mb-3">
                감지된 필드가 헤더 컬럼으로 자동 생성됩니다. 복수/단일 선택 필드는 옵션별 컬럼으로 분리됩니다.
                반복행 그룹은 별도 JSON 배열로 저장되며(그룹 속성 패널의 미리보기 참고), 이 템플릿에는 포함되지 않습니다.
              </p>
              {fields.length === 0 ? (
                <div className="text-[12px] text-ink-faint text-center py-8">아직 정의된 필드가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="border-collapse text-[11px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-primary-soft">
                        {expandColumns(fields).map((col) => (
                          <th key={col} className="border border-border px-2 py-1.5 font-mono text-primary">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {expandColumns(fields).map((col) => (
                          <td key={col} className="border border-border px-2 py-1.5 text-ink-faint">·</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2">
              <Button onClick={() => setShowTemplate(false)}>닫기</Button>
              <Button variant="primary" onClick={() => downloadTemplateXlsx(fields, fileName)} disabled={fields.length === 0}>
                ⬇ Excel(.xlsx)로 다운로드
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
