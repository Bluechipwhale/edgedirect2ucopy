Unicode true
!include "MUI2.nsh"
Name "E-Edge Direct 2U Store"
OutFile "..\..\artifacts\native\Edgedirect2u-Store-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Edgedirect2uStore"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Edgedirect2u.Store.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Section "Store"
  SetOutPath "$INSTDIR"
  !include "install-files.nsh"
  SetOutPath "$INSTDIR"
  File "MicrosoftEdgeWebview2Setup.exe"
  ExecWait '"$INSTDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'
  Delete "$INSTDIR\MicrosoftEdgeWebview2Setup.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Edgedirect2u"
  CreateShortcut "$SMPROGRAMS\Edgedirect2u\Store.lnk" "$INSTDIR\Edgedirect2u.Store.exe"
  CreateShortcut "$DESKTOP\Edgedirect2u Store.lnk" "$INSTDIR\Edgedirect2u.Store.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Edgedirect2uStore" "DisplayName" "E-Edge Direct 2U Store"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Edgedirect2uStore" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Edgedirect2uStore" "DisplayVersion" "1.0.5"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Edgedirect2uStore" "Publisher" "Edgedirect2u"
SectionEnd
Section "Uninstall"
  Delete "$DESKTOP\Edgedirect2u Store.lnk"
  Delete "$SMPROGRAMS\Edgedirect2u\Store.lnk"
  RMDir "$SMPROGRAMS\Edgedirect2u"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Edgedirect2uStore"
  !include "uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
