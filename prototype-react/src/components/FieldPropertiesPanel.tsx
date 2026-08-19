import { useEffect, useRef } from 'react'
import { Card, Button } from './ui'
import { Switch } from './Switch'
import { fieldTypeLabel, FIELD_LIBRARY } from '../data/fieldLibrary'
import type { DetectedField, FieldType } from '../types'

const FORMAT_OPTIONS: Partial<Record<FieldType, string[]>> = {
  date: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY/MM/DD'],
  time: ['AM/PM', '24 Hour', 'HH:MM:SS', 'MM:SS'],
  number: ['Number', 'Increment', 'Slider', 'Currency'],
}

const SYSTEM_DEFAULTS = ['None', 'Today', 'Current User', 'Auto Increment']
const SWATCHES = ['#FFFFFF', '#F5F6FA', '#EEF0FE', '#FEF3E0', '#E6FBF3', '#FDEAEA']

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10.5px] font-bold text-ink-faint uppercase mb-1">{label}</div>
    {children}
  </div>
)

const inputCls = 'w-full h-8 border border-border rounded-md px-2 text-[12px]'

const isChoiceType = (t: FieldType) => t === 'single-choice' || t === 'multiple-choice'

export function FieldPropertiesPanel({
  field,
  onChange,
  onDelete,
  onDuplicate,
  activeOptionIndex,
  onSelectOption,
  onDuplicateOption,
  onDeleteOption,
  onAddOption,
}: {
  field: DetectedField | null
  onChange: (patch: Partial<DetectedField>) => void
  onDelete: () => void
  onDuplicate?: () => void
  activeOptionIndex?: number | null
  onSelectOption?: (index: number) => void
  onDuplicateOption?: (index: number) => void
  onDeleteOption?: (index: number) => void
  onAddOption?: () => void
}) {
  const optionRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // 캔버스에서 옵션(체크박스) 박스를 클릭했을 때 해당 옵션 입력으로 스크롤·포커스 이동
  useEffect(() => {
    if (activeOptionIndex == null) return
    const input = optionRefs.current[activeOptionIndex]
    if (input) {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' })
      input.focus()
    }
  }, [activeOptionIndex])

  if (!field) {
    return (
      <Card className="p-4 text-[12.5px] text-ink-sub">
        캔버스에서 필드를 클릭하면 속성을 편집할 수 있습니다.
        <div className="mt-3 text-[11px] text-ink-faint">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-new/20 border border-new/60 mr-1.5 align-middle" /> AI 인식
          <br />
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/15 border border-primary/60 mr-1.5 align-middle" /> 수동 추가
        </div>
      </Card>
    )
  }

  const formats = FORMAT_OPTIONS[field.type]

  function updateOption(index: number, label: string) {
    if (!field) return
    const options = [...(field.options ?? [])]
    options[index] = label
    const optionRegions = field.optionRegions?.map((o, i) => (i === index ? { ...o, option: label } : o))
    onChange({ options, optionRegions })
  }

  return (
    <Card className="p-4 flex flex-col gap-3.5 max-h-[calc(100vh-140px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-bold">Field</div>
        <div className="flex items-center gap-2">
          {onDuplicate && (
            <button onClick={onDuplicate} className="text-[11px] text-primary hover:underline">복사</button>
          )}
          <button onClick={onDelete} className="text-[11px] text-danger hover:underline">삭제</button>
        </div>
      </div>

      <FieldRow label="Label">
        <textarea
          className="w-full border border-border rounded-md px-2 py-1.5 text-[12px] resize-none"
          rows={2}
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Type">
        <select
          className={inputCls}
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as FieldType, variant: undefined, format: undefined })}
        >
          {FIELD_LIBRARY.map((l) => (
            <option key={l.type} value={l.type}>{l.label}</option>
          ))}
        </select>
      </FieldRow>

      {isChoiceType(field.type) && (
        <div className="border-t border-border pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] font-bold text-ink-faint uppercase">Options(체크박스) · {field.options?.length ?? 0}개</div>
            {onAddOption && <Button size="sm" onClick={onAddOption}>+ 옵션 추가</Button>}
          </div>
          {!field.optionRegions?.length && (
            <div className="text-[11px] text-warn py-1.5 px-2 bg-warn-soft rounded-md">
              이 필드는 옵션별 좌표가 없습니다 — 체크 판정이 필드 전체 영역 기준으로만 동작합니다.
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {(field.options ?? []).map((opt, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 border rounded-md p-1.5 transition-colors ${
                  i === activeOptionIndex ? 'border-primary ring-2 ring-primary/40 bg-primary/5' : 'border-border'
                }`}
              >
                <input
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  className={`${inputCls} flex-1`}
                  value={opt}
                  onFocus={() => onSelectOption?.(i)}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {onDuplicateOption && (
                  <button
                    onClick={() => onDuplicateOption(i)}
                    className="w-6 h-6 rounded-md border border-border text-[11px] shrink-0"
                    title="이 옵션 복사"
                  >
                    ⧉
                  </button>
                )}
                {onDeleteOption && (
                  <button
                    onClick={() => onDeleteOption(i)}
                    className="w-6 h-6 rounded-md border border-border text-[11px] text-danger shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="text-[10.5px] text-ink-faint">캔버스의 각 체크박스를 클릭하면 여기로 스크롤됩니다. 박스를 드래그하면 이동, 모서리 핸들로 크기 조절됩니다.</div>
        </div>
      )}

      <div className="border-t border-border pt-3 flex flex-col gap-3">
        <div className="text-[10.5px] font-bold text-ink-faint uppercase">Config</div>
        <FieldRow label="Default">
          <input className={inputCls} value={field.default ?? ''} onChange={(e) => onChange({ default: e.target.value })} />
        </FieldRow>
        <FieldRow label="Format">
          <select
            className={inputCls}
            disabled={!formats}
            value={field.format ?? 'None'}
            onChange={(e) => onChange({ format: e.target.value })}
          >
            <option>None</option>
            {formats?.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="System Default">
          <select className={inputCls} value={field.systemDefault ?? 'None'} onChange={(e) => onChange({ systemDefault: e.target.value })}>
            {SYSTEM_DEFAULTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FieldRow>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium">Required</span>
        <Switch checked={!!field.required} onChange={(v) => onChange({ required: v })} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium">Read Only</span>
        <Switch checked={!!field.readOnly} onChange={(v) => onChange({ readOnly: v })} />
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-3">
        <div className="text-[10.5px] font-bold text-ink-faint uppercase">Design</div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Position X">
            <input type="number" className={inputCls} value={Math.round(field.x)} onChange={(e) => onChange({ x: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Position Y">
            <input type="number" className={inputCls} value={Math.round(field.y)} onChange={(e) => onChange({ y: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Width">
            <input type="number" className={inputCls} value={Math.round(field.w)} onChange={(e) => onChange({ w: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Height">
            <input type="number" className={inputCls} value={Math.round(field.h)} onChange={(e) => onChange({ h: Number(e.target.value) })} />
          </FieldRow>
        </div>
        <FieldRow label="Background">
          <div className="flex gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ background: c })}
                className={`w-6 h-6 rounded-md border ${field.background === c ? 'ring-2 ring-primary' : 'border-border'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </FieldRow>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium">Hide On PDF</span>
          <Switch checked={!!field.hideOnPdf} onChange={(v) => onChange({ hideOnPdf: v })} />
        </div>
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <div className="text-[10.5px] font-bold text-ink-faint uppercase">Excel 매핑 (자체 추가)</div>
        <FieldRow label="Excel 컬럼명">
          <input
            className={`${inputCls} font-mono`}
            value={field.excelColumn}
            onChange={(e) => onChange({ excelColumn: e.target.value })}
          />
        </FieldRow>
        {field.options && (
          <div className="text-[10.5px] text-ink-faint">옵션별 컬럼으로 자동 분리: {field.options.map((o) => `${field.excelColumn}_${o}`).join(', ')}</div>
        )}
      </div>

      <div className="text-[10.5px] text-ink-faint">
        {field.source === 'ai' ? 'AI가 감지한 필드입니다.' : '수동으로 추가한 필드입니다.'} 현재 타입: {fieldTypeLabel[field.type]}
        {field.variant ? ` · ${field.variant}` : ''}
      </div>

      <Button
        variant={field.confirmed ? 'default' : 'primary'}
        onClick={() => onChange({ confirmed: !field.confirmed })}
        className="w-full justify-center"
      >
        {field.confirmed ? '✓ 확인됨 — 다시 검토로' : '이 필드 확인 완료로 표시'}
      </Button>
    </Card>
  )
}
