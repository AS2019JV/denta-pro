(async (page) => {
  const origin = /^(https?:\/\/[^/]+)/.exec(page.url())[1];
  const api = [];
  page.on('requestfinished', async request => {
    const pathname = request.url().replace(/^https?:\/\/[^/]+/,'').split('?')[0];
    if (!pathname.startsWith('/rest/v1/') && !pathname.startsWith('/auth/v1/')) return;
    const response = await request.response();
    const timing = request.timing();
    api.push({path:pathname,method:request.method(),status:response?.status(),durationMs:Math.round(timing.responseEnd)});
  });
  await page.addInitScript(() => {
    window.__cliniaLcp = null;
    window.__cliniaCls = 0;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__cliniaLcp = entry.startTime; }).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cliniaCls += entry.value; }).observe({type:'layout-shift',buffered:true});
  });
  const navigation = async path => {
    const start = Date.now();
    await page.goto(origin+path,{waitUntil:'domcontentloaded'});
    if(path==='/dashboard') await page.getByRole('link',{name:/Total de Pacientes/}).waitFor({state:'visible'});
    else if(path==='/login') await page.locator('#email').waitFor({state:'visible'});
    else if(path==='/calendar') await page.getByRole('status').filter({hasText:'citas en el periodo visible'}).waitFor({state:'visible'});
    else await page.getByRole('heading').first().waitFor({state:'visible'});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    return {path,readyMs:Date.now()-start,...await page.evaluate(() => {
      const nav=performance.getEntriesByType('navigation')[0];
      return {ttfbMs:Math.round(nav.responseStart),domContentLoadedMs:Math.round(nav.domContentLoadedEventEnd),loadMs:Math.round(nav.loadEventEnd),lcpMs:window.__cliniaLcp===null?null:Math.round(window.__cliniaLcp),cls:Number(window.__cliniaCls.toFixed(4)),scriptTransferBytes:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').reduce((sum,r)=>sum+r.transferSize,0)};
    })};
  };
  const anonymous = page.url().includes('/login') || page.url() === origin+'/';
  const pages=[];
  if (anonymous) {
    for(let i=0;i<3;i++) pages.push(await navigation('/'));
    pages.push(await navigation('/login'));
  } else {
    for(let i=0;i<3;i++) pages.push(await navigation('/dashboard'));
    const before=api.length;
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.getByText('Verificando acceso…',{exact:true}).waitFor({state:'hidden'});
    await page.getByRole('link',{name:/Total de Pacientes/}).waitFor({state:'visible'});
    const focusRequests=api.slice(before);
    pages.push({path:'focus-burst',requests:focusRequests});
    pages.push(await navigation('/calendar'));
    pages.push(await navigation('/patients'));
  }
  return {mode:anonymous?'anonymous':'authenticated',origin,pages,apiRequests:api};
})
