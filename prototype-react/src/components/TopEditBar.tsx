import { Button } from './ui'
import { Switch } from './Switch'

export function TopEditBar({
  fileName,
  onRunAi,
  aiDisabled,
  manualMode,
  onManualModeChange,
  zoom,
  onZoom,
  onSave,
  savedTick,
  onGenerateTemplate,
}: {
  fileName: string
  onRunAi: () => void
  aiDisabled: boolean
  manualMode: boolean
  onManualModeChange: (v: boolean) => void
  zoom: number
  onZoom: (z: number) => void
  onSave: () => void
  savedTick: number
  onGenerateTemplate: () => void
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-4 bg-panel border border-border rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold truncate max-w-[220px]">{fileName}</span>
      </div>

      <div className="flex items-center gap-2 bg-[#F5F6FA] rounded-lg p-1">
        <Button size="sm" variant="primary" onClick={onRunAi} disabled={aiDisabled}>
          🪄 AI 자동 편집 실행
        </Button>
        <div className="flex items-center gap-1.5 px-2">
          <span className="text-[12px] font-medium">✎ 수동 편집</span>
          <Switch checked={manualMode} onChange={onManualModeChange} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onZoom(Math.max(40, zoom - 10))} className="w-7 h-7 rounded-md border border-border text-[13px]">−</button>
          <span className="text-[12px] w-10 text-center text-ink-sub">{zoom}%</span>
          <button onClick={() => onZoom(Math.min(200, zoom + 10))} className="w-7 h-7 rounded-md border border-border text-[13px]">+</button>
        </div>
        <Button size="sm" onClick={onSave}>{savedTick > 0 ? '✓ 저장됨' : '💾 Save'}</Button>
        <Button variant="primary" size="sm" onClick={onGenerateTemplate}>▤ 엑셀 템플릿 생성</Button>
      </div>
    </div>
  )
}
