import { useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { documents, itsuwaEmptyLots } from '../data/sampleData'
import { itsuwaInspectionGroup } from '../data/itsuwaGroupDef'
import { IDENTITY } from '../data/identity'
import { downloadXlsx } from '../lib/exportXlsx'
import type { DocumentRecord, Role } from '../types'

const columns = itsuwaInspectionGroup.columns

function docTable(doc: DocumentRecord) {
  const header = ['Lot No.', ...columns.map((c) => c.label)]
  const rows = doc.rows.map((r) => [r.lot, ...columns.map((c) => r[c.id])])
  return { header, rows }
}

function downloadCsv(doc: DocumentRecord) {
  const { header, rows } = docTable(doc)
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.formId}_${doc.id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadExcel(doc: DocumentRecord) {
  const { header, rows } = docTable(doc)
  downloadXlsx(`${doc.formId}_${doc.id}.xlsx`, header, rows)
}

export function Documents({ role }: { role: Role }) {
  const identity = IDENTITY[role]
  const scopedDocuments = role === 'admin' ? documents : documents.filter((d) => d.owner === identity.name)
  const [selectedId, setSelectedId] = useState(scopedDocuments[0]?.id)
  const doc = scopedDocuments.find((d) => d.id === selectedId) ?? scopedDocuments[0]

  if (!doc) {
    return (
      <section>
        <div className="mb-[18px]">
          <h1 className="text-[19px] font-bold tracking-tight">문서 조회</h1>
          <p className="text-[12.5px] text-ink-sub mt-0.5">{identity.label} 권한으로는 본인이 작성한 문서만 조회합니다</p>
        </div>
        <Card className="p-10 text-center text-[12.5px] text-ink-sub">{identity.name} 명의로 작성된 문서가 없습니다</Card>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-[18px]">
        <h1 className="text-[19px] font-bold tracking-tight">문서 조회</h1>
        <p className="text-[12.5px] text-ink-sub mt-0.5">
          {role === 'admin'
            ? '업로드된 필기 데이터 문서 — 원본 필기와 추출 결과를 대조합니다'
            : `${identity.name} 님이 작성한 문서만 표시됩니다 — 원본 필기와 추출 결과를 대조합니다`}
        </p>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">
        <Card className="h-fit">
          <div className="p-3.5 border-b border-border text-xs font-bold text-ink-sub">문서 목록 · {scopedDocuments.length}건</div>
          {scopedDocuments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full text-left px-3.5 py-3 border-b border-border last:border-none transition-colors ${
                d.id === selectedId ? 'bg-primary-soft' : 'hover:bg-[#FAFAFE]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold">{d.formId}</span>
                <Badge color={d.status === 'Complete' ? 'green' : d.status === 'Write' ? 'amber' : 'blue'}>{d.status}</Badge>
              </div>
              <div className="text-[11px] text-ink-faint mt-1">#{d.id} · {d.owner}</div>
              <div className="text-[11px] text-ink-faint">{d.updatedAt}</div>
            </button>
          ))}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-[18px]">
            <div className="flex items-start justify-between mb-3.5">
              <div>
                <div className="text-[14.5px] font-bold">{doc.formId} · {doc.formName}</div>
                <div className="text-xs text-ink-sub mt-0.5">
                  #{doc.id} · {doc.owner} · {doc.deviceId} · {doc.updatedAt}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => downloadCsv(doc)} disabled={doc.rows.length === 0}>
                  ⬇ CSV 다운로드
                </Button>
                <Button variant="primary" onClick={() => downloadExcel(doc)} disabled={doc.rows.length === 0}>
                  ⬇ Excel(.xlsx) 다운로드
                </Button>
              </div>
            </div>

            <div className="text-xs font-bold text-ink-sub mb-2">원본 필기 렌더링 (Lot 01~25)</div>
            <div className="overflow-x-auto border border-border rounded-lg mb-5">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#F3F0E7]">
                    <th className="border border-[#999] px-2 py-1.5 w-12">Lot<br />No.</th>
                    {columns.map((c) => (
                      <th key={c.id} className="border border-[#999] px-2 py-1.5">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map((r) => (
                    <tr key={r.lot}>
                      <td className="border border-[#999] px-2 py-1.5 text-center bg-[#FBFAF6]">{r.lot}</td>
                      {columns.map((c) => (
                        <td key={c.id} className="border border-[#999] px-2 py-1.5 text-center ink-hand text-[13px]">
                          {r[c.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {doc.rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 1} className="text-center text-ink-faint py-6 border border-[#999]">
                        업로드된 필기 데이터가 없습니다
                      </td>
                    </tr>
                  )}
                  {itsuwaEmptyLots.slice(0, doc.rows.length > 0 ? itsuwaEmptyLots.length : 0).map((lot) => (
                    <tr key={lot}>
                      <td className="border border-[#999] px-2 py-1.5 text-center bg-[#FBFAF6] text-ink-faint">{lot}</td>
                      {columns.map((c) => (
                        <td key={c.id} className="border border-[#999] px-2 py-1.5 text-center text-ink-faint">·</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs font-bold text-ink-sub mb-2">추출 결과 (구조화 데이터) — 기입된 {doc.rows.length}행만 저장됨</div>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-bold text-ink-sub uppercase bg-[#FAFBFC]">
                    <th className="px-3 py-2 border-b border-border">Lot</th>
                    {columns.map((c) => (
                      <th key={c.id} className="px-3 py-2 border-b border-border">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map((r) => (
                    <tr key={r.lot} className="border-b border-border last:border-none">
                      <td className="px-3 py-2 font-semibold">{r.lot}</td>
                      {columns.map((c) => (
                        <td key={c.id} className="px-3 py-2">{r[c.id]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
