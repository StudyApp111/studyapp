import React from 'react';
import { lazyWithReload } from '@/lib/lazyWithReload';

// lazyWithReload: if a dynamic import fails because the browser is holding a
// stale bundle after a redeploy (old chunk hashes now 404), it triggers ONE
// guarded full-page reload to fetch the fresh index.html — instead of crashing
// into the error boundary. See src/lib/lazyWithReload.js.
const LazyAdminPreMadeCourses = lazyWithReload(() => import('../pages/AdminPreMadeCourses'), 'AdminPreMadeCourses');
const LazyDocumentViewer = lazyWithReload(() => import('../pages/DocumentViewer'), 'DocumentViewer');

const LazyFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
  </div>
);

export const AdminPreMadeCourses = (props) => (
  <React.Suspense fallback={<LazyFallback />}>
    <LazyAdminPreMadeCourses {...props} />
  </React.Suspense>
);

export const DocumentViewer = (props) => (
  <React.Suspense fallback={<LazyFallback />}>
    <LazyDocumentViewer {...props} />
  </React.Suspense>
);