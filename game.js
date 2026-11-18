import * as THREE from 'three';
import faceUrl from './assets/arjun-face.png';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 260);
const qualityLevels = ['BALANCED', 'HIGH', 'ULTRA'];
const stored = (() => { try { return JSON.parse(localStorage.getItem('raasta6-3d-v1') || 'null'); } catch { return null; } })();
const state = {
  money: stored?.money ?? 1250,
  seeds: stored?.seeds ?? 0,
  produce: stored?.produce ?? 0,
  day: stored?.day ?? 1,
  timeMinutes: stored?.timeMinutes ?? 504,
  missionStage: stored?.missionStage ?? 0,
  questComplete: stored?.questComplete ?? false,
  plots: stored?.plots ?? [{ ploughed: false, stage: 0 }, { ploughed: true, stage: 0 }],
  playerX: stored?.playerX ?? -47,
  playerZ: stored?.playerZ ?? 14,
  quality: qualityLevels.includes(stored?.quality) ? stored.quality : 'HIGH',
  paused: false,
  running: false,
  keys: new Set(),
  joyX: 0,
  joyY: 0,
  runTouch: false,
  interaction: null,
  cameraYaw: 0,
  cameraPitch: 0.22,
  lastSave: 0,
};

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: !matchMedia('(max-width: 620px)').matches,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
} catch (error) {
  console.error('Unable to start WebGL', error);
  $('webglFallback').hidden = false;
  $('bootScreen').classList.add('ready');
  throw error;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cameraTarget = new THREE.Vector3();
const clock = new THREE.Clock();
const sun = new THREE.DirectionalLight(0xffe6b5, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xc8e0e6, 0x666044, 1.55);
scene.add(hemi);
const fillLight = new THREE.DirectionalLight(0xe0e9e6, 0.65);
fillLight.position.set(-25, 18, -20); scene.add(fillLight);

const world = new THREE.Group(); scene.add(world);
const staticColliders = [];
const plots = [
  { x: -28, z: -11, w: 10.5, d: 8.7, title: 'North field' },
  { x: -14, z: -15, w: 10.5, d: 8.7, title: 'South field' },
];
const places = {
  shop: { x: 30, z: 10, title: 'Kheda general store' },
  mandi: { x: 52, z: 11, title: 'Village mandi' },
  home: { x: -46, z: 7, title: 'Family farmhouse' },
};
const objective = new THREE.Vector3();
const player = { x: state.playerX, z: state.playerZ, vx: 0, vz: 0, faceX: 0, faceZ: -1, speed: 5.0 };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const groundY = (x, z) => {
  const radius = Math.max(Math.abs(x), Math.abs(z));
  const rise = smoothstep(25, 100, radius);
  return rise * (2.6 * Math.sin(x * 0.054 + z * 0.025) + 1.65 * Math.sin(z * 0.088 - x * 0.022) + 0.8 * Math.sin(x * 0.12)) + 0.035 * Math.sin(x * 0.23) * Math.cos(z * 0.21);
};
const seeded = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function makeCanvasTexture(kind = 'grass') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const data = g.createImageData(256, 256);
  const base = kind === 'grass' ? [103, 120, 78] : kind === 'dirt' ? [129, 107, 75] : [112, 111, 97];
  let seed = kind === 'grass' ? 37 : kind === 'dirt' ? 83 : 123;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (random() - .5) * (kind === 'grass' ? 42 : 34);
    data.data[i] = clamp(base[0] + n, 0, 255);
    data.data[i + 1] = clamp(base[1] + n, 0, 255);
    data.data[i + 2] = clamp(base[2] + n, 0, 255);
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  for (let i = 0; i < 1400; i++) {
    const x = random() * 256, y = random() * 256;
    g.strokeStyle = kind === 'grass' ? `rgba(${39 + random() * 35|0},${54 + random() * 42|0},${31 + random() * 20|0},${.12 + random() * .22})` : `rgba(45,35,22,${.08 + random() * .16})`;
    g.lineWidth = kind === 'grass' ? .7 : 1 + random() * 1.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (random() - .5) * 3, y - 1 - random() * 4); g.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  return texture;
}
const grassTex = makeCanvasTexture('grass'); grassTex.repeat.set(42, 42);
const soilTex = makeCanvasTexture('dirt'); soilTex.repeat.set(1.5, 1.5);
const roadTex = makeCanvasTexture('road'); roadTex.repeat.set(1, 12);
const mat = (color, roughness = .85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, color: 0xe3e4d6 });
const dirtMat = new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1, color: 0xb7a17a });
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: .98, color: 0xb5ae99 });
const plasterMat = mat('#c8b58e', .94);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x20271b, transparent: true, opacity: .25, depthWrite: false });

function buildTerrain() {
  const seg = 100, size = 230, half = size / 2;
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= seg; j++) {
    const z = -half + size * j / seg;
    for (let i = 0; i <= seg; i++) {
      const x = -half + size * i / seg;
      positions.push(x, groundY(x, z), z);
      uvs.push(i / seg * 42, j / seg * 42);
      if (i < seg && j < seg) {
        const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, grassMat);
  ground.receiveShadow = true; ground.frustumCulled = false; world.add(ground);
}

function box(parent, w, h, d, material, x, y, z, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = receive; parent.add(mesh); return mesh;
}
function cylinder(parent, rt, rb, h, material, x, y, z, segs = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function createGroundRibbon(points, width, material, yOffset = .085) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, groundY(x, z), z)));
  const samples = curve.getSpacedPoints(110), positions = [], uvs = [], indices = [];
  let run = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i], before = samples[Math.max(0, i - 1)], after = samples[Math.min(samples.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz) || 1;
    const px = dz / length * width / 2, pz = -dx / length * width / 2;
    if (i > 0) run += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z);
    const leftX = p.x + px, leftZ = p.z + pz, rightX = p.x - px, rightZ = p.z - pz;
    positions.push(leftX, groundY(leftX, leftZ) + yOffset, leftZ, rightX, groundY(rightX, rightZ) + yOffset, rightZ);
    uvs.push(0, run / 5, 1, run / 5);
    if (i < samples.length - 1) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; indices.push(a, b, c, b, d, c); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(geometry, material); ribbon.receiveShadow = true; ribbon.castShadow = false; world.add(ribbon);
  return ribbon;
}
function addCollider(x, z, w, d) { staticColliders.push({ x, z, hx: w / 2 + .6, hz: d / 2 + .6 }); }

