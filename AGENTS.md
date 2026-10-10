<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data layer: the shop's original Firestore code runs unchanged through `src/lib/fb/firestore.ts` and `src/lib/fb/auth.ts`, compat shims over Lovable Cloud (`public.documents` table keyed by collection+id, JSON `data`). Why: preserves the user's existing code while moving off Firebase.
- Security lives in RLS policies on `public.documents` per collection plus the `documents_guard` trigger; admin = `user_roles` via `has_role`, synced from the `users` doc role. Why: never trust client-side role checks.
- In-app navigation keeps the original `/?page=...` query scheme via `src/lib/next-navigation.ts`. Why: original components call `router.push` with these URLs.
- Role checks: the real check is `private.has_role` (security definer, not exposed); `public.has_role` is an invoker wrapper that only answers for the caller. Why: stops role enumeration while keeping RLS policies unchanged.
- AI features run in `src/lib/ai.functions.ts` server functions calling the gateway via `src/lib/ai/gateway.server.ts`; order payment status changes from Mobile Money proofs happen only server-side. Why: keep keys and payment validation off the client.
- Shop images live in a private storage bucket served through long-lived signed links (public buckets are blocked in this workspace).
