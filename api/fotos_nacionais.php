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
$resultado=cached('fotos-nacionais-2026-v2',86400,static function() use ($nomes): array {
 $fotos=[];$falhas=0;
 foreach(array_chunk($nomes,5) as $grupo){
  $params=http_build_query([
   'action'=>'query','format'=>'json','redirects'=>'1','prop'=>'pageimages',
   'piprop'=>'thumbnail','pithumbsize'=>240,'titles'=>implode('|',$grupo)
  ],'','&',PHP_QUERY_RFC3986);
  $ret=getJson('https://pt.wikipedia.org/w/api.php?'.$params,10);
  if(!($ret['ok']??false)){$falhas++;continue;}
  $data=$ret['data']['query']??[];
  $redirects=[];$pages=[];
  foreach(($data['redirects']??[]) as $x){
   $redirects[normalizaTitulo((string)($x['from']??''))]=normalizaTitulo((string)($x['to']??''));
  }
  foreach(($data['normalized']??[]) as $x){
   $redirects[normalizaTitulo((string)($x['from']??''))]=normalizaTitulo((string)($x['to']??''));
  }
  foreach(($data['pages']??[]) as $page)$pages[normalizaTitulo((string)($page['title']??''))]=$page;
  foreach($grupo as $nome){
   $key=normalizaTitulo($nome);
   for($i=0;$i<3 && isset($redirects[$key]);$i++)$key=$redirects[$key];
   $url=(string)($pages[$key]['thumbnail']['source']??'');
   $host=parse_url($url,PHP_URL_HOST);
   if(str_starts_with($url,'https://')&&$host==='upload.wikimedia.org')$fotos[$nome]=$url;
  }
 }
 return ['ok'=>true,'fotos'=>$fotos,'aviso'=>$falhas?'Algumas consultas de imagens falharam.':''];
});
respond(['ok'=>true,'fotos'=>$resultado['fotos']??[],'aviso'=>$resultado['aviso']??'']);
