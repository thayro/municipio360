(()=>{'use strict';
const $=id=>document.getElementById(id), state={uf:'',cities:[],city:null,topic:'geral',section:'visao',mapLoading:false};
const setStatus=(message,kind='')=>{const el=$('appStatus');if(el){el.textContent=message;el.className='app-status'+(kind?' is-'+kind:'')}};
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
async function api(path){
 const endpoint=new URL('api/'+path, document.baseURI);
 let r;try{r=await fetch(endpoint.toString(),{cache:'no-store',headers:{'Accept':'application/json'}})}catch(e){throw new Error('Falha de rede ao acessar '+endpoint.pathname+': '+(e?.message||e))}
 let v;try{v=await r.json()}catch{throw new Error('API '+endpoint.pathname+' retornou conteúdo não JSON (HTTP '+r.status+')')}
 if(!r.ok||!v||v.ok!==true)throw new Error((v?.error||'Falha na consulta (HTTP '+r.status+')')+(v?.detail?' — '+v.detail:''));return v;
}
function placeholder(id,msg){$(id).innerHTML='<div class="placeholder">'+escapeHtml(msg)+'</div>'}
function ufCode(city){return city?.microrregiao?.mesorregiao?.UF?.sigla||city?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla||state.uf}
function selectUF(uf){if(!uf){resetBrazil();return;}hideMunicipalTooltip();setStatus('Carregando municípios de '+uf+'...', 'loading');state.uf=uf;state.city=null;state.cities=[];$('ufSelect').value=uf;$('citySelect').disabled=true;$('citySearch').disabled=true;$('citySelect').innerHTML='<option>Carregando municípios...</option>';$('placeTag').textContent=uf+' · selecione o município';$('locationHeading').textContent='Estado: '+uf;$('locationDetails').textContent='Escolha um município para visualizar seus dados.';
document.querySelectorAll('#mapa .uf').forEach(el=>el.classList.toggle('selected',el.dataset.uf===uf));placeholder('newsList','Selecione um município para notícias locais.');placeholder('contractsList','Selecione um município para licitações locais.');loadCities(uf).then(()=>{if(state.uf===uf)loadMunicipalMap(uf)});}
async function loadCities(uf){try{const d=await api('localidades.php?tipo=municipios&uf='+uf);if(state.uf!==uf)return;state.cities=Array.isArray(d.data)?d.data:[];setStatus(state.cities.length+' municípios carregados para '+uf+'. Selecione uma cidade.');$('citySearch').disabled=false;$('citySelect').disabled=false;renderCityOptions();$('totalCities').textContent=String(state.cities.length)+' em '+uf;}catch(e){$('citySelect').innerHTML='<option>Falha ao carregar municípios</option>';$('locationDetails').textContent=e.message;setStatus('Falha na consulta dos municípios: '+e.message,'error')}}
function renderCityOptions(){const term=$('citySearch').value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');const options=state.cities.filter(c=>c.nome.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(term));const current=state.city?.id||'';$('citySelect').innerHTML='<option value="">Selecione o município ('+options.length+')</option>'+options.map(c=>'<option value="'+c.id+'" '+(String(c.id)===String(current)?'selected':'')+'>'+escapeHtml(c.nome)+'</option>').join('')}
async function selectCity(id){const city=state.cities.find(c=>String(c.id)===String(id));if(!city)return;state.city=city;setStatus('Município '+city.nome+' selecionado. Consultando notícias e contratações...');$('placeTag').textContent=city.nome+' / '+ufCode(city);$('locationHeading').textContent=city.nome+' — '+ufCode(city);$('locationDetails').textContent='Código IBGE: '+city.id+' · Fontes: IBGE, notícias indexadas e PNCP.';$('ibgeLink').href='https://cidades.ibge.gov.br/brasil/'+city.id+'/panorama';$('prefeitoMeta').textContent='Prefeito atual: ainda não verificado automaticamente. Confira no portal da Prefeitura e no TSE.';$('vereadoresMeta').textContent='Composição atual da Câmara: consulte a fonte institucional; não inferimos vereadores apenas pelos resultados eleitorais.';const q=encodeURIComponent('prefeitura '+city.nome+' '+state.uf);$('govLinks').innerHTML='<a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+q+'">Localizar prefeitura ↗</a><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+encodeURIComponent('câmara municipal '+city.nome+' '+state.uf)+'">Localizar Câmara ↗</a>';highlightMunicipality(String(city.id));loadGovernance();loadFinance();loadSocial();$('totalNews').textContent='…';$('totalBids').textContent='…';loadNews();loadContracts();}

async function loadGovernance(){
 const city=state.city;if(!city)return;
 $('prefeitoMeta').textContent='Consultando dados públicos...';$('vereadoresMeta').textContent='Verificando fontes disponíveis...';
 const cards=$('officialCards');if(cards)cards.innerHTML='<div class="placeholder">Consultando referências públicas...</div>';
 try{const d=await api('representantes.php?id='+encodeURIComponent(city.id)+'&nome='+encodeURIComponent(city.nome)+'&uf='+encodeURIComponent(state.uf));if(state.city?.id!==city.id)return;
  const mayor=d.prefeito;
  $('prefeitoMeta').textContent=mayor?mayor.nome+' · '+(mayor.partido||'Partido não informado')+' · Fonte '+mayor.fonte+' (não confirmado como ocupante atual)':'Prefeito: não confirmado na resposta oficial desta consulta.';
  const people=[...(mayor?[{...mayor,cargo:'Prefeitura'}]:[]),...(d.vereadores||[]).map(x=>({...x,cargo:'Câmara'}))];
  if(cards)cards.innerHTML=people.length?people.map(x=>'<article class="official-person">'+(x.foto?'<img loading="lazy" referrerpolicy="no-referrer" src="'+escapeHtml(x.foto)+'" alt="Foto de '+escapeHtml(x.nome)+'">':'<span class="person-avatar" aria-hidden="true">♙</span>')+'<div><strong>'+escapeHtml(x.nome)+'</strong><small>'+escapeHtml(x.cargo)+' · '+escapeHtml(x.partido||'Partido não informado')+'</small><small>'+escapeHtml(x.fonte)+' · referência não confirmada para mandato atual</small>'+(x.url?'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(x.url)+'">Consultar fonte ↗</a>':'')+'</div></article>').join(''):'<div class="placeholder">Não foram encontrados nomes verificáveis nas fontes estruturadas consultadas. Utilize os links oficiais para identificar ocupantes e confirmar mandatos.</div>';
  updateSocialPeople(people);$('vereadoresMeta').textContent=(d.vereadores||[]).length?(d.vereadores.length+' nomes de referência disponíveis; confirmação de mandato necessária'):'Vereadores: sem nomes confirmados na resposta da consulta.';
 }catch(e){$('prefeitoMeta').textContent='Consulta de representantes indisponível: '+e.message;$('vereadoresMeta').textContent='Consulte os canais oficiais da Câmara.';if(cards)cards.innerHTML='<div class="placeholder">Não foi possível consultar dados de representantes.</div>'}
}

async function loadNews(){if(!state.city)return;const id=state.city.id,topic=state.topic;placeholder('newsList','Consultando fontes de notícias...');
 const responses=await Promise.allSettled([api('noticias.php?id='+id+'&tema='+encodeURIComponent(topic)),api('rss.php?id='+id+'&tema='+encodeURIComponent(topic))]);
 if(state.city?.id!==id||state.topic!==topic)return;let items=[],failed=[];
 responses.forEach((res,i)=>{if(res.status==='fulfilled')items.push(...(res.value.noticias||[]).map(n=>({...n,origem:i===0?'GDELT':'RSS'})));else failed.push((i===0?'GDELT':'RSS')+': '+res.reason.message)});
 let seen=new Set();items=items.filter(n=>{const key=String(n.titulo||'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9à-ÿ]/g,'').slice(0,100);if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,60);
 $('totalNews').textContent=items.length;$('newsCount').textContent=items.length+' resultados';
 $('newsList').innerHTML=items.length?items.map(n=>'<a class="news-item" href="'+escapeHtml(n.url)+'" target="_blank" rel="noopener noreferrer"><span class="source">'+escapeHtml(n.fonte||'Fonte externa')+' · '+escapeHtml(n.origem)+'</span><h3>'+escapeHtml(n.titulo)+'</h3><div class="metadata">'+escapeHtml(formatDate(n.data))+' · Abrir reportagem ↗</div></a>').join(''):'<div class="placeholder">Nenhuma notícia localizada nesta consulta. Isso não significa ausência de acontecimentos.</div>';
 if(failed.length){const d=document.createElement('div');d.className='note';d.textContent='Fontes indisponíveis nesta consulta: '+failed.join(' | ');$('newsList').append(d)}
}
function formatDate(v){if(!v)return 'Data não fornecida';if(/^\d{14}$/.test(v))return v.slice(6,8)+'/'+v.slice(4,6)+'/'+v.slice(0,4)+' '+v.slice(8,10)+':'+v.slice(10,12);return v}
const currency=v=>typeof v==='number'?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Valor não divulgado';
async function loadContracts(){if(!state.city)return;const id=state.city.id;placeholder('contractsList','Consultando o PNCP...');try{const d=await api('contratacoes.php?id='+id);if(state.city?.id!==id)return;const items=d.itens||[];$('totalBids').textContent=items.length;$('contractCount').textContent=items.length+' resultados';$('contractsList').innerHTML=items.length?items.map(c=>'<a class="contract-item" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(c.link)+'"><span class="source">'+escapeHtml(c.modalidade)+'</span><h3>'+escapeHtml(c.objeto||'Contratação')+'</h3><div class="metadata">'+escapeHtml(c.orgao||'Órgão não informado')+' · '+escapeHtml(c.publicacao||'Sem data')+'</div><div class="contract-value">'+escapeHtml(currency(c.valor))+' ↗</div></a>').join(''):'<div class="placeholder">Nenhum registro retornado nas duas modalidades e no período consultado.</div>';}catch(e){placeholder('contractsList','PNCP indisponível: '+e.message);$('totalBids').textContent='—';$('contractCount').textContent='—'}}
const brasilMarkup=$('svgWrap').innerHTML;
let mapRequest=0;
function restoreBrazil(){hideMunicipalTooltip();mapRequest++;$('svgWrap').innerHTML=brasilMarkup;$('mapMode').textContent='Brasil: selecione uma UF';$('mapBack').hidden=true;wireMap();}
function resetBrazil(){
 state.uf='';state.city=null;state.cities=[];
 $('ufSelect').value='';$('citySelect').disabled=true;$('citySelect').innerHTML='<option value="">Selecione um estado primeiro</option>';
 $('citySearch').value='';$('citySearch').disabled=true;
 $('placeTag').textContent='Brasil · todos os estados';
 $('locationHeading').textContent='Brasil';
 $('locationDetails').textContent='Selecione um estado ou município para visualizar seus dados.';
 $('totalCities').textContent='—';$('ibgeLink').removeAttribute('href');
 $('prefeitoMeta').textContent='Selecione um município para consultar os representantes.';
 $('vereadoresMeta').textContent='Selecione um município para consultar a Câmara.';
 $('govLinks').innerHTML='';
 restoreBrazil();
 setStatus('Visão nacional restaurada. Selecione um estado no mapa ou no filtro.');
 loadBrazilFeeds();
}
function highlightMunicipality(id){
 document.querySelectorAll('.municipal-shape').forEach(p=>p.classList.toggle('selected',p.dataset.id===id));
 // Nomes nunca ficam impressos no mapa; somente tooltip do hover/foco.
}
const UF_REGION={AC:'norte',AP:'norte',AM:'norte',PA:'norte',RO:'norte',RR:'norte',TO:'norte',AL:'nordeste',BA:'nordeste',CE:'nordeste',MA:'nordeste',PB:'nordeste',PE:'nordeste',PI:'nordeste',RN:'nordeste',SE:'nordeste',DF:'centro',GO:'centro',MT:'centro',MS:'centro',ES:'sudeste',MG:'sudeste',RJ:'sudeste',SP:'sudeste',PR:'sul',RS:'sul',SC:'sul'};
function tooltip(){let el=$('municipalityTooltip');if(!el){el=document.createElement('div');el.id='municipalityTooltip';el.className='municipality-tooltip';el.setAttribute('role','tooltip');document.body.appendChild(el)}return el}
function hideMunicipalTooltip(){tooltip().classList.remove('is-visible')}
function showMunicipalTooltip(label,e){const t=tooltip();t.textContent=label;t.classList.add('is-visible');let x=(e?.clientX??innerWidth/2)+14,y=(e?.clientY??innerHeight/2)+12;const b=t.getBoundingClientRect();t.style.left=Math.max(8,Math.min(x,innerWidth-b.width-8))+'px';t.style.top=Math.max(8,Math.min(y,innerHeight-b.height-8))+'px'}
function renderMunicipalGeojson(geo,uf){
 const feats=Array.isArray(geo.features)?geo.features:[];if(!feats.length)throw new Error('Nenhum polígono municipal recebido');
 const coords=[];for(const f of feats){const geom=f.geometry||{};if(geom.type==='Polygon')coords.push(...geom.coordinates.flat());if(geom.type==='MultiPolygon')coords.push(...geom.coordinates.flat(2));}
 const pts=coords.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));if(!pts.length)throw new Error('Geometria inválida');
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const pt of pts){if(pt[0]<minX)minX=pt[0];if(pt[0]>maxX)maxX=pt[0];if(pt[1]<minY)minY=pt[1];if(pt[1]>maxY)maxY=pt[1]}let dx=Math.max(.00001,maxX-minX),dy=Math.max(.00001,maxY-minY);
 const W=620,H=520,pad=16,scale=Math.min((W-2*pad)/dx,(H-2*pad)/dy);const tx=x=>pad+(x-minX)*scale+(W-2*pad-dx*scale)/2,ty=y=>H-pad-(y-minY)*scale-(H-2*pad-dy*scale)/2;
 const polyPath=p=>p.map(r=>r.map((xy,i)=>(i?'L':'M')+tx(xy[0]).toFixed(1)+' '+ty(xy[1]).toFixed(1)).join('')+'Z').join('');
 const region=UF_REGION[uf]||'centro';
 const paths=feats.map((f,index)=>{const g=f.geometry||{},pr=f.properties||{};const raw=String(pr.codarea||pr.CD_MUN||pr.id||f.id||'');const known=state.cities.find(c=>String(c.id)===raw);const label=pr.nome||pr.NM_MUN||pr.name||known?.nome||'Nome indisponível';const polys=g.type==='MultiPolygon'?g.coordinates:g.type==='Polygon'?[g.coordinates]:[];
 const shade=index%5;
 return '<path class="municipal-shape region-'+region+' shade-'+shade+'" data-id="'+escapeHtml(raw)+'" data-name="'+escapeHtml(label)+'" tabindex="0" role="button" aria-label="'+escapeHtml(label)+'" d="'+polys.map(polyPath).join('')+'"><title>'+escapeHtml(label)+'</title></path>'}).join('');
 $('svgWrap').innerHTML='<svg id="mapaMunicipal" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Malha de municípios de '+escapeHtml(uf)+'">'+paths+'</svg>';
 document.querySelectorAll('.municipal-shape').forEach(p=>{const fn=()=>{let c=state.cities.find(c=>String(c.id)===p.dataset.id)||state.cities.find(c=>c.nome.toLowerCase()===p.dataset.name.toLowerCase());if(c){$('citySelect').value=c.id;selectCity(c.id)}else setStatus('Município não identificado na lista IBGE: '+p.dataset.name,'error')};p.addEventListener('click',fn);p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}});p.addEventListener('pointerenter',e=>showMunicipalTooltip(p.dataset.name,e));p.addEventListener('pointermove',e=>showMunicipalTooltip(p.dataset.name,e));p.addEventListener('pointerleave',hideMunicipalTooltip);p.addEventListener('focus',e=>{const r=p.getBoundingClientRect();showMunicipalTooltip(p.dataset.name,{clientX:r.left+r.width/2,clientY:r.top+r.height/2})});p.addEventListener('blur',hideMunicipalTooltip)});

}
async function loadMunicipalMap(uf){const request=++mapRequest;$('mapMode').textContent='Carregando malha dos municípios de '+uf+'…';$('mapBack').hidden=false;
 try{let d=await api('malha.php?uf='+encodeURIComponent(uf));if(request!==mapRequest)return;renderMunicipalGeojson(d.data,uf);$('mapMode').textContent='Mapa municipal de '+uf+' · clique para selecionar uma cidade';}
 catch(e){if(request!==mapRequest)return;$('mapMode').textContent='Malha municipal indisponível: '+e.message+' · use a lista acima';$('svgWrap').innerHTML=brasilMarkup;wireMap()}}
function wireMap(){document.querySelectorAll('#mapa .uf').forEach(el=>{el.classList.add('region-'+(UF_REGION[el.dataset.uf]||'centro'));el.setAttribute('tabindex','0');el.setAttribute('role','button');const fn=()=>selectUF(el.dataset.uf);el.addEventListener('click',fn);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})})}
const appLayout=$('appLayout'),sidebarToggle=$('sidebarToggle'),sidebarBackdrop=$('sidebarBackdrop');
const mobileSidebar=()=>window.matchMedia('(max-width:700px)').matches;
function syncSidebarAria(){const open=mobileSidebar()?appLayout.classList.contains('sidebar-open'):!appLayout.classList.contains('sidebar-collapsed');sidebarToggle.setAttribute('aria-expanded',String(open));sidebarToggle.setAttribute('aria-label',open?'Recolher menu lateral':'Abrir menu lateral');sidebarBackdrop.setAttribute('aria-hidden',String(!open));}
function setSidebarOpen(open){if(mobileSidebar()){appLayout.classList.toggle('sidebar-open',open);}else{appLayout.classList.toggle('sidebar-collapsed',!open);}syncSidebarAria();}
sidebarToggle.addEventListener('click',()=>setSidebarOpen(mobileSidebar()?!appLayout.classList.contains('sidebar-open'):appLayout.classList.contains('sidebar-collapsed')));
sidebarBackdrop.addEventListener('click',()=>setSidebarOpen(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobileSidebar()&&appLayout.classList.contains('sidebar-open')){setSidebarOpen(false);sidebarToggle.focus();}});
window.addEventListener('resize',()=>{if(!mobileSidebar())appLayout.classList.remove('sidebar-open');syncSidebarAria();});
if(mobileSidebar())appLayout.classList.add('sidebar-collapsed');
syncSidebarAria();
$('mapBack').addEventListener('click',resetBrazil);
function showSection(sec){if(window.matchMedia('(max-width:700px)').matches)setSidebarOpen(false);state.section=sec;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.section===sec));const map={visao:'.map-panel',noticias:'.news-panel',contratacoes:'.contracts-panel',gestao:'.governance-panel'};document.querySelector(map[sec])?.scrollIntoView({behavior:'smooth',block:'start'});}
$('ufSelect').addEventListener('change',e=>selectUF(e.target.value));$('citySearch').addEventListener('input',renderCityOptions);$('citySelect').addEventListener('change',e=>selectCity(e.target.value));$('refresh').addEventListener('click',()=>{if(state.city){loadNews();loadContracts();loadGovernance();loadFinance();loadSocial()}else{loadStates();loadBrazilFeeds()}});document.querySelectorAll('#mapa .uf').forEach(el=>{el.classList.add('region-'+(UF_REGION[el.dataset.uf]||'centro'));el.setAttribute('tabindex','0');el.setAttribute('role','button');const fn=()=>selectUF(el.dataset.uf);el.addEventListener('click',fn);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})});
document.querySelectorAll('#filters .pill').forEach(b=>b.addEventListener('click',()=>{state.topic=b.dataset.topic;document.querySelectorAll('#filters .pill').forEach(x=>x.classList.toggle('chosen',x===b));if(state.city)loadNews();else loadBrazilFeeds()}));document.querySelectorAll('.nav').forEach(n=>n.addEventListener('click',()=>showSection(n.dataset.section)));
async function loadBrazilFeeds(){
 if(state.city)return;
 placeholder('newsList','Consultando notícias municipais de todo o Brasil...');placeholder('contractsList','Consultando licitações municipais nacionais...');
 const results=await Promise.allSettled([api('brasil_noticias.php'),api('brasil_contratacoes.php')]);
 if(state.city)return;
 if(results[0].status==='fulfilled'){
  const v=results[0].value,items=v.noticias||[];
  $('newsList').innerHTML=items.length?items.map(n=>'<a class="news-item" href="'+escapeHtml(n.url)+'" target="_blank" rel="noopener noreferrer"><span class="source">'+escapeHtml(n.fonte||'Noticiário')+' · Brasil</span><h3>'+escapeHtml(n.titulo)+'</h3><div class="metadata">'+escapeHtml(formatDate(n.data))+' · Ler notícia ↗</div></a>').join(''):'<div class="placeholder">A fonte não retornou notícias nesta consulta nacional.</div>';
  $('totalNews').textContent=items.length;$('newsCount').textContent=items.length+' Brasil';
 }else{placeholder('newsList','Notícias nacionais temporariamente indisponíveis: '+results[0].reason.message);$('totalNews').textContent='—'}
 if(results[1].status==='fulfilled'){
  const v=results[1].value,items=v.itens||[];
  $('contractsList').innerHTML=items.length?items.map(c=>'<a class="contract-item" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(c.link)+'"><span class="source">'+escapeHtml(c.modalidade)+' · '+escapeHtml(c.municipio||c.uf||'Brasil')+'</span><h3>'+escapeHtml(c.objeto||'Contratação')+'</h3><div class="metadata">'+escapeHtml(c.orgao||'Órgão municipal')+' · '+escapeHtml(c.publicacao||'Sem data')+'</div><div class="contract-value">'+escapeHtml(currency(c.valor))+' ↗</div></a>').join(''):'<div class="placeholder">Nenhum órgão municipal encontrado nesta amostra nacional do PNCP.</div>';
  $('totalBids').textContent=items.length;$('contractCount').textContent=items.length+' Brasil';
 }else{placeholder('contractsList','PNCP nacional temporariamente indisponível: '+results[1].reason.message);$('totalBids').textContent='—'}
}
async function loadStates(){setStatus('Consultando unidades federativas do IBGE...', 'loading');try{const d=await api('localidades.php?tipo=estados');const items=Array.isArray(d.data)?d.data:[];if(items.length===0)throw new Error('API IBGE retornou lista vazia');$('totalStates').textContent=items.length;setStatus(items.length+' unidades federativas carregadas. Selecione um estado no mapa ou na lista.');$('ufSelect').innerHTML='<option value="">Brasil — Todos os estados</option>'+items.map(x=>'<option value="'+escapeHtml(x.sigla)+'">'+escapeHtml(x.nome)+'</option>').join('')}catch(e){$('ufSelect').innerHTML='<option>IBGE indisponível</option>';setStatus('Não foi possível carregar estados: '+e.message,'error');console.error('Município360: ',e)}}

function updateSocialPeople(people){const el=$('socialPerson');if(!el)return;const original=el.value;const unique=new Set();let options='<option value="">Município / prefeitura / câmara</option>';for(const p of people){if(!p.nome||unique.has(p.nome))continue;unique.add(p.nome);options+='<option value="'+escapeHtml(p.nome)+'">'+escapeHtml(p.cargo+': '+p.nome)+'</option>'}el.innerHTML=options;el.value=unique.has(original)?original:''}
async function loadFinance(){const city=state.city;if(!city)return;const id=String(city.id),year=$('financeYear').value;placeholder('financeList','Consultando contas anuais no SICONFI...');$('financeCount').textContent='…';try{const r=await api('financas.php?id='+id+'&ano='+encodeURIComponent(year));if(String(state.city?.id)!==id||$('financeYear').value!==year)return;$('financeCount').textContent=r.disponivel?'DCA '+year:'Indisponível';const link=r.consulta_api||r.fonte_url;let html='<div class="note">'+escapeHtml(r.nota||r.mensagem||'')+'</div>';if(r.disponivel){html+='<div class="note">'+escapeHtml(String(r.quantidade_retornada))+' lançamentos retornados nesta consulta. Os lançamentos são brutos, não somados para evitar dupla contagem.</div>';const lines=(r.amostra||[]).filter(x=>x.descricao||x.conta).slice(0,20);html+=lines.map(x=>'<div class="contract-item"><strong>'+escapeHtml(x.descricao||x.conta)+'</strong><div class="metadata">'+escapeHtml(x.anexo||'DCA')+' · '+escapeHtml(x.conta||'')+'</div>'+(x.valor!==null?'<div class="contract-value">'+escapeHtml(currency(x.valor))+'</div>':'')+'</div>').join('')}else html+='<div class="placeholder">Nenhum dado contábil confirmado para este exercício pela fonte consultada.</div>';html+='<a class="textlink" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(link)+'">Abrir fonte fiscal oficial ↗</a>';$('financeList').innerHTML=html}catch(e){$('financeCount').textContent='—';placeholder('financeList','Consulta fiscal falhou: '+e.message)}}
async function loadSocial(){const city=state.city;if(!city)return;const id=String(city.id),person=$('socialPerson').value;placeholder('socialList','Buscando notícias e menções indexadas...');$('socialLinks').innerHTML='';$('socialCount').textContent='…';try{const d=await api('social.php?id='+id+'&pessoa='+encodeURIComponent(person));if(String(state.city?.id)!==id||$('socialPerson').value!==person)return;const n=d.noticias_indexadas||[];$('socialCount').textContent=n.length+' notícias';$('socialLinks').innerHTML=(d.consultas_sociais||[]).map(x=>'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(x.url)+'">'+escapeHtml(x.rede)+' ↗</a>').join('');$('socialList').innerHTML=n.length?n.map(x=>'<a class="news-item" href="'+escapeHtml(x.url)+'" target="_blank" rel="noopener noreferrer"><span class="source">'+escapeHtml(x.fonte)+' · fonte indexada</span><h3>'+escapeHtml(x.titulo)+'</h3><div class="metadata">'+escapeHtml(formatDate(x.data))+'</div></a>').join(''):'<div class="placeholder">Nenhuma menção jornalística encontrada nesta consulta. Utilize os links para pesquisar publicações sociais diretamente.</div>';$('socialNotice').textContent=d.aviso}catch(e){$('socialCount').textContent='—';placeholder('socialList','Busca de menções falhou: '+e.message)}}
$('socialPerson').addEventListener('change',loadSocial);
$('financeYear').addEventListener('change',loadFinance);

window.addEventListener('error',e=>{setStatus('Erro na interface: '+(e.message||'Falha desconhecida')+'. Consulte o console do navegador.','error')});
loadStates();
loadBrazilFeeds();
})();
