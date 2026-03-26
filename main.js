import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/GLTFLoader.js";

//////////////////////////////////////////////////////
// SCENE
//////////////////////////////////////////////////////

const staminaBar = document.getElementById("staminaBar");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb,50,600);

const colliders = [];
const worldObjects = [];

const gridSize = 20;
const collisionGrid = new Map();

const groundRay = new THREE.Raycaster();

let windTime = 0;
let gun;

const treeCount = 2000;
const trunkGeometry = new THREE.CylinderGeometry(1.2,1.5,14,8);
trunkGeometry.translate(0,7,0);

const trunkMaterial = new THREE.MeshStandardMaterial({
color:0x6b4f2a
});

const trunkMesh = new THREE.InstancedMesh(
trunkGeometry,
trunkMaterial,
treeCount
);

scene.add(trunkMesh);


const treeGeometry = new THREE.ConeGeometry(15,36,17);
treeGeometry.translate(0,32,0);

const treeMaterial = new THREE.MeshStandardMaterial({
color:0x1f7a1f
});



const treeMesh = new THREE.InstancedMesh(
treeGeometry,
treeMaterial,
treeCount
);

scene.add(treeMesh);

//////////////////////////////////////////////////////
// PLAYER HEALTH
//////////////////////////////////////////////////////

let playerHealth = 100;
let maxHealth = 100;

function damagePlayer(amount){

playerHealth = Math.max(0, playerHealth - amount);

updateHealthBar();

if(playerHealth <= 0){
alert("You Died");
location.reload();
}

}

//////////////////////////////////////////////////////
// ENEMIES
//////////////////////////////////////////////////////

const enemies = [];

//////////////////////////////////////////////////////
// CHARACTER MODEL
//////////////////////////////////////////////////////

let character;
let mixer;
let actions = {};
let activeAction;

const loader = new GLTFLoader();
const clock = new THREE.Clock();

/////////////////////////////////////////////////////
////// GRID-BASED COLLISION OPTIMIZATION
/////////////////////////////////////////////////////

function getGridKey(x,z){

const gx = Math.floor(x / gridSize);
const gz = Math.floor(z / gridSize);

return gx + "," + gz;

}

function addColliderToGrid(collider){

const key = getGridKey(collider.position.x, collider.position.z);

if(!collisionGrid.has(key)){
collisionGrid.set(key, []);
}

collisionGrid.get(key).push(collider);

}

function getNearbyColliders(x,z){

const results = [];

const gx = Math.floor(x / gridSize);
const gz = Math.floor(z / gridSize);

for(let dx=-1; dx<=1; dx++){
for(let dz=-1; dz<=1; dz++){

const key = (gx+dx) + "," + (gz+dz);

if(collisionGrid.has(key)){
results.push(...collisionGrid.get(key));
}

}
}

return results;

}
function addCollider(object, radius=2){

object.userData.radius = radius;

colliders.push(object);

addColliderToGrid(object);

}

function checkCollisions(x,z){

const nearby = getNearbyColliders(x,z);

for(const obj of nearby){

const dx = x - obj.position.x;
const dz = z - obj.position.z;

const dist = Math.sqrt(dx*dx + dz*dz);

if(dist < obj.userData.radius + playerRadius){

return true;

}

}

return false;

}

//////////////////////////////////////////////////////
// CAMERA
//////////////////////////////////////////////////////

const camera = new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.5,
2000
);

let cameraDistance = 12;
let cameraHeight = 4;

//////////////////////////////////////////////////////
// RENDERER
//////////////////////////////////////////////////////

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled = true;

document.body.appendChild(renderer.domElement);
camera.position.set(0,6,12);
camera.lookAt(0,0,0);


///////////////////////////////////////////////////////
// HEALTH BAR
///////////////////////////////////////////////////////

const healthBar = document.createElement("div");

healthBar.style.position = "fixed";
healthBar.style.bottom = "40px";
healthBar.style.left = "50%";
healthBar.style.transform = "translateX(-50%)";
healthBar.style.width = "200px";
healthBar.style.height = "20px";
healthBar.style.background = "red";

