"use client";

import { useState } from "react";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CONTACT_ITEMS = [
  { icon: Mail, label: "Email", value: "contact@mignonciteshop.com" },
  { icon: Phone, label: "Téléphone", value: "+33 1 23 45 67 89" },
  { icon: MapPin, label: "Adresse", value: "Paris, France" },
  { icon: Clock, label: "Horaires", value: "Lun-Ven : 9h-18h" },
] as const;

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!response.ok) {
        throw new Error("Erreur lors de l'envoi du message");
      }
      toast.success("Votre message a bien été envoyé.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      toast.error(
        "Une erreur est survenue lors de l'envoi. Merci de réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background">
      {/* Bandeau titre */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-[#C9A961] text-sm font-semibold tracking-widest uppercase mb-2">
              Contact
            </p>
            <h1 className="text-4xl font-bold text-foreground">
              Nous sommes à votre écoute
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Une question, une demande ou besoin d&apos;aide ? Notre équipe
              vous répond rapidement.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Coordonnées */}
          <div className="lg:col-span-2">
            <h2 className="font-semibold text-foreground text-xl mb-4">
              Coordonnées
            </h2>
            <div className="space-y-4">
              {CONTACT_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="bg-card rounded-2xl border p-5 flex items-center gap-4"
                >
                  <div className="p-3 bg-[#C9A961]/10 rounded-xl flex-shrink-0">
                    <item.icon
                      className="w-5 h-5 text-[#C9A961]"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-medium text-foreground truncate">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulaire */}
          <div className="lg:col-span-3">
            <div className="bg-card rounded-2xl border p-6">
              <h2 className="font-semibold text-foreground text-xl mb-6">
                Envoyez-nous un message
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Nom</Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Votre nom"
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Sujet</Label>
                  <Input
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Objet de votre demande"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Écrivez votre message ici..."
                    required
                    rows={6}
                    className="rounded-xl resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-[#C9A961] hover:bg-[#b8994f] text-white rounded-full px-8 py-3 font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  {submitting ? "Envoi en cours..." : "Envoyer le message"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
