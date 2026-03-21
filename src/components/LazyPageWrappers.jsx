import React from 'react';

const LazyAdminPreMadeCourses = React.lazy(() => import('../pages/AdminPreMadeCourses'));
const LazyDocumentViewer = React.lazy(() => import('../pages/DocumentViewer'));

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