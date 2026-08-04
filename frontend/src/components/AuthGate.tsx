import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '@/lib/auth';
import { isExelixiCatalogPublicFlow } from '@/lib/exelixi-catalog-flow';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = getAccessToken();

  if (!token && !isExelixiCatalogPublicFlow()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
