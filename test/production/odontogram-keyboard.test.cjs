const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(){
 const source=fs.readFileSync('components/odontograma-interactive.tsx','utf8');const start=source.indexOf('    const handleKeyDown ='),end=source.indexOf('    window.addEventListener',start);assert(start>0&&end>start);
 const code=ts.transpileModule(source.slice(start,end)+'\nmodule.exports=handleKeyDown',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 class Element{constructor(control=false){this.control=control;this.isContentEditable=false}closest(){return this.control?this:null}}
 class Input extends Element{};class Textarea extends Element{};
 const modes=[],m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,readOnly:false,Element,HTMLInputElement:Input,HTMLTextAreaElement:Textarea,setActiveMode:v=>modes.push(v),setActiveTool(){},setRangeStart(){},TOOLS:{SELECT:{}}});
 const event=target=>({target,key:'Enter',code:'Enter',defaultPrevented:false,preventDefault(){this.defaultPrevented=true}});
 return{handler:m.exports,modes,event,Element,Input,Textarea};
}
test('Enter on focused action controls is not consumed by odontogram shortcuts',()=>{const h=harness(),e=h.event(new h.Element(true));h.handler(e);assert.equal(e.defaultPrevented,false);assert.equal(h.modes.length,0)});
test('input/textarea Enter and already handled dental surface activation are not stolen',()=>{for(const target of ['Input','Textarea']){const h=harness(),e=h.event(new h[target]());h.handler(e);assert.equal(e.defaultPrevented,false);assert.equal(h.modes.length,0)}const h=harness(),e=h.event(new h.Element());e.defaultPrevented=true;h.handler(e);assert.equal(h.modes.length,0)});
test('background chart Enter shortcut still selects the treatment mode',()=>{const h=harness(),e=h.event(new h.Element());h.handler(e);assert.equal(e.defaultPrevented,true);assert.deepEqual(h.modes,['blue'])});