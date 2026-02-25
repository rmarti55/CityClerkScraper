"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  ReactNode,
} from "react";

type ToastItem = { id: number; message: string };

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2800;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timeoutRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const showToast = useCallback((message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message }]);

    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      timeoutRefs.current.delete(id);
    }, TOAST_DURATION_MS);
    timeoutRefs.current.set(id, t);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(({ id, message }) => (
          <div
            key={id}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
          >
            {message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
