import * as THREE from 'three';
import { damp } from '../utils.js';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.25, 1.0);

    vec3 horizon = vec3(0.46, 0.07, 0.40);
    vec3 middle  = vec3(0.13, 0.02, 0.26);
    vec3 zenith  = vec3(0.010, 0.004, 0.050);
    vec3 below   = vec3(0.05, 0.01, 0.10);

    vec3 col = mix(below, horizon, smoothstep(-0.25, 0.02, h));
    col = mix(col, middle, smoothstep(0.02, 0.30, h));
    col = mix(col, zenith, smoothstep(0.28, 1.0, h));

    // Retro striped sun sitting on the horizon.
    vec3 sunDir = normalize(uSunDir);
    float sd = dot(dir, sunDir);
    float disc = smoothstep(0.99935, 0.99975, sd);
    float glow = pow(max(sd, 0.0), 70.0);
    float stripes = step(0.42, fract((dir.y - sunDir.y + 0.12) * 90.0));
    vec3 sunColor = mix(vec3(1.0, 0.12, 0.55), vec3(1.0, 0.82, 0.30), clamp((dir.y - 0.02) * 5.0, 0.0, 1.0));
    col += sunColor * (disc * stripes * 1.9 + glow * 0.55);

    // Distant moon with a soft halo.
    float md = dot(dir, normalize(uMoonDir));
    float moonDisc = smoothstep(0.99935, 0.9997, md);
    float moonGlow = pow(max(md, 0.0), 130.0);
    vec3 moonColor = vec3(0.62, 0.80, 1.0);
    col += moonColor * (moonDisc * 1.25 + moonGlow * 0.28);

    // Low haze band that helps the city melt into the horizon.
    float haze = exp(-abs(h - 0.035) * 18.0);
    col += vec3(0.28, 0.035, 0.30) * haze * 0.10;

    // Stars, only above the haze.
    vec3 cell = floor(dir * 460.0);
    float star = step(0.9986, hash(cell));
    float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + hash(cell + 7.0) * 40.0);
    col += vec3(0.75, 0.86, 1.0) * star * twinkle * smoothstep(0.08, 0.55, h) * 0.9;

    // Thin aurora ribbons.
    float aurora = sin(dir.x * 7.0 + uTime * 0.18) * 0.5 + 0.5;
    aurora *= smoothstep(0.25, 0.9, h) * (1.0 - smoothstep(0.55, 1.0, h));
    col += vec3(0.10, 0.55, 0.45) * aurora * 0.10;

    // Lightning flash.
    col += vec3(0.55, 0.45, 0.85) * uFlash * 0.9;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky(scene) {
  const geometry = new THREE.SphereGeometry(4200, 48, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.22, 0.075, -1).normalize() },
      uMoonDir: { value: new THREE.Vector3(-0.78, 0.34, 0.58).normalize() }
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  scene.add(mesh);

  let flash = 0;

  return {
    mesh,
    update(dt, time, cameraPosition) {
      material.uniforms.uTime.value = time;
      flash = damp(flash, 0, 2.4, dt);
      material.uniforms.uFlash.value = flash;
      if (cameraPosition) mesh.position.copy(cameraPosition);
    },
    flash(strength = 1) {
      flash = strength;
    }
  };
}
