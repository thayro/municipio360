<?php
declare(strict_types=1);
require __DIR__.'/common.php';
$id=cityCode();
$location=locationById($id);
if(!($location['ok']??false)) respond(['ok'=>false,'error'=>'Município não encontrado no IBGE'],502);
$local=$location['data'];
$name=(string)($local['nome']??'');
$uf=(string)($local['microrregiao']['mesorregiao']['UF']['sigla']??'');
if(!preg_match('/^[A-Z]{2}$/',$uf)) respond(['ok'=>false,'error'=>'UF não identificada no IBGE'],502);
// Esta integração consome a interface pública DivulgaCandContas em cada consulta,
// e mantém cache JSON curto. Não faz importação, armazenamento eleitoral permanente ou scraping.
$base='https://divulgacandcontas.tse.jus.br/divulga/rest/v1';
$election='2045202024'; // eleição municipal ordinária de 2024 no DivulgaCandContas
function normMunicipio(string $str):string {
 $str=mb_strtoupper($str,'UTF-8');
 $str=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$str) ?: $str;
 return trim((string)preg_replace('/[^A-Z0-9]+/',' ',strtoupper($str)));
}
function oneOf(array $x,array $fields):mixed {foreach($fields as $k){if(isset($x[$k])&&$x[$k]!==''&&$x[$k]!==null)return $x[$k];}return null;}
function getStatus(array $p):string {
 $fields=['descricaoSituacaoTotalizacao','situacaoTotalizacao','dsSituacaoTotalizacao','situacaoEleicao','descricaoSituacaoEleicao','situacaoCandidato','descricaoSituacao','situacao','status'];
 $parts=[];foreach($fields as $f){if(!isset($p[$f]))continue;$v=$p[$f];if(is_array($v))$v=oneOf($v,['descricao','nome','sigla','valor'])??'';if(is_scalar($v))$parts[]=(string)$v;}
 return implode(' / ',$parts);
}
function isElected(string $status):bool {
 $s=normMunicipio($status);
 return str_contains($s,'ELEIT') && !str_contains($s,'NAO ELEIT') && !str_contains($s,'NAO-ELEIT');
}
function safePhoto(mixed $value):string {
 if(!is_string($value)||!filter_var($value,FILTER_VALIDATE_URL)||strtolower((string)parse_url($value,PHP_URL_SCHEME))!=='https')return '';
 $host=strtolower((string)parse_url($value,PHP_URL_HOST));
 if($host==='tse.jus.br'||str_ends_with($host,'.tse.jus.br'))return $value;
 return '';
}
function normalizePerson(array $p,string $role):?array {
 $nom=oneOf($p,['nomeUrna','nome','nomeCandidato','nomeCompleto','nomeSocial']);
 if(!is_string($nom)||trim($nom)==='')return null;
 $status=getStatus($p);
 // A API de candidaturas pode expor situações históricas ou diferentes fases de apuração.
 // Não classificamos como eleitos candidatos sem status explicitamente verificável.
 if(!isElected($status))return null;
 $party=oneOf($p,['partido','siglaPartido','partidoSigla']);
 if(is_array($party))$party=oneOf($party,['sigla','nome'])??'';
 $photo=safePhoto(oneOf($p,['urlFoto','fotoUrl','foto','urlFotoCandidato','fotoCandidato']));
 return ['nome'=>strip_tags(trim($nom)),'partido'=>is_scalar($party)?strip_tags((string)$party):'','foto'=>$photo,'url'=>'https://divulgacandcontas.tse.jus.br/','fonte'=>'TSE — eleição municipal 2024','situacao'=>$status,'cargo'=>$role];
}
function tseRequest(string $url):array {
 // Reaproveita TLS validado em common.php; falhas retornam diagnóstico, nunca dados inventados.
 return getJson($url,18);
}
$result=cached('municipio360-tse-direto-2024-'.$uf.'-'.$id,21600,static function() use($base,$election,$uf,$name) {
 $mun=tseRequest($base.'/eleicao/uf/'.$election.'/'.$uf.'/municipios');
 if(!($mun['ok']??false))return ['ok'=>false,'error'=>'TSE: consulta de municípios indisponível: '.($mun['error']??'sem detalhes')];
 $raw=$mun['data'];
 $items=array_is_list($raw)?$raw:(oneOf($raw,['municipios','unidadesEleitorais','unidades','lista','dados'])??[]);
 if(!is_array($items))return ['ok'=>false,'error'=>'TSE: formato do catálogo de municípios não reconhecido'];
 $candidate=null;
 foreach($items as $r){
  if(!is_array($r))continue;
  $n=oneOf($r,['nome','descricao','municipio','nomeMunicipio']);
  if(is_string($n) && normMunicipio($n)===normMunicipio($name)){$candidate=$r;break;}
 }
 if(!$candidate)return ['ok'=>false,'error'=>'TSE: município não localizado na lista eleitoral (código IBGE e TSE são diferentes)'];
 $code=oneOf($candidate,['codigo','id','codigoTse','codigoMunicipio','cdMunicipio']);
 if(!is_scalar($code)||!preg_match('/^\d+$/',(string)$code))return ['ok'=>false,'error'=>'TSE: código eleitoral indisponível'];
 $candidates=[];$errors=[];
 foreach(['prefeito'=>11,'vice'=>12,'vereadores'=>13] as $role=>$cargo){
  $r=tseRequest($base.'/candidatura/listar/2024/'.rawurlencode((string)$code).'/'.$election.'/'.$cargo.'/candidatos');
  if(!($r['ok']??false)){$errors[]=$role.': '.($r['error']??'indisponível');continue;}
  $data=$r['data'];$list=array_is_list($data)?$data:($data['candidatos']??[]);
  if(!is_array($list)){$errors[]=$role.': resposta com estrutura desconhecida';continue;}
  foreach($list as $person){if(!is_array($person))continue;$x=normalizePerson($person,$role);if($x)$candidates[$role][]=$x;}
 }
 if(count($errors)===3)return ['ok'=>false,'error'=>'TSE indisponível: '.implode('; ',$errors)];
 return ['ok'=>true,'prefeito'=>$candidates['prefeito'][0]??null,'vice'=>$candidates['vice'][0]??null,'vereadores'=>array_slice($candidates['vereadores']??[],0,35),'source'=>'TSE DivulgaCandContas (consulta HTTP direta)','warnings'=>$errors,'codigo_tse'=>(string)$code,'identificados'=>count($candidates['prefeito']??[])+count($candidates['vice']??[])+count($candidates['vereadores']??[])];
});
if(!($result['ok']??false)){
 respond(['ok'=>true,'prefeito'=>null,'vice'=>null,'vereadores'=>[],'fonte'=>'TSE (consulta indisponível)','observacao'=>($result['error']??'Não foi possível confirmar eleitos pela consulta direta.').' Consulte a fonte oficial; nenhum candidato foi presumido eleito.','fonte_url'=>'https://resultados.tse.jus.br/oficial/app/index.html','consulta_disponivel'=>false]);
}
respond(['ok'=>true,'prefeito'=>$result['prefeito']??null,'vice'=>$result['vice']??null,'vereadores'=>$result['vereadores']??[],'fonte'=>$result['source']??'TSE','observacao'=>'Eleitos de 2024, quando confirmados pelo status publicado pelo TSE. Não comprova quem ocupa o cargo em 2026. Fotos só aparecem com URL oficial comprovada; a ausência de nomes pode indicar mudança de formato ou indisponibilidade da API.','fonte_url'=>'https://resultados.tse.jus.br/oficial/app/index.html','consulta_disponivel'=>true,'avisos'=>$result['warnings']??[],'stale'=>$result['stale']??false]);
