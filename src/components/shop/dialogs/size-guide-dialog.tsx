"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ruler } from "lucide-react";

interface SizeGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WOMEN = [
  { size: "XS", fr: "34", bust: "80–84", waist: "62–66", hips: "88–92" },
  { size: "S", fr: "36", bust: "84–88", waist: "66–70", hips: "92–96" },
  { size: "M", fr: "38–40", bust: "88–96", waist: "70–78", hips: "96–104" },
  { size: "L", fr: "42", bust: "96–104", waist: "78–86", hips: "104–112" },
  { size: "XL", fr: "44–46", bust: "104–112", waist: "86–94", hips: "112–120" },
];

const SHOES = [
  { size: "38", cm: "24,0" },
  { size: "39", cm: "24,5" },
  { size: "40", cm: "25,0" },
  { size: "41", cm: "26,0" },
  { size: "42", cm: "26,5" },
  { size: "43", cm: "27,0" },
  { size: "44", cm: "28,0" },
  { size: "45", cm: "28,5" },
];

/**
 * Guide des tailles — modale partagée (fiche produit, FAQ).
 * Contract : SizeGuideDialog { open, onOpenChange }
 */
export function SizeGuideDialog({ open, onOpenChange }: SizeGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Ruler className="w-5 h-5 text-[#C9A961]" aria-hidden="true" />
            Guide des tailles
          </DialogTitle>
          <DialogDescription>
            Mesures en centimètres, prises à plat. En cas de doute entre deux
            tailles, choisissez la plus grande.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          <section aria-labelledby="size-guide-vetements">
            <h3 id="size-guide-vetements" className="text-sm font-semibold uppercase tracking-wider text-[#C9A961] mb-3">
              Vêtements
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Taille</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">FR</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Poitrine (cm)</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Taille (cm)</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Hanches (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {WOMEN.map((row) => (
                    <tr key={row.size} className="border-t border-border/60">
                      <td className="px-4 py-2.5 font-semibold text-[#C9A961]">{row.size}</td>
                      <td className="px-4 py-2.5">{row.fr}</td>
                      <td className="px-4 py-2.5">{row.bust}</td>
                      <td className="px-4 py-2.5">{row.waist}</td>
                      <td className="px-4 py-2.5">{row.hips}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="size-guide-chaussures">
            <h3 id="size-guide-chaussures" className="text-sm font-semibold uppercase tracking-wider text-[#C9A961] mb-3">
              Chaussures
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Taille EU</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Longueur du pied (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {SHOES.map((row) => (
                    <tr key={row.size} className="border-t border-border/60">
                      <td className="px-4 py-2.5 font-semibold text-[#C9A961]">{row.size}</td>
                      <td className="px-4 py-2.5">{row.cm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-4">
            <strong className="text-foreground">Conseil :</strong> mesurez votre
            pied en fin de journée (il est légèrement plus large) et gardez
            environ 0,5 cm de marge devant les orteils. Besoin d&apos;aide ?
            Contactez-nous, nous vous répondons en moins de 24 h.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
