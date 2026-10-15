# Município360

Plataforma brasileira de inteligência municipal e transparência pública.

## Funcionalidades (v1.9)
- Mapa interativo do Brasil, por estado e município, com dados do IBGE;
- Notícias nacionais e municipais, via GDELT e fallback RSS;
- Licitações e contratos publicados no PNCP;
- Dados eleitorais públicos do TSE, com indicação da diferença entre eleitos em 2024 e ocupantes atuais;
- Consulta fiscal ao SICONFI e links oficiais de prestação de contas;
- Pesquisas públicas relacionadas a municípios, prefeitos e vereadores.

## Requisitos
PHP 8.2, extensão cURL, JavaScript e acesso HTTPS às fontes públicas. Sem MySQL e sem Python.

## Instalação
Publique o conteúdo da aplicação na pasta `municipio360/` do servidor web. Configure um CA bundle acessível ao PHP para as consultas HTTPS e preserve dados temporários fora do controle de versão.

## Fontes e ressalvas
Dados agregados de IBGE, TSE, PNCP, SICONFI, GDELT e RSS podem estar incompletos ou indisponíveis. Os resultados eleitorais de 2024 não comprovam automaticamente os ocupantes atuais dos mandatos. Links para redes sociais são pesquisas públicas e não implicam coleta integral das plataformas.

**Status do repositório:** inicialização de documentação; os arquivos-fonte da versão 1.9 ainda precisam ser enviados a este repositório.
