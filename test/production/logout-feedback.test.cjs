const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function render(auth){
 const module={exports:{}}
 const jsx=(type,props)=>({type,props})
 const source=fs.readFileSync(path.resolve(__dirname,'../../components/dashboard-wrapper.tsx'),'utf8')
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
  {module,exports:module.exports,require(id){
   if(id==='react')return{}
   if(id==='react/jsx-runtime')return{jsx,jsxs:jsx}
   if(id==='@/components/auth-context')return{useAuth:()=>auth}
   if(id==='@/hooks/use-realtime-notifications')return{useRealtimeNotifications(){}}
   return new Proxy({},{get:(_,name)=>name})
  }})
 return module.exports.DashboardWrapper({children:'protected-clinic-content'})
}
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(' '):node&&typeof node==='object'?text(node.props?.children):''
test('logout transition renders progress instead of missing-clinic error, protected children or repeat actions',()=>{
 for(const user of [null,{id:'owner'}]){
  const tree=render({user,logoutStatus:"pending",isLoading:false,isRevalidating:false,authError:null})
  assert.equal(tree.props['aria-busy'],'true')
  assert.equal(text(tree),'Cerrando sesión…')
  assert.doesNotMatch(JSON.stringify(tree),/Reintentar|Cerrar sesión|protected-clinic-content|No tienes acceso/)
 }
})
test('failed logout renders the actual retryable error with no protected content or success navigation',()=>{
 let calls=0
 const tree=render({user:null,logoutStatus:"failed",isLoading:false,authError:'No pudimos cerrar tu sesión.',logout:()=>calls++})
 assert.match(text(tree),/No pudimos cerrar tu sesión/)
 assert.doesNotMatch(text(tree),/protected-clinic-content|Cerrando sesión/)
 const action=tree.props.children.find(node=>node.props?.children==='Reintentar cierre de sesión')
 action.props.onClick();assert.equal(calls,1)
})
