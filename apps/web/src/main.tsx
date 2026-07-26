import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { App } from './App'
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
          borderRadius: 10,
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
