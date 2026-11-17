// Céu — ciclo dia/noite, sol, lua, estrelas, nuvens, clima
import * as THREE from '../../vendor/three.module.js';
import { G } from '../core/state.js';
import { settings } from '../core/config.js';
import { clamp, lerp, rand } from '../core/utils.js';

const DAY_SECONDS = 480; // 8 min = 24h de jogo (1 min de jogo = 20s)

const SKY_PRESETS = { // [topo, horizonte, luzSol, corLuz, ambiente, neblina]  por fase
  dawn:  { top: 0x2a3a6e, hor: 0xe8946a, sun: 0xffb070, amb: 0x58506a, fog: 0xd09070, sunI: 0.55 },
  day:   { top: 0x2e6fd4, hor: 0xaee0f7, sun: 0xfff2d8, amb: 0x6e7d8c, fog: 0xa8c4d8, sunI: 1.35 },
  dusk:  { top: 0x352a5e, hor: 0xf08050, sun: 0xff7a40, amb: 0x50425e, fog: 0xc06850, sunI: 0.5 },
  night: { top: 0x060816, hor: 0x101828, sun: 0x7080b8, amb: 0x1c2030, fog: 0x0c1220, sunI: 0.14 },
};

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = G.timeOfDay; // 0-24
    this.dayNum = 0;

    // cúpula do céu
    this.skyGeo = new THREE.SphereGeometry(700, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topColor: { value: new THREE.Color(0x2e6fd4) }, horColor: { value: new THREE.Color(0xaee0f7) } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 horColor; varying vec3 vP;
        void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(horColor, topColor, clamp(h*1.4+0.08, 0.0, 1.0)), 1.0); }`,
    });
    this.dome = new THREE.Mesh(this.skyGeo, this.skyMat);
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // luzes
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
    this.sun.castShadow = true;
    const S = 2048;
    this.sun.shadow.mapSize.set(S, S);
    const cam = this.sun.shadow.camera;
    cam.left = -60; cam.right = 60; cam.top = 60; cam.bottom = -60; cam.near = 1; cam.far = 320;
    this.sun.shadow.bias = -0.0018;
    scene.add(this.sun); scene.add(this.sun.target);

    this.moonLight = new THREE.DirectionalLight(0x7080b8, 0.0);
    scene.add(this.moonLight);
    this.ambient = new THREE.HemisphereLight(0x6e7d8c, 0x2a2018, 0.9);
    scene.add(this.ambient);

    // sol / lua visuais
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0, fog: false });
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), sunMat);
    scene.add(this.sunMesh);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdde4f5, fog: false });
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), moonMat);
    scene.add(this.moonMesh);

    // estrelas
    const starGeo = new THREE.BufferGeometry();
    const n = 700, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().setFromSphericalCoords(650, rand(0.1, 1.5), rand(0, Math.PI * 2));
      sp[i * 3] = v.x; sp[i * 3 + 1] = Math.abs(v.y); sp[i * 3 + 2] = v.z;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);

    // nuvens
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(rand(3));
      for (let j = 0; j < puffs; j++) {
        const s = rand(14, 30);
        const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.35, s * 0.7), cloudMat);
        m.position.set(rand(-24, 24), rand(-3, 3), rand(-10, 10));
        g.add(m);
      }
      g.position.set(rand(-500, 500), rand(120, 190), rand(-500, 500));
      g.userData.speed = rand(2, 5);
      this.clouds.add(g);
    }
    scene.add(this.clouds);

    // fog
    scene.fog = new THREE.FogExp2(0xa8c4d8, 0.0022 * settings.fogDensity);
    this.baseFog = 0.0022;

    // clima
    this.weather = 'clear';       // clear, rain, storm, fog, wind, snow
    this.weatherTimer = rand(60, 140);
    this.weatherTarget = 0; this.weatherAmount = 0;
    this._buildRain();
    this._lightning = 0;
  }

  _buildRain() {
    const N = 700;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = rand(-40, 40); pos[i * 3 + 1] = rand(0, 40); pos[i * 3 + 2] = rand(-40, 40); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.PointsMaterial({ color: 0x9db8d8, size: 0.22, transparent: true, opacity: 0 });
    this.rain = new THREE.Points(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
    this.rainGeo = geo;
  }

  setWeather(w) {
    this.weather = w;
    this.weatherTarget = w === 'clear' ? 0 : 1;
    this.weatherTimer = w === 'storm' ? rand(40, 80) : rand(90, 200);
  }

  update(dt, playerPos) {
    // tempo
    this.time = (this.time + dt * 24 / DAY_SECONDS) % 24;
    if (this.time < dt * 24 / DAY_SECONDS) this.dayNum++;
    G.timeOfDay = this.time;

    // fase do dia
    const t = this.time;
    let key = 'day', f = 0;
    if (t < 5) { key = 'night'; f = 0; }
    else if (t < 7) { key = 'dawn'; f = 0; }
    else if (t < 8) { key = 'dawn'; f = 1 - (t - 7); }
    else if (t < 17) { key = 'day'; f = 0; }
    else if (t < 19) { key = 'dusk'; f = (t - 17) / 2; }
    else if (t < 20.5) { key = 'dusk'; f = 1; }
    else { key = 'night'; f = 0; }

    const A = SKY_PRESETS[key], B = SKY_PRESETS[key === 'dawn' ? 'day' : key === 'dusk' ? 'night' : key];
    const mix = (a, b, k) => k <= 0 ? a : b;
    const k = f;
    const mixColor = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);

    // sol: posição em arco
    const sunAng = ((t - 6) / 24) * Math.PI * 2; // 6h = nascer
    const sunH = Math.sin(sunAng);
    const sunDir = new THREE.Vector3(Math.cos(sunAng) * 0.5, sunH, Math.cos(sunAng) * 0.86).normalize();
    const px = playerPos.x, pz = playerPos.z, py = playerPos.y;
    this.sun.position.set(px + sunDir.x * 160, py + Math.max(8, sunDir.y * 160), pz + sunDir.z * 160);
    this.sun.target.position.set(px, py, pz);
    const dayFactor = clamp(sunH * 3, 0, 1);
    const LIGHT_SCALE = 3.3; // unidades físicas de luz (r160+: intensidades ~π× maiores)
    this.sun.intensity = (lerp(A.sunI, B.sunI, k)) * dayFactor * LIGHT_SCALE + 0.1;
    this.sun.color.copy(mixColor(A.sun, B.sun));

    this.moonLight.position.set(px - sunDir.x * 160, py + Math.max(10, -sunDir.y * 160), pz - sunDir.z * 160);
    this.moonLight.target.position.set(px, py, pz);
    this.moonLight.intensity = (1 - dayFactor) * 0.22 * LIGHT_SCALE;

    this.ambient.color.copy(mixColor(A.amb, B.amb));
    this.ambient.intensity = (0.55 + 0.5 * dayFactor) * 2.4;

    // cúpula segue player
    this.dome.position.set(px, 0, pz);
    this.skyMat.uniforms.topColor.value.copy(mixColor(A.top, B.top));
    this.skyMat.uniforms.horColor.value.copy(mixColor(A.hor, B.hor));

    // corpos celestes
    this.sunMesh.position.set(px + sunDir.x * 560, sunDir.y * 560, pz + sunDir.z * 560);
    this.sunMesh.visible = sunDir.y > -0.1;
    this.moonMesh.position.set(px - sunDir.x * 540, -sunDir.y * 540, pz - sunDir.z * 540);
    this.moonMesh.visible = -sunDir.y > -0.1;
    this.starMat.opacity = clamp((1 - dayFactor) * 0.9 - this.weatherAmount * 0.5, 0, 0.9);
    this.stars.position.set(px, 0, pz);
    this.stars.rotation.y += dt * 0.005;

    // nuvens
    this.clouds.children.forEach(c => {
      c.position.x += c.userData.speed * dt * (1 + this.weatherAmount);
      if (c.position.x > px + 550) c.position.x = px - 550;
      if (c.position.x < px - 560) c.position.x = px + 540;
      c.position.z = c.position.z; // drift só em x
    });
    this.clouds.children.forEach(c => { c.visible = Math.abs(c.position.x - px) < 600; });

    // clima
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) this._cycleWeather();
    this.weatherAmount = lerp(this.weatherAmount, this.weatherTarget, dt * 0.5);
    const wA = this.weatherAmount;

    // neve sempre na região congelada
    const frozen = Math.hypot(px + 380, pz + 340) < 190;
    const snowing = frozen || this.weather === 'snow';

    this.rain.visible = wA > 0.02 && (this.weather === 'rain' || this.weather === 'storm' || snowing);
    if (this.rain.visible) {
      this.rainMat.opacity = wA * 0.7;
      this.rainMat.color.setHex(snowing ? 0xffffff : 0x9db8d8);
      this.rainMat.size = snowing ? 0.5 : 0.2;
      const p = this.rainGeo.attributes.position.array;
      const fall = snowing ? 9 : 42;
      for (let i = 0; i < p.length; i += 3) {
        p[i + 1] -= fall * dt;
        if (this.weather === 'storm' && !snowing) p[i] += 8 * dt;
        if (p[i + 1] < 0) { p[i + 1] = 42; p[i] = rand(-40, 40); p[i + 2] = rand(-40, 40); }
      }
      this.rainGeo.attributes.position.needsUpdate = true;
      this.rain.position.set(px, py, pz);
    }

    // neblina variável
    let fogC = mixColor(A.fog, B.fog);
    if (wA > 0) fogC.lerp(new THREE.Color(snowing ? 0xc8d0d8 : 0x6a7a8a), wA * 0.5);
    if (this.weather === 'fog') fogC.lerp(new THREE.Color(0x9aa4a8), 0.5);
    this.scene.fog.color.copy(fogC);
    let density = this.baseFog * settings.fogDensity;
    if (this.weather === 'fog') density *= 3.2;
    else if (wA > 0.3) density *= 1.6;
    this.scene.fog.density = density;

    // relâmpagos
    if (this.weather === 'storm' && wA > 0.5) {
      this._lightning -= dt;
      if (this._lightning <= 0) {
        this._lightning = rand(3, 9);
        this.sun.intensity += 8;
        setTimeout(() => { this.sun.intensity = Math.max(0.05, this.sun.intensity); }, 120);
        this.onThunder?.();
      }
    }
    this.isNight = dayFactor < 0.25;
    this.dayFactor = dayFactor;
  }

  _cycleWeather() {
    const r = Math.random();
    const frozen = Math.hypot(G.player?.position.x ?? 0 + 380, (G.player?.position.z ?? 0) + 340) < 190;
    if (frozen) { this.setWeather(r < 0.6 ? 'snow' : 'clear'); return; }
    if (r < 0.45) this.setWeather('clear');
    else if (r < 0.65) this.setWeather('rain');
    else if (r < 0.78) this.setWeather('storm');
    else if (r < 0.9) this.setWeather('fog');
    else this.setWeather('wind');
  }

  get clock() {
    const h = Math.floor(this.time) % 24, m = Math.floor((this.time % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
