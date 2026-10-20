CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER on_auth_user_verified BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_verified_clinic_creation();
CREATE POLICY "Anyone can update an avatar" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "public" WITH CHECK ((bucket_id = 'avatars'::text));
CREATE POLICY "Anyone can upload an avatar" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((bucket_id = 'avatars'::text));
CREATE POLICY "Authenticated users update doctor avatars" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "public" WITH CHECK (((bucket_id = 'doctor-avatars'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Authenticated users upload doctor avatars" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((bucket_id = 'doctor-avatars'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Avatar images are publicly accessible" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Owners can delete their logos" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'clinic-branding'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Owners can update their logos" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'clinic-branding'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Owners can upload logos" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'clinic-branding'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.clinic_id)::text AS clinic_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Public Access to Clinic Logos" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((bucket_id = 'clinic-branding'::text));
CREATE POLICY "Public Access to Doctor Avatars" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'doctor-avatars'::text));
CREATE POLICY "Tenant isolated delete for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated delete for patient-files" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND (get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['clinic_owner'::text, 'doctor'::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated delete for receipts" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND (((get_clinic_member_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['clinic_owner'::text, 'admin'::text])) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND (get_clinic_member_role(b.clinic_id) = ANY (ARRAY['clinic_owner'::text, 'admin'::text]))))))));
CREATE POLICY "Tenant isolated insert for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated insert for receipts" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id)))))));
CREATE POLICY "Tenant isolated read for patient-files" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated select for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated select for receipts" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id)))))));
CREATE POLICY "Tenant isolated update for patient-avatars" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'patient-avatars'::text) AND ((((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL)))))) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((((storage.foldername(objects.name))[1] = (p.id)::text) OR (objects.name ~~ ((p.id)::text || '-%'::text))) AND (p.deleted_at IS NULL) AND is_clinic_member(p.clinic_id)))))));
CREATE POLICY "Tenant isolated update for patient-files" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid))) WITH CHECK (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Tenant isolated update for receipts" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'receipts'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND ((is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[2])::uuid) AND (b.clinic_id = ((storage.foldername(objects.name))[1])::uuid)))))) OR (EXISTS ( SELECT 1
   FROM billings b
  WHERE ((b.id = ((storage.foldername(objects.name))[1])::uuid) AND is_clinic_member(b.clinic_id)))))));
CREATE POLICY "Tenant isolated upload for patient-files" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'patient-files'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'::text) AND is_clinic_member(((storage.foldername(name))[1])::uuid) AND (((storage.foldername(name))[2] IS NULL) OR (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = ((storage.foldername(objects.name))[2])::uuid) AND (p.clinic_id = ((storage.foldername(objects.name))[1])::uuid) AND (p.deleted_at IS NULL))))) AND check_subscription_active(((storage.foldername(name))[1])::uuid)));
