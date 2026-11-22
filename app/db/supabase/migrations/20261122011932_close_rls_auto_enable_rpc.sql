-- Supabase's security advisor: public.rls_auto_enable() is a SECURITY DEFINER
-- function the API roles could call at /rest/v1/rpc/rls_auto_enable.
--
-- It is the hosted project's own "enable row-level security on every new table"
-- event trigger, not part of Funza's schema. Event triggers fire regardless of who
-- may EXECUTE the function, so taking that right away from the API roles closes the
-- endpoint and keeps the trigger working. The function exists only on hosted
-- projects, so a local or CI database skips this.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
