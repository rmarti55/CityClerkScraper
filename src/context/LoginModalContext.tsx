"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { LoginModal } from "@/components/LoginModal";

type LoginModalContextValue = {
  openLoginModal: () => void;
  closeLoginModal: () => void;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext);
  if (!ctx) {
    throw new Error("useLoginModal must be used within LoginModalProvider");
  }
  return ctx;
}

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openLoginModal = useCallback(() => setIsOpen(true), []);
  const closeLoginModal = useCallback(() => setIsOpen(false), []);

  return (
    <LoginModalContext.Provider value={{ openLoginModal, closeLoginModal }}>
      {children}
      <LoginModal isOpen={isOpen} onClose={closeLoginModal} />
    </LoginModalContext.Provider>
  );
}
