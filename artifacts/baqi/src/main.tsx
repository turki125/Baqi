import { createRoot } from 'react-dom/client';

import { lazy, Suspense } from 'react';
import TeamPage from './baqi/pages/team';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// QR visitors can open the public team page without loading authentication.
const App = lazy(() => import('./App'));
const isTeamPage = window.location.pathname.replace(/\/$/, '') === `${import.meta.env.BASE_URL.replace(/\/$/, '')}/team`;

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isTeamPage ? <TeamPage /> : <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center">Loading Baqi…</div>}><App /></Suspense>}
  </ErrorBoundary>,
);
