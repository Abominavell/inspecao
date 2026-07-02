---
name: imagemgen
description: >-
  Processa imagens para a plataforma: remove fundo, gera PNG transparente e
  otimiza logos para web. Use quando o usuário pedir remover fundo, criar logo
  transparente, processar imagem enviada ou preparar assets para frontend/public.
---

# imagemgen

Pipeline para logos e imagens da plataforma web (não alterar assets do PDF).

## Quando usar

- Remover fundo preto, branco ou xadrez de uma logo
- Gerar `frontend/public/*.png` com transparência real
- Otimizar tamanho para header/login (largura máx. 320–480 px)

## Fluxo padrão (logo IADVH)

1. Coloque a imagem original em `frontend/public/iadvh-logo-source.png` (se o usuário enviou no chat, use o arquivo de referência).
2. Execute o script de remoção de fundo (detecta automaticamente fundo preto ou xadrez):

```powershell
cd backend
.\.venv\Scripts\activate
python ..\.cursor\skills\imagemgen\scripts\remove_background.py `
  ..\frontend\public\iadvh-logo-source.png `
  -o ..\frontend\public\iadvh-logo.png `
  --method auto `
  --max-width 480
```

Métodos disponíveis: `auto` (padrão), `black` (fundo preto), `light` (branco/xadrez), `rembg` (IA).

3. Confirme que `frontend/public/iadvh-logo.png` tem fundo transparente (sem xadrez).
4. O componente `AppLogo` já aponta para `/iadvh-logo.png` — não alterar PDF (`backend/static/report/`).

## Dependências

Instaladas no venv do backend:

```powershell
pip install rembg onnxruntime pillow
```

## Regras

- **Plataforma web**: `frontend/public/iadvh-logo.png`
- **PDF**: manter `backend/static/report/emserh-logo.png` — não substituir
- Preferir a imagem **original enviada pelo usuário** como `iadvh-logo-source.png`
- Após processar, validar visualmente no login e no header
- Se `rembg` falhar, usar `GenerateImage` com `reference_image_paths` pedindo fundo 100% transparente

## Variantes de logo no frontend

| Variante | Uso | max-width sugerido |
|----------|-----|-------------------|
| header | AppShell | 480 |
| login | tela de login | 560 |
| empty | dashboard vazio | 440 |

O redimensionamento é feito no script (`--max-width`) ou via classes em `AppLogo.tsx`.
