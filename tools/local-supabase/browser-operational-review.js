(async page => {
  const origin='http://127.0.0.1:3400',directory='docs/production/evidence/2026-09-28-convergence';
  if(!page.url().startsWith(origin+'/'))throw Error('Owned synthetic browser required');
  const checks=[],requests=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfinished',request=>{
    const url=request.url(),api='http://127.0.0.1:56321';
    if(url.startsWith(api+'/')){
      const selected=decodeURIComponent(url.match(/[?&]select=([^&]*)/)?.[1]||'');
      if(selected&&/\*|price|account_balance|insurance_provider|policy_number/.test(selected))errors.push('Financial/wildcard projection requested');
      requests.push({path:url.slice(api.length).split('?')[0],method:request.method()});
    }
  });
  await page.goto(origin+'/reports',{waitUntil:'domcontentloaded'});
  await page.getByTestId('report-appointments').waitFor({state:'visible'});
  checks.push({name:'Real operational report loads',passed:true,count:await page.getByTestId('report-appointments').innerText()});
  const periods=[];
  for(const days of [30,365]){
    await page.locator('#report-period').click();
    const response=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/get_clinic_operational_report')&&r.request().method()==='POST');
    await page.getByRole('option',{name:`Últimos ${days} días`,exact:true}).click();
    const r=await response;
    if(r.status()!==200)throw Error('Period RPC failed');
    const body=r.request().postDataJSON();
    const duration=(Date.parse(body.p_end)-Date.parse(body.p_start))/86400000;
    if(duration!==days)throw Error('Period selector does not affect SQL interval');
    await page.getByTestId('report-appointments').waitFor({state:'visible'});
    periods.push({days,duration,status:r.status()});
  }
  checks.push({name:'Period selector changes exact request interval',passed:true,periods});
  await page.getByRole('button',{name:'Exportar PDF',exact:true}).waitFor({state:'visible'});
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar PDF',exact:true}).click();
  const pdf=await download;
  await pdf.saveAs(directory+'/informe-operativo.pdf');
  checks.push({name:'Operational PDF downloaded',passed:true,filename:pdf.suggestedFilename()});
  const layouts=[];
  for(const width of [320,360,768,1280]){
    await page.setViewportSize({width,height:800});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Reports overflow at '+width);
    layouts.push({screen:'reports',width,overflow:false});
    if(width===360)await page.screenshot({path:directory+'/reports-360-light.png',fullPage:true});
  }
  await page.evaluate(()=>localStorage.setItem('theme','dark'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByTestId('report-appointments').waitFor({state:'visible'});
  if(!await page.evaluate(()=>document.documentElement.classList.contains('dark')))throw Error('Dark theme failed');
  await page.setViewportSize({width:360,height:800});
  await page.screenshot({path:directory+'/reports-360-dark.png',fullPage:true});
  checks.push({name:'Reports dark theme',passed:true});
  await page.evaluate(()=>localStorage.setItem('theme','light'));
  await page.goto(origin+'/dashboard/services',{waitUntil:'domcontentloaded'});
  const original=page.getByRole('button',{name:'Editar Control operativo sintético',exact:true});
  const persisted=page.getByRole('heading',{name:'Control operativo sintético verificado',exact:true});
  await original.or(persisted).waitFor({state:'visible'});
  const mutationPerformed=await original.count()===1;
  if(mutationPerformed){
    await original.click();
    await page.locator('#treatment-name').fill('Control operativo sintético verificado');
    await page.locator('#treatment-duration').fill('45');
    await page.getByRole('dialog').getByRole('button',{name:'Guardar',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Control operativo sintético verificado',exact:true}).waitFor({state:'visible'});
  await page.getByText('Duración: 45 minutos',{exact:true}).waitFor({state:'visible'});
  for(const width of [320,360,768,1280]){
    await page.setViewportSize({width,height:800});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Treatment catalog overflow at '+width);
    layouts.push({screen:'treatments',width,overflow:false});
    if(width===360)await page.screenshot({path:directory+'/treatments-360-light.png',fullPage:true});
  }
  checks.push({name:'Treatment edits persist after reload',passed:true,mutationPerformed});
  await page.setViewportSize({width:1280,height:800});
  await page.goto(origin+'/settings?tab=automation',{waitUntil:'domcontentloaded'});
  await page.getByRole('tab',{name:'General',exact:true}).waitFor({state:'visible'});
  if(await page.getByRole('tab',{name:'Automatización',exact:true}).count()!==0)throw Error('Excluded automation still mounted');
  if(await page.getByRole('tab',{name:'General',exact:true}).getAttribute('data-state')!=='active')throw Error('Unknown tab not normalized');
  await page.getByRole('tab',{name:'Suscripción',exact:true}).click();
  await page.getByText('Acceso habilitado',{exact:true}).waitFor({state:'visible'});
  checks.push({name:'Settings excluded tab normalized; actual access verified',passed:true});
  const closed=await page.goto(origin+'/marketing',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'404',exact:true}).waitFor({state:'visible'});
  if(![200,404].includes(closed.status()))throw Error('Unexpected closed route response');
  checks.push({name:'Marketing direct route renders not-found',passed:true,status:closed.status(),streamed:closed.status()===200});
  await page.goto(origin+'/reports',{waitUntil:'domcontentloaded'});
  await page.getByTestId('report-appointments').waitFor({state:'visible'});
  if(errors.length)throw Error(JSON.stringify(errors));
  return {state:'VERIFIED_LOCAL_BOUNDED',checks,layouts,requests,errors};
})