function makeSignTexture(text, color = '#594734') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#d7c18d'; g.fillRect(8, 8, 496, 112);
  g.fillStyle = '#3d3429'; g.fillRect(14, 14, 484, 100);
  g.fillStyle = '#eee2bf'; g.font = '700 33px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeBuilding({ x, z, w, d, wallH = 3.2, roofH = 2.2, wall = '#c8b28b', roof = '#985c3f', label = '', shop = false }) {
  const root = new THREE.Group(); root.position.set(x, groundY(x, z), z); world.add(root);
  const wallMat = mat(wall, .95), roofMat = mat(roof, .87), trimMat = mat('#d8c69d', .9), woodMat = mat('#684b33', .9), glassMat = new THREE.MeshStandardMaterial({ color: 0x8ca8a3, roughness: .24, metalness: .05 });
  box(root, w, wallH, d, wallMat, 0, wallH / 2, 0);
  box(root, w + .2, .26, d + .2, mat('#aa956e', .95), 0, .16, 0);
  // Gabled roof sides and fascia.
  const shape = new THREE.BufferGeometry();
  const verts = [
    -w/2,wallH,-d/2, w/2,wallH,-d/2, w/2,wallH+roofH,0,
    -w/2,wallH,-d/2, w/2,wallH+roofH,0, -w/2,wallH+roofH,0,
    -w/2,wallH+roofH,0, w/2,wallH+roofH,0, w/2,wallH,d/2,
    -w/2,wallH+roofH,0, w/2,wallH,d/2, -w/2,wallH,d/2,
  ];
  shape.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); shape.computeVertexNormals();
  const roofMesh = new THREE.Mesh(shape, new THREE.MeshStandardMaterial({ color: roofMat.color, roughness: .86, side: THREE.DoubleSide }));
  roofMesh.castShadow = true; roofMesh.receiveShadow = true; root.add(roofMesh);
  box(root, .22, .22, d + .28, trimMat, -w/2, wallH, 0, true, true);
  box(root, .22, .22, d + .28, trimMat, w/2, wallH, 0, true, true);
  // Decorative roof tile seams on the two slopes.
  for (let row = 1; row <= 3; row++) {
    const u = row / 4, zz = -d/2 + u * d;
    const y = wallH + roofH * (1 - Math.abs(zz) / (d/2)) + .035;
    const seam = box(root, w + .06, .035, .035, mat('#b77854', .95), 0, y, zz, false, false);
    seam.rotation.z = zz < 0 ? -.43 : .43;
  }
  // Gable end triangles.
  for (const frontZ of [-d/2 - .015, d/2 + .015]) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-w/2,wallH,frontZ, w/2,wallH,frontZ, 0,wallH+roofH,frontZ], 3)); tri.computeVertexNormals();
    root.add(new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: wallMat.color, side: THREE.DoubleSide, roughness: .95 })));
  }
  // Front door, threshold, windows and ledge.
  const front = -d/2 - .08;
  box(root, 1.05, 2.22, .12, woodMat, 0, 1.22, front, true, false);
  box(root, .1, .1, .05, mat('#d4bd7b', .35, { metalness: .5 }), .34, 1.18, front - .07, false, false);
  for (const side of [-1, 1]) {
    box(root, 1.2, 1.02, .1, trimMat, side * w * .31, 2.02, front, false, false);
    box(root, .91, .76, .045, glassMat, side * w * .31, 2.02, front - .07, false, false);
    box(root, .035, .78, .035, woodMat, side * w * .31, 2.02, front - .1, false, false);
    box(root, .88, .035, .035, woodMat, side * w * .31, 2.02, front - .1, false, false);
  }
  if (shop) {
    // striped fabric awning over the counter
    const awning = box(root, w * .9, .13, 1.35, mat('#c2a979'), 0, 2.6, front - .62, false, true); awning.rotation.x = -.08;
    for (let i = 0; i < 8; i++) box(root, w * .9 / 8, .16, 1.38, mat(i % 2 ? '#e5d2a6' : '#a8513d'), -w * .45 + (i + .5) * w * .9 / 8, 2.69, front - .62, false, false);
    box(root, w * .68, .75, .18, mat('#785638'), 0, 1.22, front - .16, false, false);
    for (let i = 0; i < 5; i++) {
      const produceMat = mat(['#bf6840','#d2ac4e','#708b50'][i % 3], .7);
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), produceMat);
      fruit.position.set(-w*.25 + i*w*.125, 1.66, front - .24); fruit.castShadow = true; root.add(fruit);
    }
  }
  if (label) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w * .78, .46), new THREE.MeshBasicMaterial({ map: makeSignTexture(label), side: THREE.DoubleSide }));
    board.position.set(0, wallH + roofH * .57, front - .1); root.add(board);
  }
  addCollider(x, z, w + .8, d + .8);
  return root;
}

function buildFarmyard() {
  // Courtyard earth and a low cream boundary wall.
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), dirtMat);
  yard.rotation.x = -Math.PI/2; yard.position.set(-43, groundY(-43, 7) + .035, 7); yard.receiveShadow = true; world.add(yard);
  const wallMat = mat('#b8a47a', .95), postMat = mat('#806b4c', .95);
  for (let i = 0; i < 11; i++) {
    const x = -56 + i * 2.6;
    box(world, .22, .95, .22, postMat, x, groundY(x, -3) + .48, -3, true, true);
  }
  box(world, 26, .11, .11, wallMat, -43, groundY(-43,-3) + 1.0, -3, false, false);
  makeBuilding({ x: -47, z: 1, w: 9, d: 7, wallH: 3.3, roofH: 2.5, wall: '#c9b48e', roof: '#9a5b3f', label: 'ARJUN’S HOME' });
  // A shaded tool shed and water well.
  makeBuilding({ x: -36, z: 4, w: 5.6, d: 4.8, wallH: 2.5, roofH: 1.7, wall: '#b8a17a', roof: '#77513a' });
  const well = new THREE.Group(); well.position.set(-39, groundY(-39, 10), 10); world.add(well);
  cylinder(well, .9, 1.0, .7, mat('#897653'), 0, .35, 0, 12);
  const water = new THREE.Mesh(new THREE.CircleGeometry(.68, 20), mat('#547b77', .25, { metalness: .15 })); water.rotation.x = -Math.PI/2; water.position.y = .72; well.add(water);
  for (const x of [-.72,.72]) cylinder(well, .07, .1, 2.0, mat('#674c34'), x, 1.55, 0, 7);
  box(well, 1.65, .1, .12, mat('#59432e'), 0, 2.54, 0);
  // Hay and stacked grain sacks.
  for (let i=0;i<4;i++) { const bale=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.72,10),mat('#bba05d')); bale.rotation.z=Math.PI/2; bale.position.set(-57+i*.92,groundY(-57+i*.92,12)+.43,12); bale.castShadow=true; world.add(bale); }
}

