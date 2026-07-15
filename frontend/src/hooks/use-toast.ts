"use client";

import { useCallback, useRef, useState } from "react";
import type { ToastItem } from "@/lib/types";

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback(
    (title: string, message: string, type: ToastItem["type"] = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      // Auto-dismiss after 3.5s; manual dismiss (removeToast) can beat this.
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
