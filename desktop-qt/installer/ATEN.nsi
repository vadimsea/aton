Unicode True

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.1.1"
!endif
!ifndef SOURCE_DIR
  !error "SOURCE_DIR must point to the staged application directory"
!endif
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "ATEN-Setup-${PRODUCT_VERSION}.exe"
!endif
!ifndef LICENSE_FILE
  !error "LICENSE_FILE must point to the user agreement"
!endif
!ifndef APP_ICON
  !error "APP_ICON must point to the application icon"
!endif

!define PRODUCT_NAME "ATEN"
!define PRODUCT_PUBLISHER "Vadzim.by"
!define PRODUCT_WEB_SITE "https://vadzim.by"
!define PRODUCT_EXE "ATEN.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ATEN"

Name "${PRODUCT_NAME}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\ATEN"
InstallDirRegKey HKCU "Software\Vadzim.by\ATEN" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "Vadzim.by"
Icon "${APP_ICON}"
UninstallIcon "${APP_ICON}"

VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "Установщик ATEN"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) Vadzim.by"

!define MUI_ABORTWARNING
!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_LINK "Открыть сайт разработчика"
!define MUI_FINISHPAGE_LINK_LOCATION "${PRODUCT_WEB_SITE}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Russian"

Section "ATEN" SEC_MAIN
  nsExec::ExecToLog 'taskkill /IM "${PRODUCT_EXE}" /F'
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Vadzim.by\ATEN" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\ATEN"
  CreateShortcut "$SMPROGRAMS\ATEN\ATEN.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\aten-logo.ico"
  CreateShortcut "$SMPROGRAMS\ATEN\Удалить ATEN.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\ATEN.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\aten-logo.ico"
SectionEnd

Section "Uninstall"
  nsExec::ExecToLog 'taskkill /IM "${PRODUCT_EXE}" /F'
  Delete "$DESKTOP\ATEN.lnk"
  RMDir /r "$SMPROGRAMS\ATEN"
  DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKCU "Software\Vadzim.by\ATEN"
  RMDir /r "$INSTDIR"
SectionEnd