function buildFields() {
  const soil = mat('#7b6444', .99, { map: soilTex });
  const ridge = mat('#9b8058', .96);
  plots.forEach((p, index) => {
    p.root = new THREE.Group(); p.root.position.set(p.x, groundY(p.x,p.z), p.z); world.add(p.root);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(p.w,.16,p.d), soil); bed.position.y=.04; bed.receiveShadow=true; bed.castShadow=true; p.root.add(bed);
    for (let i=0;i<9;i++) {
      const furrow = new THREE.Mesh(new THREE.BoxGeometry(.07,.06,p.d-.38), index===0 ? ridge : mat('#a08761',.98));
      furrow.position.set(-p.w/2+.7+i*(p.w-1.4)/8,.15,0); furrow.receiveShadow=true; p.root.add(furrow);
    }
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      const post = cylinder(p.root,.09,.12,.72,mat('#806744'),sx*(p.w/2+.18),.35,sz*(p.d/2+.18),6);
    }
    const borderMat=mat('#b9a474',.97);
    box(p.root,p.w+.35,.08,.11,borderMat,0,.19,-p.d/2, false, true);
    box(p.root,p.w+.35,.08,.11,borderMat,0,.19,p.d/2, false, true);
    const cropMat = mat('#687f45', .82);
    p.cropMeshes=[];
    p.refreshCrop = () => {
      for (const m of p.cropMeshes) { p.root.remove(m); m.geometry.dispose(); }
      p.cropMeshes=[];
      const stage=state.plots[index].stage;
      if (!stage) return;
      const h = stage===1 ? .26 : stage===2 ? .55 : .86;
      const plantGeo = new THREE.ConeGeometry(stage===3?.17:.13,h,5);
      const count=8*8;
      const plants=new THREE.InstancedMesh(plantGeo,cropMat,count);
      const dummy=new THREE.Object3D(); let n=0;
      for(let row=0;row<8;row++) for(let col=0;col<8;col++) {
        const x=-p.w/2+1.1+col*(p.w-2.2)/7+(row%2)*.12;
        const z=-p.d/2+.75+row*(p.d-1.5)/7;
        dummy.position.set(x,.16+h/2,z); dummy.rotation.y=seeded(index*1000+n)*Math.PI*2; dummy.scale.set(.74+seeded(n+4)*.6,1,.74+seeded(n+9)*.6); dummy.updateMatrix(); plants.setMatrixAt(n++,dummy.matrix);
      }
      plants.castShadow=true; plants.receiveShadow=true; p.root.add(plants); p.cropMeshes.push(plants);
      if(stage===3) {
        const bloomGeo=new THREE.SphereGeometry(.075,6,5), bloomMat=mat('#d4bd66',.75);
        const blooms=new THREE.InstancedMesh(bloomGeo,bloomMat,count); n=0;
        for(let row=0;row<8;row++) for(let col=0;col<8;col++) { const x=-p.w/2+1.1+col*(p.w-2.2)/7+(row%2)*.12,z=-p.d/2+.75+row*(p.d-1.5)/7; dummy.position.set(x,.18+h*.92,z); dummy.scale.set(1,.45,1); dummy.updateMatrix(); blooms.setMatrixAt(n++,dummy.matrix); }
        p.root.add(blooms); p.cropMeshes.push(blooms);
      }
    };
    p.refreshCrop();
  });
  createGroundRibbon([[-43,8],[-37,2],[-34,-5],[-28,-10]],2.4,dirtMat,.13);
  createGroundRibbon([[-28,-11],[-24,-13],[-18,-15]],1.6,dirtMat,.14);
}

function buildVillage() {
  // Main compact village road; narrow branches link the farm, shop and mandi.
  createGroundRibbon([[-112,34],[-80,34],[-48,29],[-16,31],[8,28],[24,20],[52,20],[82,23],[116,23]],6.2,roadMat,.09);
  createGroundRibbon([[-48,29],[-46,19],[-44,12],[-42,8]],3.3,dirtMat,.13);
  createGroundRibbon([[24,20],[27,13],[30,10]],3.1,dirtMat,.13);
  createGroundRibbon([[52,20],[52,15],[52,11]],3.0,dirtMat,.13);
  makeBuilding({ x: 30, z: 7, w: 8.8, d: 7, wallH: 3.2, roofH: 2.3, wall: '#c8b088', roof: '#a45d3d', label: 'KHEDA GENERAL STORE', shop: true });
  makeBuilding({ x: 52, z: 8, w: 7.4, d: 6.5, wallH: 3, roofH: 2.0, wall: '#c2aa7e', roof: '#83583d', label: 'KHEDA MANDI' });
  makeBuilding({ x: 33, z: -7, w: 7.2, d: 5.8, wallH: 2.8, roofH: 2.0, wall: '#c5ae84', roof: '#79543d', label: 'CHAI & REPAIR' });
  // Mandi shade canopy, sacks and produce crates.
  const canopy=mat('#a24d3b',.9), cream=mat('#e2cca0',.9);
  for(let i=0;i<5;i++) {
    box(world,2,.12,4.5,i%2?cream:canopy,45+i*1.7,groundY(45+i*1.7,17)+3.0,17,false,false);
  }
  for(let i=0;i<7;i++) {
    box(world,1.2,.85,.85,mat(['#947447','#aa8351','#7c684b'][i%3]),47+(i%4)*1.7,groundY(47,20)+.45,20+Math.floor(i/4)*1.05);
  }
  // Well water channel and scrubby bank.
  const canalMat=new THREE.MeshStandardMaterial({color:0x426d68,roughness:.28,metalness:.08,transparent:true,opacity:.9});
  const canal=new THREE.Mesh(new THREE.PlaneGeometry(6,34),canalMat); canal.rotation.x=-Math.PI/2; canal.rotation.z=.13; canal.position.set(1,groundY(1,-29)+.09,-29); world.add(canal);
  for(let s of [-1,1]) { const bank=new THREE.Mesh(new THREE.BoxGeometry(.7,.24,35),mat('#897b56')); bank.position.set(1+s*3,groundY(1,-29)+.04,-29); bank.rotation.y=-.13; world.add(bank); }
  // Distant patterned crop belt in the east.
  const distantCropMat=mat('#858451',.97);
  for(let i=0;i<15;i++) {
    const row=new THREE.Mesh(new THREE.BoxGeometry(37,.09,.13),distantCropMat); row.position.set(70,groundY(70,-36+i*2)+.2,-36+i*2); row.rotation.y=.07; world.add(row);
  }
  // Instanced stones and grass tussocks keep the village light on mobile GPUs.
  const stoneMat=mat('#998e70',.98), rockGeo=new THREE.DodecahedronGeometry(1,0);
  const rocks=new THREE.InstancedMesh(rockGeo,stoneMat,62), tuftGeo=new THREE.ConeGeometry(.06,.58,3), grassTuftMat=mat('#8b905d',.92);
  const tufts=new THREE.InstancedMesh(tuftGeo,grassTuftMat,225), dummy=new THREE.Object3D(); let rockCount=0,tuftCount=0;
  for(let i=0;i<62;i++) {
    const x=-99+seeded(i+52)*194, z=-59+seeded(i+142)*120;
    if(Math.abs(z-(29+Math.sin(x*.04)*2))<7 || (x>-60&&x< -5&&z>-25&&z<2) || (x>20&&x<64&&z>-16&&z<24)) continue;
    const scale=.24+seeded(i+2)*.45; dummy.position.set(x,groundY(x,z)+scale*.4,z); dummy.scale.set(scale,scale*.42,scale*.8); dummy.rotation.set(seeded(i)*.3,seeded(i+4)*3,seeded(i+7)*.2); dummy.updateMatrix(); rocks.setMatrixAt(rockCount++,dummy.matrix);
  }
  rocks.count=rockCount; rocks.castShadow=true; rocks.receiveShadow=true; world.add(rocks);
  for(let i=0;i<75;i++) {
    const x=-104+seeded(i+233)*208,z=-73+seeded(i+332)*150;
    if((x>-58&&x<-4&&z>-29&&z<1)||(x>22&&x<63&&z>-18&&z<24)||Math.abs(z-29)<9) continue;
    for(let k=0;k<3;k++) { const height=.35+seeded(i*4+k)*.35; dummy.position.set(x+(k-1)*.08,groundY(x,z)+height/2,z); dummy.scale.set(1,height/.58,1); dummy.rotation.set(0,seeded(i+k)*Math.PI,(k-1)*.25); dummy.updateMatrix(); tufts.setMatrixAt(tuftCount++,dummy.matrix); }
  }
  tufts.count=tuftCount; tufts.castShadow=false; world.add(tufts);
  buildTrees();
  buildHills();
}

