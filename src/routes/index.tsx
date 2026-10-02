import { createFileRoute } from "@tanstack/react-router";
import ShopPage from "@/components/shop/shop-app";

const TITLE = "MignonciteShop — Boutique en ligne de produits de qualité";
const DESC =
  "MignonciteShop, votre boutique en ligne premium. Découvrez une sélection de produits de qualité, livraison rapide et paiement sécurisé.";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});
