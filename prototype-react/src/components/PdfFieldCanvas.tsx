import { Fragment, useEffect, useRef, useState } from 'react'
import { renderPdfPageToCanvas } from '../lib/pdf'
import type { DetectedField, FieldType, RepeatingGroupDefinition } from '../types'
import type { ArmedType } from './FieldLibrary'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Handle = 'nw' | 'ne' | 'sw' | 'se'

interface Interaction {
  kind: 'move' | 'resize'
  target: 'field' | 'group' | 'option'
  id: string
  optionIndex?: number
  handle?: Handle
  startRect: Rect
  startPointer: { x: number; y: number }
}

// DigiDocs 참고 화면처럼 "데이터키 : 타입" 배지를 필드/열 위에 표시
const TYPE_TAG: Record<FieldType, string> = {
  calculation: 'CALC',
  checkbox: 'CHECK',
  date: 'DATE',
  number: 'NUMBER',
  dropdown: 'SELECT',
  'multiple-choice': 'CHECK',
  photo: 'PHOTO',
  longtext: 'TEXT',
  'single-choice': 'RADIO',
  rating: 'RATING',
  signature: 'SIGN',
  statictext: 'STATIC',
  shorttext: 'TEXT',
  time: 'TIME',
}

function RegionTag({ dataKey, type }: { dataKey: string; type: FieldType }) {
  return (
    <span className="absolute top-0.5 left-0.5 inline-flex items-center gap-0.5 bg-white/95 border border-border rounded px-1 py-[1px] text-[8.5px] font-semibold text-primary whitespace-nowrap leading-none shadow-sm">
      ✎ {dataKey} : {TYPE_TAG[type]}
    </span>
  )
}

// GoCanvas 편집기의 "선택한 필드 바로 아래에 뜨는 복사/삭제 툴 리본" 패턴 — 매번 오른쪽
// 속성 패널까지 시선을 옮기지 않고 캔버스에서 바로 복사·삭제할 수 있게 한다.
function QuickToolbar({ rect, onDuplicate, onDelete }: { rect: Rect; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <div
      style={{ left: rect.x, top: rect.y + rect.h + 4 }}
      className="absolute z-30 flex items-center gap-0.5 bg-ink text-white rounded-md shadow-lg p-0.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onDuplicate} className="w-6 h-6 rounded hover:bg-white/20 text-[12px]" title="복사">⧉</button>
      <button onClick={onDelete} className="w-6 h-6 rounded hover:bg-white/20 text-[12px]" title="삭제">✕</button>
    </div>
  )
}

function ResizeHandles({ onHandleDown }: { onHandleDown: (h: Handle) => (e: React.MouseEvent) => void }) {
  const positions: { h: Handle; cls: string }[] = [
    { h: 'nw', cls: '-left-[5px] -top-[5px] cursor-nwse-resize' },
    { h: 'ne', cls: '-right-[5px] -top-[5px] cursor-nesw-resize' },
    { h: 'sw', cls: '-left-[5px] -bottom-[5px] cursor-nesw-resize' },
    { h: 'se', cls: '-right-[5px] -bottom-[5px] cursor-nwse-resize' },
  ]
  return (
    <>
      {positions.map((p) => (
        <div
          key={p.h}
          onMouseDown={onHandleDown(p.h)}
          className={`absolute w-2.5 h-2.5 bg-white border-2 border-primary rounded-full z-20 ${p.cls}`}
        />
      ))}
    </>
  )
}

// 그룹 안의 각 열을 실제 셀 경계(% 위치)로 배치 — 열마다 widthPct가 없으면 그 열만 균등폭으로 대체
// (일부 열만 값을 넣어도 나머지는 자동 균등분할로 채워지도록 열 단위로 판단한다)
function columnLayout(g: RepeatingGroupDefinition) {
  const rowLabelPct = g.rowLabelWidthPct ?? 0
  const available = 100 - rowLabelPct
  const cols = g.columns
  const defaultWidth = available / Math.max(cols.length, 1)
  const widths = cols.map((c) => c.widthPct ?? defaultWidth)
  let cum = rowLabelPct
  return cols.map((c, i) => {
    const widthPct = widths[i]
    const leftPct = cum
    cum += widthPct
    return { col: c, leftPct, widthPct }
  })
}

