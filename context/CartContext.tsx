"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type CartItem = {
  id: string;
  name: string;
  priceLabel: string;
  quantity: number;
  image: string;
};

type CartContextType = {
  items: CartItem[];
  /** False until the post-hydration localStorage restore has run — lets
   * consumers (e.g. checkout's empty-cart redirect) distinguish "not
   * restored yet" from "actually empty". */
  ready: boolean;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "mithai-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  // Always init empty — NEVER read localStorage in the initializer.
  // SSR renders count=0; first client render also sees count=0; only
  // after hydration does the effect below pull saved items. This
  // avoids the "Hydration failed because the server rendered HTML
  // didn't match the client" error caused by count badges appearing
  // on hydration.
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // After mount, load any saved cart from localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot load of persisted state after hydration; safe because server and first client render both see []
          setItems(parsed);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot readiness flag after the restore pass
    setReady(true);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const addItem = (item: Omit<CartItem, "quantity">, qty: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.id === item.id ? { ...p, quantity: p.quantity + qty } : p
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: qty } : p))
    );
  };

  const clear = () => setItems([]);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const value: CartContextType = {
    items,
    ready,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    count,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
