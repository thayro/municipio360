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
 respond(['ok'=>true,'disponivel'=>false,'rede'=>'YouTube','motivo'=>'API do YouTube não configurada no servidor','publicacoes'=>[],'total_amostra'=>0,'mencoes'=>null,'hashtags'=>[],'score'=>null,'observacao'=>'O score de notícias não incorpora esta fonte sem dados verificáveis.']);
}
$query='"'.$city.'" "'.$uf.'"';
$end='https://www.googleapis.com/youtube/v3/search?'.http_build_query([
 'part'=>'snippet','type'=>'video','order'=>'date','maxResults'=>20,'q'=>$query,
 'publishedAfter'=>gmdate('Y-m-d\\TH:i:s\\Z',time()-30*86400),'regionCode'=>'BR','key'=>$key
], '', '&', PHP_QUERY_RFC3986);
$r=cached('youtube-city-v1-'.$id,21600,fn()=>getJson($end,12));
if(!($r['ok']??false))respond(['ok'=>true,'disponivel'=>false,'rede'=>'YouTube','motivo'=>'Consulta temporariamente indisponível','publicacoes'=>[],'total'=>0,'score'=>null]);
// Agrega resultados da busca, sem expor lista de publicações.
$unique=[];$hashtags=[];$aboutMayor=0;$aboutCouncil=0;$aboutCity=0;
foreach(($r['data']['items']??[]) as $item){
 $video=(string)($item['id']['videoId']??'');
 if(!preg_match('/^[A-Za-z0-9_-]{11}$/',$video)||isset($unique[$video]))continue;
 $unique[$video]=true;
 $snippet=$item['snippet']??[];
 $text=html_entity_decode((string)($snippet['title']??'').' '.(string)($snippet['description']??''),ENT_QUOTES|ENT_HTML5,'UTF-8');
 $normalized=mb_strtolower($text,'UTF-8');
 if(str_contains($normalized,'prefeit')||str_contains($normalized,'gestão municipal'))$aboutMayor++;
 if(str_contains($normalized,'vereador')||str_contains($normalized,'câmara municipal'))$aboutCouncil++;
 if(mb_stripos($text,$city,0,'UTF-8')!==false)$aboutCity++;
 if(preg_match_all('/#[\\p{L}\\p{N}_]{2,60}/u',$text,$found)){
  foreach($found[0] as $tag){
   $lower=mb_strtolower($tag,'UTF-8');
   $hashtags[$lower]=($hashtags[$lower]??0)+1;
  }
 }
}
arsort($hashtags);
$top=[];foreach(array_slice($hashtags,0,5,true) as $hashtag=>$mentions){$top[]=['hashtag'=>$hashtag,'ocorrencias'=>$mentions];}
respond(['ok'=>true,'disponivel'=>true,'rede'=>'YouTube','janela_dias'=>30,
 'total_amostra'=>count($unique),'mencoes'=>['cidade'=>$aboutCity,'prefeito_ou_prefeitura'=>$aboutMayor,'vereadores_ou_camara'=>$aboutCouncil],
 'hashtags'=>$top,'score'=>null,'publicacoes'=>[],
 'observacao'=>'Contagens de termos em títulos e descrições de até 20 vídeos encontrados na busca, não representam o volume total da rede, nem opinião pública. Termos podem se sobrepor.']);
