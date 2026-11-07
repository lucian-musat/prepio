'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Alert } from 'react-bootstrap';

type Notify = (message: string) => void;

const NoticeContext = createContext<Notify>(() => {});

/** Lets dialogs (which close on success) report success on the student page: a dismissible alert above the content. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <NoticeContext.Provider value={setMessage}>
      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)} role="status">{message}</Alert>
      )}
      {children}
    </NoticeContext.Provider>
  );
}

export const useNotify = () => useContext(NoticeContext);