function buildTrees() {
  const trunkMat=mat('#66513a',.94), leafMats=[mat('#536b42',.96),mat('#687b4c',.96),mat('#788453',.96),mat('#455f3e',.96)];
  const trunkGeo=new THREE.CylinderGeometry(.13,.22,2.9,7);
  const canopyGeo=new THREE.IcosahedronGeometry(1,1);
  const treeSpots=[];
  for(let i=0;i<96;i++) {
    const angle=seeded(i+500)*Math.PI*2, radius=32+seeded(i+600)*66;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if((x>-61&&x<-3&&z>-29&&z<18)||(x>20&&x<64&&z>-17&&z<22)||Math.abs(z-29)<7) continue;
    treeSpots.push({x,z,r:.75+seeded(i+800)*.85,seed:i});
  }
  const trunk=new THREE.InstancedMesh(trunkGeo,trunkMat,treeSpots.length); trunk.castShadow=true; trunk.receiveShadow=true;
  const crowns=leafMats.map(m=>{const mesh=new THREE.InstancedMesh(canopyGeo,m,treeSpots.length*3); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;});
  const crownCounts=leafMats.map(()=>0), dummy=new THREE.Object3D();
  treeSpots.forEach((t,i)=>{
    const y=groundY(t.x,t.z), h=2.4*t.r;
    dummy.position.set(t.x,y+h/2,t.z); dummy.scale.set(t.r*.36,h/2.4,t.r*.36); dummy.rotation.y=seeded(t.seed)*Math.PI; dummy.updateMatrix(); trunk.setMatrixAt(i,dummy.matrix);
    for(let k=0;k<3;k++) {
      const phase=seeded(t.seed*7+k)*Math.PI*2, crownType=(t.seed+k)%crowns.length, ix=crownCounts[crownType]++;
      dummy.position.set(t.x+Math.cos(phase)*t.r*.42,y+h+(.55+seeded(ix+9)*.32)*t.r,t.z+Math.sin(phase)*t.r*.35);
      dummy.scale.set(t.r*(.72+seeded(ix+3)*.24),t.r*(.65+seeded(ix+5)*.2),t.r*(.68+seeded(ix+8)*.25));
      dummy.rotation.set(seeded(ix+10)*.5,phase,seeded(ix+20)*.3); dummy.updateMatrix();
      crowns[crownType].setMatrixAt(ix,dummy.matrix);
    }
  });
  crowns.forEach((mesh,i)=>{mesh.count=crownCounts[i];});
  world.add(trunk,...crowns);
  // A few larger neem trees frame the farm and the village lane.
  const orchard=[[-61,-2],[-63,10],[-58,20],[-26,19],[-19,23],[6,3],[12,-5],[15,34],[67,1],[68,31]];
  const oldTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,.29,3.6,8),trunkMat,orchard.length);
  const oldCrowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.45,1),mat('#ffffff',.96),orchard.length);
  for(let i=0;i<orchard.length;i++) {
    const [x,z]=orchard[i], r=1.1+(i%3)*.2, y=groundY(x,z);
    dummy.position.set(x,y+1.8,z); dummy.scale.set(1,1,1); dummy.updateMatrix(); oldTrunks.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,y+4.0,z); dummy.scale.set(r,.86*r,r*.9); dummy.rotation.y=seeded(i+40)*2; dummy.updateMatrix(); oldCrowns.setMatrixAt(i,dummy.matrix); oldCrowns.setColorAt(i,new THREE.Color(['#536b42','#687b4c','#788453','#455f3e'][i%4]));
  }
  oldTrunks.castShadow=true;oldCrowns.castShadow=true;oldCrowns.receiveShadow=true;world.add(oldTrunks,oldCrowns);
}
function buildHills() {
  const geometry=new THREE.IcosahedronGeometry(1.0,2), material=mat('#ffffff',1);
  const hills=new THREE.InstancedMesh(geometry,material,26),dummy=new THREE.Object3D();
  for(let i=0;i<26;i++) {
    const side=i%4, along=-96+Math.floor(i/4)*31+(seeded(i+91)-.5)*8;
    let x,z;
    if(side===0){x=along;z=-103-seeded(i)*8;} else if(side===1){x=along;z=102+seeded(i)*8;} else if(side===2){x=-106-seeded(i)*7;z=along;} else {x=106+seeded(i)*7;z=along;}
    const r=13+seeded(i+33)*18;
    dummy.position.set(x,groundY(x,z)+r*.42,z);dummy.scale.set(r*(1.3+seeded(i)*.6),r*(.8+seeded(i+4)*.55),r*.74);dummy.rotation.y=seeded(i+7)*4;dummy.updateMatrix();hills.setMatrixAt(i,dummy.matrix);
    hills.setColorAt(i,new THREE.Color(['#667455','#77815d','#858565','#596a50'][i%4]));
  }
  hills.receiveShadow=true;world.add(hills);
}

