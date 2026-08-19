import { useState } from 'react'
import { Card } from './ui'
import { FIELD_LIBRARY, FEATURE_LIST } from '../data/fieldLibrary'
import type { FieldLibraryLeaf } from '../data/fieldLibrary'

function NumBadge({ n }: { n: number | string }) {
  return (
    <span className="shrink-0 w-5 h-5 rounded-full bg-[#F5821F] text-white text-[10px] font-bold flex items-center justify-center">
      {n}
    </span>
  )
}

export interface ArmedType {
  leaf: FieldLibraryLeaf
  variant?: string
}

export function FieldLibrary({
  manualMode,
  armed,
  onArm,
  groupArmed,
  onArmGroup,
}: {
  manualMode: boolean
  armed: ArmedType | null
  onArm: (a: ArmedType | null) => void
  groupArmed: boolean
  onArmGroup: (v: boolean) => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  function pick(leaf: FieldLibraryLeaf, variant?: string) {
    if (!manualMode) return
    onArmGroup(false)
    const isSame = armed?.leaf.type === leaf.type && armed?.variant === variant
    onArm(isSame ? null : { leaf, variant })
  }

  function pickGroup() {
    if (!manualMode) return
    onArm(null)
    onArmGroup(!groupArmed)
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-3.5 py-3 border-b border-border">
        <div className="text-[13px] font-bold">Add</div>
        {manualMode ? (
          <div className="text-[10.5px] text-ink-sub mt-0.5">
            타입을 고르고 캔버스에서 드래그해 영역을 지정하세요
          </div>
        ) : (
          <div className="text-[10.5px] text-warn mt-0.5">
            상단에서 "수동 편집"을 켜야 필드를 추가할 수 있어요
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <NumBadge n={1} />
          <span className="text-[12.5px] font-bold">Fields</span>
        </div>
        <div className="flex flex-col gap-0.5 mb-4">
          {FIELD_LIBRARY.map((leaf, i) => {
            const activeLeaf = armed?.leaf.type === leaf.type && !leaf.variants
            return (
              <div key={leaf.type}>
                <button
                  disabled={!manualMode}
                  onClick={() => (leaf.variants ? setOpen(open === leaf.type ? null : leaf.type) : pick(leaf))}
                  className={`w-full flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-md text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeLeaf ? 'bg-primary-soft' : 'hover:bg-[#F5F6FA]'
                  }`}
                >
                  <NumBadge n={i + 1} />
                  <span className="text-[12px] flex-1">{leaf.label}</span>
                  {leaf.variants ? (
                    <span className="text-ink-faint text-[11px]">{open === leaf.type ? '−' : '+'}</span>
                  ) : (
                    <span className={`text-[13px] font-bold ${activeLeaf ? 'text-primary' : 'text-ink-faint'}`}>
                      {activeLeaf ? '●' : '+'}
                    </span>
                  )}
                </button>
                {leaf.variants && open === leaf.type && (
                  <div className="ml-7 pl-2 border-l border-border flex flex-col gap-0.5 mb-1">
                    {leaf.variants.map((v) => {
                      const activeVariant = armed?.leaf.type === leaf.type && armed?.variant === v
                      return (
                        <button
                          key={v}
                          disabled={!manualMode}
                          onClick={() => pick(leaf, v)}
                          className={`flex items-center gap-1.5 py-1 text-[11.5px] text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                            activeVariant ? 'text-primary font-semibold' : 'text-ink-sub hover:text-primary'
                          }`}
                        >
                          <span className={activeVariant ? 'text-primary' : 'text-accent'}>{activeVariant ? '●' : '✓'}</span>
                          {v}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <NumBadge n={2} />
          <span className="text-[12.5px] font-bold">Repeating Group</span>
        </div>
        <div className="mb-4">
          <button
            disabled={!manualMode}
            onClick={pickGroup}
            className={`w-full flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-md text-left disabled:opacity-40 disabled:cursor-not-allowed ${
              groupArmed ? 'bg-accent-soft' : 'hover:bg-[#F5F6FA]'
            }`}
          >
            <NumBadge n="▥" />
            <span className="text-[12px] flex-1">반복행 그룹 영역</span>
            <span className={`text-[13px] font-bold ${groupArmed ? 'text-[#0B8F63]' : 'text-ink-faint'}`}>{groupArmed ? '●' : '+'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <NumBadge n={3} />
          <span className="text-[12.5px] font-bold">Features</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {FEATURE_LIST.map((f) => (
            <div key={f} className="flex items-start gap-1.5 text-[11.5px] text-ink-sub">
              <span className="text-accent shrink-0">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