document.body.appendChild(healthBar);

const healthFill = document.createElement("div");

healthFill.style.height = "100%";
healthFill.style.width = "100%";
healthFill.style.background = "lime";

healthBar.appendChild(healthFill);

function updateHealthBar(){

healthFill.style.width = (playerHealth/maxHealth*100) + "%";

}


//////////////////////////////////////////////////////
// LIGHTING
//////////////////////////////////////////////////////

const sun = new THREE.DirectionalLight(0xffffff,1.2);
sun.position.set(100,200,100);
sun.castShadow = true;

scene.add(sun);

const ambient = new THREE.AmbientLight(0x555555);
scene.add(ambient);

//////////////////////////////////////////////////////
// SKY
//////////////////////////////////////////////////////

const sky = new THREE.Mesh(
new THREE.SphereGeometry(1500,32,32),
new THREE.MeshBasicMaterial({
color:0x87ceeb,
side:THREE.BackSide
})
);

scene.add(sky);

//////////////////////////////////////////////////////
// TERRAIN HEIGHT
//////////////////////////////////////////////////////

function getTerrainHeight(x,z){

const mountains =
Math.sin(x*0.002)*60 +
Math.cos(z*0.002)*60;

const hills =
Math.sin(x*0.01)*12 +
Math.cos(z*0.01)*12;

const detail =
Math.sin((x+z)*0.04)*4 +
Math.cos((x-z)*0.03)*3;

return mountains + hills + detail;

}

//////////////////////////////////////////////////////
// TERRAIN
//////////////////////////////////////////////////////

const textureLoader = new THREE.TextureLoader();

const grassTex = textureLoader.load("./textures/grass.jpg");

grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(200,200);

const terrainSize = 1200;
const segments = 200;

const terrainGeo = new THREE.PlaneGeometry(
terrainSize,
terrainSize,
segments,
segments
);

terrainGeo.rotateX(-Math.PI/2);

const vertices = terrainGeo.attributes.position;

for(let i = 0; i < vertices.count; i++){

const x = vertices.getX(i);
const z = vertices.getZ(i);

const height = getTerrainHeight(x,z);

vertices.setY(i,height);

}

terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
map: grassTex
});

const terrain = new THREE.Mesh(terrainGeo,terrainMat);
terrain.receiveShadow = true;

scene.add(terrain);




//////////////////////////////////////////////////////
// SPAWN ENEMY
//////////////////////////////////////////////////////

function spawnBot(x,z){

const bot = new THREE.Mesh(
new THREE.CapsuleGeometry(1,2,4,8),
new THREE.MeshStandardMaterial({color:0xff3333})
);

bot.position.set(x,getTerrainHeight(x,z)+2,z);

bot.health = 100;
bot.maxHealth = 100;

bot.speed = 0.06;

bot.state = "idle";

bot.visionRange = 40;
bot.attackRange = 3;

bot.attackCooldown = 60;

scene.add(bot);
enemies.push(bot);
addCollider(bot,1.4);

}

//////////////////////////////////////////////////
/////VILLAGE
////////////////////////////////////////////////////

const villages = [];

for(let i=0;i<4;i++){

const x = Math.random()*800-400;
const z = Math.random()*800-400;

createVillage(x,z);

villages.push({x,z});

}

const forests = [];

for(let i=0;i<12;i++){

forests.push({
x: Math.random()*900-450,
z: Math.random()*900-450,
radius: 120 + Math.random()*120
});

}

function createVillage(cx,cz){

const houseCount = 8 + Math.floor(Math.random()*6);

for(let i=0;i<houseCount;i++){

const angle = Math.random()*Math.PI*2;
const dist = 20 + Math.random()*40;

const x = cx + Math.cos(angle)*dist;
const z = cz + Math.sin(angle)*dist;

spawnHouse(x,z);
worldObjects.push({x,z});

createRoad(cx,cz,x,z);

}

// village center
spawnCampfire(cx,cz);

// SPAWN FENCES
const segments = 16;
const radius = 70;

for(let i=0;i<segments;i++){

const angle = i/segments * Math.PI*2;

const x = cx + Math.cos(angle)*radius;
const z = cz + Math.sin(angle)*radius;

const rot = -angle + Math.PI/2;

spawnFence(x,z,rot);

}

}


