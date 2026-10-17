import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { OperationalReport } from "@/lib/operational-reports.mjs"

interface ReportData {
  period: string
  generatedAt: string
  summary: OperationalReport["summary"]
  monthlyStats: OperationalReport["monthly"]
  treatments: OperationalReport["treatments"]
}

export function generateReportPDF(data: ReportData) {
  const doc = new jsPDF()
  const width = doc.internal.pageSize.width
  doc.setFontSize(17)
  doc.text("Informe de pacientes y agenda — Clinia+", width / 2, 20, { align: "center" })
  doc.setFontSize(9)
  doc.text(`Generado: ${data.generatedAt} (Ecuador)`, 14, 30)
  doc.text(`Período: ${data.period}`, 14, 36)
  autoTable(doc, {
    startY: 44,
    head: [["Indicador", "Resultado"]],
    body: [
      ["Citas del período", data.summary.appointments],
      ["Pacientes activos actuales", data.summary.activePatients],
      ["Pacientes nuevos del período", data.summary.newPatients],
      ["Citas completadas", data.summary.completed],
      ["No asistió", data.summary.noShow],
      ["Canceladas", data.summary.cancelled],
      ["Asistencia: completadas / (completadas + no asistió)", data.summary.attendanceRate === null ? "Sin citas cerradas" : `${data.summary.attendanceRate}%`],
    ],
    headStyles: { fillColor: [20, 82, 71] }, styles: { fontSize: 9 },
  })
  const finalY = () => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  autoTable(doc, {
    startY: finalY() + 12,
    head: [["Mes", "Citas del período", "Pacientes nuevos"]],
    body: data.monthlyStats.map(row => [row.month, row.appointments, row.newPatients]),
    headStyles: { fillColor: [20, 82, 71] }, styles: { fontSize: 9 },
  })
  if (data.treatments.length) autoTable(doc, {
    startY: finalY() + 12,
    head: [["Tipos de cita más frecuentes", "Citas"]],
    body: data.treatments.map(row => [row.name, row.count]),
    headStyles: { fillColor: [20, 82, 71] }, styles: { fontSize: 9 },
  })
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(100)
    doc.text("Uso interno de la clínica", 14, 290)
    doc.text(`Página ${page} de ${pages}`, width - 14, 290, { align: "right" })
  }
  doc.save("Informe_Clinia.pdf")
}
