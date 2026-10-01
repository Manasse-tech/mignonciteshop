"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";

interface Testimonial {
  name: string;
  quote: string;
  product: string;
  rating: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sophie M.",
    quote:
      "Commande reçue en 48h, emballage soigné et produit conforme. La veste est magnifique, je recommande vivement !",
    product: "Veste Légère Premium",
    rating: 5,
  },
  {
    name: "Karim B.",
    quote:
      "Excellent rapport qualité-prix sur les écouteurs. Le service client a répondu à ma question en moins d'une heure.",
    product: "Écouteurs Bluetooth Pro",
    rating: 5,
  },
  {
    name: "Léa G.",
    quote:
      "Ma 3ème commande sur MignonciteShop et toujours aussi satisfaite. Les retours sont simples et gratuits.",
    product: "Coussin Décoratif",
    rating: 5,
  },
  {
    name: "Antoine R.",
    quote:
      "La montre connectée tient toutes ses promesses, et le suivi de commande en ligne est très pratique.",
    product: "Montre Connectée Sport",
    rating: 4,
  },
];

export function Testimonials() {
  const [active, setActive] = useState(0);
  const count = TESTIMONIALS.length;

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => (a + 1) % count);
    }, 6000);
    return () => clearInterval(id);
  }, [active, count]);

  const prev = () => setActive((a) => (a - 1 + count) % count);
  const next = () => setActive((a) => (a + 1) % count);

  const testimonial = TESTIMONIALS[active];

  return (
    <section
      className="py-16 md:py-20"
      aria-roledescription="carrousel"
      aria-label="Témoignages clients"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
            Avis clients
          </p>
          <h2 className="text-fluid-h2 font-bold text-foreground">
            Ils nous font confiance
          </h2>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="bg-card rounded-3xl p-8 md:p-12 shadow-sm relative overflow-hidden">
            <Quote
              aria-hidden="true"
              className="absolute -top-2 -left-2 w-24 h-24 text-[#C9A961]/10"
            />
            <div key={active} className="animate-fade-up">
              <span className="inline-flex items-center mb-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    aria-hidden="true"
                    className={
                      i < testimonial.rating
                        ? "fill-[#C9A961] text-[#C9A961]"
                        : "text-muted-foreground/40"
                    }
                  />
                ))}
              </span>
              <p className="text-foreground/90 text-lg md:text-xl leading-relaxed mb-8">
                « {testimonial.quote} »
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-black font-bold">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Client vérifié · a acheté {testimonial.product}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Témoignage précédent"
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 md:-translate-x-1/2 w-10 h-10 rounded-full bg-card shadow-md border border-border hidden sm:flex items-center justify-center text-muted-foreground hover:text-[#C9A961] hover:border-[#C9A961] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Témoignage suivant"
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 md:translate-x-1/2 w-10 h-10 rounded-full bg-card shadow-md border border-border hidden sm:flex items-center justify-center text-muted-foreground hover:text-[#C9A961] hover:border-[#C9A961] transition-colors"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center gap-2 mt-6">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Aller au témoignage ${i + 1}`}
                onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === active
                    ? "w-8 bg-[#C9A961]"
                    : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/45"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
