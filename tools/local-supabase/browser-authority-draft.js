(async page => {
  const origin='http://127.0.0.1:3400',checks=[];
  if(!page.url().startsWith(origin+'/'))throw Error('Local synthetic browser required');
  await page.setViewportSize({width:1280,height:800});
  await page.goto(origin+'/dashboard/services',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Editar Control operativo sintético verificado',exact:true}).click();
  const draft='Borrador conservado sin guardar';
  await page.locator('#treatment-name').fill(draft);
  let release;
  const barrier=new Promise(resolve=>{release=resolve});
  let hold=true;
  const delay=async route=>{if(hold)await barrier;await route.continue()};
  await page.route('**/auth/v1/user',delay);
  try{
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading',{name:'Verificando acceso…',exact:true}).waitFor({state:'visible'});
    if(await page.locator('#treatment-name').inputValue()!==draft)throw Error('Draft was lost during revalidation');
    await page.keyboard.press('Tab');
    if(!await page.evaluate(()=>document.activeElement.closest('[role="dialog"]')?.textContent.includes('Verificando acceso')))throw Error('Keyboard escaped verification dialog');
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'Verificando acceso…',exact:true}).waitFor({state:'visible'});
    hold=false;release();
    await page.getByRole('heading',{name:'Verificando acceso…',exact:true}).waitFor({state:'hidden'});
    await page.locator('#treatment-name').waitFor({state:'visible'});
    if(await page.locator('#treatment-name').inputValue()!==draft)throw Error('Draft was lost after successful revalidation');
    checks.push({name:'Delayed real Auth revalidation blocks interaction and retains draft',passed:true});
  }finally{hold=false;release();await page.unroute('**/auth/v1/user',delay)}
  const fail=route=>route.abort('failed');
  await page.route('**/auth/v1/user',fail);
  try{
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor({state:'visible'});
    if(await page.locator('#treatment-name').count()!==0)throw Error('Failed verification retained editable draft');
    checks.push({name:'Network verification failure discards mounted draft and fails closed',passed:true,kind:'browser network fault, not role revocation proof'});
  }finally{await page.unroute('**/auth/v1/user',fail)}
  await page.getByRole('button',{name:'Reintentar',exact:true}).click();
  await page.getByRole('button',{name:'Editar Control operativo sintético verificado',exact:true}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Editar Control operativo sintético verificado',exact:true}).click();
  if(await page.locator('#treatment-name').inputValue()!== 'Control operativo sintético verificado')throw Error('Discarded draft resurfaced after recovery');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  checks.push({name:'Recovery rebuilds verified scope without abandoned draft',passed:true});
  for(const flow of [
    {path:'/calendar',selector:'#appointment-type',value:'Cita borrador no guardar',open:async()=>page.getByRole('button',{name:'Nueva cita',exact:true}).click()},
    {path:'/patients/cccccccc-cccc-4ccc-8ccc-cccccccccccc?tab=recipes',selector:'input[placeholder="Ej. Paracetamol 500mg"]',value:'PRUEBA BORRADOR NO USO CLINICO',open:async()=>{}},
  ]){
    await page.goto(origin+flow.path,{waitUntil:'domcontentloaded'});
    await flow.open();
    await page.locator(flow.selector).fill(flow.value);
    let resume;
    const paused=new Promise(resolve=>{resume=resolve});
    let pause=true;
    const handler=async route=>{if(pause)await paused;await route.continue()};
    await page.route('**/auth/v1/user',handler);
    try{
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await page.getByRole('heading',{name:'Verificando acceso…',exact:true}).waitFor({state:'visible'});
      pause=false;resume();
      await page.getByRole('heading',{name:'Verificando acceso…',exact:true}).waitFor({state:'hidden'});
      await page.locator(flow.selector).waitFor({state:'visible'});
      if(await page.locator(flow.selector).inputValue()!==flow.value)throw Error('Draft lost: '+flow.path);
      checks.push({name:'Same-scope draft retained',path:flow.path,passed:true});
    }finally{pause=false;resume();await page.unroute('**/auth/v1/user',handler)}
    if(flow.path==='/calendar')await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  }
  return {state:'LOCAL_AUTH_DRAFT_VERIFIED',checks,mutations:0};
})
