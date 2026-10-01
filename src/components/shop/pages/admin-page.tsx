"use client";

/**
 * Espace administrateur — /?page=admin
 *
 * Accès réservé au rôle "admin" (Firebase Authentication + Firestore
 * users/{uid}.role — vérifié par les Security Rules, pas seulement ici).
 * Onglets : Tableau de bord · Commandes · Produits · Catégories · Avis ·
 * Codes promo · Clients · Messages · E-mails · Rapports · Journal · Paramètres.
 * Toutes les données passent directement par Firebase (UNIQUE backend).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Check,
  CreditCard,
  Download,
  Euro,
  ImageOff,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Package,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Star,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyFirebaseError } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type {
  AdminCategory,
  AdminCustomer,
  AdminOrder,
  AdminPromo,
  AdminReport,
  AdminReview,
  AdminSettings,
  AdminStats,
  AdminContactMessage,
  AdminSubscriber,
  AdminStockAlert,
  AdminEmailLog,
  AdminAuditEntry,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminPageProps {
  onNavigate: (page: string) => void;
}

const REFRESH_ICON = "w-4 h-4";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/* ------------------------------------------------------------------------- */
/* Composants partagés                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Export CSV — généré côté client depuis Firestore (aucun serveur) et
 * téléchargé immédiatement.
 */
