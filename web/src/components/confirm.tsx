import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Button } from './ui';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const close = (value: boolean) => {
    resolver?.(value);
    setOpts(null);
    setResolver(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          title={opts.title}
          onClose={() => close(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {opts.confirmLabel || 'Confirmar'}
              </Button>
            </>
          }
        >
          <p className="confirm-message">{opts.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
