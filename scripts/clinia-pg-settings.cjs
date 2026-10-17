'use strict';
const assert=require('node:assert/strict');
const listGucs=new Set(['search_path','session_preload_libraries','local_preload_libraries','shared_preload_libraries','temp_tablespaces']);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
function listValues(value){
  const values=[];let current='',quoted=false;
  for(let i=0;i<value.length;i++){
    const char=value[i];
    if(char==='"'){if(quoted&&value[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}
    else if(char===','&&!quoted){values.push(current.trim());current='';}
    else current+=char;
  }
  assert.ok(!quoted,'Unbalanced PostgreSQL list setting');values.push(current.trim());return values;
}
function settingsSql(prefix,settings){
  return (settings||[]).map(setting=>{
    const i=setting.indexOf('=');assert.ok(i>0);const name=setting.slice(0,i),value=setting.slice(i+1);assert.match(name,/^[A-Za-z_][A-Za-z0-9_.]*$/);
    // SET parses list-valued GUCs as a list of SQL values. Quoting the whole
    // serialized list silently turns it into ONE library/schema identifier.
    const sqlValue=listGucs.has(name)?listValues(value).map(quote).join(', '):quote(value);
    return prefix+' SET "'+name+'" TO '+sqlValue+';';
  }).join('\n');
}
module.exports={settingsSql,listValues};
