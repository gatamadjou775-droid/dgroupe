@echo off
title GestionPresence - Serveur local
cd /d "%~dp0"
echo.
echo Demarrage du serveur GestionPresence...
echo.
node server.js
echo.
echo Le serveur s'est arrete. Appuyez sur une touche pour fermer.
pause >nul
