# PlayGround

## ⚔️ Crônicas de Aetheria

RPG 3D medieval de fantasia, jogável no navegador com Three.js (módulo local em `vendor/`).

### Baixar
- **⚡ Jeito mais fácil (1 arquivo)**: [`release/Aetheria.html`](release/Aetheria.html) — baixe e **dê duplo clique**. O jogo inteiro está dentro do arquivo; não precisa instalar nada nem rodar servidor (funciona offline).
- **ZIP completo**: [`release/Cronicas-de-Aetheria.zip`](release/Cronicas-de-Aetheria.zip) (extraia e siga o `COMO-JOGAR.txt`) — inclui também o `Aetheria.html`.
- **Jogar sem baixar**: ative o GitHub Pages em *Settings → Pages → Source: GitHub Actions*; o site é publicado em `https://2rddmd9cc7-hash.github.io/PlayGround/`.
- Repositório: https://github.com/2rddmd9cc7-hash/PlayGround

> Para regerar o arquivo único depois de mudanças: `node scripts/build-single.mjs`

### Como jogar
Abra `index.html` por um servidor estático (ex.: `npx serve .`) e clique em **Novo Jogo**.

### Controles
| Tecla | Ação |
|---|---|
| WASD | Mover |
| Botão esquerdo / Segurar | Ataque leve (combo) / ataque pesado |
| Botão direito | Girar câmera |
| Espaço | Esquiva |
| E | Interagir (NPC, baú, porta, missão) |
| G | Grimório (magias) |
| 1–4 | Lançar magias |
| I | Inventário / equipamentos |
| M | Mapa |
| C | Bloquear (guerreiro com escudo) |
| Esc | Pausa |

### Sistemas
- **Classes**: Guerreiro (espada+escudo), Mago (cajado), Arqueiro (arco) — escolha no início, arma guardada até sacar.
- **Combate**: máquina de estados (idle/movimento/ataque/recuperação/dano/morte) com watchdog; combos, ataque pesado, esquiva e bloqueio.
- **Magias**: 6 elementos com projéteis, áreas, partículas, iluminação e impacto.
- **Mundo**: vila, cidade de Aurelia (muralhas, castelo, mercado, taverna, ferreiro), floresta, lago, montanhas, vulcão, pântano, ruínas e masmorra.
- **NPCs**: rotinas dia/noite, patrulhas com rotas, 5 comerciantes funcionais (armas, poções, arcos, geral), horário de funcionamento.
- **Missões**: campanha principal em 6 capítulos + cadeias secundárias (invasão → ferreiro → estrada perigosa).
- **Vida ambiente**: ciclo dia/noite, clima, tochas, fogueiras, pássaros/grilos/vento, galinhas e cervos.
- **Salvamento**: automático/manual (`localStorage`) incluindo classe, equipamento, quests e posição.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/2rddmd9cc7-hash/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/2rddmd9cc7-hash/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/2rddmd9cc7-hash/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/2rddmd9cc7-hash/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/2rddmd9cc7-hash/PlayGround).
- 🛠️ [Check build runs](https://github.com/2rddmd9cc7-hash/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/2rddmd9cc7-hash/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/2rddmd9cc7-hash).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->
