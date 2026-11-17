/* =========================================================
 * Aetheria — Ciclo dia/noite, sol/lua/estrelas, clima
 * ========================================================= */
import * as THREE from '../../vendor/three.module.js';
import { clamp, lerp, rand, chance, damp } from '../core/utils.js';
import { dist } from '../core/utils.js';

const DAY_LENGTH = 480; // segundos para um dia completo

export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.time = 8.0;               // horas (0-24)
    this.isNight = false;
    this.paused = false;

    /* luzes */
    this.sun = new THREE.DirectionalLight(0xffeecc, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 260;
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8090c0, 0);
    scene.add(this.moon);
    scene.add(this.moon.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a30, 0.7);
    scene.add(this.hemi);

    /* sol e lua visíveis */
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffdd88, fog: false }));
    this.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 12), new THREE.MeshBasicMaterial({ color: 0xdde4ff, fog: false }));
    scene.add(this.sunDisc, this.moonDisc);

    /* estrelas */
    const starGeo = new THREE.BufferGeometry();
    const n = 700, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = rand(0, Math.PI * 2), ph = rand(0.05, Math.PI * 0.45);
      const r = 640;
      sp[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      sp[i * 3 + 1] = Math.cos(ph) * r;
      sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(this.stars);

    /* nuvens */
    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(rand(12, 24), 7, 6), cloudMat.clone());
        p.scale.y = 0.4;
        p.position.set(rand(-24, 24), rand(-3, 3), rand(-14, 14));
        g.add(p);
      }
      g.position.set(rand(-600, 600), rand(80, 130), rand(-600, 600));
      g.userData.speed = rand(1.5, 4);
      scene.add(g);
      this.clouds.push(g);
    }

    /* clima */
    this.weather = 'clear';
    this.weatherT = rand(40, 90);
    this.rain = null;
    this.fogTarget = 0.0016;
    this.thunderT = 0;

    /* névoa */
    scene.fog = new THREE.FogExp2(0xa8c8e8, 0.0016);

    this._tmp = new THREE.Color();
  }

  setShadowQuality(q) {
    if (q === 0) { this.sun.castShadow = false; return; }
    this.sun.castShadow = true;
    const s = q === 2 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== s) {
      this.sun.shadow.mapSize.set(s, s);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  update(dt, game) {
    if (!this.paused) this.time = (this.time + dt * 24 / DAY_LENGTH) % 24;
    const t = this.time;
    const ang = (t - 6) / 24 * Math.PI * 2; // 6h = nascer no leste
    const px = game.player ? game.player.root.position.x : 0;
    const pz = game.player ? game.player.root.position.z : 0;
    const py = game.player ? game.player.root.position.y : 0;

    /* posições dos astros */
    const sx = Math.cos(ang) * 400, sy = Math.sin(ang) * 400;
    this.sun.position.set(px + sx, py + sy, pz + 120);
    this.sun.target.position.set(px, py, pz);
    this.sunDisc.position.set(px + sx * 1.5, py + sy * 1.5, pz + 180);
    this.moon.position.set(px - sx, py - sy, pz - 120);
    this.moon.target.position.set(px, py, pz);
    this.moonDisc.position.set(px - sx * 1.5, py - sy * 1.5, pz - 180);
    this.stars.position.set(px, py, pz);

    /* intensidades */
    const dayF = clamp(sy / 120, 0, 1);           // fator de luz do dia
    const nightF = 1 - dayF;
    const dusk = clamp(1 - Math.abs(sy) / 120, 0, 1); // crepúsculo
    this.sun.intensity = dayF * 2.4 * this._weatherLightMul();
    this.moon.intensity = nightF * 0.35;
    this.hemi.intensity = 0.25 + dayF * 0.55;
    // cores
    this._tmp.setHex(0xffeecc);
    if (dusk > 0.6) this._tmp.lerp(new THREE.Color(0xff8844), (dusk - 0.6) * 2);
    this.sun.color.copy(this._tmp);

    /* visibilidade dos discos/estrelas */
    this.sunDisc.visible = sy > -30;
    this.moonDisc.visible = sy < 30;
    this.stars.material.opacity = clamp(nightF * 1.4 - 0.2, 0, 1);

    /* céu e névoa */
    const sky = new THREE.Color().setHex(0x87b5e8).lerp(new THREE.Color(0x0a1028), clamp(nightF * 1.5, 0, 1));
    if (dusk > 0.75) sky.lerp(new THREE.Color(0xe88050), (dusk - 0.75) * 2.5);
    if (this.weather === 'storm' || this.weather === 'rain') sky.lerp(new THREE.Color(0x5a6a78), 0.55);
    if (this.weather === 'fog') sky.lerp(new THREE.Color(0x9aa8a8), 0.5);
    this.scene.background = sky;
    this.fogTarget = this.weather === 'fog' ? 0.0075 : this.weather === 'storm' ? 0.0035 : this.weather === 'rain' ? 0.003 : 0.0016;
    if (nightF > 0.5) this.fogTarget *= 1.6;
    this.scene.fog.color.copy(sky);
    this.scene.fog.density = damp(this.scene.fog.density, this.fogTarget, 2, dt);

    /* sombras seguem o jogador */
    this.sun.position.set(px + sx * 0.15, py + Math.max(40, sy * 0.3) + 60, pz + 40);
    this.sun.target.position.set(px, py, pz);

    this.isNight = this.time < 5.5 || this.time > 19.3;

    /* nuvens */
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 650) c.position.x = -650;
      const dark = this.weather === 'storm' || this.weather === 'rain';
      c.children.forEach(m => {
        m.material.opacity = dark ? 0.55 : 0.3;
        m.material.color.setHex(dark ? 0x5a6a78 : nightF > 0.6 ? 0x3a4258 : 0xffffff);
      });
    }

    /* ---- clima ---- */
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      const r = Math.random();
      const old = this.weather;
      this.weather = r < 0.5 ? 'clear' : r < 0.68 ? 'rain' : r < 0.8 ? 'fog' : r < 0.9 ? 'storm' : 'wind';
      if (this.weather !== old) {
        const names = { clear: 'O céu se abre. ☀️', rain: 'Começa a chover. 🌧️', fog: 'Uma névoa desce sobre a terra. 🌫️', storm: 'A tempestade se aproxima! ⛈️', wind: 'O vento forte assobia. 💨' };
        game.hud?.toast(names[this.weather]);
      }
      this.weatherT = rand(50, 120);
    }
    /* neve: na planície gelada, chuva vira neve */
    const inSnow = game.player && dist(px, pz, -380, -220) < 135;

    /* partículas de chuva/neve ao redor do jogador */
    if ((this.weather === 'rain' || this.weather === 'storm' || inSnow)) {
      if (!this.rain) {
        const g = new THREE.BufferGeometry();
        const N = 500, arr = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) { arr[i * 3] = rand(-30, 30); arr[i * 3 + 1] = rand(0, 30); arr[i * 3 + 2] = rand(-30, 30); }
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: inSnow ? 0xffffff : 0x88aaff, size: inSnow ? 2.2 : 1.6, sizeAttenuation: true, transparent: true, opacity: 0.7 }));
        this.rain.frustumCulled = false;
        this.scene.add(this.rain);
      }
      this.rain.visible = true;
      this.rain.position.set(px, py, pz);
      const pos = this.rain.geometry.attributes.position;
      const speed = inSnow ? 6 : 34;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - speed * dt;
        if (inSnow) { pos.setX(i, pos.getX(i) + Math.sin(this.time * 99 + i) * dt * 2); }
        if (y < -6) y = rand(22, 30);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    } else if (this.rain) this.rain.visible = false;

    /* trovão */
    if (this.weather === 'storm') {
      this.thunderT -= dt;
      if (this.thunderT <= 0) {
        this.thunderT = rand(6, 16);
        game.audio.play('thunder', 0.8);
        game.fx.flash(new THREE.Vector3(px + rand(-40, 40), 40, pz + rand(-40, 40)), { color: 0xffffff, intensity: 30, dist: 120, life: 0.15 });
        game.hud && game.camera && game.camera.addShake(0.1);
      }
    }
  }

  _weatherLightMul() {
    if (this.weather === 'storm') return 0.45;
    if (this.weather === 'rain') return 0.65;
    if (this.weather === 'fog') return 0.8;
    return 1;
  }

  clockString() {
    const h = Math.floor(this.time), m = Math.floor((this.time % 1) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
