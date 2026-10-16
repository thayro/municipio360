<?php
declare(strict_types=1);
require __DIR__.'/common.php';
// Fotos de candidaturas de 2022. NÃO comprovam quem ocupa cargo em 2026.
$names=[
'BR'=>'Luiz Inácio Lula da Silva','AC'=>'Mailza Assis','AL'=>'Paulo Dantas',
'AP'=>'Clécio Luís','AM'=>'Roberto Cidade','BA'=>'Jerônimo Rodrigues',
'CE'=>'Elmano de Freitas','DF'=>'Celina Leão','ES'=>'Ricardo Ferraço',
'GO'=>'Daniel Vilela','MA'=>'Carlos Brandão','MT'=>'Otaviano Pivetta',
'MS'=>'Eduardo Riedel','MG'=>'Mateus Simões','PA'=>'Hana Ghassan',
'PB'=>'Lucas Ribeiro','PR'=>'Ratinho Junior','PE'=>'Raquel Lyra',
'PI'=>'Rafael Fonteles','RJ'=>'Ricardo Couto','RN'=>'Fátima Bezerra',
'RS'=>'Eduardo Leite','RO'=>'Marcos Rocha','RR'=>'Soldado Sampaio',
'SC'=>'Jorginho Mello','SP'=>'Tarcísio de Freitas',
'SE'=>'Fábio Mitidieri','TO'=>'Wanderlei Barbosa'
];
$uf=strtoupper((string)($_GET['uf']??'BR'));
if(!isset($names[$uf]))respond(['ok'=>false,'error'=>'UF inválida'],400);
function normalizePerson(string $name): string {
 $name=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$name)?:$name;
 return preg_replace('/[^A-Z0-9]+/','',strtoupper($name))?:'';
}
function tseCandidates(array $json): array {
 $people=[];
 foreach(($json['carg']??[]) as $cargo)
  foreach(($cargo['agr']??[]) as $group)
   foreach(($group['par']??[]) as $party)
    foreach(($party['cand']??[]) as $cand)
     if(is_array($cand))$people[]=$cand;
 return $people;
}
function tsePhoto(string $uf,string $wanted): array {
 $scope=strtolower($uf);
 $turns=$uf==='BR'?[545,544]:[547,546];
 $role=$uf==='BR'?'0001':'0003';
 $failure='';
 foreach($turns as $turn){
  $base='https://resultados.tse.jus.br/oficial/ele2022/'.$turn;
  $file=$scope.'-c'.$role.'-e'.str_pad((string)$turn,6,'0',STR_PAD_LEFT).'-u.json';
  $result=getJson($base.'/dados/'.$scope.'/'.$file,12);
  if(!($result['ok']??false)){$failure=(string)($result['error']??'TSE indisponível');continue;}
  foreach(tseCandidates($result['data']) as $cand){
   $full=normalizePerson((string)($cand['nm']??''));
   $ballot=normalizePerson((string)($cand['nmu']??''));
   $name=normalizePerson($wanted);
   $isMatch=$full===$name||$ballot===$name;
   // Nome da urna de Lula é diferente do nome civil.
   if($uf==='BR'&&$name===normalizePerson('Luiz Inácio Lula da Silva'))
    $isMatch=$isMatch||$ballot==='LULA';
   if(!$isMatch)continue;
   $sq=(string)($cand['sqcand']??'');
   if(!preg_match('/^\d{1,20}$/',$sq))continue;
   return ['foto'=>$base.'/fotos/'.$scope.'/'.$sq.'.jpeg','turno'=>$turn,'sqcand'=>$sq];
  }
 }
 return ['foto'=>'','erro'=>$failure?:'Nome não consta entre os candidatos ao cargo em 2022'];
}
$wanted=$names[$uf];
$result=cached('tse-nacional-foto-2022-v1-'.$uf,86400*7,static function()use($uf,$wanted){
 $v=tsePhoto($uf,$wanted);
 return ['ok'=>true]+$v;
});
$foto=(string)($result['foto']??'');
respond([
 'ok'=>true,'uf'=>$uf,'nome'=>$wanted,'fotos'=>$foto!==''?[$wanted=>$foto]:[],
 'quantidade'=>$foto!==''?1:0,'ausentes'=>$foto===''?[$wanted=>$result['erro']??'Não localizado']:[],
 'fonte'=>'TSE, fotos eleitorais 2022; não confirma exercício do cargo em 2026',
 'turno'=>$result['turno']??null
]);
