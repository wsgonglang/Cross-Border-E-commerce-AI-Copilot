import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export function ForbiddenPage() {
  const navigate = useNavigate()

  return (
    <Result
      status="403"
      title="没有访问权限"
      subTitle="当前账号角色无法访问该页面。服务端也会拒绝对应接口请求。"
      extra={
        <Button
          type="primary"
          onClick={() => {
            void navigate('/')
          }}
        >
          返回工作台
        </Button>
      }
    />
  )
}
