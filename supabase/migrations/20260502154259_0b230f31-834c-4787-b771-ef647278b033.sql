
REVOKE EXECUTE ON FUNCTION public.get_metric(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_sgs_global() FROM PUBLIC, anon, authenticated;
