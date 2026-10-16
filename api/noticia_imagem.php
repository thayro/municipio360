<?php
declare(strict_types=1);
require __DIR__.'/common.php';
$url=(string)($_GET['url']??'');
if(strlen($url)>1800 || !filter_var($url,FILTER_VALIDATE_URL))respond(['ok'=>false,'error'=>'URL inválida'],400);
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
$key=$cacheDir.'/'.hash('sha256','news-preview-v1-'.$url).'.json';
if(is_file($key)&&time()-filemtime($key)<86400){
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
$result=['ok'=>true,'imagem'=>$image,'encontrada'=>$image!==null];
if(is_dir($cacheDir)&&is_writable($cacheDir))@file_put_contents($key,json_encode($result,JSON_UNESCAPED_SLASHES),LOCK_EX);
respond($result);
