import { lazy, Suspense, useEffect } from "react";
import Lenis from "@studio-freight/lenis";
import { Navigate, Route, Routes } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import BrandLoader from "./components/BrandLoader";

// Chargement différé : chaque page (et Three.js) n'est téléchargée que si nécessaire.
const Landin = lazy(() => import("./pages/Landin"));
const Ecommerce = lazy(() => import("./pages/Ecommerce"));
const Customizer = lazy(() => import("./pages/Customizer"));
const Archive = lazy(() => import("./pages/Archive"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Designers = lazy(() => import("./pages/Designers"));
const Chat = lazy(() => import("./pages/Chat"));
const Messages = lazy(() => import("./pages/Messages"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const RoleSelection = lazy(() => import("./pages/RoleSelection"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const DesignerDashboard = lazy(() => import("./pages/DesignerDashboard"));
const Auth = lazy(() => import("./pages/Auth"));



function App() {
  useEffect(() => {
    // Défilement fluide, sauf si l'utilisateur préfère réduire les animations.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    let frame;
    function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthProvider>
      <CartProvider>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<BrandLoader />}>
          <Routes>
            <Route path="/" element={<Landin />} />
            <Route
              path="/customizer"
              element={<RequireAuth role="designer"><Customizer /></RequireAuth>}
            />
            <Route
              path="/customizer/:id"
              element={<RequireAuth role="designer"><Customizer /></RequireAuth>}
            />
            <Route path="/ecommerce" element={<Ecommerce />} />
            <Route path="/ecommerce/:id" element={<ProductDetail />} />
            <Route
              path="/archive"
              element={<RequireAuth role="designer"><Archive /></RequireAuth>}
            />
            <Route
              path="/checkout"
              element={<RequireAuth><Checkout /></RequireAuth>}
            />
            <Route path="/checkout/success" element={<RequireAuth><CheckoutReturn outcome="success" /></RequireAuth>} />
            <Route path="/checkout/cancel" element={<RequireAuth><CheckoutReturn outcome="cancel" /></RequireAuth>} />
            <Route path="/designers" element={<Designers />} />
            <Route path="/chat/:designerId" element={<RequireAuth><Chat /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/messages/:conversationId" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/client" element={<RoleSelection />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard/client"
              element={<RequireAuth role="client"><ClientDashboard /></RequireAuth>}
            />
            <Route
              path="/dashboard/designer"
              element={<RequireAuth role="designer"><DesignerDashboard /></RequireAuth>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
      </CartProvider>
    </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
