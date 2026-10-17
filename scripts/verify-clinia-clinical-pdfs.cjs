// Synthetic-only document QA. Uses the installed PDF engine, never Supabase.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const ts = require('typescript')
const jspdf = require('jspdf')
const { prescriptionPdfFromReceipt } = require('../lib/prescription-receipt.mjs')

const output = path.resolve(process.argv[2] || 'docs/production/evidence/2026-10-03-clinical-pdf/candidate')
fs.mkdirSync(output, { recursive: true })
let documentName
const documents = []
function RealPDF(...args) {
  const doc = new jspdf.jsPDF(...args)
  doc.save = () => {
    const bytes = Buffer.from(doc.output('arraybuffer'))
    fs.writeFileSync(path.join(output, documentName), bytes)
    documents.push({ name: documentName, bytes: bytes.length, pages: doc.getNumberOfPages(), sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
  }
  return doc
}
const source = fs.readFileSync(path.resolve('lib/pdf-generator.ts'), 'utf8')
const mod = { exports: {} }
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
vm.runInNewContext(compiled, { module: mod, exports: mod.exports, Date, console, require(name) {
  if (name === 'jspdf') return { __esModule: true, default: RealPDF }
  if (name === 'jspdf-autotable') return require(name)
  throw Error(name)
} })

const ids = ['880e8400-e29b-41d4-a716-446655440000','880e8400-e29b-41d4-a716-446655440001','880e8400-e29b-41d4-a716-446655440002','880e8400-e29b-41d4-a716-446655440003']
function receipt(boundary = false) {
  return { id: ids[0], clinic_id: ids[1], patient_id: ids[2], doctor_id: ids[3], issuance_snapshot: {
    version: 1, prescription_id: ids[0], clinic_id: ids[1], patient_id: ids[2], doctor_id: ids[3],
    issued_at: '2026-10-02T02:00:00+00:00',
    clinic: { name: 'CLINICA SINTETICA - SIN PACIENTES REALES', address: 'DIRECCION SINTETICA', phone: '' },
    patient: { name: 'MARIA JOSE DE LA CRUZ SINTETICA', identification: 'QA-SINTETICO' },
    doctor: { name: 'AUTOR SINTETICO', specialization: '', license_number: '' },
    medications: Array.from({ length: boundary ? 20 : 1 }, (_, i) => ({ name: `MEDICAMENTO_QA_${i + 1} sin uso clinico`, dosage: 'DOSIS_QA sin instruccion medica', duration: 'DURACION_QA' })),
    indications: boundary ? ('INDICACION_QA sin uso medico. '.repeat(66) + 'FIN_INDICACIONES_QA') : 'INDICACION_QA sin uso medico.',
  } }
}
documentName = 'receta-sintetica.pdf'
mod.exports.generatePrescription(prescriptionPdfFromReceipt(receipt()))
documentName = 'receta-limite-sintetica.pdf'
mod.exports.generatePrescription(prescriptionPdfFromReceipt(receipt(true)))
documentName = 'hcu-sintetica.pdf'
mod.exports.generateHCU033({
  establecimiento: 'CLINICA SINTETICA', unicodigo: 'QA', historia_numero: 'QA-HCU',
  nombre_completo: 'MARIA JOSE DE LA CRUZ SINTETICA', identificacion: 'QA-SINTETICO', sexo: 'F', edad: '12',
  fecha_nacimiento: '2014-01-01', responsable: 'REPRESENTANTE_SINTETICO',
  motivo_consulta: 'MOTIVO_QA '.repeat(150) + 'FIN_MOTIVO_QA', enfermedad_actual: 'ENFERMEDAD_QA', ant_asma: false,
  ant_otros: 'ALERGIA_QA', odontograma_descripcion: 'OBS_ODONTOGRAMA_QA',
  odontograma_data: { 48: { surfaces: { top: 'sealant:blue' }, condition: 'extraction', status: 'completed', recesion: '2', movilidad: '1', notes: 'NOTA_PIEZA_QA', bridge: { type: 'fixed', start: 48, end: 45, status: 'completed' } },
    31: { surfaces: { center: 'caries:blue' } }, 85: { surfaces: { center: 'caries:red' } } },
  indicadores_higiene: [{ piezas: ['16','17','55'], placa: '1', calculo: '2', gingivitis: '3' }],
  indices_cpo: { c: 2, p: 1, o: 3, total: 6 }, indices_ceo: { c: 1, e: 2, o: 1, total: 4 },
  diagnosticos: [{ codigo: 'QA-CIE', descripcion: 'DIAGNOSTICO_QA', clinico: 'CLINICO_QA', fecha: '2026-10-01' },
    { codigo: 'QA-CIE-2', descripcion: 'DIAGNOSTICO_PRESUNTIVO_QA', tipo: 'presuntivo', fecha: '2026-10-01' }],
  plan_diagnostico: ['rx_periapical'],
  plan_terapeutico: [{ sesion: 1, fecha: '2026-10-01', procedimiento: 'PLAN_QA_NO_REALIZADO', dientes_involucrados: '48', observaciones: 'OBS_PLAN_QA' }],
  registro_sesiones: [{ fecha: '2026-10-02T10:00', procedimiento: 'SESION_QA_REALIZADA', codigo: 'CODIGO_QA', medicamentos: 'MEDICACION_SESION_QA', profesional: 'PROFESIONAL_SESION_QA', observaciones: 'OBS_SESION_QA' }],
  observaciones_finales: 'OBS_FINAL_QA', consentimiento_informado: true, firma_profesional: null,
  export_metadata: { id: ids[0], clinic_id: ids[1], patient_id: ids[2], doctor_id: ids[3], created_at: '2026-10-02T18:00:00+00:00' },
})
const sources = Object.fromEntries(['lib/pdf-generator.ts','lib/pdf-client.ts','lib/prescription-receipt.mjs','components/hcu033-form.tsx','scripts/verify-clinia-clinical-pdfs.cjs'].map(file => [file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
const manifest = { syntheticOnly: true, engine: 'installed real jsPDF + jspdf-autotable', sourceSha256: sources['lib/pdf-generator.ts'], sources, documents }
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(manifest, null, 2))
