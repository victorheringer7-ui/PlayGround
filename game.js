import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

(() => {
  const canvas = document.querySelector('#game');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c99c68');
  scene.fog = new THREE.Fog('#c99c68', 420, 1500);
  const camera3d = new THREE.PerspectiveCamera(54, 1, .1, 2400);
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const pointer = new THREE.Vector2();
  const aimPoint = new THREE.Vector3();
  const actorMeshes = {player:null,enemies:[]};
  let groundMesh, cityGroup, effectsGroup, aimValid = false;
  const markerMeshes = new Map();
  let goalBeacon;
  const startScreen = document.querySelector('#start-screen');
  const endScreen = document.querySelector('#end-screen');
  const campaignScreen = document.querySelector('#campaign-screen');
  const toast = document.querySelector('#toast');
  const healthBar = document.querySelector('#health-bar');
  const healthValue = document.querySelector('#health-value');
  const ammoValue = document.querySelector('#ammo-value');
  const relicCount = document.querySelector('#relic-count');
  const objectiveCheck = document.querySelector('#objective-check');
  const locationTag = document.querySelector('#location-tag');
  const W = 2400, H = 1600;
  let vw = 0, vh = 0, dpr = 1, last = 0, running = false, ended = false;
  let camera = {x: 0, y: 0}, mouse = {x: innerWidth / 2, y: innerHeight / 2};
  let keys = Object.create(null), shots = [], particles = [], toastTimer = 0;
  let state, campaignPending = false;
  const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rocks = [], plants = [], dust = [];
  for (let i = 0; i < 245; i++) {
    const x = 35 + rand(i + 2) * (W - 70), y = 55 + rand(i + 193) * (H - 110);
    if (y > 690 && y < 900 && x < 2070) continue;
    rocks.push({x, y, r: 5 + rand(i + 320) * 19, rot: rand(i + 8) * 6, shade: rand(i + 72)});
  }
  for (let i = 0; i < 155; i++) plants.push({x: rand(i + 700) * W, y: rand(i + 999) * H, s: .6 + rand(i + 1200) * 1.2, rot: rand(i + 777) * 6});
  const sites = [{x: 570, y: 540, name: 'PEDRA DO VENTO'}, {x: 1145, y: 1110, name: 'THE OLD WELL'}, {x: 1630, y: 475, name: 'BANDIT CAMP'}];
  const chapters = [
    {roman:'I', title:'THE LAST TRAIN', kicker:'A STOLEN SEAL', missionTitle:'THE LAST<br><em>TRAIN</em>', copy:'Recover a stolen seal and beat the raiders to Santa Luzia station.', objective:'Find the trail clues', noun:'clues', type:'items', markers:sites, start:{x:155,y:800}, goal:{x:2110,y:800}, goalName:'Reach Santa Luzia', goalHint:'Follow the trail east', location:'CAATINGA', enemies:[[490,580],[700,485],[1040,1050],[1240,1160],[1515,455],[1740,530],[1850,790]]},
    {roman:'II', title:'A DROUGHT’S DEBT', kicker:'WATER FOR THE LIVING', missionTitle:'A DROUGHT’S<br><em>DEBT</em>', copy:'Carry medicine and water to the people at the old well before the dry season takes another life.', objective:'Gather the supply bundles', noun:'bundles', type:'items', markers:[{x:570,y:540},{x:1630,y:475},{x:1860,y:1110}], start:{x:350,y:1040}, goal:{x:1145,y:1110}, goalName:'Deliver them at the well', goalHint:'Meet the families by the well', location:'THE OLD WELL', enemies:[[800,740],[1015,980],[1360,1200],[1550,950]]},
    {roman:'III', title:'A NAME IN ASH', kicker:'THE LAND REMEMBERS', missionTitle:'A NAME IN<br><em>ASH</em>', copy:'A burned ledger points to the men who profited from the drought. Break their hold on the ridge.', objective:'Drive off the hired guns', noun:'raiders', type:'clear', markers:[], start:{x:1340,y:730}, goal:{x:1630,y:475}, goalName:'Search the camp', goalHint:'Reach the ridge camp', location:'BANDIT COUNTRY', enemies:[[1515,455],[1740,530],[1850,790],[1400,320],[1870,350]]},
    {roman:'IV', title:'THE SALT ROAD', kicker:'NO SAFE COUNTRY', missionTitle:'THE SALT<br><em>ROAD</em>', copy:'Take the telegraph pages across the badlands. Every patrol on this road has been paid to stop you.', objective:'Recover the telegram pages', noun:'pages', type:'items', markers:[{x:570,y:540},{x:1145,y:1110},{x:1630,y:475}], start:{x:2050,y:1090}, goal:{x:270,y:800}, goalName:'Reach Pedra do Vento', goalHint:'Head west across the trail', location:'THE SALT ROAD', enemies:[[1860,1080],[1540,1280],[1260,810],[900,520],[520,1080],[380,730]]},
    {roman:'V', title:'A QUIET CROSSING', kicker:'WHEN THE WHISTLE CALLS', missionTitle:'A QUIET<br><em>CROSSING</em>', copy:'Hold the crossing until the last families board. Then leave this country on your own terms.', objective:'Hold until the train arrives', noun:'seconds', type:'survive', duration:36, markers:[], start:{x:1760,y:800}, goal:{x:2110,y:800}, goalName:'Board at Santa Luzia', goalHint:'Survive, then reach the station', location:'SANTA LUZIA STATION', enemies:[[1560,415],[1705,520],[1860,690],[1900,950],[1510,1080],[1320,800]]}
  ];
  let chapterIndex = 0;
  const mission = () => chapters[chapterIndex];
  const cover = [
    {x: 535, y: 510, w: 105, h: 65, type: 'rock'}, {x: 1090, y: 1070, w: 110, h: 70, type: 'well'},
    {x: 1560, y: 415, w: 100, h: 58, type: 'tent'}, {x: 1705, y: 480, w: 85, h: 56, type: 'tent'},
    {x: 2020, y: 680, w: 170, h: 100, type: 'station'}, {x: 2025, y: 860, w: 138, h: 75, type: 'saloon'},
    {x: 2145, y: 665, w: 100, h: 55, type: 'shed'}
  ];
  const cityBuildings = [];
  for (let row=0; row<9; row++) for (let col=0; col<7; col++) {
    const x=1655+col*100, y=370+row*125;
    if (x>1940 && x<2160 && y>735 && y<875) continue;
    const building={x,y,w:58+(col%3)*5,h:48+(row%2)*6,type:(col===3&&row===4)?'church':(col===2&&row===3)?'market':'house',tone:(row+col)%3};
    const overlaps=cover.some(o=>Math.abs(x-o.x)<(building.w+o.w)/2+8&&Math.abs(y-o.y)<(building.h+o.h)/2+8);
    if(!overlaps)cityBuildings.push(building);
  }
  cityBuildings.push({x:2155,y:800,w:82,h:116,type:'church',tone:0});
  cityBuildings.push({x:1915,y:800,w:90,h:60,type:'market',tone:1});
  cover.push(...cityBuildings);
  function freshState() {
    const chapter = mission();
    const enemyHealth = chapterIndex > 1 ? 3 : 2;
    return {player: {x: chapter.start.x, y: chapter.start.y, vx:0, vy:0, angle: 0, hp: 100, ammo: 6, reserve: 24, invuln: 0, stride: 0},
      enemies: chapter.enemies.map(([x,y],i) => ({x,y,vx:0,vy:0,hp:enemyHealth,cd:.5+(i%3)*.55,angle:0})),
      clues: chapter.markers.map(() => false), time:0, kills:0, near:'', shake:0, fireCooldown:0};
  }
  state = freshState();
  function mat(color, roughness=.9){return new THREE.MeshStandardMaterial({color,roughness});}
  const mats={soil:mat('#a97950'),road:mat('#7d6248'),street:mat('#695847'),stone:mat('#75614b'),wood:mat('#79543a'),plaster:mat('#c4a47d'),roof:mat('#754d35'),dark:mat('#30251d'),cloth:mat('#263c36'),red:mat('#9e4733'),skin:mat('#c99667'),gold:mat('#e5ba79'),leaf:mat('#667044'),iron:mat('#34312c'),white:mat('#e5d2ad')};
  function box(parent,w,h,d,material,x=0,y=0,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function addBuilding(b){
    const group=new THREE.Group();group.position.set(b.x,0,b.y);scene.add(group);
    const w=b.w,h=b.h;
    if(b.type==='rock'){
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(w,h)*.42,0),mats.stone);rock.scale.set(1,.55,.72);rock.position.y=8;rock.castShadow=true;group.add(rock);return;
    }
    if(b.type==='well'){
      const base=new THREE.Mesh(new THREE.CylinderGeometry(23,26,13,12),mats.stone);base.position.y=7;group.add(base);
      const hole=new THREE.Mesh(new THREE.CylinderGeometry(15,15,2,12),mats.dark);hole.position.y=14;group.add(hole);
      box(group,4,26,4,mats.wood,30,20,-h/2+7);box(group,4,26,4,mats.wood,48,20,-h/2+7);box(group,24,4,4,mats.wood,39,33,-h/2+7);return;
    }
    const church=b.type==='church', station=b.type==='station', tent=b.type==='tent';
    const wall=church?mat('#d6c1a0'):b.type==='market'?mat('#b88f62'):b.type==='house'?mat(['#b78d68','#d0b38c','#a97c5b'][b.tone||0]):station?mat('#89583e'):mats.wood;
    const width=Math.max(24,w*.88),depth=Math.max(22,h*.88),height=church?47:station?28:tent?17:24+(b.tone||0)*2;
    if(tent){const canopy=new THREE.Mesh(new THREE.ConeGeometry(Math.max(width,depth)*.63,23,4),mats.wood);canopy.position.y=12;canopy.rotation.y=Math.PI/4;canopy.castShadow=true;group.add(canopy);return;}
    box(group,width,height,depth,wall,0,height/2,0);
    const roofMaterial=station?mat('#874b34'):mats.roof;
    const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(width,depth)*.78,church?16:10,4),roofMaterial);roof.position.y=height+(church?5:3);roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);
    box(group,church?8:7,height*.53,2,mats.dark,0,height*.26,depth/2+1);
    for(const side of [-1,1]) for(const front of [-1,1]){
      const win=box(group,5,7,1,mats.dark,side*width*.29, height*.58,front*(depth/2+.7));
      win.material=mat('#41352c');
    }
    if(church){box(group,9,24,9,wall,0,height+10,0);const cross=box(group,2,15,2,mats.gold,0,height+27,0);box(group,11,2,2,mats.gold,0,height+29,0);}
    if(station){box(group,width+22,2,4,mats.iron,0,1,depth+24);for(let i=-3;i<=3;i++)box(group,3,3,22,mats.wood,i*14,2,depth+24);}
    if(b.type==='market'){box(group,width+10,3,depth+10,mat('#b47e50'),0,height+2,0);}
  }
  function makePerson(isPlayer){
    const group=new THREE.Group();
    const shirt=isPlayer?mats.cloth:mats.red;
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(7,13,4,8),shirt);body.position.y=14;body.castShadow=true;group.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(5.5,12,10),mats.skin);head.position.set(0,27,0);head.castShadow=true;group.add(head);
    const hat=new THREE.Mesh(new THREE.CylinderGeometry(11,11,2,12),mats.dark);hat.position.y=32;hat.castShadow=true;group.add(hat);
    const crown=new THREE.Mesh(new THREE.CylinderGeometry(6,7,6,10),mats.dark);crown.position.y=35;group.add(crown);
    box(group,3,3,19,mats.iron,5,19,9);
    box(group,3,3,14,mats.wood,5,19,17);
    for(const side of [-1,1]){const leg=box(group,4,10,5,mats.dark,side*3,5,0);}
    return group;
  }
  function buildWorld(){
    scene.add(new THREE.HemisphereLight('#f8dfb4','#57422e',2.05));
    const sun=new THREE.DirectionalLight('#ffe3b5',3.1);sun.position.set(-250,430,-180);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1250;sun.shadow.camera.right=1250;sun.shadow.camera.top=1050;sun.shadow.camera.bottom=-1050;sun.shadow.bias=-.0003;scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(W,H,96,64),mats.soil);ground.rotation.x=-Math.PI/2;ground.position.set(W/2,-1,H/2);ground.receiveShadow=true;scene.add(ground);groundMesh=ground;
    // Winding wagon road as a true raised, textured 3D ribbon.
    const roadPoints=[];for(let i=0;i<=80;i++){const t=i/80;roadPoints.push(new THREE.Vector3(-80+t*2380,0,810+Math.sin(t*Math.PI*2)*65));}
    const road=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(roadPoints),120,27,6,false),mats.road);road.position.y=.2;scene.add(road);
    // Ouro Preto's compact hill-town grid, plazas and long stone lanes.
    cityGroup=new THREE.Group();scene.add(cityGroup);
    const cityBase=new THREE.Mesh(new THREE.BoxGeometry(790,1,1190),mat('#98836d'));cityBase.position.set(1995,-.35,915);cityGroup.add(cityBase);
    for(let i=0;i<7;i++){const lane=new THREE.Mesh(new THREE.BoxGeometry(30,.4,1190),mats.street);lane.position.set(1705+i*100,.25,915);cityGroup.add(lane);}
    for(let i=0;i<10;i++){const lane=new THREE.Mesh(new THREE.BoxGeometry(790,.4,34),mats.street);lane.position.set(1995,.27,433+i*125);cityGroup.add(lane);}
    for(const b of cover)addBuilding(b);
    for(let i=0;i<rocks.length;i++){const r=rocks[i];const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(r.r,0),mats.stone);mesh.position.set(r.x,r.r*.35,r.y);mesh.scale.set(1,.62,.75);mesh.rotation.set(r.rot,r.rot*.4,0);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
    for(const plant of plants){if(plant.x>1600&&plant.x<2400&&plant.y>320&&plant.y<1510)continue;const group=new THREE.Group();group.position.set(plant.x,0,plant.y);group.scale.setScalar(plant.s);scene.add(group);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(1.7,2.4,19,5),mats.leaf);trunk.position.y=9.5;group.add(trunk);for(const side of [-1,1]){const arm=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,9,5),mats.leaf);arm.position.set(side*5,10,0);arm.rotation.z=side*-.8;group.add(arm);}}
    const markerMat=new THREE.MeshStandardMaterial({color:'#f1ca83',emissive:'#8b531e',emissiveIntensity:1.4,metalness:.25,roughness:.4});
    effectsGroup=new THREE.Group();scene.add(effectsGroup);
    const uniqueMarkers=new Map(chapters.flatMap(c=>c.markers).map(m=>[`${m.x},${m.y}`,m]));
    for(const marker of uniqueMarkers.values()){
      const g=new THREE.Group();g.position.set(marker.x,1,marker.y);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(14,1.3,8,24),markerMat);ring.rotation.x=Math.PI/2;g.add(ring);
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(5),markerMat);gem.position.y=10;g.add(gem);g.userData.marker=marker;
      markerMeshes.set(`${marker.x},${marker.y}`,g);effectsGroup.add(g);
    }
    goalBeacon=new THREE.Group();
    const beacon=new THREE.Mesh(new THREE.CylinderGeometry(2,2,64,8),new THREE.MeshBasicMaterial({color:'#ffdc9b',transparent:true,opacity:.36}));beacon.position.y=32;goalBeacon.add(beacon);
    const goalRing=new THREE.Mesh(new THREE.TorusGeometry(18,1.6,8,32),markerMat);goalRing.rotation.x=Math.PI/2;goalBeacon.add(goalRing);effectsGroup.add(goalBeacon);
  }
  function ensureActors(){
    if(!actorMeshes.player){actorMeshes.player=makePerson(true);scene.add(actorMeshes.player);}
    while(actorMeshes.enemies.length<state.enemies.length){const mesh=makePerson(false);scene.add(mesh);actorMeshes.enemies.push(mesh);}
    while(actorMeshes.enemies.length>state.enemies.length){scene.remove(actorMeshes.enemies.pop());}
  }
  function resize() {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw,vh,false);
    camera3d.aspect=vw/Math.max(1,vh);camera3d.updateProjectionMatrix();
  }
  buildWorld(); ensureActors();
  addEventListener('resize', resize); resize();
  function showToast(message) {
    toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
  function configureMission() {
    const c = mission();
    document.querySelector('#chapter-label').textContent = 'CHAPTER ' + c.roman;
    document.querySelector('#chapter-name').textContent = c.title;
    document.querySelector('#contract-id').textContent = String(chapterIndex + 1).padStart(2,'0') + ' / ' + String(chapters.length).padStart(2,'0');
    document.querySelector('#mission-title').innerHTML = c.missionTitle;
    document.querySelector('#mission-copy').textContent = c.copy;
    document.querySelector('#objective-label').firstChild.nodeValue = c.objective + ' ';
    document.querySelector('#goal-label').firstChild.nodeValue = c.goalName + ' ';
    document.querySelector('#goal-label').querySelector('small').textContent = c.goalHint;
    document.querySelector('#reward-value').textContent = c.roman;
  }
  function startGame() {
    if (running) return;
    chapterIndex = 0; campaignPending = false; configureMission();
    state = freshState(); shots = []; particles = []; ended = false; running = true;
    startScreen.classList.add('hidden'); endScreen.classList.add('hidden'); campaignScreen.classList.add('hidden');
    document.querySelector('#bottom-hint').style.opacity = '1';
    updateHud(); last = performance.now();
  }
  function continueCampaign() {
    if (!campaignPending) return;
    campaignPending = false; chapterIndex++;
    configureMission(); state = freshState(); shots = []; particles = [];
    campaignScreen.classList.add('hidden'); running = true; ended = false;
    updateHud(); last = performance.now(); showToast('CHAPTER ' + mission().roman + ' · ' + mission().title);
  }
  function finishChapter() {
    if (chapterIndex >= chapters.length - 1) { endGame(true); return; }
    running = false; campaignPending = true;
    const next = chapters[chapterIndex + 1];
    document.querySelector('#campaign-kicker').textContent = 'CHAPTER ' + next.roman + ' · ' + next.title;
    document.querySelector('#campaign-title').innerHTML = next.missionTitle;
    document.querySelector('#campaign-copy').textContent = next.copy;
    campaignScreen.classList.remove('hidden');
  }
  function endGame(win) {
    if (ended) return; ended = true; running = false;
    document.querySelector('#end-title').innerHTML = win ? 'A NEW<br><em>HORIZON</em>' : 'THE SERTÃO<br><em>CLAIMS ALL</em>';
    document.querySelector('#end-copy').textContent = win ? 'The families reach Ouro Preto as the first light catches the church towers. You leave the old trail behind; the choices made here will outlast the ride.' : 'The dust settles over the trail. The sertão is patient — and there is always another ride to take.';
    endScreen.classList.remove('hidden');
  }
  document.querySelector('#start-button').addEventListener('click', startGame);
  document.querySelector('#restart-button').addEventListener('click', startGame);
  document.querySelector('#continue-button').addEventListener('click', continueCampaign);
  document.querySelector('#pause-button').addEventListener('click', () => {
    if (!running) return;
    running = false; showToast('PAUSED · PRESS ENTER TO RIDE');
  });
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Enter' && campaignPending) continueCampaign();
    else if (e.code === 'Enter' && !running && !ended) startGame();
    if (e.code === 'Escape' && running) { running = false; showToast('PAUSED · PRESS ENTER TO RIDE'); }
    if (e.code === 'KeyR' && running) reload();
  });
  addEventListener('keyup', e => keys[e.code] = false);
  addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
    const crosshair = document.querySelector('#crosshair');
    crosshair.style.left = e.clientX+'px'; crosshair.style.top = e.clientY+'px';
  });
  addEventListener('mousedown', e => { if (e.button === 0 && running) shoot(); });
  addEventListener('contextmenu', e => e.preventDefault());
  function reload() {
    const p = state.player; if (p.ammo >= 6 || p.reserve <= 0) return;
    const amount = Math.min(6 - p.ammo, p.reserve); p.ammo += amount; p.reserve -= amount; updateHud(); showToast('RELOADED · ' + p.ammo + ' ROUNDS');
  }
  function updateCameraAndAim(){
    const p=state.player;
    // Over-the-shoulder follow camera: the game plane is X/Z and the player faces p.angle.
    const forwardX=Math.cos(p.angle),forwardZ=Math.sin(p.angle);
    const shoulder=24, distance=165;
    camera3d.position.set(
      p.x-forwardX*distance+forwardZ*shoulder,
      108,
      p.y-forwardZ*distance-forwardX*shoulder
    );
    camera3d.lookAt(p.x+forwardX*92,24,p.y+forwardZ*92);
    camera3d.updateMatrixWorld();
    raycaster.setFromCamera(pointer,camera3d);
    aimValid=raycaster.ray.intersectPlane(groundPlane,aimPoint)!==null;
    if(!aimValid)aimPoint.set(p.x+forwardX*500,0,p.y+forwardZ*500);
  }
  function shoot() {
    const p = state.player;
    if (state.fireCooldown > 0) return;
    if (p.ammo <= 0) { showToast('EMPTY · PRESS R TO RELOAD'); state.fireCooldown = .3; return; }
    updateCameraAndAim();
    p.ammo--; state.fireCooldown = .28;
    const a = Math.atan2(aimPoint.z - p.y, aimPoint.x - p.x); p.angle = a;
    shots.push({x:p.x + Math.cos(a)*21,y:p.y + Math.sin(a)*21,vx:Math.cos(a)*790,vy:Math.sin(a)*790,life:.8,enemy:false});
    state.shake = 2.4; updateHud();
    for (let i=0;i<5;i++) particles.push({x:p.x+Math.cos(a)*25,y:p.y+Math.sin(a)*25,vx:(Math.random()-.5)*95+Math.cos(a)*60,vy:(Math.random()-.5)*95+Math.sin(a)*60,life:.18+Math.random()*.16,color:'#f9d487',size:2+Math.random()*2});
  }
  function objectiveReady() {
    const c = mission();
    if (c.type === 'items') return state.clues.every(Boolean);
    if (c.type === 'clear') return state.enemies.every(e => e.hp <= 0);
    return state.time >= c.duration;
  }
  function updateHud() {
    const p = state.player; healthBar.style.width = p.hp + '%'; healthValue.textContent = Math.ceil(p.hp);
    ammoValue.textContent = p.ammo; document.querySelector('#reserve-value').textContent = p.reserve;
    if (mission().type === 'items') {
      relicCount.textContent = state.clues.filter(Boolean).length + ' / ' + state.clues.length + ' ' + mission().noun;
    } else if (mission().type === 'clear') {
      const remaining = state.enemies.filter(e => e.hp > 0).length;
      relicCount.textContent = (state.enemies.length - remaining) + ' / ' + state.enemies.length + ' driven off';
    } else {
      relicCount.textContent = Math.min(Math.ceil(state.time), mission().duration) + ' / ' + mission().duration + ' sec';
    }
    objectiveCheck.textContent = objectiveReady() ? '✓' : '○';
    document.querySelector('#goal-check').textContent = Math.hypot(mission().goal.x-state.player.x,mission().goal.y-state.player.y)<85 && objectiveReady() ? '✓' : '○';
  }
  function update(dt) {
    if (!running) return;
    state.time += dt; state.fireCooldown = Math.max(0,state.fireCooldown-dt); state.shake = Math.max(0,state.shake-dt*15);
    const p = state.player; p.invuln = Math.max(0,p.invuln-dt);
    let dx = (keys.KeyD||keys.ArrowRight?1:0) - (keys.KeyA||keys.ArrowLeft?1:0);
    let dy = (keys.KeyS||keys.ArrowDown?1:0) - (keys.KeyW||keys.ArrowUp?1:0);
    const mag = Math.hypot(dx,dy) || 1, moving = !!(dx||dy);
    dx /= mag; dy /= mag;
    // Momentum-based movement: acceleration, drag, and a distinct heavier sprint.
    const sprinting = keys.ShiftLeft||keys.ShiftRight;
    const accel = sprinting ? 760 : 920;
    p.vx += dx * accel * dt; p.vy += dy * accel * dt;
    const drag = Math.exp(-(moving ? 3.8 : 7.5)*dt);
    p.vx *= drag; p.vy *= drag;
    const maxSpeed = sprinting ? 265 : 185;
    const velocity = Math.hypot(p.vx,p.vy);
    if(velocity>maxSpeed){p.vx=p.vx/velocity*maxSpeed;p.vy=p.vy/velocity*maxSpeed;}
    let nextX = p.x + p.vx*dt, nextY = p.y + p.vy*dt;
    // Solid collision bodies for rocks, tents, and the station settlement.
    for(const obj of cover){
      const cx=obj.x,cy=obj.y,rx=obj.w*.5+12,ry=obj.h*.5+12;
      if(Math.abs(nextX-cx)<rx && Math.abs(nextY-cy)<ry){
        const ox=nextX-cx,oy=nextY-cy,px=rx-Math.abs(ox),py=ry-Math.abs(oy);
        if(px<py){nextX=cx+Math.sign(ox||1)*rx;p.vx=0;}else{nextY=cy+Math.sign(oy||1)*ry;p.vy=0;}
      }
    }
    p.x = Math.max(28,Math.min(W-28,nextX)); p.y = Math.max(40,Math.min(H-40,nextY));
    if (Math.hypot(p.vx,p.vy)>12) p.stride += dt*Math.hypot(p.vx,p.vy)*.07;
    updateCameraAndAim();
    p.angle = Math.atan2(aimPoint.z-p.y,aimPoint.x-p.x);
    const chapter = mission();
    chapter.markers.forEach((s,i) => {
      if (!state.clues[i] && Math.hypot(s.x-p.x,s.y-p.y)<57) {
        state.clues[i]=true; updateHud();
        showToast(chapter.noun.toUpperCase() + ' FOUND · ' + (state.clues.filter(Boolean).length) + ' / ' + state.clues.length);
        if (state.clues.every(Boolean)) showToast('OBJECTIVE COMPLETE · ' + chapter.goalName.toUpperCase());
      }
    });
    if (objectiveReady() && Math.hypot(chapter.goal.x-p.x,chapter.goal.y-p.y)<85) finishChapter();
    const area = p.x < 850 ? 'CAATINGA' : p.x < 1450 ? 'THE OLD WELL' : p.x < 1930 ? 'BANDIT COUNTRY' : 'OURO PRETO';
    if (area !== state.near) { state.near=area; locationTag.innerHTML = '<span class="location-pin">⌖</span><span>'+area+'<br><small>'+ (area==='CAATINGA'?'THE DRY COUNTRY':area==='BANDIT COUNTRY'?'NO LAW THIS SIDE':area==='OURO PRETO'?'MINAS GERAIS · BRAZIL':'SERTÃO · BRAZIL')+'</small></span>'; }
    for (const e of state.enemies) {
      if (e.hp<=0) continue;
      const ex=p.x-e.x, ey=p.y-e.y, d=Math.hypot(ex,ey); e.angle=Math.atan2(ey,ex); e.cd-=dt;
      if (d<440 && d>115) { e.vx += Math.cos(e.angle)*145*dt; e.vy += Math.sin(e.angle)*145*dt; }
      e.vx*=Math.exp(-4.5*dt);e.vy*=Math.exp(-4.5*dt);
      let enx=e.x+e.vx*dt,eny=e.y+e.vy*dt;
      for(const obj of cover)if(Math.abs(enx-obj.x)<obj.w*.5+10&&Math.abs(eny-obj.y)<obj.h*.5+10){enx=e.x;eny=e.y;e.vx*=-.2;e.vy*=-.2;}
      e.x=enx;e.y=eny;
      if (d<430 && d>60 && e.cd<=0) { e.cd=1.6+Math.random()*1.25; const a=Math.atan2(p.y-e.y,p.x-e.x); shots.push({x:e.x,y:e.y,vx:Math.cos(a)*290,vy:Math.sin(a)*290,life:1.8,enemy:true}); }
      if (d<22) { p.hp-=12*dt; p.invuln=.2; }
    }
    // Gentle enemy separation prevents characters from piling into one sprite.
    for(let i=0;i<state.enemies.length;i++)for(let j=i+1;j<state.enemies.length;j++){
      const a=state.enemies[i],b=state.enemies[j];if(a.hp<=0||b.hp<=0)continue;
      const vx=b.x-a.x,vy=b.y-a.y,d=Math.hypot(vx,vy)||1;
      if(d<27){const push=(27-d)*.5;a.x-=vx/d*push;a.y-=vy/d*push;b.x+=vx/d*push;b.y+=vy/d*push;}
    }
    for (let i=shots.length-1;i>=0;i--) {
      const b=shots[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
      if (!b.enemy) {
        let hit=false;
        for (const e of state.enemies) if(e.hp>0 && Math.hypot(e.x-b.x,e.y-b.y)<19) {e.hp--;hit=true; if(e.hp<=0){state.kills++; showToast('BANDIT DOWN');} for(let k=0;k<6;k++)particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life:.28+Math.random()*.3,color:'#a64832',size:2+Math.random()*3});break;}
        if(hit)b.life=0;
      } else if (Math.hypot(p.x-b.x,p.y-b.y)<17 && p.invuln<=0) { p.hp-=14; p.invuln=.75; state.shake=7; b.life=0; showToast('HIT · KEEP MOVING'); updateHud(); }
      if (b.life<=0 || b.x<0||b.x>W||b.y<0||b.y>H) shots.splice(i,1);
    }
    for(let i=particles.length-1;i>=0;i--){const a=particles[i];a.x+=a.vx*dt;a.y+=a.vy*dt;a.vx*=.96;a.vy*=.96;a.life-=dt;if(a.life<=0)particles.splice(i,1);}
    if (p.hp<=0) endGame(false);
    updateHud();
  }
  const projectileGeometry=new THREE.SphereGeometry(3,8,6);
  const projectileMaterials={friendly:new THREE.MeshBasicMaterial({color:'#ffdf9a'}),hostile:new THREE.MeshBasicMaterial({color:'#db603e'})};
  const particleGeometry=new THREE.SphereGeometry(1,6,5);
  function render(){
    updateCameraAndAim();
    const p=state.player, shake=state.shake||0;
    if(shake>0){camera3d.position.x+=(Math.random()-.5)*shake;camera3d.position.z+=(Math.random()-.5)*shake;}
    actorMeshes.player.position.set(p.x,Math.sin(p.stride)*1.5,p.y);
    actorMeshes.player.visible=!(p.invuln>0&&Math.floor(state.time*18)%2===0);
    actorMeshes.player.rotation.y=Math.PI/2-p.angle;
    for(let i=0;i<actorMeshes.enemies.length;i++){
      const mesh=actorMeshes.enemies[i],enemy=state.enemies[i];
      mesh.visible=enemy.hp>0;
      if(enemy.hp>0){mesh.position.set(enemy.x,0,enemy.y);mesh.rotation.y=Math.PI/2-enemy.angle;}
    }
    const activeMarkers=new Set();
    mission().markers.forEach((marker,i)=>{
      const key=`${marker.x},${marker.y}`,mesh=markerMeshes.get(key);
      if(!mesh)return;
      activeMarkers.add(key);mesh.visible=!state.clues[i];
      const pulse=1+.12*Math.sin(state.time*4+i);mesh.scale.setScalar(pulse);mesh.position.y=2+Math.sin(state.time*2+i)*2;
    });
    for(const [key,mesh] of markerMeshes)if(!activeMarkers.has(key))mesh.visible=false;
    goalBeacon.position.set(mission().goal.x,0,mission().goal.y);
    goalBeacon.visible=objectiveReady();
    goalBeacon.children[1].scale.setScalar(1+.15*Math.sin(state.time*4));
    for(const shot of shots){
      if(!shot.mesh){shot.mesh=new THREE.Mesh(projectileGeometry,shot.enemy?projectileMaterials.hostile:projectileMaterials.friendly);scene.add(shot.mesh);}
      shot.mesh.position.set(shot.x,8,shot.y);shot.mesh.scale.setScalar(shot.enemy?1:1.15);
    }
    const liveShots=new Set(shots);
    for(const shot of projectileMeshes)if(!liveShots.has(shot.data)){scene.remove(shot.mesh);projectileMeshes.delete(shot);}
    for(const shot of shots)if(!projectileMeshes.has(shot)){projectileMeshes.add({data:shot,mesh:shot.mesh});}
    for(const particle of particles){
      if(!particle.mesh){particle.mesh=new THREE.Mesh(particleGeometry,new THREE.MeshBasicMaterial({color:particle.color,transparent:true,opacity:.9}));scene.add(particle.mesh);}
      particle.mesh.position.set(particle.x,5,particle.y);particle.mesh.scale.setScalar(particle.size);particle.mesh.material.opacity=Math.min(1,particle.life*3);
    }
    const liveParticles=new Set(particles);
    for(const particle of particleMeshes)if(!liveParticles.has(particle.data)){scene.remove(particle.mesh);particle.mesh.material.dispose();particleMeshes.delete(particle);}
    for(const particle of particles)if(!particleMeshes.has(particle)){particleMeshes.add({data:particle,mesh:particle.mesh});}
    renderer.render(scene,camera3d);
  }
  const projectileMeshes=new Set(),particleMeshes=new Set();
  function frame(now){
    const dt=Math.min(.033,Math.max(0,(now-last)/1000||0));last=now;
    update(dt);render();requestAnimationFrame(frame);
  }
  document.querySelector('#bottom-hint').style.opacity='0';
  requestAnimationFrame(frame);
})();
