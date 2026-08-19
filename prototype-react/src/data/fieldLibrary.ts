import type { FieldType } from '../types'

export interface FieldLibraryLeaf {
  type: FieldType
  label: string
  variants?: string[]
}

// "Supported Features" 팔레트 — 참고 이미지 그대로 반영
export const FIELD_LIBRARY: FieldLibraryLeaf[] = [
  { type: 'calculation', label: 'Calculation' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'date', label: 'Date', variants: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY/MM/DD'] },
  { type: 'number', label: 'Number', variants: ['Number', 'Increment', 'Slider', 'Currency'] },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'multiple-choice', label: 'Multiple Choice', variants: ['Checkboxes', 'Button'] },
  { type: 'photo', label: 'Photo (Single)' },
  { type: 'longtext', label: 'Long Text' },
  { type: 'single-choice', label: 'Single Choice', variants: ['Radio', 'Boxes'] },
  { type: 'rating', label: 'Rating' },
  { type: 'signature', label: 'Signature' },
  { type: 'statictext', label: 'Static Text' },
  { type: 'shorttext', label: 'Short Text' },
  { type: 'time', label: 'Time', variants: ['AM/PM', '24 Hour', 'HH:MM:SS', 'MM:SS'] },
]

export const FEATURE_LIST = [
  'Advanced Field Settings',
  'Read Only',
  'Reference Data',
  'Required',
  'System Defaults and Formats on Short Text fields',
  'Undo & Redo',
]

export const fieldTypeLabel: Record<FieldType, string> = {
  calculation: 'Calculation',
  checkbox: 'Checkbox',
  date: 'Date',
  number: 'Number',
  dropdown: 'Dropdown',
  'multiple-choice': 'Multiple Choice',
  photo: 'Photo (Single)',
  longtext: 'Long Text',
  'single-choice': 'Single Choice',
  rating: 'Rating',
  signature: 'Signature',
  statictext: 'Static Text',
  shorttext: 'Short Text',
  time: 'Time',
}
