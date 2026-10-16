<?php
declare(strict_types=1);
require __DIR__.'/common.php';

$id=cityCode();
$location=locationById($id);
if(!($location['ok']??false)) respond(['ok'=>false,'error'=>'Município não encontrado no IBGE'],502);
$local=$location['data'];
$uf=strtolower((string)($local['microrregiao']['mesorregiao']['UF']['sigla']??$local['regiao-imediata']['regiao-intermediaria']['UF']['sigla']??''));
if(!preg_match('/^[a-z]{2}$/',$uf)) respond(['ok'=>false,'error'=>'UF não identificada no IBGE'],502);

$base='https://resultados.tse.jus.br/oficial/ele2024';
function peopleFromResult(array $data, string $role):array {
 $people=[];
 foreach(($data['carg']??[]) as $cargo){
  if(!is_array($cargo))continue;
  foreach(($cargo['agr']??[]) as $group){
   if(!is_array($group))continue;
   foreach(($group['par']??[]) as $party){
    if(!is_array($party))continue;
    foreach(($party['cand']??[]) as $cand){
     if(!is_array($cand))continue;
     $status=trim((string)($cand['st']??''));
     // "e=s" isolado no primeiro turno pode apenas significar classificado para 2º turno.
     if(strtolower((string)($cand['e']??''))!=='s' || !preg_match('/^eleit[oa]/iu',$status))continue;
     $name=trim((string)($cand['nm']??$cand['nmu']??''));
     if($name==='')continue;
     $people[]=[
      'nome'=>strip_tags($name),'nome_urna'=>strip_tags((string)($cand['nmu']??$name)),
      'partido'=>strip_tags((string)($party['sg']??'')),
      'foto'=>'','url'=>'https://resultados.tse.jus.br/oficial/app/index.html',
      'fonte'=>'TSE — resultados municipais 2024','situacao'=>$status,'cargo'=>$role,
      'votos'=>(int)($cand['vap']??0)
     ];
    }
   }
  }
 }
 return $people;
}
function resultsUrl(string $base,int $turn,string $uf,string $code,int $role):string {
 return $base.'/'.$turn.'/dados/'.$uf.'/'.$uf.$code.'-c'.str_pad((string)$role,4,'0',STR_PAD_LEFT).'-e'.str_pad((string)$turn,6,'0',STR_PAD_LEFT).'-u.json';
}

// O catálogo do TSE contém apenas metadados e os códigos IBGE/TSE.
// Ele é consultado sob demanda, e não importado permanentemente.
$catalog=cached('tse-municipios-2024-619-v1',604800,
 static fn()=>getJson($base.'/619/config/mun-e000619-cm.json',25));
if(!($catalog['ok']??false))respond([
 'ok'=>true,'prefeito'=>null,'vice'=>null,'vereadores'=>[],
 'consulta_disponivel'=>false,
 'observacao'=>'Catálogo oficial do TSE indisponível: '.($catalog['error']??'erro desconhecido')
]);
$municipality=null;
foreach(($catalog['data']['abr']??[]) as $state){
 if(!is_array($state)||strtolower((string)($state['cd']??''))!==$uf)continue;
 foreach(($state['mu']??[]) as $m){
  if(is_array($m) && (string)($m['cdi']??'')===$id){$municipality=$m;break;}
 }
 break;
}
if(!$municipality)respond([
 'ok'=>true,'prefeito'=>null,'vice'=>null,'vereadores'=>[],
 'consulta_disponivel'=>false,
 'observacao'=>'Município não encontrado no catálogo TSE pelo código IBGE.'
]);
$code=(string)($municipality['cd']??'');
if(!preg_match('/^\d{5}$/',$code))respond([
 'ok'=>true,'prefeito'=>null,'vice'=>null,'vereadores'=>[],
 'consulta_disponivel'=>false,'observacao'=>'Código eleitoral municipal inválido.'
]);
$hasRunoff=strtolower((string)($municipality['c']??'n'))==='s';

// Resultado de prefeito só é considerado final no turno indicado pelo TSE.
$turn=$hasRunoff?620:619;
$key='tse-results-2024-v2-'.$uf.'-'.$code;
$result=cached($key,21600,static function()use($base,$uf,$code,$turn){
 $mayor=getJson(resultsUrl($base,$turn,$uf,$code,11),20);
 $council=getJson(resultsUrl($base,619,$uf,$code,13),20);
 if(!($mayor['ok']??false)&&!($council['ok']??false))
  return ['ok'=>false,'error'=>'Prefeito: '.($mayor['error']??'erro').'; vereadores: '.($council['error']??'erro')];
 $mayorPeople=($mayor['ok']??false)?peopleFromResult($mayor['data'],'prefeito'):[];
 $councilPeople=($council['ok']??false)?peopleFromResult($council['data'],'vereadores'):[];
 return ['ok'=>true,'prefeito'=>$mayorPeople[0]??null,'vice'=>null,
  'vereadores'=>array_slice($councilPeople,0,60),
  'avisos'=>array_values(array_filter([
   ($mayor['ok']??false)?null:'Prefeito: '.($mayor['error']??'consulta indisponível'),
   ($council['ok']??false)?null:'Vereadores: '.($council['error']??'consulta indisponível')
  ]))];
});
if(!($result['ok']??false))respond([
 'ok'=>true,'prefeito'=>null,'vice'=>null,'vereadores'=>[],
 'consulta_disponivel'=>false,'observacao'=>'Resultados eleitorais indisponíveis: '.($result['error']??'sem detalhes'),
 'fonte_url'=>'https://resultados.tse.jus.br/oficial/app/index.html'
]);
respond([
 'ok'=>true,'prefeito'=>$result['prefeito']??null,'vice'=>null,
 'vereadores'=>$result['vereadores']??[],
 'consulta_disponivel'=>true,
 'fonte'=>'TSE — resultados municipais de 2024',
 'fonte_url'=>'https://resultados.tse.jus.br/oficial/app/index.html',
 'observacao'=>'São os eleitos de 2024, não uma confirmação de ocupação do cargo em 2026. Vice-prefeito não é inferido a partir do resultado de prefeito.',
 'turno_prefeito'=>$turn===620?2:1,
 'avisos'=>$result['avisos']??[],
 'stale'=>$result['stale']??false
]);
