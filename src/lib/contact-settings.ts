"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContactSettings {
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  mobileMoneyName: string;
}

export const CONTACT_DEFAULTS: ContactSettings = {
  email: "contact@mignonciteshop.com",
  phone: "+225 07 00 00 00 00",
  whatsapp: "+225 07 00 00 00 00",
  address: "Abidjan, Côte d'Ivoire",
  hours: "Lun-Sam : 9h-19h",
  mobileMoneyName: "",
};

let cache: ContactSettings | null = null;
const listeners = new Set<(c: ContactSettings) => void>();

export async function fetchContactSettings(): Promise<ContactSettings> {
  const { data } = await supabase
    .from("documents")
    .select("data")
    .eq("collection", "settings")
    .eq("id", "public")
    .maybeSingle();
  const contact = ((data?.data ?? {}) as { contact?: Partial<ContactSettings> }).contact ?? {};
  cache = { ...CONTACT_DEFAULTS, ...contact };
  listeners.forEach((l) => l(cache!));
  return cache;
}

export async function saveContactSettings(next: ContactSettings): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("documents")
    .select("data")
    .eq("collection", "settings")
    .eq("id", "public")
    .maybeSingle();
  if (readErr) throw readErr;
  const merged = { ...((data?.data ?? {}) as Record<string, unknown>), contact: next };
  const { error } = data
    ? await supabase.from("documents").update({ data: merged }).eq("collection", "settings").eq("id", "public")
    : await supabase.from("documents").insert({ collection: "settings", id: "public", data: merged });
  if (error) throw error;
  cache = next;
  listeners.forEach((l) => l(next));
}

export function useContactSettings(): ContactSettings {
  const [c, setC] = useState<ContactSettings>(cache ?? CONTACT_DEFAULTS);
  useEffect(() => {
    listeners.add(setC);
    if (!cache) void fetchContactSettings().catch(() => {});
    return () => {
      listeners.delete(setC);
    };
  }, []);
  return c;
}
