// frontend/src/ui/MainMenu.js
import { CONFIG } from '../config.js';

export class MainMenu {
  constructor(engine) {
    this.engine = engine;

    // Elementos DOM
    this.overlay = document.getElementById('main-menu-overlay');
    this.mainView = document.getElementById('menu-main-view');
    this.lbView = document.getElementById('menu-leaderboard-view');
    this.settingsView = document.getElementById('menu-settings-view');
    this.lbBody = document.getElementById('leaderboard-body');

    this.instructionsView = document.getElementById('menu-instructions-view');
    this.creditsView = document.getElementById('menu-credits-view');

    // Botones de acción
    this.btnPlay = document.getElementById('btn-play');
    this.btnLeaderboard = document.getElementById('btn-leaderboard');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnBackLb = document.getElementById('btn-back-lb');
    this.btnBackSettings = document.getElementById('btn-back-settings');

    this.btnInstructions = document.getElementById('btn-instructions');
    this.btnCredits = document.getElementById('btn-credits');
    this.btnBackInstructions = document.getElementById('btn-back-instructions');
    this.btnBackCredits = document.getElementById('btn-back-credits');

    // Controles de configuración
    this.chkAudio = document.getElementById('setting-audio');
    this.chkShake = document.getElementById('setting-screenshake');
    this.rngVolume = document.getElementById('setting-master-volume');

    this._bindEvents();
    this._loadInitialSettings();
  }

  _bindEvents() {
    // Iniciar el juego
    this.btnPlay.addEventListener('click', () => {
      this.hide();
      this.engine.start();
    });

    // Abrir tabla de clasificación
    this.btnLeaderboard.addEventListener('click', () => {
      this._switchView(this.lbView);
      this._fetchLeaderboard();
    });

    // Abrir ajustes
    this.btnSettings.addEventListener('click', () => {
      this._switchView(this.settingsView);
    });

    // Botones para volver al menú principal
    this.btnBackLb.addEventListener('click', () => this._switchView(this.mainView));
    this.btnBackSettings.addEventListener('click', () => this._switchView(this.mainView));

    // Instrucciones y Créditos
    this.btnInstructions.addEventListener('click', () => this._switchView(this.instructionsView));
    this.btnCredits.addEventListener('click', () => this._switchView(this.creditsView));
    this.btnBackInstructions.addEventListener('click', () => this._switchView(this.mainView));
    this.btnBackCredits.addEventListener('click', () => this._switchView(this.mainView));

    // Cambios de ajustes

    // Cambios de ajustes
    this.chkAudio.addEventListener('change', (e) => {
      CONFIG.ASSETS.USE_AUDIO = e.target.checked;
      localStorage.setItem('cfg_audio', e.target.checked);
    });

    this.chkShake.addEventListener('change', (e) => {
      this.engine.screenShakeEnabled = e.target.checked;
      localStorage.setItem('cfg_shake', e.target.checked);
    });

    this.rngVolume.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.engine.masterVolume = vol;
      localStorage.setItem('cfg_volume', vol);
    });
  }

  _switchView(viewToShow) {
    this.mainView.classList.remove('active');
    this.lbView.classList.remove('active');
    this.settingsView.classList.remove('active');
    this.instructionsView.classList.remove('active');
    this.creditsView.classList.remove('active');
    viewToShow.classList.add('active');
  }

  _loadInitialSettings() {
    const savedAudio = localStorage.getItem('cfg_audio') === 'true';
    const savedShake = localStorage.getItem('cfg_shake') !== 'false';
    const savedVol = parseFloat(localStorage.getItem('cfg_volume') || '0.7');

    this.chkAudio.checked = savedAudio;
    this.chkShake.checked = savedShake;
    this.rngVolume.value = savedVol;

    CONFIG.ASSETS.USE_AUDIO = savedAudio;
    this.engine.screenShakeEnabled = savedShake;
    this.engine.masterVolume = savedVol;
  }

  async _fetchLeaderboard() {
    this.lbBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Conectando a la base de datos...</td></tr>';
    try {
      const res = await fetch('http://localhost:4000/api/scores');
      if (!res.ok) throw new Error('Error al consultar ranking');
      const responseData = await res.json();

      // Ge eba karabo e tla ka gare ga { data: [...] } goba { scores: [...] }
      const list = Array.isArray(responseData) 
        ? responseData 
        : (responseData.scores || responseData.data || []);

      // Hlahloba mo console ya browser (F12) go bona maina a maleba a dikholomo
      console.log('[Leaderboard API Data]:', list);

      if (!list || list.length === 0) {
        this.lbBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aún no hay puntuaciones registradas.</td></tr>';
        return;
      }

      this.lbBody.innerHTML = list.slice(0, 10).map((row, idx) => {
        // E leka maina ka moka a tlwaelegilego a dikholomo tša PostgreSQL
        const pilotName = row.name 
          || row.player 
          || 'Piloto Anónimo';

        const scoreVal = Number(row.score || row.points || 0);
        const waveVal = row.wave_reached || row.wave || row.oleada || 1;

        return `
          <tr>
            <td style="color: #ffd700; text-align:center;">${idx + 1}</td>
            <td>${pilotName}</td>
            <td style="color: #00f0ff; font-weight: bold;">${scoreVal.toLocaleString()}</td>
            <td style="text-align:center;">${waveVal}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('[Leaderboard Error]:', err);
      this.lbBody.innerHTML = '<tr><td colspan="4" style="color:#ff0055; text-align:center;">No se pudo conectar al API (puerto 4000).</td></tr>';
    }
  }

  show() {
    this.overlay.classList.add('active');
    this._switchView(this.mainView);
  }

  hide() {
    this.overlay.classList.remove('active');
  }
}