<?php
/** Uso: php tools/importar_tse_2024.php /caminho/consulta_cand_2024_UF.csv [UF]
 * Também aceita ZIP com CSV do TSE. Não requer MySQL. Apenas CLI. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
$file=$argv[1]??'';$ufFilter=strtoupper($argv[2]??'');
if(!is_file($file)){fwrite(STDERR,"Uso: php tools/importar_tse_2024.php arquivo.csv|arquivo.zip [UF]\n");exit(1);}
$sourceUrl='https://dadosabertos.tse.jus.br/dataset/candidatos-2024';
$zip=null;$stream=null;
if(strtolower(pathinfo($file,PATHINFO_EXTENSION))==='zip'){
 if(!class_exists('ZipArchive')){fwrite(STDERR,"Extensão zip ausente no PHP CLI.\n");exit(1);}
 $zip=new ZipArchive();if($zip->open($file)!==true){fwrite(STDERR,"Falha ao abrir ZIP\n");exit(1);}
 for($i=0;$i<$zip->numFiles;$i++){$name=$zip->getNameIndex($i);if(preg_match('/consulta_cand_2024.*\\.csv$/i',$name)){$stream=$zip->getStream($name);break;}}
}else $stream=fopen($file,'rb');
if(!is_resource($stream)){fwrite(STDERR,"CSV consulta_cand_2024 não encontrado.\n");exit(1);}
$headers=fgetcsv($stream,0,';','"','\\');if(!$headers){fwrite(STDERR,"CSV vazio\n");exit(1);}
$headers=array_map(fn($x)=>trim((string)$x,"\" \t\r\n\xEF\xBB\xBF"),$headers);$columns=array_flip($headers);
foreach(['SG_UF','NM_UE','DS_CARGO','NM_URNA_CANDIDATO','SG_PARTIDO','DS_SIT_TOT_TURNO'] as $col)if(!isset($columns[$col])){fwrite(STDERR,"Coluna ausente $col. Verifique o layout do TSE.\n");exit(1);}
$normalize=function(string $s):string{$s=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s)?:$s;return trim(preg_replace('/[^a-z0-9]+/','-',strtolower($s)),'-');};
$clean=function(string $s):string{return iconv('ISO-8859-1','UTF-8//IGNORE',$s)?:$s;};
$data=[];$rows=0;
while(($r=fgetcsv($stream,0,';','"','\\'))!==false){$rows++;if(count($r)<count($headers))continue;
 $get=fn($col)=>trim((string)($r[$columns[$col]]??''));$uf=$get('SG_UF');if($ufFilter!==''&&$uf!==$ufFilter)continue;
 $cargo=$clean($get('DS_CARGO'));if(!in_array(strtolower($normalize($cargo)),['prefeito','vereador'],true))continue;
 $situacao=$clean($get('DS_SIT_TOT_TURNO'));if(!preg_match('/^ELEITO(?: POR (?:QP|M[EÉ]DIA))?$/ui',$situacao))continue;
 $city=$clean($get('NM_UE'));$key=$normalize($city);if($key==='')continue;
 $person=['nome'=>$clean($get('NM_URNA_CANDIDATO')),'partido'=>$clean($get('SG_PARTIDO')),'foto'=>'','fonte_url'=>$sourceUrl,'fonte'=>'TSE: eleição municipal 2024 — '.$situacao];
 if(stripos($cargo,'Prefeito')!==false){$data[$uf][$key]['prefeito']=$person;}else{$data[$uf][$key]['vereadores'][]=$person;}
}
fclose($stream);if($zip)$zip->close();$root=dirname(__DIR__).'/data/tse2024';$n=0;
foreach($data as $uf=>$cities){$dir=$root.'/'.strtolower($uf);if(!is_dir($dir)&&!mkdir($dir,0750,true)){fwrite(STDERR,"Falha ao criar $dir\n");exit(1);}
 foreach($cities as $key=>$people){$out=['prefeito'=>$people['prefeito']??null,'vereadores'=>$people['vereadores']??[]];$json=json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);if(file_put_contents($dir.'/'.$key.'.json',$json,LOCK_EX)!==false)$n++;}}
echo "Importadas $n cidades; lidas $rows linhas. Fonte TSE 2024. NÃO comprova exercício atual.\n";
