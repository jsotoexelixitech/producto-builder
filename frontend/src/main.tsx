import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { AuthGate } from './components/AuthGate';
import { AyudasProvider } from './components/ayudas/AyudasProvider';
import { CargandoModerna } from './components/ayudas/CargandoModerna';
import { ensureTrailingSlashOnRoot, routerBase } from './lib/app-base';
import './index.css';

// Cada pantalla es un paquete aparte: el principal solo trae lo común (login, router, sesión).
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductWizardPage = lazy(() => import('./pages/ProductWizardPage').then((m) => ({ default: m.ProductWizardPage })));
const EmissionFlowPreviewPage = lazy(() => import('./pages/EmissionFlowPreviewPage').then((m) => ({ default: m.EmissionFlowPreviewPage })));
const EmissionLauncherPage = lazy(() => import('./pages/EmissionLauncherPage').then((m) => ({ default: m.EmissionLauncherPage })));
const EmissionLivePage = lazy(() => import('./pages/EmissionLivePage').then((m) => ({ default: m.EmissionLivePage })));
const Sis2000CatalogPage = lazy(() => import('./pages/Sis2000CatalogPage').then((m) => ({ default: m.Sis2000CatalogPage })));
const Sis2000ProductPage = lazy(() => import('./pages/Sis2000ProductPage').then((m) => ({ default: m.Sis2000ProductPage })));
const Sis2000RamoCoveragesPage = lazy(() => import('./pages/Sis2000RamoCoveragesPage').then((m) => ({ default: m.Sis2000RamoCoveragesPage })));
const Sis2000TarifasPage = lazy(() => import('./pages/Sis2000TarifasPage').then((m) => ({ default: m.Sis2000TarifasPage })));
const Sis2000MasterPlansPage = lazy(() => import('./pages/Sis2000MasterPlansPage').then((m) => ({ default: m.Sis2000MasterPlansPage })));
const Sis2000PlanFormPage = lazy(() => import('./pages/Sis2000PlanFormPage').then((m) => ({ default: m.Sis2000PlanFormPage })));
const Sis2000CoberturaFormPage = lazy(() => import('./pages/Sis2000CoberturaFormPage').then((m) => ({ default: m.Sis2000CoberturaFormPage })));
const Sis2000TarifaFormPage = lazy(() => import('./pages/Sis2000TarifaFormPage').then((m) => ({ default: m.Sis2000TarifaFormPage })));
const Sis2000TarifaDetallePage = lazy(() => import('./pages/Sis2000TarifaDetallePage').then((m) => ({ default: m.Sis2000TarifaDetallePage })));
const Sis2000TarifaDetalleFormPage = lazy(() => import('./pages/Sis2000TarifaDetalleFormPage').then((m) => ({ default: m.Sis2000TarifaDetalleFormPage })));
const Sis2000ComboPage = lazy(() => import('./pages/Sis2000ComboPage').then((m) => ({ default: m.Sis2000ComboPage })));
const Sis2000PlanEditarPage = lazy(() => import('./pages/Sis2000ComboPage').then((m) => ({ default: m.Sis2000PlanEditarPage })));
const Sis2000PlanFichaPage = lazy(() => import('./pages/Sis2000PlanFichaPage').then((m) => ({ default: m.Sis2000PlanFichaPage })));
const Sis2000RamosPage = lazy(() => import('./pages/Sis2000RamosPage').then((m) => ({ default: m.Sis2000RamosPage })));

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

/** Mientras se baja el código de la pantalla (cada una es un paquete aparte). */
function CargandoPantalla() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <CargandoModerna
        texto="Cargando la pantalla…"
        clasica={<p className="text-sm text-muted-foreground">Cargando…</p>}
      />
    </div>
  );
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
      <RouterProvider router={router} />
    </>
  );
}

/** Todas las rutas de la app (dentro del router de datos, necesario para useBlocker). */
function AppRoutes() {
  return (
    <>
      <TrailingSlashOnRoot />
      <Suspense fallback={<CargandoPantalla />}>
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
            path="/sis2000/ramos"
            element={
              <AuthGate>
                <Sis2000RamosPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/plans/new"
            element={
              <AuthGate>
                <Sis2000PlanFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/plans/:id/edit"
            element={
              <AuthGate>
                <Sis2000PlanEditarPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/plans/:id/configurar"
            element={
              <AuthGate>
                <Sis2000PlanFichaPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/plans/:id/json"
            element={
              <AuthGate>
                <Sis2000PlanFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/plans"
            element={
              <AuthGate>
                <Sis2000MasterPlansPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/new"
            element={
              <AuthGate>
                <Sis2000CoberturaFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/:ccobertura/edit"
            element={
              <AuthGate>
                <Sis2000CoberturaFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/:ccobertura/tarifas/new"
            element={
              <AuthGate>
                <Sis2000TarifaFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/:ccobertura/tarifas/:ctarifa/edit"
            element={
              <AuthGate>
                <Sis2000TarifaFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/:ccobertura/tarifas/:ctarifa/detalles/new"
            element={
              <AuthGate>
                <Sis2000TarifaDetalleFormPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/:ccobertura/tarifas/:ctarifa/detalles"
            element={
              <AuthGate>
                <Sis2000TarifaDetallePage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas/:ccobertura/tarifas"
            element={
              <AuthGate>
                <Sis2000TarifasPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/ramo/:cramo/coberturas"
            element={
              <AuthGate>
                <Sis2000RamoCoveragesPage />
              </AuthGate>
            }
          />
          <Route
            path="/sis2000/combos"
            element={
              <AuthGate>
                <Sis2000ComboPage />
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
      </Suspense>
    </>
  );
}

// Router de datos (en vez de BrowserRouter): hace falta para avisar al salir con cambios sin guardar.
const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }], { basename: ROUTER_BASENAME });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AyudasProvider>
      <Root />
    </AyudasProvider>
  </StrictMode>,
);
