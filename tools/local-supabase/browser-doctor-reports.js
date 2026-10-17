(async page => {
  const origin='http://127.0.0.1:3400';
  if(!page.url().startsWith(origin+'/'))throw Error('Local synthetic browser required');
  await page.goto(origin+'/reports',{waitUntil:'domcontentloaded'});
  await page.getByTestId('report-appointments').waitFor({state:'visible'});
  if(page.url()!==origin+'/reports')throw Error('Doctor report route redirected');
  await page.goto(origin+'/settings',{waitUntil:'domcontentloaded'});
  await page.getByRole('link',{name:/Total de Pacientes/}).waitFor({state:'visible'});
  if(page.url()!==origin+'/dashboard')throw Error('Doctor unexpectedly accessed administrative settings');
  return {state:'LOCAL_DOCTOR_ROUTE_VERIFIED',checks:['Operational reports accessible','Administrative settings redirected'],mutations:0};
})