//////////////////////////////////////////////////
//////////// OBSTACLES
//////////////////////////////////////////////////

///////////// WORLD OBJECTS FOR SPAWN CHECKS


function isValidSpawn(x, z, minDist){

for(const obj of worldObjects){

const dx = x - obj.x;
const dz = z - obj.z;

if(Math.sqrt(dx*dx + dz*dz) < minDist){
return false;
}

}

return true;

}

function isVillageArea(x,z){

for(const v of villages){

const dx = x - v.x;
const dz = z - v.z;

if(Math.sqrt(dx*dx + dz*dz) < 80){
return true;
}

}

return false;

}
////////////TREES


function createPineTree(){

const tree = new THREE.Group();

const trunk = new THREE.Mesh(
new THREE.CylinderGeometry(0.6,0.8,10,8),
new THREE.MeshStandardMaterial({color:0x6b4f2a})
);

const leaves = new THREE.Mesh(
new THREE.ConeGeometry(5,14,10),
new THREE.MeshStandardMaterial({color:0x1f7a1f})
);

trunk.position.y = 5;
leaves.position.y = 14;

tree.add(trunk);
tree.add(leaves);

return tree;

}

function createOakTree(){

const tree = new THREE.Group();

const trunk = new THREE.Mesh(
new THREE.CylinderGeometry(0.8,1,9,8),
new THREE.MeshStandardMaterial({color:0x6b4f2a})
);

const leaves = new THREE.Mesh(
new THREE.SphereGeometry(6,12,12),
new THREE.MeshStandardMaterial({color:0x2e8b57})
);

trunk.position.y = 4.5;
leaves.position.y = 11;

tree.add(trunk);
tree.add(leaves);

return tree;

}

function createBushTree(){

const tree = new THREE.Group();

const trunk = new THREE.Mesh(
new THREE.CylinderGeometry(0.7,1,8,8),
new THREE.MeshStandardMaterial({color:0x6b4f2a})
);

const leaves = new THREE.Mesh(
new THREE.SphereGeometry(7,12,12),
new THREE.MeshStandardMaterial({color:0x3fa34d})
);

leaves.scale.y = 0.8;

trunk.position.y = 4;
leaves.position.y = 10;

tree.add(trunk);
tree.add(leaves);

return tree;

}

function spawnTree(x,z){

const types = [
createPineTree,
createOakTree,
createBushTree
];

const tree = types[Math.floor(Math.random()*types.length)]();

// random size variation
const scale = 0.8 + Math.random()*0.6;
tree.scale.set(scale,scale,scale);

// random rotation
tree.rotation.y = Math.random()*Math.PI*2;

tree.position.set(x,getTerrainHeight(x,z),z);

scene.add(tree);

addCollider(tree,2);

}




/////////TREES SPWAN
const matrix = new THREE.Matrix4();
let treeIndex = 0;

for(const forest of forests){

for(let i=0;i<60;i++){

const angle = Math.random()*Math.PI*2;
const dist = Math.random()*forest.radius;

const x = forest.x + Math.cos(angle)*dist;
const z = forest.z + Math.sin(angle)*dist;

const y = getTerrainHeight(x,z);

const position = new THREE.Vector3(x,y,z);

const rotation = new THREE.Euler(
0,
Math.random()*Math.PI*2,
0
);

const s = 0.8 + Math.random()*0.6;

const scale = new THREE.Vector3(
s,
s,
s
);

matrix.compose(position,new THREE.Quaternion().setFromEuler(rotation),scale);

treeMesh.setMatrixAt(treeIndex,matrix);
trunkMesh.setMatrixAt(treeIndex,matrix);

treeIndex++;

}

}
treeMesh.instanceMatrix.needsUpdate = true;
trunkMesh.instanceMatrix.needsUpdate = true;

