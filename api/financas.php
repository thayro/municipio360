<?php
declare(strict_types=1);
require __DIR__.'/common.php';
$id=cityCode(); $loc=locationById($id);
if(!($loc['ok']??false))respond(['ok'=>false,'error'=>'IBGE indisponível','detail'=>$loc['error']??''],502);
$ano=max(2020,min((int)date('Y')-1,(int)($_GET['ano']??(date('Y')-1))));
// DCA: demonstrativo anual declarado pelo ente federativo. Não corresponde a gasto corrente em tempo real.
$url='https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?'.http_build_query(['an_exercicio'=>$ano,'id_ente'=>$id], '', '&', PHP_QUERY_RFC3986);
$r=cached('siconfi-dca-'.$id.'-'.$ano,86400,fn()=>getJson($url,18));
if(!($r['ok']??false))respond(['ok'=>true,'disponivel'=>false,'ano'=>$ano,'fonte'=>'Tesouro Nacional / SICONFI','mensagem'=>'DCA indisponível nesta consulta: '.($r['error']??'sem detalhes'),'documentos'=>[],'fonte_url'=>'https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos']);
$items=$r['data']['items']??[];
if(!is_array($items))$items=[];
// Exibimos somente linhas efetivamente recebidas, sem somar contas heterogêneas nem inferir totais.
$lines=[];foreach(array_slice($items,0,100) as $x){if(!is_array($x))continue;$lines[]=['anexo'=>(string)($x['anexo']??$x['no_anexo']??''),'conta'=>(string)($x['conta']??$x['cod_conta']??$x['no_conta']??''),'descricao'=>(string)($x['descricao']??$x['no_conta']??$x['conta']??''),'valor'=>isset($x['valor']) && is_numeric($x['valor'])?(float)$x['valor']:null];}
respond(['ok'=>true,'disponivel'=>count($items)>0,'ano'=>$ano,'quantidade_retornada'=>count($items),'amostra'=>$lines,'fonte'=>'Tesouro Nacional — Declaração de Contas Anuais (DCA)','fonte_url'=>'https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos','consulta_api'=>$url,'stale'=>$r['stale']??false,'nota'=>'Dados fiscais anuais declarados ao SICONFI. Não representam execução orçamentária em tempo real, contas eleitorais ou auditoria. Valores não agregados por risco de dupla contagem.']);
