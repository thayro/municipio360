<?php
declare(strict_types=1);
require __DIR__.'/common.php';
require __DIR__.'/news_fallback.php';
$id=cityCode();$loc=locationById($id);if(!($loc['ok']??false))respond(['ok'=>false,'error'=>'Município indisponível'],502);
$city=(string)($loc['data']['nome']??'');$uf=(string)($loc['data']['microrregiao']['mesorregiao']['UF']['sigla']??$loc['data']['regiao-imediata']['regiao-intermediaria']['UF']['sigla']??'');
if(!$city||!preg_match('/^[A-Z]{2}$/',$uf))respond(['ok'=>false,'error'=>'Localidade inválida'],502);
$person=trim((string)($_GET['pessoa']??''));$person=mb_substr(strip_tags($person),0,90,'UTF-8');
$term=$person!==''?'"'.$person.'" "'.$city.'"':'"'.$city.'" "'.$uf.'" (prefeitura OR prefeito OR vereadores OR "câmara municipal")';
// GDELT agrega matérias indexadas, NÃO é acesso direto aos posts de redes sociais.
$query=$term;
$url='https://api.gdeltproject.org/api/v2/doc/doc?'.http_build_query(['query'=>$query,'mode'=>'artlist','format'=>'json','maxrecords'=>30,'timespan'=>'30d','sort'=>'datedesc'], '', '&', PHP_QUERY_RFC3986);
$r=cached('social-context-30d-'.$id.'-'.hash('sha256',$person),900,fn()=>getJson($url,18));
$articles=[];if($r['ok']??false){foreach(($r['data']['articles']??[]) as $a){$u=$a['url']??'';if(!is_string($u)||!preg_match('~^https?://~i',$u))continue;$articles[]=['titulo'=>(string)($a['title']??''),'url'=>$u,'fonte'=>(string)($a['domain']??''),'data'=>(string)($a['seendate']??'')];}}
$source='GDELT';$fallbackError=null;
if(!$articles){
 $rssQuery=$person!==''?'"'.$person.'" "'.$city.'"':'"'.$city.'" "'.$uf.'" (prefeitura OR prefeito OR vereadores OR câmara)';
 $fallback=cached('social-rss-v20-30d-'.$id.'-'.hash('sha256',$person),900,fn()=>m360NewsRss($rssQuery,30));
 if($fallback['ok']??false){$articles=$fallback['noticias']??[];$source='Google Notícias RSS';}
 else $fallbackError=$fallback['error']??'Feed RSS indisponível';
}
$search=$person!==''?$person.' '.$city.' '.$uf:$city.' '.$uf.' prefeitura vereadores';
$links=[
 ['rede'=>'X / Twitter','url'=>'https://x.com/search?q='.rawurlencode($search).'&f=live'],
 ['rede'=>'Reddit','url'=>'https://www.reddit.com/search/?q='.rawurlencode($search).'&sort=new'],
 ['rede'=>'YouTube','url'=>'https://www.youtube.com/results?search_query='.rawurlencode($search)],
 ['rede'=>'Google (Instagram)','url'=>'https://www.google.com/search?q='.rawurlencode('site:instagram.com '.$search)],
 ['rede'=>'Google (Facebook)','url'=>'https://www.google.com/search?q='.rawurlencode('site:facebook.com '.$search)],
 ['rede'=>'Google Notícias','url'=>'https://news.google.com/search?q='.rawurlencode($search).'&hl=pt-BR&gl=BR&ceid=BR:pt-419']
];
respond(['ok'=>true,'cidade'=>$city,'uf'=>$uf,'pessoa'=>$person,'noticias_indexadas'=>$articles,'total_indexadas'=>count($articles),'consultas_sociais'=>$links,'cobertura'=>'buscas externas (sem contagem de posts)','fonte'=>$source.' + links de pesquisa','aviso'=>($articles?'Fonte: '.$source.'. Resultados jornalísticos indexados; não equivalem a publicações ou métricas de redes sociais.': 'Nenhuma notícia retornada pelas fontes consultadas. ').(!($r['ok']??false)?'GDELT falhou: '.($r['error']??'indisponível').'. ':'').($fallbackError?'RSS: '.$fallbackError.'. ':'').'Buscas sociais externas permanecem disponíveis.']);