function createPlayer() {
  const root=new THREE.Group(); root.position.set(player.x,groundY(player.x,player.z),player.z); scene.add(root);
  const body=new THREE.Group(); root.add(body);
  const skin=mat('#9d6347',.79), skinLight=mat('#b87956',.75), navy=mat('#101923',.92), navyEdge=mat('#26303a',.9), cargo=mat('#493a30',.95), cargoLight=mat('#5b4837',.96), shoe=mat('#d0c8b7',.85), sole=mat('#655d50',.92), hair=mat('#171617',.76), bracelet=mat('#b6423e',.72);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.67,4,9),navy); torso.position.y=1.35; torso.scale.set(1.04,1,0.76); torso.castShadow=true; torso.receiveShadow=true; body.add(torso);
  const neck=cylinder(body,.115,.13,.2,skin,0,1.89,0,10);
  // Shirt opening, two chest pockets and tiny buttons.
  const collarL=box(body,.14,.25,.035,navyEdge,-.105,1.79,-.258,false,false); collarL.rotation.z=-.3;
  const collarR=box(body,.14,.25,.035,navyEdge,.105,1.79,-.258,false,false); collarR.rotation.z=.3;
  for(const x of [-.17,.17]) { box(body,.19,.19,.035,navyEdge,x,1.48,-.259,false,false); box(body,.19,.035,.04,navy,x,1.59,-.26,false,false); }
  for(let i=0;i<4;i++) { const btn=new THREE.Mesh(new THREE.SphereGeometry(.025,6,5),mat('#aab0ad',.4,{metalness:.15})); btn.position.set(0,1.2+i*.19,-.266); body.add(btn); }
  // Trousers and articulated limbs.
  const pelvis=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.24,3,8),cargo); pelvis.position.set(0,.84,0); pelvis.scale.set(1,.8,.8); pelvis.castShadow=true; body.add(pelvis);
  const legPivots=[];
  for(const side of [-1,1]) {
    const pivot=new THREE.Group(); pivot.position.set(side*.15,.76,0); body.add(pivot); legPivots.push(pivot);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.56,3,7),cargo); leg.position.y=-.34; leg.scale.z=.93; leg.castShadow=true; leg.receiveShadow=true; pivot.add(leg);
    const shoeMesh=new THREE.Mesh(new THREE.BoxGeometry(.24,.14,.4),shoe); shoeMesh.position.set(0,-.69,-.06); shoeMesh.castShadow=true; pivot.add(shoeMesh);
    const outsole=box(pivot,.245,.055,.4,sole,0,-.76,-.06,false,false);
    // Cargo thigh pocket details.
    box(pivot,.205,.25,.035,cargoLight,side*.01,-.25,-.116,false,false);
    box(pivot,.21,.035,.04,mat('#745c45'),side*.01,-.12,-.12,false,false);
  }
  const armPivots=[];
  for(const side of [-1,1]) {
    const pivot=new THREE.Group(); pivot.position.set(side*.39,1.65,0); body.add(pivot); armPivots.push(pivot);
    const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.39,3,7),navy); upper.position.y=-.24; upper.rotation.z=side*.08; upper.castShadow=true; pivot.add(upper);
    const cuff= new THREE.Mesh(new THREE.CylinderGeometry(.108,.105,.13,9),navyEdge); cuff.position.y=-.49; cuff.castShadow=true; pivot.add(cuff);
    const fore=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.36,3,7),skinLight); fore.position.y=-.76; fore.castShadow=true; pivot.add(fore);
    for(let b=0;b<3;b++){const band=new THREE.Mesh(new THREE.TorusGeometry(.083+b*.006,.012,5,12),b===0?bracelet:mat(b===1?'#d3bd77':'#567c9b',.65)); band.rotation.x=Math.PI/2; band.position.set(0,-.96+b*.035,0); pivot.add(band);}
  }
  const head=new THREE.Group(); head.position.set(0,2.17,0); body.add(head);
  const skull=new THREE.Mesh(new THREE.SphereGeometry(.235,18,14),skinLight); skull.scale.set(.9,1.13,.86); skull.castShadow=true; skull.receiveShadow=true; head.add(skull);
  // Curly dark hair cap, tapered at the nape.
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.245,16,10,0,Math.PI*2,0,Math.PI*.56),hair); hairCap.position.set(0,.055,.012); hairCap.scale.set(1.03,1.0,.94); hairCap.castShadow=true; head.add(hairCap);
  for(let i=0;i<8;i++) { const curl=new THREE.Mesh(new THREE.SphereGeometry(.055+seeded(i)*.025,7,6),hair); curl.position.set(-.17+(i%4)*.11,.14+Math.floor(i/4)*.04,-.09+(i%2)*.045); curl.scale.set(1,.7,.9); head.add(curl); }
  const ears=[]; for(const side of [-1,1]) {const ear=new THREE.Mesh(new THREE.SphereGeometry(.065,8,7),skin); ear.position.set(side*.215,-.035,-.005); ear.scale.set(.6,1,.6); head.add(ear); ears.push(ear);}
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.04,.11,5),skin); nose.rotation.x=Math.PI/2; nose.position.set(0,-.015,-.211); head.add(nose);
  for(const x of [-.088,.088]) { const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,6,5),mat('#241d1a',.35)); eye.position.set(x,.04,-.203); head.add(eye); }
  const beard=new THREE.Mesh(new THREE.SphereGeometry(.17,12,9),hair); beard.scale.set(1.05,.62,.42); beard.position.set(0,-.15,-.125); head.add(beard);
  // Photo-derived face decal: the head/body stay 3D, with this likeness detail on the front.
  const faceTexture=new THREE.TextureLoader().load(faceUrl); faceTexture.colorSpace=THREE.SRGBColorSpace; faceTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.32,.415),new THREE.MeshBasicMaterial({map:faceTexture,transparent:true,alphaTest:.035,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  face.position.set(0,-.012,-.207); head.add(face);
  // Back-of-shirt yoke and shoulder seams help the rear camera read the supplied outfit.
  box(body,.48,.055,.025,navyEdge,0,1.65,.262,false,false);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.72,20),new THREE.MeshBasicMaterial({color:0x1b211a,transparent:true,opacity:.25,depthWrite:false})); shadow.rotation.x=-Math.PI/2; shadow.position.y=.04; root.add(shadow);
  return {root,body,head,legPivots,armPivots};
}

function buildSky() {
  const cloudMat=new THREE.MeshStandardMaterial({color:0xe7e5db,roughness:1,transparent:true,opacity:.78,depthWrite:false});
  for(let i=0;i<10;i++) {
    const group=new THREE.Group(); group.position.set(-92+seeded(i+2)*184,35+seeded(i+8)*18,-90+seeded(i+14)*175); scene.add(group);
    for(let j=0;j<4;j++){const cloud=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),cloudMat); cloud.position.set(j*.9,seeded(i*8+j)*.32,seeded(j+20)*.5); cloud.scale.set(2.1+seeded(i+j)*1.2,.35+seeded(i+j+5)*.2,1.05); group.add(cloud);}
  }
}

