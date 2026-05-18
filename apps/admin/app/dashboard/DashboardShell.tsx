'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { CompletionCelebration } from '@/components/onboarding/CompletionCelebration';

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
        <OnboardingProvider>
          <div className={`admin-shell ${collapsed ? 'collapsed' : ''}`}>
            {children}
          </div>
          <WelcomeModal />
          <OnboardingTour />
          <CompletionCelebration />
        </OnboardingProvider>
      </ToastProvider>
    </SidebarContext.Provider>
  );
}
