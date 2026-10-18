import { create } from "zustand";
import { persist } from "zustand/middleware";
export interface CartItem {
  variantId: string;
  name: string;
  variant: string;
  slug: string;
  price: number;
  quantity: number;
  image: string | null;
  type: string;
  demo: number;
}
interface CartState {
  items: CartItem[];
  open: boolean;
  notice: string;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (id: string, q: number) => void;
  remove: (id: string) => void;
  setOpen: (open: boolean) => void;
}
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      notice: "",
      add: (item, quantity = 1) =>
        set((state) => {
          const old = state.items.find((i) => i.variantId === item.variantId);
          return {
            items: old
              ? state.items.map((i) =>
                  i.variantId === item.variantId
                    ? { ...item, quantity: Math.min(20, i.quantity + quantity) }
                    : i,
                )
              : [
                  ...state.items,
                  { ...item, quantity: Math.min(20, Math.max(1, quantity)) },
                ],
            notice: `${item.name} added to your bag`,
            open: true,
          };
        }),
      setQuantity: (id, q) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.variantId === id
              ? {
                  ...i,
                  quantity: Math.max(1, Math.min(20, Math.trunc(q) || 1)),
                }
              : i,
          ),
        })),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.variantId !== id) })),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "gfp-bag-v1",
      merge: (persisted, current) => {
        const saved = persisted as { items?: CartItem[] } | undefined;
        return {
          ...current,
          items: Array.isArray(saved?.items)
            ? saved.items.filter((item) => !item.demo)
            : [],
        };
      },
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        // Persist the cleaned bag too, so old demo entries cannot return later.
        if (state) useCart.setState({ items: state.items });
      },
      skipHydration: true,
    },
  ),
);
