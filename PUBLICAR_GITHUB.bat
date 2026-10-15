@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>&1 || (echo ERRO: Git nao instalado. & pause & exit /b 1)
git init
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://github.com/thayro/municipio360.git
git fetch origin main || (echo ERRO: confira acesso GitHub. & pause & exit /b 1)
git add .
git commit -m "Publica codigo Municipio360 v1.9" || echo Sem alteracoes locais para commit.
git pull --rebase origin main || (echo ERRO: conflitos ao sincronizar. & pause & exit /b 1)
git push -u origin main
if errorlevel 1 (echo ERRO: publicacao nao concluida.) else (echo Publicacao concluida. Confira GitHub.)
pause
