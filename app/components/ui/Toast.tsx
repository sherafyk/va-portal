'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  kind: ToastKind
  title?: string
  message: string
}

type ToastContextValue = {
  push: (toast: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function uid() {
  // Prefer crypto.randomUUID when available.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis as any
  if (c?.crypto?.randomUUID) return c.crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = uid()
    const item: ToastItem = { id, ...toast }
    setToasts(prev => [item, ...prev])

    // Auto-dismiss
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div
        className="fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={
              'rounded-lg border bg-white shadow-sm px-4 py-3 ' +
              (t.kind === 'success'
                ? 'border-emerald-200'
                : t.kind === 'error'
                ? 'border-red-200'
                : 'border-slate-200')
            }
          >
            {t.title && <div className="text-sm font-semibold text-slate-900">{t.title}</div>}
            <div className="text-sm text-slate-700">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>.')
  }

  return {
    success: (message: string, title?: string) => ctx.push({ kind: 'success', title, message }),
    error: (message: string, title?: string) => ctx.push({ kind: 'error', title, message }),
    info: (message: string, title?: string) => ctx.push({ kind: 'info', title, message })
  }
}
