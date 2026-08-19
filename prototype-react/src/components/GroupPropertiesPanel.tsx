import { useEffect, useRef } from 'react'
import { Card, Button } from './ui'
import { fieldTypeLabel, FIELD_LIBRARY } from '../data/fieldLibrary'
import type { RepeatingGroupDefinition, RepeatingColumn, FieldType } from '../types'

const inputCls = 'w-full h-8 border border-border rounded-md px-2 text-[12px]'

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10.5px] font-bold text-ink-faint uppercase mb-1">{label}</div>
    {children}
  </div>
)

let columnCounter = 0

function samplePreviewValue(type: FieldType): string {
  if (type === 'checkbox') return 'true'
  if (type === 'number') return '0'
  if (type === 'time') return '09:00'
  if (type === 'date') return '2026-08-14'
  return '예시값'
}

export function GroupPropertiesPanel({
  group,
  onChange,
  onDelete,
  onDuplicate,
  activeColumnId,
}: {
  group: RepeatingGroupDefinition | null
  onChange: (patch: Partial<RepeatingGroupDefinition>) => void
  onDelete: () => void
  onDuplicate?: () => void
  activeColumnId?: string | null
}) {
  const columnRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 캔버스에서 셀을 클릭했을 때 해당 열 입력으로 스크롤·포커스 이동
  useEffect(() => {
    if (!activeColumnId) return
    const input = columnRefs.current[activeColumnId]
    if (input) {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' })
      input.focus()
    }
  }, [activeColumnId])

  if (!group) return null

  function updateColumn(id: string, patch: Partial<RepeatingColumn>) {
    onChange({ columns: group!.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  }

  function addColumn() {
    columnCounter += 1
    const column: RepeatingColumn = {
      id: `col_${columnCounter}`,
      label: `열 ${group!.columns.length + 1}`,
      type: 'shorttext',
      excelColumn: `col_${columnCounter}`,
    }
    onChange({ columns: [...group!.columns, column] })
  }

  function removeColumn(id: string) {
    onChange({ columns: group!.columns.filter((c) => c.id !== id) })
  }

  function duplicateColumn(id: string) {
    columnCounter += 1
    const i = group!.columns.findIndex((c) => c.id === id)
    const source = group!.columns[i]
    const copy: RepeatingColumn = { ...source, id: `col_${columnCounter}`, label: `${source.label} 복사`, excelColumn: `${source.excelColumn}_copy${columnCounter}` }
    const columns = [...group!.columns.slice(0, i + 1), copy, ...group!.columns.slice(i + 1)]
    onChange({ columns })
  }

  function moveColumn(id: string, dir: -1 | 1) {
    const cols = [...group!.columns]
    const i = cols.findIndex((c) => c.id === id)
    const j = i + dir
    if (j < 0 || j >= cols.length) return
    ;[cols[i], cols[j]] = [cols[j], cols[i]]
    onChange({ columns: cols })
  }

  const previewRows = [0, 1].map(() => {
    const row: Record<string, string> = {}
    for (const c of group.columns) row[c.excelColumn] = samplePreviewValue(c.type)
    return row
  })
  const previewJson = { [group.dataKey]: previewRows }

  return (
    <Card className="p-4 flex flex-col gap-3.5 max-h-[calc(100vh-140px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-bold">Repeating Group</div>
        <div className="flex items-center gap-2">
          {onDuplicate && <button onClick={onDuplicate} className="text-[11px] text-primary hover:underline">복사</button>}
          <button onClick={onDelete} className="text-[11px] text-danger hover:underline">삭제</button>
        </div>
      </div>

      <FieldRow label="Group Label">
        <input className={inputCls} value={group.label} onChange={(e) => onChange({ label: e.target.value })} />
      </FieldRow>

      <FieldRow label="Data Key (배열명)">
        <input className={`${inputCls} font-mono`} value={group.dataKey} onChange={(e) => onChange({ dataKey: e.target.value })} />
      </FieldRow>

      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Max Rows">
          <input
            type="number"
            className={inputCls}
            value={group.maxRows}
            onChange={(e) => onChange({ maxRows: Number(e.target.value) })}
          />
        </FieldRow>
        <FieldRow label="Row Height">
          <input
            type="number"
            className={inputCls}
            value={Math.round(group.rowHeight)}
            onChange={(e) => onChange({ rowHeight: Number(e.target.value) })}
          />
        </FieldRow>
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] font-bold text-ink-faint uppercase">Columns · {group.columns.length}개</div>
          <Button size="sm" onClick={addColumn}>+ 열 추가</Button>
        </div>

        {group.columns.length === 0 && (
          <div className="text-[11px] text-ink-faint py-2 text-center border border-dashed border-border rounded-md">
            아직 열이 없습니다. "열 추가"로 시작하세요.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {group.columns.map((c, i) => (
            <div
              key={c.id}
              className={`border rounded-md p-2 flex flex-col gap-1.5 transition-colors ${
                c.id === activeColumnId ? 'border-primary ring-2 ring-primary/40 bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <input
                  ref={(el) => {
                    columnRefs.current[c.id] = el
                  }}
                  className={`${inputCls} flex-1`}
                  value={c.label}
                  onChange={(e) => updateColumn(c.id, { label: e.target.value })}
                  placeholder="열 이름"
                />
                <button
                  disabled={i === 0}
                  onClick={() => moveColumn(c.id, -1)}
                  className="w-6 h-6 rounded-md border border-border text-[11px] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  disabled={i === group.columns.length - 1}
                  onClick={() => moveColumn(c.id, 1)}
                  className="w-6 h-6 rounded-md border border-border text-[11px] disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => duplicateColumn(c.id)}
                  className="w-6 h-6 rounded-md border border-border text-[11px]"
                  title="이 열 복사"
                >
                  ⧉
                </button>
                <button onClick={() => removeColumn(c.id)} className="w-6 h-6 rounded-md border border-border text-[11px] text-danger">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  className={`${inputCls} flex-1`}
                  value={c.type}
                  onChange={(e) => updateColumn(c.id, { type: e.target.value as FieldType })}
                >
                  {FIELD_LIBRARY.map((l) => (
                    <option key={l.type} value={l.type}>{l.label}</option>
                  ))}
                </select>
                <input
                  className={`${inputCls} flex-1 font-mono`}
                  value={c.excelColumn}
                  onChange={(e) => updateColumn(c.id, { excelColumn: e.target.value })}
                  placeholder="data_key"
                />
                <input
                  type="number"
                  className={`${inputCls} w-16 shrink-0`}
                  value={c.widthPct ?? ''}
                  onChange={(e) => updateColumn(c.id, { widthPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="자동"
                  title="열 너비 (그룹 대비 %)"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium">헤더 행 제외</span>
        <input
          type="checkbox"
          checked={!!group.excludeHeaderRow}
          onChange={(e) => onChange({ excludeHeaderRow: e.target.checked })}
        />
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-3">
        <div className="text-[10.5px] font-bold text-ink-faint uppercase">Design</div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Position X">
            <input type="number" className={inputCls} value={Math.round(group.x)} onChange={(e) => onChange({ x: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Position Y">
            <input type="number" className={inputCls} value={Math.round(group.y)} onChange={(e) => onChange({ y: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Width">
            <input type="number" className={inputCls} value={Math.round(group.w)} onChange={(e) => onChange({ w: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Height">
            <input type="number" className={inputCls} value={Math.round(group.h)} onChange={(e) => onChange({ h: Number(e.target.value) })} />
          </FieldRow>
        </div>
      </div>

      {group.columns.length > 0 && (
        <div className="border-t border-border pt-3 flex flex-col gap-1.5">
          <div className="text-[10.5px] font-bold text-ink-faint uppercase">반복행 JSON 미리보기</div>
          <pre className="text-[10.5px] bg-[#F5F6FA] rounded-md p-2 overflow-x-auto font-mono leading-relaxed">
            {JSON.stringify(previewJson, null, 2)}
          </pre>
        </div>
      )}

      <div className="text-[10.5px] text-ink-faint">
        {group.source === 'ai' ? 'AI가 감지한 반복행 그룹입니다.' : '수동으로 추가한 반복행 그룹입니다.'} 행당 컬럼 {group.columns.length}개 ·
        {fieldTypeLabel[group.columns[0]?.type] ?? ''}
      </div>
    </Card>
  )
}