treeMesh.instanceMatrix.needsUpdate = true;
// SPAWN TREES
for(let i=0;i<250;i++){

let x,z;

do{

x = Math.random()*900-450;
z = Math.random()*900-450;

}
while(
!isValidSpawn(x,z,8) || 
isVillageArea(x,z)
);

spawnTree(x,z);

worldObjects.push({x,z});

}

////////////ROCKS

function spawnRock(x,z){

const rock = new THREE.Mesh(
new THREE.DodecahedronGeometry(2),
new THREE.MeshStandardMaterial({color:0x777777})
);

rock.position.set(x,getTerrainHeight(x,z)+1,z);

scene.add(rock);

addCollider(rock,2);

}

///////////ROCKS SPAWN
for(let i=0;i<30;i++){

const x = Math.random()*800-400;
const z = Math.random()*800-400;

spawnRock(x,z);

}

/////////////HOUSES

function spawnHouse(x,z){

const house = new THREE.Group();

const y = getTerrainHeight(x,z);

house.position.set(x,y,z);

// sample nearby terrain heights
const dx = getTerrainHeight(x+1,z) - getTerrainHeight(x-1,z);
const dz = getTerrainHeight(x,z+1) - getTerrainHeight(x,z-1);

// create terrain normal
const normal = new THREE.Vector3(-dx,2,-dz).normalize();

// align house with terrain
const up = new THREE.Vector3(0,1,0);
const quaternion = new THREE.Quaternion().setFromUnitVectors(up,normal);

house.quaternion.copy(quaternion);

//////////////////////////////////////////////////
// WALLS
//////////////////////////////////////////////////

const wallColors = [0xd2b48c,0xcaa472,0xbfa27a];

const walls = new THREE.Mesh(
new THREE.BoxGeometry(20,12,20),
new THREE.MeshStandardMaterial({
color: wallColors[Math.floor(Math.random()*wallColors.length)]
})
);

walls.position.y = 6;

//////////////////////////////////////////////////
// ROOF
//////////////////////////////////////////////////

const roof = new THREE.Mesh(
new THREE.ConeGeometry(16,9,4),
new THREE.MeshStandardMaterial({color:0x8b0000})
);

roof.rotation.y = Math.PI/4;
roof.position.y = 16;

//////////////////////////////////////////////////
// DOOR
//////////////////////////////////////////////////

const door = new THREE.Mesh(
new THREE.BoxGeometry(4,7,0.6),
new THREE.MeshStandardMaterial({color:0x4b2e1e})
);

door.position.set(0,3.5,10.3);

//////////////////////////////////////////////////
// WINDOWS
//////////////////////////////////////////////////

const windowMaterial = new THREE.MeshStandardMaterial({
color:0x87cefa,
emissive:0x222244
});

function createWindow(x,y,z){

const w = new THREE.Mesh(
new THREE.BoxGeometry(3.5,3.5,0.4),
windowMaterial
);

w.position.set(x,y,z);
return w;

}

const window1 = createWindow(-7,8,10.2);
const window2 = createWindow(7,8,10.2);
const window3 = createWindow(-7,8,-10.2);
const window4 = createWindow(7,8,-10.2);

//////////////////////////////////////////////////
// CHIMNEY
//////////////////////////////////////////////////

const chimney = new THREE.Mesh(
new THREE.BoxGeometry(2,6,2),
new THREE.MeshStandardMaterial({color:0x555555})
);

chimney.position.set(5,20,2);

//////////////////////////////////////////////////
// PORCH
//////////////////////////////////////////////////

const porch = new THREE.Mesh(
new THREE.BoxGeometry(8,1,6),
new THREE.MeshStandardMaterial({color:0x8b6f47})
);

porch.position.set(0,0.5,12);

//////////////////////////////////////////////////
// ASSEMBLE
//////////////////////////////////////////////////

house.add(walls);
house.add(roof);
house.add(door);
house.add(window1);
house.add(window2);
house.add(window3);
house.add(window4);
house.add(chimney);
house.add(porch);



// slight randomness
house.rotateOnWorldAxis(normal, Math.random()*Math.PI*2);

const scale = 0.9 + Math.random()*0.3;
house.scale.set(scale,scale,scale);

scene.add(house);

addCollider(house,9);

worldObjects.push({x,z});

}
// SPAWN HOUSES
//////////////////////////////////////////////////////

