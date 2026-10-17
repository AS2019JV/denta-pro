(async page => {
  const origin='http://127.0.0.1:3400',samples=[];
  if(!page.url().startsWith(origin+'/'))throw Error('Synthetic local browser required');
  await page.setViewportSize({width:1280,height:800});
  for(const path of ['/reports','/dashboard/services']){
    for(let sample=1;sample<=3;sample++){
      const started=Date.now();
      await page.goto(origin+path,{waitUntil:'domcontentloaded'});
      if(path==='/reports')await page.getByTestId('report-appointments').waitFor({state:'visible'});
      else await page.getByRole('heading',{name:'Control operativo sintético verificado',exact:true}).waitFor({state:'visible'});
      samples.push({path,sample,readyMs:Date.now()-started});
    }
  }
  return {state:'LOCAL_SMALL_SAMPLE_ONLY',cache:'reused browser; no field/LCP claim',concurrentUsers:1,samples};
})
