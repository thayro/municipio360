<?php
declare(strict_types=1);require __DIR__.'/common.php';
require __DIR__.'/news_fallback.php';
$query='(prefeitura OR "câmara municipal" OR "licitação municipal" OR "vereadores") sourcelang:portuguese';
$url='https://api.gdeltproject.org/api/v2/doc/doc?'.http_build_query(['query'=>$query,'mode'=>'artlist','format'=>'json','maxrecords'=>45,'timespan'=>'2d','sort'=>'datedesc'],'','&',PHP_QUERY_RFC3986);
$r=cached('m360-brasil-news-'.date('YmdH'),900,fn()=>getJson($url,22));
if(!($r['ok']??false)){
 $rss=cached('brasil-rss-v19',900,fn()=>m360NewsRss('prefeitura município vereadores licitação',40));
 if($rss['ok']??false)respond(['ok'=>true,'noticias'=>$rss['noticias'],'total'=>count($rss['noticias']),'nacional'=>true,'fonte'=>'Google Notícias RSS','aviso'=>'GDELT indisponível; notícias nacionais via RSS. Consulta não exaustiva.']);
 respond(['ok'=>false,'error'=>'Noticiário nacional indisponível','detail'=>'GDELT: '.($r['error']??'').'; RSS: '.($rss['error']??'')],502);
}
$items=[];$seen=[];
foreach(($r['data']['articles']??[]) as $a){$link=(string)($a['url']??'');$title=trim((string)($a['title']??''));if(!preg_match('~^https?://~',$link)||$title==='')continue;$key=mb_strtolower(preg_replace('/\s+/u',' ', $title),'UTF-8');if(isset($seen[$key]))continue;$seen[$key]=true;$items[]=['titulo'=>$title,'url'=>$link,'fonte'=>(string)($a['domain']??''),'data'=>(string)($a['seendate']??''),'imagem'=>preg_match('~^https?://~i',(string)($a['socialimage']??''))?(string)$a['socialimage']:null,'origem'=>'GDELT'];}
respond(['ok'=>true,'noticias'=>$items,'total'=>count($items),'nacional'=>true,'stale'=>$r['stale']??false,'aviso'=>'Amostra de notícias indexadas sobre assuntos municipais do Brasil; não abrange todos os veículos nem todas as cidades.']);
