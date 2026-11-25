; ============================================================================
;   🄯 (c)카피레프트 Copyleft — Tran.IDE
;   a Bakk jaejin production
;   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
; ============================================================================

#ifndef OutputDir
  #define OutputDir "..\dist"
#endif
#ifndef PayloadDir
  #define PayloadDir "..\build\release\payload"
#endif
#ifndef WebView2File
  #define WebView2File "..\build\cache\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
#endif
#ifndef IconFile
  #define IconFile "..\ui\tran_ide_app.ico"
#endif

#define MyAppName "Tran.IDE II"
#define MyAppVersion "0.12"
#define MyAppPublisher "Tran.IDE (a Bakk jaejin production)"
#define MyAppExeName "Tran.IDE II.exe"

[Setup]
AppId={{C3E91B47-6A2F-4D8E-9B11-7A4B6C8D0120}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
LicenseFile=..\LICENSE
DefaultDirName={localappdata}\Tran.IDE II
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=Tran.IDE_II_v0.12_Setup
SetupIconFile={#IconFile}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
CloseApplications=yes
UsedUserAreasWarning=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "installswift"; Description: "Install Swift for Windows toolchain via winget (optional, large download)"; GroupDescription: "Optional Language Runtimes:"; Flags: unchecked

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#WebView2File}"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime..."; Check: not IsWebView2Installed; Flags: waituntilterminated skipifdoesntexist
Filename: "winget"; Parameters: "install --id Swift.Toolchain -e --accept-source-agreements --accept-package-agreements"; StatusMsg: "Installing Swift for Windows toolchain..."; Tasks: installswift; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function IsWebView2Installed: Boolean;
var
  pv: String;
begin
  Result :=
    RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv)
    or RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv)
    or RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv);
  if Result then
    Result := (pv <> '') and (pv <> '0.0.0.0');
end;

; ============================================================================
;   🄯 (c)카피레프트 Copyleft — Tran.IDE
;   a Bakk jaejin production
;   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
; ============================================================================
