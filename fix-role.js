const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRoles() {
  console.log("Conectando a Supabase para actualizar los roles...");
  
  // 1. Update Auth Metadata
  const { data: users, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Error obteniendo usuarios:", authError);
    return;
  }

  let updated = 0;
  for (const user of users.users) {
    if (user.user_metadata?.role === 'doctor' || !user.user_metadata?.role) {
      const newMetadata = { ...user.user_metadata, role: 'clinic_owner' };
      const { error } = await supabase.auth.admin.updateUserById(user.id, { user_metadata: newMetadata });
      if (error) {
        console.error("Error actualizando auth metadata para", user.email, ":", error.message);
      } else {
        console.log(`✅ Rol de autenticación actualizado a clinic_owner para: ${user.email}`);
        updated++;
      }
    }
  }

  // 2. Update Profiles Table
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ role: 'clinic_owner' })
    .in('role', ['doctor', 'admin']);
    
  if (dbError) {
    console.error("Error actualizando la tabla profiles:", dbError.message);
  } else {
    console.log("✅ Tabla profiles actualizada correctamente a clinic_owner");
  }

  console.log(`\nProceso completado. ${updated} usuarios actualizados.`);
  console.log("👉 Por favor, CERRAR SESIÓN e INICIAR SESIÓN nuevamente en la aplicación para ver los cambios.");
}

fixRoles();
