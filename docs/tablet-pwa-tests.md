# Roteiro de testes — PWA offline em tablet Android

Validar no Chrome (ou navegador padrão) com **Adicionar à tela inicial** após deploy de produção (`npm run build` + SW ativo).

## Pré-requisitos

- Tablet Android com câmera
- Usuário de teste com permissão de inspeção
- Backend e frontend acessíveis na mesma rede (ou produção)
- App instalado como PWA (ícone na tela inicial)

## 1. Instalação PWA

| Passo | Ação | Esperado |
|-------|------|----------|
| 1.1 | Abrir URL do app no Chrome | Shell carrega normalmente |
| 1.2 | Menu → **Instalar app** / **Adicionar à tela inicial** | Ícone na tela inicial |
| 1.3 | Abrir pelo ícone | `display: standalone`, sem barra do navegador |

## 2. Login e bootstrap

| Passo | Ação | Esperado |
|-------|------|----------|
| 2.1 | Login online | Dashboard carrega; referência (unidades/checklist) em cache |
| 2.2 | Fechar app e abrir offline (modo avião) | Shell abre; sessão em cache permite uso (se token válido) |

## 3. Nova inspeção offline

| Passo | Ação | Esperado |
|-------|------|----------|
| 3.1 | Modo avião ON | Banner “Sem conexão” |
| 3.2 | Nova inspeção → escolher unidade | Rota usa UUID (`/inspecoes/{uuid}/dados`) |
| 3.3 | Preencher dados + foto do endereço | Auto-save local; preview da foto sem API |
| 3.4 | Checklist: marcar C/NC/NA, NC com foto | Dados persistem; banner “pendente” |
| 3.5 | Relatório: capa e textos | Salvos localmente |
| 3.6 | Fechar aba / matar app / reabrir offline | Todos os dados intactos |

## 4. Sincronização

| Passo | Ação | Esperado |
|-------|------|----------|
| 4.1 | Modo avião OFF | Sync automático ou botão **Sincronizar agora** |
| 4.2 | Aguardar sync | Banner some; inspeção aparece no servidor (dashboard web) |
| 4.3 | Dashboard tablet | Badge “pendente” some; `server_id` mapeado |
| 4.4 | Repetir sync (mesmos dados) | Sem duplicatas (idempotência) |

## 5. PDF (somente online pós-sync)

| Passo | Ação | Esperado |
|-------|------|----------|
| 5.1 | Offline na revisão | Botão PDF desabilitado + mensagem clara |
| 5.2 | Online, sync pendente | PDF bloqueado até `sync_status === synced` |
| 5.3 | Online, sync OK, checklist completo | PDF gera e baixa; inspeção finalizada |

## 6. Token expirado em campo

| Passo | Ação | Esperado |
|-------|------|----------|
| 6.1 | Editar offline com token expirado | Edição local continua |
| 6.2 | Voltar online | Refresh token renova sessão OU sync pede login |
| 6.3 | Após login | Sync envia fila pendente |

## 7. Conflito (opcional)

| Passo | Ação | Esperado |
|-------|------|----------|
| 7.1 | Alterar mesma inspeção no servidor (outro usuário/admin) | — |
| 7.2 | Sync no tablet com versão antiga | Modal de conflito; opção **Usar versão do servidor** |

## 8. Regressão rápida

- [ ] Dashboard lista inspeções locais + servidor offline/online
- [ ] Inspeção criada no servidor (ID numérico) abre e edita com sync
- [ ] Inspeção finalizada: somente leitura + PDF online
- [ ] Service Worker: página `~offline` ao navegar sem cache

## Critério de aceite

Todos os itens das seções 3–5 passam em um ciclo completo: **criar offline → checklist + fotos → sync → PDF**.
