"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "@/lib/next-navigation";
import { ArrowLeft, Home } from "lucide-react";
import { useCatalog } from "@/hooks/use-catalog";
import type { Product } from "@/lib/types";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { BottomNav } from "@/components/shop/bottom-nav";
import { CookieConsent } from "@/components/shop/cookie-consent";
import { ScrollUi } from "@/components/shop/scroll-ui";
import { RequireAuth } from "@/components/shop/require-auth";
import { SearchDialog } from "@/components/shop/dialogs/search-dialog";
import { QuickViewDialog } from "@/components/shop/dialogs/quick-view-dialog";
import { HomeView } from "@/components/shop/home/home-view";
import { ShopPage } from "@/components/shop/pages/shop-page";
import { CartPage } from "@/components/shop/pages/cart-page";
import { CategoriesPage } from "@/components/shop/pages/categories-page";
import { PromotionsPage } from "@/components/shop/pages/promotions-page";
import { AboutPage } from "@/components/shop/pages/about-page";
import { ContactPage } from "@/components/shop/pages/contact-page";
import { LoginPage } from "@/components/shop/pages/login-page";
import { AccountPage } from "@/components/shop/pages/account-page";
import { CheckoutPage } from "@/components/shop/pages/checkout-page";
import { AdminPage } from "@/components/shop/pages/admin-page";
import { ProductPage } from "@/components/shop/pages/product-page";
import { WishlistPage } from "@/components/shop/pages/wishlist-page";
import { FaqPage } from "@/components/shop/pages/faq-page";
import { TrackingPage } from "@/components/shop/pages/tracking-page";
import { CgvPage } from "@/components/shop/pages/cgv-page";
import { PrivacyPage } from "@/components/shop/pages/privacy-page";
import { LegalPage } from "@/components/shop/pages/legal-page";
import { trackPageView } from "@/lib/analytics";

const PAGE_TITLES: Record<string, string> = {
  home: "MignonciteShop — Boutique en ligne de produits de qualité",
  shop: "Notre Boutique — MignonciteShop",
  cart: "Votre panier — MignonciteShop",
  categories: "Nos Catégories — MignonciteShop",
  promotions: "Promotions — MignonciteShop",
  about: "À propos — MignonciteShop",
  contact: "Contact — MignonciteShop",
  login: "Connexion — MignonciteShop",
  account: "Mon compte — MignonciteShop",
  checkout: "Commande — MignonciteShop",
  product: "Produit — MignonciteShop",
  wishlist: "Mes favoris — MignonciteShop",
  faq: "FAQ — MignonciteShop",
  tracking: "Suivi de commande — MignonciteShop",
  cgv: "Conditions Générales de Vente — MignonciteShop",
  privacy: "Confidentialité — MignonciteShop",
  legal: "Mentions légales — MignonciteShop",
  admin: "Administration — MignonciteShop",
};

const KNOWN_PAGES = new Set(Object.keys(PAGE_TITLES));

interface NavigateOptions {
  id?: string;
  category?: string;
  q?: string;
}

function NotFoundView({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col items-center text-center">
      <p className="text-7xl md:text-8xl font-bold text-[#C9A961] mb-4">404</p>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
        Page introuvable
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        La page que vous cherchez n&apos;existe pas ou a été déplacée. Utilisez
        le menu ci-dessus pour reprendre votre visite.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => onNavigate("home")}
          className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white px-8 py-3 rounded-full font-semibold transition-colors"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          Retour à l&apos;accueil
        </button>
        <button
          onClick={() => onNavigate("shop")}
          className="inline-flex items-center justify-center gap-2 border border-border px-8 py-3 rounded-full font-semibold hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Retour à la boutique
        </button>
      </div>
    </div>
  );
}