function CsvExportButton({
  type,
  label,
  ariaLabel,
}: {
  type: "orders" | "products" | "customers";
  label: string;
  ariaLabel: string;
}) {
  const [exporting, setExporting] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full gap-2 h-10"
      disabled={exporting}
      aria-label={ariaLabel}
      onClick={async () => {
        if (exporting) return;
        setExporting(true);
        try {
          await api.admin.exportCsv(type);
          toast.success("Export CSV téléchargé.");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Export impossible."
          );
        } finally {
          setExporting(false);
        }
      }}
    >
      {exporting ? (
        <Loader2 className={REFRESH_ICON + " animate-spin"} aria-hidden="true" />
      ) : (
        <Download className={REFRESH_ICON} aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}

/**
 * Champ image — saisie d'URL PUBLIQUE (Firebase Storage supprimé, plan Spark) :
 * renseigner l'URL, prévisualiser, modifier, supprimer. L'URL est stockée
 * dans Firestore (products.image / categories.image) et accessible à tous.
 * Aucun fichier n'est stocké côté navigateur (les visiteurs verraient l'image
 * uniquement sur l'appareil de l'admin).
 */
function ImageUrlField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  placeholder?: string;
}) {
  const inputId = useMemo(
    () => `img-url-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const [previewError, setPreviewError] = useState(false);
  const url = value.trim();

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        value={value}
        onChange={(e) => {
          setPreviewError(false);
          onChange(e.target.value);
        }}
        placeholder={placeholder ?? "https://…"}
        className="h-10 rounded-xl"
        inputMode="url"
      />
      {url ? (
        <div className="flex items-center gap-3">
          {/* Prévisualisation de l'URL publique saisie. */}
          {previewError ? (
            <div className="h-20 w-20 rounded-xl border border-destructive/40 bg-destructive/5 flex items-center justify-center shrink-0">
              <ImageOff
                className="w-6 h-6 text-destructive/60"
                aria-hidden="true"
              />
            </div>
          ) : (
            <img
              src={url}
              alt="Aperçu de l'image"
              className="h-20 w-20 rounded-xl object-cover border border-border/60"
              loading="lazy"
              onError={() => setPreviewError(true)}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-destructive hover:text-destructive gap-1.5 shrink-0"
            onClick={() => {
              setPreviewError(false);
              onChange("");
              toast.success("Image retirée du produit.");
            }}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Supprimer l&apos;image
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Collez une URL d&apos;image publique (ex : https://exemple.com/photo.jpg).
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Garde d'accès                                                             */
/* ------------------------------------------------------------------------- */

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { user, ready, hydrate } = useAuthStore();

  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
        Vérification de la session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 px-4">
        <div className="w-full max-w-md bg-card rounded-2xl border p-8 text-center">
          <div className="rounded-full bg-[#C9A961]/10 p-4 w-fit mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#C9A961]" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Espace administrateur
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Cette zone est réservée à l&apos;équipe de la boutique.
            Connectez-vous avec un compte administrateur pour continuer.
          </p>
          <Button
            onClick={() => onNavigate("login")}
            className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center py-24 px-4">
        <div className="w-full max-w-md bg-card rounded-2xl border p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4 w-fit mx-auto mb-4">
            <Shield className="w-8 h-8 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Accès refusé
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Votre compte ({user.email}) n&apos;a pas les droits
            d&apos;administration nécessaires.
          </p>
          <Button
            variant="outline"
            onClick={() => onNavigate("home")}
            className="rounded-full"
          >
            Retour à la boutique
          </Button>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

/* ------------------------------------------------------------------------- */
/* Dashboard principal                                                       */
/* ------------------------------------------------------------------------- */

const TABS = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "orders", label: "Commandes" },
  { key: "products", label: "Produits" },
  { key: "categories", label: "Catégories" },
  { key: "reviews", label: "Avis" },
  { key: "promos", label: "Codes promo" },
  { key: "clients", label: "Clients" },
  { key: "messages", label: "Messages" },
  { key: "emails", label: "E-mails" },
  { key: "reports", label: "Rapports" },
  { key: "audit", label: "Journal" },
  { key: "settings", label: "Paramètres" },
] as const;

type AdminTab = (typeof TABS)[number]["key"];

function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="bg-background flex-1 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#C9A961] mb-1">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              Administration
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              Gestion de la boutique
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="rounded-full gap-2"
          >
            <RefreshCw className={REFRESH_ICON} aria-hidden="true" />
            Actualiser
          </Button>
        </header>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AdminTab)}
          className="mb-6"
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            {TABS.map((item) => (
              <TabsTrigger key={item.key} value={item.key}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "dashboard" && <StatsPanel refreshKey={refreshKey} />}
        {tab === "orders" && <OrdersPanel refreshKey={refreshKey} />}
        {tab === "products" && <ProductsPanel refreshKey={refreshKey} />}
        {tab === "categories" && (
          <CategoriesPanel refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "reviews" && <ReviewsPanel refreshKey={refreshKey} />}
        {tab === "promos" && <PromosPanel refreshKey={refreshKey} />}
        {tab === "clients" && <CustomersPanel refreshKey={refreshKey} />}
        {tab === "messages" && <MessagesPanel refreshKey={refreshKey} />}
        {tab === "emails" && <EmailsPanel refreshKey={refreshKey} />}
        {tab === "reports" && <ReportsPanel refreshKey={refreshKey} />}
        {tab === "audit" && <AuditPanel refreshKey={refreshKey} />}
        {tab === "settings" && <SettingsPanel refreshKey={refreshKey} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Tableau de bord                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Carte « Données initiales » — proposée quand le catalogue Firestore est
 * vide : catégories de référence (Vêtements, Chaussures, Sacs, Accessoires,
 * Mode Homme, Mode Femme), codes promo de démarrage et réglages livraison.
 */
function SeedCard({ onSeeded }: { onSeeded: () => void }) {
  const [seeding, setSeeding] = useState(false);
  return (
    <section
      className="rounded-2xl border border-[#C9A961]/40 bg-[#C9A961]/5 p-5 flex flex-wrap items-center justify-between gap-4"
      aria-label="Initialisation de la boutique"
    >
      <div className="min-w-0">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
          Boutique vide — données initiales
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Crée les catégories de référence (Vêtements, Chaussures, Sacs,
          Accessoires, Mode Homme, Mode Femme), les codes promo de démarrage et
          les réglages de livraison (FCFA). Aucun produit fictif : le catalogue
          reste alimenté par vos vrais produits.
        </p>
      </div>
      <Button
        onClick={async () => {
          if (seeding) return;
          setSeeding(true);
          try {
            const result = await api.admin.seedInitialData();
            toast.success(
              `Initialisation terminée : ${result.categories} catégorie(s), ${result.promos} code(s) promo.`
            );
            onSeeded();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Initialisation impossible."
            );
          } finally {
            setSeeding(false);
          }
        }}
        disabled={seeding}
        className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
      >
        {seeding ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="w-4 h-4" aria-hidden="true" />
        )}
        {seeding ? "Initialisation…" : "Initialiser la boutique"}
      </Button>
    </section>
  );
}

function StatsPanel({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .stats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de charger les statistiques.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) return <PanelLoader label="Chargement du tableau de bord…" />;
  if (!stats) return <PanelError label="Statistiques indisponibles." />;

  if (stats.productsCount === 0) {
    return (
      <div className="space-y-6">
        <SeedCard onSeeded={() => window.location.reload()} />
        <PanelError label="Le catalogue ne contient aucun produit — commencez par initialiser la boutique ou créer un produit." />
      </div>
    );
  }

  const maxRevenue = Math.max(1, ...stats.daily.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          icon={<Euro className="w-5 h-5" aria-hidden="true" />}
          label="Chiffre d'affaires"
          value={formatPrice(stats.revenue)}
        />
        <KpiCard
          icon={<Package className="w-5 h-5" aria-hidden="true" />}
          label="Commandes"
          value={String(stats.ordersCount)}
        />
        <KpiCard
          icon={<Wallet className="w-5 h-5" aria-hidden="true" />}
          label="Panier moyen"
          value={formatPrice(stats.avgOrder)}
        />
        <KpiCard
          icon={<BarChart3 className="w-5 h-5" aria-hidden="true" />}
          label="Produits actifs"
          value={`${stats.activeProductsCount}/${stats.productsCount}`}
        />
        <KpiCard
          icon={<Boxes className="w-5 h-5" aria-hidden="true" />}
          label="Valeur du stock"
          value={formatPrice(stats.inventoryValue)}
        />
        <KpiCard
          icon={<MessageSquare className="w-5 h-5" aria-hidden="true" />}
          label="À traiter"
          value={`${stats.pendingReviews} avis · ${stats.pendingMessages} msg`}
          alert={stats.pendingReviews + stats.pendingMessages > 0}
        />
      </div>

      {/* Ventes 14 jours */}
      <section className="bg-card rounded-2xl border p-6">
        <h2 className="font-semibold text-foreground mb-4">
          Ventes des 14 derniers jours
        </h2>
        <div className="flex items-end gap-1.5 h-32" role="img" aria-label="Graphique des ventes quotidiennes">
          {stats.daily.map((day) => (
            <div
              key={day.date}
              className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0"
              title={`${day.date} — ${formatPrice(day.revenue)} (${day.orders} cmd)`}
            >
              <div
                className="w-full rounded-t bg-[#C9A961]/80 hover:bg-[#C9A961] transition-colors"
                style={{
                  height: `${Math.max(3, (day.revenue / maxRevenue) * 88)}%`,
                }}
              />
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                {shortDate(day.date)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dernières commandes */}
        <section className="bg-card rounded-2xl border p-6">
          <h2 className="font-semibold text-foreground mb-4">
            Dernières commandes
          </h2>
          {stats.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune commande pour le moment.
            </p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-1 admin-scroll">
              {stats.recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 text-sm border-b border-border/60 pb-3 last:pb-0 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-foreground truncate">
                      {order.reference}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.customerName} · {order.items.length} article
                      {order.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-foreground">
                      {formatPrice(order.total)}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top produits */}
        <section className="bg-card rounded-2xl border p-6">
          <h2 className="font-semibold text-foreground mb-4">
            Meilleures ventes
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune vente enregistrée.
            </p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-1 admin-scroll">
              {stats.topProducts.map((product, index) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 text-sm border-b border-border/60 pb-3 last:pb-0 last:border-0"
                >
                  <span className="w-6 h-6 rounded-full bg-[#C9A961]/15 text-[#C9A961] font-bold flex items-center justify-center text-xs shrink-0">
                    {index + 1}
                  </span>
                  <ProductThumb image={product.image} name={product.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.soldCount} vendu{product.soldCount > 1 ? "s" : ""} · stock {product.stock}
                    </p>
                  </div>
                  <span className="font-semibold shrink-0">
                    {formatPrice(product.price)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Alertes stock bas */}
      {stats.lowStock > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          {stats.lowStock} produit{stats.lowStock > 1 ? "s" : ""} en stock
          faible (≤ {stats.lowStockThreshold}) — pensez au réassort.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Commandes                                                        */
/* ------------------------------------------------------------------------- */

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    paid: "bg-[#C9A961]/15 text-[#a8873f] dark:text-[#C9A961]",
    shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <Badge className={cn("text-[10px] font-semibold", styles[status] ?? "")}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function OrdersPanel({ refreshKey }: { refreshKey: number }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        order.reference.toLowerCase().includes(needle) ||
        order.customerName.toLowerCase().includes(needle) ||
        order.email.toLowerCase().includes(needle) ||
        order.city.toLowerCase().includes(needle)
      );
    });
  }, [orders, search, statusFilter]);

  const load = useCallback(async () => {
    try {
      const { orders: rows } = await api.admin.orders();
      setOrders(rows);
    } catch {
      toast.error("Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleStatus = async (order: AdminOrder, status: string) => {
    setUpdating(order.id);
    try {
      await api.admin.updateOrderStatus(order.id, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      );
      toast.success(
        status === "cancelled"
          ? `Commande ${order.reference} annulée — stock restitué.`
          : `Commande ${order.reference} → ${STATUS_LABELS[status]}.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible."
      );
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <PanelLoader label="Chargement des commandes…" />;
  if (orders.length === 0)
    return <PanelError label="Aucune commande enregistrée pour le moment." />;

  return (
    <div className="space-y-3">
      {/* Recherche, filtre statut et export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (référence, client, email, ville)…"
            className="h-10 rounded-xl pl-9"
            aria-label="Rechercher une commande"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-[170px] h-10 rounded-xl"
            aria-label="Filtrer par statut"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CsvExportButton
          type="orders"
          label="Exporter CSV"
          ariaLabel="Exporter les commandes en CSV"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <PanelError label="Aucune commande ne correspond à cette recherche." />
      ) : (
        filteredOrders.map((order) => (
        <article key={order.id} className="bg-card rounded-2xl border overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              className="text-left min-w-0 flex-1"
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              aria-expanded={expanded === order.id}
            >
              <p className="font-mono font-bold text-foreground">
                {order.reference}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {order.customerName} · {order.email} ·{" "}
                {formatDate(order.createdAt)}
              </p>
            </button>
            <div className="text-right">
              <p className="font-bold text-foreground">
                {formatPrice(order.total)}
              </p>
              <OrderStatusBadge status={order.status} />
            </div>
            <Select
              value={order.status}
              onValueChange={(value) => handleStatus(order, value)}
              disabled={updating === order.id}
            >
              <SelectTrigger
                className="w-[150px] h-9 rounded-xl"
                aria-label={`Statut de la commande ${order.reference}`}
              >
                {updating === order.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {expanded === order.id && (
            <div className="border-t border-border bg-muted/30 p-4 sm:p-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Articles</h3>
                <ul className="space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5">
                      <ProductThumb image={item.image} name={item.productName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatPrice(item.unitPrice)}
                          {item.size ? ` · taille ${item.size}` : ""}
                          {item.color ? ` · ${item.color}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <h3 className="font-semibold text-foreground mb-2">
                  Livraison &amp; paiement
                </h3>
                <p>
                  {order.addressLine1}
                  {order.addressLine2 ? `, ${order.addressLine2}` : ""}
                </p>
                <p>
                  {order.postalCode} {order.city}, {order.country}
                </p>
                <p>
                  Livraison : <span className="text-foreground">{order.shippingMethod}</span>{" "}
                  ({formatPrice(order.shippingCost)})
                </p>
                <p>
                  Paiement : <span className="text-foreground">{order.paymentMethod}</span>{" "}
                  — {order.paymentStatus === "paid" ? "payé" : "non payé"}
                </p>
                {order.promoCode && (
                  <p>
                    Code promo : <span className="font-mono text-[#C9A961]">{order.promoCode}</span>{" "}
                    (−{formatPrice(order.discount)})
                  </p>
                )}
                {order.notes && <p className="italic">« {order.notes} »</p>}
                <p className="pt-1 border-t border-border/60 mt-2">
                  Sous-total {formatPrice(order.subtotal)} + livraison{" "}
                  {formatPrice(order.shippingCost)} − remise{" "}
                  {formatPrice(order.discount)} ={" "}
                  <span className="font-bold text-foreground">
                    {formatPrice(order.total)}
                  </span>
                </p>
              </div>
            </div>
          )}
        </article>
      ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Produits                                                         */
/* ------------------------------------------------------------------------- */

interface ProductFormState {
  id?: string;
  name: string;
  categoryId: string;
  price: string;
  oldPrice: string;
  stock: string;
  description: string;
  details: string;
  image: string;
  sizes: string;
  colors: string;
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
}

const EMPTY_FORM: ProductFormState = {
  name: "",
  categoryId: "",
  price: "",
  oldPrice: "",
  stock: "0",
  description: "",
  details: "",
  image: "",
  sizes: "",
  colors: "",
  isFeatured: false,
  isNew: true,
  isActive: true,
};

function ProductsPanel({ refreshKey }: { refreshKey: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<
    "all" | "low" | "out" | "hidden"
  >("all");

  // Création de catégorie EN LIGNE depuis le formulaire produit (mission §12).
  const [inlineCategoryOpen, setInlineCategoryOpen] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [inlineCategorySaving, setInlineCategorySaving] = useState(false);

  const handleInlineCategoryCreate = async () => {
    const name = inlineCategoryName.trim();
    if (name.length < 2) {
      toast.error("Le nom de la catégorie est requis (2 caractères minimum).");
      return;
    }
    setInlineCategorySaving(true);
    try {
      await api.admin.createCategory({ name });
      // Rechargement puis sélection automatique de la nouvelle catégorie.
      const fresh = await api.categories.list();
      setCategories(fresh);
      const created =
        fresh.find((c) => c.name.toLowerCase() === name.toLowerCase()) ??
        fresh[fresh.length - 1];
      if (created) {
        setForm((prev) => ({ ...prev, categoryId: created.id }));
      }
      toast.success(`Catégorie « ${name} » créée et sélectionnée.`);
      setInlineCategoryOpen(false);
      setInlineCategoryName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible."
      );
    } finally {
      setInlineCategorySaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter !== "all" && product.categoryId !== categoryFilter)
        return false;
      if (quickFilter === "low" && !(product.stock > 0 && product.stock <= 5))
        return false;
      if (quickFilter === "out" && product.stock !== 0) return false;
      if (quickFilter === "hidden" && product.isActive) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.category?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [products, search, categoryFilter, quickFilter]);

  const load = useCallback(async () => {
    // Chargements INDÉPENDANTS (Promise.allSettled) : un échec de la liste
    // produits ne laisse plus le Select catégories vide silencieusement
    // (cause racine du bug « sélection de catégorie impossible »).
    const [productsResult, categoriesResult] = await Promise.allSettled([
      api.admin.products(),
      api.categories.list(),
    ]);
    if (productsResult.status === "fulfilled") {
      setProducts(productsResult.value.products);
    } else {
      toast.error("Impossible de charger les produits.");
    }
    if (categoriesResult.status === "fulfilled") {
      setCategories(categoriesResult.value);
    } else {
      toast.error(
        "Impossible de charger les catégories — le formulaire produit sera limité."
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setForm({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      price: String(product.price),
      oldPrice: product.oldPrice ? String(product.oldPrice) : "",
      stock: String(product.stock),
      description: product.description,
      details: product.details,
      image: product.image,
      sizes: parseList(product.sizes).join(", "),
      colors: parseList(product.colors).join(", "),
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      isActive: product.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const price = Number(form.price.replace(",", "."));
    if (!form.name.trim() || !form.categoryId || Number.isNaN(price) || price <= 0) {
      toast.error("Nom, catégorie et prix valides sont requis.");
      return;
    }
    const oldPrice = form.oldPrice.trim()
      ? Number(form.oldPrice.replace(",", "."))
      : null;
    if (oldPrice !== null && Number.isNaN(oldPrice)) {
      toast.error("Ancien prix invalide.");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
      stock: Math.max(0, Math.round(Number(form.stock) || 0)),
      description: form.description.trim(),
      details: form.details.trim(),
      image: form.image.trim() || "/images/products/placeholder.svg",
      gallery: [],
      sizes: splitList(form.sizes),
      colors: splitList(form.colors),
      isFeatured: form.isFeatured,
      isNew: form.isNew,
      isActive: form.isActive,
    };

    try {
      if (form.id) {
        await api.admin.updateProduct(form.id, payload);
        toast.success(`« ${payload.name} » mis à jour.`);
      } else {
        await api.admin.createProduct(payload);
        toast.success(`« ${payload.name} » créé.`);
      }
      setDialogOpen(false);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  };

  const quickPatch = async (
    product: Product,
    data: Partial<{
      stock: number;
      isFeatured: boolean;
      isActive: boolean;
    }>
  ) => {
    try {
      const result = await api.admin.updateProduct(product.id, data);
      // Le serveur renvoie restockNotified > 0 si un réassort (stock 0 → X)
      // vient de déclencher l'envoi d'alertes aux clients inscrits.
      if (result.restockNotified && result.restockNotified > 0) {
        toast.success(
          `Réassort : ${result.restockNotified} client(s) inscrit(s) à l'alerte notifié(s) par e-mail.`
        );
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, ...data } : p))
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible."
      );
    }
  };

  const adjustStock = async (product: Product, delta: number) => {
    const nextStock = Math.max(0, product.stock + delta);
    await quickPatch(product, { stock: nextStock });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.deleteProduct(deleteTarget.id);
      toast.success(`« ${deleteTarget.name} » supprimé.`);
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible."
      );
    }
  };

  if (loading) return <PanelLoader label="Chargement du catalogue…" />;

  return (
    <div className="space-y-3">
      {/* Recherche, filtres et actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-10 rounded-xl pl-9"
            aria-label="Rechercher un produit"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger
            className="w-[180px] h-10 rounded-xl"
            aria-label="Filtrer par catégorie"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CsvExportButton
          type="products"
          label="Exporter CSV"
          ariaLabel="Exporter le catalogue en CSV"
        />
        <Button
          onClick={openCreate}
          className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2 h-10"
        >
          <Plus className={REFRESH_ICON} aria-hidden="true" />
          Nouveau produit
        </Button>
      </div>

      {/* Filtres rapides */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: "Tous" },
            { key: "low", label: "Stock faible" },
            { key: "out", label: "Rupture" },
            { key: "hidden", label: "Masqués" },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setQuickFilter(chip.key)}
            aria-pressed={quickFilter === chip.key}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors",
              quickFilter === chip.key
                ? "bg-[#C9A961] border-[#C9A961] text-white"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {chip.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
        </span>
      </div>

      {filteredProducts.length === 0 ? (
        <PanelError label="Aucun produit ne correspond à ces filtres." />
      ) : (
        filteredProducts.map((product) => (
        <article
          key={product.id}
          className="bg-card rounded-2xl border p-4 flex flex-wrap items-center gap-3 sm:gap-4"
        >
          <ProductThumb image={product.image} name={product.name} large />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">
              {product.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {product.category?.name ?? "—"} · {formatPrice(product.price)} ·{" "}
              {product.soldCount} vendus
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {!product.isActive && (
                <Badge className="text-[10px] bg-red-500/15 text-red-700 dark:text-red-400">
                  Masqué
                </Badge>
              )}
              {product.isFeatured && (
                <Badge className="text-[10px] bg-[#C9A961]/15 text-[#a8873f] dark:text-[#C9A961]">
                  Vedette
                </Badge>
              )}
              {product.isNew && (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  Nouveau
                </Badge>
              )}
              {product.stock <= 5 && (
                <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  Stock faible
                </Badge>
              )}
            </div>
          </div>

          {/* Stock rapide */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label={`Retirer 1 au stock de ${product.name}`}
              onClick={() => adjustStock(product, -1)}
            >
              −
            </Button>
            <span
              className={cn(
                "w-10 text-center font-semibold text-sm",
                product.stock <= 5 ? "text-amber-600" : "text-foreground"
              )}
              aria-label={`Stock actuel : ${product.stock}`}
            >
              {product.stock}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label={`Ajouter 1 au stock de ${product.name}`}
              onClick={() => adjustStock(product, 1)}
            >
              +
            </Button>
          </div>

          {/* Interrupteurs */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={product.isActive}
                onCheckedChange={(checked) =>
                  quickPatch(product, { isActive: checked })
                }
                aria-label={`Produit actif : ${product.name}`}
              />
              Actif
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={product.isFeatured}
                onCheckedChange={(checked) =>
                  quickPatch(product, { isFeatured: checked })
                }
                aria-label={`Produit vedette : ${product.name}`}
              />
              Vedette
            </label>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label={`Modifier ${product.name}`}
              onClick={() => openEdit(product)}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full text-destructive hover:text-destructive"
              aria-label={`Supprimer ${product.name}`}
              onClick={() => setDeleteTarget(product)}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </article>
      ))
      )}

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto admin-scroll">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
            <DialogDescription>
              Les modifications sont visibles immédiatement en boutique.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nom du produit *">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex : Tapis de Yoga Pro"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Catégorie *">
                <div className="flex gap-2">
                  <Select
                    value={form.categoryId}
                    onValueChange={(value) => setForm({ ...form, categoryId: value })}
                  >
                    <SelectTrigger className="h-10 rounded-xl flex-1 min-w-0">
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Aucune catégorie — créez-en une.
                        </div>
                      ) : (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setInlineCategoryOpen(true)}
                    className="h-10 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-[#C9A961] hover:text-[#C9A961] transition-colors"
                    aria-label="Ajouter une nouvelle catégorie"
                    title="Ajouter une nouvelle catégorie"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden min-[520px]:inline">Nouvelle</span>
                  </button>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Prix (FCFA) *">
                <Input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  inputMode="decimal"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Ancien prix (FCFA)">
                <Input
                  value={form.oldPrice}
                  onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                  inputMode="decimal"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Stock *">
                <Input
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  inputMode="numeric"
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>

            <ImageUrlField
              label="Image principale * (URL publique)"
              value={form.image}
              onChange={(url) => setForm((prev) => ({ ...prev, image: url }))}
              placeholder="https://… ou /images/products/mon-produit.jpg"
            />

            <Field label="Description courte">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="rounded-xl"
              />
            </Field>

            <Field label="Détails (une ligne par point)">
              <Textarea
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                rows={3}
                className="rounded-xl"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tailles (séparées par des virgules)">
                <Input
                  value={form.sizes}
                  onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                  placeholder="S, M, L, XL"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Couleurs (séparées par des virgules)">
                <Input
                  value={form.colors}
                  onChange={(e) => setForm({ ...form, colors: e.target.value })}
                  placeholder="Noir, Or"
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
                Visible en boutique
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={form.isFeatured}
                  onCheckedChange={(checked) => setForm({ ...form, isFeatured: checked })}
                />
                Produit vedette
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={form.isNew}
                  onCheckedChange={(checked) => setForm({ ...form, isNew: checked })}
                />
                Badge nouveau
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {form.id ? "Enregistrer" : "Créer le produit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce produit ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.name} » sera définitivement supprimé, avec ses
              avis et alertes de réassort. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="rounded-full gap-2"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — création de catégorie EN LIGNE (depuis le formulaire produit) */}
      <Dialog open={inlineCategoryOpen} onOpenChange={setInlineCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
            <DialogDescription>
              La catégorie est enregistrée dans Firebase et devient disponible
              pour ce produit et les prochains.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="inline-category-name">Nom de la catégorie *</Label>
            <Input
              id="inline-category-name"
              value={inlineCategoryName}
              onChange={(e) => setInlineCategoryName(e.target.value)}
              placeholder="Ex : Bijoux"
              className="h-10 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleInlineCategoryCreate();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInlineCategoryOpen(false)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              onClick={handleInlineCategoryCreate}
              disabled={inlineCategorySaving}
              className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
            >
              {inlineCategorySaving && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              Créer la catégorie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Catégories (CRUD complet — corrige « sélection + création »)      */
/* ------------------------------------------------------------------------- */

interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  order: string;
}

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  image: "",
  order: "0",
};

/** Miroir client du slugify serveur (accents français → minuscules/tirets). */
function slugifyClient(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function CategoriesPanel({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh?: () => void;
}) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .categories()
      .then((data) => setCategories(data.categories))
      .catch(() => toast.error("Impossible de charger les catégories."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openCreate = () => {
    setForm({
      ...EMPTY_CATEGORY_FORM,
      order: String(
        categories.reduce((max, category) => Math.max(max, category.order), 0) + 1
      ),
    });
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      order: String(category.order),
    });
    setSlugTouched(true); // en édition, le slug n'est plus auto-rempli
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      // En création, le slug suit le nom tant que l'admin ne l'a pas édité.
      slug: !prev.id && !slugTouched ? slugifyClient(name) : prev.slug,
    }));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const slug = form.slug.trim();
    const order = Math.round(Number(form.order) || 0);
    if (name.length < 2) {
      toast.error("Le nom de la catégorie est requis (2 caractères minimum).");
      return;
    }
    if (order < 0) {
      toast.error("L'ordre doit être un nombre positif (≥ 0).");
      return;
    }
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast.error("Slug invalide : minuscules, chiffres et tirets uniquement.");
      return;
    }

    setSaving(true);
    const payload = {
      name,
      ...(slug ? { slug } : {}),
      description: form.description.trim(),
      image: form.image.trim(),
      order,
    };
    try {
      if (form.id) {
        await api.admin.updateCategory(form.id, payload);
        toast.success(`Catégorie « ${name} » mise à jour.`);
      } else {
        await api.admin.createCategory(payload);
        toast.success(`Catégorie « ${name} » créée.`);
      }
      setDialogOpen(false);
      setForm(EMPTY_CATEGORY_FORM);
      load();
      onRefresh?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.admin.deleteCategory(deleteTarget.id);
      toast.success(`Catégorie « ${deleteTarget.name} » supprimée.`);
      setDeleteTarget(null);
      load();
      onRefresh?.();
    } catch (error) {
      // 409 : produits actifs rattachés → message serveur explicite affiché.
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PanelLoader label="Chargement des catégories…" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Les catégories structurent la boutique (menu, page Catégories,
          formulaire produit). Le slug est généré depuis le nom.
        </p>
        <Button
          onClick={openCreate}
          className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
        >
          <Plus className={REFRESH_ICON} aria-hidden="true" />
          Nouvelle catégorie
        </Button>
      </div>

      {categories.length === 0 ? (
        <PanelError label="Aucune catégorie. Créez la première !" />
      ) : (
        <div className="max-h-96 overflow-y-auto pr-1 admin-scroll space-y-3">
          {categories.map((category) => (
            <article
              key={category.id}
              className="bg-card rounded-2xl border p-4 flex flex-wrap items-center gap-3 sm:gap-4"
            >
              <ProductThumb image={category.image} name={category.name} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">
                  {category.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  <span className="font-mono">/{category.slug}</span> · ordre{" "}
                  {category.order} · {category.productCount} produit
                  {category.productCount > 1 ? "s" : ""}
                </p>
                {category.description && (
                  <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                    {category.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label={`Modifier la catégorie ${category.name}`}
                  onClick={() => openEdit(category)}
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-full",
                    category.productCount > 0
                      ? "opacity-50"
                      : "text-destructive hover:text-destructive"
                  )}
                  aria-label={`Supprimer la catégorie ${category.name}`}
                  title={
                    category.productCount > 0
                      ? "Déplace ou supprime d'abord les produits actifs"
                      : "Supprimer"
                  }
                  onClick={() => setDeleteTarget(category)}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto admin-scroll">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Les modifications sont visibles immédiatement en boutique."
                : "Le slug est pré-rempli depuis le nom — tu peux le personnaliser."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Nom *">
              <Input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex : Électronique"
                className="h-10 rounded-xl"
              />
            </Field>
            <Field label="Slug (URL)">
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value });
                }}
                placeholder="electronique"
                className="h-10 rounded-xl font-mono"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                className="rounded-xl"
              />
            </Field>
            <ImageUrlField
              label="Image de la catégorie (URL publique)"
              value={form.image}
              onChange={(url) => setForm((prev) => ({ ...prev, image: url }))}
              placeholder="https://… ou /images/categories/ma-categorie.jpg"
            />
            <Field label="Ordre d'affichage (≥ 0)">
              <Input
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
                inputMode="numeric"
                className="h-10 rounded-xl"
              />
            </Field>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {form.id ? "Enregistrer" : "Créer la catégorie"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette catégorie ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.name} » sera définitivement supprimée. Si des
              produits y sont encore rattachés, la suppression sera refusée.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full gap-2"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Avis (modération)                                                */
/* ------------------------------------------------------------------------- */

function ReviewsPanel({ refreshKey }: { refreshKey: number }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (status: "pending" | "approved" | "all") => {
      try {
        setReviews(await api.admin.reviews(status));
      } catch {
        toast.error("Impossible de charger les avis.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(filter);
  }, [load, filter, refreshKey]);

  const handleModerate = async (review: AdminReview, isApproved: boolean) => {
    try {
      await api.admin.setReviewApproval(review.id, isApproved);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      toast.success(
        isApproved
          ? "Avis approuvé — il est désormais visible en boutique."
          : "Avis dépublié."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Modération impossible."
      );
    }
  };

  const handleDelete = async (review: AdminReview) => {
    try {
      await api.admin.deleteReview(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      toast.success("Avis supprimé.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible."
      );
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="approved">Approuvés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <PanelLoader label="Chargement des avis…" />
      ) : reviews.length === 0 ? (
        <PanelError label="Aucun avis dans cette catégorie." />
      ) : (
        <div className="grid gap-3">
          {reviews.map((review) => (
            <article key={review.id} className="bg-card rounded-2xl border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductThumb image={review.product.image} name={review.product.name} />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {review.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {review.author} · {formatDate(review.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1" aria-label={`Note : ${review.rating} sur 5`}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={cn(
                        "w-4 h-4",
                        index < review.rating
                          ? "fill-[#C9A961] text-[#C9A961]"
                          : "text-muted-foreground/40"
                      )}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
              {review.title && (
                <p className="font-medium text-foreground text-sm mb-1">
                  {review.title}
                </p>
              )}
              <p className="text-sm text-muted-foreground mb-3 whitespace-pre-line">
                {review.comment}
              </p>
              <div className="flex flex-wrap gap-2">
                {review.isApproved ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleModerate(review, false)}
                    className="rounded-full gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    Dépublier
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleModerate(review, true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Approuver
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(review)}
                  className="rounded-full gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Supprimer
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Codes promo                                                      */
/* ------------------------------------------------------------------------- */

const PROMO_TYPE_LABELS: Record<string, string> = {
  percent: "Remise %",
  amount: "Montant (FCFA)",
  freeship: "Livraison offerte",
};

interface PromoFormState {
  id?: string;
  code: string;
  label: string;
  type: "percent" | "freeship" | "amount";
  value: string;
  minSubtotal: string;
  maxUses: string;
  expiresAt: string; // yyyy-mm-dd ou "" (jamais)
}

const EMPTY_PROMO: PromoFormState = {
  code: "",
  label: "",
  type: "percent",
  value: "10",
  minSubtotal: "0",
  maxUses: "",
  expiresAt: "",
};

/** Badges d'état d'un code promo (expiration / plafond d'utilisations). */
function PromoStatusBadges({ promo }: { promo: AdminPromo }) {
  const expired =
    promo.expiresAt !== null && new Date(promo.expiresAt).getTime() < Date.now();
  const exhausted = promo.maxUses !== null && promo.usageCount >= promo.maxUses;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {!promo.isActive && (
        <Badge className="text-[10px] bg-red-500/15 text-red-700 dark:text-red-400">
          Désactivé
        </Badge>
      )}
      {expired && (
        <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
          Expiré
        </Badge>
      )}
      {exhausted && (
        <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
          Limite atteinte
        </Badge>
      )}
      {promo.expiresAt !== null && !expired && (
        <Badge className="text-[10px] bg-violet-500/15 text-violet-700 dark:text-violet-400">
          Expire le {shortDate(promo.expiresAt)}
        </Badge>
      )}
    </div>
  );
}

function PromosPanel({ refreshKey }: { refreshKey: number }) {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PromoFormState>(EMPTY_PROMO);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .promos()
      .then(setPromos)
      .catch(() => toast.error("Impossible de charger les codes promo."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openEdit = (promo: AdminPromo) => {
    setForm({
      id: promo.id,
      code: promo.code,
      label: promo.label,
      type: promo.type as PromoFormState["type"],
      value: String(promo.value),
      minSubtotal: String(promo.minSubtotal),
      maxUses: promo.maxUses !== null ? String(promo.maxUses) : "",
      expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const value = Number(form.value.replace(",", "."));
    if (!form.code.trim() || !form.label.trim() || Number.isNaN(value)) {
      toast.error("Code, libellé et valeur valides sont requis.");
      return;
    }
    if (form.type === "percent" && value > 100) {
      toast.error("Une remise en % ne peut pas dépasser 100.");
      return;
    }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      type: form.type,
      value: form.type === "freeship" ? 0 : value,
      minSubtotal: Math.max(0, Number(form.minSubtotal.replace(",", ".")) || 0),
      maxUses: form.maxUses.trim() ? Math.round(Number(form.maxUses)) : null,
      expiresAt: form.expiresAt
        ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
        : null,
    };
    try {
      if (form.id) {
        await api.admin.updatePromo(form.id, payload);
        toast.success(`Code ${form.code} mis à jour.`);
      } else {
        await api.admin.createPromo({
          code: form.code.trim().toUpperCase(),
          ...payload,
        });
        toast.success(`Code ${form.code.toUpperCase()} créé et actif.`);
      }
      setDialogOpen(false);
      setForm(EMPTY_PROMO);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (promo: AdminPromo) => {
    try {
      await api.admin.updatePromo(promo.id, { isActive: !promo.isActive });
      setPromos((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible."
      );
    }
  };

  const remove = async (promo: AdminPromo) => {
    try {
      await api.admin.deletePromo(promo.id);
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      toast.success(`Code ${promo.code} supprimé.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible."
      );
    }
  };

  if (loading) return <PanelLoader label="Chargement des codes promo…" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
        >
          <Plus className={REFRESH_ICON} aria-hidden="true" />
          Nouveau code
        </Button>
      </div>

      {promos.length === 0 ? (
        <PanelError label="Aucun code promo. Créez-en un !" />
      ) : (
        promos.map((promo) => (
          <article
            key={promo.id}
            className="bg-card rounded-2xl border p-4 flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono font-bold text-[#C9A961]">{promo.code}</p>
              <p className="text-sm text-foreground">{promo.label}</p>
              <p className="text-xs text-muted-foreground">
                {PROMO_TYPE_LABELS[promo.type] ?? promo.type}
                {promo.type !== "freeship" &&
                  ` · valeur ${promo.type === "percent" ? `${promo.value} %` : `${promo.value} FCFA`}`}
                {promo.minSubtotal > 0 &&
                  ` · dès ${formatPrice(promo.minSubtotal)}`}
                {` · utilisé ${promo.usageCount} fois`}
                {promo.maxUses !== null &&
                  ` / ${promo.maxUses} (${Math.min(100, Math.round((promo.usageCount / promo.maxUses) * 100))} %)`}
              </p>
              <PromoStatusBadges promo={promo} />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch
                checked={promo.isActive}
                onCheckedChange={() => toggle(promo)}
                aria-label={`Activer le code ${promo.code}`}
              />
              {promo.isActive ? "Actif" : "Inactif"}
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label={`Modifier le code ${promo.code}`}
                onClick={() => openEdit(promo)}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full text-destructive hover:text-destructive"
                aria-label={`Supprimer le code ${promo.code}`}
                onClick={() => remove(promo)}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? `Modifier le code ${form.code}` : "Nouveau code promo"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Les modifications s'appliquent immédiatement en boutique."
                : "Le code sera immédiatement utilisable en boutique."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Code *">
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="ETE25"
                  disabled={form.id !== undefined}
                  className="h-10 rounded-xl font-mono"
                />
              </Field>
              <Field label="Libellé affiché *">
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="-25 % pour l'été"
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Type">
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm({ ...form, type: value as PromoFormState["type"] })
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Remise %</SelectItem>
                    <SelectItem value="amount">Montant (FCFA)</SelectItem>
                    <SelectItem value="freeship">Livraison offerte</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={form.type === "percent" ? "Valeur (%)" : "Valeur (FCFA)"}>
                <Input
                  value={form.type === "freeship" ? "0" : form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  disabled={form.type === "freeship"}
                  inputMode="decimal"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Minimum d'achat (FCFA)">
                <Input
                  value={form.minSubtotal}
                  onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
                  inputMode="decimal"
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Limite d'utilisations (vide = illimité)">
                <Input
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  inputMode="numeric"
                  placeholder="100"
                  className="h-10 rounded-xl"
                />
              </Field>
              <Field label="Date d'expiration (vide = jamais)">
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {form.id ? "Enregistrer" : "Créer le code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Messages, newsletter, alertes stock                              */
/* ------------------------------------------------------------------------- */

function MessagesPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<{
    messages: AdminContactMessage[];
    subscribers: AdminSubscriber[];
    stockAlerts: AdminStockAlert[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .messages()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de charger la boîte de réception.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) return <PanelLoader label="Chargement de la boîte de réception…" />;
  if (!data) return <PanelError label="Boîte de réception indisponible." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Messages de contact */}
      <section className="bg-card rounded-2xl border p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
          Messages de contact ({data.messages.length})
        </h2>
        {data.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun message reçu.</p>
        ) : (
          <ul className="space-y-4 max-h-96 overflow-y-auto pr-1 admin-scroll">
            {data.messages.map((message) => (
              <li key={message.id} className="border-b border-border/60 pb-4 last:pb-0 last:border-0">
                <p className="font-medium text-foreground text-sm">
                  {message.subject || "Sans objet"}
                </p>
                <p className="text-xs text-muted-foreground mb-1">
                  {message.name} · {message.email} · {formatDate(message.createdAt)}
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {message.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-6">
        {/* Newsletter */}
        <section className="bg-card rounded-2xl border p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
            Newsletter ({data.subscribers.length})
          </h2>
          {data.subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun abonné.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1 admin-scroll">
              {data.subscribers.map((subscriber) => (
                <li
                  key={subscriber.id}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {subscriber.email}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Alertes réassort */}
        <section className="bg-card rounded-2xl border p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
            Alertes réassort ({data.stockAlerts.length})
          </h2>
          {data.stockAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune alerte de réassort.
            </p>
          ) : (
            <ul className="space-y-3 max-h-56 overflow-y-auto pr-1 admin-scroll">
              {data.stockAlerts.map((alert) => (
                <li key={alert.id} className="flex items-center gap-3 text-sm">
                  <ProductThumb image={alert.product.image} name={alert.product.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {alert.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.email} · stock actuel {alert.product.stock}
                      {alert.notified ? " · notifié" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Clients (comptes, historique d'achat, rôles)                     */
/* ------------------------------------------------------------------------- */

function CustomersPanel({ refreshKey }: { refreshKey: number }) {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleTarget, setRoleTarget] = useState<{
    customer: AdminCustomer;
    nextRole: "customer" | "admin";
  } | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const load = useCallback(async () => {
    try {
      setCustomers(await api.admin.customers());
    } catch {
      toast.error("Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (customer) =>
        customer.email.toLowerCase().includes(needle) ||
        (customer.name ?? "").toLowerCase().includes(needle)
    );
  }, [customers, search]);

  const confirmRoleChange = async () => {
    if (!roleTarget) return;
    setSavingRole(true);
    try {
      await api.admin.setCustomerRole(roleTarget.customer.id, roleTarget.nextRole);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === roleTarget.customer.id ? { ...c, role: roleTarget.nextRole } : c
        )
      );
      toast.success(
        roleTarget.nextRole === "admin"
          ? `${roleTarget.customer.email} est maintenant administrateur.`
          : `${roleTarget.customer.email} est maintenant client.`
      );
      setRoleTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Modification impossible."
      );
    } finally {
      setSavingRole(false);
    }
  };

  if (loading) return <PanelLoader label="Chargement des clients…" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client (nom, email)…"
            className="h-10 rounded-xl pl-9"
            aria-label="Rechercher un client"
          />
        </div>
        <CsvExportButton
          type="customers"
          label="Exporter CSV"
          ariaLabel="Exporter les clients en CSV"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} compte{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <PanelError label="Aucun compte ne correspond à cette recherche." />
      ) : (
        filtered.map((customer) => (
          <article
            key={customer.id}
            className="bg-card rounded-2xl border p-4 flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <span
              className="w-10 h-10 rounded-full bg-[#C9A961]/15 text-[#C9A961] font-bold flex items-center justify-center shrink-0 uppercase"
              aria-hidden="true"
            >
              {(customer.name ?? customer.email).charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">
                {customer.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {customer.email} · inscrit le {formatDate(customer.createdAt)}
              </p>
            </div>
            <div className="text-xs text-muted-foreground sm:text-sm">
              <p>
                <span className="font-bold text-foreground">
                  {customer.ordersCount}
                </span>{" "}
                commande{customer.ordersCount > 1 ? "s" : ""}
              </p>
              <p>
                <span className="font-semibold text-[#C9A961]">
                  {formatPrice(customer.totalSpent)}
                </span>{" "}
                dépensés
              </p>
              {customer.lastOrderAt && (
                <p className="hidden sm:block">
                  Dernière : {shortDate(customer.lastOrderAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Badge
                className={cn(
                  "text-[10px] font-semibold",
                  customer.role === "admin"
                    ? "bg-[#C9A961]/15 text-[#a8873f] dark:text-[#C9A961]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {customer.role === "admin" ? "Administrateur" : "Client"}
              </Badge>
              <Switch
                checked={customer.role === "admin"}
                onCheckedChange={(checked) =>
                  setRoleTarget({
                    customer,
                    nextRole: checked ? "admin" : "customer",
                  })
                }
                aria-label={`Rôle administrateur pour ${customer.email}`}
                disabled={customer.role === "admin" && customers.length === 1}
              />
            </div>
          </article>
        ))
      )}

      {/* Confirmation changement de rôle */}
      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => !open && setRoleTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {roleTarget?.nextRole === "admin"
                ? "Promouvoir administrateur ?"
                : "Retirer les droits administrateur ?"}
            </DialogTitle>
            <DialogDescription>
              {roleTarget?.nextRole === "admin"
                ? `« ${roleTarget?.customer.email} » pourra accéder à l'espace de gestion (commandes, produits, réglages…).`
                : `« ${roleTarget?.customer.email} » perdra l'accès à l'espace de gestion immédiatement.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRoleTarget(null)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={savingRole}
              className={cn(
                "rounded-full gap-2 text-white",
                roleTarget?.nextRole === "admin"
                  ? "bg-[#C9A961] hover:bg-[#b8994f]"
                  : "bg-destructive hover:bg-destructive/90"
              )}
            >
              {savingRole && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Rapports (période 7/30/90 jours)                                 */
/* ------------------------------------------------------------------------- */

const SHIPPING_LABELS: Record<string, string> = {
  standard: "Standard",
  express: "Express",
  pickup: "Point relais",
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Vues de page",
  product_view: "Fiches produits vues",
  add_to_cart: "Ajouts panier",
  remove_from_cart: "Retraits panier",
  begin_checkout: "Checkouts débutés",
  purchase: "Achats",
  apply_promo: "Codes appliqués",
  search: "Recherches",
  wishlist_add: "Ajouts favoris",
  stock_alert: "Alertes réassort",
  review_submitted: "Avis déposés",
  newsletter_signup: "Inscriptions news.",
  contact_submit: "Messages contact",
};

const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  order_confirmation: "Confirmation commande",
  order_status: "Statut commande",
  restock_alert: "Alerte réassort",
  welcome: "Bienvenue",
  password_reset: "Reset mot de passe",
  account_deleted: "Compte supprimé",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "product.create": "Produit créé",
  "product.update": "Produit modifié",
  "product.delete": "Produit supprimé",
  "product.restock": "Réassort notifié",
  "order.status": "Statut commande",
  "order.refund": "Remboursement",
  "promo.create": "Code promo créé",
  "promo.update": "Code promo modifié",
  "promo.delete": "Code promo supprimé",
  "review.approve": "Avis approuvé",
  "review.unpublish": "Avis dépublié",
  "review.delete": "Avis supprimé",
  "customer.role": "Rôle compte modifié",
  "settings.update": "Réglages boutique",
};

const PAYMENT_LABELS: Record<string, string> = {
  card: "Carte bancaire",
  paypal: "PayPal",
  transfer: "Virement",
};

function ReportsPanel({ refreshKey }: { refreshKey: number }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<AdminReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .reports(days)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Impossible de charger le rapport.");
          setReport(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  // Loader dérivé : tant que le rapport affiché ne correspond pas à la
  // période sélectionnée, on affiche le calcul en cours (aucun setState
  // synchrone dans l'effet).
  const loading = !report || report.days !== days;

  const maxCategoryRevenue = Math.max(
    1,
    ...(report?.salesByCategory.map((c) => c.revenue) ?? [1])
  );

  return (
    <div className="space-y-6">
      <Tabs value={String(days)} onValueChange={(value) => setDays(Number(value) as 7 | 30 | 90)}>
        <TabsList>
          <TabsTrigger value="7">7 jours</TabsTrigger>
          <TabsTrigger value="30">30 jours</TabsTrigger>
          <TabsTrigger value="90">90 jours</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading || !report ? (
        <PanelLoader label="Calcul du rapport…" />
      ) : (
        <>
          {/* KPIs période */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Euro className="w-5 h-5" aria-hidden="true" />}
              label={`CA ${report.days} jours`}
              value={formatPrice(report.revenue)}
            />
            <KpiCard
              icon={<Package className="w-5 h-5" aria-hidden="true" />}
              label="Commandes"
              value={String(report.ordersCount)}
            />
            <KpiCard
              icon={<Wallet className="w-5 h-5" aria-hidden="true" />}
              label="Panier moyen"
              value={formatPrice(report.avgOrder)}
            />
            <KpiCard
              icon={<Users className="w-5 h-5" aria-hidden="true" />}
              label="Nouveaux clients"
              value={String(report.newCustomers)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventes par catégorie */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
                Ventes par catégorie
              </h2>
              {report.salesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune vente sur la période.
                </p>
              ) : (
                <ul className="space-y-3">
                  {report.salesByCategory.map((category) => (
                    <li key={category.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">{category.name}</span>
                        <span className="font-semibold">
                          {formatPrice(category.revenue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C9A961]"
                          style={{
                            width: `${Math.max(3, (category.revenue / maxCategoryRevenue) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Top produits de la période */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
                Top produits de la période
              </h2>
              {report.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune vente sur la période.
                </p>
              ) : (
                <ul className="space-y-3 max-h-72 overflow-y-auto pr-1 admin-scroll">
                  {report.topProducts.map((product, index) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-3 text-sm border-b border-border/60 pb-3 last:pb-0 last:border-0"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#C9A961]/15 text-[#C9A961] font-bold flex items-center justify-center text-xs shrink-0">
                        {index + 1}
                      </span>
                      <ProductThumb image={product.image} name={product.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.quantity} article
                          {product.quantity > 1 ? "s" : ""} vendu
                          {product.quantity > 1 ? "s" : ""} · stock {product.stock}
                        </p>
                      </div>
                      <span className="font-semibold shrink-0">
                        {formatPrice(product.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Statuts / livraison / paiement */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
                Répartition des commandes
              </h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Statuts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(report.statusBreakdown).length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      Object.entries(report.statusBreakdown).map(([status, count]) => (
                        <span
                          key={status}
                          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1"
                        >
                          <OrderStatusBadge status={status} />
                          <span className="font-semibold text-foreground">{count}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Livraison
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    {Object.entries(report.shippingBreakdown).map(([method, count]) => (
                      <li key={method}>
                        {SHIPPING_LABELS[method] ?? method} :{" "}
                        <span className="font-semibold text-foreground">{count}</span>
                      </li>
                    ))}
                    {Object.keys(report.shippingBreakdown).length === 0 && <li>—</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Paiement
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    {Object.entries(report.paymentBreakdown).map(([method, count]) => (
                      <li key={method}>
                        {PAYMENT_LABELS[method] ?? method} :{" "}
                        <span className="font-semibold text-foreground">{count}</span>
                      </li>
                    ))}
                    {Object.keys(report.paymentBreakdown).length === 0 && <li>—</li>}
                  </ul>
                </div>
              </div>
            </section>

            {/* Codes promo + santé du stock */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
                Codes promo &amp; stock
              </h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Codes utilisés sur la période
                  </p>
                  {Object.entries(report.promoUsage).length === 0 ? (
                    <p className="text-muted-foreground">Aucun code utilisé.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(report.promoUsage)
                        .sort((a, b) => b[1] - a[1])
                        .map(([code, count]) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-3 py-1 font-mono text-xs font-bold text-[#a8873f] dark:text-[#C9A961]"
                          >
                            {code}
                            <span className="font-sans font-semibold">×{count}</span>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Valeur du stock</p>
                    <p className="font-bold text-foreground">
                      {formatPrice(report.inventoryValue)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">En rupture</p>
                    <p
                      className={cn(
                        "font-bold",
                        report.outOfStock > 0 ? "text-amber-600" : "text-foreground"
                      )}
                    >
                      {report.outOfStock} produit{report.outOfStock > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Avis en attente</p>
                    <p className="font-bold text-foreground">{report.pendingReviews}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Note moyenne</p>
                    <p className="font-bold text-foreground">
                      {report.avgRating.toFixed(1)}/5
                    </p>
                  </div>
                </div>
                {report.lowStockProducts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      À réapprovisionner
                    </p>
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-1 admin-scroll">
                      {report.lowStockProducts.map((product) => (
                        <li key={product.id} className="flex items-center gap-2.5">
                          <ProductThumb image={product.image} name={product.name} />
                          <span className="min-w-0 flex-1 truncate text-foreground">
                            {product.name}
                          </span>
                          <Badge
                            className={cn(
                              "text-[10px]",
                              product.stock === 0
                                ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            )}
                          >
                            {product.stock === 0 ? "Rupture" : `Stock ${product.stock}`}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* Activité (analytics persistés) — pleine largeur */}
            <section className="bg-card rounded-2xl border p-6 lg:col-span-2">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
                Activité boutique ({report.days} jours)
              </h2>
              {report.analytics.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun événement enregistré sur la période.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {report.analytics.events.slice(0, 12).map((item) => (
                      <div key={item.event} className="rounded-xl bg-muted/50 p-3 text-center">
                        <p className="font-bold text-lg text-foreground">{item.count}</p>
                        <p className="text-[11px] text-muted-foreground truncate" title={EVENT_LABELS[item.event] ?? item.event}>
                          {EVENT_LABELS[item.event] ?? item.event}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Événements collectés sans cookie tiers (respect RGPD) — vues de page,
                    ajouts panier, recherches… Les achats sont comptés dans les commandes.
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — E-mails transactionnels (journal du provider « log »)            */
/* ------------------------------------------------------------------------- */

function EmailsPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<{
    emails: AdminEmailLog[];
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [template, setTemplate] = useState("all");
  const [open, setOpen] = useState<AdminEmailLog | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .emails(page, 25, search, template)
      .then((result) => {
        if (!cancelled) setData({ emails: result.emails, total: result.total });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Impossible de charger les e-mails.");
          setData({ emails: [], total: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, template, refreshKey]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par destinataire ou objet…"
            className="h-10 rounded-xl pl-9"
            aria-label="Rechercher un e-mail"
          />
        </div>
        <Select
          value={template}
          onValueChange={(value) => {
            setTemplate(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px] h-10 rounded-xl" aria-label="Filtrer par type d'e-mail">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(EMAIL_TEMPLATE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!data ? (
        <PanelLoader label="Chargement des e-mails…" />
      ) : data.emails.length === 0 ? (
        <PanelError label="Aucun e-mail journalisé pour ce filtre." />
      ) : (
        <div className="bg-card rounded-2xl border overflow-hidden">
          <ul className="divide-y divide-border/60 max-h-96 overflow-y-auto admin-scroll">
            {data.emails.map((email) => (
              <li key={email.id}>
                <button
                  type="button"
                  onClick={() => setOpen(email)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-3"
                >
                  <span className="rounded-lg bg-[#C9A961]/10 p-2 mt-0.5">
                    <Mail className="w-4 h-4 text-[#C9A961]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-foreground truncate">
                        {email.subject}
                      </span>
                      <Badge className="text-[10px] bg-muted text-muted-foreground">
                        {EMAIL_TEMPLATE_LABELS[email.template] ?? email.template}
                      </Badge>
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      → {email.to} · {formatDate(email.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} sur {totalPages} — {data?.total ?? 0} e-mails
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Détail de l'e-mail */}
      <Dialog open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left">{open.subject}</DialogTitle>
                <DialogDescription className="text-left">
                  À {open.to} ·{" "}
                  {EMAIL_TEMPLATE_LABELS[open.template] ?? open.template} ·{" "}
                  {formatDate(open.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <pre className="whitespace-pre-wrap rounded-xl bg-muted/60 p-4 text-xs text-foreground font-mono leading-relaxed">
                {open.body}
              </pre>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Journal d'audit (traçabilité des actions admin)                   */
/* ------------------------------------------------------------------------- */

function AuditPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<{
    entries: AdminAuditEntry[];
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("all");

  useEffect(() => {
    let cancelled = false;
    api.admin
      .audit(page, 30, action)
      .then((result) => {
        if (!cancelled) setData({ entries: result.entries, total: result.total });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Impossible de charger le journal d'audit.");
          setData({ entries: [], total: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, action, refreshKey]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[240px] h-10 rounded-xl" aria-label="Filtrer par type d'action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          Chaque action admin sensible est tracée (qui, quoi, quand) — exigence
          de gouvernance et de sécurité.
        </span>
      </div>

      {!data ? (
        <PanelLoader label="Chargement du journal…" />
      ) : data.entries.length === 0 ? (
        <PanelError label="Aucune action enregistrée pour ce filtre." />
      ) : (
        <div className="bg-card rounded-2xl border overflow-hidden">
          <ul className="divide-y divide-border/60 max-h-[28rem] overflow-y-auto admin-scroll">
            {data.entries.map((entry) => (
              <li
                key={entry.id}
                className="px-4 py-3 flex flex-wrap items-center gap-2 text-sm"
              >
                <Badge className="text-[10px] bg-[#C9A961]/10 text-[#a8873f] dark:text-[#C9A961]">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </Badge>
                {entry.target && (
                  <span className="font-medium text-foreground truncate max-w-[220px]">
                    {entry.target}
                  </span>
                )}
                <span className="text-xs text-muted-foreground truncate">
                  par {entry.actor}
                </span>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {formatDate(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} sur {totalPages} — {data?.total ?? 0} entrées
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Onglet — Paramètres boutique (réglages serveur)                           */
/* ------------------------------------------------------------------------- */

const SETTINGS_FIELDS: {
  key: keyof AdminSettings;
  label: string;
  suffix: string;
  hint: string;
}[] = [
  {
    key: "shippingStandard",
    label: "Livraison standard",
    suffix: "F",
    hint: "Facturée si le sous-total est sous le seuil de gratuité.",
  },
  {
    key: "shippingExpress",
    label: "Livraison express (24-48 h)",
    suffix: "F",
    hint: "Toujours payante, quelle que soit la commande.",
  },
  {
    key: "shippingPickup",
    label: "Retrait en point relais",
    suffix: "F",
    hint: "Toujours payant, quelle que soit la commande.",
  },
  {
    key: "freeShippingThreshold",
    label: "Seuil livraison offerte",
    suffix: "F",
    hint: "La livraison standard est offerte dès ce montant d'achat.",
  },
  {
    key: "lowStockThreshold",
    label: "Seuil d'alerte stock faible",
    suffix: "unités",
    hint: "Un produit en dessous (ou égal) déclenche l'alerte admin.",
  },
];

function SettingsPanel({ refreshKey }: { refreshKey: number }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [mmEnabled, setMmEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .settings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setMmEnabled(data.paymentMobileMoneyEnabled);
        setForm({
          shippingStandard: String(data.shippingStandard),
          shippingExpress: String(data.shippingExpress),
          shippingPickup: String(data.shippingPickup),
          freeShippingThreshold: String(data.freeShippingThreshold),
          lowStockThreshold: String(data.lowStockThreshold),
          paymentMobileMoneyNumber: data.paymentMobileMoneyNumber,
          paymentInstructions: data.paymentInstructions,
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de charger les réglages.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleSave = async () => {
    const numeric: Record<string, number> = {};
    for (const field of SETTINGS_FIELDS) {
      const value = Number((form[field.key] ?? "").replace(",", "."));
      if (!Number.isFinite(value) || value < 0) {
        toast.error(`Valeur invalide pour « ${field.label} ».`);
        return;
      }
      numeric[field.key] =
        field.key === "lowStockThreshold" ? Math.round(value) : value;
    }
    // Paiement mobile money (structure honnête : pas de simulation).
    const payload: Partial<AdminSettings> = {
      ...numeric,
      paymentMobileMoneyEnabled: mmEnabled,
      paymentMobileMoneyNumber: (form.paymentMobileMoneyNumber ?? "").trim(),
      paymentInstructions: (form.paymentInstructions ?? "").trim(),
    };

    setSaving(true);
    try {
      const result = await api.admin.updateSettings(payload);
      setSettings(result.settings);
      setMmEnabled(result.settings.paymentMobileMoneyEnabled);
      toast.success(
        "Réglages enregistrés — appliqués immédiatement côté serveur."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PanelLoader label="Chargement des réglages…" />;
  if (!settings) return <PanelError label="Réglages indisponibles." />;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2.5 rounded-xl border border-[#C9A961]/40 bg-[#C9A961]/5 px-4 py-3 text-sm text-foreground">
        <Settings className="w-4 h-4 text-[#C9A961] shrink-0" aria-hidden="true" />
        <p>
          Ces valeurs sont la <strong>source de vérité serveur</strong> : chaque
          commande recalcule les frais réellement débités à partir d&apos;ici.
          Le panier et le checkout affichent automatiquement les nouveaux
          tarifs (propagation ~30 s).
        </p>
      </div>

      <section className="bg-card rounded-2xl border p-6 grid sm:grid-cols-2 gap-4">
        {SETTINGS_FIELDS.map((field) => (
          <Field key={field.key} label={`${field.label} (${field.suffix})`}>
            <Input
              value={form[field.key] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              inputMode={
                field.key === "lowStockThreshold" ? "numeric" : "decimal"
              }
              className="h-10 rounded-xl"
              aria-label={`${field.label} en ${field.suffix}`}
            />
            <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>
          </Field>
        ))}
      </section>

      {/* Paiement mobile money — structure réelle, pas de simulation. */}
      <section className="bg-card rounded-2xl border p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
              Paiement mobile money
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Désactivé, le checkout affiche un message honnête et l&apos;API de
              paiement refuse (503) — aucune simulation de débit.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
            <Switch
              checked={mmEnabled}
              onCheckedChange={setMmEnabled}
              aria-label="Activer le paiement mobile money"
            />
            {mmEnabled ? "Actif" : "Inactif"}
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Numéro marchand (ex : +225 07 00 00 00 00)">
            <Input
              value={form.paymentMobileMoneyNumber ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  paymentMobileMoneyNumber: e.target.value,
                }))
              }
              inputMode="tel"
              placeholder="+225 07 00 00 00 00"
              className="h-10 rounded-xl"
              aria-label="Numéro marchand mobile money"
            />
          </Field>
          <Field label="Instructions clients (affichées au paiement)">
            <Textarea
              value={form.paymentInstructions ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  paymentInstructions: e.target.value,
                }))
              }
              rows={3}
              placeholder="Réglez via Wave au numéro ci-dessus puis indiquez la référence commande."
              className="rounded-xl"
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          L&apos;encaissement automatique nécessite un prestataire réel : les
          transactions sont créées en attente puis confirmées uniquement par
          son webhook signé (PAYMENT_WEBHOOK_SECRET).
        </p>
      </section>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Enregistrer les réglages
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Primitives partagées                                                      */
/* ------------------------------------------------------------------------- */

function KpiCard({
  icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "rounded-full p-2",
            alert
              ? "bg-amber-500/15 text-amber-600"
              : "bg-[#C9A961]/12 text-[#C9A961]"
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <p className="text-lg sm:text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ProductThumb({
  image,
  name,
  large = false,
}: {
  image: string;
  name: string;
  large?: boolean;
}) {
  const size = large ? "h-14 w-14" : "h-10 w-10";
  if (!image) {
    return (
      <span
        className={cn(
          size,
          "rounded-lg bg-muted flex items-center justify-center shrink-0"
        )}
        aria-hidden="true"
      >
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      </span>
    );
  }
  return (
    <img
      src={image}
      alt=""
      aria-hidden="true"
      className={cn(size, "rounded-lg object-cover border border-border/60 shrink-0")}
      loading="lazy"
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function PanelLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2.5" aria-hidden="true" />
      {label}
    </div>
  );
}

function PanelError({ label }: { label: string }) {
  return (
    <div className="bg-card rounded-2xl border p-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

/* Helpers listes (champs "S, M, L" ↔ string[]) */

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseList(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
