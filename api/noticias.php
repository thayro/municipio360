<?php
require __DIR__.'/common.php';
require __DIR__.'/news_fallback.php';
$id=cityCode();$loc=locationById($id);
if(!($loc['ok']??false))respond(['ok'=>false,'error'=>'Não foi possível identificar o município','detail'=>$loc['error']??''],502);
$city=$loc['data']['nome']??'';$uf=$loc['data']['microrregiao']['mesorregiao']['UF']['sigla']??($loc['data']['regiao-imediata']['regiao-intermediaria']['UF']['sigla']??'');
if(!$city||!preg_match('/^[A-Z]{2}$/',$uf))respond(['ok'=>false,'error'=>'Dados do município incompletos'],502);
$topic=(string)($_GET['tema']??'geral');$topics=['geral'=>'','prefeitura'=>'(prefeitura OR prefeito)','camara'=>'(vereador OR vereadores OR "câmara municipal")','saude'=>'(saúde OR hospital OR UBS)','educacao'=>'(educação OR escola)','obras'=>'(obras OR infraestrutura OR pavimentação)'];
if(!array_key_exists($topic,$topics))respond(['ok'=>false,'error'=>'Tema inválido'],400);
$query='"'.$city.'" "'.$uf.'"';if($topics[$topic])$query.=' '.$topics[$topic];
$url='https://api.gdeltproject.org/api/v2/doc/doc?'.http_build_query(['query'=>$query,'mode'=>'artlist','format'=>'json','maxrecords'=>35,'timespan'=>'7d','sort'=>'datedesc'], '', '&', PHP_QUERY_RFC3986);
$result=cached('gdelt-'.$id.'-'.$topic,600,fn()=>getJson($url,18));
if(!($result['ok']??false)){
 $rss=cached('news-rss-v19-'.$id.'-'.$topic,900,fn()=>m360NewsRss('"'.$city.'" "'.$uf.'" '.str_replace(['(',')','OR'],' ',$topics[$topic]),35));
 if($rss['ok']??false)respond(['ok'=>true,'cidade'=>$city,'uf'=>$uf,'tema'=>$topic,'noticias'=>$rss['noticias'],'total'=>count($rss['noticias']),'fonte'=>'Google Notícias RSS','aviso'=>'Fonte GDELT temporariamente indisponível; resultados obtidos em RSS. Confirme cidade e fonte da notícia.']);
 respond(['ok'=>false,'error'=>'Notícias temporariamente indisponíveis','detail'=>'GDELT: '.($result['error']??'').'; RSS: '.($rss['error']??'')],502);
}
$articles=[];foreach(($result['data']['articles']??[]) as $a){$url=$a['url']??'';if(!is_string($url)||!preg_match('~^https?://~i',$url))continue;$articles[]=['titulo'=>(string)($a['title']??'Sem título'),'url'=>$url,'fonte'=>(string)($a['domain']??''),'data'=>(string)($a['seendate']??''),'imagem'=>preg_match('~^https?://~i',(string)($a['socialimage']??''))?$a['socialimage']:null,'idioma'=>(string)($a['language']??'')];}
respond(['ok'=>true,'cidade'=>$city,'uf'=>$uf,'tema'=>$topic,'noticias'=>$articles,'total'=>count($articles),'stale'=>$result['stale']??false,'aviso'=>'Resultados de busca automática: podem citar cidade homônima ou conteúdo sem relação direta. Verifique a fonte e a data.']);
