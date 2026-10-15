<?php
require __DIR__.'/common.php';
$uf=strtoupper((string)($_GET['uf']??''));
$ufs=['AC'=>12,'AL'=>27,'AP'=>16,'AM'=>13,'BA'=>29,'CE'=>23,'DF'=>53,'ES'=>32,'GO'=>52,'MA'=>21,'MT'=>51,'MS'=>50,'MG'=>31,'PA'=>15,'PB'=>25,'PR'=>41,'PE'=>26,'PI'=>22,'RJ'=>33,'RN'=>24,'RS'=>43,'RO'=>11,'RR'=>14,'SC'=>42,'SP'=>35,'SE'=>28,'TO'=>17];
if(!isset($ufs[$uf]))respond(['ok'=>false,'error'=>'UF inválida'],400);
$result=cached('ibge-malha-municipios-v13-'.$uf,86400*14,function()use($ufs,$uf){
 $url='https://servicodados.ibge.gov.br/api/v3/malhas/estados/'.$ufs[$uf].'?formato=application%2Fvnd.geo%2Bjson&intrarregiao=municipio';
 $ch=curl_init($url);
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Municipio360/1.3',CURLOPT_HTTPHEADER=>['Accept: application/json']]);
 if($ca=caBundlePath())curl_setopt($ch,CURLOPT_CAINFO,$ca);
 $raw=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
 if($raw===false||$http!==200)return ['ok'=>false,'error'=>$err?:'Malha IBGE HTTP '.$http];
 if(strlen($raw)>12000000)return ['ok'=>false,'error'=>'Malha excede o limite de 12 MB'];
 $data=json_decode($raw,true);if(!is_array($data)||!isset($data['features']))return ['ok'=>false,'error'=>'Malha municipal não disponível na fonte'];
 return ['ok'=>true,'data'=>$data];
});
respond($result,($result['ok']??false)?200:502);