for(let i=0;i<12;i++){

let x,z;

do{

x = Math.random()*600-300;
z = Math.random()*600-300;

}while(!isValidSpawn(x,z,25));

spawnHouse(x,z);

worldObjects.push({x,z});

}

////////////////////////////////
////////////ROADS

function createRoad(x1,z1,x2,z2){

const segments = 25;

const curveOffsetX = (Math.random()-0.5)*40;
const curveOffsetZ = (Math.random()-0.5)*40;

for(let i=0;i<segments;i++){

const t1 = i/segments;
const t2 = (i+1)/segments;

const cx = (x1+x2)/2 + curveOffsetX;
const cz = (z1+z2)/2 + curveOffsetZ;

const sx =
(1-t1)*(1-t1)*x1 +
2*(1-t1)*t1*cx +
t1*t1*x2;

const sz =
(1-t1)*(1-t1)*z1 +
2*(1-t1)*t1*cz +
t1*t1*z2;

const ex =
(1-t2)*(1-t2)*x1 +
2*(1-t2)*t2*cx +
t2*t2*x2;

const ez =
(1-t2)*(1-t2)*z1 +
2*(1-t2)*t2*cz +
t2*t2*z2;

const length = Math.sqrt((ex-sx)**2+(ez-sz)**2);

const road = new THREE.Mesh(
new THREE.PlaneGeometry(6,length),
new THREE.MeshStandardMaterial({color:0x8b7d6b})
);

road.rotation.x = -Math.PI/2;

const angle = Math.atan2(ez-sz,ex-sx);
road.rotation.z = angle;

const mx = (sx+ex)/2;
const mz = (sz+ez)/2;

road.position.set(
mx,
getTerrainHeight(mx,mz)+0.2,
mz
);

scene.add(road);

}

}

//////////////////////////////////////////////////
/////////CAMPFIRE
function spawnCampfire(x,z){

const fire = new THREE.Group();

const wood1 = new THREE.Mesh(
new THREE.CylinderGeometry(0.3,0.3,4),
new THREE.MeshStandardMaterial({color:0x5a3d2b})
);

const wood2 = wood1.clone();

wood1.rotation.z = Math.PI/4;
wood2.rotation.z = -Math.PI/4;

const flame = new THREE.Mesh(
new THREE.SphereGeometry(1.5,8,8),
new THREE.MeshStandardMaterial({
color:0xff6600,
emissive:0xff2200
})
);

flame.position.y = 2;

fire.add(wood1);
fire.add(wood2);
fire.add(flame);

fire.position.set(x,getTerrainHeight(x,z)+0.5,z);

scene.add(fire);

}

