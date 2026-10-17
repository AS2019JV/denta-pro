(async page => {
  const origin = /^(https?:\/\/[^/]+)/.exec(page.url())[1];
  if(origin !== 'http://127.0.0.1:3400') throw Error('Synthetic local origin required');
  const layouts = [], errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/calendar?view=today',{waitUntil:'domcontentloaded'});
  await page.getByRole('status').filter({hasText:'citas en el periodo visible'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Periodo siguiente',exact:true}).click();
  await page.getByRole('button').filter({hasText:'Control sintético navegador28'}).waitFor({state:'visible'});
  for(const width of [320,360,768,1280]) {
    await page.setViewportSize({width,height:800});
    await page.waitForFunction(()=>{const rect=document.querySelector('#clinic-sidebar').getBoundingClientRect();return innerWidth>=1024?Math.abs(rect.left)<1:rect.right<=0;});
    const dimensions = await page.evaluate(()=>{
      const heading=Array.from(document.querySelectorAll('h1')).find(h=>h.textContent==='Calendario').getBoundingClientRect();
      const menu=document.querySelector('button[aria-controls="clinic-sidebar"]').getBoundingClientRect();
      const date=document.querySelector('section[aria-label="Agenda de la clínica"] h2').getBoundingClientRect();
      const overlap=heading.left<menu.right&&heading.right>menu.left&&heading.top<menu.bottom&&heading.bottom>menu.top;
      const main=document.querySelector('#main-content');
      return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth||main.scrollWidth>main.clientWidth,headingMenuOverlap:innerWidth<1024&&overlap,dateHeight:date.height};
    });
    if(dimensions.overflow||dimensions.headingMenuOverlap||dimensions.dateHeight>60) throw Error('Layout failed at '+width+': '+JSON.stringify(dimensions));
    layouts.push(dimensions);
    if(width===360||width===1280) await page.screenshot({path:`docs/production/evidence/2026-09-28-performance/calendar-final-${width}-light.png`,fullPage:true});
  }
  await page.setViewportSize({width:360,height:800});
  await page.evaluate(()=>localStorage.setItem('theme','dark'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('status').filter({hasText:'citas en el periodo visible'}).waitFor({state:'visible'});
  await page.waitForFunction(()=>document.documentElement.classList.contains('dark')&&document.querySelector('#clinic-sidebar').getBoundingClientRect().right<=0);
  await page.screenshot({path:'docs/production/evidence/2026-09-28-performance/calendar-final-360-dark.png',fullPage:true});
  await page.evaluate(()=>localStorage.setItem('theme','light'));
  await page.setViewportSize({width:1280,height:800});
  await page.goto(origin+'/patients/cccccccc-cccc-4ccc-8ccc-cccccccccccc?tab=recipes',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Generar e Imprimir',exact:true}).waitFor({state:'visible'});
  await page.getByPlaceholder('Ej. Paracetamol 500mg').fill('PRUEBA TECNICA - NO USO CLINICO');
  await page.getByPlaceholder('Ej. 1 tableta c/ 8h').fill('Dato sintetico sin indicacion medica');
  await page.getByPlaceholder('Ej. 3 días').fill('Solo verificacion');
  await page.getByPlaceholder('Indicaciones adicionales, dieta, reposo, etc.').fill('Documento sintetico de prueba. No usar para atencion de pacientes.');
  const downloadPending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Generar e Imprimir',exact:true}).click();
  const download=await downloadPending;
  await download.saveAs('docs/production/evidence/2026-09-28-performance/receta-sintetica-lazy.pdf');
  if(await download.failure()) throw Error('PDF download failed');
  if(errors.length) throw Error('Page errors: '+errors.join('; '));
  return {state:'VERIFIED_LOCAL_BOUNDED',layouts,darkCalendarRendered:true,pdfDownload:true,errors,limitations:['Only calendar layout/light-dark and synthetic PDF delivery; full WCAG, HCU033/PDF clinical content and release UAT remain pending.']};
})
