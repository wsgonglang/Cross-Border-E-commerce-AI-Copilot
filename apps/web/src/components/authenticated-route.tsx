import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAppSelector } from '../store/hooks'

export function AuthenticatedRoute() {
  const status = useAppSelector((state) => state.auth.status)
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
