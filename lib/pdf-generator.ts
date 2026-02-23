import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// MSP Form Colors
const COLORS: Record<string, [number, number, number]> = {
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

  // 7. ODONTOGRAMA GRAFICO
  y = drawSectionHeader('7', 'ODONTOGRAMA', margin, y, contentWidth);
  const odoH = 65; // Height for the graphical area
  
  // Background
  doc.setFillColor(240, 250, 255);
  doc.rect(margin, y, contentWidth, odoH, 'F');
  
  const QUADRANTS = {
      Q1: [18, 17, 16, 15, 14, 13, 12, 11],
      Q2: [21, 22, 23, 24, 25, 26, 27, 28],
      Q3: [48, 47, 46, 45, 44, 43, 42, 41],
      Q4: [31, 32, 33, 34, 35, 36, 37, 38],
      Q5: [55, 54, 53, 52, 51],
      Q6: [61, 62, 63, 64, 65],
      Q7: [85, 84, 83, 82, 81],
      Q8: [71, 72, 73, 74, 75]
  };

  const TOOTH_SIZE = 7;
  const GAP = 1;
  const CENTER_GAP = 5;
  const ROW_START_Y = y + 10;
  
  // Helper to parse color
  const getFillColor = (val: string | undefined): [number, number, number] | null => {
      if (!val) return null;
      // Check for explicit "color:red" or "caries" legacy
      if (val.includes('red') || val === 'caries') return [239, 68, 68]; // Red
      if (val.includes('blue') || val === 'restoration') return [59, 130, 246]; // Blue
      return null; // White/None
  };

  const drawTooth = (id: number, cx: number, cy: number, isDeciduous: boolean) => {
      const tData = data.odontograma_data?.[id] || {};
      const surfaces = tData.surfaces || {};
      const s = TOOTH_SIZE;
      const h = s / 2;
      
      // Coordinates relative to center (cx, cy)
      // Top-Left corner for Square logic
      const x = cx - h;
      const y = cy - h;

      const drawPoly = (pts: number[][], color: [number, number, number] | null) => {
          if (color) {
              doc.setFillColor(color[0], color[1], color[2]);
              // jsPDF lines: [x, y], [x, y]...
              // using 'f' for fill
              // doc.lines is vector based, cumbersome for polygons. doc.triangle is easier for triangles.
              // We construct path string "x y m ... f"
              let path = `${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} m`;
              for(let i=1; i<pts.length; i++) {
                  path += ` ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} l`;
              }
              path += ' f'; 
              // API hack for raw PDF ops or use triangle if 3 points
              if (pts.length === 3) {
                  doc.triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], 'F');
              } else {
                 // Fallback for rect/quad
                 // Just draw simple rects for now if complex? No, we need trapezoids.
                 // Use lines with 'fd' style? 
                 // Actually doc.lines expects segment lengths.
                 // Let's use `triangle` composition for Trapezoids.
                 // A trapezoid is 2 triangles.
                 // T1: p1, p2, p4. T2: p2, p3, p4.
                 if (pts.length === 4) {
                     doc.triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[3][0], pts[3][1], 'F');
                     doc.triangle(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1], 'F');
                 }
              }
          }
      };
      
      // Points for 5 surfaces (Square geometry)
      // Top Trapezoid: TL, TR, CenterR, CenterL
      // Center box: small rect in middle.
      // Standard representation: Diagonals. 
      // Top Tri: TL, TR, Center.
      
      const TL = [x, y];
      const TR = [x+s, y];
      const BR = [x+s, y+s];
      const BL = [x, y+s];
      const C = [cx, cy]; // Approximate center convergence for diagonals
      
      // 1. Fill Surfaces
      // TOP
      drawPoly([TL, TR, C], getFillColor(surfaces.top));
      // RIGHT
      drawPoly([TR, BR, C], getFillColor(surfaces.right));
      // BOTTOM
      drawPoly([BR, BL, C], getFillColor(surfaces.bottom));
      // LEFT
      drawPoly([BL, TL, C], getFillColor(surfaces.left));
      // CENTER
      const centerColor = getFillColor(surfaces.center);
      if (centerColor) {
          doc.setFillColor(centerColor[0], centerColor[1], centerColor[2]);
          if (isDeciduous) doc.circle(cx, cy, s/4, 'F');
          else doc.rect(cx - s/4, cy - s/4, s/2, s/2, 'F');
      }

      // 2. Draw Outlines
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      
      if (isDeciduous) {
          // Circle Shape
          doc.circle(cx, cy, s/2);
          // Internal lines (X)
          // We clip to circle? No, just draw lines inside approx 
          // 45deg: cos(45)*r. r=s/2. 
          const r = s/2;
          const d = r * 0.707;
          doc.line(cx - d, cy - d, cx + d, cy + d);
          doc.line(cx + d, cy - d, cx - d, cy + d);
          // Center Circle
          doc.setFillColor(255,255,255);
          if (!centerColor) doc.circle(cx, cy, s/4, 'F'); // Mask if empty
          doc.circle(cx, cy, s/4, 'S');
      } else {
          // Square Shape
          doc.rect(x, y, s, s);
          doc.line(x, y, x+s, y+s);
          doc.line(x+s, y, x, y+s);
          // Center Rect
          doc.setFillColor(255,255,255);
          if (!centerColor) doc.rect(cx - s/4, cy - s/4, s/2, s/2, 'F'); 
          doc.rect(cx - s/4, cy - s/4, s/2, s/2, 'S');
      }
      
      // 3. Labels (ID)
      doc.setFontSize(5); doc.setTextColor(0);
      doc.text(String(id), cx - 2, isDeciduous ? cy + s : cy + s - 9);

      // 4. Conditions (X for extraction, etc)
      if (tData.condition === 'extraction') {
           doc.setFontSize(10);
           doc.setTextColor(239, 68, 68);
           doc.text('X', cx - 2, cy + 2.5);
      }
      if (tData.condition === 'crown') {
          doc.setDrawColor(250, 168, 5); // Orange
          doc.setLineWidth(0.5);
          doc.circle(cx, cy, s/1.8);
          doc.setLineWidth(0.1); doc.setDrawColor(0);
      }
  };

  // LAYOUT
  // Top Row: Recesion, Movilidad, Vestibular Q1-Q2
  const centerX = margin + contentWidth / 2;
  const startX_Q1 = centerX - CENTER_GAP - (8 * (TOOTH_SIZE + GAP));
  const startX_Q2 = centerX + CENTER_GAP;
  
  // Q1 (18-11)
  QUADRANTS.Q1.forEach((id, i) => drawTooth(id, startX_Q1 + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 14, false));
  // Q2 (21-28)
  QUADRANTS.Q2.forEach((id, i) => drawTooth(id, startX_Q2 + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 14, false));
  
  // Deciduous Rows (Q5, Q6)
  // Centered under Q1, Q2 roughly. They have 5 teeth.
  const offsetDeciduous = 15; // Shift inward
  QUADRANTS.Q5.forEach((id, i) => drawTooth(id, startX_Q1 + offsetDeciduous + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 26, true));
  QUADRANTS.Q6.forEach((id, i) => drawTooth(id, startX_Q2 + offsetDeciduous + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 26, true));
  
  // Deciduous Rows (Q8, Q7) - Bottom
  QUADRANTS.Q8.forEach((id, i) => drawTooth(id, startX_Q1 + offsetDeciduous + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 38, true));
  QUADRANTS.Q7.forEach((id, i) => drawTooth(id, startX_Q2 + offsetDeciduous + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 38, true));

  // Permanent Rows (Q4, Q3) - Bottom
  QUADRANTS.Q4.forEach((id, i) => drawTooth(id, startX_Q1 + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 50, false));
  QUADRANTS.Q3.forEach((id, i) => drawTooth(id, startX_Q2 + i*(TOOTH_SIZE+GAP) + TOOTH_SIZE/2, y + 50, false));
  
  // Grids for Input (Recesion, Movilidad)
  // Simplified placeholders aligned with teeth would be best, but complex alignment.
  // We keep the grids at Top/Bottom margins of the section.
  
  const drawStatRow = (label: string, rowY: number, q_ids: number[], startX: number) => {
      doc.setFontSize(4); doc.setTextColor(100);
      doc.text(label, startX - 12, rowY + 3);
      doc.setDrawColor(200);
      q_ids.forEach((id, i) => {
          doc.rect(startX + i*(TOOTH_SIZE+GAP), rowY, TOOTH_SIZE, 4);
          // Value
          const tData = data.odontograma_data?.[id] || {};
          const val = label.startsWith('REC') ? tData.recession : tData.mobility;
          if (val) {
             doc.setFontSize(6); doc.setTextColor(0);
             doc.text(String(val), startX + i*(TOOTH_SIZE+GAP) + 2, rowY + 3);
          }
      });
      doc.setDrawColor(0);
  };
  
  // Top Stats
  drawStatRow('RECESION', y + 3, QUADRANTS.Q1, startX_Q1);
  drawStatRow('MOVILIDAD', y + 7, QUADRANTS.Q1, startX_Q1);
  drawStatRow('RECESION', y + 3, QUADRANTS.Q2, startX_Q2);
  drawStatRow('MOVILIDAD', y + 7, QUADRANTS.Q2, startX_Q2);
  
  // Bottom Stats
  drawStatRow('MOVILIDAD', y + 57, QUADRANTS.Q4, startX_Q1);
  drawStatRow('RECESION', y + 61, QUADRANTS.Q4, startX_Q1);
  drawStatRow('MOVILIDAD', y + 57, QUADRANTS.Q3, startX_Q2);
  drawStatRow('RECESION', y + 61, QUADRANTS.Q3, startX_Q2);
  
  // Legend / Symbology
  doc.setFillColor(255,255,255);
  doc.rect(margin + contentWidth - 60, y + 42, 58, 20, 'F');
  doc.rect(margin + contentWidth - 60, y + 42, 58, 20); // Border
  doc.setFontSize(6); doc.setTextColor(0);
  doc.text('SIMBOLOGIA', margin + contentWidth - 58, y + 46);
  
  // Red/Blue dots
  doc.setFillColor(239, 68, 68); doc.circle(margin + contentWidth - 55, y + 50, 1.5, 'F');
  doc.text('Patologia', margin + contentWidth - 52, y + 51);
  
  doc.setFillColor(59, 130, 246); doc.circle(margin + contentWidth - 30, y + 50, 1.5, 'F');
  doc.text('Tratamiento', margin + contentWidth - 27, y + 51);
  
  doc.setTextColor(239, 68, 68); doc.text('X', margin + contentWidth - 56, y + 55);
  doc.setTextColor(0); doc.text('Extraccion', margin + contentWidth - 52, y + 55);
  
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

