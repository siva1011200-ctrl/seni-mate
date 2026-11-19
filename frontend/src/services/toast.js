export function showToast(message) {
  window.dispatchEvent(new CustomEvent('senimate-toast', { detail: message }))
}