function applyInteraction(startRect: Rect, dx: number, dy: number, interaction: Interaction): Rect {
  if (interaction.kind === 'move') {
    return { ...startRect, x: startRect.x + dx, y: startRect.y + dy }
  }
  let { x, y, w, h } = startRect
  const MIN = 12
  if (interaction.handle === 'se') {
    w = Math.max(MIN, startRect.w + dx)
    h = Math.max(MIN, startRect.h + dy)
  } else if (interaction.handle === 'ne') {
    w = Math.max(MIN, startRect.w + dx)
    h = Math.max(MIN, startRect.h - dy)
    y = startRect.y + startRect.h - h
  } else if (interaction.handle === 'sw') {
    w = Math.max(MIN, startRect.w - dx)
    h = Math.max(MIN, startRect.h + dy)
    x = startRect.x + startRect.w - w
  } else if (interaction.handle === 'nw') {
    w = Math.max(MIN, startRect.w - dx)
    h = Math.max(MIN, startRect.h - dy)
    x = startRect.x + startRect.w - w
    y = startRect.y + startRect.h - h
  }
  return { x, y, w, h }
}

export function PdfFieldCanvas({
  source,
  fields,
  selectedId,
  onSelect,
  onUpdateField,
  onDuplicateField,
  onDeleteField,
  selectedOptionIndex,
  onSelectOption,
  onUpdateOption,
  onDuplicateOption,
  onDeleteOption,
  groups,
  selectedGroupId,
  onSelectGroup,
  onDuplicateGroup,
  onDeleteGroup,
  selectedColumnId,
  onSelectColumn,
  onUpdateGroup,
  zoom,
  manualMode,
  armed,
  groupArmed,
  onCreate,
  onReady,
  analyzing,
}: {
  source: File | string
  fields: DetectedField[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdateField: (id: string, patch: Rect) => void
  onDuplicateField: () => void
  onDeleteField: () => void
  selectedOptionIndex: number | null
  onSelectOption: (fieldId: string, index: number) => void
  onUpdateOption: (index: number, patch: Rect) => void
  onDuplicateOption: (index: number) => void
  onDeleteOption: (index: number) => void
  groups: RepeatingGroupDefinition[]
  selectedGroupId: string | null
  onSelectGroup: (id: string) => void
  onDuplicateGroup: () => void
  onDeleteGroup: () => void
  selectedColumnId: string | null
  onSelectColumn: (id: string) => void
  onUpdateGroup: (id: string, patch: Rect) => void
  zoom: number
  manualMode: boolean
  armed: ArmedType | null
  groupArmed: boolean
  onCreate: (rect: Rect) => void
  onReady?: (size: { width: number; height: number }) => void
  analyzing?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [drawing, setDrawing] = useState<Rect | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [liveRect, setLiveRect] = useState<Rect | null>(null)

  useEffect(() => {
    let cancelled = false
    setNatural(null)
    ;(async () => {
      if (!canvasRef.current) return
      const size = await renderPdfPageToCanvas(source, canvasRef.current, 760, () => cancelled)
      if (cancelled || !size) return
      setNatural({ width: size.width, height: size.height })
      onReady?.({ width: size.width, height: size.height })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const scale = zoom / 100

  function toNatural(e: React.MouseEvent | MouseEvent) {
    const rect = innerRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!manualMode || (!armed && !groupArmed)) return
    const p = toNatural(e)
    dragStart.current = p
    setDrawing({ x: p.x, y: p.y, w: 0, h: 0 })
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragStart.current) return
    const p = toNatural(e)
    const s = dragStart.current
    setDrawing({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  function onMouseUp() {
    if (drawing && drawing.w > 8 && drawing.h > 8) {
      onCreate(drawing)
    }
    dragStart.current = null
    setDrawing(null)
  }

  // 이미 놓인 필드/그룹 영역을 드래그로 이동·리사이즈 — 창 전체에서 mousemove/up을 듣는다
  useEffect(() => {
    if (!interaction) return
    function handleMove(e: MouseEvent) {
      const p = toNatural(e)
      const dx = p.x - interaction!.startPointer.x
      const dy = p.y - interaction!.startPointer.y
      setLiveRect(applyInteraction(interaction!.startRect, dx, dy, interaction!))
    }
    function handleUp(e: MouseEvent) {
      const p = toNatural(e)
      const dx = p.x - interaction!.startPointer.x
      const dy = p.y - interaction!.startPointer.y
      const finalRect = applyInteraction(interaction!.startRect, dx, dy, interaction!)
      if (interaction!.target === 'field') onUpdateField(interaction!.id, finalRect)
      else if (interaction!.target === 'group') onUpdateGroup(interaction!.id, finalRect)
      else onUpdateOption(interaction!.optionIndex!, finalRect)
      setInteraction(null)
      setLiveRect(null)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction])

  function startMove(target: 'field' | 'group' | 'option', id: string, startRect: Rect, optionIndex?: number) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      setInteraction({ kind: 'move', target, id, optionIndex, startRect, startPointer: toNatural(e) })
    }
  }
  function startResize(target: 'field' | 'group' | 'option', id: string, startRect: Rect, handle: Handle, optionIndex?: number) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      setInteraction({ kind: 'resize', target, id, optionIndex, handle, startRect, startPointer: toNatural(e) })
    }
  }

  const displayW = natural ? natural.width * scale : undefined
  const displayH = natural ? natural.height * scale : undefined

  return (
    <div className="overflow-auto border border-border rounded-lg bg-[#EDEEF3] p-4" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div style={{ width: displayW, height: displayH }} className="relative mx-auto">
        <div
          ref={innerRef}
          style={{
            width: natural?.width,
            height: natural?.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          className="relative bg-white shadow-md"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            dragStart.current = null
            setDrawing(null)
          }}
        >
          <canvas ref={canvasRef} className="block pointer-events-none select-none" />

          {groups.map((g) => {
            const isSelected = selectedGroupId === g.id
            const rect = isSelected && interaction?.target === 'group' && liveRect ? liveRect : g
            return (
              <Fragment key={g.id}>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectGroup(g.id)
                  }}
                  onMouseDown={isSelected ? startMove('group', g.id, g) : undefined}
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                  className={`absolute border-2 rounded-[3px] overflow-hidden transition-colors ${
                    isSelected ? 'border-[#0B8F63] bg-accent-soft/40 z-10 cursor-move' : 'border-accent/70 bg-accent-soft/15 hover:border-accent cursor-pointer'
                  }`}
                >
                  <span className="absolute -top-[18px] left-0 text-[9.5px] font-bold text-[#0B8F63] bg-white/90 px-1 rounded-sm whitespace-nowrap">
                    ▥ {g.label} · {g.columns.length}열 · 최대 {g.maxRows}행
                  </span>

                  {g.rowHeight > 0 &&
                    Array.from({ length: Math.max(0, Math.min(g.maxRows - 1, 60)) }, (_, i) => (
                      <div
                        key={`row-${i}`}
                        style={{ top: (i + 1) * g.rowHeight }}
                        className="absolute left-0 right-0 border-t border-dashed border-accent/40 pointer-events-none"
                      />
                    ))}

                  {columnLayout(g).map(({ col, leftPct, widthPct }) => (
                    <button
                      key={col.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectGroup(g.id)
                        onSelectColumn(col.id)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{ left: `${leftPct}%`, top: 0, width: `${widthPct}%`, height: '100%' }}
                      className={`absolute border-r border-dashed text-left overflow-hidden transition-colors ${
                        selectedGroupId === g.id && selectedColumnId === col.id
                          ? 'bg-primary/20 border-primary z-10'
                          : 'border-accent/30 hover:bg-primary/10'
                      }`}
                    >
                      <RegionTag dataKey={col.excelColumn} type={col.type} />
                    </button>
                  ))}

                  {isSelected && <ResizeHandles onHandleDown={(h) => startResize('group', g.id, g, h)} />}
                </div>
                {isSelected && !interaction && <QuickToolbar rect={rect} onDuplicate={onDuplicateGroup} onDelete={onDeleteGroup} />}
              </Fragment>
            )
          })}

          {fields.map((f) => {
            const isSelected = selectedId === f.id
            const rect = isSelected && interaction?.target === 'field' && liveRect ? liveRect : f
            const hasOptions = !!f.optionRegions?.length
            return (
              <Fragment key={f.id}>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(f.id)
                  }}
                  onMouseDown={isSelected ? startMove('field', f.id, f) : undefined}
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                  className={`absolute border-[1.5px] rounded-[3px] text-left overflow-hidden transition-colors ${
                    hasOptions ? 'border-dashed border-ink-faint/40' : 'border-dashed'
                  } ${
                    isSelected
                      ? hasOptions
                        ? 'border-primary/60 z-10 cursor-move'
                        : 'border-primary bg-primary/15 z-10 cursor-move'
                      : hasOptions
                      ? 'hover:border-primary/50 cursor-pointer'
                      : f.source === 'ai'
                      ? 'border-new/60 bg-new/10 hover:border-new cursor-pointer'
                      : 'border-primary/50 bg-primary/5 hover:border-primary cursor-pointer'
                  }`}
                >
                  <RegionTag dataKey={f.excelColumn} type={f.type} />
                  {isSelected && !hasOptions && <ResizeHandles onHandleDown={(h) => startResize('field', f.id, f, h)} />}
                </div>
                {isSelected && !interaction && selectedOptionIndex == null && (
                  <QuickToolbar rect={rect} onDuplicate={onDuplicateField} onDelete={onDeleteField} />
                )}
              </Fragment>
            )
          })}

          {fields.flatMap((f) =>
            (f.optionRegions ?? []).map((opt, i) => {
              const isActiveField = selectedId === f.id
              const isActiveOption = isActiveField && selectedOptionIndex === i
              const rect = isActiveOption && interaction?.target === 'option' && liveRect ? liveRect : opt
              return (
                <Fragment key={`${f.id}_opt_${i}`}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOption(f.id, i)
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      onSelectOption(f.id, i)
                      setInteraction({ kind: 'move', target: 'option', id: f.id, optionIndex: i, startRect: opt, startPointer: toNatural(e) })
                    }}
                    style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                    className={`absolute border-2 rounded-[2px] transition-colors z-10 ${
                      isActiveOption ? 'border-primary bg-primary/20 cursor-move' : 'border-accent/70 bg-white/40 hover:border-primary/60 cursor-pointer'
                    }`}
                    title={opt.option}
                  >
                    {isActiveOption && <ResizeHandles onHandleDown={(h) => startResize('option', f.id, opt, h, i)} />}
                  </div>
                  {isActiveOption && !interaction && (
                    <QuickToolbar rect={rect} onDuplicate={() => onDuplicateOption(i)} onDelete={() => onDeleteOption(i)} />
                  )}
                </Fragment>
              )
            })
          )}

          {drawing && (
            <div
              style={{ left: drawing.x, top: drawing.y, width: drawing.w, height: drawing.h }}
              className="absolute border-[1.5px] border-primary bg-primary/15 pointer-events-none"
            />
          )}

          {analyzing && (
            <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full border-[3px] border-primary-soft border-t-primary animate-spin" />
              <div className="text-[12px] font-semibold text-primary">AI가 영역을 분석하고 있습니다…</div>
            </div>
          )}

          {!natural && (
            <div className="absolute inset-0 flex items-center justify-center text-ink-faint text-[12px]">PDF 렌더링 중…</div>
          )}
        </div>
      </div>
    </div>
  )
}
