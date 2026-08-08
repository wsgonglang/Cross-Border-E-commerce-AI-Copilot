import type { OrderViewColumn } from '@cross-border/shared'
import { Alert, Spin, message } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'
import { OrderBulkBar } from './components/order-bulk-bar'
import { OrderBulkResultModal } from './components/order-bulk-result-modal'
import { OrderDetailDrawer } from './components/order-detail-drawer'
import { OrderFilterCard } from './components/order-filter-card'
import { OrderTable } from './components/order-table'
import { OrderViewBar } from './components/order-view-bar'
import { SaveOrderViewModal } from './components/save-order-view-modal'
import { useOrderBulkActions } from './hooks/use-order-bulk-actions'
import { useOrderDetail } from './hooks/use-order-detail'
import { useOrderList } from './hooks/use-order-list'
import {
  useOrderSavedViews,
  type OrderViewSnapshot,
} from './hooks/use-order-saved-views'
import {
  defaultColumns,
  readOrderStatuses,
  type OrderRole,
} from './order.constants'

import './components/styles.css'
import './styles.css'

export function OrdersPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const role: OrderRole = user?.roles.includes('admin')
    ? 'admin'
    : user?.roles.includes('operator')
      ? 'operator'
      : 'viewer'
  const { merchantId, storeId, stores, currentStore, setStoreId } =
    useBusinessContext()
  const [externalError, setExternalError] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] =
    useState<OrderViewColumn[]>(defaultColumns)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [viewDefault, setViewDefault] = useState(false)

  const savedViews = useOrderSavedViews({
    token,
    merchantId,
    onError: setExternalError,
  })
  const { setActiveViewId } = savedViews
  const markViewDirty = useCallback(
    () => setActiveViewId(undefined),
    [setActiveViewId],
  )
  const orderList = useOrderList({
    token,
    merchantId,
    storeId: storeId || undefined,
    initialFilters: {
      keyword: searchParams.get('keyword') ?? undefined,
      statuses: readOrderStatuses(searchParams.get('statuses')),
    },
    onCriteriaChange: markViewDirty,
  })
  const orderDetail = useOrderDetail({
    token,
    merchantId,
    storeId: storeId || undefined,
    initialOrderId: searchParams.get('orderId'),
    onError: setExternalError,
    onUpdated: orderList.loadOrders,
  })
  const bulkActions = useOrderBulkActions({
    token,
    merchantId,
    onError: setExternalError,
    onUpdated: orderList.loadOrders,
  })

  const currentSnapshot = (): OrderViewSnapshot => ({
    ...orderList.filters,
    storeId: storeId || undefined,
    sortBy: orderList.sortBy,
    sortOrder: orderList.sortOrder,
    columns: visibleColumns,
  })

  const applyView = (viewId?: string) => {
    const view = savedViews.views.find((item) => item.id === viewId)
    savedViews.setActiveViewId(viewId)
    if (!view) return
    orderList.setFilters(view.filters)
    orderList.setKeywordDraft(view.filters.keyword ?? '')
    orderList.setSortBy(view.sortBy)
    orderList.setSortOrder(view.sortOrder)
    setVisibleColumns(view.columns)
    if (
      view.filters.storeId &&
      stores.some((store) => store.id === view.filters.storeId)
    ) {
      setStoreId(view.filters.storeId)
    }
    orderList.setPage(1)
  }

  const saveView = async () => {
    const saved = await savedViews.createView(
      viewName,
      viewDefault,
      currentSnapshot(),
    )
    if (!saved) return
    setSaveOpen(false)
    setViewName('')
    setViewDefault(false)
    message.success(t('orders.viewSaved'))
  }

  const overwriteView = async () => {
    if (await savedViews.overwriteView(currentSnapshot())) {
      message.success(t('orders.viewUpdated'))
    }
  }

  const removeView = async () => {
    if (await savedViews.removeView()) {
      message.success(t('orders.viewDeleted'))
    }
  }

  const error = externalError ?? orderList.error

  if (!token) {
    return (
      <main className="workspace-page">
        <Spin />
      </main>
    )
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Order operations</span>
          <h1>{t('orders.title')}</h1>
          <p>
            {currentStore
              ? t('orders.storeDescription', { store: currentStore.name })
              : t('orders.description')}
          </p>
        </div>
      </header>

      {error ? (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => {
            setExternalError(null)
            orderList.setError(null)
          }}
          className="order-error-alert"
        />
      ) : null}

      <OrderViewBar
        views={savedViews.views}
        activeViewId={savedViews.activeViewId}
        visibleColumns={visibleColumns}
        onApply={applyView}
        onOpenSave={() => setSaveOpen(true)}
        onOverwrite={() => void overwriteView()}
        onRemove={() => void removeView()}
        onColumnsChange={(columns) => {
          setVisibleColumns(columns)
          markViewDirty()
        }}
      />

      <OrderFilterCard
        filters={orderList.filters}
        keywordDraft={orderList.keywordDraft}
        onKeywordDraftChange={orderList.setKeywordDraft}
        onPatch={orderList.patchFilters}
        onReset={orderList.resetCriteria}
      />

      {role !== 'viewer' ? (
        <OrderBulkBar
          role={role}
          action={bulkActions.action}
          selectedCount={bulkActions.selectedIds.length}
          running={bulkActions.running}
          onActionChange={bulkActions.setAction}
          onRun={() => void bulkActions.run()}
        />
      ) : null}

      <OrderTable
        data={orderList.data}
        loading={orderList.loading}
        page={orderList.page}
        pageSize={orderList.pageSize}
        role={role}
        visibleColumns={visibleColumns}
        selectedIds={bulkActions.selectedIds}
        onSelectedIdsChange={bulkActions.setSelectedIds}
        onChange={orderList.handleTableChange}
        onOpenDetail={orderDetail.open}
        onStatusChange={(orderId, status) =>
          void orderDetail.updateStatus(orderId, status)
        }
      />

      <OrderDetailDrawer
        open={orderDetail.orderId !== null}
        loading={orderDetail.loading}
        data={orderDetail.data}
        token={token}
        merchantId={merchantId}
        role={role}
        onClose={orderDetail.close}
      />

      <SaveOrderViewModal
        open={saveOpen}
        name={viewName}
        isDefault={viewDefault}
        onNameChange={setViewName}
        onDefaultChange={setViewDefault}
        onCancel={() => setSaveOpen(false)}
        onSave={() => void saveView()}
      />

      <OrderBulkResultModal
        result={bulkActions.result}
        onClose={() => bulkActions.setResult(null)}
      />
    </main>
  )
}
