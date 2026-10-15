<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
function respond(array $value, int $code=200): never { http_response_code($code); echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function caBundlePath(): ?string {
  $localBundle = '/home/nexcode/ssl-municipio360/ibge-ca-bundle.pem';
  if (is_file($localBundle) && is_readable($localBundle)) return $localBundle;
  // Optional override in Apache/Nginx/PHP-FPM environment; NEVER bypass SSL validation.
  $custom = getenv('MUNICIPIO360_CA_BUNDLE');
  $candidates = array_filter([
    is_string($custom) ? $custom : null,
    ini_get('curl.cainfo') ?: null,
    ini_get('openssl.cafile') ?: null,
    '/etc/ssl/certs/ca-certificates.crt', // Debian/Ubuntu
    '/etc/pki/tls/certs/ca-bundle.crt', // AlmaLinux/Rocky/CentOS
    '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem',
    '/etc/ssl/ca-bundle.pem'
  ]);
  foreach ($candidates as $file) if (is_file($file) && is_readable($file)) return $file;
  return null; // curl's native OS trust configuration remains enabled
}
function getJson(string $url, int $timeout=12): array {
  if (!function_exists('curl_init')) return ['ok'=>false,'error'=>'Extensão PHP cURL ausente'];
  $ch=curl_init($url);
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>$timeout,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_USERAGENT=>'Municipio360/1.0 (consulta publica; contato via site)',CURLOPT_HTTPHEADER=>['Accept: application/json']]);
  $ca = caBundlePath();
  if ($ca !== null) curl_setopt($ch, CURLOPT_CAINFO, $ca);
  curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
  $body=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
  if($body===false||$http<200||$http>=300){
    $message=$err?:'Fonte HTTP '.$http;
    if(stripos($message,'certificate problem')!==false || stripos($message,'certificate verify failed')!==false)
      $message='Certificados raiz CA ausentes ou desatualizados na VPS. Instale/atualize ca-certificates e configure curl.cainfo no PHP-FPM (veja README).';
    return ['ok'=>false,'error'=>$message,'http'=>$http];
  }
  if(strlen($body)>3000000)return ['ok'=>false,'error'=>'Resposta excedeu limite'];
  $data=json_decode($body,true);
  if(!is_array($data))return ['ok'=>false,'error'=>'Fonte retornou dados inválidos'];
  return ['ok'=>true,'data'=>$data];
}
function cached(string $key, int $ttl, callable $producer): array {
 $dir=dirname(__DIR__).'/cache';$file=$dir.'/'.hash('sha256',$key).'.json';
 if(is_file($file)&&time()-filemtime($file)<$ttl){$v=json_decode((string)file_get_contents($file),true);if(is_array($v))return $v;}
 $result=$producer();
 if(($result['ok']??false)&&is_dir($dir)&&is_writable($dir)){
  $tmp=tempnam($dir,'tmp_');if($tmp){file_put_contents($tmp,json_encode($result,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE),LOCK_EX);rename($tmp,$file);}
 }
 if(!($result['ok']??false)&&is_file($file)){$v=json_decode((string)file_get_contents($file),true);if(is_array($v)){$v['stale']=true;$v['warning']=$result['error']??'Fonte indisponível';return $v;}}
 return $result;
}
function cityCode(): string { $id=(string)($_GET['id']??'');if(!preg_match('/^\d{7}$/',$id))respond(['ok'=>false,'error'=>'Código IBGE municipal inválido'],400);return $id; }
function locationById(string $id): array {
 return cached('ibge-city-'.$id,86400*7,fn()=>getJson('https://servicodados.ibge.gov.br/api/v1/localidades/municipios/'.$id));
}
