'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model,selected=null,mode='select',connectFrom=null,history=[],future=[],timer=null,drag=null,inlineEditor=null;
let sim={current:null,index:0,tokens:[],trace:[],blocked:false,started:false};
const state=(id,name,x,y,final=false)=>({id,name,x,y,final});
function example(type){
 if(type==='empty')return {title:'Il mio automa',initial:'q0',states:[state('q0','q0',250,300)],edges:[]};
 if(type==='traffic')return {title:'Semaforo',initial:'r',states:[state('r','Rosso',240,300),state('g','Verde',500,300),state('y','Giallo',760,300)],edges:[{id:'e1',from:'r',to:'g',symbol:'timer'},{id:'e2',from:'g',to:'y',symbol:'timer'},{id:'e3',from:'y',to:'r',symbol:'timer'}]};
 if(type==='binary')return {title:'Termina con 01',initial:'q0',states:[state('q0','q0',230,330),state('q1','q1',500,330),state('q2','q2',770,330,true)],edges:[{id:'e1',from:'q0',to:'q0',symbol:'1'},{id:'e2',from:'q0',to:'q1',symbol:'0'},{id:'e3',from:'q1',to:'q1',symbol:'0'},{id:'e4',from:'q1',to:'q2',symbol:'1'},{id:'e5',from:'q2',to:'q1',symbol:'0'},{id:'e6',from:'q2',to:'q0',symbol:'1'}]};
 let states=[state('start','Attesa',110,300),state('c0','0 ¢',290,300),state('c10','10 ¢',460,170),state('c20','20 ¢',460,430),state('c30','30 ¢',650,170),state('c40','40 ¢',650,430),state('c50','Erogato',860,300,true)],edges=[{id:'e0',from:'start',to:'c0',symbol:'seleziona'}];
 for(let n=0;n<50;n+=10)for(let c of [10,20,50])if(n+c<=50)edges.push({id:'e'+edges.length,from:'c'+n,to:'c'+(n+c),symbol:String(c)});
 return {title:'Distributore di bevande',initial:'start',states,edges};
}
function validViewport(v){return v&&['x','y','w','h'].every(k=>Number.isFinite(v[k])&&Math.abs(v[k])<=1e9)&&v.w>0&&v.h>0;}
function validModel(m){return m&&(m.viewport===undefined||validViewport(m.viewport))&&typeof m.title==='string'&&m.title.length<=80&&Array.isArray(m.states)&&m.states.length>0&&m.states.length<=100&&Array.isArray(m.edges)&&m.edges.length<=500&&m.states.every(s=>typeof s.id==='string'&&typeof s.name==='string'&&s.name.length>0&&s.name.length<=40&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&typeof s.final==='boolean')&&new Set(m.states.map(s=>s.id)).size===m.states.length&&m.states.some(s=>s.id===m.initial)&&m.edges.every(e=>typeof e.id==='string'&&m.states.some(s=>s.id===e.from)&&m.states.some(s=>s.id===e.to)&&typeof e.symbol==='string'&&e.symbol.trim()&&e.symbol.length<=40&&!/[\s,]/.test(e.symbol))&&new Set(m.edges.map(e=>e.id)).size===m.edges.length;}
try{const saved=JSON.parse(localStorage.getItem('automata-studio-v1'));model=validModel(saved)?saved:example('vending');}catch{model=example('vending');}
function clone(){return JSON.stringify(model)}
function checkpoint(){history.push(clone());if(history.length>60)history.shift();future=[];stop();}
function save(){try{localStorage.setItem('automata-studio-v1',clone());$('saved').textContent='Salvato in questo browser';}catch{$('saved').textContent='Salvataggio locale non disponibile';}}
function toast(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('toast').style.display='none',3500);}
function stop(){if(timer)clearInterval(timer);timer=null;$('run').textContent='▶ Esegui';}
function reset(render=true){stop();sim={current:model.initial,index:0,tokens:parse(),trace:[],blocked:false,started:false};if(render)renderAll();}
function parse(){return $('sequence').value.trim().split(/[\s,]+/).filter(Boolean)}
function commit(){if(validViewport(model.viewport))setView(model.viewport,false);save();reset(false);renderAll();}
function symbols(){return [...new Set(model.edges.map(e=>e.symbol))].sort()}
function issues(){let seen=new Set(),out=[];for(let e of model.edges){let k=JSON.stringify([e.from,e.symbol]);if(seen.has(k))out.push('Più transizioni per «'+e.symbol+'» da '+model.states.find(s=>s.id===e.from).name);seen.add(k)}return [...new Set(out)]}
function node(tag,attrs,parent){let n=document.createElementNS(NS,tag);for(let [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(parent)parent.append(n);return n;}
function bounds(){
 // Include curved parallel edges and labels when fitting or exporting.
 const box=$('graph').getBBox();
 if(box.width>0&&box.height>0)return {x:box.x-65,y:box.y-65,w:box.width+130,h:box.height+130};
 const xs=model.states.map(s=>s.x),ys=model.states.map(s=>s.y);
 return {x:Math.min(...xs)-110,y:Math.min(...ys)-130,w:Math.max(...xs)-Math.min(...xs)+220,h:Math.max(...ys)-Math.min(...ys)+240};
}
const routeColors=['#237658','#4169b1','#b45178','#bb7d26','#7856a5','#16838b','#c2543f','#697936'];
const routePatterns=['','9 4','3 4','10 3 2 3','13 4 4 4','2 3 2 3 8 3'];
function routeStyle(edge){
 if(!Number.isInteger(edge.styleIndex)||edge.styleIndex<0||edge.styleIndex>=48)edge.styleIndex=model.edges.findIndex(item=>item.id===edge.id)%48;
 const index=edge.styleIndex;
 return {color:routeColors[index%routeColors.length],dash:routePatterns[(index+Math.floor(index/routeColors.length))%routePatterns.length],marker:'route-arrow-'+index%routeColors.length};
}
function draw(target=$('graph'),exporting=false){
 target.replaceChildren();let defs=node('defs',{},target);for(let [id,color]of [['arrow','#86998b'],['hot','#c08b3d'],...routeColors.map((color,i)=>['route-arrow-'+i,color])]){let mark=node('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},defs);node('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color},mark)}
 const map=Object.fromEntries(model.states.map(s=>[s.id,s]));let grouped=model.edges.map(e=>({from:e.from,to:e.to,edges:[e]}));
 for(let g of grouped){let a=map[g.from],b=map[g.to],d,lx,ly;const route=routeStyle(g.edges[0]),siblings=model.edges.filter(e=>e.from===g.from&&e.to===g.to),lane=siblings.findIndex(e=>e.id===g.edges[0].id);const offset=(lane-(siblings.length-1)/2)*55;
 if(a===b){const lift=130+lane*42;d=`M ${a.x-22} ${a.y-32} C ${a.x-85} ${a.y-lift}, ${a.x+85} ${a.y-lift}, ${a.x+22} ${a.y-32}`;lx=a.x;ly=a.y-105-lane*32}
 else{let dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;let reverse=model.edges.some(e=>e.from===b.id&&e.to===a.id);let bend=(reverse?65:0)+offset;let cx=(a.x+b.x)/2-uy*bend,cy=(a.y+b.y)/2+ux*bend;
 // Separate straight skip edges in the vending example.
 if(!reverse&&Math.abs(dx)>300){cy-=70;}
 let startAngle=Math.atan2(cy-a.y,cx-a.x),endAngle=Math.atan2(b.y-cy,b.x-cx);d=`M ${a.x+Math.cos(startAngle)*40} ${a.y+Math.sin(startAngle)*40} Q ${cx} ${cy} ${b.x-Math.cos(endAngle)*45} ${b.y-Math.sin(endAngle)*45}`;lx=.25*a.x+.5*cx+.25*b.x;ly=.25*a.y+.5*cy+.25*b.y-9;}
 let sel=selected?.kind==='edge'&&g.edges.some(e=>e.id===selected.id),group=node('g',{'class':'graph-edge','data-edges':JSON.stringify(g.edges.map(e=>e.id)),'data-label-x':lx,'data-label-y':ly},target);node('path',{d,fill:'none',stroke:route.color,'stroke-dasharray':route.dash,'stroke-width':sel&&!exporting?3.5:2.2,'marker-end':'url(#'+route.marker+')'},group);node('path',{d,fill:'none',stroke:'transparent','stroke-width':18},group);
 let label=g.edges.map(e=>e.symbol).join(', '),width=label.length*7+14;node('rect',{x:lx-width/2,y:ly-14,width,height:21,rx:5,fill:'#fcfdf9',stroke:'#e3e9df'},group);let text=node('text',{x:lx,y:ly+1,'text-anchor':'middle','font-size':12,'font-family':'Arial,sans-serif',fill:route.color},group);text.textContent=label;
 if(!exporting){group.addEventListener('click',()=>{selected={kind:'edge',id:selected?.kind==='edge'&&g.edges.some(e=>e.id===selected.id)?selected.id:g.edges[0].id};renderAll(false)});group.addEventListener('dblclick',event=>{event.stopPropagation();editLabel('edge',selected?.kind==='edge'&&g.edges.some(e=>e.id===selected.id)?selected.id:g.edges[0].id)});}}
 for(let s of model.states){let active=!exporting&&mode!=='connect'&&sim.started&&sim.current===s.id,sel=!exporting&&mode==='select'&&selected?.kind==='state'&&selected.id===s.id,group=node('g',{'class':'graph-state','data-id':s.id,role:'button',tabindex:exporting?-1:0,'aria-label':s.name},target);
 if(s.id===model.initial){node('path',{d:`M ${s.x-87} ${s.y} L ${s.x-44} ${s.y}`,stroke:'#829a83','stroke-width':2,'marker-end':'url(#arrow)'},group);let text=node('text',{x:s.x-82,y:s.y-11,'font-size':9,'font-family':'Arial,sans-serif',fill:'#829a83'},group);text.textContent='inizio'}
 if(active)node('circle',{cx:s.x,cy:s.y,r:48,fill:active?'#fff2d8':'#e9f0e4',stroke:active?'#e8d0a1':'#c4d6bd','stroke-width':1},group);
 if(!exporting&&mode==='connect'&&connectFrom===s.id)node('circle',{'data-connection-source':'true',cx:s.x,cy:s.y,r:45,fill:'none',stroke:'#237658','stroke-width':2},group);
 node('circle',{cx:s.x,cy:s.y,r:39,fill:active?'#f4dfb4':s.final?'#e0ecda':'#f2f6ee',stroke:active?'#c8994d':'#6c8c73','stroke-width':2},group);if(s.final)node('circle',{cx:s.x,cy:s.y,r:33,fill:'none',stroke:'#6c8c73','stroke-width':1.5},group);
 let text=node('text',{x:s.x,y:s.y+5,'text-anchor':'middle','font-size':s.name.length>10?11:14,'font-family':'Arial,sans-serif','font-weight':500,fill:'#304d38'},group);text.textContent=s.name.length>17?s.name.slice(0,16)+'…':s.name;node('title',{},group).textContent=s.name;
 if(!exporting){group.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();if(mode==='connect'){if(!connectFrom){connectFrom=s.id;selected={kind:'state',id:s.id};renderAll();}else{const from=connectFrom;connectFrom=null;mode='select';addEdge(from,s.id);}return;}selected={kind:'state',id:s.id};$('graph').focus();let p=point(e);drag={kind:'node',id:s.id,dx:p.x-s.x,dy:p.y-s.y,startX:e.clientX,startY:e.clientY,before:clone(),moved:false};renderAll(false)});group.addEventListener('dblclick',event=>{event.stopPropagation();editLabel('state',s.id)});group.addEventListener('keydown',e=>{if(e.key==='Enter'){selected={kind:'state',id:s.id};renderAll()}})} }
}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform($('graph').getScreenCTM().inverse())}
$('graph').addEventListener('pointerdown',e=>{
 if(e.button!==0||mode!=='select'||e.target.closest('.graph-state, .graph-edge'))return;
 const p=point(e);drag={kind:'pan',before:clone(),startX:e.clientX,startY:e.clientY,origin:p,view:{...model.viewport},matrix:$('graph').getScreenCTM().inverse(),moved:false};
 e.preventDefault();
});
$('graph').addEventListener('pointermove',e=>{
 if(!drag)return;
 if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4)return;
 if(!drag.moved)$('graph').setPointerCapture(e.pointerId);
 drag.moved=true;
 if(drag.kind==='pan'){
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.matrix);
  setView({...drag.view,x:drag.view.x-(p.x-drag.origin.x),y:drag.view.y-(p.y-drag.origin.y)});
  $('graph').classList.add('panning');return;
 }
 const p=point(e),s=model.states.find(s=>s.id===drag.id);
 s.x=Math.max(-3000,Math.min(3000,p.x-drag.dx));s.y=Math.max(-3000,Math.min(3000,p.y-drag.dy));
 save();draw();
});
$('graph').addEventListener('pointerup',()=>{
 if(!drag)return;
 const moved=drag.moved;
 if(moved){history.push(drag.before);if(history.length>60)history.shift();future=[];}
 if(moved)save();drag=null;$('graph').classList.remove('panning');renderAll(moved);
});
$('graph').addEventListener('pointercancel',()=>{
 if(!drag)return;
 if(drag.kind==='pan')setView(drag.view);else{model=JSON.parse(drag.before);save();}
 drag=null;$('graph').classList.remove('panning');renderAll();
});
window.addEventListener('pagehide',save);
$('graph').addEventListener('dblclick',e=>{if(e.target===$('graph')){let p=point(e);addState(p.x,p.y)}});
function addState(x,y){
 if(!finishInlineEditor(true))return;
 mode='select';connectFrom=null;checkpoint();
 const v=model.viewport,id='q'+Date.now(),name='q'+model.states.length;
 model.states.push(state(id,name,x??v.x+v.w/2,y??v.y+v.h/2));
 selected={kind:'state',id};commit();editLabel('state',id,true);
}
function addEdge(from,to){
 checkpoint();let symbol='evento',i=2;
 while(model.edges.some(e=>e.from===from&&e.symbol===symbol))symbol='evento'+i++;
 const id='e'+Date.now(),used=new Set(model.edges.map(edge=>edge.styleIndex));let styleIndex=0;while(used.has(styleIndex)&&styleIndex<48)styleIndex++;model.edges.push({id,from,to,symbol,styleIndex:styleIndex%48});
 selected={kind:'edge',id};commit();editLabel('edge',id,true);
}
function beginConnection(){
 if(!finishInlineEditor(true))return;
 stop();mode='connect';connectFrom=null;selected=null;drag=null;renderAll();
 $('graph').focus();
}
function editLabel(kind,id,created=false){
 if(!finishInlineEditor(true))return;
 stop();mode='select';connectFrom=null;selected={kind,id};renderAll(false);
 const item=(kind==='state'?model.states:model.edges).find(item=>item.id===id);
 if(!item)return;
 const wrap=document.createElement('div');wrap.className='inline-editor';
 const input=document.createElement('input');input.id='inline-name';input.maxLength=40;
 input.setAttribute('aria-label',kind==='state'?'Nome dello stato sul grafo':'Simbolo del collegamento sul grafo');
 input.value=kind==='state'?item.name:item.symbol;input.autocomplete='off';
 const help=document.createElement('small');help.textContent='Invio salva · Esc annulla';
 wrap.append(input,help);$('graph').parentElement.append(wrap);
 inlineEditor={kind,id,created,wrap,input,original:input.value};positionInlineEditor();
 input.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();event.stopPropagation();finishInlineEditor(true);}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finishInlineEditor(false);}
 });
 input.focus();input.select();
}
function positionInlineEditor(){
 if(!inlineEditor)return;
 const {kind,id,wrap}=inlineEditor;let x,y;
 if(kind==='state'){const item=model.states.find(item=>item.id===id);if(!item)return;x=item.x;y=item.y;}
 else{const group=[...$('graph').querySelectorAll('.graph-edge')].find(group=>JSON.parse(group.dataset.edges).includes(id));if(!group)return;x=Number(group.dataset.labelX);y=Number(group.dataset.labelY);}
 const point=new DOMPoint(x,y).matrixTransform($('graph').getScreenCTM()),box=$('graph').parentElement.getBoundingClientRect();
 wrap.style.left=Math.max(94,Math.min(box.width-94,point.x-box.x))+'px';
 wrap.style.top=Math.max(24,Math.min(box.height-54,point.y-box.y))+'px';
}
function finishInlineEditor(apply){
 if(!inlineEditor)return true;
 const editor=inlineEditor,item=(editor.kind==='state'?model.states:model.edges).find(item=>item.id===editor.id);
 const value=editor.input.value.trim();
 if(apply&&(!value||editor.kind==='edge'&&/[\s,]/.test(value))){
  editor.input.setAttribute('aria-invalid','true');toast(editor.kind==='state'?'Inserisci un nome per lo stato':'Usa un simbolo senza spazi o virgole');editor.input.focus();return false;
 }
 inlineEditor=null;editor.wrap.remove();
 if(apply&&item&&value!==editor.original){
  if(!editor.created)checkpoint();
  if(editor.kind==='state')item.name=value;else item.symbol=value;
  commit();
 }
 $('graph').focus();return true;
}
// Confirm an inline edit before actions outside its textbox.
document.addEventListener('pointerdown',event=>{
 if(inlineEditor&&!inlineEditor.wrap.contains(event.target)&&!finishInlineEditor(true)){
  event.preventDefault();event.stopPropagation();
 }
},true);
window.addEventListener('resize',positionInlineEditor);
function labelKeys(input,original){
 input.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();input.blur();}
  if(event.key==='Escape'){event.preventDefault();input.value=original;input.blur();}
 });
}
function renderProps(){let root=$('properties');let s=selected?.kind==='state'?model.states.find(s=>s.id===selected.id):null,e=selected?.kind==='edge'?model.edges.find(e=>e.id===selected.id):null;
 if(s){root.innerHTML=`<h2>Modifica stato</h2><label>Nome<input id="state-name" maxlength="40" value="${esc(s.name)}"></label><label class="check"><input id="initial" type="checkbox" ${model.initial===s.id?'checked':''}> Stato iniziale</label><label class="check"><input id="final" type="checkbox" ${s.final?'checked':''}> Stato finale</label><p class="helper">Un solo stato iniziale. Gli stati finali determinano quali sequenze sono accettate.</p><button id="delete" class="danger">Elimina stato</button>`;
 labelKeys($('state-name'),s.name);$('state-name').onchange=ev=>{let v=ev.target.value.trim();if(!v){toast('Inserisci un nome per lo stato');renderProps();return;}checkpoint();s.name=v;commit()};$('initial').onchange=()=>{if(model.initial===s.id){toast('Scegli un altro stato come iniziale');renderProps();return}checkpoint();model.initial=s.id;commit()};$('final').onchange=ev=>{checkpoint();s.final=ev.target.checked;commit()};$('delete').onclick=deleteSelectedState;
 }else if(e){const opts=id=>model.states.map(s=>`<option value="${esc(s.id)}" ${s.id===id?'selected':''}>${esc(s.name)}</option>`).join('');root.innerHTML=`<h2>Modifica transizione</h2><label>Da<select id="edge-from">${opts(e.from)}</select></label><label>A<select id="edge-to">${opts(e.to)}</select></label><label>Simbolo<input id="edge-symbol" maxlength="40" value="${esc(e.symbol)}"></label><p class="helper">Un simbolo per transizione, senza spazi o virgole. Per più simboli, aggiungi più transizioni.</p><button id="delete" class="danger">Elimina transizione</button>`;
 labelKeys($('edge-symbol'),e.symbol);for(let key of ['from','to','symbol'])$('edge-'+key).onchange=ev=>{let v=ev.target.value.trim();if(key==='symbol'&&(!v||/[\s,]/.test(v))){toast('Usa un simbolo senza spazi o virgole');renderProps();return;}checkpoint();e[key]=v;commit()};$('delete').onclick=()=>{checkpoint();model.edges=model.edges.filter(x=>x.id!==e.id);selected=null;commit()};
 }else root.innerHTML='<h2>Il tuo modello</h2><p class="helper">Seleziona uno stato o una transizione nel diagramma per modificarne le proprietà.</p><button id="new-state" style="width:100%;margin-top:12px">＋ Aggiungi stato</button><button id="new-edge" style="width:100%;margin-top:8px">↗ Aggiungi transizione</button>';
 if($('new-state'))$('new-state').onclick=()=>addState();if($('new-edge'))$('new-edge').onclick=beginConnection;
}
function renderAll(redraw=true){
 $('title').value=model.title;$('state-count').textContent=model.states.length;$('edge-count').textContent=model.edges.length;
 $('states').innerHTML=model.states.map(s=>`<div class="list-row ${selected?.id===s.id?'selected':''}" data-state="${esc(s.id)}"><i class="state-icon ${s.final?'final':''}"></i><span>${esc(s.name)}</span><small>${model.initial===s.id?'iniziale':s.final?'finale':''}</small></div>`).join('');
 document.querySelectorAll('[data-state]').forEach(el=>el.onclick=()=>{selected={kind:'state',id:el.dataset.state};renderAll();$('graph').focus()});
 const name=id=>model.states.find(s=>s.id===id)?.name||'?';$('edges').innerHTML=model.edges.map(e=>`<div class="list-row edge-row ${selected?.id===e.id?'selected':''}" data-edge="${esc(e.id)}"><svg class="route-swatch" width="24" height="10" aria-hidden="true"><path d="M 0 5 L 24 5" stroke="${routeStyle(e).color}" stroke-width="3" stroke-dasharray="${routeStyle(e).dash}"/></svg><span>${esc(name(e.from))} → ${esc(name(e.to))}</span><b>${esc(e.symbol)}</b></div>`).join('');document.querySelectorAll('[data-edge]').forEach(el=>el.onclick=()=>{selected={kind:'edge',id:el.dataset.edge};renderAll()});
 let problems=issues();$('validation').innerHTML=problems.length?problems.map(p=>`<p class="invalid">⚠ ${esc(p)}</p>`).join(''):`<p class="valid">✓ Nessuna transizione ambigua</p><p class="helper">${model.states.filter(s=>s.final).length} stati finali · ${symbols().length} simboli<br>Le transizioni mancanti rifiutano l’input.</p>`;
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;$('select-tool').classList.toggle('active',mode==='select');$('connect-tool').classList.toggle('active',mode==='connect');$('hint').textContent=mode==='connect'?(connectFrom?'Ora clicca sullo stato di destinazione':'Clicca sullo stato di partenza, poi sulla destinazione'):'Rotellina per zoom · Trascina lo sfondo per spostare · Doppio clic per rinominare';
 renderProps();renderSim();if(redraw)draw();
 for(const group of $('graph').querySelectorAll('.graph-state, .graph-edge')){let match=mode==='select'&&selected?.kind==='state'?group.dataset.id===selected.id:selected?.kind==='edge'&&JSON.parse(group.dataset.edges||'[]').includes(selected.id);group.classList.toggle('is-selected',mode==='select'&&!!match);}
 positionInlineEditor();
}
function renderSim(){let done=sim.started&&sim.index>=sim.tokens.length,accept=done&&!sim.blocked&&model.states.find(s=>s.id===sim.current)?.final;
 $('status').textContent=sim.blocked?'Input rifiutato':done?(accept?'Sequenza accettata':'Stato non finale'):sim.started?'In esecuzione':'Pronto';$('status').className='status '+(sim.blocked||done&&!accept?'reject':accept?'accept':'');$('current').textContent='Stato: '+(model.states.find(s=>s.id===sim.current)?.name||'—');
 $('tokens').innerHTML=sim.tokens.map((t,i)=>`<span class="token ${i<sim.index?'done':i===sim.index?'next':''}">${esc(t)}</span>`).join('');$('trace').innerHTML=sim.trace.length?sim.trace.map(esc).join('<br>'):'I simboli sono separati da spazi o virgole.';
 $('symbol-buttons').innerHTML=symbols().map(s=>`<button data-symbol="${esc(s)}">＋ ${esc(s)}</button>`).join('');document.querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>{$('sequence').value=($('sequence').value.trim()+' '+b.dataset.symbol).trim();reset()});
}
function step(){if(issues().length){stop();toast('Risolvi le transizioni ambigue prima di eseguire');return}if(sim.blocked||sim.started&&sim.index>=sim.tokens.length){stop();return}sim.started=true;if(!sim.tokens.length){stop();renderAll();return}let symbol=sim.tokens[sim.index],edge=model.edges.find(e=>e.from===sim.current&&e.symbol===symbol),name=id=>model.states.find(s=>s.id===id).name;
 if(!edge){sim.trace.push(`Nessuna transizione da ${name(sim.current)} con «${symbol}». Sequenza rifiutata.`);sim.blocked=true;stop()}else{sim.trace.push(`${name(edge.from)} — ${symbol} → ${name(edge.to)}`);sim.current=edge.to;sim.index++;if(sim.index===sim.tokens.length)stop()}renderAll();}
