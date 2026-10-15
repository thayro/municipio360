<?php
require __DIR__.'/common.php';
$id=cityCode();$loc=locationById($id);
if(!($loc['ok']??false))respond(['ok'=>false,'error'=>'Não foi possível identificar município'],502);
$city=(string)($loc['data']['nome']??'');$uf=(string)($loc['data']['microrregiao']['mesorregiao']['UF']['sigla']??$loc['data']['regiao-imediata']['regiao-intermediaria']['UF']['sigla']??'');
if(!$city||!preg_match('/^[A-Z]{2}$/',$uf))respond(['ok'=>false,'error'=>'Localidade incompleta'],502);
$terms=['geral'=>'','prefeitura'=>' prefeitura','camara'=>' vereadores câmara','saude'=>' saúde','educacao'=>' educação','obras'=>' obras'];
$topic=(string)($_GET['tema']??'geral');if(!isset($terms[$topic]))respond(['ok'=>false,'error'=>'Tema inválido'],400);
$q='"'.$city.'" "'.$uf.'"'.$terms[$topic];
$url='https://news.google.com/rss/search?'.http_build_query(['q'=>$q,'hl'=>'pt-BR','gl'=>'BR','ceid'=>'BR:pt-419']);
$result=cached('rss-'.$id.'-'.$topic,900,function()use($url){
 $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>18,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_MAXREDIRS=>3,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Municipio360/1.3']);if($ca=caBundlePath())curl_setopt($ch,CURLOPT_CAINFO,$ca);$body=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
 if($body===false||$http!==200)return ['ok'=>false,'error'=>$err?:'Feed HTTP '.$http];
 if(strlen($body)>2000000)return ['ok'=>false,'error'=>'Feed muito grande'];
 $old=libxml_use_internal_errors(true);$xml=simplexml_load_string($body,'SimpleXMLElement',LIBXML_NONET);libxml_clear_errors();libxml_use_internal_errors($old);
 if(!$xml)return ['ok'=>false,'error'=>'Feed RSS inválido'];
 $items=[];foreach(($xml->channel->item??[]) as $item){$title=trim((string)$item->title);$link=(string)$item->link;if(!preg_match('~^https://news\.google\.com/~',$link))continue;
 $items[]=['titulo'=>$title,'url'=>$link,'fonte'=>trim((string)$item->source)?:'Google Notícias','data'=>(string)$item->pubDate,'imagem'=>null,'origem'=>'RSS'];if(count($items)>=30)break;}
 return ['ok'=>true,'noticias'=>$items];
});
respond($result,($result['ok']??false)?200:502);
