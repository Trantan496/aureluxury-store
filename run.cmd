@echo off
setlocal
set "source=%~1"
if not defined source set "source=hello.cpp"
if not exist "%source%" (
    echo Khong tim thay file: "%source%"
    exit /b 1
)
set "output=%~dpn1.exe"
if "%~1"=="" set "output=%cd%\hello.exe"
set "PATH=C:\Program Files\CodeBlocks\MinGW\bin;%PATH%"
"C:\Program Files\CodeBlocks\MinGW\bin\g++.exe" -std=c++17 "%source%" -o "%output%"
if errorlevel 1 exit /b 1
"%output%"
