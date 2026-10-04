@echo off
setlocal

set "GRADLE_VERSION=8.10.2"
set "GRADLE_USER_HOME=%USERPROFILE%\.gradle"
set "DIST_DIR=%GRADLE_USER_HOME%\wrapper\dists\gradle-%GRADLE_VERSION%-bin"
set "GRADLE_DIR=%DIST_DIR%\gradle-%GRADLE_VERSION%"
set "GRADLE_ZIP=%DIST_DIR%\gradle-%GRADLE_VERSION%-bin.zip"

if exist "%GRADLE_DIR%\bin\gradle.bat" goto run_gradle

echo Gradle %GRADLE_VERSION% is not installed locally. Downloading it...
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%GRADLE_ZIP%'"
if errorlevel 1 (
  echo Failed to download Gradle.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%GRADLE_ZIP%' -DestinationPath '%DIST_DIR%' -Force"
if errorlevel 1 (
  echo Failed to extract Gradle.
  exit /b 1
)

:run_gradle
call "%GRADLE_DIR%\bin\gradle.bat" %*
exit /b %ERRORLEVEL%
