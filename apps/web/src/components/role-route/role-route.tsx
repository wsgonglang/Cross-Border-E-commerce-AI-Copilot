import type { RoleCode } from '@cross-border/shared'
import { Navigate, Outlet } from 'react-router-dom'

import { useAppSelector } from '../../store/hooks'

interface RoleRouteProps {
  allow: RoleCode[]
}

export function RoleRoute({ allow }: RoleRouteProps) {
  const user = useAppSelector((state) => state.auth.user)
  const allowed = allow.some((role) => user?.roles.includes(role))

  return allowed ? <Outlet /> : <Navigate to="/403" replace />
}
