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
function selectUF(uf){if(!uf){resetBrazil();return;}hideMunicipalTooltip();setStatus('Carregando municípios de '+uf+'...', 'loading');state.uf=uf;state.city=null;state.cities=[];resetUnifiedMedia('uf:'+uf);resetGovernanceTitles();$('ufSelect').value=uf;$('citySelect').disabled=true;$('citySearch').disabled=true;$('citySelect').innerHTML='<option>Carregando municípios...</option>';$('placeTag').textContent=uf+' · selecione o município';$('locationHeading').textContent='Estado: '+uf;$('locationDetails').textContent='Escolha um município para visualizar seus dados.';
document.querySelectorAll('#mapa .uf').forEach(el=>el.classList.toggle('selected',el.dataset.uf===uf));placeholder('newsList','Selecione um município para notícias locais.');placeholder('contractsList','Selecione um município para licitações locais.');return loadCities(uf).then(()=>{if(state.uf===uf)loadMunicipalMap(uf)});}
async function loadCities(uf){try{const d=await api('localidades.php?tipo=municipios&uf='+uf);if(state.uf!==uf)return;state.cities=Array.isArray(d.data)?d.data:[];setStatus(state.cities.length+' municípios carregados para '+uf+'. Selecione uma cidade.');$('citySearch').disabled=false;$('citySelect').disabled=false;renderCityOptions();$('totalCities').textContent=String(state.cities.length)+' em '+uf;}catch(e){$('citySelect').innerHTML='<option>Falha ao carregar municípios</option>';$('locationDetails').textContent=e.message;setStatus('Falha na consulta dos municípios: '+e.message,'error')}}
function renderCityOptions(){const term=$('citySearch').value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');const options=state.cities.filter(c=>c.nome.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(term));const current=state.city?.id||'';$('citySelect').innerHTML='<option value="">Selecione o município ('+options.length+')</option>'+options.map(c=>'<option value="'+c.id+'" '+(String(c.id)===String(current)?'selected':'')+'>'+escapeHtml(c.nome)+'</option>').join('')}
async function selectCity(id){const city=state.cities.find(c=>String(c.id)===String(id));if(!city)return;state.city=city;resetGovernanceTitles();setStatus('Município '+city.nome+' selecionado. Consultando notícias e contratações...');$('placeTag').textContent=city.nome+' / '+ufCode(city);$('locationHeading').textContent=city.nome+' — '+ufCode(city);$('locationDetails').textContent='Código IBGE: '+city.id+' · Fontes: IBGE, notícias indexadas e PNCP.';$('ibgeLink').href='https://cidades.ibge.gov.br/brasil/'+city.id+'/panorama';$('prefeitoMeta').textContent='Prefeito atual: ainda não verificado automaticamente. Confira no portal da Prefeitura e no TSE.';$('vereadoresMeta').textContent='Composição atual da Câmara: consulte a fonte institucional; não inferimos vereadores apenas pelos resultados eleitorais.';const q=encodeURIComponent('prefeitura '+city.nome+' '+state.uf);$('govLinks').innerHTML='<a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+q+'">Localizar prefeitura ↗</a><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+encodeURIComponent('câmara municipal '+city.nome+' '+state.uf)+'">Localizar Câmara ↗</a>';highlightMunicipality(String(city.id));resetUnifiedMedia('city:'+city.id);loadGovernance();loadFinance();loadSocial();$('totalNews').textContent='…';$('totalBids').textContent='…';loadNews();loadContracts();}

function representativeSocialLinks(x){
 const q=[x.nome,state.city?.nome||'',state.uf||''].filter(Boolean).join(' ');
 const links=[['Instagram','site:instagram.com '+q],['Facebook','site:facebook.com '+q],['Site pessoal',q+' site oficial']];
 const direct=Array.isArray(x.perfis_confirmados)?x.perfis_confirmados.filter(p=>p&&/^https:\/\//i.test(String(p.url||''))):[];
 return '<div class="rep-social"><small>Perfis: buscas externas, sem verificação de identidade</small><div>'+
 direct.map(p=>'<a href="'+escapeHtml(p.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(p.rede||'Perfil confirmado')+' ↗</a>').join('')+
 links.map(([label,query])=>'<a href="https://www.google.com/search?q='+encodeURIComponent(query)+'" target="_blank" rel="noopener noreferrer">Buscar '+escapeHtml(label)+' ↗</a>').join('')+'</div></div>';
}
function representativeCard(x){
 const photo=x.foto?'<img loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false" src="'+escapeHtml(x.foto)+'" alt="Foto eleitoral de '+escapeHtml(x.nome)+'"><span class="person-avatar" hidden aria-hidden="true">♙</span>':'<span class="person-avatar" aria-hidden="true">♙</span>';
 return '<article class="official-person rep-modern">'+
  '<div class="rep-photo">'+photo+'</div>'+
  '<div class="rep-details"><strong>'+escapeHtml(x.nome)+'</strong><small>'+escapeHtml(x.cargo)+'</small><small class="rep-party">'+escapeHtml(x.partido||'Partido não informado')+'</small></div>'+
  '<div class="rep-score" data-person="'+escapeHtml(x.nome)+'"><div class="rep-score-meter" role="status" aria-label="Índice de tom de notícias ainda não calculado"><strong>…</strong><span>/ 1000</span></div></div>'+
  '<button type="button" class="rep-profile-open" aria-haspopup="dialog">Ver perfil ↗</button><div class="rep-profile-body" hidden>'+
  '<small>'+escapeHtml(x.fonte||'Fonte eleitoral')+' · mandato atual não verificado</small>'+
  (x.url?'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(x.url)+'">Consultar fonte oficial ↗</a>':'')+
  representativeSocialLinks(x)+
  '<div class="rep-score-notice">Indicador experimental baseado em manchetes indexadas, não mede caráter, aprovação ou desempenho. Sem nota quando não há evidência suficiente.</div>'+
  '</div></article>';
}

// Modal acessível de perfil: copia os dados atualizados do cartão ao abrir.
let profileReturnFocus=null;
function closeRepresentativeProfile(){
 const dialog=document.getElementById('representativeProfileDialog');
 if(!dialog||!dialog.open)return;
 dialog.close();
 if(profileReturnFocus?.isConnected)profileReturnFocus.focus();
 profileReturnFocus=null;
}
document.addEventListener('click',event=>{
 const trigger=event.target.closest('.rep-profile-open');
 if(!trigger)return;
 const card=trigger.closest('.official-person');
 if(!card)return;
 let dialog=document.getElementById('representativeProfileDialog');
 if(!dialog){
  dialog=document.createElement('dialog');
  dialog.id='representativeProfileDialog';
  dialog.className='representative-profile-dialog';
  dialog.innerHTML='<div class="rep-dialog-head"><h3 id="repDialogTitle">Perfil do representante</h3><button type="button" class="rep-dialog-close" aria-label="Fechar perfil">✕</button></div><div class="rep-dialog-content"></div>';
  dialog.setAttribute('aria-labelledby','repDialogTitle');
  document.body.appendChild(dialog);
  dialog.querySelector('.rep-dialog-close').addEventListener('click',closeRepresentativeProfile);
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeRepresentativeProfile();});
  dialog.addEventListener('close',()=>{if(profileReturnFocus?.isConnected)profileReturnFocus.focus();profileReturnFocus=null;});
 }
 const title=card.querySelector('.rep-details strong')?.textContent||'Representante';
 dialog.querySelector('#repDialogTitle').textContent=title;
 const photo=card.querySelector('.rep-photo')?.cloneNode(true);
 const details=card.querySelector('.rep-profile-body')?.cloneNode(true);
 const summary=card.querySelector('.rep-details')?.cloneNode(true);
 const score=card.querySelector('.rep-score')?.cloneNode(true);
 const body=dialog.querySelector('.rep-dialog-content');
 body.replaceChildren();
 const top=document.createElement('div');top.className='rep-dialog-summary';
 if(photo)top.append(photo);
 if(summary)top.append(summary);
 if(score)top.append(score);
 body.append(top);
 if(details){details.hidden=false;body.append(details);}
 profileReturnFocus=trigger;
 if(!dialog.open)dialog.showModal();
});


// Publicações sociais verificáveis não são confundidas com sentimento ou aprovação municipal.
// Classificação conservadora de linguagem de títulos. Não decide a veracidade dos fatos.
function scoreHeadline(text){
 const s=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const positive=['premia','premiado','reconhec','aprovad','homenage','conquista','destaque','elogia'];
 const negative=['condenad','cassad','denunciad','investigad','acusad','critica','multad','afastad'];
 const plus=positive.some(w=>s.includes(w)),minus=negative.some(w=>s.includes(w));
 return plus===minus?0:plus?1:-1;
}
async function inspectRepresentativeMedia(panel){
 const card=panel?.closest('.official-person'),city=state.city;
 if(!panel||!card||!city)return;
 const id=String(city.id),name=panel.dataset.person;
 const status=panel.querySelector('.rep-score-state');
 if(status)status.textContent='Consultando…';
 try{
  const r=await api('social.php?id='+encodeURIComponent(id)+'&pessoa='+encodeURIComponent(name));
  if(String(state.city?.id)!==id||!panel.isConnected)return;
  const unique=new Map(),domains=new Set();
  (r.noticias_indexadas||[]).forEach(x=>{
   try{
    const u=new URL(String(x.url||''));
    if(!['https:','http:'].includes(u.protocol))return;
    const title=String(x.titulo||'').trim();
    if(!title)return;
    // Links RSS do Google Notícias têm domínio news.google.com; a fonte real vem em x.fonte.
    const source=String(x.fonte||'').trim()||u.hostname.replace(/^www\./,'');
    const key=title.normalize('NFD').toLowerCase();
    if(!unique.has(key)){unique.set(key,x);domains.add(source.toLocaleLowerCase('pt-BR'));}
   }catch{}
  });
  const items=[...unique.values()];
  const meter=panel.querySelector('.rep-score-meter');
  let info='';const labels=items.length+' matérias, '+domains.size+' fontes distintas (busca de até 30 dias; fonte: '+String(r.fonte||'não informada')+').';
  if(items.length>=5&&domains.size>=3){
   const tones=items.map(x=>scoreHeadline(x.titulo));
   const points=Math.round(500+tones.reduce((a,b)=>a+b,0)/tones.length*350);
   meter.querySelector('strong').textContent=String(points);
   meter.setAttribute('aria-label','Índice experimental de tom das manchetes: '+points+' de 1000');
   meter.style.setProperty('--score-progress',(points/1000*100).toFixed(1)+'%');
   const color=points<350?'#f87171':points<500?'#fb923c':points<650?'#60a5fa':'#4ade80';
   meter.style.setProperty('--score-color',color);
   info='<small>'+labels+' Pontuação baseada somente em palavras das manchetes; pode classificar mal contexto, ironia e citações.</small>';
  }else{
   meter.querySelector('strong').textContent='N/D';
   meter.setAttribute('aria-label','Dados insuficientes para calcular o indicador');
   meter.style.setProperty('--score-color','#8091a7');
   meter.style.setProperty('--score-progress','0%');
   info='<small>Dados insuficientes para uma pontuação: '+labels+' Mínimo de 5 matérias e 3 fontes independentes. '+escapeHtml(r.aviso||'')+'</small>';
  }
  const notice=card.querySelector('.rep-score-notice');
  notice.innerHTML=info+(items.length?'<details><summary>Ver manchetes e fontes</summary>'+items.slice(0,15).map(x=>'<a href="'+escapeHtml(x.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(x.titulo||'Notícia')+' ↗</a>').join('')+'</details>':'<small>Não foram encontradas matérias; isso não representa avaliação negativa.</small>');
  if(status)status.textContent=items.length>=5&&domains.size>=3?'Calculado automaticamente':'Sem dados suficientes';
 }catch(e){
  if(status)status.textContent='Fonte indisponível';
  const meter=panel.querySelector('.rep-score-meter');if(meter){meter.querySelector('strong').textContent='N/D';meter.style.setProperty('--score-color','#8091a7');meter.style.setProperty('--score-progress','0%');}
  card.querySelector('.rep-score-notice').textContent='Não foi possível consultar as fontes: '+e.message;
 }
}
// Processa em lotes pequenos para não disparar requisições simultâneas para todos os vereadores.
let mediaGeneration=0;
async function loadAutomaticMediaScores(){
 const generation=++mediaGeneration;
 const cityId=String(state.city?.id||'');
 const panels=[...document.querySelectorAll('#prefeitoCards .rep-score,#vereadoresCards .rep-score')];
 let next=0;
 async function worker(){
  while(next<panels.length){
   if(generation!==mediaGeneration||String(state.city?.id||'')!==cityId)return;
   const panel=panels[next++];
   if(panel.isConnected)await inspectRepresentativeMedia(panel);
  }
 }
 await Promise.all(Array.from({length:Math.min(3,panels.length)},()=>worker()));
}



const nationalGovernors=[["AC","Acre","Mailza Assis"],["AL","Alagoas","Paulo Dantas"],["AP","Amapá","Clécio Luís"],["AM","Amazonas","Roberto Cidade"],["BA","Bahia","Jerônimo Rodrigues"],["CE","Ceará","Elmano de Freitas"],["DF","Distrito Federal","Celina Leão"],["ES","Espírito Santo","Ricardo Ferraço"],["GO","Goiás","Daniel Vilela"],["MA","Maranhão","Carlos Brandão"],["MT","Mato Grosso","Otaviano Pivetta"],["MS","Mato Grosso do Sul","Eduardo Riedel"],["MG","Minas Gerais","Mateus Simões"],["PA","Pará","Hana Ghassan"],["PB","Paraíba","Lucas Ribeiro"],["PR","Paraná","Ratinho Junior"],["PE","Pernambuco","Raquel Lyra"],["PI","Piauí","Rafael Fonteles"],["RJ","Rio de Janeiro","Ricardo Couto"],["RN","Rio Grande do Norte","Fátima Bezerra"],["RS","Rio Grande do Sul","Eduardo Leite"],["RO","Rondônia","Marcos Rocha"],["RR","Roraima","Soldado Sampaio"],["SC","Santa Catarina","Jorginho Mello"],["SP","São Paulo","Tarcísio de Freitas"],["SE","Sergipe","Fábio Mitidieri"],["TO","Tocantins","Wanderlei Barbosa"]];
function renderNationalGovernance(){
 if(state.city||state.uf)return;
 mediaGeneration++;
 $('executiveHeading').textContent='Presidência da República';
 $('legislativeHeading').textContent='Governadores — 26 estados e DF';
 $('prefeitoMeta').textContent='Presidente em exercício · mandato 2023–2026';
 $('vereadoresMeta').textContent='Referência nominal: setembro de 2026. Alterações e interinidades devem ser confirmadas em fontes oficiais.';
 $('prefeitoCards').innerHTML='<article class="national-president"><span class="national-avatar" data-national-photo="Luiz Inácio Lula da Silva" aria-label="Foto indisponível">♙</span><div><strong>Luiz Inácio Lula da Silva</strong><small>Presidente da República</small><a href="https://www.gov.br/planalto/pt-br" target="_blank" rel="noopener noreferrer">Consultar Presidência ↗</a></div></article>';
 $('vereadoresCards').innerHTML=nationalGovernors.map(([uf,estado,nome])=>'<article class="national-governor"><span class="national-governor-photo" data-national-photo="'+escapeHtml(nome)+'" aria-label="Foto indisponível"><span class="national-uf">'+escapeHtml(uf)+'</span></span><div><strong>'+escapeHtml(nome)+'</strong><small>'+escapeHtml(estado)+'</small></div><a href="https://www.google.com/search?q='+encodeURIComponent('site:gov.br governador '+estado+' 2026')+'" target="_blank" rel="noopener noreferrer" aria-label="Consultar governo de '+escapeHtml(estado)+'">↗</a></article>').join('');
 $('govLinks').innerHTML='<a href="https://www.gov.br/planalto/pt-br" target="_blank" rel="noopener noreferrer">Presidência ↗</a><a href="https://www.conass.org.br/" target="_blank" rel="noopener noreferrer">Informações estaduais ↗</a><a href="https://en.wikipedia.org/wiki/List_of_current_state_governors_in_Brazil" target="_blank" rel="noopener noreferrer">Lista e retratos dos governadores ↗</a><a href="https://nexoeconomico.com/politica/governadores-do-brasil-2026/" target="_blank" rel="noopener noreferrer">Fonte da lista (13/09/2026) ↗</a>';

 loadNationalPhotos();}


// Fontes governamentais verificadas, priorizadas antes de consultas externas.
const nationalOfficialPhotos={'Luiz Inácio Lula da Silva':"https://upload.wikimedia.org/wikipedia/commons/9/9e/Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28ombros%29_denoise.jpg"};
// A rota de 2022 anteriormente usada retornou HTTP 404; mantemos fotos verificadas
// e não disparamos consultas por visitante enquanto não houver endpoint confirmado.
const nationalVerifiedGovernorPhotos={"Clécio Luís":"https://commons.wikimedia.org/wiki/Special:FilePath/Foto%20oficial%20do%20governador%20do%20Estado%20do%20Amap%C3%A1%2C%20Cl%C3%A9cio%20Lu%C3%ADs.jpg","Paulo Dantas":"https://commons.wikimedia.org/wiki/Special:FilePath/Paulo%20Dantas%20Foto%20Oficial%20(cropped).jpg","Tarcísio de Freitas":"https://commons.wikimedia.org/wiki/Special:FilePath/Governador%20do%20Estado%20de%20S%C3%A3o%20Paulo%2C%20Tarc%C3%ADsio%20de%20Freitas%20-%20Foto%20Oficial%20(cropped).jpg","Raquel Lyra":"https://commons.wikimedia.org/wiki/Special:FilePath/Raquel%20Lyra%20em%20maio%20de%202019%20(recorte).jpg","Jorginho Mello":"https://commons.wikimedia.org/wiki/Special:FilePath/Governador%20Jorginho%20Mello%20-%20Foto%20Eduardo%20Valente%20-%20GOVSC-7%20(cropped%20-%203x4).jpg","Eduardo Riedel":"https://commons.wikimedia.org/wiki/Special:FilePath/Eduardo%20Riedel%20avatar.jpg"};
Object.assign(nationalVerifiedGovernorPhotos,{"Fábio Mitidieri":"https://commons.wikimedia.org/wiki/Special:FilePath/Foto%20oficial%20do%20governador%20F%C3%A1bio%20Mitidieri.jpg","Carlos Brandão":"https://commons.wikimedia.org/wiki/Special:FilePath/Retrato%20Oficial%20de%20Carlos%20Brand%C3%A3o%20como%20governador%20do%20Maranh%C3%A3o.jpg","Eduardo Leite":"https://commons.wikimedia.org/wiki/Special:FilePath/Eduardo%20Leite%20in%202026%2055064971042%20(3x4).jpg","Ratinho Junior":"https://commons.wikimedia.org/wiki/Special:FilePath/Ratinho%20J%C3%BAnior%20as%20governor%20of%20Paran%C3%A1%2C%20January%202023%20(cropped).jpg","Rafael Fonteles":"https://commons.wikimedia.org/wiki/Special:FilePath/Rafael%20Fonteles%20(Foto%20Oficial).jpg"});
// Retratos adicionais com arquivo individual e autoria identificada no Wikimedia Commons.
Object.assign(nationalVerifiedGovernorPhotos,{"Roberto Cidade":"https://commons.wikimedia.org/wiki/Special:FilePath/Roberto%20Cidade.jpg","Elmano de Freitas":"https://commons.wikimedia.org/wiki/Special:FilePath/Elmano%20gov%20ceara%202023.png"});
// Retratos identificados individualmente para estados ainda sem imagem; sem consultas em massa.
Object.assign(nationalVerifiedGovernorPhotos,{"Ricardo Ferraço":"https://commons.wikimedia.org/wiki/Special:FilePath/RICARDO%20FERRACO%202026.jpg","Rafael Fonteles":"https://commons.wikimedia.org/wiki/Special:FilePath/2026%20RAFAEL%20FONTELES%20CANDIDATO%20GOVERNADOR%20PI%20TSE%20(180002532987).jpg","Fátima Bezerra":"https://commons.wikimedia.org/wiki/Special:FilePath/F%C3%A1tima%20Bezerra%2C%202023.jpg","Marcos Rocha":"https://commons.wikimedia.org/wiki/Special:FilePath/Governador%20Marcos%20Rocha%202022.jpg","Soldado Sampaio":"https://commons.wikimedia.org/wiki/Special:FilePath/Soldado%20Sampaio.jpg","Ricardo Couto":"https://commons.wikimedia.org/wiki/Special:FilePath/29.04.2026%20-%20Governador%20interino%20do%20Estado%20do%20Rio%20de%20Janeiro%2C%20Ricardo%20Couto%20-%2055239566230%20(cropped).jpg"});
Object.assign(nationalVerifiedGovernorPhotos,{"Mailza Assis":"https://commons.wikimedia.org/wiki/Special:FilePath/Mailza%20Assis%202025.jpg","Jerônimo Rodrigues":"https://commons.wikimedia.org/wiki/Special:FilePath/FOTO%20JER%C3%94NIMO%20RODRIGUES%202026.jpg","Daniel Vilela":"https://commons.wikimedia.org/wiki/Special:FilePath/Daniel%20Vilela%20em%202024.png","Mateus Simões":"https://commons.wikimedia.org/wiki/Special:FilePath/2026%20MATEUS%20SIM%C3%95ES%20CANDIDATO%20GOVERNADOR%20MG%20TSE%20(130002541911).jpg","Hana Ghassan":"https://commons.wikimedia.org/wiki/Special:FilePath/Hana%20Ghassan.jpg","Lucas Ribeiro":"https://commons.wikimedia.org/wiki/Special:FilePath/FOTO%20LUCAS%20RIBEIRO%202026.jpg","Wanderlei Barbosa":"https://commons.wikimedia.org/wiki/Special:FilePath/Wanderlei%20Barbosa%2C%20Governador%20em%20exerc%C3%ADcio%20do%20Tocantins%20(cropped).jpg","Celina Leão":"https://commons.wikimedia.org/wiki/Special:FilePath/Celina%20Leao%20Posse%202026.jpg"});
let nationalPhotoPromise=null;
async function loadNationalPhotos(){
 if(!document.querySelector('[data-national-photo]')){console.warn('[Município360/Fotos] Nenhum cartão nacional localizado no DOM.');return;}
 console.groupCollapsed('[Município360/Fotos] Diagnóstico de carregamento');console.info('Cartões encontrados:',document.querySelectorAll('[data-national-photo]').length);console.groupEnd();
 function applyPhotos(data){
  // Mantém imagens institucionais independentes da disponibilidade da Wikimedia.
  data={...data,fotos:{...(data.fotos||{}),...nationalVerifiedGovernorPhotos,...nationalOfficialPhotos}};
  const photos=data.fotos||{};
  console.info('[Município360/Fotos] API retornou',Object.keys(photos).length,'foto(s); consultados:',data.consultados??'não informado','ausentes:',data.ausentes||{},'aviso:',data.aviso||'nenhum');
  document.querySelectorAll('[data-national-photo]').forEach(box=>{
   const key=box.dataset.nationalPhoto,url=photos[key];
   if(box.querySelector('img'))return;
   if(typeof url!=='string'||!(['https://upload.wikimedia.org/','https://commons.wikimedia.org/','https://www.gov.br/'].some(prefix=>url.startsWith(prefix))))return;
   const fallback=box.querySelector('.national-uf');
   const img=document.createElement('img');
   img.src=url;img.alt='Retrato de '+key;img.loading='lazy';img.referrerPolicy='no-referrer';
   img.addEventListener('load',()=>{box.classList.add('has-photo');if(fallback)fallback.hidden=true;console.info('[Município360/Fotos] Imagem carregada:',key);});
   img.addEventListener('error',()=>{console.error('[Município360/Fotos] Erro ao carregar imagem:',key,'URL:',url);img.remove();box.classList.remove('has-photo');if(fallback)fallback.hidden=false;});
   box.prepend(img);
  });
 }
 applyPhotos({fotos:{...nationalVerifiedGovernorPhotos,...nationalOfficialPhotos},consultados:1});
 // Consulta eleitoral de 2022 suspensa: rota de fotos não confirmada (HTTP 404).
 // Mantém somente fotos antigas em cache como alternativa; evita novas consultas em massa à Wikipédia.
 if(!nationalPhotoPromise){
  nationalPhotoPromise=api('fotos_nacionais.php?legado=1').then(data=>{
   if(!state.uf&&!state.city)applyPhotos(data);
  }).catch(e=>console.warn('[Município360/Fotos] Cache anterior:',e.message));
 }
 await nationalPhotoPromise;
}
function resetGovernanceTitles(){
 $('executiveHeading').textContent='Prefeito e administração';
 $('legislativeHeading').textContent='Vereadores e Câmara';
}

async function loadGovernance(){
 resetGovernanceTitles();
 const city=state.city;if(!city)return;
 mediaGeneration++;
 const mayorCards=$('prefeitoCards'),councilCards=$('vereadoresCards');
 $('prefeitoMeta').textContent='Consultando dados públicos...';
 $('vereadoresMeta').textContent='Verificando fontes disponíveis...';
 mayorCards.innerHTML='<div class="placeholder">Consultando prefeito...</div>';
 councilCards.innerHTML='<div class="placeholder">Consultando vereadores...</div>';
 try{
  const d=await api('representantes.php?id='+encodeURIComponent(city.id)+'&nome='+encodeURIComponent(city.nome)+'&uf='+encodeURIComponent(state.uf));
  if(state.city?.id!==city.id)return;
  const mayor=d.prefeito;
  const administration=[...(mayor?[{...mayor,cargo:'Prefeito eleito em 2024'}]:[]),...(d.vice?[{...d.vice,cargo:'Vice-prefeito eleito em 2024'}]:[])];
  const councillors=(d.vereadores||[]).map(x=>({...x,cargo:'Vereador eleito em 2024'}));
  mayorCards.innerHTML=administration.length?administration.map(representativeCard).join(''):'<div class="placeholder">'+escapeHtml(d.observacao||'Prefeito não confirmado nesta consulta.')+'</div>';
  councilCards.innerHTML=councillors.length?councillors.map(representativeCard).join(''):'<div class="placeholder">'+escapeHtml(d.observacao||'Vereadores não confirmados nesta consulta.')+'</div>';
  $('prefeitoMeta').textContent=mayor?'Eleito em 2024 · '+(d.turno_prefeito||1)+'º turno · ocupante atual não confirmado':'Prefeito não identificado nesta consulta.';
  $('vereadoresMeta').textContent=councillors.length+' vereadores eleitos em 2024 · composição atual não confirmada';
  updateSocialPeople([...administration,...councillors]);
  loadAutomaticMediaScores();
 }catch(e){
  if(state.city?.id!==city.id)return;
  $('prefeitoMeta').textContent='Consulta indisponível: '+e.message;
  $('vereadoresMeta').textContent='Consulta indisponível: '+e.message;
  mayorCards.innerHTML='<div class="placeholder">Não foi possível consultar o prefeito.</div>';
  councilCards.innerHTML='<div class="placeholder">Não foi possível consultar os vereadores.</div>';
 }
}


const unifiedMedia={news:[],mentions:[],failures:[],origin:'todas',scope:''};
function mediaKey(x){return String(x.titulo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'').slice(0,110)}
function mediaDate(x){
 const v=String(x.data||'').trim();
 if(/^\d{14}$/.test(v))return Date.parse(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T'+v.slice(8,10)+':'+v.slice(10,12)+':'+v.slice(12,14)+'Z')||0;
 const t=Date.parse(v);return Number.isFinite(t)?t:0;
}
function newsPublisher(item){
 const explicit=String(item.fonte||item.veiculo||item.publisher||'').trim();
 if(explicit)return explicit;
 try{const host=new URL(item.url).hostname.replace(/^www\./i,'');return host==='news.google.com'?'Veículo não identificado · Google Notícias':host}catch{return 'Fonte não identificada'}
}
function newsThumbnail(item){
 const raw=String(item.imagem||item.socialimage||item.thumbnail||item.image||'').trim();
 try{const url=new URL(raw);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}
}
function newsPlatform(item){
 try{
  const host=new URL(item.url).hostname.replace(/^www\./i,'').toLowerCase();
  const platforms={'instagram.com':'Instagram','facebook.com':'Facebook','x.com':'X','twitter.com':'X','youtube.com':'YouTube','tiktok.com':'TikTok','threads.net':'Threads'};
  return Object.entries(platforms).find(([domain])=>host===domain||host.endsWith('.'+domain))?.[1]||'';
 }catch{return ''}
}
let newsAutoScrollTimer=null,newsAutoScrollPausedUntil=0;
function initNewsAutoScroll(){
 const list=$('newsList');if(!list)return;
 const pause=()=>{newsAutoScrollPausedUntil=Date.now()+12000};
 ['pointerenter','focusin','wheel','touchstart','pointerdown'].forEach(name=>list.addEventListener(name,pause,{passive:true}));
 list.addEventListener('pointerleave',()=>{newsAutoScrollPausedUntil=Date.now()+3500});
 document.addEventListener('visibilitychange',()=>{newsAutoScrollPausedUntil=Date.now()+5000});
 if(newsAutoScrollTimer!==null)return;
 newsAutoScrollTimer=window.setInterval(()=>{
  if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches||Date.now()<newsAutoScrollPausedUntil||list.matches(':hover')||list.contains(document.activeElement))return;
  const max=list.scrollHeight-list.clientHeight;
  if(max<30)return;
  if(list.scrollTop>=max-2){newsAutoScrollPausedUntil=Date.now()+3500;list.scrollTo({top:0,behavior:'smooth'});return}
  list.scrollTop+=1;
 },65);
}
function renderUnifiedMedia(){
 const origin=unifiedMedia.origin;
 const seen=new Set();
 let entries=[...unifiedMedia.news.map(x=>({...x,_kind:'noticias'})),...unifiedMedia.mentions.map(x=>({...x,_kind:'mencoes'}))]
 .filter(x=>{const title=String(x.titulo||'').trim();try{const u=new URL(x.url);return title&&['https:','http:'].includes(u.protocol)}catch{return false}})
 .sort((a,b)=>mediaDate(b)-mediaDate(a));
 entries=entries.filter(x=>{const key=mediaKey(x);if(!key||seen.has(key))return false;seen.add(key);return true;});
 const total=entries.length;
 if(origin==='redes')entries=[];
 else if(origin!=='todas')entries=entries.filter(x=>x._kind===origin);
 $('newsCount').textContent=(origin==='todas'?total:entries.length)+' resultados';
 $('totalNews').textContent=total;
 $('newsList').innerHTML=origin==='redes'
 ?'<div class="placeholder">As redes sociais disponíveis estão nos links de busca acima. Não há coleta direta de posts autenticados neste momento.</div>'
 :entries.length?entries.slice(0,100).map(n=>'<div class="news-card-shell"><a class="news-item news-editorial-item" href="'+escapeHtml(n.url)+'" target="_blank" rel="noopener noreferrer"><span class="news-type">'+escapeHtml(newsPlatform(n)||newsPublisher(n))+'</span>'+(newsThumbnail(n)?'<img class="news-thumb" loading="lazy" referrerpolicy="no-referrer" src="'+escapeHtml(newsThumbnail(n))+'" alt="" onerror="this.remove()">':'')+'<div class="news-item-copy"><span class="source">Fonte: '+escapeHtml(newsPublisher(n))+'</span><h3>'+escapeHtml(n.titulo)+'</h3><div class="metadata">'+escapeHtml(formatDate(n.data))+'</div></div><span class="news-go" aria-hidden="true">↗</span></a>'+(newsThumbnail(n)?'':'<button class="news-fetch-image" type="button" data-news-image-url="'+escapeHtml(n.url)+'">▣ Tentar buscar imagem da notícia</button>')+'</div>').join('')
 :'<div class="placeholder">Nenhuma publicação encontrada para este filtro nesta consulta.</div>';
 if(unifiedMedia.failures.length){
  const note=document.createElement('div');note.className='note';note.textContent='Fontes indisponíveis: '+unifiedMedia.failures.join(' | ');$('newsList').append(note);
 }
}
$('newsList').addEventListener('click',async e=>{
 const btn=e.target.closest('.news-fetch-image');
 if(!btn||!$('newsList').contains(btn))return;
 const url=btn.dataset.newsImageUrl;
 if(!url)return;
 btn.disabled=true;btn.textContent='Buscando imagem…';
 try{
  const result=await api('noticia_imagem.php?url='+encodeURIComponent(url));
  if(!btn.isConnected)return;
  if(result.imagem){
   const image=new Image();image.className='news-thumb';image.loading='lazy';image.referrerPolicy='no-referrer';image.alt='';
   image.onload=()=>{if(btn.isConnected){btn.closest('.news-card-shell')?.querySelector('.news-editorial-item .news-type')?.after(image);btn.remove()}};
   image.onerror=()=>{if(btn.isConnected){btn.textContent='Imagem indisponível';btn.disabled=true}};
   image.src=result.imagem;
  }else{btn.textContent='Imagem não encontrada';btn.disabled=true}
 }catch(err){if(btn.isConnected){btn.disabled=false;btn.textContent='Tentar novamente · '+(err.message||'falha')}}
});
function resetUnifiedMedia(scope){
 unifiedMedia.scope=scope;unifiedMedia.news=[];unifiedMedia.mentions=[];unifiedMedia.failures=[];
 $('socialLinks').replaceChildren();renderUnifiedMedia();
}
document.querySelectorAll('#originFilters .pill').forEach(button=>button.addEventListener('click',()=>{
 unifiedMedia.origin=button.dataset.origin;
 document.querySelectorAll('#originFilters .pill').forEach(b=>b.classList.toggle('chosen',b===button));
 renderUnifiedMedia();
}));

async function loadNews(){
 if(!state.city)return;
 const id=String(state.city.id),topic=state.topic,scope='city:'+id;
 unifiedMedia.scope=scope;unifiedMedia.news=[];renderUnifiedMedia();
 const responses=await Promise.allSettled([api('noticias.php?id='+id+'&tema='+encodeURIComponent(topic)),api('rss.php?id='+id+'&tema='+encodeURIComponent(topic))]);
 if(String(state.city?.id)!==id||state.topic!==topic||unifiedMedia.scope!==scope)return;
 const items=[];unifiedMedia.failures=[];
 responses.forEach((r,i)=>{if(r.status==='fulfilled')items.push(...(r.value.noticias||[]).map(n=>({...n,origem:i===0?'GDELT':'RSS'})));else unifiedMedia.failures.push((i===0?'GDELT':'RSS')+': '+r.reason.message)});
 unifiedMedia.news=items;renderUnifiedMedia();
}
function formatDate(v){if(!v)return 'Data não fornecida';if(/^\d{14}$/.test(v))return v.slice(6,8)+'/'+v.slice(4,6)+'/'+v.slice(0,4)+' '+v.slice(8,10)+':'+v.slice(10,12);return v}
const currency=v=>typeof v==='number'?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Valor não divulgado';
async function loadContracts(){if(!state.city)return;const id=state.city.id;placeholder('contractsList','Consultando o PNCP...');try{const d=await api('contratacoes.php?id='+id);if(state.city?.id!==id)return;const items=d.itens||[];$('totalBids').textContent=items.length;$('contractCount').textContent=items.length+' resultados';$('contractsList').innerHTML=items.length?items.map(c=>'<a class="contract-item" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(c.link)+'"><span class="source">'+escapeHtml(c.modalidade)+'</span><h3>'+escapeHtml(c.objeto||'Contratação')+'</h3><div class="metadata">'+escapeHtml(c.orgao||'Órgão não informado')+' · '+escapeHtml(c.publicacao||'Sem data')+'</div><div class="contract-value">'+escapeHtml(currency(c.valor))+' ↗</div></a>').join(''):'<div class="placeholder">Nenhum registro retornado nas duas modalidades e no período consultado.</div>';}catch(e){placeholder('contractsList','PNCP indisponível: '+e.message);$('totalBids').textContent='—';$('contractCount').textContent='—'}}
const brasilMarkup=$('svgWrap').innerHTML;
let mapRequest=0;
function restoreBrazil(){hideStatePopup();hideMunicipalTooltip();mapRequest++;$('svgWrap').innerHTML=brasilMarkup;$('mapMode').textContent='Brasil: selecione uma UF';$('mapBack').hidden=true;wireMap();}
function resetBrazil(){
 state.uf='';state.city=null;state.cities=[];resetUnifiedMedia('brasil');
 $('ufSelect').value='';$('citySelect').disabled=true;$('citySelect').innerHTML='<option value="">Selecione um estado primeiro</option>';
 $('citySearch').value='';$('citySearch').disabled=true;
 $('placeTag').textContent='Brasil · todos os estados';
 $('locationHeading').textContent='Brasil';
 $('locationDetails').textContent='Selecione um estado ou município para visualizar seus dados.';
 $('totalCities').textContent='—';$('ibgeLink').removeAttribute('href');
 $('prefeitoMeta').textContent='Selecione um município para consultar os representantes.';
 $('vereadoresMeta').textContent='Selecione um município para consultar a Câmara.';
 $('govLinks').innerHTML='';
 restoreBrazil();renderNationalGovernance();
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
// Dados da contagem consultados sob demanda no cadastro IBGE já usado pelo filtro estadual.
const stateMunicipalityCounts=new Map();
const stateMunicipalityPending=new Map();
let activeStatePopupUF='';
function statePopupElement(){
 let tip=document.getElementById('stateMapTooltip');
 if(!tip){tip=document.createElement('div');tip.id='stateMapTooltip';tip.className='state-map-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip)}
 return tip;
}
function hideStatePopup(){activeStatePopupUF='';const tip=document.getElementById('stateMapTooltip');if(tip)tip.hidden=true;}
function positionStatePopup(event){
 const tip=statePopupElement();if(tip.hidden)return;
 let x=event.clientX+15,y=event.clientY+15;
 const rect=tip.getBoundingClientRect();
 x=Math.max(8,Math.min(x,innerWidth-rect.width-8));
 y=Math.max(8,Math.min(y,innerHeight-rect.height-8));
 tip.style.left=x+'px';tip.style.top=y+'px';
}
/* Filiações dos ocupantes cadastrados, referência consultada em 16/10/2026. */
const nationalGovernorParties={"AC":"PP","AL":"MDB","AP":"UNIÃO","AM":"UNIÃO","BA":"PT","CE":"PT","DF":"PP","ES":"MDB","GO":"MDB","MA":"MDB","MT":"Republicanos","MS":"PP","MG":"PSD","PA":"MDB","PB":"PP","PR":"PSD","PE":"PSD","PI":"PT","RJ":"Sem partido","RN":"PT","RS":"PSD","RO":"PSD","RR":"Republicanos","SC":"PL","SP":"Republicanos","SE":"PSD","TO":"Republicanos"};
function showStatePopup(uf,event){
 const info=nationalGovernors.find(item=>item[0]===uf);if(!info)return;
 activeStatePopupUF=uf;
 const tip=statePopupElement(),count=stateMunicipalityCounts.get(uf);
 tip.innerHTML='<strong>'+escapeHtml(info[1])+' <small>('+escapeHtml(uf)+')</small></strong>'+
  '<span>Governador(a): <b>'+escapeHtml(info[2])+'</b> <small class="state-map-party">('+escapeHtml(nationalGovernorParties[uf]||'Partido não confirmado')+')</small></span>'+
  '<span>Municípios: <b class="state-map-municipality-count">'+escapeHtml(count===undefined?'Consultando IBGE…':count===null?'Indisponível':count.toLocaleString('pt-BR'))+'</b></span>'+
  '<small class="state-map-source">Municípios: cadastro IBGE</small>';
 tip.hidden=false;positionStatePopup(event);
 if(count!==undefined)return;
 if(!stateMunicipalityPending.has(uf)){
  const job=api('localidades.php?tipo=municipios&uf='+encodeURIComponent(uf))
   .then(d=>{const n=Array.isArray(d.data)?d.data.length:null;stateMunicipalityCounts.set(uf,n)})
   .catch(e=>{console.warn('[Município360/Mapa] Contagem de municípios indisponível para '+uf,e);stateMunicipalityCounts.set(uf,null)})
   .finally(()=>stateMunicipalityPending.delete(uf));
  stateMunicipalityPending.set(uf,job);
 }
 stateMunicipalityPending.get(uf).then(()=>{
  if(activeStatePopupUF!==uf)return;
  const c=stateMunicipalityCounts.get(uf);
  const countEl=tip.querySelector('.state-map-municipality-count');
  if(countEl)countEl.textContent=c===null?'Indisponível':c.toLocaleString('pt-BR');
 });
}
function wireMap(){
 document.querySelectorAll('#mapa .uf').forEach(el=>{
  const uf=el.dataset.uf,meta=nationalGovernors.find(item=>item[0]===uf);
  el.classList.add('region-'+(UF_REGION[uf]||'centro'));
  el.setAttribute('tabindex','0');el.setAttribute('role','button');
  if(meta)el.setAttribute('aria-label',meta[1]+' — governador(a): '+meta[2]+'. Selecionar estado');
  const fn=()=>{hideStatePopup();geoEpoch++;selectUF(uf)};
  el.addEventListener('click',fn);
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}});
  el.addEventListener('pointerenter',e=>showStatePopup(uf,e));
  el.addEventListener('pointermove',e=>{if(activeStatePopupUF!==uf)showStatePopup(uf,e);else positionStatePopup(e)});
  el.addEventListener('pointerleave',hideStatePopup);
  el.addEventListener('focus',()=>{const r=el.getBoundingClientRect();showStatePopup(uf,{clientX:r.left+r.width/2,clientY:r.top+r.height/2})});
  el.addEventListener('blur',hideStatePopup);
 });
}
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
$('ufSelect').addEventListener('change',e=>{geoEpoch++;selectUF(e.target.value)});$('citySearch').addEventListener('input',renderCityOptions);$('citySelect').addEventListener('change',e=>{geoEpoch++;selectCity(e.target.value)});$('refresh').addEventListener('click',()=>{if(state.city){loadNews();loadContracts();loadGovernance();loadFinance();loadSocial()}else{loadStates();loadBrazilFeeds()}});document.querySelectorAll('#mapa .uf').forEach(el=>{el.classList.add('region-'+(UF_REGION[el.dataset.uf]||'centro'));el.setAttribute('tabindex','0');el.setAttribute('role','button');const fn=()=>selectUF(el.dataset.uf);el.addEventListener('click',fn);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})});
$('newsTopicSelect').addEventListener('change',e=>{state.topic=e.target.value;if(state.city)loadNews();else loadBrazilFeeds()});document.querySelectorAll('.nav').forEach(n=>n.addEventListener('click',()=>showSection(n.dataset.section)));
async function loadBrazilFeeds(){
 if(state.city)return;
 if(!state.uf)renderNationalGovernance();
 resetUnifiedMedia('brasil');placeholder('newsList','Consultando notícias municipais de todo o Brasil...');placeholder('contractsList','Consultando licitações municipais nacionais...');
 const results=await Promise.allSettled([api('brasil_noticias.php'),api('brasil_contratacoes.php')]);
 if(state.city)return;
 if(results[0].status==='fulfilled'){
  unifiedMedia.news=(results[0].value.noticias||[]).map(n=>({...n,origem:'Brasil'}));
 }else unifiedMedia.failures=['Notícias nacionais: '+results[0].reason.message];
 renderUnifiedMedia();
 if(results[1].status==='fulfilled'){
  const v=results[1].value,items=v.itens||[];
  $('contractsList').innerHTML=items.length?items.map(c=>'<a class="contract-item" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(c.link)+'"><span class="source">'+escapeHtml(c.modalidade)+' · '+escapeHtml(c.municipio||c.uf||'Brasil')+'</span><h3>'+escapeHtml(c.objeto||'Contratação')+'</h3><div class="metadata">'+escapeHtml(c.orgao||'Órgão municipal')+' · '+escapeHtml(c.publicacao||'Sem data')+'</div><div class="contract-value">'+escapeHtml(currency(c.valor))+' ↗</div></a>').join(''):'<div class="placeholder">Nenhum órgão municipal encontrado nesta amostra nacional do PNCP.</div>';
  $('totalBids').textContent=items.length;$('contractCount').textContent=items.length+' Brasil';
 }else{placeholder('contractsList','PNCP nacional temporariamente indisponível: '+results[1].reason.message);$('totalBids').textContent='—'}
}
async function loadStates(){setStatus('Consultando unidades federativas do IBGE...', 'loading');try{const d=await api('localidades.php?tipo=estados');const items=Array.isArray(d.data)?d.data:[];if(items.length===0)throw new Error('API IBGE retornou lista vazia');$('totalStates').textContent=items.length;setStatus(items.length+' unidades federativas carregadas. Selecione um estado no mapa ou na lista.');$('ufSelect').innerHTML='<option value="">Brasil — Todos os estados</option>'+items.map(x=>'<option value="'+escapeHtml(x.sigla)+'">'+escapeHtml(x.nome)+'</option>').join('')}catch(e){$('ufSelect').innerHTML='<option>IBGE indisponível</option>';setStatus('Não foi possível carregar estados: '+e.message,'error');console.error('Município360: ',e)}}

function updateSocialPeople(people){const el=$('socialPerson');if(!el)return;const original=el.value;const unique=new Set();let options='<option value="">Município / prefeitura / câmara</option>';for(const p of people){if(!p.nome||unique.has(p.nome))continue;unique.add(p.nome);options+='<option value="'+escapeHtml(p.nome)+'">'+escapeHtml(p.cargo+': '+p.nome)+'</option>'}el.innerHTML=options;el.value=unique.has(original)?original:''}
function renderFinanceDashboard(result,year){
 const list=$('financeList'),rows=(result.amostra||[]).filter(x=>x&&typeof x==='object');
 const valid=rows.filter(x=>x.valor!==null&&Number.isFinite(Number(x.valor)));
 const groups=new Map();
 rows.forEach(x=>{const k=String(x.anexo||'Anexo não informado');groups.set(k,(groups.get(k)||0)+1)});
 const order=[...groups].sort((a,b)=>b[1]-a[1]).slice(0,8);
 const max=Math.max(1,...order.map(x=>x[1]));
 const stats='<div class="finance-kpis"><div><small>Registros da consulta</small><strong>'+escapeHtml(result.quantidade_retornada??rows.length)+'</strong></div><div><small>Amostra exibida</small><strong>'+rows.length+'</strong></div><div><small>Com valor numérico</small><strong>'+valid.length+'</strong></div><div><small>Exercício</small><strong>'+escapeHtml(year)+'</strong></div></div>';
 const graph=order.length?'<div class="finance-chart" role="img" aria-label="Quantidade de registros por anexo, não representa valores gastos">'+order.map(([name,count])=>'<div class="finance-bar-row"><span title="'+escapeHtml(name)+'">'+escapeHtml(name)+'</span><div class="finance-bar-track"><div class="finance-bar-fill" style="width:'+(count/max*100).toFixed(2)+'%"></div></div><b>'+count+'</b></div>').join('')+'</div>':'<div class="placeholder">Sem dados para o gráfico.</div>';
 const title='<div class="finance-block-title"><h3>Registros por anexo</h3><small>Contagem de registros da amostra, não valores em reais</small></div>';
 const table='<div class="finance-block-title"><h3>Lançamentos declarados</h3><small>Valores individuais sem agregação</small></div><label class="finance-searchlabel" for="financeSearch">Pesquisar registros<input id="financeSearch" type="search" placeholder="Anexo, conta ou descrição"></label><div class="finance-table-scroll"><table class="finance-table"><thead><tr><th>Anexo</th><th>Conta / descrição</th><th>Valor declarado</th></tr></thead><tbody id="financeTableBody"></tbody></table></div><div id="financeVisibleCount" class="metadata"></div>';
 const note='<div class="note">'+escapeHtml(result.nota||'Dados fiscais declarados; não representam totais consolidados.')+' A API disponibiliza '+escapeHtml(result.quantidade_retornada??rows.length)+' registros nesta consulta; o gráfico considera apenas a amostra recebida.</div>';
 const url=result.consulta_api||result.fonte_url;
 list.innerHTML=stats+title+graph+table+note+(url?'<a class="textlink" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(url)+'">Abrir dados na fonte oficial ↗</a>':'');
 const body=$('financeTableBody'),input=$('financeSearch');
 function draw(){
  const q=input.value.toLocaleLowerCase('pt-BR');
  const visible=rows.filter(x=>(String(x.anexo||'')+' '+String(x.conta||'')+' '+String(x.descricao||'')).toLocaleLowerCase('pt-BR').includes(q));
  body.innerHTML=visible.length?visible.map(x=>'<tr><td>'+escapeHtml(x.anexo||'—')+'</td><td><strong>'+escapeHtml(x.conta||'—')+'</strong><br><span>'+escapeHtml(x.descricao||'—')+'</span></td><td class="finance-number">'+(x.valor!==null&&Number.isFinite(Number(x.valor))?escapeHtml(currency(Number(x.valor))):'—')+'</td></tr>').join(''):'<tr><td colspan="3">Nenhum registro encontrado.</td></tr>';
  $('financeVisibleCount').textContent=visible.length+' de '+rows.length+' registros na amostra';
 }
 input.addEventListener('input',draw);draw();
}
async function loadFinance(){
 const city=state.city;if(!city)return;
 const id=String(city.id),year=$('financeYear').value;
 placeholder('financeList','Consultando contas anuais no SICONFI...');
 $('financeCount').textContent='…';
 try{
  const r=await api('financas.php?id='+id+'&ano='+encodeURIComponent(year));
  if(String(state.city?.id)!==id||$('financeYear').value!==year)return;
  $('financeCount').textContent=r.disponivel?'DCA '+year:'Indisponível';
  if(r.disponivel)renderFinanceDashboard(r,year);
  else placeholder('financeList',r.mensagem||'Nenhum dado contábil confirmado para este exercício.');
 }catch(e){
  if(String(state.city?.id)!==id)return;
  $('financeCount').textContent='—';placeholder('financeList','Consulta fiscal falhou: '+e.message);
 }
}

async function loadSocial(){
 const city=state.city;if(!city)return;
 const id=String(city.id),person=$('socialPerson').value,scope='city:'+id;
 unifiedMedia.scope=scope;unifiedMedia.mentions=[];$('socialLinks').replaceChildren();renderUnifiedMedia();
 try{
  const d=await api('social.php?id='+id+'&pessoa='+encodeURIComponent(person));
  if(String(state.city?.id)!==id||$('socialPerson').value!==person||unifiedMedia.scope!==scope)return;
  unifiedMedia.mentions=d.noticias_indexadas||[];
  $('socialLinks').innerHTML=(d.consultas_sociais||[]).filter(x=>{try{return new URL(x.url).protocol==='https:'}catch{return false}}).map(x=>'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(x.url)+'">'+escapeHtml(x.rede)+' ↗</a>').join('');
  $('socialNotice').textContent=String(d.aviso||'Redes sociais: links externos de pesquisa; não representam postagens coletadas.');
  renderUnifiedMedia();
 }catch(e){
  if(unifiedMedia.scope!==scope)return;
  unifiedMedia.failures.push('Menções: '+e.message);renderUnifiedMedia();
 }
}
$('socialPerson').addEventListener('change',loadSocial);
$('financeYear').addEventListener('change',loadFinance);

window.addEventListener('error',e=>{setStatus('Erro na interface: '+(e.message||'Falha desconhecida')+'. Consulte o console do navegador.','error')});

let geoEpoch=0;
function plainName(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
}
async function locateVisitor(){
 const ticket=++geoEpoch;
 const btn=$('locateMe');
 if(!navigator.geolocation||!window.isSecureContext){
  setStatus('Localização indisponível neste navegador. Selecione o município manualmente.','error');return;
 }
 btn.disabled=true;
 setStatus('Aguardando permissão para localizar seu município...','loading');
 try{
  const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:9000,maximumAge:300000}));
  if(ticket!==geoEpoch)return;
  const {latitude,longitude}=pos.coords;
  const url='https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=10&lat='+encodeURIComponent(latitude.toFixed(5))+'&lon='+encodeURIComponent(longitude.toFixed(5));
  const reply=await fetch(url,{headers:{Accept:'application/json'}});
  if(!reply.ok)throw new Error('Serviço de localização indisponível (HTTP '+reply.status+')');
  const json=await reply.json();
  if(ticket!==geoEpoch)return;
  const address=json.address||{};
  if(address.country_code!=='br')throw new Error('Localização fora do Brasil.');
  let uf=(address['ISO3166-2-lvl4']||'').replace(/^BR-/i,'').toUpperCase();
  if(!/^[A-Z]{2}$/.test(uf)){
   const stateName=plainName(address.state);
   const opt=Array.from($('ufSelect').options).find(o=>plainName(o.textContent)===stateName);
   uf=opt?.value||'';
  }
  if(!/^[A-Z]{2}$/.test(uf))throw new Error('Não foi possível identificar o estado.');
  const cityName=address.city||address.town||address.village||address.municipality||address.county||'';
  await selectUF(uf);
  if(ticket!==geoEpoch)return;
  const city=state.cities.find(x=>plainName(x.nome)===plainName(cityName));
  if(!city){
   setStatus('Estado '+uf+' localizado. Selecione seu município na lista (nome não encontrado na consulta).');
   return;
  }
  $('citySelect').value=String(city.id);
  selectCity(city.id);
  setStatus('Localização aproximada: '+city.nome+' / '+uf+'. Dados carregados.');
 }catch(e){
  if(ticket===geoEpoch)setStatus('Não foi possível localizar automaticamente: '+(e.code===1?'permissão não concedida':e.message||'falha de localização')+'. Você pode escolher o município manualmente.','error');
 }finally{btn.disabled=false;}
}
$('locateMe').addEventListener('click',locateVisitor);

// Conecta os eventos do mapa nacional também na primeira abertura da página.
wireMap();
initNewsAutoScroll();
loadStates();
loadBrazilFeeds();
})();
