@echo off
setlocal
set "zipName=AgroSalto_Backup_%date:~-4%%date:~3,2%%date:~0,2%.zip"
echo 📦 Creando copia de seguridad: %zipName%...
echo (Excluyendo carpetas pesadas como node_modules para que sea liviano)

powershell -Command "$files = Get-ChildItem -Path . | Where-Object { $_.Name -notmatch 'node_modules|\.git|%zipName%' }; Compress-Archive -Path $files.FullName -DestinationPath '%zipName%' -Force"

if %errorlevel% equ 0 (
    echo.
    echo ✅ ¡Hecho! Se ha creado el archivo: %zipName%
    echo 📂 Puedes enviar ese archivo ZIP.
) else (
    echo.
    echo ❌ Hubo un error al crear el ZIP. Asegurate de no tener archivos abiertos en otro programa.
)
pause
