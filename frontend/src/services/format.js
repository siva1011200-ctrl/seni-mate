export const TYPE_LABELS = {
  notes: 'Notes',
  previous_paper: 'Previous paper',
  tips: 'Tips',
}

export const STATUS_LABELS = {
  approved: 'Verified',
  pending: 'Pending review',
  rejected: 'Rejected',
}

export function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
