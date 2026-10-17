(async page => {
  const origin='http://127.0.0.1:3400';
  if(!page.url().startsWith(origin+'/')) throw Error('Synthetic local origin required');
  await page.context().clearCookies();
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  const layouts=[];
  for(const width of [320,360,768,1280]) {
    await page.setViewportSize({width,height:800});
    await page.locator('header').getByRole('link',{name:'Iniciar sesión',exact:true}).waitFor({state:'visible'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw Error('Landing overflow at '+width);
    layouts.push({width,overflow:false,loginVisible:true});
    if(width===360||width===1280)await page.screenshot({path:`docs/production/evidence/2026-09-28-performance/landing-final-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:320,height:800});
  await page.locator('header').getByRole('link',{name:'Iniciar sesión',exact:true}).click();
  await page.locator('#email').waitFor({state:'visible'});
  if(!page.url().startsWith(origin+'/login'))throw Error('Login link destination failed');
  await page.setViewportSize({width:1280,height:800});
  return {state:'VERIFIED_LOCAL_BOUNDED',layouts,mobileLoginNavigation:true};
})
