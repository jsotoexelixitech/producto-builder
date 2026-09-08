import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ProductWizardPage } from './pages/ProductWizardPage';
import { EmissionFlowPreviewPage } from './pages/EmissionFlowPreviewPage';
import { EmissionLauncherPage } from './pages/EmissionLauncherPage';
import { EmissionLivePage } from './pages/EmissionLivePage';
import { LoginPage } from './pages/LoginPage';
import { Sis2000CatalogPage } from './pages/Sis2000CatalogPage';
import { Sis2000ProductPage } from './pages/Sis2000ProductPage';
import { SplashScreen } from './components/SplashScreen';
import { AuthGate } from './components/AuthGate';
import { ensureTrailingSlashOnRoot, routerBase } from './lib/app-base';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

ensureTrailingSlashOnRoot();

const SPLASH_KEY = 'ipb:splash-seen';

const ROUTER_BASENAME = (() => {
  const base = routerBase();
  return base === '/' ? undefined : base;
})();

function TrailingSlashOnRoot() {
  const location = useLocation();
  useEffect(() => {
    ensureTrailingSlashOnRoot();
  }, [location.pathname, location.search, location.hash]);
  return null;
}

function Root() {
  const [showSplash, setShowSplash] = useState(
    () => sessionStorage.getItem(SPLASH_KEY) !== '1',
  );

  function finishSplash() {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
  }

  return (
    <>
      {showSplash && <SplashScreen onFinish={finishSplash} />}
      <BrowserRouter basename={ROUTER_BASENAME}>
        <TrailingSlashOnRoot />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <AuthGate>
                <DashboardPage />
              </AuthGate>
            }
          />
          <Route
            path="/products/new"
            element={
              <AuthGate>
                <ProductWizardPage />
              </AuthGate>
            }
          />
          <Route
            path="/emitir"
            element={
              <AuthGate>
                <EmissionLauncherPage />
              </AuthGate>
            }
          />
          <Route
            path="/emitir/:productId"
            element={
              <AuthGate>
                <EmissionLivePage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000"
            element={
              <AuthGate>
                <Sis2000CatalogPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/new"
            element={
              <AuthGate>
                <Sis2000ProductPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/:cproducto"
            element={
              <AuthGate>
                <Sis2000ProductPage />
              </AuthGate>
            }
          />
          <Route
            path="/products/:id/preview"
            element={
              <AuthGate>
                <EmissionFlowPreviewPage />
              </AuthGate>
            }
          />
          <Route
            path="/products/:id"
            element={
              <AuthGate>
                <ProductWizardPage />
              </AuthGate>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
