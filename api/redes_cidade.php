<?php
declare(strict_types=1);
require __DIR__.'/common.php';
$id=cityCode();
$loc=locationById($id);
if(!($loc['ok']??false))respond(['ok'=>false,'error'=>'Município indisponível'],502);
$city=trim((string)($loc['data']['nome']??''));
$uf=(string)($loc['data']['microrregiao']['mesorregiao']['UF']['sigla']??$loc['data']['regiao-imediata']['regiao-intermediaria']['UF']['sigla']??'');
if($city===''||!preg_match('/^[A-Z]{2}$/',$uf))respond(['ok'=>false,'error'=>'Localidade inválida'],502);
$key=trim((string)(getenv('MUNICIPIO360_YOUTUBE_API_KEY')?:''));
if($key===''||!preg_match('/^[A-Za-z0-9_\\-]{20,128}$/',$key)){
 respond(['ok'=>true,'disponivel'=>false,'rede'=>'YouTube','motivo'=>'API do YouTube não configurada no servidor','publicacoes'=>[],'total'=>0,'score'=>null,'observacao'=>'O score de notícias não incorpora esta fonte sem dados verificáveis.']);
}
$query='"'.$city.'" "'.$uf.'"';
$end='https://www.googleapis.com/youtube/v3/search?'.http_build_query([
 'part'=>'snippet','type'=>'video','order'=>'date','maxResults'=>20,'q'=>$query,
 'publishedAfter'=>gmdate('Y-m-d\\TH:i:s\\Z',time()-30*86400),'regionCode'=>'BR','key'=>$key
], '', '&', PHP_QUERY_RFC3986);
$r=cached('youtube-city-v1-'.$id,21600,fn()=>getJson($end,12));
if(!($r['ok']??false))respond(['ok'=>true,'disponivel'=>false,'rede'=>'YouTube','motivo'=>'Consulta temporariamente indisponível','publicacoes'=>[],'total'=>0,'score'=>null]);
$posts=[];
foreach(($r['data']['items']??[]) as $item){
 $video=(string)($item['id']['videoId']??'');$title=trim((string)($item['snippet']['title']??''));
 $date=(string)($item['snippet']['publishedAt']??'');$channel=(string)($item['snippet']['channelTitle']??'');
 if(!preg_match('/^[A-Za-z0-9_-]{11}$/',$video)||$title==='')continue;
 $posts[]=['titulo'=>html_entity_decode($title,ENT_QUOTES|ENT_HTML5,'UTF-8'),'rede'=>'YouTube','canal'=>$channel,'data'=>$date,'url'=>'https://www.youtube.com/watch?v='.$video];
}
respond(['ok'=>true,'disponivel'=>true,'rede'=>'YouTube','total'=>count($posts),'publicacoes'=>$posts,
 'score'=>null,'observacao'=>'Publicações recuperadas pela API oficial; presença na busca não comprova autoria local nem representa opinião pública.']);
