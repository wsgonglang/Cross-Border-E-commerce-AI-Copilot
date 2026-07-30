import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import { ServerStateProvider } from './queries/server-state-provider'
import { store } from './store'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Application root element is missing')
}

createRoot(root).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#0f766e',
          colorInfo: '#0f766e',
          colorLink: '#0f766e',
          colorBgLayout: '#f5f6f8',
          colorBgContainer: '#ffffff',
          colorText: '#1f2937',
          colorTextSecondary: '#667085',
          colorBorder: '#d0d5dd',
          colorBorderSecondary: '#eaecf0',
          borderRadius: 8,
          fontSize: 14,
          controlHeight: 36,
          boxShadowSecondary: '0 12px 32px rgb(16 24 40 / 10%)',
        },
        components: {
          Button: {
            borderRadius: 8,
            primaryShadow: 'none',
            fontWeight: 600,
          },
          Card: {
            borderRadiusLG: 10,
            headerHeight: 48,
            headerFontSize: 15,
            bodyPadding: 20,
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#475467',
            rowHoverBg: '#f9fafb',
            borderColor: '#eaecf0',
            cellPaddingBlock: 12,
            cellPaddingInline: 16,
          },
          Input: {
            activeShadow: '0 0 0 3px rgb(15 118 110 / 10%)',
          },
          Select: {
            activeBorderColor: '#0f766e',
            activeOutlineColor: 'rgb(15 118 110 / 10%)',
          },
        },
      }}
    >
      <Provider store={store}>
        <ServerStateProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ServerStateProvider>
      </Provider>
    </ConfigProvider>
  </StrictMode>,
)
