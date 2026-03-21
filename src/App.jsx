import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { setupIframeMessaging } from './lib/iframe-messaging';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

setupIframeMessaging();

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 60 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -60 }}
    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

const PersistentTab = ({ isActive, children }) => {
  const scrollPosRef = React.useRef(0);

  React.useEffect(() => {
    if (!isActive) {
      scrollPosRef.current = window.scrollY;
    } else {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosRef.current);
      });
    }
  }, [isActive]);

  return (
    <div style={{ display: isActive ? 'block' : 'none', width: '100%' }}>
      <motion.div
        initial={false}
        animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : -20 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  const pathName = location.pathname.replace(/^\//, '');
  let currentPath = pathName === '' ? mainPageKey : pathName;
  
  const mainTabs = ["Home", "LessonHistory", "SmartGrader", "CreateLesson"];
  
  // Handle case-insensitive routing
  const matchedMainTab = mainTabs.find(t => t.toLowerCase() === currentPath.toLowerCase());
  if (matchedMainTab) {
    currentPath = matchedMainTab;
  } else if (Pages) {
    const matchedPage = Object.keys(Pages).find(p => p.toLowerCase() === currentPath.toLowerCase());
    if (matchedPage) {
      currentPath = matchedPage;
    }
  }

  const isMainTab = mainTabs.includes(currentPath);

  // Render the main app
  return (
    <LayoutWrapper currentPageName={currentPath}>
      {mainTabs.map(tab => {
        const PageComponent = Pages[tab];
        if (!PageComponent) return null;
        const isActive = currentPath === tab;
        return (
          <PersistentTab key={tab} isActive={isActive}>
            <PageComponent />
          </PersistentTab>
        );
      })}

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={null} />
          {Object.entries(Pages).map(([path, Page]) => {
            if (mainTabs.includes(path)) return null;
            return <Route key={path} path={`/${path}`} element={<PageTransition><Page /></PageTransition>} />
          })}
          <Route path="*" element={isMainTab ? null : <PageNotFound />} />
        </Routes>
      </AnimatePresence>
    </LayoutWrapper>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App