//////////////////////////////////////////////////////
/////FENCES
function spawnFence(x, z, rotation = 0){

const fence = new THREE.Group();

const y = getTerrainHeight(x,z);

fence.position.set(x,y,z);

// detect terrain slope
const dx = getTerrainHeight(x+1,z) - getTerrainHeight(x-1,z);
const dz = getTerrainHeight(x,z+1) - getTerrainHeight(x,z-1);

const normal = new THREE.Vector3(-dx,2,-dz).normalize();
const up = new THREE.Vector3(0,1,0);

const quaternion = new THREE.Quaternion().setFromUnitVectors(up,normal);
fence.quaternion.copy(quaternion);

/////////////////////////////////////////////////
// POSTS
/////////////////////////////////////////////////

for(let i=-4;i<=4;i+=2){

const post = new THREE.Mesh(

new THREE.BoxGeometry(0.6,5,0.6),

new THREE.MeshStandardMaterial({color:0x8b5a2b})

);

post.position.set(i*2,2.5,0);
fence.add(post);

}

/////////////////////////////////////////////////
// TOP BEAM
/////////////////////////////////////////////////

const beamTop = new THREE.Mesh(

new THREE.BoxGeometry(20,0.7,0.8),

new THREE.MeshStandardMaterial({color:0xa46a2b})

);

beamTop.position.y = 4;
fence.add(beamTop);

/////////////////////////////////////////////////
// BOTTOM BEAM
/////////////////////////////////////////////////

const beamBottom = new THREE.Mesh(

new THREE.BoxGeometry(20,0.7,0.8),

new THREE.MeshStandardMaterial({color:0xa46a2b})

);

beamBottom.position.y = 1;
fence.add(beamBottom);

/////////////////////////////////////////////////
// DIAGONAL BRACES
/////////////////////////////////////////////////

for(let i=-3;i<=3;i+=2){

const brace1 = new THREE.Mesh(

new THREE.BoxGeometry(4,0.5,0.5),

new THREE.MeshStandardMaterial({color:0xc58a3a})

);

brace1.rotation.z = Math.PI/4;
brace1.position.set(i*2,2.5,0);

fence.add(brace1);

const brace2 = brace1.clone();
brace2.rotation.z = -Math.PI/4;

fence.add(brace2);

}

/////////////////////////////////////////////////

// combine terrain slope + village rotation correctly
const yRot = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0,1,0),
    rotation
);

fence.quaternion.multiply(yRot);

scene.add(fence);

addCollider(fence,3);

}




//////////////////////////////////////////////////////
// ENEMY AI
//////////////////////////////////////////////////////

function updateEnemies(){

for(const bot of enemies){

const groundY = getTerrainHeight(bot.position.x, bot.position.z);
bot.position.y = groundY + 2;

const dx = player.position.x - bot.position.x;
const dz = player.position.z - bot.position.z;

const distSq = dx*dx + dz*dz;







//////////////////////////////////////////////////
// STATE MACHINE
//////////////////////////////////////////////////

if(distSq < bot.attackRange * bot.attackRange){

bot.state = "attack";

}else if(distSq < bot.visionRange * bot.visionRange){

bot.state = "chase";

}else{

bot.state = "idle";

}

//////////////////////////////////////////////////
// IDLE PATROL
//////////////////////////////////////////////////

if(bot.state === "idle"){

if(Math.random() < 0.01){

bot.patrolDir = new THREE.Vector3(
Math.random()-0.5,
0,
Math.random()-0.5
).normalize();

}

if(bot.patrolDir){

bot.position.x += bot.patrolDir.x * 0.02;
bot.position.z += bot.patrolDir.z * 0.02;

}

}

//////////////////////////////////////////////////
// CHASE PLAYER
//////////////////////////////////////////////////

if(bot.state === "chase"){

bot.lookAt(player.position.x, bot.position.y, player.position.z);

const dir = new THREE.Vector3(dx,0,dz).normalize();

bot.position.x += dir.x * bot.speed;
bot.position.z += dir.z * bot.speed;

}

//////////////////////////////////////////////////
// ATTACK PLAYER
//////////////////////////////////////////////////

if(bot.state === "attack"){

bot.attackCooldown--;

if(bot.attackCooldown <= 0){

damagePlayer(5);

bot.attackCooldown = 60;

}

}

}

}

//////////////////////////////////////////////////////
// PLAYER
//////////////////////////////////////////////////////

let velocityY = 0;
let gravity = -0.02;
let isGrounded = true;

const player = new THREE.Object3D();
scene.add(player);

player.position.set(0,5,0);

const playerRadius = 1.5;

const playerMesh = new THREE.Mesh(
new THREE.CapsuleGeometry(1,2,4,8),
new THREE.MeshStandardMaterial({color:0xff4444})
);

playerMesh.visible = false;

player.add(playerMesh);

//////////////////////////////////////////////////////
// CHARACTER MODEL
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
// CHARACTER MODEL
//////////////////////////////////////////////////////

