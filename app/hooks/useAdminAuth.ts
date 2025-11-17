'use client';

import { useEffect, useState } from 'react';

export type AdminTab = 'timeline' | 'dashboard' | 'participants' | 'purchases' | 'secret-santa';

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('timeline');

  // Verificar token salvo do admin ao carregar
  useEffect(() => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken === 'admin-authenticated') {
        setIsAdmin(true);
        setActiveTab('dashboard');
      }
    } catch {
      // Se não conseguir ler o localStorage, apenas ignora
    }
  }, []);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        setIsAdmin(true);
        setShowLogin(false);
        setPassword('');
        setActiveTab('dashboard');
      } else {
        setLoginError('Senha incorreta!');
      }
    } catch (error) {
      setLoginError('Erro ao fazer login');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('adminToken');
    } catch {
      // Se não conseguir limpar, segue mesmo assim
    }
    setIsAdmin(false);
    setActiveTab('timeline');
  };

  return {
    isAdmin,
    showLogin,
    password,
    loginError,
    activeTab,
    setShowLogin,
    setPassword,
    setLoginError,
    setActiveTab,
    handleLogin,
    handleLogout,
  };
}
