"use client";

import { useState } from "react";
import { toast } from "sonner";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'inscription");
      toast.success("Bienvenue ! Votre inscription à la newsletter est confirmée.");
      setEmail("");
    } catch {
      toast.error(
        "Une erreur est survenue lors de l'inscription. Veuillez réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-20 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-fluid-h2 font-bold text-white mb-4">
          Rejoignez Notre Newsletter
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Recevez en avant-première nos offres exclusives et nouveautés
        </p>
        <form
          className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
          onSubmit={handleSubmit}
        >
          <input
            type="email"
            required
            placeholder="Votre email"
            aria-label="Votre email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="flex-1 px-6 py-4 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C9A961] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-4 bg-[#C9A961] text-white rounded-full font-semibold hover:bg-[#b8994f] transition-colors disabled:opacity-50"
          >
            S&apos;abonner
          </button>
        </form>
      </div>
    </section>
  );
}
