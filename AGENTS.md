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
