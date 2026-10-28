alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.handle_user_updated() set search_path = public, pg_temp;