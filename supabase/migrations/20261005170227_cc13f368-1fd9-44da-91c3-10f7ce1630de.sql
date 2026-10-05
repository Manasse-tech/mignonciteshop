CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- Public wrapper: invoker rights, can only check the caller's own role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ select case when _user_id is null or _user_id <> auth.uid() then false
                  else private.has_role(_user_id, _role) end $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.documents_guard() FROM PUBLIC, anon, authenticated;

-- Payment proofs readable by their owner
DROP POLICY IF EXISTS docs_read ON public.documents;
CREATE POLICY docs_read ON public.documents FOR SELECT TO anon, authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (collection = ANY (ARRAY['categories','settings','reviews','promos','orderLookups']))
  OR ((collection = 'products') AND ((data ->> 'isActive') = 'true'))
  OR ((collection = 'users') AND (id = (auth.uid())::text))
  OR ((collection = 'loyalty') AND (id = (auth.uid())::text))
  OR ((collection ~~ 'loyalty/%/transactions') AND (split_part(collection, '/', 2) = (auth.uid())::text))
  OR ((collection = 'orders') AND (auth.uid() IS NOT NULL) AND (((data ->> 'uid') = (auth.uid())::text) OR (lower(data ->> 'email') = lower(auth.jwt() ->> 'email'))))
  OR ((collection IN ('paymentTransactions','paymentProofs')) AND (owner IS NOT NULL) AND (owner = auth.uid()))
);

-- Storage policies
CREATE POLICY "shop images public read" ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');
CREATE POLICY "shop images admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "shop images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'shop-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "shop images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shop-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "proofs owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "proofs owner or admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));