loader.load("./models/idle.glb",(gltf)=>{

character = gltf.scene;
player.add(character);


character.scale.set(0.03,0.03,0.03);
character.rotation.y = Math.PI;
character.position.y = -2;

player.add(character);
// LOAD GUN MODEL
loader.load("./models/rifle.glb",(gltf)=>{

console.log("Gun loaded");

gun = gltf.scene;

gun.scale.set(0.02,0.02,0.02);
gun.position.set(0.02,0.01,0.04);
gun.rotation.set(0,Math.PI/2,0);

const hand = character.getObjectByName("mixamorig_RightHand");

if(hand){
hand.add(gun);
}else{
character.add(gun);
}

});

mixer = new THREE.AnimationMixer(character);

mixer.addEventListener("finished", (e)=>{

if(e.action === actions["Jump"] || e.action === actions["Shoot"]){

if(keys["w"] || keys["a"] || keys["s"] || keys["d"]){

switchAnimation("Walk");

}else{

switchAnimation("Idle");

}

}

});

// SAFE IDLE ANIMATION
if(gltf.animations && gltf.animations.length > 0){

let idleClip = gltf.animations[0];

idleClip.tracks = idleClip.tracks.filter(track =>
!track.name.includes(".position")
);

actions["Idle"] = mixer.clipAction(idleClip);

actions["Idle"].play();
activeAction = actions["Idle"];

}

// Load other animations
loadAnimation("Walk","./models/walking.glb");
loadAnimation("Run","./models/running.glb");
loadAnimation("Jump","./models/jump.glb");
loadAnimation("Shoot","./models/rifle_shooting.glb");

});

function loadAnimation(name,path){

loader.load(path,(gltf)=>{

if(!gltf.animations || gltf.animations.length === 0) return;

let clip = gltf.animations[0];

// Remove root motion (position tracks)
clip.tracks = clip.tracks.filter(track => 
!track.name.includes(".position")
);

const action = mixer.clipAction(clip);

if(name === "Shoot" || name === "Jump"){
action.setLoop(THREE.LoopOnce);
action.clampWhenFinished = true;
}

actions[name] = action;

});

}


//////////////////////////////////////////////////////
// INPUT
//////////////////////////////////////////////////////

const keys = {};

document.addEventListener("keydown",e=>{
keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup",e=>{
keys[e.key.toLowerCase()] = false;
});

document.addEventListener("keydown", e => {

keys[e.key.toLowerCase()] = true;

if(e.key.toLowerCase() === "t"){

firstPerson = !firstPerson;

if(character){
character.visible = !firstPerson;
}

}

});

//////////////////////////////////////////////////////
// PLAYER MOVEMENT
//////////////////////////////////////////////////////

let walkSpeed = 0.4;

function movePlayer() {
    const direction = new THREE.Vector3();

    // Standardized: W is always +Z (Forward in your world)
    if (keys["w"]) direction.z += 1;
    if (keys["s"]) direction.z -= 1;
    if (keys["a"]) direction.x += 1;
    if (keys["d"]) direction.x -= 1;

    direction.normalize();
    
    

    // Jump Logic (Fixed to work while standing still)
    if (keys[" "] && isGrounded) {
        velocityY = 0.4;
        isGrounded = false;
        if(actions["Jump"]) switchAnimation("Jump");
    }

    if (direction.lengthSq() === 0) {
        if (isGrounded) switchAnimation("Idle");
        return; 
    }

    // Move relative to where the player is facing (yaw)
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const targetRotation = Math.atan2(direction.x, direction.z) + yaw;

player.rotation.y = THREE.MathUtils.lerp(
player.rotation.y,
targetRotation,
0.15
);

    const speed = keys["shift"] ? walkSpeed * 2 : walkSpeed;

const newX = player.position.x + direction.x * speed;
const newZ = player.position.z + direction.z * speed;

// Try move X
if(!checkCollisions(newX, player.position.z)){
    player.position.x = newX;
}

// Try move Z
if(!checkCollisions(player.position.x, newZ)){
    player.position.z = newZ;
}

if(!checkCollisions(newX,newZ)){

player.position.x = newX;
player.position.z = newZ;

}

    // Animation logic
    if(isGrounded){

if(direction.lengthSq() === 0){

switchAnimation("Idle");

}else if(keys["shift"]){

switchAnimation("Run",0.35);

}else{

switchAnimation("Walk",0.35);

}

}
}



