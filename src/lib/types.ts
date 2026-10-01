export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  order: number;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  details: string;
  price: number;
  oldPrice: number | null;
  image: string;
  gallery: string; // JSON string: string[]
  categoryId: string;
  stock: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  sizes: string; // JSON string: string[]
  colors: string; // JSON string: string[]
  createdAt: string;
  updatedAt: string;
  category: Category;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  quantity: number;
  size: string | null;
  color: string | null;
}

export type PageKey =
  | "home"
  | "shop"
  | "cart"
  | "categories"
  | "promotions"
  | "about"
  | "contact"
  | "login"
  | "account"
  | "checkout"
  | "product"
  | "wishlist"
  | "faq"
  | "tracking"
  | "cgv"
  | "privacy"
  | "legal"
  | "admin"
  | "404";

export const GOLD = "#C9A961";

// ---------------------------------------------------------------------------
// Avis clients
// ---------------------------------------------------------------------------

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Code promo (moteur partagé panier / checkout — voir src/lib/promos.ts)
// ---------------------------------------------------------------------------

export type PromoType = "percent" | "freeship" | "amount";

export interface PromoDefinition {
  code: string;
  label: string;
  type: PromoType;
  value: number;
  minSubtotal: number;
}

// ---------------------------------------------------------------------------
// Tunnel de commande (checkout) — snapshot envoyé au futur POST /api/orders
// ---------------------------------------------------------------------------

export type ShippingMethod = "standard" | "express" | "pickup";

export interface ShippingOption {
  id: ShippingMethod;
  label: string;
  description: string;
  price: number;
  eta: string;
}

export interface CheckoutContact {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface CheckoutAddress {
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface OrderSnapshot {
  reference: string;
  email: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  promoCode: string | null;
  shippingMethod: ShippingMethod;
  address: CheckoutAddress;
  createdAt: string;
  /** Méthode choisie au checkout (card = passerelle démo, mobile_money = règlement externe). */
  paymentMethod?: "card" | "paypal" | "transfer" | "mobile_money";
}
