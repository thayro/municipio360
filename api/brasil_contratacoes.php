<?php
declare(strict_types=1);require __DIR__.'/common.php';
// Amostra nacional das publicações recentes em duas modalidades. PNCP não oferece filtro universal para 'somente prefeitura'.
$end=new DateTimeImmutable('now',new DateTimeZone('America/Sao_Paulo'));$start=$end->modify('-7 days');$items=[];$errors=[];$seen=[];
foreach([6,8] as $mod){
 $q=['dataInicial'=>$start->format('Ymd'),'dataFinal'=>$end->format('Ymd'),'codigoModalidadeContratacao'=>$mod,'pagina'=>1,'tamanhoPagina'=>50];
 $url='https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?'.http_build_query($q);
 $r=cached('m360-pncp-brasil-'.$end->format('Ymd').'-'.$mod,1800,fn()=>getJson($url,22));
 if(!($r['ok']??false)){$errors[]='Modalidade '.$mod.': '.($r['error']??'falha');continue;}
 foreach(($r['data']['data']??[]) as $c){
  $org=(string)($c['orgaoEntidade']['razaoSocial']??'');
  if(!preg_match('/PREFEITURA|MUNIC[IÍ]PIO|C[ÂA]MARA MUNICIPAL|FUNDO MUNICIPAL|SECRETARIA MUNICIPAL/ui',$org))continue;
  $cnpj=preg_replace('/\D/','',(string)($c['orgaoEntidade']['cnpj']??''));$year=(int)($c['anoCompra']??0);$seq=(int)($c['sequencialCompra']??0);
  $key="$cnpj-$year-$seq";if(isset($seen[$key]))continue;$seen[$key]=true;
  $link=$year>0&&$seq>0&&strlen($cnpj)===14?"https://pncp.gov.br/app/editais/$cnpj/$year/$seq":'https://pncp.gov.br/app/editais';
  $items[]=['objeto'=>(string)($c['objetoCompra']??''),'orgao'=>$org,'valor'=>$c['valorTotalEstimado']??null,'publicacao'=>(string)($c['dataPublicacaoPncp']??''),'modalidade'=>(string)($c['modalidadeNome']??"Modalidade $mod"),'link'=>$link,'uf'=>(string)($c['unidadeOrgao']['ufSigla']??''),'municipio'=>(string)($c['unidadeOrgao']['municipioNome']??'')];
 }
}
usort($items,fn($a,$b)=>strcmp($b['publicacao'],$a['publicacao']));
respond(['ok'=>count($errors)<2,'itens'=>array_slice($items,0,30),'total'=>count($items),'erros'=>$errors,'nacional'=>true,'parcial'=>true,'aviso'=>'Amostra nacional de pregões e dispensas publicados nos últimos 7 dias na primeira página de cada modalidade. Filtragem aproximada por nome do órgão; não representa todas as prefeituras nem todas as contratações.']);
