# Roteiro de testes — SSMA Campo (Android offline) v4.0

App de campo **100% offline**: todos os dados (inspeções, fotos, PDF, unidades, usuários) ficam **somente no tablet**. Sem internet, sem sync com servidor.

**App:** [`android-app/`](../android-app/) — Jetpack Compose + Room, **sem WebView**.

## Arquitetura (v4.0.0)

- **App:** SSMA Campo (`org.iadvh.ssma.campo`)
- **UI:** Compose + `CampoAppShell` (nav global, toasts, auto-save)
- **Câmera:** CameraX **in-app** (`CameraCaptureScreen`) — sem intent externo de câmera/OEM
- **Task:** `MainActivity` `singleTask` + reset de navegação em `onNewIntent`
- **Dados:** Room v3 (`app_meta`, `sync_queue`) + arquivos em `filesDir/inspecao/`
- **Backup:** export + **restaurar** (admin) via `RestoreBackupScreen`
- **PDF:** relatório com fotos do local e NCs embutidas
- **Auth:** lockout 5 tentativas / 30s; troca obrigatória de senha admin no 1º login
- **Sync:** interface `SyncGateway` + `NoOpSyncGateway` (offline; fila preparada)

## Build e instalação

```powershell
cd android-app
.\gradlew.bat assembleDebug
```

APK: `android-app\app\build\outputs\apk\debug\app-debug.apk` (`versionCode` 20, `versionName` 4.0.0)

Credenciais admin inicial: `admin` / `Inspecao@2026!` (troca obrigatória no 1º login)

## Pré-requisitos

- Tablet Android com câmera
- **Modo avião ligado** (recomendado)
- APK v4.0.0
- Desinstalar versão Capacitor/WebView antiga se coexistir (`org.iadvh.ssma.campo`)

## Checklist visual

| Tela | Critério |
|------|----------|
| Login | Card gradiente; lockout após 5 erros; troca senha admin |
| Shell | Nav global; wizard com Voltar sempre visível |
| Dashboard | KPIs, exportar backup, **restaurar backup** (admin) |
| Câmera in-app | Preview + Capturar/Cancelar **dentro** do app |
| Wizard | Dados → checklist (arquivo separado) → revisão |
| PDF | Fotos embed no relatório |

## 0. Autenticação

| Passo | Ação | Esperado |
|-------|------|----------|
| 0.1 | Cold start | Tela de login |
| 0.2 | 5 senhas erradas | Bloqueio ~30s |
| 0.3 | Login admin (1º uso) | Prompt troca de senha |
| 0.4 | Modo avião ON | App funciona |
| 0.5 | Matar processo e reabrir | Login obrigatório |

## 1. Navegação e loop OEM (regressão)

| Passo | Ação | Esperado |
|-------|------|----------|
| 1.1 | Tirar foto no wizard | Abre câmera **in-app**, não app OEM |
| 1.2 | Cancelar câmera | Volta ao wizard |
| 1.3 | Home → reabrir ícone do app | Dashboard/login, **não** tela sistema (ex. Transferências) |
| 1.4 | Voltar no wizard | `popBackStack` ou dashboard |

## 2. Dashboard e backup

| Passo | Ação | Esperado |
|-------|------|----------|
| 2.1 | Exportar backup | ZIP via share |
| 2.2 | Admin: Restaurar backup | Preview + importação |
| 2.3 | Clonar / arquivar | Ações locais |

## 3. Wizard e PDF

| Passo | Ação | Esperado |
|-------|------|----------|
| 3.1 | Foto do local + NC | Compressão JPEG; thumbnails |
| 3.2 | Gerar PDF | PDF com imagens; share intent |
| 3.3 | Reiniciar tablet | Dados intactos |

## Testes automatizados

```powershell
cd android-app
.\gradlew.bat test
.\gradlew.bat connectedDebugAndroidTest   # migração Room 2→3 (dispositivo/emulador)
```

- `BackupValidatorTest` — parsing manifest/payload
- `RoomMigrationTest` — migração 2→3 com `sync_queue` e `app_meta`

## Critério de aceite

Ciclo completo em **modo avião**: login → inspeção → fotos in-app → PDF com imagens → export → restore — **sem rede** e **sem sair do app** para câmera OEM.
