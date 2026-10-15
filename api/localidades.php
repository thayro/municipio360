<?php
require __DIR__.'/common.php';
$type=(string)($_GET['tipo']??'estados');
if($type==='estados'){
 $result=cached('ibge-estados-v1',86400*7,fn()=>getJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'));
}elseif($type==='municipios'){
 $uf=strtoupper((string)($_GET['uf']??''));
 if(!preg_match('/^[A-Z]{2}$/',$uf))respond(['ok'=>false,'error'=>'UF inválida'],400);
 $result=cached('ibge-municipios-'.$uf,86400*7,fn()=>getJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados/'.$uf.'/municipios?orderBy=nome'));
}elseif($type==='municipio'){$result=locationById(cityCode());}
else respond(['ok'=>false,'error'=>'Tipo inválido'],400);
respond($result,($result['ok']??false)?200:502);
