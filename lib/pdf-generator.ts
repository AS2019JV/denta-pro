import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// MSP Form Colors
const COLORS = {
  HEADER_BG: [198, 239, 206], // Light green for main section headers
  SUBHEADER_BG: [240, 240, 240], // Light grey for sub-headers
  BORDER: [0, 0, 0], // Black borders
  TEXT: [0, 0, 0]
};

export const generateHCU033 = (data: any) => {
  // A4 Size: 210mm x 297mm
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  // --- HELPERS ---
  
  const setFont = (type: 'bold' | 'normal' | 'small' = 'normal') => {
    doc.setFont('helvetica', type === 'small' ? 'normal' : type);
    doc.setFontSize(type === 'small' ? 6 : type === 'bold' ? 7 : 7);
  };

  const drawRect = (x: number, y: number, w: number, h: number, color?: number[]) => {
    if (color) {
      // @ts-ignore
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, y, w, h, 'FD'); // Fill and Draw
    } else {
      doc.rect(x, y, w, h);
    }
  };

  const drawSectionHeader = (number: string, title: string, x: number, y: number, w: number) => {
    drawRect(x, y, w, 5, COLORS.HEADER_BG);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${number} ${title}`, x + 2, y + 3.5);
    return y + 5;
  };

  const drawFieldBox = (label: string, value: string, x: number, y: number, w: number, h: number) => {
    drawRect(x, y, w, h);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 1, y + 2.5); // Label top-left
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    // Center value or align left depending on width
    if (value) {
        doc.text(String(value).substring(0, w/1.5).toUpperCase(), x + 2, y + h - 1.5);
    }
  };
  
  const drawCheckbox = (label: string, checked: boolean, x: number, y: number, w: number) => {
      doc.rect(x + w - 4, y + 0.5, 3, 3); // Checkbox square
      if (checked) {
          doc.setFontSize(8);
          doc.text('X', x + w - 3.2, y + 2.8);
      }
      doc.setFontSize(6);
      doc.text(label, x, y + 3);
  };

  // --- PAGE 1 ---

  let y = margin;

  // HEADER (Institution info)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIA CLINICA ODONTOLOGICA', pageWidth / 2, y, { align: 'center' });
  doc.setFontSize(7);
  doc.text('MINISTERIO DE SALUD PUBLICA', pageWidth / 2, y + 4, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('033', pageWidth - 20, y + 4); // Form Code
  
  y += 8;

  // 1. DATOS DEL ESTABLECIMIENTO
  drawSectionHeader('1', 'DATOS DEL ESTABLECIMIENTO Y USUARIO / PACIENTE', margin, y, contentWidth);
  y += 5;
  
  // Row 1: Institucion, Unicodigo, Est, Parroquia, Canton, Provincia
  const row1H = 8;
  drawFieldBox('INSTITUCION DEL SISTEMA', 'Privado', margin, y, 40, row1H);
  drawFieldBox('UNICODIGO', data.unicodigo, margin+40, y, 30, row1H);
  drawFieldBox('ESTABLECIMIENTO', data.establecimiento, margin+70, y, 50, row1H);
  drawFieldBox('NUMERO DE HISTORIA CLINICA', data.historia_numero, margin+120, y, contentWidth-120, row1H);
  y += row1H;
  
  // Row 2: Patient Name
  const row2H = 8;
  const names = data.nombre_completo.split(' ');
  drawFieldBox('PRIMER APELLIDO', names[0] || '', margin, y, 47.5, row2H);
  drawFieldBox('SEGUNDO APELLIDO', names[1] || '', margin+47.5, y, 47.5, row2H);
  drawFieldBox('PRIMER NOMBRE', names[2] || '', margin+95, y, 47.5, row2H);
  drawFieldBox('SEGUNDO NOMBRE', names[3] || '', margin+142.5, y, 47.5, row2H);
  y += row2H;

  // Row 3: Demographics
  const row3H = 8;
  drawFieldBox('SEXO (H/M)', data.sexo?.substring(0,1), margin, y, 20, row3H);
  drawFieldBox('EDAD', data.edad, margin+20, y, 15, row3H);
  drawFieldBox('FECHA NACIMIENTO', data.fecha_nacimiento, margin+35, y, 25, row3H);
  drawFieldBox('LUGAR NACIMIENTO', '', margin+60, y, 40, row3H); // Placeholder
  drawFieldBox('CEDULA DE CIUDADANIA', data.identificacion, margin+100, y, 30, row3H);
  drawFieldBox('NACIONALIDAD', 'Ecuatoriana', margin+130, y, 30, row3H);
  drawFieldBox('GRUPO CULTURAL', '', margin+160, y, 30, row3H);
  y += row3H + 2;

  // 2. MOTIVO DE CONSULTA
  y = drawSectionHeader('2', 'MOTIVO DE CONSULTA', margin, y, contentWidth);
  drawRect(margin, y, contentWidth, 8);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(data.motivo_consulta || '', margin + 2, y + 4);
  y += 10;

  // 3. ENFERMEDAD ACTUAL
  y = drawSectionHeader('3', 'ENFERMEDAD O PROBLEMA ACTUAL', margin, y, contentWidth);
  drawRect(margin, y, contentWidth, 16); // Bigger box
  doc.text(doc.splitTextToSize(data.enfermedad_actual || '', contentWidth - 4), margin + 2, y + 4);
  y += 18;

  // 4. ANTECEDENTES
  y = drawSectionHeader('4', 'ANTECEDENTES PERSONALES Y FAMILIARES', margin, y, contentWidth);
  const antH = 20;
  drawRect(margin, y, contentWidth, antH);
  
  // Create a grid of checkboxes
  const antCols = [
      { l: 'Alergia Antibiotico', k: 'ant_alergia_antibioticos' },
      { l: 'Alergia Anestesia', k: 'ant_alergia_anestesia' },
      { l: 'Hemorragias', k: 'ant_hemorragias' },
      { l: 'VIH/SIDA', k: 'ant_vih' },
      { l: 'Tuberculosis', k: 'ant_tuberculosis' },
      { l: 'Asma', k: 'ant_asma' },
      { l: 'Diabetes', k: 'ant_diabetes' },
      { l: 'Hipertension', k: 'ant_hipertension' },
      { l: 'Enf. Cardiaca', k: 'ant_enf_cardiaca' },
      { l: 'Otros', k: 'ant_otros_bool' } // dummy
  ];
  
  let colX = margin + 2;
  let rowY = y + 2;
  const colW = 35;
  
  antCols.forEach((item, i) => {
      if (i === 5) { colX = margin + 2; rowY += 6; } // New row after 5 items
      drawCheckbox(item.l, !!data[item.k], colX, rowY, 30);
      colX += colW;
  });
  
  // Text area for 'Otros' description
  doc.text('Observaciones: ' + (data.ant_otros || ''), margin + 2, y + 16);
  y += antH + 2;

  // 5. SIGNOS VITALES
  y = drawSectionHeader('5', 'SIGNOS VITALES', margin, y, contentWidth);
  const svW = contentWidth / 4;
  drawFieldBox('PRESION ARTERIAL', data.sv_presion_arterial, margin, y, svW, 8);
  drawFieldBox('FRECUENCIA CARDIACA', data.sv_fc, margin+svW, y, svW, 8);
  drawFieldBox('TEMPERATURA', data.sv_temp, margin+svW*2, y, svW, 8);
  drawFieldBox('FRECUENCIA RESPIRATORIA', data.sv_fr, margin+svW*3, y, svW, 8);
  y += 10;

  // 6. EXAMEN DEL SISTEMA ESTOMATOGNATICO
  y = drawSectionHeader('6', 'EXAMEN DEL SISTEMA ESTOMATOGNATICO', margin, y, contentWidth);
  const exH = 25;
  drawRect(margin, y, contentWidth, exH);
  
  const exItems = [
      { l: '1. Labios', v: data.ex_labios },
      { l: '2. Mejillas', v: data.ex_mejillas },
      { l: '3. Maxilar Superior', v: '' },
      { l: '4. Maxilar Inferior', v: '' },
      { l: '5. Lengua', v: data.ex_lengua },
      { l: '6. Paladar', v: data.ex_paladar },
      { l: '7. Piso', v: data.ex_piso_boca },
      { l: '8. Carrillos', v: data.ex_carrillos },
      { l: '9. Glandulas Salivales', v: '' },
      { l: '10. Orofaringe', v: '' },
      { l: '11. ATM', v: data.ex_articulacion },
      { l: '12. Ganglios', v: data.ex_ganglios }
  ];

  colX = margin + 2;
  rowY = y + 2;
  exItems.forEach((item, i) => {
      if (i > 0 && i % 4 === 0) { colX = margin + 2; rowY += 5; }
      drawCheckbox(item.l, !!item.v, colX, rowY, 40);
      colX += 45;
  });
  
  // Description area
  doc.line(margin, y + 15, margin + contentWidth, y + 15);
  doc.setFontSize(6);
  doc.text('DESCRIPCION DE LA PATOLOGIA:', margin + 1, y + 18);
  const descExamen = exItems.filter(i => i.v).map(i => `${i.l}: ${i.v}`).join('. ');
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(descExamen, contentWidth - 20), margin + 35, y + 18);
  
  y += exH + 2;

  // 7. ODONTOGRAMA PLACEHOLDER
  // Since we cannot draw the complex svg, we create the frame
  y = drawSectionHeader('7', 'ODONTOGRAMA', margin, y, contentWidth);
  const odoH = 50;
  // Background color for odontograma area
  drawRect(margin, y, contentWidth, odoH, [240, 250, 255]); // Very light blue
  
  // Draw Recession/Mobility Grids (Simplified visual representation)
  const drawTeethRow = (label: string, startX: number, rowY: number) => {
      doc.setFontSize(5); doc.text(label, startX - 12, rowY + 2);
      for(let i=0; i<16; i++) {
          doc.rect(startX + (i*6), rowY, 5, 3);
      }
  };
  
  // Top
  drawTeethRow('RECESION', margin + 15, y + 2);
  drawTeethRow('MOVILIDAD', margin + 15, y + 5);
  
  // Bottom
  drawTeethRow('MOVILIDAD', margin + 15, y + 42);
  drawTeethRow('RECESION', margin + 15, y + 45);
  
  // Note
  doc.text('VER GRAFICO DIGITAL EN SISTEMA', margin + contentWidth/2, y + 25, { align: 'center' });
  
  y += odoH + 2;

  // 8. INDICADORES y 9. INDICES
  const halfW = contentWidth / 2;
  
  drawSectionHeader('8', 'INDICADORES DE SALUD BUCAL', margin, y, halfW - 2);
  drawSectionHeader('9', 'INDICES CPO-ceo', margin + halfW, y, halfW);
  
  y += 5;
  // HIERARCHY I
  // Hygiene Table
  if (data.indicadores_higiene) {
    autoTable(doc, {
        startY: y,
        head: [['Pza', 'Placa', 'Cal', 'Gin']],
        body: data.indicadores_higiene.map((h: any) => [h.piezas[0], h.placa, h.calculo, h.gingivitis]),
        theme: 'grid',
        styles: { fontSize: 5, cellPadding: 1 },
        margin: { left: margin },
        tableWidth: halfW - 2,
    });
  }
  
  // CPO Table (on the right)
  const cpoY = y;
  const cpoData = [
      ['D', 'C', 'P', 'O', 'Total'],
      ['CPO', data.indices_cpo?.c, data.indices_cpo?.p, data.indices_cpo?.o, data.indices_cpo?.total],
      ['ceo', data.indices_ceo?.c, data.indices_ceo?.e, data.indices_ceo?.o, data.indices_ceo?.total]
  ];
  
  autoTable(doc, {
      startY: cpoY,
      head: cpoData.slice(0,1),
      body: cpoData.slice(1),
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, minCellHeight: 8 },
      margin: { left: margin + halfW },
      tableWidth: halfW,
  });

  // --- NEW PAGE (PAGE 2) ---
  doc.addPage();
  y = margin;
  
  // 10. PLANES DE DIAGNOSTICO
  y = drawSectionHeader('10', 'PLANES DE DIAGNOSTICO, TERAPEUTICO Y EDUCACIONAL', margin, y, contentWidth);
  const planData = (data.plan_terapeutico || []).map((p: any) => [
       'Diagnostico', // Tipo placeholder
       p.procedimiento,
       p.sesion // Used as Indicaciones for now
  ]);
  
  // If list is empty fill rows
  while(planData.length < 5) planData.push(['','','']);
  
  autoTable(doc, {
      startY: y,
      head: [['TIPO', 'PLAN DE DIAGNOSTICO, TERAPEUTICO Y EDUCACIONAL', 'INDICACIONES']],
      body: planData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: COLORS.HEADER_BG, textColor: 0, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
  });
  
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 5;

  // 11. DIAGNOSTICOS
  y = drawSectionHeader('11', 'DIAGNOSTICOS PRESUNTIVOS Y DEFINITIVOS', margin, y, contentWidth);
  const diagData = (data.diagnosticos || []).map((d: any) => [
      d.id || (data.diagnosticos.indexOf(d) + 1),
      d.descripcion,
      d.codigo,
      'Def.' // Pre/Def placeholder
  ]);
  while(diagData.length < 3) diagData.push(['','','','']);

  autoTable(doc, {
      startY: y,
      head: [['No.', 'DIAGNOSTICO', 'CIE', 'PRE/DEF']],
      body: diagData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: COLORS.HEADER_BG, textColor: 0, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 } },
      margin: { left: margin, right: margin }
  });
  
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 5;
  
  // 12. TRATAMIENTO (SESSIONS)
  y = drawSectionHeader('12', 'TRATAMIENTO', margin, y, contentWidth);
  
  const sesionData = (data.plan_terapeutico || []).map((t: any) => [
      t.fecha,
      t.dientes_involucrados || '',
      t.procedimiento,
      t.codigo || '',
      '', // Firma placeholder
      t.sesion
  ]);
  // Fill page
  while(sesionData.length < 15) sesionData.push(['','','','','','']);
  
  autoTable(doc, {
      startY: y,
      head: [['FECHA', 'DIAGNOSTICO Y COMPLICACIONES', 'PROCEDIMIENTOS', 'CODIGO', 'FIRMA PROFESIONAL', 'PRESCRIPCION']],
      body: sesionData,
      theme: 'grid',
      styles: { fontSize: 8, minCellHeight: 8 },
      headStyles: { fillColor: COLORS.HEADER_BG, textColor: 0, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
  });

  // Footer / Signatures
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 15;
  
  doc.line(margin + 20, finalY, margin + 80, finalY);
  doc.text('FIRMA DEL PACIENTE', margin + 30, finalY + 4);
  
  doc.line(margin + 120, finalY, margin + 180, finalY);
  doc.text('FIRMA DEL PROFESIONAL', margin + 130, finalY + 4);
  
  // If digital signature exists
  if (data.firma_profesional) {
      try {
        doc.addImage(data.firma_profesional, 'PNG', margin + 135, finalY - 20, 30, 15);
      } catch (e) {
          console.error("Error adding signature image", e);
      }
  }

  // Save
  doc.save(`HCU033_${data.identificacion || 'Paciente'}.pdf`);
};