export const generatePrescription = (data: any) => {
  const doc = new jsPDF('p', 'mm', 'a5'); // Standard prescription size is A5
  const pageWidth = 148;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  let y = margin;

  // Header / Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246); // Primary blue
  doc.text(data.clinicName || 'CLINICA DENTAL', margin, y);
  
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clinicAddress || 'Dirección de la Clínica', margin, y + 5);
  doc.text(data.clinicPhone || 'Teléfono: +593 999 999 999', margin, y + 9);

  y += 20;

  // Separator line
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Patient Info
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('RECETA MÉDICA', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Paciente: ${data.patientName}`, margin, y);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin, y, { align: 'right' });
  y += 6;
  doc.text(`Identificación: ${data.patientId || 'N/A'}`, margin, y);
  
  y += 12;

  // RP / Prescriptions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Rp.', margin, y);
  y += 6;

  // Medications Table
  autoTable(doc, {
    startY: y,
    head: [['Medicamento', 'Dosis / Frecuencia', 'Duración']],
    body: (data.medications || []).map((m: any) => [m.name, m.dosage, m.duration]),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    margin: { left: margin, right: margin }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 15;

  // Instructions
  if (data.indications) {
    doc.setFont('helvetica', 'bold');
    doc.text('Indicaciones:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(data.indications, contentWidth);
    doc.text(lines, margin, y);
    y += (lines.length * 4) + 10;
  }

  // Footer / Signature
  const footerY = pageHeight - 35;
  
  // Signature Image
  if (data.signature) {
    try {
      doc.addImage(data.signature, 'PNG', pageWidth / 2 - 20, footerY - 20, 40, 20);
    } catch (e) {
      console.error("Signature image error", e);
    }
  }

  doc.setDrawColor(150);
  doc.line(pageWidth / 2 - 30, footerY, pageWidth / 2 + 30, footerY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(data.doctorName || 'Dr. Profesional', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(data.doctorSpecialty || 'Odontólogo', pageWidth / 2, footerY + 8, { align: 'center' });
  doc.text(data.doctorReg || 'Reg. Prof: 0000-00-000', pageWidth / 2, footerY + 11, { align: 'center' });

  // Save
  doc.save(`Receta_${data.patientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
};