buildTerrain();
createGroundRibbon([[-43,8],[-36,9],[-31,3],[-28,-2]],1.5,dirtMat,.13);
buildFarmyard();
buildFields();
buildVillage();
buildSky();
const avatar=createPlayer();

function setGraphics() {
  const level=state.quality;
  const dpr=window.devicePixelRatio||1;
  const max=level==='BALANCED' ? .95 : level==='HIGH' ? 1.25 : 1.55;
  renderer.setPixelRatio(Math.min(dpr,max));
  sun.shadow.mapSize.set(level==='ULTRA'?2048:level==='HIGH'?1024:512,level==='ULTRA'?2048:level==='HIGH'?1024:512);
  sun.shadow.needsUpdate=true;
  $('qualityButton').querySelector('span').textContent=level;
  $('qualityButton').classList.toggle('ultra',level==='ULTRA');
  save(); resize();
}
function resize() {
  const w=window.innerWidth,h=window.innerHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
window.addEventListener('resize',resize);
setGraphics();

const missionText=[
  ['A little groundwork','Pick up mustard seeds in the village, then prepare a field for sowing.','VILLAGE SHOP'],
  ['Make the rounds','The furrows are ready. Plough the north plot, then sow mustard.','NORTH FIELD'],
  ['Ready for market','Give the crop time to grow. Rest through two days, harvest, then head to the mandi.','NORTH FIELD'],
  ['A good first harvest','The family farm has a little breathing room. See what the village needs next.','FAMILY FARM'],
];
function objectivePosition() {
  if(state.missionStage===0) objective.set(places.shop.x,0,places.shop.z+5);
  else if(state.missionStage===2&&state.produce>0) objective.set(places.mandi.x,0,places.mandi.z+5);
  else if(state.missionStage===1||state.missionStage===2) objective.set(plots[0].x,0,plots[0].z);
  else objective.set(places.home.x,0,places.home.z+8);
  return objective;
}
function missionLabel() {
  if(state.missionStage===2&&state.produce>0) return 'MANDI · SELL HARVEST';
  if(state.missionStage===2&&state.plots.some(p=>p.stage===3)) return 'NORTH FIELD · HARVEST';
  if(state.missionStage>=3) return 'FAMILY FARM · COMPLETE';
  return missionText[Math.min(state.missionStage,3)][2];
}
function updateHud() {
  $('moneyText').textContent=state.money.toLocaleString('en-IN');
  $('questTitle').textContent=missionText[Math.min(state.missionStage,3)][0];
  $('questDescription').textContent=missionText[Math.min(state.missionStage,3)][1];
  $('questProgress').style.width=`${Math.min(state.missionStage,3)/3*100}%`;
  $('questCount').textContent=`${Math.min(state.missionStage,3)} / 3`;
  const target=objectivePosition();
  const dist=Math.round(Math.hypot(player.x-target.x,player.z-target.z));
  $('targetText').textContent=missionLabel(); $('targetDistance').textContent=`${dist} m`;
  const hours=Math.floor(state.timeMinutes/60)%24, mins=Math.floor(state.timeMinutes%60);
  $('clockText').textContent=`${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  $('locationText').textContent=player.x>20?'KHEDA · VILLAGE CENTRE':'FAMILY FARM · OUTSKIRTS';
  $('compassHeading').textContent=compassCardinal(state.cameraYaw);
}
function compassCardinal(yaw) { const dirs=['N','NE','E','SE','S','SW','W','NW']; return dirs[(Math.round(((yaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8)]; }
function showToast(message, emphasis='') {
  const item=document.createElement('div'); item.className='toast'; item.innerHTML=emphasis?`${message} <strong>${emphasis}</strong>`:message;
  $('toastStack').appendChild(item); setTimeout(()=>item.remove(),2600);
}
function save() {
  try { localStorage.setItem('raasta6-3d-v1',JSON.stringify({money:state.money,seeds:state.seeds,produce:state.produce,day:state.day,timeMinutes:state.timeMinutes,missionStage:state.missionStage,questComplete:state.questComplete,plots:state.plots,playerX:player.x,playerZ:player.z,quality:state.quality})); } catch {}
}
function updateLighting() {
  const h=(state.timeMinutes/60)%24;
  const night=h<5.8||h>20.1;
  let sky;
  if(night) sky=new THREE.Color('#263541');
  else if(h<7.5) sky=new THREE.Color('#d99b6b').lerp(new THREE.Color('#b9cbd0'),smoothstep(5.8,7.5,h));
  else if(h>17.5) sky=new THREE.Color('#c5d1cc').lerp(new THREE.Color('#d48a58'),smoothstep(17.5,20.1,h));
  else sky=new THREE.Color('#bfd0d1').lerp(new THREE.Color('#d3ddd5'),Math.sin((h-8)/10*Math.PI)*.4);
  scene.background=sky; scene.fog=new THREE.Fog(sky,75,190);
  sun.intensity=night?.28:h<7.5||h>17.5?2.2:3.05;
  sun.color.set(night?'#a7c1e4':h<7.5||h>17.5?'#ffd3a0':'#fff0d2');
  const angle=(h/24)*Math.PI*2, tx=player.x, tz=player.z, ty=groundY(tx,tz);
  sun.target.position.set(tx,ty,tz);
  sun.position.set(tx+Math.cos(angle)*65,ty+Math.max(9,Math.sin(angle)*72),tz+Math.sin(angle)*40);
  hemi.intensity=night?.68:1.55;
  $('weatherText').textContent=state.day%5===0?'CLOUDY · 24°':'CLEAR · 26°';
  $('weatherText').style.color=night?'#d9e0ec':'#ffffffa1';
  $('clockText').style.color=night?'#d2e0f2':'#ffffff';
}

function nearestInteraction() {
  const candidates=[
    {type:'shop',...places.shop,label:'Talk to shopkeeper'},
    {type:'mandi',...places.mandi,label:'Sell your harvest'},
    {type:'home',...places.home,label:'Rest at the farmhouse'},
    ...plots.map((p,index)=>({type:'plot',index,x:p.x,z:p.z,label:`Work the ${index===0?'north':'south'} field`})),
  ];
  let best=null,dist=5.2;
  for(const item of candidates){const d=Math.hypot(player.x-item.x,player.z-item.z);if(d<dist){best={...item,distance:d};dist=d;}}
  state.interaction=best;
  const prompt=$('interactionPrompt');
  if(best){$('interactionLabel').textContent=best.label;prompt.classList.add('visible');}else prompt.classList.remove('visible');
}
function openModal(title,kicker,html,after) {
  state.paused=true;
  $('modalTitle').textContent=title; $('modalKicker').textContent=kicker; $('modalBody').innerHTML=html;
  $('modalShade').hidden=false;
  if(after) after();
}
function closeModal() { $('modalShade').hidden=true; state.paused=false; }
function openShop() {
  openModal('Kheda general store','VILLAGE · SHOP',`<p class="modal-copy">Fresh mustard seed for the coming season. Four handfuls are enough to get the first plot started.</p><div class="shop-item"><span class="seed-icon">✳</span><span><b>Mustard seed packet</b><small>4 seeds · ₹120</small></span><button id="buySeeds">BUY</button></div><div class="inventory-row"><span>Wallet</span><b>₹ ${state.money.toLocaleString('en-IN')}</b></div>`,()=>{
    $('buySeeds').addEventListener('click',()=>{
      if(state.money<120){showToast('You need a little more money for seeds.');return;}
      state.money-=120;state.seeds+=4;if(state.missionStage===0)state.missionStage=1;
      closeModal();updateHud();save();showToast('Seed packet tucked into your bag.','+4 MUSTARD');
    });
  });
}
function openPlot(index) {
  const plot=state.plots[index],info=plots[index];
  let description,action,disabled=false;
  if(!plot.ploughed){description='The dry topsoil is packed hard. A quick pass with the hand plough will open the furrows.';action='PLOUGH THIS FIELD';}
  else if(!plot.stage){description=state.seeds?`The furrows are ready. You have ${state.seeds} mustard seeds.`:'You need seed first. The village shop has mustard seed packets.';action=state.seeds?'SOW MUSTARD':'NO SEEDS · VISIT SHOP';disabled=!state.seeds;}
  else if(plot.stage===1){description='Freshly sown. The first green shoots need a little time and a little water.';action='CLOSE';}
  else if(plot.stage===2){description='The mustard is growing well. Rest through one more day, then check the crop.';action='CLOSE';}
  else{description='Golden mustard heads are ready to harvest. Bring the crop in while the weather is clear.';action='HARVEST MUSTARD';}
  openModal(info.title.toUpperCase(),`FARM · ${index===0?'NORTH':'SOUTH'} PLOT`,`<p class="modal-copy">${description}</p><div class="inventory-row"><span>Soil</span><b>${plot.ploughed?'PLOUGHED':'UNPLOUGHED'}</b></div><div class="inventory-row"><span>Crop</span><b>${!plot.stage?'EMPTY':['','SOWN','GROWING','MATURE'][plot.stage]}</b></div><button class="modal-action" id="plotAction" ${disabled?'disabled':''}>${action}</button>`,()=>{
    $('plotAction').addEventListener('click',()=>{
      if(plot.stage===1||plot.stage===2){closeModal();return;}
      if(!plot.ploughed){plot.ploughed=true;closeModal();showToast('The furrows are open and ready for seed.');save();return;}
      if(!plot.stage){if(!state.seeds)return;state.seeds--;plot.stage=1;if(state.missionStage===1)state.missionStage=2;closeModal();plots[index].refreshCrop();updateHud();save();showToast('Mustard sown. Let the field rest.');return;}
      if(plot.stage===3){plot.stage=0;state.produce++;closeModal();plots[index].refreshCrop();updateHud();save();showToast('Harvest collected. Take it to the mandi.','+1 MUSTARD');}
    });
  });
}
function openMandi() {
  const qty=state.produce,total=qty*400;
  openModal('Kheda mandi','VILLAGE · MARKET',`<p class="modal-copy">The buyer weighs your crop and pays today’s fair village rate.</p><div class="inventory-row"><span>Mustard harvest · ${qty} bag${qty===1?'':'s'}</span><b>₹ ${total}</b></div><button class="modal-action" id="sellCrop" ${qty?'':'disabled'}>${qty?`SELL HARVEST · ₹ ${total}`:'NOTHING TO SELL'}</button>`,()=>{
    $('sellCrop').addEventListener('click',()=>{
      if(!state.produce)return;state.money+=state.produce*400;state.produce=0;
      if(state.missionStage===2){state.missionStage=3;state.questComplete=true;showToast('First harvest sold. A good start for the family.','+₹400');}
      else showToast('Produce sold at the mandi.','+₹400');
      closeModal();updateHud();save();
    });
  });
}
function openInventory() {
  openModal('Arjun’s bag','INVENTORY',`<p class="modal-copy">A few things for the road and work waiting back at the farm.</p><div class="inventory-row"><span>Mustard seeds</span><b>× ${state.seeds}</b></div><div class="inventory-row"><span>Harvested mustard</span><b>× ${state.produce}</b></div><div class="inventory-row"><span>Wallet</span><b>₹ ${state.money.toLocaleString('en-IN')}</b></div>`);
}
function openJournal() {
  openModal('Arjun’s journal','CHAPTER 01 · THE WAY BACK',`<p class="modal-copy">“Home looks smaller than I remember. The work, though — there’s plenty of it.”</p><div class="inventory-row"><span>Family farm</span><b>${state.questComplete?'STABLE':'IN PROGRESS'}</b></div><div class="inventory-row"><span>Season</span><b>MONSOON</b></div><div class="inventory-row"><span>Crop state</span><b>${state.plots.some(p=>p.stage===3)?'READY TO HARVEST':state.plots.some(p=>p.stage>0)?'GROWING':'NOT SOWN'}</b></div>`);
}
function interact() {
  const target=state.interaction;
  if(!target){showToast('Move closer to a person or place.');return;}
  if(target.type==='shop')openShop();
  else if(target.type==='mandi')openMandi();
  else if(target.type==='plot')openPlot(target.index);
  else if(target.type==='home')advanceDay();
}
function advanceDay() {
  state.day++;state.timeMinutes=6*60+18;
  let changed=false;
  for(const p of state.plots)if(p.stage>0&&p.stage<3){p.stage++;changed=true;plots[state.plots.indexOf(p)].refreshCrop();}
  updateLighting();updateHud();save();showToast(changed?'A new morning. The mustard is growing.':'You rested through the night.','DAY '+String(state.day).padStart(2,'0'));
}

function updatePlayer(dt) {
  if(state.paused){player.vx*=.8;player.vz*=.8;return;}
  const keys=state.keys;
  let sx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+state.joyX;
  let sy=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+state.joyY;
  const len=Math.hypot(sx,sy);if(len>1){sx/=len;sy/=len;}
  state.running=keys.has('ShiftLeft')||keys.has('ShiftRight')||state.runTouch;
  const speed=player.speed*(state.running?1.52:1);
  const rightX=Math.cos(state.cameraYaw),rightZ=Math.sin(state.cameraYaw);
  const fwdX=Math.sin(state.cameraYaw),fwdZ=-Math.cos(state.cameraYaw);
  const dx=rightX*sx+fwdX*sy,dz=rightZ*sx+fwdZ*sy;
  const smoothing=1-Math.exp(-dt*(len?12:11));
  player.vx+=(dx*speed-player.vx)*smoothing;player.vz+=(dz*speed-player.vz)*smoothing;
  if(Math.abs(player.vx)<.015)player.vx=0;if(Math.abs(player.vz)<.015)player.vz=0;
  const ox=player.x,oz=player.z;
  const nx=clamp(player.x+player.vx*dt,-105,105),nz=clamp(player.z+player.vz*dt,-105,105);
  const blocked=(x,z)=>staticColliders.some(c=>Math.abs(x-c.x)<c.hx&&Math.abs(z-c.z)<c.hz);
  if(!blocked(nx,player.z))player.x=nx;else player.vx=0;
  if(!blocked(player.x,nz))player.z=nz;else player.vz=0;
  const moving=Math.hypot(player.vx,player.vz)>.08;
  if(moving){player.faceX=player.vx/Math.hypot(player.vx,player.vz);player.faceZ=player.vz/Math.hypot(player.vx,player.vz);avatar.root.rotation.y=Math.atan2(-player.faceX,-player.faceZ);}
  avatar.root.position.set(player.x,groundY(player.x,player.z),player.z);
  const t=performance.now()*.008, amount=moving?Math.min(1,Math.hypot(player.vx,player.vz)/4.6):0;
  avatar.legPivots[0].rotation.x=Math.sin(t)*.52*amount;avatar.legPivots[1].rotation.x=-Math.sin(t)*.52*amount;
  avatar.armPivots[0].rotation.x=-Math.sin(t)*.38*amount;avatar.armPivots[1].rotation.x=Math.sin(t)*.38*amount;
  avatar.body.position.y=moving?Math.abs(Math.sin(t*2))*.035*amount:Math.sin(performance.now()*.0013)*.012;
  if(moving)state.timeMinutes+=dt*1.65;
}
function updateCamera(dt) {
  const distance=state.quality==='ULTRA'?6.0:6.7;
  const targetX=player.x+Math.sin(state.cameraYaw)*distance;
  const targetZ=player.z+Math.cos(state.cameraYaw)*distance;
  const targetY=groundY(targetX,targetZ)+2.95+state.cameraPitch*1.3;
  const smooth=1-Math.exp(-dt*5.4);
  camera.position.x+=(targetX-camera.position.x)*smooth;
  camera.position.y+=(targetY-camera.position.y)*smooth;
  camera.position.z+=(targetZ-camera.position.z)*smooth;
  cameraTarget.set(player.x,groundY(player.x,player.z)+1.42,player.z);
  camera.lookAt(cameraTarget);
}

let hudTick=0, autosaveTick=0, lightingTick=0;
function frame() {
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.045);
  updatePlayer(dt);updateCamera(dt);nearestInteraction();
  hudTick+=dt;autosaveTick+=dt;lightingTick+=dt;
  if(hudTick>.2){updateHud();hudTick=0;}
  if(lightingTick>1){updateLighting();lightingTick=0;}
  if(autosaveTick>16){save();autosaveTick=0;}
  renderer.render(scene,camera);
}
updateHud();updateLighting();
const spawnCamera=new THREE.Vector3(player.x,groundY(player.x,player.z)+3,player.z+7.4);camera.position.copy(spawnCamera);camera.lookAt(player.x,groundY(player.x,player.z)+1.45,player.z);
requestAnimationFrame(frame);
setTimeout(()=>{ $('bootScreen').classList.add('ready');showToast('Welcome back to Kheda. The family farm needs a hand.'); },850);

window.addEventListener('keydown',e=>{
  const block=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];if(block.includes(e.code))e.preventDefault();
  state.keys.add(e.code);if(e.repeat)return;
  if(e.code==='KeyE'||e.code==='Enter')interact();
  if(e.code==='KeyI')openInventory();
  if(e.code==='KeyJ')openJournal();
  if(e.code==='KeyR'&&!state.paused)advanceDay();
  if(e.code==='Escape'){if(state.paused)closeModal();else save();}
});
window.addEventListener('keyup',e=>state.keys.delete(e.code));
window.addEventListener('blur',()=>{state.keys.clear();state.runTouch=false;});
$('modalClose').addEventListener('click',closeModal);
$('modalShade').addEventListener('click',e=>{if(e.target===$('modalShade'))closeModal();});
$('questCollapse').addEventListener('click',()=>$('questPanel').classList.toggle('collapsed'));
$('bagButton').addEventListener('click',openInventory);
$('journalButton').addEventListener('click',openJournal);
$('restButton').addEventListener('click',advanceDay);
$('touchUse').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
$('qualityButton').addEventListener('click',()=>{const next=(qualityLevels.indexOf(state.quality)+1)%qualityLevels.length;state.quality=qualityLevels[next];setGraphics();showToast(`Graphics set to ${state.quality}.`);});

let lookPointer=null,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;state.cameraYaw-=dx*.0045;state.cameraPitch=clamp(state.cameraPitch+dy*.0015,-.08,.58);});
const stopLook=e=>{if(e.pointerId===lookPointer)lookPointer=null;};canvas.addEventListener('pointerup',stopLook);canvas.addEventListener('pointercancel',stopLook);canvas.addEventListener('contextmenu',e=>e.preventDefault());
let stickPointer=null;
$('touchStick').addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;$('touchStick').setPointerCapture(stickPointer);moveStick(e);});
$('touchStick').addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});
function moveStick(e){const r=$('touchStick').getBoundingClientRect();let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const max=33,d=Math.hypot(dx,dy);if(d>max){dx=dx/d*max;dy=dy/d*max;}state.joyX=dx/max;state.joyY=-dy/max;$('stickKnob').style.transform=`translate(${dx}px,${dy}px)`;}
function releaseStick(e){if(e.pointerId===stickPointer){stickPointer=null;state.joyX=state.joyY=0;$('stickKnob').style.transform='translate(0,0)';}}
$('touchStick').addEventListener('pointerup',releaseStick);$('touchStick').addEventListener('pointercancel',releaseStick);
$('touchRun').addEventListener('pointerdown',e=>{e.preventDefault();state.runTouch=true;});
['pointerup','pointercancel','pointerleave'].forEach(type=>$('touchRun').addEventListener(type,()=>state.runTouch=false));
window.addEventListener('pagehide',save);

// Open-field crop colors, natural shadows and camera exposure follow the world clock.
// The mobile quality selector trades resolution/shadow cost for heat and battery headroom.
