# Pinterest Board Downloader — Extensão para Chrome

Baixa todas as imagens de uma pasta do Pinterest e salva como `.zip`.

## 📦 Como instalar

1. Abra o Chrome e vá em: `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `pinterest-downloader`
5. A extensão aparecerá na barra de ferramentas! 📌

## 🚀 Como usar

1. Acesse uma pasta do Pinterest, ex:  
   `https://br.pinterest.com/miko037/server-ej/`
2. **Role a página** para baixo para carregar mais pins (ou use o botão de rolagem automática)
3. Clique no ícone da extensão na barra do Chrome
4. Clique em **"Rolar página para carregar mais"** para carregar todos os pins
5. Clique em **"Baixar Pasta como ZIP"**
6. O arquivo `.zip` será baixado automaticamente!

## ⚠️ Observações

- Role bastante a página antes de baixar para garantir que todos os pins foram carregados
- Imagens em alta resolução são baixadas automaticamente
- Alguns pins podem falhar por restrições de CORS — isso é normal
- Use apenas para fins pessoais e respeitando os termos do Pinterest

## 🛠️ Tecnologias

- Chrome Extension Manifest V3
- JSZip (via CDN)
- Pinterest DOM scraping
