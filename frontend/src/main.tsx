import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ProductWizardPage } from './pages/ProductWizardPage';
import { EmissionFlowPreviewPage } from './pages/EmissionFlowPreviewPage';
import { SplashScreen } from './components/SplashScreen';
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products/new" element={<ProductWizardPage />} />
          <Route path="/products/:id/preview" element={<EmissionFlowPreviewPage />} />
          <Route path="/products/:id" element={<ProductWizardPage />} />
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
