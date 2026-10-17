(async page => {
  const origin='http://127.0.0.1:3400',dir='docs/production/evidence/2026-09-28-convergence';
  if(!page.url().startsWith(origin+'/'))throw Error('Synthetic local browser required');
  const checks=[];
  for(const theme of ['light','dark']){
    await page.evaluate(value=>localStorage.setItem('theme',value),theme);
    await page.setViewportSize({width:360,height:800});
    await page.goto(origin+'/reports',{waitUntil:'domcontentloaded'});
    await page.getByTestId('report-appointments').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.getElementById('clinic-sidebar')?.getBoundingClientRect().right<=1);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
    await page.screenshot({path:dir+`/reports-360-${theme}-stable.png`,animations:'disabled'});
    await page.locator('#main-content').evaluate(el=>el.scrollTop=el.scrollHeight);
    await page.screenshot({path:dir+`/reports-360-${theme}-bottom.png`,animations:'disabled'});
    checks.push({theme,width:360,sidebarHidden:true,overflow:false});
  }
  return {state:'STABLE_VISUAL_CAPTURED',checks};
})
