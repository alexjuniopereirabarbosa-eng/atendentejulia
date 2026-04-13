'use client';

import { useState, type ReactNode } from 'react';

function getInitialAuth(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('admin_auth') === 'true';
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(getInitialAuth);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      sessionStorage.setItem('admin_auth', 'true');
      setAuthenticated(true);
    } else {
      setError('Senha incorreta');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#111b21] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-[#202c33] rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#00a884] rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-white text-xl font-semibold">Painel Admin</h1>
            <p className="text-[#8696a0] text-sm mt-1">Julia — Companheira Virtual</p>
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 text-sm px-4 py-2 rounded-lg mb-4 text-center">
              {error}
            </div>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do admin"
            className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#3b4a54] focus:border-[#00a884] outline-none text-sm mb-4 placeholder-[#8696a0]"
            id="admin-password"
            autoFocus
          />

          <button
            type="submit"
            className="w-full bg-[#00a884] hover:bg-[#008069] text-white py-3 rounded-lg transition-colors font-medium"
            id="admin-login"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111b21] text-white">
      {/* Admin Header */}
      <header className="bg-[#202c33] border-b border-[#3b4a54] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#00a884] rounded-full flex items-center justify-center">
            <span className="text-lg">⚙️</span>
          </div>
          <h1 className="text-lg font-semibold">Julia Admin</h1>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem('admin_auth');
            setAuthenticated(false);
          }}
          className="text-[#8696a0] hover:text-white text-sm transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