//////////////////////////////////////////////////////
// SHOOTING
//////////////////////////////////////////////////////

const shootRay = new THREE.Raycaster();

document.addEventListener("mousedown", shoot);

function shoot(){
    
if(actions["Shoot"]){
switchAnimation("Shoot");

setTimeout(()=>{
if(isGrounded) switchAnimation("Idle");
},250);
}    


shootRay.setFromCamera(
new THREE.Vector2(0,0),
camera
);

const hits = shootRay.intersectObjects(enemies);

if(hits.length > 0){

const bot = hits[0].object;

bot.health -= 20;

if(bot.health <= 0){

scene.remove(bot);

const index = enemies.indexOf(bot);
if(index > -1) enemies.splice(index,1);

}

}

}


//////////////////////////////////////////////////////
// CAMERA
//////////////////////////////////////////////////////

let yaw = 0;
let pitch = 0;
let firstPerson = false;

document.addEventListener("mousemove",e=>{

if(document.pointerLockElement===document.body){

yaw -= e.movementX*0.002;
pitch -= e.movementY*0.002;

pitch = Math.max(-Math.PI/3,Math.min(Math.PI/3,pitch));

}

});

document.body.addEventListener("click",()=>{
document.body.requestPointerLock();
});

function updateCamera(){

if(firstPerson && gun){
gun.visible = true;
}else if(gun){
gun.visible = false;
}

player.rotation.y = yaw;

if(firstPerson){

// FIRST PERSON

const headPos = new THREE.Vector3(
player.position.x,
player.position.y + 4,
player.position.z
);

camera.position.lerp(headPos,0.4);

const lookTarget = new THREE.Vector3(
player.position.x + Math.sin(yaw),
player.position.y + 4 + Math.sin(pitch),
player.position.z + Math.cos(yaw)
);

camera.lookAt(lookTarget);

}else{

// THIRD PERSON

const target = new THREE.Vector3(
player.position.x + Math.sin(yaw)*14,
player.position.y + 5 + Math.sin(pitch)*6,
player.position.z + Math.cos(yaw)*14
);


camera.position.lerp(target,0.08);

const terrainY = getTerrainHeight(
camera.position.x,
camera.position.z
);

if(camera.position.y < terrainY + 2){
camera.position.y = terrainY + 2;
}

const lookTarget = new THREE.Vector3(
player.position.x,
player.position.y + 3 + Math.sin(pitch)*10,
player.position.z
);

camera.lookAt(lookTarget);

}

}


//////////////////////////////////////////////////////
// ANIMATION SWITCH
//////////////////////////////////////////////////////

function switchAnimation(name, fade = 0.25){

if(!actions[name]) return;

const newAction = actions[name];

if(activeAction === newAction) return;

newAction.reset();
newAction.enabled = true;
newAction.setEffectiveTimeScale(1);
newAction.setEffectiveWeight(1);

if(activeAction){

newAction.crossFadeFrom(activeAction, fade, true);

}else{

newAction.fadeIn(fade);

}

newAction.play();

activeAction = newAction;

}


//////////////////////////////////////////////////////
// GAME LOOP
//////////////////////////////////////////////////////

function animate(){

requestAnimationFrame(animate);

movePlayer();

velocityY += gravity;
player.position.y += velocityY;

const groundY = getTerrainHeight(player.position.x, player.position.z) + 2;

if(player.position.y <= groundY){

player.position.y = groundY;
velocityY = 0;
isGrounded = true;

}

updateCamera();

updateEnemies();

const delta = clock.getDelta();

if(mixer){
mixer.update(delta);
}

renderer.render(scene,camera);

staminaBar.style.width = "100%";

}

animate();



//////////////////////////////////////////////////////
// SPAWN ENEMIES
//////////////////////////////////////////////////////

for(let i=0;i<8;i++){

const x = Math.random()*600-300;
const z = Math.random()*600-300;

spawnBot(x,z);

}