$('title').onchange=e=>{checkpoint();model.title=e.target.value.trim()||'Il mio automa';save();renderAll()};$('sequence').oninput=()=>reset();$('reset').onclick=()=>reset();$('step').onclick=step;
$('run').onclick=()=>{if(timer){stop();return}if(sim.blocked||sim.started&&sim.index>=sim.tokens.length)reset(false);step();if(!sim.blocked&&sim.index<sim.tokens.length&&!issues().length){timer=setInterval(step,750);$('run').textContent='Ⅱ Pausa'}};
$('example').onchange=e=>{checkpoint();model=example(e.target.value);selected=null;mode='select';connectFrom=null;$('sequence').value=e.target.value==='binary'?'1 0 1':e.target.value==='traffic'?'timer timer timer':e.target.value==='empty'?'':'seleziona 20 20 10';commit();fit()};
$('add-state').onclick=$('canvas-add').onclick=()=>addState();$('add-edge').onclick=beginConnection;$('select-tool').onclick=()=>{mode='select';connectFrom=null;renderAll()};$('connect-tool').onclick=beginConnection;
function deleteSelectedState(){
 if(selected?.kind!=='state')return;
 const id=selected.id;
 if(!model.states.some(state=>state.id===id))return;
 if(model.states.length===1){toast('Mantieni almeno uno stato');return;}
 finishInlineEditor(false);checkpoint();
 model.states=model.states.filter(state=>state.id!==id);
 model.edges=model.edges.filter(edge=>edge.from!==id&&edge.to!==id);
 if(model.initial===id)model.initial=model.states[0].id;
 selected=null;connectFrom=null;mode='select';drag=null;commit();$('graph').focus();
}
function undo(){finishInlineEditor(false);if(!history.length)return;future.push(clone());model=JSON.parse(history.pop());selected=null;connectFrom=null;mode='select';commit();}
function redo(){finishInlineEditor(false);if(!future.length)return;history.push(clone());model=JSON.parse(future.pop());selected=null;connectFrom=null;mode='select';commit();}
$('undo').onclick=undo;$('redo').onclick=redo;
document.addEventListener('keydown',event=>{
 if(event.isComposing||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 const key=event.key.toLowerCase();
 if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
 if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
 if(key==='delete'&&selected?.kind==='state'){event.preventDefault();deleteSelectedState();return;}
 if(key==='s'){event.preventDefault();addState();}
 if(key==='c'){event.preventDefault();beginConnection();}
 if(key==='escape'){mode='select';connectFrom=null;selected=null;renderAll();}
});
function setView(view,persist=true){
 if(!validViewport(view))return;
 model.viewport={...view};$('graph').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 $('zoom-level').textContent=Math.round(100000/view.w)+'%';
 if(persist)save();positionInlineEditor();
}
function zoom(factor,anchor){
 if(drag)return;
 const v=model.viewport;
 const w=Math.max(125,Math.min(10000,v.w*factor)),ratio=w/v.w;
 const p=anchor||{x:v.x+v.w/2,y:v.y+v.h/2};
 setView({x:p.x-(p.x-v.x)*ratio,y:p.y-(p.y-v.y)*ratio,w,h:v.h*ratio});
}
function fit(){
 const b=bounds(),cx=b.x+b.w/2,cy=b.y+b.h/2,ratio=1000/660;
 if(b.w/b.h<ratio)b.w=b.h*ratio;else b.h=b.w/ratio;
 setView({x:cx-b.w/2,y:cy-b.h/2,w:b.w,h:b.h});
}
$('fit').onclick=fit;
$('zoom-in').onclick=()=>zoom(1/1.2);$('zoom-out').onclick=()=>zoom(1.2);
$('zoom-level').onclick=()=>{const v=model.viewport,cx=v.x+v.w/2,cy=v.y+v.h/2;setView({x:cx-500,y:cy-330,w:1000,h:660});};
$('graph').addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002),point(e));},{passive:false});
$('layout').onclick=()=>{checkpoint();let count=model.states.length;model.states.forEach((s,i)=>{let angle=2*Math.PI*i/count-Math.PI/2;s.x=count===1?500:500+Math.cos(angle)*Math.min(370,count*60);s.y=count===1?300:320+Math.sin(angle)*Math.min(230,count*45)});commit();fit()};
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function filename(){return model.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'automa'}
$('download-json').onclick=()=>download(new Blob([JSON.stringify(model,null,2)],{type:'application/json'}),filename()+'.json');$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{if(f.size>1000000)throw Error();let m=JSON.parse(await f.text());if(!validModel(m))throw Error();checkpoint();model=m;selected=null;commit();if(validViewport(model.viewport))setView(model.viewport);else fit();toast('Automa importato')}catch{toast('JSON non valido: verifica stati, coordinate, simboli e transizioni')}$('file').value=''};
$('png').onclick=async()=>{try{let svg=document.createElementNS(NS,'svg'),b=bounds();svg.setAttribute('xmlns',NS);svg.setAttribute('viewBox',`${b.x} ${b.y} ${b.w} ${b.h}`);svg.setAttribute('width',b.w);svg.setAttribute('height',b.h);draw(svg,true);let data=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([data],{type:'image/svg+xml'})),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});let scale=Math.min(2,4096/Math.max(b.w,b.h)),canvas=document.createElement('canvas');canvas.width=Math.ceil(b.w*scale);canvas.height=Math.ceil(b.h*scale);let ctx=canvas.getContext('2d');ctx.fillStyle='#fcfdf9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error();download(blob,filename()+'.png');toast('PNG esportato')}finally{URL.revokeObjectURL(url)}}catch{toast('Esportazione non riuscita. Riprova.')}};
reset(false);renderAll();if(validViewport(model.viewport))setView(model.viewport,false);else fit();save();
