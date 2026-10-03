import type { SupabaseClient } from "@supabase/supabase-js"

/** Recheck immediately before publication; previously received bytes cannot be revoked. */
export async function requireClinicalExportAuthority(
  client: SupabaseClient,
  scope: { userId: string; clinicId: string },
  isCurrent: () => boolean,
): Promise<void> {
  const denied = () => new Error("No se pudo verificar tu autorización para exportar esta clínica. Vuelve a iniciar la operación.")
  if (!scope.userId || !scope.clinicId || !isCurrent()) throw denied()
  const [identity, role, subscription] = await Promise.all([
    client.auth.getUser(),
    client.rpc("get_clinic_member_role", { check_clinic_id: scope.clinicId }),
    client.rpc("check_subscription_active", { check_clinic_id: scope.clinicId }),
  ])
  if (!isCurrent() || identity.error || identity.data.user?.id !== scope.userId
    || role.error || role.data !== "clinic_owner" || subscription.error || subscription.data !== true) throw denied()
}
