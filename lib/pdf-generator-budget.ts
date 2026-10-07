import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { fetchPrivateMedia } from '@/lib/private-media-client.mjs'

interface TreatmentItem {
  name: string
  description?: string
  price: number
}

interface BudgetData {
  clinicId: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicLogoPath?: string | null
  patientName: string
  patientId: string
  date: string
  items: TreatmentItem[]
  total: number
  disclaimer: string
}

export async function generateBudgetPDF(data: BudgetData, signal: AbortSignal = AbortSignal.timeout(20000), isCurrent: () => boolean = () => !signal.aborted) {
  if (!isCurrent() || signal.aborted) throw new Error('Export canceled')
  const doc = new jsPDF()

  // 1. Header (Logo & Clinic Info)
  let yPos = 20

  // Try to fetch logo if available
  if (data.clinicLogoPath) {
    try {
      const logoData = await fetchPrivateMedia({ kind: 'clinic-logo', clinicId: data.clinicId, entityId: data.clinicId }, signal, isCurrent)
      
      if (logoData && isCurrent()) {
        const base64 = await blobToBase64(logoData)
        if (!isCurrent() || signal.aborted) throw new Error('Export canceled')
        const props = doc.getImageProperties(base64)
        const width = 30
        const height = (props.height * width) / props.width
        const format = logoData.type === 'image/jpeg' ? 'JPEG' : logoData.type === 'image/webp' ? 'WEBP' : 'PNG'
        doc.addImage(base64, format, 14, yPos - 5, width, height)
      }
    } catch (e) {
      console.warn("Could not load clinic logo for PDF", e)
    }
  }

  // Clinic Details (Right Aligned or Centered next to logo)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(data.clinicName, 195, yPos, { align: "right" })
  
  yPos += 7
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  if (data.clinicAddress) {
      doc.text(data.clinicAddress, 195, yPos, { align: "right" })
      yPos += 5
  }
  if (data.clinicPhone) {
      doc.text(`Tel: ${data.clinicPhone}`, 195, yPos, { align: "right" })
      yPos += 5
  }
  if (data.clinicEmail) {
      doc.text(data.clinicEmail, 195, yPos, { align: "right" })
      yPos += 5
  }

  // Divider
  yPos += 5
  doc.setDrawColor(200)
  doc.line(14, yPos, 196, yPos)
  yPos += 10

  // 2. Patient & Budget Info
  doc.setTextColor(0)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Presupuesto Estimado", 14, yPos)
  
  yPos += 10
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  
  doc.text(`Paciente: ${data.patientName}`, 14, yPos)
  doc.text(`Fecha: ${data.date}`, 140, yPos)
  yPos += 5
  doc.text(`ID: ${data.patientId}`, 14, yPos)

  yPos += 10

  // 3. Table of Treatments
  const tableBody: (string | number)[][] = data.items.map(item => [
    item.name,
    item.description || "",
    `$${item.price.toFixed(2)}`
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: yPos,
    head: [["Tratamiento", "Descripción", "Precio"]],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [20, 184, 166] }, // Teal-500 equivalent
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' }
    },
    foot: [['', 'Total Estimado', `$${data.total.toFixed(2)}`]],
    footStyles: { fillColor: [240, 253, 250], textColor: [0, 0, 0], fontStyle: 'bold' } // Teal-50 equivalent
  })

  // Get final Y position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 20

  // 4. Disclaimer
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text("Términos y Condiciones:", 14, finalY)
  
  const splitText = doc.splitTextToSize(data.disclaimer, 180)
  doc.text(splitText, 14, finalY + 5)

  // Save PDF
  if (!isCurrent() || signal.aborted) throw new Error('Export canceled')
  doc.save(`Presupuesto_${data.patientName.replace(/\s+/g, '_')}_${data.date}.pdf`)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Image conversion failed'))
    reader.readAsDataURL(blob)
  })
}
