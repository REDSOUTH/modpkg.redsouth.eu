import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutGroup, AnimatePresence, motion } from "framer-motion";
import Header from "./header";
import Footer from "./footer";
import { PackProvider } from "@/context/pack-context";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common/app-error-boundary";

export default function RootLayout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <PackProvider>
      <div className="flex flex-col bg-background text-foreground font-['Poppins'] min-h-[100dvh] transition-colors duration-200">
        <LayoutGroup id="header-logo">
          <Header />
        </LayoutGroup>
        <main className="flex-1 flex flex-col relative">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>

          <AnimatePresence>
            {isHome && (
              <LayoutGroup id="header-logo">
                <motion.div
                  key="home-logo-overlay"
                  className="pointer-events-none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "calc(100vh - 65px)",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px 0",
                  }}
                  exit={{ opacity: 0, transition: { duration: 0, delay: 0.7 } }}
                >
                  <motion.img
                    layoutId="logo"
                    src="/banner.svg"
                    alt="MODPKG Banner Logo"
                    draggable="false"
                    className="select-none h-[150px] max-[1139px]:h-[100px]"
                    style={{ marginBottom: 44 }}
                    transition={{ type: "spring", stiffness: 180, damping: 26 }}
                  />
                  <div style={{ width: 1140, height: 500, flexShrink: 0 }} />
                </motion.div>
              </LayoutGroup>
            )}
          </AnimatePresence>
        </main>
        <Footer />
        <Toaster />
      </div>
    </PackProvider>
  );
}
