export const CLINICAL_DRAFT_WARNING = 'Hay cambios clínicos sin guardar. ¿Quieres salir y descartarlos?'

/** Programmatic navigation and link clicks share the same cancellable guard. */
export function requestClinicalNavigation(): boolean {
  if (typeof window === 'undefined') return true
  return window.dispatchEvent(new Event('clinia:before-navigation', { cancelable: true }))
}

type IndexedWindow = Window & { navigation?: { currentEntry?: { index: number } } }

export function supportsClinicalHistoryGuard(browser: Window): boolean {
  const index = (browser as IndexedWindow).navigation?.currentEntry?.index
  return typeof index === 'number' && index >= 0
}

/** popstate is not cancellable. On refusal, restore the exact history position
 * before Next's bubble listener sees the traversal. Never add synthetic entries.
 */
export function protectClinicalHistory(browser: Window, confirmLeave: () => boolean): () => void {
  const indexed = browser as IndexedWindow
  const originalIndex = indexed.navigation?.currentEntry?.index
  if (typeof originalIndex !== 'number' || originalIndex < 0) return () => {}
  let restoring = false
  const onPopState = (event: PopStateEvent) => {
    const index = indexed.navigation?.currentEntry?.index
    if (typeof index !== 'number' || index === originalIndex) { restoring = false; return }
    if (restoring || !confirmLeave()) {
      event.stopImmediatePropagation()
      restoring = true
      browser.history.go(originalIndex - index)
    }
  }
  browser.addEventListener('popstate', onPopState, true)
  return () => browser.removeEventListener('popstate', onPopState, true)
}
