<?php
declare(strict_types=1);
require __DIR__.'/common.php';

// Retratos informativos; a ausência de fotografia não altera o nome do ocupante.
$nomes=[
'Luiz Inácio Lula da Silva','Mailza Assis','Paulo Dantas','Clécio Luís',
'Roberto Cidade','Jerônimo Rodrigues','Elmano de Freitas','Celina Leão',
'Ricardo Ferraço','Daniel Vilela','Carlos Brandão','Otaviano Pivetta',
'Eduardo Riedel','Mateus Simões','Hana Ghassan','Lucas Ribeiro',
'Ratinho Junior','Raquel Lyra','Rafael Fonteles','Ricardo Couto',
'Fátima Bezerra','Eduardo Leite','Marcos Rocha','Soldado Sampaio',
'Jorginho Mello','Tarcísio de Freitas','Fábio Mitidieri','Wanderlei Barbosa'
];
function normalizaTitulo(string $s): string {
 $s=mb_strtolower($s,'UTF-8');
 $s=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s) ?: $s;
 return preg_replace('/[^a-z0-9]/','',strtolower($s)) ?: '';
}

$offset=max(0,min(count($nomes)-1,(int)($_GET['offset']??0)));
$grupo=array_slice($nomes,$offset,4);
function urlFoto(array $page): string {
 $url=(string)($page['thumbnail']['source']??'');
 return str_starts_with($url,'https://')&&parse_url($url,PHP_URL_HOST)==='upload.wikimedia.org'?$url:'';
}
function fotoPessoa(string $nome): array {
 $lastError='';
 foreach(['pt','en'] as $lang){
  $base='https://'.$lang.'.wikipedia.org/w/api.php?';
  $params=http_build_query(['action'=>'query','format'=>'json','redirects'=>1,'prop'=>'pageimages','piprop'=>'thumbnail','pithumbsize'=>240,'titles'=>$nome], '', '&', PHP_QUERY_RFC3986);
  $r=getJson($base.$params,6);
  if(!($r['ok']??false)){$lastError=(string)($r['error']??'Fonte indisponível');continue;}
  foreach(($r['data']['query']['pages']??[]) as $page){
   $url=urlFoto($page);
   if($url)return ['foto'=>$url,'origem'=>$lang.'.wikipedia.org'];
  }
  // Busca artigo por título quando a forma usual do nome não encontra a página.
  $search=http_build_query(['action'=>'query','format'=>'json','list'=>'search','srsearch'=>'intitle:"'.$nome.'"','srlimit'=>3], '', '&', PHP_QUERY_RFC3986);
  $found=getJson($base.$search,6);
  if(!($found['ok']??false))continue;
  foreach(($found['data']['query']['search']??[]) as $candidate){
   $title=(string)($candidate['title']??'');
   if($title==='' || !str_contains(normalizaTitulo($title),normalizaTitulo(explode(' ',$nome)[0])))continue;
   $q=http_build_query(['action'=>'query','format'=>'json','prop'=>'pageimages','piprop'=>'thumbnail','pithumbsize'=>240,'titles'=>$title], '', '&', PHP_QUERY_RFC3986);
   $pageResponse=getJson($base.$q,6);
   if(!($pageResponse['ok']??false))continue;
   foreach(($pageResponse['data']['query']['pages']??[]) as $page){
    $url=urlFoto($page);
    if($url)return ['foto'=>$url,'origem'=>$lang.'.wikipedia.org'];
   }
  }
 }
 return ['foto'=>'','erro'=>$lastError ?: 'Retrato não encontrado'];
}
$fotos=[];$ausentes=[];$fontes=[];
foreach($grupo as $nome){
 $result=cached('foto-pessoa-nacional-2026-v5-'.normalizaTitulo($nome),86400,static fn()=>['ok'=>true]+fotoPessoa($nome));
 $foto=(string)($result['foto']??'');
 if($foto!==''){$fotos[$nome]=$foto;$fontes[$nome]=$result['origem']??'Wikipédia';}
 else $ausentes[$nome]=$result['erro']??'Sem retrato verificado';
}
respond(['ok'=>true,'fotos'=>$fotos,'quantidade'=>count($fotos),'consultados'=>count($grupo),'ausentes'=>$ausentes,'fontes'=>$fontes,'offset'=>$offset]);
