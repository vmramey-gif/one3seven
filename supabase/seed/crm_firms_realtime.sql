-- Enable Realtime on crm_firms so claims/releases/stage changes propagate live across
-- reps (a claimed firm disappears from everyone else's Open list within ~1s).
-- Run ONCE in the Supabase SQL editor. Idempotent.

do $$
begin
  begin
    alter publication supabase_realtime add table public.crm_firms;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
