<?php
/** Fonte secundária: títulos publicados no Google Notícias RSS. Não acessa posts sociais. */
function m360NewsRss(string $q,int $limit=25): array {
 $url='https://news.google.com/rss/search?'.http_build_query(['q'=>$q,'hl'=>'pt-BR','gl'=>'BR','ceid'=>'BR:pt-419'],'','&',PHP_QUERY_RFC3986);
 $ch=curl_init($url);
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>6,CURLOPT_TIMEOUT=>16,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_MAXREDIRS=>3,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; Municipio360/1.9)']);
 if($ca=caBundlePath())curl_setopt($ch,CURLOPT_CAINFO,$ca);
 $xmlText=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
 if($xmlText===false||$http!==200)return ['ok'=>false,'error'=>$err?:'Google Noticias HTTP '.$http];
 if(strlen($xmlText)>2000000)return ['ok'=>false,'error'=>'RSS excedeu tamanho máximo'];
 if(!function_exists('simplexml_load_string'))return ['ok'=>false,'error'=>'Extensão SimpleXML ausente'];
 $old=libxml_use_internal_errors(true);$xml=simplexml_load_string($xmlText,'SimpleXMLElement',LIBXML_NONET);libxml_clear_errors();libxml_use_internal_errors($old);
 if(!$xml||!isset($xml->channel))return ['ok'=>false,'error'=>'RSS inválido'];
 $result=[];$seen=[];
 foreach($xml->channel->item as $item){$title=trim((string)$item->title);$link=trim((string)$item->link);
  if(!$title||!preg_match('~^https://news\.google\.com/~i',$link))continue;
  $key=mb_strtolower(preg_replace('/\s+/u',' ',$title),'UTF-8');if(isset($seen[$key]))continue;$seen[$key]=1;
  $result[]=['titulo'=>$title,'url'=>$link,'fonte'=>trim((string)$item->source)?:'Google Notícias','data'=>(string)$item->pubDate,'imagem'=>null,'origem'=>'Google Notícias RSS'];
  if(count($result)>=$limit)break;
 }
 return ['ok'=>true,'noticias'=>$result];
}
