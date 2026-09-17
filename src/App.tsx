import React, { useState } from 'react';
import { BootSequence } from './components/BootSequence';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [appState, setAppState] = useState<'boot' | 'auth' | 'dashboard'>('boot');

  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--bg-dark)]">
      {appState === 'boot' && <BootSequence onComplete={() => setAppState('auth')} />}
      {appState === 'auth' && <AuthScreen onAuthSuccess={() => setAppState('dashboard')} />}
      {appState === 'dashboard' && <Dashboard />}
    </div>
  );
}
