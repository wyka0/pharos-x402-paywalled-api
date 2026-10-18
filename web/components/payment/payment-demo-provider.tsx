"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PaidRoutePath, PaymentProof } from "@/lib/types";
import { PaymentDemoDialog } from "./payment-demo-dialog";

interface PaymentDemoContextValue {
  openDemo: (route?: PaidRoutePath) => void;
  proof: PaymentProof | null;
  clearProof: () => void;
}

const PaymentDemoContext = createContext<PaymentDemoContextValue | null>(null);

export function PaymentDemoProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<PaidRoutePath>("/data");
  const [proof, setProof] = useState<PaymentProof | null>(null);

  const openDemo = useCallback((nextRoute?: PaidRoutePath) => {
    if (nextRoute) setRoute(nextRoute);
    setOpen(true);
  }, []);

  const clearProof = useCallback(() => setProof(null), []);

  const value = useMemo(
    () => ({ openDemo, proof, clearProof }),
    [openDemo, proof, clearProof],
  );

  return (
    <PaymentDemoContext.Provider value={value}>
      {children}
      <PaymentDemoDialog
        open={open}
        onOpenChange={setOpen}
        route={route}
        onRouteChange={setRoute}
        onSettled={setProof}
      />
    </PaymentDemoContext.Provider>
  );
}

export function usePaymentDemo(): PaymentDemoContextValue {
  const context = useContext(PaymentDemoContext);
  if (!context) {
    throw new Error("usePaymentDemo must be used inside PaymentDemoProvider");
  }
  return context;
}
