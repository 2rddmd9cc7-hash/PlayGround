// Configurações do jogo (persistidas)
const KEY = 'aetheria_settings_v1';

export const DEFAULT_SETTINGS = {
  // Câmera
  camSensitivity: 1.0,
  camDistance: 7.5,
  camMinDist: 3.0,
  camMaxDist: 14.0,
  camInvertY: false,
  camHeight: 1.7,
  // Gráficos
  shadows: true,
  particles: 1.0,       // multiplicador de partículas
  renderScale: 1.0,
  fogDensity: 1.0,
  // Áudio
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.9,
  // Jogabilidade
  showDamage: true,
  autosave: true,
};

export const settings = { ...DEFAULT_SETTINGS };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* ignorar — usa padrões */ }
  // saneia
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (settings[k] === undefined || settings[k] === null || (typeof DEFAULT_SETTINGS[k] === 'number' && Number.isNaN(settings[k]))) {
      settings[k] = DEFAULT_SETTINGS[k];
    }
  }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage indisponível */ }
}

export function resetSettings() { Object.assign(settings, DEFAULT_SETTINGS); saveSettings(); }
