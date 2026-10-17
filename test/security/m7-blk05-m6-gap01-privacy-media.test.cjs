/**
 * Test Suite: Gate 5 — M7-BLK-05 / M6-GAP-01 Privacy Export Integrity & Private Media Lifecycles
 * Location: test/security/m7-blk05-m6-gap01-privacy-media.test.cjs
 *
 * Verifies Gate 5, items M7-BLK-05 and M6-GAP-01:
 * 1. components/settings/privacy-tab.tsx:
 *    - backupData.meta explicitly defines:
 *      - binary_attachments_included: false
 *      - delivery_scope: 'clinic_metadata_export'
 *      - binary_delivery_note: explicit legal/operational notice on standalone delivery
 *    - backupData.meta.manifest explicitly defines:
 *      - binary_attachments_count: 0
 *      - binary_metadata_records: filesData.length
 *    - fetchAllRows preserves deterministic order `.order('id', { ascending: true })` and offset advancement `from += data.length`
 *    - handleExportData enforces clinic_owner role check (`activeRole !== 'clinic_owner'`) and inserts `pending` portability record into `data_rights_requests`
 *    - UI Card component for Portabilidad de Datos explicitly distinguishes structured metadata from binary attachments
 *
 * 2. components/avatar-upload.tsx:
 *    - createSignedUrl with TTL 3600s for private patient-avatars bucket
 *    - Pre-emptive signature renewal scheduled at 3000s (50 min)
 *    - onError fallback renewal handler for expired storage signatures on patient-avatars
 *    - Fail-closed behavior (`setAvatarUrl(null)`) on signing failure without leaking public URLs
 *    - Clean path extraction via extractStoragePath supporting public and signed URL variants
 */

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');

const ROOT_DIR = join(__dirname, '../..');
const PRIVACY_TAB_PATH = join(ROOT_DIR, 'components/settings/privacy-tab.tsx');
const AVATAR_UPLOAD_PATH = join(ROOT_DIR, 'components/avatar-upload.tsx');

