import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ProductWizardPage } from './pages/ProductWizardPage';
import { EmissionFlowPreviewPage } from './pages/EmissionFlowPreviewPage';
import { EmissionLauncherPage } from './pages/EmissionLauncherPage';
import { EmissionLivePage } from './pages/EmissionLivePage';
import { LoginPage } from './pages/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { AuthGate } from './components/AuthGate';
import { routerBase } from './lib/app-base';
import './index.css';

// Este proyecto NO es una PWA. Si el navegador tiene un service worker
// registrado por otra app en el mismo puerto (p. ej. el módulo OCR), ese SW
// intercepta y sirve contenido cacheado viejo. Lo desregistramos y limpiamos
// cachés para garantizar que siempre se sirva la versión actual.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

const SPLASH_KEY = 'ipb:splash-seen';

/** Resuelto una vez al cargar el bundle — evita basename vacío en navegación interna. */
const ROUTER_BASENAME = (() => {
  const base = routerBase();
  return base === '/' ? undefined : base;
})();

function Root() {
  const [showSplash, setShowSplash] = useState(
    () => sessionStorage.getItem(SPLASH_KEY) !== '1',
  );

  function finishSplash() {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setShowSplash(false);
  }

  const basename = ROUTER_BASENAME;

  return (
    <>
      {showSplash && <SplashScreen onFinish={finishSplash} />}
      <BrowserRouter basename={basename}>
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