function ShopApp() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawPage = searchParams.get("page") ?? "home";
  const page = KNOWN_PAGES.has(rawPage) ? rawPage : "404";
  const productId = searchParams.get("id");
  const shopCategory = searchParams.get("category") ?? undefined;
  const shopSearch = searchParams.get("q") ?? undefined;

  const { products, categories, loading, error: catalogError } = useCatalog();

  const [searchOpen, setSearchOpen] = useState(false);
  const [cookiesForceOpen, setCookiesForceOpen] = useState(false);
  const [catalogBannerDismissed, setCatalogBannerDismissed] = useState(false);
  const [quickView, setQuickView] = useState<Product | null>(null);

  useEffect(() => {
    document.title = PAGE_TITLES[page] ?? PAGE_TITLES.home;
    trackPageView(page);
  }, [page]);

  const navigate = useCallback(
    (target: string, options?: NavigateOptions) => {
      const params = new URLSearchParams();
      if (target !== "home") params.set("page", target);
      if (options?.id) params.set("id", options.id);
      if (options?.category) params.set("category", options.category);
      if (options?.q) params.set("q", options.q);
      const qs = params.toString();
      setSearchOpen(false);
      router.push(qs ? `/?${qs}` : "/", { scroll: true });
    },
    [router]
  );

  const openProduct = useCallback(
    (p: Product) => {
      setQuickView(null);
      setSearchOpen(false);
      navigate("product", { id: p.id });
    },
    [navigate]
  );

  const handleShopCategory = useCallback(
    (slug: string) => {
      navigate("shop", { category: slug });
    },
    [navigate]
  );

  const headerActive =
    page === "product"
      ? "shop"
      : page === "404" || page === "admin" || page === "checkout"
        ? ""
        : page;

  let content: React.ReactNode;
  switch (page) {
    case "home":
      content = (
        <HomeView
          products={products}
          categories={categories}
          loading={loading}
          onNavigate={navigate}
          onOpenProduct={openProduct}
        />
      );
      break;
    case "shop":
      content = (
        <ShopPage
          key={`shop-${shopCategory ?? "all"}-${shopSearch ?? ""}`}
          products={products}
          categories={categories}
          loading={loading}
          onNavigate={navigate}
          onOpenProduct={openProduct}
          onQuickView={setQuickView}
          initialSearch={shopSearch}
          initialCategory={shopCategory}
        />
      );
      break;
    case "cart":
      content = (
        <RequireAuth label="panier">
          <CartPage onNavigate={navigate} />
        </RequireAuth>
      );
      break;
    case "categories":
      content = (
        <CategoriesPage
          categories={categories}
          products={products}
          loading={loading}
          onNavigate={navigate}
          onShopCategory={handleShopCategory}
        />
      );
      break;
    case "promotions":
      content = (
        <PromotionsPage
          products={products}
          loading={loading}
          onNavigate={navigate}
          onQuickView={setQuickView}
          onOpenProduct={openProduct}
        />
      );
      break;
    case "about":
      content = <AboutPage />;
      break;
    case "contact":
      content = <ContactPage />;
      break;
    case "login":
      content = <LoginPage onNavigate={navigate} />;
      break;
    case "account":
      content = <AccountPage onNavigate={navigate} />;
      break;
    case "checkout":
      content = <CheckoutPage onNavigate={navigate} />;
      break;
    case "product":
      content = (
        <ProductPage
          productId={productId}
          products={products}
          loading={loading}
          onNavigate={navigate}
          onQuickView={setQuickView}
          onOpenProduct={openProduct}
        />
      );
      break;
    case "wishlist":
      content = (
        <RequireAuth label="liste de favoris">
          <WishlistPage
            products={products}
            loading={loading}
            onNavigate={navigate}
            onOpenProduct={openProduct}
            onQuickView={setQuickView}
          />
        </RequireAuth>
      );
      break;
    case "faq":
      content = <FaqPage onNavigate={navigate} />;
      break;
    case "tracking":
      content = <TrackingPage onNavigate={navigate} />;
      break;
    case "cgv":
      content = <CgvPage />;
      break;
    case "privacy":
      content = <PrivacyPage />;
      break;
    case "legal":
      content = <LegalPage />;
      break;
    case "admin":
      content = <AdminPage onNavigate={navigate} />;
      break;
    default:
      content = <NotFoundView onNavigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:bg-[#C9A961] focus:text-white focus:px-4 focus:py-2 focus:rounded-full focus:font-semibold"
      >
        Aller au contenu principal
      </a>
      <Header
        active={headerActive}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
      />
      {/* Header compact mobile (56px) / desktop (80px) — pt aligné */}
      <main id="contenu" className="pt-14 sm:pt-20 flex-1 flex flex-col">
        {/* Erreur de chargement du catalogue (Firestore indisponible…) —
            bannière globale explicite au lieu d'un silence trompeur. */}
        {catalogError && !catalogBannerDismissed && (
          <div
            role="alert"
            className="mx-4 mt-4 mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start justify-between gap-3"
          >
            <span className="min-w-0">{catalogError}</span>
            <button
              type="button"
              onClick={() => setCatalogBannerDismissed(true)}
              aria-label="Masquer le message d'erreur"
              className="shrink-0 font-semibold hover:opacity-70"
            >
              ×
            </button>
          </div>
        )}
        {content}
      </main>
      {/* Le padding-bottom du footer laisse la place à la bottom nav mobile
          sans jamais masquer le contenu (barre noire prolongée sous la nav). */}
      <div className="pb-16 lg:pb-0">
        <Footer
          onNavigate={navigate}
          onOpenCookies={() => setCookiesForceOpen(true)}
        />
      </div>
      <BottomNav
        active={headerActive}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
      />
      <ScrollUi />
      <SearchDialog
        products={products}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onOpenProduct={openProduct}
        onNavigateShopWithSearch={(q) => navigate("shop", { q })}
      />
      <QuickViewDialog
        product={quickView}
        open={quickView !== null}
        onOpenChange={(open) => {
          if (!open) setQuickView(null);
        }}
        onOpenProduct={openProduct}
      />
      <CookieConsent
        forceOpen={cookiesForceOpen}
        onForceClose={() => setCookiesForceOpen(false)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShopApp />
    </Suspense>
  );
}
