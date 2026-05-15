'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  addToast: (opts: { type: ToastType; message: string }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {}, addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => {
      const next = [...prev, { id, type, message }];
      return next.length > 5 ? next.slice(-5) : next;
    });

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToastObj = useCallback((opts: { type: ToastType; message: string }) => {
    addToast(opts.type, opts.message);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, addToast: addToastObj }}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.type}`}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="toast-message">{t.message}</span>
              <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
