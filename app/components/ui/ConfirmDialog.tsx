'use client'

import React, { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onCancel,
  onConfirm
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-lg border border-slate-200">
        <div className="p-5">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          {description && <div className="mt-2 text-sm text-slate-600">{description}</div>}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              className={
                'rounded-md px-3 py-2 text-sm text-white ' +
                (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
              }
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
