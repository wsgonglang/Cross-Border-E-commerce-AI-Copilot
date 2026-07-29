import './styles.css'

export function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span>正在加载页面…</span>
    </div>
  )
}
