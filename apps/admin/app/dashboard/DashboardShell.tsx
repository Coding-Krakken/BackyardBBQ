'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';

interface SidebarContextValue {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  mobileOpen: false,
  setMobileOpen: () => {},
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, collapsed, setCollapsed }}>
      <ToastProvider>
        <div className={`admin-shell ${collapsed ? 'collapsed' : ''}`}>
          {children}
        </div>
      </ToastProvider>
    </SidebarContext.Provider>
  );
}
