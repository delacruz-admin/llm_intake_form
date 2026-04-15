import { useState, useEffect } from 'react';
import { getToken, handleCallback, requireAuth, getUser, logout } from './auth';
import Navbar from './components/Navbar';
import ChatPanel from './components/ChatPanel';
import PreviewPanel from './components/PreviewPanel';
import Dashboard from './components/Dashboard';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [page, setPage] = useState('intake');
  const [sessionId, setSessionId] = useState('');
  const [fields, setFields] = useState({});
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (window.location.hash.includes('id_token')) {
      handleCallback();
    }

    if (getToken()) {
      setAuthenticated(true);
    } else {
      requireAuth();
    }

    // Simple hash routing
    const path = window.location.pathname;
    if (path === '/dashboard') setPage('dashboard');
  }, []);

  // Sync URL with page state
  function navigate(target) {
    setPage(target);
    window.history.pushState(null, '', target === 'dashboard' ? '/dashboard' : '/');
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-muted font-mono text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  const user = getUser();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar user={user} onLogout={logout} page={page} onNavigate={navigate} />
      {page === 'dashboard' ? (
        <Dashboard onNavigate={navigate} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ChatPanel
            sessionId={sessionId}
            onSessionId={setSessionId}
            messages={messages}
            onMessages={setMessages}
            onFieldsUpdate={(newFields) =>
              setFields((prev) => ({ ...prev, ...newFields }))
            }
          />
          <PreviewPanel fields={fields} sessionId={sessionId} />
        </div>
      )}
    </div>
  );
}
