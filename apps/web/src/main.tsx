import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
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
          borderRadius: 10,
        },
      }}
    >
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    </ConfigProvider>
  </StrictMode>,
)
