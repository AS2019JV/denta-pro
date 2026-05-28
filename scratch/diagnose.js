const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = {};
if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, 'utf-8');
  fileContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      envConfig[key] = value;
    }
  });
}

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL'] || 'https://leqsrfyjvuxxdsubjjin.supabase.co';
const serviceRoleKey = envConfig['SUPABASE_SERVICE_ROLE_KEY'];

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function run() {
  try {
    console.log("=== CLINICS ===");
    const { data: clinics, error: clinicsErr } = await supabase
      .from('clinics')
      .select('id, name, created_at');
    
    if (clinicsErr) throw clinicsErr;
    console.log(`Found ${clinics.length} clinics:`);
    clinics.forEach(c => console.log(`- ID: ${c.id} | Name: "${c.name}" | Created: ${c.created_at}`));

    console.log("\n=== PROFILES ===");
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, clinic_id');
    if (profErr) throw profErr;
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => console.log(`- ID: ${p.id} | Name: ${p.first_name} ${p.last_name} | Email: ${p.email} | Role: ${p.role} | Clinic ID: ${p.clinic_id}`));

    console.log("\n=== CLINIC MEMBERS ===");
    const { data: members, error: memErr } = await supabase
      .from('clinic_members')
      .select('id, user_id, clinic_id, role');
    if (memErr) throw memErr;
    console.log(`Found ${members.length} clinic members:`);
    members.forEach(m => console.log(`- ID: ${m.id} | User ID: ${m.user_id} | Clinic ID: ${m.clinic_id} | Role: ${m.role}`));

    console.log("\n=== PATIENTS ===");
    const { data: patientCounts, error: patErr } = await supabase
      .from('patients')
      .select('id, clinic_id, first_name, last_name, status, created_at');
    if (patErr) throw patErr;
    
    console.log(`Found ${patientCounts.length} total patients in DB:`);
    
    // Group by clinic_id
    const grouped = {};
    patientCounts.forEach(p => {
      if (!grouped[p.clinic_id]) grouped[p.clinic_id] = [];
      grouped[p.clinic_id].push(p);
    });

    for (const [cid, pats] of Object.entries(grouped)) {
      const clinicName = clinics.find(c => c.id === cid)?.name || 'Unknown Clinic';
      console.log(`\nClinic "${clinicName}" (${cid}) has ${pats.length} patients:`);
      pats.forEach(p => {
        console.log(`  - ID: ${p.id} | Name: ${p.first_name} ${p.last_name} | Status: ${p.status} | Created: ${p.created_at}`);
      });
    }

  } catch (err) {
    console.error("Error during diagnosis:", err);
  }
}

run();
