import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";

/** Équivalent minimal de `next/dynamic` (chargement différé côté navigateur). */
export default function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  opts?: { ssr?: boolean; loading?: () => ReactNode }
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const mod = await loader();
    return "default" in (mod as object)
      ? (mod as { default: ComponentType<P> })
      : { default: mod as ComponentType<P> };
  });
  const fallback = opts?.loading ? opts.loading() : null;
  return function DynamicComponent(props: P) {
    const [mounted, setMounted] = useState(opts?.ssr !== false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <>{fallback}</>;
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
