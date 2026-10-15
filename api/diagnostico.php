<?php
require __DIR__.'/common.php';
// Minimal non-sensitive check; remove this file after troubleshooting if desired.
$ca=caBundlePath();
$check=getJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados/52',12);
respond([
 'ok'=>$check['ok']??false,
 'php'=>PHP_VERSION,
 'curl_installed'=>extension_loaded('curl'),
 'curl_version'=>extension_loaded('curl')?(curl_version()['version']??''):null,
 'ca_bundle_found'=>$ca!==null,
 'ca_bundle_readable'=>$ca!==null&&is_readable($ca),
 'ibge_https_ok'=>$check['ok']??false,
 'error'=>$check['ok']?null:($check['error']??'Falha desconhecida'),
]);
