<?php
declare(strict_types=1);
require __DIR__.'/common.php';

function googleNewsOriginal(string $link): ?string {
 $path=(string)parse_url($link,PHP_URL_PATH);
 if(!preg_match('~/(?:rss/)?articles/([A-Za-z0-9_-]{20,})~',$path,$m))return null;
 $id=$m[1];
 $page='https://news.google.com/rss/articles/'.$id.'?hl=pt-BR&gl=BR&ceid=BR:pt-419';
 $ch=curl_init($page);
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>8,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; Municipio360/2.0)',CURLOPT_HTTPHEADER=>['Accept: text/html','Cookie: CONSENT=PENDING+987']]);
 if($ca=caBundlePath())curl_setopt($ch,CURLOPT_CAINFO,$ca);
 $html=curl_exec($ch);curl_close($ch);
 if(!is_string($html)||strlen($html)>1800000)return null;
 // Em versões antigas o endereço original aparece diretamente no HTML.
 if(preg_match('~data-n-a-sg=["\x27]([^"\x27]+)~',$html,$sg)&&preg_match('~data-n-a-ts=["\x27]([0-9]+)~',$html,$ts)){
  $inner=['garturlreq',[['X','X',['X','X'],null,null,1,1,'BR:pt-419',null,1,null,null,null,null,null,0,1],'X','X',1,[1,1,1],1,1,null,0,0,null,0],$id,(int)$ts[1],html_entity_decode($sg[1],ENT_QUOTES)];
  $req=json_encode([[['Fbv4je',json_encode($inner,JSON_UNESCAPED_SLASHES)]]],JSON_UNESCAPED_SLASHES);
  $post='f.req='.urlencode($req);
  $ch=curl_init('https://news.google.com/_/DotsSplashUi/data/batchexecute');
  curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$post,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>9,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; Municipio360/2.0)',CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded;charset=UTF-8','Accept: */*']]);
  if($ca=caBundlePath())curl_setopt($ch,CURLOPT_CAINFO,$ca);
  $out=curl_exec($ch);curl_close($ch);
  if(is_string($out)&&strlen($out)<600000){
   $pos=strpos($out,'[[');
   $outer=$pos===false?null:json_decode(substr($out,$pos),true);
   $walk=function($value,int $depth=0) use (&$walk): ?string {
    if($depth>12)return null;
    if(is_array($value)){
     foreach($value as $item){$found=$walk($item,$depth+1);if($found!==null)return $found;}
    }elseif(is_string($value)){
     $trim=trim($value);
     if(str_starts_with($trim,'[')||str_starts_with($trim,'{')){
      $decoded=json_decode($trim,true);
      if(is_array($decoded))return $walk($decoded,$depth+1);
     }
     if(filter_var($trim,FILTER_VALIDATE_URL)&&str_starts_with($trim,'https://')){
      $domain=strtolower((string)parse_url($trim,PHP_URL_HOST));
      if($domain && $domain!=='news.google.com' && !str_ends_with($domain,'.google.com'))return $trim;
     }
    }
    return null;
   };
   if(is_array($outer))return $walk($outer);
  }
 }
 return null;
}

$url=(string)($_GET['url']??'');
$googleLink=strtolower((string)parse_url($url,PHP_URL_HOST))==='news.google.com';
$resolvedOriginal=false;
if(strlen($url)>1800 || !filter_var($url,FILTER_VALIDATE_URL))respond(['ok'=>false,'error'=>'URL inválida'],400);
if(strtolower((string)parse_url($url,PHP_URL_HOST))==='news.google.com' && function_exists('curl_init')) {
 $original=googleNewsOriginal($url);
 if($original!==null){$url=$original;$resolvedOriginal=true;}
}
$parts=parse_url($url);
if(($parts['scheme']??'')!=='https'||isset($parts['user'])||isset($parts['pass'])||isset($parts['port']))respond(['ok'=>false,'error'=>'Somente HTTPS público'],400);
$host=strtolower((string)($parts['host']??''));
if(!preg_match('/^[a-z0-9.-]+$/',$host)||!str_contains($host,'.')||str_ends_with($host,'.local'))respond(['ok'=>false,'error'=>'Domínio inválido'],400);
$ips=@gethostbynamel($host);
if(!$ips)respond(['ok'=>false,'error'=>'Domínio indisponível'],422);
foreach($ips as $ip){
 if(!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4|FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE))respond(['ok'=>false,'error'=>'Destino não público'],400);
}
$cacheDir=dirname(__DIR__).'/cache';
$key=$cacheDir.'/'.hash('sha256','news-preview-v3-'.$url).'.json';
if(is_file($key)&&time()-filemtime($key)<3600){
 $old=json_decode((string)file_get_contents($key),true);
 if(is_array($old))respond($old);
}
if(!function_exists('curl_init'))respond(['ok'=>false,'error'=>'cURL indisponível'],503);
$ch=curl_init($url);
curl_setopt_array($ch,[
 CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>9,
 CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Mozilla/5.0 (compatible; Municipio360Preview/1.0)',
 CURLOPT_HTTPHEADER=>['Accept: text/html'],CURLOPT_RESOLVE=>[$host.':443:'.$ips[0]],
 CURLOPT_MAXREDIRS=>0,CURLOPT_ENCODING=>'',CURLOPT_NOPROXY=>'*'
]);
if(defined('CURLOPT_PROTOCOLS_STR'))curl_setopt($ch,CURLOPT_PROTOCOLS_STR,'https');
$ca=caBundlePath();if($ca!==null)curl_setopt($ch,CURLOPT_CAINFO,$ca);
$body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$type=(string)curl_getinfo($ch,CURLINFO_CONTENT_TYPE);curl_close($ch);
$image=null;
if(is_string($body)&&strlen($body)<=2500000&&$status===200&&str_contains(strtolower($type),'text/html')){
 $head=substr($body,0,250000);
 if(preg_match_all('~<meta\s+[^>]*>~i',$head,$tags)){
  foreach($tags[0] as $tag){
   if(!preg_match('~(?:property|name)\s*=\s*["\x27](?:og:image|twitter:image)(?::url)?["\x27]~i',$tag))continue;
   if(!preg_match('~content\s*=\s*(["\x27])(.*?)\1~is',$tag,$match))continue;
   $candidate=html_entity_decode(trim($match[2]),ENT_QUOTES|ENT_HTML5,'UTF-8');
   if(str_starts_with($candidate,'//'))$candidate='https:'.$candidate;
   if(str_starts_with($candidate,'/'))$candidate='https://'.$host.$candidate;
   if(filter_var($candidate,FILTER_VALIDATE_URL)&&parse_url($candidate,PHP_URL_SCHEME)==='https'){$image=$candidate;break;}
  }
 }
}
$result=['ok'=>true,'imagem'=>$image,'encontrada'=>$image!==null,'diagnostico'=>['origem_google'=>$googleLink,'url_original_resolvida'=>$resolvedOriginal,'http_fonte'=>$status,'tipo_resposta'=>$type,'motivo'=>$image!==null?'imagem_identificada':($googleLink&&!$resolvedOriginal?'link_google_nao_resolvido':($status!==200?'pagina_http_'.$status:'sem_metadados_de_imagem'))]];
if(is_dir($cacheDir)&&is_writable($cacheDir))@file_put_contents($key,json_encode($result,JSON_UNESCAPED_SLASHES),LOCK_EX);
respond($result);
