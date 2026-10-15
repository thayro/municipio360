<?php
require __DIR__.'/common.php';
$id=cityCode();$loc=locationById($id);if(!($loc['ok']??false))respond(['ok'=>false,'error'=>'Falha ao validar município'],502);
// API pública de publicação filtra por modalidade, não devolve todas as modalidades em chamada única.
// Consulta demonstrativa: pregão eletrônico (6) e dispensa (8), período de 15 dias.
$end=new DateTimeImmutable('now',new DateTimeZone('America/Sao_Paulo'));$start=$end->modify('-15 days');
$found=[];$issues=[];
foreach([6,8] as $mod){
 $params=['dataInicial'=>$start->format('Ymd'),'dataFinal'=>$end->format('Ymd'),'codigoModalidadeContratacao'=>$mod,'codigoMunicipioIbge'=>$id,'pagina'=>1,'tamanhoPagina'=>30];
 $url='https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?'.http_build_query($params);
 $r=cached('pncp-'.$id.'-'.$mod.'-'.$end->format('Ymd'),1800,fn()=>getJson($url,16));
 if(!($r['ok']??false)){$issues[]='Modalidade '.$mod.': '.($r['error']??'sem resposta');continue;}
 foreach(($r['data']['data']??[]) as $c){
  $org=(string)($c['orgaoEntidade']['razaoSocial']??'');$year=(int)($c['anoCompra']??0);$seq=(int)($c['sequencialCompra']??0);$cnpj=preg_replace('/\D/','',(string)($c['orgaoEntidade']['cnpj']??''));
  $link=($year&&$seq&&strlen($cnpj)===14)?'https://pncp.gov.br/app/editais/'.$cnpj.'/'.$year.'/'.$seq:'https://pncp.gov.br/app/editais';
  $found[]=['objeto'=>(string)($c['objetoCompra']??''),'orgao'=>$org,'valor'=>$c['valorTotalEstimado']??null,'publicacao'=>(string)($c['dataPublicacaoPncp']??''),'modalidade'=>(string)($c['modalidadeNome']??'Modalidade '.$mod),'link'=>$link];
 }
}
usort($found,fn($a,$b)=>strcmp($b['publicacao'],$a['publicacao']));
respond(['ok'=>count($issues)<2,'itens'=>array_slice($found,0,50),'total'=>count($found),'parcial'=>true,'modalidades'=>[6,8],'periodo'=>'15 dias','erros'=>$issues,'aviso'=>'Consulta parcial por código IBGE (pregão eletrônico e dispensa). Os registros podem incluir órgãos atuantes no município; não representam exclusivamente gastos da prefeitura, nem todas as contratações.']);
