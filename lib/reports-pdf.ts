import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReportData {
    period: string;
    generatedAt: string;
    summary: {
        revenue: number;
        appointments: number;
        patients: number;
        activePatients: number;
    };
    monthlyStats: any[];
    topPatients: any[];
}

export const generateReportPDF = (data: ReportData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Gestión - DentaPro', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el: ${data.generatedAt}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Período: ${data.period}`, pageWidth / 2, 33, { align: 'center' });

    // Summary Section
    let y = 45;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y, pageWidth - 28, 25, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen General', 20, y + 8);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // KPI Grid
    const kpis = [
        { label: 'Ingresos Totales', value: `$${data.summary.revenue.toLocaleString()}` },
        { label: 'Citas Totales', value: data.summary.appointments.toString() },
        { label: 'Pacientes Activos', value: data.summary.activePatients.toString() },
        { label: 'Nuevos Pacientes', value: data.summary.patients.toString() }
    ];
    
    let kpiX = 20;
    kpis.forEach(kpi => {
        doc.setFont('helvetica', 'bold');
        doc.text(kpi.value, kpiX, y + 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(kpi.label, kpiX, y + 23);
        doc.setFontSize(10);
        kpiX += 45;
    });

    y += 35;

    // Monthly Details Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle Mensual', 14, y);
    y += 5;

    autoTable(doc, {
        startY: y,
        head: [['Mes', 'Ingresos', 'Citas', 'Nuevos Pct.']],
        body: data.monthlyStats.map(stat => [
            stat.month,
            `$${stat.revenue.toLocaleString()}`,
            stat.appointments,
            stat.patients
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 }
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 15;

    // Attendance Ranking
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 5 - Asistencia de Pacientes', 14, y);
    y += 5;

    autoTable(doc, {
        startY: y,
        head: [['Paciente', 'Asistencias', 'Faltas', 'Cumplimiento']],
        body: data.topPatients.map(p => [
            `${p.first_name} ${p.last_name}`,
            p.attended,
            p.noShows,
            `${Math.round(p.rate)}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        styles: { fontSize: 9 }
    });

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    doc.setFontSize(8);
    doc.setTextColor(150);
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, 290, { align: 'right' });
        doc.text('Confidencial - Uso exclusivo interno', 14, 290);
    }

    doc.save(`Reporte_DentaPro_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
