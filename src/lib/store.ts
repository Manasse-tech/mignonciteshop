"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface ShopState {
  cart: CartItem[];
  wishlist: string[];
  recentlyViewed: string[];
  promo: string | null;
  compare: string[];
  votedReviews: string[];
  votedQuestions: string[];
  searchHistory: string[];
  stockAlerts: string[];
  shopView: "grid" | "list";

  // Cart
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeFromCart: (productId: string, size?: string | null, color?: string | null) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  // Wishlist
  toggleWishlist: (productId: string) => boolean;

  // Compare
  toggleCompare: (productId: string) => boolean;

  // Views / misc
  setShopView: (view: "grid" | "list") => void;
  addSearchHistory: (query: string) => void;
  addRecentlyViewed: (productId: string) => void;
  setPromo: (code: string | null) => void;
  toggleStockAlert: (productId: string) => boolean;
}

function sameLine(item: CartItem, productId: string, size?: string | null, color?: string | null) {
  return (
    item.productId === productId &&
    (item.size ?? null) === (size ?? null) &&
    (item.color ?? null) === (color ?? null)
  );
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      cart: [],
      wishlist: [],
      recentlyViewed: [],
      promo: null,
      compare: [],
      votedReviews: [],
      votedQuestions: [],
      searchHistory: [],
      stockAlerts: [],
      shopView: "grid",

      addToCart: (item) => {
        const qty = item.quantity ?? 1;
        const cart = [...get().cart];
        const idx = cart.findIndex((c) => sameLine(c, item.productId, item.size, item.color));
        if (idx >= 0) {
          cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + qty };
        } else {
          cart.push({ ...item, quantity: qty });
        }
        set({ cart });
      },

      removeFromCart: (productId, size, color) => {
        set({ cart: get().cart.filter((c) => !sameLine(c, productId, size, color)) });
      },

      updateQuantity: (productId, quantity) => {
        const cart = get()
          .cart.map((c) =>
            c.productId === productId ? { ...c, quantity: Math.max(0, quantity) } : c
          )
          .filter((c) => c.quantity > 0);
        set({ cart });
      },

      clearCart: () => set({ cart: [] }),

      toggleWishlist: (productId) => {
        const wishlist = get().wishlist;
        const has = wishlist.includes(productId);
        set({
          wishlist: has ? wishlist.filter((id) => id !== productId) : [...wishlist, productId],
        });
        return !has;
      },

      toggleCompare: (productId) => {
        const compare = get().compare;
        const has = compare.includes(productId);
        if (!has && compare.length >= 4) return false;
        set({ compare: has ? compare.filter((id) => id !== productId) : [...compare, productId] });
        return !has;
      },

      setShopView: (view) => set({ shopView: view }),

      addSearchHistory: (query) => {
        if (!query.trim()) return;
        const history = [query, ...get().searchHistory.filter((q) => q !== query)].slice(0, 8);
        set({ searchHistory: history });
      },

      addRecentlyViewed: (productId) => {
        const viewed = [productId, ...get().recentlyViewed.filter((id) => id !== productId)].slice(0, 10);
        set({ recentlyViewed: viewed });
      },

      setPromo: (code) => set({ promo: code }),

      toggleStockAlert: (productId) => {
        const alerts = get().stockAlerts;
        const has = alerts.includes(productId);
        set({
          stockAlerts: has
            ? alerts.filter((id) => id !== productId)
            : [...alerts, productId],
        });
        return !has;
      },
    }),
    {
      name: "mignoncite-shop",
      storage: createJSONStorage(() => localStorage),
      version: 0,
    }
  )
);

export const selectCartCount = (state: ShopState) =>
  state.cart.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartTotal = (state: ShopState) =>
  state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
