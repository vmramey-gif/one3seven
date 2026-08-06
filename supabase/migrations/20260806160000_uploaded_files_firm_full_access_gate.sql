-- SECURITY FIX: uploaded_files_firm_select had no route_status check, so any firm with a
-- linking row in intake_routes — even at 'access_requested' (pre-approval preview), before the
-- worker ever clicks "Approve full access" — could SELECT every uploaded file's metadata
-- (file_name, category, file_size, file_path). The client code already assumed this was gated
-- (see intakeDataService.ts's listFirmAccessibleUploadInventory / previewFallbackOnly comment:
-- "Firm preview can read timeline/summary under RLS but not uploaded_files until full_access") —
-- the database just never enforced it. Actual file BYTES were already correctly protected by the
-- storage.objects policy (intake_files_firm_full_access_read, gated on firm_intake_routes.route_status
-- = 'full_access'); this migration brings the metadata row policy in line with that same pattern.

drop policy if exists uploaded_files_firm_select on public.uploaded_files;
create policy uploaded_files_firm_select
  on public.uploaded_files
  for select
  to authenticated
  using (
    exists (
      select 1
      from intake_routes ir
      join firm_profiles fp on fp.id = ir.firm_id
      where ir.intake_id = uploaded_files.intake_id
        and fp.profile_id = auth.uid()
        and ir.route_status = 'full_access'
    )
  );
