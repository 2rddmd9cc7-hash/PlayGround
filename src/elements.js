/* ============================================================
   Elementos — dados das 6 essências e suas 4 magias cada.
   kind: proj | volley | nova | chain | dash | wall | prison |
         rain | meteor | quake | tornado | wave | spikes | pierce
   ============================================================ */

export const ELEMENTS = {
  Fogo: {
    icon: '🔥', color: 0xff6a20, cssColor: '#ff7030',
    aura: 'fire', desc: 'A chama que devora. Poder bruto e queimadura.',
    spells: [
      { name: 'Bola de Fogo', icon: '🔥', kind: 'proj', mana: 8, cd: 1.1, dmg: 16, speed: 16, radius: 1.4, aoe: 2.2, desc: 'Uma esfera flamejante que explode no impacto, incendiando inimigos próximos.' },
      { name: 'Chuva de Brasas', icon: '☄️', kind: 'rain', mana: 22, cd: 7, dmg: 10, aoe: 5, desc: 'Brasas caem do céu sobre a área à frente, causando dano repetido.' },
      { name: 'Explosão Infernal', icon: '💥', kind: 'nova', mana: 30, cd: 10, dmg: 26, aoe: 5.5, desc: 'Uma detonação violenta ao redor do mago, empurrando e queimando tudo.' },
      { name: 'Meteoro', icon: '🌠', kind: 'meteor', mana: 45, cd: 18, dmg: 55, aoe: 6.5, desc: 'Uma rocha em chamas desaba do céu e arrasa a área alvo.' },
    ],
  },
  Água: {
    icon: '💧', color: 0x3890ff, cssColor: '#4898ff',
    aura: 'water', desc: 'A corrente que nutre e afoga. Versátil e curativa.',
    spells: [
      { name: 'Projétil Aquático', icon: '💧', kind: 'proj', mana: 7, cd: 0.9, dmg: 13, speed: 17, radius: 1.1, aoe: 1.8, desc: 'Um jato comprimido de água que fere e empurra.' },
      { name: 'Lança Oceânica', icon: '🔱', kind: 'pierce', mana: 16, cd: 4, dmg: 24, speed: 24, radius: 1.2, aoe: 1.4, desc: 'Uma lança de água em alta pressão que atravessa inimigos.' },
      { name: 'Onda Devastadora', icon: '🌊', kind: 'wave', mana: 26, cd: 9, dmg: 22, aoe: 6, desc: 'Uma parede de água avança, derrubando inimigos no caminho.' },
      { name: 'Prisão de Água', icon: '🫧', kind: 'prison', mana: 30, cd: 12, dmg: 8, aoe: 4, desc: 'Aprisiona inimigos em bolhas e restaura parte da sua vida.' },
    ],
  },
  Raio: {
    icon: '⚡', color: 0xa8c8ff, cssColor: '#b0d0ff',
    aura: 'zap', desc: 'A tempestade em carne viva. Velocidade e paralisia.',
    spells: [
      { name: 'Raio', icon: '⚡', kind: 'proj', mana: 7, cd: 0.7, dmg: 12, speed: 30, radius: 0.8, aoe: 1.2, desc: 'Um dardo elétrico instantâneo e preciso.' },
      { name: 'Cadeia Elétrica', icon: '🔗', kind: 'chain', mana: 20, cd: 6, dmg: 15, desc: 'Relâmpagos saltam entre até 4 inimigos próximos.' },
      { name: 'Dash Elétrico', icon: '🌀', kind: 'dash', mana: 18, cd: 5, dmg: 18, desc: 'Vira um relâmpago e atravessa inimigos, eletrocutando-os.' },
      { name: 'Tempestade Celeste', icon: '🌩️', kind: 'storm', mana: 42, cd: 16, dmg: 20, aoe: 7, desc: 'Raios fustigam a área à frente várias vezes.' },
    ],
  },
  Terra: {
    icon: '🪨', color: 0xb08a50, cssColor: '#c09050',
    aura: 'earth', desc: 'A montanha imóvel. Defesa e força devastadora.',
    spells: [
      { name: 'Pedra Explosiva', icon: '🪨', kind: 'proj', mana: 9, cd: 1.4, dmg: 19, speed: 12, radius: 1.2, aoe: 2.6, desc: 'Um bloco de rocha que estilhaça em estilhaços cortantes.' },
      { name: 'Espinhos de Terra', icon: '🌵', kind: 'spikes', mana: 20, cd: 6, dmg: 16, desc: 'Pontas rochosas brotam do solo em linha reta.' },
      { name: 'Muralha', icon: '🧱', kind: 'wall', mana: 24, cd: 12, dmg: 0, desc: 'Ergue uma muralha de pedra que bloqueia inimigos.' },
      { name: 'Terremoto', icon: '🌋', kind: 'quake', mana: 42, cd: 17, dmg: 40, aoe: 9, desc: 'O chão inteiro treme e racha ao seu redor.' },
    ],
  },
  Vento: {
    icon: '🌪️', color: 0xb8e0e8, cssColor: '#a8e0f0',
    aura: 'wind', desc: 'A brisa livre. Mobilidade e cortes invisíveis.',
    spells: [
      { name: 'Lâmina de Vento', icon: '🍃', kind: 'proj', mana: 6, cd: 0.8, dmg: 12, speed: 22, radius: 0.9, aoe: 1.4, desc: 'Uma lâmina de ar comprimido que corta à distância.' },
      { name: 'Turbilhão', icon: '🌀', kind: 'tornado', mana: 20, cd: 7, dmg: 12, aoe: 3, desc: 'Um redemoinho que suga e corteja inimigos à frente.' },
      { name: 'Dash de Vento', icon: '💨', kind: 'dash', mana: 14, cd: 4, dmg: 10, desc: 'Dispara para frente numa rajada, atravessando inimigos.' },
      { name: 'Furacão', icon: '🌪️', kind: 'hurricane', mana: 40, cd: 15, dmg: 34, aoe: 8, desc: 'Um furacão colossal gira ao seu redor, arrasando tudo.' },
    ],
  },
  Gelo: {
    icon: '❄️', color: 0x90d0ff, cssColor: '#90d0ff',
    aura: 'frost', desc: 'O inverno eterno. Controle e congelamento.',
    spells: [
      { name: 'Estilhaço de Gelo', icon: '❄️', kind: 'proj', mana: 7, cd: 1, dmg: 13, speed: 18, radius: 1, aoe: 1.6, desc: 'Cristais perfurantes que retardam o alvo.' },
      { name: 'Lança Glacial', icon: '🧊', kind: 'pierce', mana: 15, cd: 4.5, dmg: 22, speed: 20, radius: 1.1, aoe: 1.3, desc: 'Uma lança de gelo que atravessa e congela.' },
      { name: 'Parede de Gelo', icon: '🧱', kind: 'wall', mana: 22, cd: 11, dmg: 0, desc: 'Ergue uma barreira de gelo para bloquear o avanço.' },
      { name: 'Prisão Glacial', icon: '🥶', kind: 'freeze', mana: 32, cd: 13, dmg: 14, aoe: 5, desc: 'Congela todos os inimigos próximos por alguns segundos.' },
    ],
  },
}

export const ELEMENT_LIST = Object.keys(ELEMENTS)

export function spellAt(elem, i) {
  const e = ELEMENTS[elem]
  return e ? e.spells[i] : null
}
