export function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < startOfToday().getTime()
}

export function dueLabel(dueDate?: string | null) {
  if (!dueDate) return '—'
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return dueDate

  const today = startOfToday()
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${formatDate(dueDate)} (overdue)`
  if (diffDays === 0) return `${formatDate(dueDate)} (today)`
  if (diffDays === 1) return `${formatDate(dueDate)} (tomorrow)`
  if (diffDays <= 7) return `${formatDate(dueDate)} (${diffDays}d)`
  return formatDate(dueDate)
}