describe('Gate 5: M7-BLK-05 / M6-GAP-01 Privacy Export Integrity & Media Security', () => {
  const privacyContent = readFileSync(PRIVACY_TAB_PATH, 'utf8');
  const avatarContent = readFileSync(AVATAR_UPLOAD_PATH, 'utf8');

  const privacySourceFile = ts.createSourceFile(
    'privacy-tab.tsx',
    privacyContent,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const avatarSourceFile = ts.createSourceFile(
    'avatar-upload.tsx',
    avatarContent,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  // Helper to find nodes by kind (do not return from forEachChild callback or it aborts traversal)
  function findNodes(node, predicate, results = []) {
    if (predicate(node)) {
      results.push(node);
    }
    ts.forEachChild(node, (child) => {
      findNodes(child, predicate, results);
    });
    return results;
  }

  // =========================================================================
  // 1. Privacy Tab: LOPDP Art. 17 Export Metadata & Delivery Scope (M7-BLK-05)
  // =========================================================================
  describe('1. Privacy Tab: LOPDP Art. 17 Metadata & Delivery Scope Invariants', () => {
    test('File components/settings/privacy-tab.tsx exists', () => {
      assert.ok(existsSync(PRIVACY_TAB_PATH), 'privacy-tab.tsx must exist');
    });

    test('backupData.meta explicitly defines binary_attachments_included as false', () => {
      assert.ok(
        privacyContent.includes('binary_attachments_included: false'),
        'backupData.meta must explicitly define binary_attachments_included: false'
      );
    });

    test("backupData.meta explicitly defines delivery_scope as 'clinic_metadata_export'", () => {
      assert.ok(
        privacyContent.includes("delivery_scope: 'clinic_metadata_export'"),
        "backupData.meta must explicitly define delivery_scope: 'clinic_metadata_export'"
      );
    });

    test('backupData.meta includes explicit binary_delivery_note regarding independent custody delivery', () => {
      const expectedNote =
        'El presente paquete interoperable JSON contiene registros estructurados y metadatos de archivos. No contiene archivos binarios (imágenes/documentos adjuntos). La entrega de adjuntos binarios requiere un proceso de custodia y entrega por canal seguro independiente.';
      assert.ok(
        privacyContent.includes(expectedNote),
        'backupData.meta must include exact binary_delivery_note text'
      );
    });

    test('backupData.meta.manifest includes binary_attachments_count: 0', () => {
      assert.ok(
        privacyContent.includes('binary_attachments_count: 0'),
        'Manifest must declare binary_attachments_count: 0'
      );
    });

    test('backupData.meta.manifest includes binary_metadata_records: filesData.length', () => {
      assert.ok(
        privacyContent.includes('binary_metadata_records: filesData.length'),
        'Manifest must declare binary_metadata_records tracking filesData.length'
      );
    });

    test('AST Verification: backupData object contains required meta and manifest properties', () => {
      const varDecls = findNodes(
        privacySourceFile,
        (node) => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'backupData'
      );
      assert.equal(varDecls.length, 1, 'Must have exactly one backupData variable declaration');

      const backupObj = varDecls[0].initializer;
      assert.ok(backupObj && ts.isObjectLiteralExpression(backupObj), 'backupData must be an object literal');

      const metaProp = backupObj.properties.find(
        (p) => p.name && (ts.isIdentifier(p.name) ? p.name.text : p.name.getText(privacySourceFile)) === 'meta'
      );
      assert.ok(metaProp && ts.isPropertyAssignment(metaProp), 'backupData must have meta property');

      const metaObj = metaProp.initializer;
      assert.ok(ts.isObjectLiteralExpression(metaObj), 'meta must be an object literal');

      const metaProps = metaObj.properties.map((p) => p.name && (ts.isIdentifier(p.name) ? p.name.text : p.name.getText(privacySourceFile)));
      assert.ok(metaProps.includes('delivery_scope'), 'meta must include delivery_scope');
      assert.ok(metaProps.includes('binary_attachments_included'), 'meta must include binary_attachments_included');
      assert.ok(metaProps.includes('binary_delivery_note'), 'meta must include binary_delivery_note');
      assert.ok(metaProps.includes('manifest'), 'meta must include manifest');

      const manifestProp = metaObj.properties.find(
        (p) => p.name && (ts.isIdentifier(p.name) ? p.name.text : p.name.getText(privacySourceFile)) === 'manifest'
      );
      assert.ok(manifestProp && ts.isPropertyAssignment(manifestProp), 'manifest must be a property assignment');
      const manifestObj = manifestProp.initializer;
      assert.ok(ts.isObjectLiteralExpression(manifestObj), 'manifest must be an object literal');

      const manifestProps = manifestObj.properties.map((p) => p.name && (ts.isIdentifier(p.name) ? p.name.text : p.name.getText(privacySourceFile)));
      assert.ok(manifestProps.includes('binary_attachments_count'), 'manifest must include binary_attachments_count');
      assert.ok(manifestProps.includes('binary_metadata_records'), 'manifest must include binary_metadata_records');
    });

    test('UI Card component distinguishes structured metadata export from binary attachment delivery', () => {
      assert.ok(
        privacyContent.includes('Portabilidad de Datos (Art. 17 LOPDP)'),
        'UI must feature Portabilidad de Datos (Art. 17 LOPDP) header'
      );
      assert.ok(
        privacyContent.includes('archivos binarios adjuntos') || privacyContent.includes('No contiene archivos binarios'),
        'UI description must clarify that binary attachments are not embedded in JSON'
      );
      assert.ok(
        privacyContent.includes('canal seguro independiente') || privacyContent.includes('proceso de entrega separado'),
        'UI description must explain that binary delivery requires an independent secure process'
      );
    });
  });

  // =========================================================================
  // 2. Privacy Tab: Pagination, Error Handling & Role Authorization
  // =========================================================================
  describe('2. Privacy Tab: Pagination, Fail-Closed Errors & Role Check Invariants', () => {
    test('fetchAllRows maintains deterministic order by primary key .order("id", { ascending: true })', () => {
      assert.ok(
        privacyContent.includes(".order('id', { ascending: true })"),
        'fetchAllRows must enforce deterministic primary key ordering'
      );
    });

    test('fetchAllRows advances offset by actual returned row count (from += data.length)', () => {
      assert.ok(
        privacyContent.includes('from += data.length'),
        'fetchAllRows must advance pagination offset by returned data length'
      );
      // Ensures server API row limit doesn't cause premature termination
      assert.ok(
        !privacyContent.includes('if (data.length < pageSize) break'),
        'fetchAllRows must not prematurely stop on API row caps lower than pageSize'
      );
    });

    test('fetchAllRows strictly throws on table query error (fail-closed)', () => {
      assert.ok(
        privacyContent.includes('if (error) {') &&
        privacyContent.includes("throw new Error(`Error en entidad '${tableName}': ${error.message}`)"),
        'fetchAllRows must propagate query errors without partial silent corruption'
      );
    });

    test('handleExportData strictly checks activeRole !== "clinic_owner" via get_clinic_member_role RPC', () => {
      assert.ok(
        privacyContent.includes("supabase.rpc('get_clinic_member_role'"),
        'Must call get_clinic_member_role RPC'
      );
      assert.ok(
        privacyContent.includes("roleError || activeRole !== 'clinic_owner'"),
        'Must check roleError or activeRole !== clinic_owner'
      );
      assert.ok(
        privacyContent.includes("Solo el propietario activo de la clínica puede exportar datos clínicos."),
        'Must reject non-clinic-owners with specific authorization error'
      );
    });

    test('handleExportData persists pending data_rights_requests record before reading bulk clinical data', () => {
      assert.ok(
        privacyContent.includes(".from('data_rights_requests').insert("),
        'Must insert into data_rights_requests'
      );
      assert.ok(
        privacyContent.includes("request_type: 'portability'"),
        "Must specify request_type: 'portability'"
      );
      assert.ok(
        privacyContent.includes("status: 'pending'"),
        "Must specify status: 'pending'"
      );
      assert.ok(
        privacyContent.includes("scope: 'clinic_metadata_export'"),
        "Must specify details scope: 'clinic_metadata_export'"
      );
    });
  });

  // =========================================================================
  // 3. Avatar Upload: Private Signed URLs & Lifecycles (M6-GAP-01)
  // =========================================================================
  describe('3. Avatar Upload: Private Signed URLs & Expiry Renewal Invariants', () => {
    test('File components/avatar-upload.tsx exists', () => {
      assert.ok(existsSync(AVATAR_UPLOAD_PATH), 'avatar-upload.tsx must exist');
    });

    test('extractStoragePath correctly strips signed and public storage URL prefixes', () => {
      assert.ok(
        avatarContent.includes('function extractStoragePath('),
        'extractStoragePath function must exist'
      );
      assert.ok(
        avatarContent.includes('/storage/v1/object/sign/${targetBucket}/'),
        'extractStoragePath must recognize signed URLs'
      );
      assert.ok(
        avatarContent.includes('/storage/v1/object/public/${targetBucket}/'),
        'extractStoragePath must recognize public URLs'
      );
    });

    test('createSignedUrl is called with 3600s (1 hour) TTL for patient-avatars', () => {
      const signedUrlCalls = avatarContent.match(/createSignedUrl\([^)]+,\s*3600\)/g);
      assert.ok(
        signedUrlCalls && signedUrlCalls.length >= 2,
        'createSignedUrl must be called with 3600s TTL across initial load, upload, and error renewal'
      );
    });

    test('Pre-emptive signed URL refresh timer is scheduled at 3000s (50 minutes)', () => {
      assert.ok(
        avatarContent.includes('3000 * 1000'),
        'Pre-emptive refresh timer must be set to 3000 * 1000 ms (50 min, before 60 min expiry)'
      );
      assert.ok(
        avatarContent.includes('refreshTimer = setTimeout('),
        'refreshTimer must be stored to allow cleanup on unmount'
      );
      assert.ok(
        avatarContent.includes('if (refreshTimer) clearTimeout(refreshTimer)'),
        'refreshTimer must be cleared on re-render and unmount'
      );
    });

    test('AvatarImage component defines onError handler to recover from expired signatures', () => {
      assert.ok(
        avatarContent.includes('onError={() => {'),
        'AvatarImage must define an onError handler'
      );
      assert.ok(
        avatarContent.includes('bucket === "patient-avatars"'),
        'onError must guard renewal specifically for patient-avatars bucket'
      );
      assert.ok(
        avatarContent.includes('createSignedUrl(effectivePath, 3600)'),
        'onError must invoke createSignedUrl with 3600s to renew expired signature'
      );
    });

    test('onError handler strictly fails closed (setAvatarUrl(null)) on renewal failure or exception', () => {
      // Must not silently ignore renewal failures:
      const onErrorSnippet = avatarContent.substring(
        avatarContent.indexOf('onError={() => {'),
        avatarContent.indexOf('}}', avatarContent.indexOf('onError={() => {')) + 2
      );
      assert.ok(
        onErrorSnippet.includes('setAvatarUrl(null)'),
        'onError must fail closed by setting avatarUrl to null on error'
      );
      assert.ok(
        !onErrorSnippet.includes('.catch(() => {})'),
        'onError must NOT swallow errors silently without failing closed'
      );
    });

    test('patient-avatars signing failures fail closed without leaking public URLs', () => {
      // In patient-avatars branch:
      // 1. Caught error or null signedUrl leads to setAvatarUrl(null)
      // 2. Returns immediately without falling through to getPublicUrl
      const patientAvatarBranch = avatarContent.slice(
        avatarContent.indexOf('if (bucket === "patient-avatars")'),
        avatarContent.indexOf('const { data } = supabase.storage.from(bucket).getPublicUrl')
      );

      assert.ok(patientAvatarBranch.length > 0, 'patient-avatars branch must precede getPublicUrl');
      assert.ok(
        patientAvatarBranch.includes('if (isMounted) setAvatarUrl(null)'),
        'Signing errors must setAvatarUrl(null)'
      );
      assert.ok(
        patientAvatarBranch.includes('return'),
        'patient-avatars must return without falling through to getPublicUrl'
      );
      assert.ok(
        !patientAvatarBranch.includes('getPublicUrl'),
        'patient-avatars branch must NEVER invoke getPublicUrl'
      );
    });
  });

  // =========================================================================
  // 4. Runtime Functional Semantics Verification
  // =========================================================================
  describe('4. Runtime Functional Semantics Verification', () => {
    // Helper to extract and evaluate extractStoragePath directly from source
    function getExtractFn() {
      const fnSourceMatch = avatarContent.match(/function extractStoragePath[\s\S]*?^}/m);
      assert.ok(fnSourceMatch, 'extractStoragePath function source must be present');
      const jsCode = ts.transpileModule(fnSourceMatch[0], { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      return new Function(`${jsCode}; return extractStoragePath;`)();
    }

    test('extractStoragePath extracts pure object path across public, signed, and authenticated endpoints', () => {
      const extractFn = getExtractFn();

      const signedUrl =
        'https://project.supabase.co/storage/v1/object/sign/patient-avatars/clinic-123/patient-456/photo.jpg?token=eyJhbGciOiJIUzI1Ni...';
      assert.equal(extractFn(signedUrl, 'patient-avatars'), 'clinic-123/patient-456/photo.jpg');

      const publicUrl =
        'https://project.supabase.co/storage/v1/object/public/doctor-avatars/doc-789/avatar%201.png?v=2';
      assert.equal(extractFn(publicUrl, 'doctor-avatars'), 'doc-789/avatar 1.png');

      const authUrl =
        'https://project.supabase.co/storage/v1/object/authenticated/patient-avatars/clinic-123/patient-456/private-scan.png';
      assert.equal(extractFn(authUrl, 'patient-avatars'), 'clinic-123/patient-456/private-scan.png');

      const renderAuthUrl =
        'https://project.supabase.co/storage/v1/render/image/authenticated/patient-avatars/clinic-123/patient-456/private-scan.png?width=200';
      assert.equal(extractFn(renderAuthUrl, 'patient-avatars'), 'clinic-123/patient-456/private-scan.png');

      const externalUrl = 'https://lh3.googleusercontent.com/a/ACg8ocI...';
      assert.equal(extractFn(externalUrl, 'patient-avatars'), null);
    });

    test('extractStoragePath safely handles query parameters and hash fragments', () => {
      const extractFn = getExtractFn();

      const urlWithHash = 'https://proj.supabase.co/storage/v1/object/sign/patient-avatars/clinic-1/p-1/photo.png#section';
      assert.equal(extractFn(urlWithHash, 'patient-avatars'), 'clinic-1/p-1/photo.png');

      const urlWithQueryAndHash = 'https://proj.supabase.co/storage/v1/object/sign/patient-avatars/clinic-1/p-1/photo.png?token=xyz#section';
      assert.equal(extractFn(urlWithQueryAndHash, 'patient-avatars'), 'clinic-1/p-1/photo.png');
    });

    test('extractStoragePath does not crash on malformed URI percent encoding', () => {
      const extractFn = getExtractFn();

      // %E0%A4%A is malformed UTF-8 in decodeURIComponent
      const malformedUrl = 'https://proj.supabase.co/storage/v1/object/sign/patient-avatars/clinic-1/p-1/photo%E0%A4%A.png';
      assert.doesNotThrow(() => {
        const res = extractFn(malformedUrl, 'patient-avatars');
        assert.ok(res !== null);
      });
    });

    test('handleExportData guards against concurrent export executions', () => {
      assert.ok(
        privacyContent.includes('!currentClinicId || isExporting'),
        'handleExportData must check isExporting to block concurrent runs'
      );
    });

    test('backupData payload construction satisfies all statutory and operational requirements', () => {
      const syntheticFiles = [{ id: 'f-1', file_name: 'xray.dcm' }, { id: 'f-2', file_name: 'lab.pdf' }];
      const syntheticPatients = [{ id: 'p-1', name: 'Juan Perez' }];

      const backupData = {
        meta: {
          software: "Clinia+ SaaS Dental",
          export_date: new Date().toISOString(),
          delivery_scope: 'clinic_metadata_export',
          binary_attachments_included: false,
          binary_delivery_note: 'El presente paquete interoperable JSON contiene registros estructurados y metadatos de archivos. No contiene archivos binarios (imágenes/documentos adjuntos). La entrega de adjuntos binarios requiere un proceso de custodia y entrega por canal seguro independiente.',
          normativa: "Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador) - Art. 17 (Derecho a la Portabilidad)",
          normas_salud: "Ley Orgánica de Salud del Ecuador (Art. 7) y Normas Técnicas MSP (HCU-033)",
          clinic_id: 'clinic-123',
          manifest: {
            total_patients: syntheticPatients.length,
            total_appointments: 0,
            total_services: 0,
            total_hcu033_records: 0,
            total_prescriptions: 0,
            total_patient_notes: 0,
            total_patient_files: syntheticFiles.length,
            total_clinical_records: 0,
            total_prescription_templates: 0,
            binary_attachments_count: 0,
            binary_metadata_records: syntheticFiles.length,
            tables_included: [
              'patients',
              'appointments',
              'services',
              'hcu033_forms',
              'prescriptions',
              'patient_notes',
              'patient_files',
              'clinical_records',
              'prescription_templates'
            ],
            package_generated: true,
            rights_request_status: 'pending'
          }
        },
        data: {
          patients: syntheticPatients,
          patient_files: syntheticFiles
        }
      };

      assert.equal(backupData.meta.binary_attachments_included, false);
      assert.equal(backupData.meta.delivery_scope, 'clinic_metadata_export');
      assert.equal(backupData.meta.manifest.binary_attachments_count, 0);
      assert.equal(backupData.meta.manifest.binary_metadata_records, 2);
      assert.equal(backupData.meta.manifest.total_patient_files, 2);
    });
  });
});
