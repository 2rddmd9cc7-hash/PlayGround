// Sistema Elemental — dados de todos os elementos e magias (arquitetura expansível)
// Cada elemento: ataque básico, habilidade rápida, habilidade forte, ultimate
export const ELEMENTS = {
  fogo: {
    name: 'FOGO', icon: '🔥', color: 0xff5515, colorCss: '#ff5515',
    desc: 'A fúria da chama consome tudo em seu caminho.',
    spells: [
      { id: 'fogo_1', name: 'Bola de Fogo', icon: '☄️', mana: 8, cd: 1.2, dmg: 18, type: 'projectile', speed: 22, radius: 1.6, unlock: 1, desc: 'Dispara uma esfera flamejante que explode ao atingir o alvo.' },
      { id: 'fogo_2', name: 'Chuva de Brasas', icon: '🧨', mana: 18, cd: 7, dmg: 10, type: 'rain', radius: 5, unlock: 3, desc: 'Brasas caem do céu em uma área, queimando tudo.' },
      { id: 'fogo_3', name: 'Explosão Infernal', icon: '💥', mana: 28, cd: 11, dmg: 40, type: 'nova', radius: 6, unlock: 5, desc: 'Uma onda de fogo irrompe ao redor de você.' },
      { id: 'fogo_4', name: 'Meteoro', icon: '🌟', mana: 45, cd: 25, dmg: 90, type: 'meteor', radius: 8, unlock: 8, desc: 'Invoca um meteoro dos céus. Devastação absoluta.' },
    ],
  },
  agua: {
    name: 'ÁGUA', icon: '💧', color: 0x3d8bff, colorCss: '#3d8bff',
    desc: 'A corrente implacável que cura e afoga.',
    spells: [
      { id: 'agua_1', name: 'Projétil Aquático', icon: '🌊', mana: 7, cd: 1.0, dmg: 15, type: 'projectile', speed: 24, radius: 1.4, unlock: 1, desc: 'Um jato comprimido de água em alta pressão.' },
      { id: 'agua_2', name: 'Lança Oceânica', icon: '🔱', mana: 16, cd: 5, dmg: 26, type: 'projectile', speed: 34, radius: 2, unlock: 3, desc: 'Uma lança perfurante de água oceânica.' },
      { id: 'agua_3', name: 'Onda Devastadora', icon: '🌀', mana: 26, cd: 10, dmg: 34, type: 'nova', radius: 6.5, unlock: 5, desc: 'Uma onda de choque que empurra e afoga inimigos.' },
      { id: 'agua_4', name: 'Prisão de Água', icon: '🫧', mana: 40, cd: 22, dmg: 30, type: 'prison', radius: 4, unlock: 8, desc: 'Aprisiona inimigos em esferas de água e os cura com o tempo.' },
    ],
  },
  raio: {
    name: 'RAIO', icon: '⚡', color: 0xffe633, colorCss: '#ffe633',
    desc: 'A velocidade do trovão: morte instantânea.',
    spells: [
      { id: 'raio_1', name: 'Raio', icon: '⚡', mana: 6, cd: 0.8, dmg: 14, type: 'beam', range: 18, unlock: 1, desc: 'Um feixe elétrico instantâneo na direção da mira.' },
      { id: 'raio_2', name: 'Cadeia Elétrica', icon: '🔗', mana: 15, cd: 5, dmg: 18, type: 'chain', range: 14, jumps: 3, unlock: 3, desc: 'O relâmpago salta entre até 3 inimigos.' },
      { id: 'raio_3', name: 'Dash Elétrico', icon: '💨', mana: 18, cd: 6, dmg: 20, type: 'dash', unlock: 5, desc: 'Teleporte elétrico, eletrocutando quem cruzar seu caminho.' },
      { id: 'raio_4', name: 'Tempestade Celeste', icon: '🌩️', mana: 42, cd: 24, dmg: 22, type: 'storm', radius: 12, strikes: 10, unlock: 8, desc: 'Invoca uma tempestade de relâmpagos sobre a área.' },
    ],
  },
  terra: {
    name: 'TERRA', icon: '🪨', color: 0xb37433, colorCss: '#b37433',
    desc: 'A montanha em movimento: força indomável.',
    spells: [
      { id: 'terra_1', name: 'Pedra Explosiva', icon: '🪨', mana: 9, cd: 1.4, dmg: 20, type: 'projectile', speed: 18, radius: 2, unlock: 1, desc: 'Um fragimento de rocha que estilhaza no impacto.' },
      { id: 'terra_2', name: 'Espinhos de Terra', icon: '🗡️', mana: 17, cd: 6, dmg: 16, type: 'spikes', radius: 6, unlock: 3, desc: 'Lanças de pedra emergem do solo em linha.' },
      { id: 'terra_3', name: 'Terremoto', icon: '🌋', mana: 30, cd: 12, dmg: 38, type: 'quake', radius: 9, unlock: 5, desc: 'Sacode o chão, atordoando e esmagando inimigos próximos.' },
      { id: 'terra_4', name: 'Colosso de Pedra', icon: '🗿', mana: 50, cd: 30, dmg: 120, type: 'quake', radius: 12, big: true, unlock: 8, desc: 'Um colosso de pedra erupciona e esmaga tudo ao redor.' },
    ],
  },
  vento: {
    name: 'VENTO', icon: '🌪️', color: 0xb3ffbf, colorCss: '#b3ffbf',
    desc: 'A liberdade do céu: veloz como o pensamento.',
    spells: [
      { id: 'vento_1', name: 'Lâmina de Vento', icon: '🍃', mana: 6, cd: 0.9, dmg: 13, type: 'projectile', speed: 30, radius: 1.2, unlock: 1, desc: 'Uma lâmina de ar comprimido corta o ar.' },
      { id: 'vento_2', name: 'Turbilhão', icon: '🌀', mana: 14, cd: 5, dmg: 15, type: 'nova', radius: 5, unlock: 3, desc: 'Um ciclone ao seu redor empurra e corta inimigos.' },
      { id: 'vento_3', name: 'Passo do Vento', icon: '💨', mana: 12, cd: 4, dmg: 0, type: 'windDash', unlock: 5, desc: 'Impulso de vento: deslocamento rápido sem custo de stamina.' },
      { id: 'vento_4', name: 'Furacão', icon: '🌪️', mana: 44, cd: 26, dmg: 60, type: 'tornado', radius: 5, unlock: 8, desc: 'Um tornado caminhante devora o campo de batalha.' },
    ],
  },
  gelo: {
    name: 'GELO', icon: '❄️', color: 0x8cd9ff, colorCss: '#8cd9ff',
    desc: 'O silêncio do inverno: controle e congelamento.',
    spells: [
      { id: 'gelo_1', name: 'Estilhaço de Gelo', icon: '❄️', mana: 7, cd: 1.0, dmg: 14, type: 'projectile', speed: 26, radius: 1.4, unlock: 1, desc: 'Fragmentos gélidos perfurantes.' },
      { id: 'gelo_2', name: 'Lança Glacial', icon: '🧊', mana: 15, cd: 4.5, dmg: 24, type: 'projectile', speed: 32, radius: 1.8, freeze: 1.2, unlock: 3, desc: 'Congela o alvo atingido por um instante.' },
      { id: 'gelo_3', name: 'Névoa Congelante', icon: '🌫️', mana: 24, cd: 9, dmg: 22, type: 'nova', radius: 6, freeze: 2, unlock: 5, desc: 'Ondas de frio congelam inimigos próximos.' },
      { id: 'gelo_4', name: 'Prisão Glacial', icon: '🏔️', mana: 40, cd: 20, dmg: 35, type: 'prison', radius: 5, freeze: 3.5, unlock: 8, desc: 'Esferas de gelo aprisionam inimigos em um bloqueio glacial.' },
    ],
  },
};

export function elementOf(id) { return id.split('_')[0]; }

export function getSpellDef(elementId, slot) {
  const el = ELEMENTS[elementId];
  if (!el) return null;
  return el.spells[slot - 1] || null;
}

export function allSpellDefs(elementId) {
  return ELEMENTS[elementId]?.spells ?? [];
}
