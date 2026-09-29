import './style.css'
import 'katex/dist/katex.min.css'
import * as THREE from 'three'
import * as katex from 'katex'

type Mode = 'train' | 'car'
type Viewpoint = 'self' | 'other' | 'outside'
type CardinalDirection = 'north' | 'east' | 'south' | 'west'

type GroundVector = { x: number; z: number }

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="相対速度ラボ ホーム">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>RELATIVE MOTION</strong><small>相対速度シミュレーター</small></span>
      </a>
      <div class="topbar-note"><span class="live-dot"></span> 速度の基準を切り替えて観察</div>
    </header>

    <main>
      <section class="intro-row">
        <div>
          <p class="eyebrow">MOVEMENT IS RELATIVE</p>
          <h1>同じ動きも，<span>視点で変わる。</span></h1>
        </div>
        <div class="mode-switch" role="group" aria-label="シミュレーションの乗り物">
          <button class="mode-button is-active" data-mode="train" aria-pressed="true"><span class="mode-glyph train-glyph" aria-hidden="true"></span>電車</button>
          <button class="mode-button" data-mode="car" aria-pressed="false"><span class="mode-glyph car-glyph" aria-hidden="true"></span>車 · 3D</button>
        </div>
      </section>

      <section class="experiment-layout">
        <aside class="control-panel" aria-label="シミュレーション設定">
          <div class="panel-heading"><span class="section-index">01</span><div><h2>速度を設定</h2><p id="speed-caption">地面基準 · ＋は進行方向</p></div></div>

          <div class="speed-control">
            <label for="self-speed"><span class="vehicle-key key-self"></span><span>自分の<span class="vehicle-label">電車</span></span><output id="self-output" for="self-speed">0</output></label>
            <input id="self-speed" type="range" min="-100" max="100" step="5" value="0" aria-label="自分の乗り物の速度">
            <div class="range-ends"><span>−100</span><span>0</span><span>＋100 km/h</span></div>
          </div>

          <div class="speed-control">
            <label for="other-speed"><span class="vehicle-key key-other"></span><span>となりの<span class="vehicle-label">電車</span></span><output id="other-output" for="other-speed">60</output></label>
            <input id="other-speed" class="other-range" type="range" min="-100" max="100" step="5" value="60" aria-label="相手の乗り物の速度">
            <div class="range-ends"><span>−100</span><span>0</span><span>＋100 km/h</span></div>
          </div>

          <div class="distance-control train-distance-control">
            <label for="initial-distance"><span class="vehicle-key key-distance"></span><span>相手との初期距離 <small>＋前方 ／ −後方</small></span><output id="distance-output" for="initial-distance">＋20 m</output></label>
            <input id="initial-distance" type="range" min="-80" max="80" step="5" value="20" aria-label="相手との符号付き初期距離">
            <div class="range-ends"><span>−80 m</span><span>0</span><span>＋80 m</span></div>
          </div>

          <div class="car-controls" aria-label="車の直線運動設定">
            <div class="direction-controls">
              <div class="direction-row"><span>自分の進行方向</span><div class="direction-switch" role="group" aria-label="自分の進行方向"><button class="direction-button" data-direction-for="self" data-direction="north" aria-pressed="false">北</button><button class="direction-button" data-direction-for="self" data-direction="east" aria-pressed="false">東</button><button class="direction-button" data-direction-for="self" data-direction="south" aria-pressed="false">南</button><button class="direction-button is-active" data-direction-for="self" data-direction="west" aria-pressed="true">西</button></div></div>
              <div class="direction-row"><span>相手の進行方向</span><div class="direction-switch" role="group" aria-label="相手の進行方向"><button class="direction-button" data-direction-for="other" data-direction="north" aria-pressed="false">北</button><button class="direction-button" data-direction-for="other" data-direction="east" aria-pressed="false">東</button><button class="direction-button is-active" data-direction-for="other" data-direction="south" aria-pressed="true">南</button><button class="direction-button" data-direction-for="other" data-direction="west" aria-pressed="false">西</button></div></div>
            </div>
            <div class="car-position-controls">
              <span class="field-caption">道路上の初期位置 · 交差点まで</span>
              <label for="self-start-distance">自分 <output id="self-start-output" for="self-start-distance">60 m</output></label>
              <input id="self-start-distance" type="range" min="0" max="120" step="5" value="60" aria-label="自分の車の交差点までの初期距離">
              <div class="range-ends"><span>交差点 0 m</span><span>120 m</span></div>
              <label for="other-start-distance">相手 <output id="other-start-output" for="other-start-distance">60 m</output></label>
              <input id="other-start-distance" type="range" min="0" max="120" step="5" value="60" aria-label="相手の車の交差点までの初期距離">
              <div class="range-ends"><span>交差点 0 m</span><span>120 m</span></div>
            </div>
          </div>

          <div class="preset-block">
            <span class="field-caption">すぐ試せる状況</span>
            <div class="preset-list">
              <button class="preset-button rail-preset is-selected" data-self="0" data-other="60"><span class="preset-number">A</span><span>相手が発車</span><span class="preset-arrow">↗</span></button>
              <button class="preset-button rail-preset" data-self="60" data-other="60"><span class="preset-number">B</span><span>同じ速さで並走</span><span class="preset-arrow">↗</span></button>
              <button class="preset-button rail-preset" data-self="-40" data-other="50"><span class="preset-number">C</span><span>向かい合って走る</span><span class="preset-arrow">↗</span></button>
              <span class="comparison-label rail-preset">同じ相対運動を比べる</span>
              <button class="preset-button equivalence-button rail-preset" data-self="-60" data-other="0" data-equivalent="true"><span class="preset-number">D</span><span>自分−60 ／ 相手0</span><span class="preset-arrow">↗</span></button>
              <button class="preset-button equivalence-button rail-preset" data-self="0" data-other="60" data-equivalent="true"><span class="preset-number">E</span><span>自分0 ／ 相手＋60</span><span class="preset-arrow">↗</span></button>
              <span class="comparison-label car-preset">交差点でのコリジョンコース</span>
              <button class="preset-button car-preset" data-car-preset="collision"><span class="preset-number">F</span><span>同時に交差点へ進入</span><span class="preset-arrow">↗</span></button>
              <button class="preset-button car-preset" data-car-preset="near-miss"><span class="preset-number">G</span><span>交差するが到着時刻が違う</span><span class="preset-arrow">↗</span></button>
            </div>
          </div>

          <div class="transport-controls">
            <button class="play-button" id="play-toggle" aria-label="シミュレーションを再生"><span class="play-icon" aria-hidden="true"></span><span>走らせる</span></button>
            <button class="reset-button" id="reset-time" aria-label="時間をリセット" title="時間をリセット"><span aria-hidden="true">↺</span></button>
            <span class="elapsed-time" id="elapsed-time">00:00</span>
          </div>

          <div class="teaching-note"><span class="note-mark">!</span><p id="teaching-note">相手だけが動いても，窓の景色が流れると自分が動いたように感じることがあります。</p></div>
        </aside>

        <section class="visual-column" aria-label="走行シミュレーション">
          <div class="map-panel">
            <div class="map-title"><span class="section-index">02</span><div><h2>上から見た配置</h2><p>地面に固定した視点</p></div></div>
            <canvas id="map-canvas" aria-label="乗り物と進行方向の配置図"></canvas>
            <div class="map-legend"><span><i class="legend-self"></i>自分</span><span><i class="legend-other"></i>相手</span><span class="north-mark" id="map-orientation">進行方向 ↑</span></div>
          </div>

          <div class="scene-panel">
            <div class="scene-topline"><span><i class="scene-live-dot"></i><span id="view-label">自分の乗り物から</span></span><div class="view-switch" role="group" aria-label="観察する視点"><button class="view-button is-active" data-view="self" aria-pressed="true">自分から</button><button class="view-button" data-view="other" aria-pressed="false">相手から</button><button class="view-button" data-view="outside" aria-pressed="false">外から</button></div></div>
            <div class="scene-options">
              <div class="scene-option"><span class="option-label">カメラ位置</span><div class="option-switch" role="group" aria-label="カメラ位置"><button class="option-button is-active" data-camera="front" aria-pressed="true">前方</button><button class="option-button" data-camera="rear" aria-pressed="false">後方</button></div></div>
              <div class="scene-option"><span class="option-label">周囲</span><div class="option-switch" role="group" aria-label="周囲の風景"><button class="option-button is-active" data-scenery="shown" aria-pressed="true">風景あり</button><button class="option-button" data-scenery="hidden" aria-pressed="false">相手だけ</button></div></div>
            </div>
            <div class="scene-wrap" id="scene-wrap">
              <canvas id="scene-canvas" aria-label="乗り物から見た走行中の風景"></canvas>
              <div class="scene-overlay scene-location"><span class="location-sun"></span><span id="scene-location">郊外 · 線路沿い</span></div>
              <div class="scene-overlay scene-caption"><span class="caption-tag" id="caption-tag">車内カメラ</span><span id="scene-caption">窓の外が動いて見える</span></div>
              <div class="collision-overlay" id="collision-overlay" aria-live="assertive" hidden><div><strong>衝突</strong><span>車両を停止しました</span></div></div>
              <div class="window-shade" aria-hidden="true"><span></span></div>
            </div>
          </div>

          <div class="reading-panel">
            <div class="reading-formula"><span class="section-index">03</span><div><p class="field-caption" id="relative-caption">自分から見た相手の速度</p><strong id="relative-formula">vB/A = vB − vA</strong></div></div>
            <div class="reading-result"><strong id="relative-speed">＋60</strong><span>km/h</span><i class="result-arrow" id="result-arrow" aria-hidden="true">↑</i><span class="result-direction" id="relative-direction">前方へ動いて見える</span></div>
            <p class="reading-explanation" id="reading-explanation">地面からは相手だけが動いています。自分の視点では，相手が前方へ流れて見えます。</p>
            <div class="car-analysis" id="car-analysis" hidden>
              <div><span class="field-caption">相対速度ベクトル（東，北）</span><strong id="relative-vector">東 −60 km/h，北 0 km/h</strong></div>
              <div><span class="field-caption">コリジョンコース判定</span><strong id="collision-status">計算中</strong><small id="closest-approach"></small></div>
            </div>
            <div class="velocity-panel">
              <div class="velocity-heading"><span class="field-caption">速度ベクトル図</span><span id="velocity-basis">線路方向 · 右が＋</span></div>
              <canvas id="velocity-canvas" aria-label="自分・相手・相対速度のベクトル図"></canvas>
              <div class="velocity-legend">
                <span><i class="legend-self"></i>自分 <output id="vector-self-value">0 km/h</output></span>
                <span><i class="legend-other"></i>相手 <output id="vector-other-value">＋60 km/h</output></span>
                <span><i class="legend-relative"></i>相対 <output id="vector-relative-value">＋60 km/h</output></span>
              </div>
            </div>
          </div>
        </section>
      </section>
      <footer class="page-footer"><span>運動の相対性</span><span>速度は地面を基準に設定 · 単位 km/h</span></footer>
    </main>
  </div>
`

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!
const sceneCanvas = $<HTMLCanvasElement>('#scene-canvas')
const mapCanvas = $<HTMLCanvasElement>('#map-canvas')
const velocityCanvas = $<HTMLCanvasElement>('#velocity-canvas')
const selfInput = $<HTMLInputElement>('#self-speed')
const otherInput = $<HTMLInputElement>('#other-speed')
const distanceInput = $<HTMLInputElement>('#initial-distance')
const selfOutput = $<HTMLOutputElement>('#self-output')
const otherOutput = $<HTMLOutputElement>('#other-output')
const distanceOutput = $<HTMLOutputElement>('#distance-output')
const selfStartDistanceInput = $<HTMLInputElement>('#self-start-distance')
const otherStartDistanceInput = $<HTMLInputElement>('#other-start-distance')
const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const skyColor = new THREE.Color('#c6dbe0')
const environmentFog = new THREE.Fog('#c6dbe0', 45, 150)
const exteriorCarFog = new THREE.Fog('#c6dbe0', 120, 420)
scene.background = skyColor
scene.fog = environmentFog
const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 220)
function setCameraFieldOfView(degrees: number) {
  if (camera.fov === degrees) return
  camera.fov = degrees
  camera.updateProjectionMatrix()
}
const ambientLight = new THREE.HemisphereLight('#f4fcff', '#586451', 2.15)
scene.add(ambientLight)
const sun = new THREE.DirectionalLight('#fff1d2', 2.6)
sun.position.set(-16, 28, 15)
scene.add(sun)
const environment = new THREE.Group()
scene.add(environment)

const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#80936e', roughness: 1 }))
ground.rotation.x = -Math.PI / 2
ground.position.y = -0.12
environment.add(ground)

const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(8, 260), new THREE.MeshStandardMaterial({ color: '#465457', roughness: 0.94 }))
asphalt.rotation.x = -Math.PI / 2
asphalt.position.y = -0.035
environment.add(asphalt)

const shoulderMaterial = new THREE.MeshStandardMaterial({ color: '#b6b29a', roughness: 1 })
const markMaterial = new THREE.MeshStandardMaterial({ color: '#e5d8a0', roughness: 0.8 })
const crossStreetGroup = new THREE.Group()
const crossStreet = new THREE.Mesh(new THREE.PlaneGeometry(260, 10), new THREE.MeshStandardMaterial({ color: '#596361', roughness: 0.92 }))
crossStreet.rotation.x = -Math.PI / 2
crossStreet.position.y = -0.055
crossStreetGroup.add(crossStreet)
for (const z of [-5.35, 5.35]) {
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(260, 0.08, 0.7), shoulderMaterial)
  shoulder.position.set(0, -0.02, z)
  crossStreetGroup.add(shoulder)
}
for (let index = -32; index <= 32; index += 1) {
  const mark = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.025, 0.16), markMaterial)
  mark.position.set(index * 4, 0.035, 0)
  crossStreetGroup.add(mark)
}
environment.add(crossStreetGroup)

for (const x of [-4.35, 4.35]) {
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 260), shoulderMaterial)
  shoulder.position.set(x, -0.02, 0)
  environment.add(shoulder)
}

const railGroup = new THREE.Group()
const railMaterial = new THREE.MeshStandardMaterial({ color: '#535d5a', metalness: 0.68, roughness: 0.35 })
const sleeperMaterial = new THREE.MeshStandardMaterial({ color: '#615c4d', roughness: 0.95 })
const sleepers: THREE.Mesh[] = []
for (const x of [-1.7, 1.7]) {
  for (const railX of [-0.66, 0.66]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 260), railMaterial)
    rail.position.set(x + railX, 0.04, 0)
    railGroup.add(rail)
  }
  for (let index = -64; index <= 64; index += 1) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.28), sleeperMaterial)
    sleeper.position.set(x, -0.015, index * 2)
    sleeper.userData.baseZ = index * 2
    railGroup.add(sleeper)
    sleepers.push(sleeper)
  }
}
environment.add(railGroup)

const roadMarks = new THREE.Group()
const movingRoadMarks: THREE.Mesh[] = []
for (let index = -32; index <= 32; index += 1) {
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 2.1), markMaterial)
  mark.position.set(0, 0.02, index * 4)
  mark.userData.baseZ = index * 4
  roadMarks.add(mark)
  movingRoadMarks.push(mark)
}
environment.add(roadMarks)

function makeTree(x: number, z: number, size: number) {
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * size, 0.2 * size, 1.55 * size, 7), new THREE.MeshStandardMaterial({ color: '#725744', roughness: 1 }))
  trunk.position.y = 0.72 * size
  tree.add(trunk)
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9 * size, 2.1 * size, 8), new THREE.MeshStandardMaterial({ color: '#526e52', roughness: 1 }))
  crown.position.y = 2.15 * size
  tree.add(crown)
  tree.position.set(x, 0, z)
  environment.add(tree)
  return tree
}

function makeBuilding(x: number, z: number, height: number, shade: string) {
  const building = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, height, 4.6), new THREE.MeshStandardMaterial({ color: shade, roughness: 0.94 }))
  body.position.y = height / 2
  building.add(body)
  const windows = new THREE.Mesh(new THREE.BoxGeometry(4.24, height * 0.42, 0.04), new THREE.MeshStandardMaterial({ color: '#bdd4d0', roughness: 0.5, metalness: 0.12 }))
  windows.position.set(0, height * 0.56, 2.32)
  building.add(windows)
  building.position.set(x, 0, z)
  environment.add(building)
  return building
}

const scenery: THREE.Object3D[] = []
for (let index = 0; index < 20; index += 1) {
  const z = -76 + index * 8
  const side = index % 2 === 0 ? 1 : -1
  scenery.push(makeTree(side * (6.8 + (index % 3) * 1.3), z, 0.8 + (index % 4) * 0.12))
  if (index % 2 === 1) scenery.push(makeBuilding(-side * 11, z - 3, 4.2 + (index % 3) * 1.1, index % 3 === 0 ? '#bdc4b8' : '#d0c7b1'))
}

function createVehicle(kind: Mode, color: string) {
  const group = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.16 })
  const glass = new THREE.MeshStandardMaterial({ color: '#b8d3d4', roughness: 0.2, metalness: 0.18 })
  const dark = new THREE.MeshStandardMaterial({ color: '#263235', roughness: 0.62 })

  if (kind === 'train') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.75, 11.5), paint)
    body.position.y = 1.12
    group.add(body)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.18, 10.8), new THREE.MeshStandardMaterial({ color: '#f1eee4', roughness: 0.55 }))
    roof.position.y = 2.06
    group.add(roof)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.74, 0.045), glass)
    windshield.position.set(0, 1.48, -5.78)
    group.add(windshield)
    for (const side of [-1, 1]) {
      for (let index = 0; index < 5; index += 1) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.66, 1.25), glass)
        window.position.set(side * 1.235, 1.55, -3.65 + index * 1.82)
        group.add(window)
      }
      for (const z of [-4.3, -2.4, 2.4, 4.3]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), dark)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(side * 1.16, 0.33, z)
        group.add(wheel)
      }
    }
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.76, 4.25), paint)
    body.position.y = 0.76
    group.add(body)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.72, 2.08), glass)
    cabin.position.set(0, 1.42, -0.28)
    group.add(cabin)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.26, 1.1), paint)
    hood.position.set(0, 1.01, -1.47)
    group.add(hood)
    for (const side of [-1, 1]) {
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 14), dark)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(side * 1.04, 0.42, z)
        group.add(wheel)
      }
    }
    const lights = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: '#ffe6a9', emissive: '#7e612b', emissiveIntensity: 0.32 }))
    lights.position.set(0, 0.88, -2.14)
    group.add(lights)
  }
  scene.add(group)
  return group
}

const selfVehicles = {
  train: createVehicle('train', '#187e83'),
  car: createVehicle('car', '#187e83'),
}
const otherVehicles = {
  train: createVehicle('train', '#d67852'),
  car: createVehicle('car', '#d67852'),
}
const state = { mode: 'train' as Mode, viewpoint: 'self' as Viewpoint, cameraPosition: 'front' as 'front' | 'rear', showScenery: true, selfSpeed: 0, otherSpeed: 60, selfDirection: 'west' as CardinalDirection, otherDirection: 'south' as CardinalDirection, initialDistance: 20, selfStartDistance: 60, otherStartDistance: 60, playing: false, collisionTriggered: false, elapsed: 0 }
const KMH_TO_MPS = 1 / 3.6
const COLLISION_CLEARANCE_METERS = 3.2
const wrapZ = (value: number) => ((value + 128) % 256 + 256) % 256 - 128
const getActiveVehicles = () => ({ self: selfVehicles[state.mode], other: otherVehicles[state.mode] })
const TRACK_FORWARD_Z = -1
const directionVectors: Record<CardinalDirection, GroundVector> = {
  north: { x: 0, z: -1 },
  east: { x: 1, z: 0 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
}
const getCarVelocity = (vehicle: 'self' | 'other'): GroundVector => {
  const speed = Math.abs(vehicle === 'self' ? state.selfSpeed : state.otherSpeed) * KMH_TO_MPS
  const direction = directionVectors[vehicle === 'self' ? state.selfDirection : state.otherDirection]
  return { x: direction.x * speed, z: direction.z * speed }
}
const getCarInitialPositions = () => {
  const selfDirection = directionVectors[state.selfDirection]
  const otherDirection = directionVectors[state.otherDirection]
  return {
    self: { x: -selfDirection.x * state.selfStartDistance, z: -selfDirection.z * state.selfStartDistance },
    other: { x: -otherDirection.x * state.otherStartDistance, z: -otherDirection.z * state.otherStartDistance },
  }
}
const getCarRelativePosition = (): GroundVector => {
  const starts = getCarInitialPositions()
  return { x: starts.other.x - starts.self.x, z: starts.other.z - starts.self.z }
}
const getCarHeading = (direction: CardinalDirection) => Math.atan2(-directionVectors[direction].x, -directionVectors[direction].z)
const getSelfForwardZ = () => TRACK_FORWARD_Z
const getOtherForwardZ = () => TRACK_FORWARD_Z
const getInitialGapZ = () => TRACK_FORWARD_Z * state.initialDistance
const getCameraPositionTowardTarget = (viewpoint: Viewpoint) => {
  if (state.mode === 'car') {
    if (viewpoint === 'outside') return 'front' as const
    const target = getCarRelativePosition()
    const observerDirection = directionVectors[viewpoint === 'other' ? state.otherDirection : state.selfDirection]
    const towardTarget = viewpoint === 'other' ? { x: -target.x, z: -target.z } : target
    return towardTarget.x * observerDirection.x + towardTarget.z * observerDirection.z >= 0 ? 'front' as const : 'rear' as const
  }
  if (viewpoint === 'outside' || state.initialDistance === 0) return 'front' as const
  const targetDirection = viewpoint === 'self' ? getInitialGapZ() : -getInitialGapZ()
  const observerForward = viewpoint === 'self' ? getSelfForwardZ() : getOtherForwardZ()
  return Math.sign(targetDirection) === observerForward ? 'front' as const : 'rear' as const
}
const vehicleOnlyColor = new THREE.Color('#dfe5e3')
let previousFrameTime = performance.now()

function getClosestApproach() {
  const initialPosition = getCarRelativePosition()
  const selfVelocity = getCarVelocity('self')
  const otherVelocity = getCarVelocity('other')
  const relativeVelocity = { x: otherVelocity.x - selfVelocity.x, z: otherVelocity.z - selfVelocity.z }
  const position = {
    x: initialPosition.x + relativeVelocity.x * state.elapsed,
    z: initialPosition.z + relativeVelocity.z * state.elapsed,
  }
  const relativeSpeedSquared = relativeVelocity.x ** 2 + relativeVelocity.z ** 2
  if (relativeSpeedSquared < 0.0001) {
    return { time: null, distance: Math.hypot(position.x, position.z), status: '相対位置は変わらない' }
  }

  const time = -(position.x * relativeVelocity.x + position.z * relativeVelocity.z) / relativeSpeedSquared
  if (time <= 0) return { time: 0, distance: Math.hypot(position.x, position.z), status: state.elapsed > 0 ? '最接近後' : '接近していない' }
  const distance = Math.hypot(position.x + relativeVelocity.x * time, position.z + relativeVelocity.z * time)
  return {
    time,
    distance,
    status: distance <= COLLISION_CLEARANCE_METERS ? 'コリジョンコース' : '接近するが衝突しない',
  }
}

function updateCarProximity() {
  if (state.collisionTriggered) return
  const closest = getClosestApproach()
  $('#collision-status').textContent = closest.status
  $('#closest-approach').textContent = closest.time === null
    ? `現在の距離 ${closest.distance.toFixed(1)} m`
    : closest.time > 0
      ? `${closest.time.toFixed(1)} 秒後に最接近 · ${closest.distance.toFixed(1)} m`
      : `現在の距離 ${closest.distance.toFixed(1)} m`
}

function resetCollisionState() {
  state.collisionTriggered = false
  const overlay = $<HTMLDivElement>('#collision-overlay')
  overlay.hidden = true
  overlay.classList.remove('is-impact')
}

function triggerCollision() {
  state.playing = false
  state.collisionTriggered = true
  $('#play-toggle').classList.remove('is-playing')
  $('#play-toggle').setAttribute('aria-label', 'シミュレーションを再生')
  $('#play-toggle span:last-child').textContent = '走らせる'
  $('#collision-status').textContent = '衝突'
  $('#closest-approach').textContent = `衝突 · ${state.elapsed.toFixed(1)} 秒 · 車両停止`
  const overlay = $<HTMLDivElement>('#collision-overlay')
  overlay.hidden = false
  overlay.classList.remove('is-impact')
  void overlay.offsetWidth
  overlay.classList.add('is-impact')
}

function syncSceneVisibility() {
  const active = getActiveVehicles()
  Object.values(selfVehicles).forEach((vehicle) => {
    vehicle.visible = vehicle === active.self && state.viewpoint !== 'self' && (state.showScenery || state.viewpoint !== 'outside')
  })
  Object.values(otherVehicles).forEach((vehicle) => { vehicle.visible = vehicle === active.other && state.viewpoint !== 'other' })
  environment.visible = state.showScenery
  scene.background = state.showScenery ? skyColor : vehicleOnlyColor
  scene.fog = !state.showScenery
    ? null
    : state.mode === 'car' && state.viewpoint === 'outside'
      ? exteriorCarFog
      : environmentFog
  $('#scene-wrap').classList.toggle('no-scenery', !state.showScenery)
}

function updateOptionButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
    const selected = button.dataset.camera === state.cameraPosition
    button.classList.toggle('is-active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-scenery]').forEach((button) => {
    const selected = (button.dataset.scenery === 'shown') === state.showScenery
    button.classList.toggle('is-active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

function updateDirectionButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-direction-for]').forEach((button) => {
    const key = button.dataset.directionFor === 'self' ? 'selfDirection' : 'otherDirection'
    const selected = button.dataset.direction === state[key]
    button.classList.toggle('is-active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

function drawMap() {
  const context = mapCanvas.getContext('2d')
  if (!context) return
  const width = mapCanvas.clientWidth
  const height = mapCanvas.clientHeight
  const ratio = Math.min(window.devicePixelRatio, 2)
  mapCanvas.width = Math.round(width * ratio)
  mapCanvas.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#f0f2eb'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#dce1d6'
  context.lineWidth = 1
  for (let x = 16; x < width; x += 28) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke()
  }
  if (state.mode === 'car') {
    const mapScale = Math.min((width - 30) / 160, (height - 18) / 160)
    const toCanvas = (point: GroundVector) => ({ x: width / 2 + point.x * mapScale, y: height / 2 + point.z * mapScale })
    const starts = getCarInitialPositions()
    const selfPosition = { x: starts.self.x + state.selfSpeed * KMH_TO_MPS * state.elapsed * directionVectors[state.selfDirection].x, z: starts.self.z + state.selfSpeed * KMH_TO_MPS * state.elapsed * directionVectors[state.selfDirection].z }
    const otherPosition = { x: starts.other.x + state.otherSpeed * KMH_TO_MPS * state.elapsed * directionVectors[state.otherDirection].x, z: starts.other.z + state.otherSpeed * KMH_TO_MPS * state.elapsed * directionVectors[state.otherDirection].z }
    const drawRoad = (position: GroundVector, direction: CardinalDirection) => {
      const vector = directionVectors[direction]
      const start = toCanvas({ x: position.x - vector.x * 120, z: position.z - vector.z * 120 })
      const end = toCanvas({ x: position.x + vector.x * 120, z: position.z + vector.z * 120 })
      context.lineCap = 'round'
      context.strokeStyle = '#aab2a8'
      context.lineWidth = 10
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
      context.strokeStyle = '#f9f5dd'
      context.lineWidth = 1
      context.setLineDash([4, 3])
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
      context.setLineDash([])
    }
    drawRoad({ x: 0, z: 0 }, state.selfDirection)
    drawRoad({ x: 0, z: 0 }, state.otherDirection)
    const drawCar = (position: GroundVector, direction: CardinalDirection, color: string, label: string) => {
      const point = toCanvas(position)
      const angle = Math.atan2(directionVectors[direction].z, directionVectors[direction].x)
      context.save()
      context.translate(point.x, point.y)
      context.rotate(angle)
      context.fillStyle = color
      context.beginPath(); context.roundRect(-10, -6, 20, 12, 4); context.fill()
      context.fillStyle = '#fff'
      context.font = '700 8px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(label, 0, 0)
      context.restore()
      const vector = directionVectors[direction]
      context.strokeStyle = color
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(point.x, point.y)
      context.lineTo(point.x + vector.x * 17, point.y + vector.z * 17)
      context.stroke()
    }
    drawCar(selfPosition, state.selfDirection, '#187e83', 'A')
    drawCar(otherPosition, state.otherDirection, '#d67852', 'B')
    return
  }
  const laneX = [width * 0.39, width * 0.66]
  context.setLineDash(state.mode === 'train' ? [2, 4] : [])
  context.strokeStyle = '#8d9891'
  context.lineWidth = 2
  for (const x of laneX) {
    context.beginPath(); context.moveTo(x, 10); context.lineTo(x, height - 10); context.stroke()
  }
  context.setLineDash([])
  const mapY = (speed: number, initialDistance: number) => {
    const travelRange = Math.max(1, height - 46)
    const mapScale = Math.min(0.42, travelRange / 160)
    const travel = (initialDistance + speed * KMH_TO_MPS * state.elapsed) * mapScale
    return ((height / 2 - 23 - travel + travelRange) % travelRange + travelRange) % travelRange + 23
  }
  const vehicles = [
    { x: laneX[0], y: mapY(state.selfSpeed, 0), color: '#187e83', label: 'A' },
    { x: laneX[1], y: mapY(state.otherSpeed, -getInitialGapZ()), color: '#d67852', label: 'B' },
  ]
  vehicles.forEach(({ x, y, color, label }, index) => {
    context.fillStyle = color
    context.beginPath()
    if (state.mode === 'train') context.roundRect(x - 8, y - 22, 16, 44, 5)
    else context.roundRect(x - 12, y - 14, 24, 28, 7)
    context.fill()
    context.fillStyle = '#fff'
    context.font = '700 9px sans-serif'
    context.textAlign = 'center'
    context.fillText(label, x, y + 3)
    const speed = index === 0 ? state.selfSpeed : state.otherSpeed
    if (speed !== 0) {
      const direction = Math.sign(speed)
      const arrowY = Math.min(height - 43, Math.max(43, y - direction * 27))
      context.strokeStyle = color
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(x, arrowY + direction * 7)
      context.lineTo(x, arrowY - direction * 7)
      context.lineTo(x - 4, arrowY - direction * 3)
      context.moveTo(x, arrowY - direction * 7)
      context.lineTo(x + 4, arrowY - direction * 3)
      context.stroke()
    }
  })
}

function formatSpeed(speed: number) {
  return speed > 0 ? `＋${speed}` : speed < 0 ? `−${Math.abs(speed)}` : '0'
}

function drawVelocityDiagram(vectors: { label: string; x: number; north: number; color: string }[], isCar: boolean) {
  const context = velocityCanvas.getContext('2d')
  if (!context) return
  const width = velocityCanvas.clientWidth
  const height = velocityCanvas.clientHeight
  const ratio = Math.min(window.devicePixelRatio, 2)
  velocityCanvas.width = Math.round(width * ratio)
  velocityCanvas.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#f5f6f0'
  context.fillRect(0, 0, width, height)

  const origin = { x: width / 2, y: height / 2 }
  const maxMagnitude = Math.max(1, ...vectors.map((vector) => Math.hypot(vector.x, vector.north)))
  const scale = Math.min(width * 0.38, height * 0.29) / maxMagnitude
  context.strokeStyle = '#cbd3cb'
  context.lineWidth = 1
  context.setLineDash([3, 4])
  context.beginPath(); context.moveTo(12, origin.y); context.lineTo(width - 12, origin.y); context.stroke()
  if (isCar) {
    context.beginPath(); context.moveTo(origin.x, 10); context.lineTo(origin.x, height - 10); context.stroke()
    context.setLineDash([])
    context.fillStyle = '#7f8b83'
    context.font = '10px sans-serif'
    context.textAlign = 'center'
    context.fillText('北', origin.x, 11)
    context.textAlign = 'right'
    context.fillText('東', width - 7, origin.y - 6)
  } else {
    context.setLineDash([])
    context.fillStyle = '#7f8b83'
    context.font = '10px sans-serif'
    context.textAlign = 'right'
    context.fillText('＋ 進行方向', width - 8, origin.y - 7)
  }

  vectors.forEach((vector) => {
    const end = { x: origin.x + vector.x * scale, y: origin.y - vector.north * scale }
    const angle = Math.atan2(end.y - origin.y, end.x - origin.x)
    const head = 8
    context.strokeStyle = vector.color
    context.fillStyle = vector.color
    context.lineWidth = 2.5
    context.beginPath(); context.moveTo(origin.x, origin.y); context.lineTo(end.x, end.y); context.stroke()
    if (Math.hypot(end.x - origin.x, end.y - origin.y) > 1) {
      context.beginPath()
      context.moveTo(end.x, end.y)
      context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6))
      context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6))
      context.closePath()
      context.fill()
    } else {
      context.beginPath(); context.arc(origin.x, origin.y, 3, 0, Math.PI * 2); context.fill()
    }
    context.font = '700 11px sans-serif'
    context.textAlign = end.x >= origin.x ? 'left' : 'right'
    context.textBaseline = end.y < origin.y ? 'bottom' : 'top'
    context.fillText(vector.label, end.x + (end.x >= origin.x ? 5 : -5), end.y + (end.y < origin.y ? -4 : 4))
  })
}

function updateReadings() {
  const isCar = state.mode === 'car'
  const fromOtherVehicle = state.viewpoint === 'other'
  const equivalentExample = !isCar && ((state.selfSpeed === -60 && state.otherSpeed === 0) || (state.selfSpeed === 0 && state.otherSpeed === 60))
  const selfVelocity = isCar ? getCarVelocity('self') : { x: 0, z: state.selfSpeed * KMH_TO_MPS }
  const otherVelocity = isCar ? getCarVelocity('other') : { x: 0, z: state.otherSpeed * KMH_TO_MPS }
  const relativeVector = fromOtherVehicle
    ? { x: selfVelocity.x - otherVelocity.x, z: selfVelocity.z - otherVelocity.z }
    : { x: otherVelocity.x - selfVelocity.x, z: otherVelocity.z - selfVelocity.z }
  const relativeSpeed = isCar
    ? Math.hypot(relativeVector.x, relativeVector.z) * 3.6
    : fromOtherVehicle ? state.selfSpeed - state.otherSpeed : state.otherSpeed - state.selfSpeed
  const carEastSpeed = relativeVector.x * 3.6
  const carNorthSpeed = -relativeVector.z * 3.6
  const diagramSelfX = isCar ? selfVelocity.x * 3.6 : state.selfSpeed
  const diagramOtherX = isCar ? otherVelocity.x * 3.6 : state.otherSpeed
  const diagramRelativeX = isCar ? carEastSpeed : relativeSpeed
  const diagramSelfNorth = isCar ? -selfVelocity.z * 3.6 : 0
  const diagramOtherNorth = isCar ? -otherVelocity.z * 3.6 : 0
  const diagramRelativeNorth = isCar ? carNorthSpeed : 0
  const carDirection = `${carNorthSpeed > 0.5 ? '北' : carNorthSpeed < -0.5 ? '南' : ''}${carEastSpeed > 0.5 ? '東' : carEastSpeed < -0.5 ? '西' : ''}` || '停止'
  const closestApproach = isCar ? getClosestApproach() : null
  const formattedSelfSpeed = isCar ? `${Math.abs(state.selfSpeed)}` : formatSpeed(state.selfSpeed)
  const formattedOtherSpeed = isCar ? `${Math.abs(state.otherSpeed)}` : formatSpeed(state.otherSpeed)
  selfOutput.value = formattedSelfSpeed
  selfOutput.textContent = formattedSelfSpeed
  otherOutput.value = formattedOtherSpeed
  otherOutput.textContent = formattedOtherSpeed
  const formattedDistance = state.initialDistance > 0 ? `＋${state.initialDistance} m` : state.initialDistance < 0 ? `−${Math.abs(state.initialDistance)} m` : '0 m'
  distanceOutput.value = formattedDistance
  distanceOutput.textContent = formattedDistance
  selfStartDistanceInput.value = String(state.selfStartDistance)
  otherStartDistanceInput.value = String(state.otherStartDistance)
  $('#self-start-output').textContent = `${state.selfStartDistance} m`
  $('#other-start-output').textContent = `${state.otherStartDistance} m`
  $('#relative-caption').textContent = isCar ? '相対速度の大きさ' : fromOtherVehicle ? '相手から見た自分の速度' : state.viewpoint === 'self' ? '自分から見た相手の速度' : '2台の相対速度'
  const formula = isCar
    ? String.raw`\vec{v}_{B/A}=\vec{v}_B-\vec{v}_A`
    : fromOtherVehicle ? String.raw`v_{A/B}=v_A-v_B` : String.raw`v_{B/A}=v_B-v_A`
  katex.render(formula, $('#relative-formula'), { throwOnError: false, displayMode: false })
  $('#relative-speed').textContent = isCar ? `${Math.round(relativeSpeed)}` : formatSpeed(relativeSpeed)
  $('#relative-direction').textContent = isCar
    ? `${fromOtherVehicle ? '自分' : '相手'}は${carDirection}へ動いて見える`
    : relativeSpeed === 0 ? '相手は止まって見える' : relativeSpeed > 0 ? '前方へ動いて見える' : '後方へ動いて見える'
  $('#result-arrow').textContent = isCar
    ? `${carNorthSpeed > 0.5 ? '↑' : carNorthSpeed < -0.5 ? '↓' : ''}${carEastSpeed > 0.5 ? '→' : carEastSpeed < -0.5 ? '←' : ''}` || '↔'
    : relativeSpeed === 0 ? '↔' : relativeSpeed > 0 ? '↑' : '↓'
  $('#velocity-basis').textContent = isCar ? '北 ↑ · 東 →' : '線路方向 · 右が＋'
  const vectorValue = (x: number, north: number) => isCar
    ? `東 ${formatSpeed(Math.round(x))}，北 ${formatSpeed(Math.round(north))} km/h`
    : `${formatSpeed(Math.round(x))} km/h`
  $('#vector-self-value').textContent = vectorValue(diagramSelfX, diagramSelfNorth)
  $('#vector-other-value').textContent = vectorValue(diagramOtherX, diagramOtherNorth)
  $('#vector-relative-value').textContent = vectorValue(diagramRelativeX, diagramRelativeNorth)
  velocityCanvas.setAttribute('aria-label', isCar ? '東西・南北成分による自分，相手，相対速度ベクトル' : '線路方向の自分，相手，相対速度ベクトル')
  drawVelocityDiagram([
    { label: '自分', x: diagramSelfX, north: diagramSelfNorth, color: '#187e83' },
    { label: '相手', x: diagramOtherX, north: diagramOtherNorth, color: '#d67852' },
    { label: '相対', x: diagramRelativeX, north: diagramRelativeNorth, color: '#263835' },
  ], isCar)
  $('#car-analysis').toggleAttribute('hidden', !isCar)
  if (isCar && closestApproach) {
    $('#relative-vector').textContent = `東 ${formatSpeed(Math.round(carEastSpeed))} km/h，北 ${formatSpeed(Math.round(carNorthSpeed))} km/h`
    $('#collision-status').textContent = closestApproach.status
    $('#closest-approach').textContent = closestApproach.time === null
      ? `現在の距離 ${closestApproach.distance.toFixed(1)} m`
      : closestApproach.time > 0
        ? `${closestApproach.time.toFixed(1)} 秒後に最接近 · ${closestApproach.distance.toFixed(1)} m`
        : `現在の距離 ${closestApproach.distance.toFixed(1)} m`
  }
  const relativeExplanation = relativeSpeed === 0
    ? `2つの速度が同じなので，${fromOtherVehicle ? '相手から見ても自分の位置は' : '相手の位置は'}変わりません。`
    : `${fromOtherVehicle ? '自分の速度から相手の速度を引くと' : '相手の速度から自分の速度を引くと'} ${formatSpeed(relativeSpeed)} km/h。${fromOtherVehicle ? '相手' : '自分'}から見ると${relativeSpeed > 0 ? '前方' : '後方'}へ動いて見えます。`
  $('#reading-explanation').textContent = isCar
    ? `東西・南北の成分はそれぞれ ${formatSpeed(Math.round(carEastSpeed))} km/h，${formatSpeed(Math.round(carNorthSpeed))} km/h。速度ベクトルから最接近を計算します。`
    : equivalentExample
    ? `${relativeExplanation} 車内映像は同じ見え方です。上の配置図は地面基準なので，2例の違いを示します。`
    : `${relativeExplanation} 初期距離 ${formattedDistance} は位置だけを変え，速度差は変えません。`
  $('#teaching-note').textContent = !state.showScenery
    ? isCar
      ? '車は東西南北の直線上を走ります。初期位置と速度ベクトルから，衝突するかどうかを判定します。'
      : equivalentExample
      ? '周囲の目印がない車内映像では，どちらが静止中か判断できません。上の俯瞰図は地面基準の外部視点です。'
      : '周囲の目印がなければ，どちらが静止しているかは判断できません。観測できるのは2台の相対運動です。'
    : isCar
      ? closestApproach?.status === 'コリジョンコース'
        ? '進路が交差し，最接近する時刻も一致しています。一定の直線運動を続けると衝突します。'
        : '進行方向は固定した直線です。交差点を通る場合も，到着時刻がずれれば衝突しません。'
      : equivalentExample
      ? '自分が−60 km/h・相手が0と，自分が0・相手が＋60 km/hは，同じ速さで離れていきます。'
      : state.selfSpeed === 0
    ? state.otherSpeed === 0
      ? '自分も相手も静止しています。位置関係も窓の外の景色も変わりません。'
      : '相手だけが動いています。窓の外で横の乗り物が流れると，自分が動いたように感じることがあります。'
    : `自分が${formatSpeed(state.selfSpeed)} km/hで進むため，地面に止まった景色は${state.selfSpeed > 0 ? '後方' : '前方'}へ流れて見えます。`
  drawMap()
}

function setMode(mode: Mode) {
  state.mode = mode
  resetCollisionState()
  app.classList.toggle('is-car', mode === 'car')
  selfInput.min = mode === 'car' ? '0' : '-100'
  otherInput.min = mode === 'car' ? '0' : '-100'
  if (mode === 'car') {
    state.selfSpeed = Math.abs(state.selfSpeed)
    state.otherSpeed = Math.abs(state.otherSpeed)
  }
  selfInput.value = String(state.selfSpeed)
  otherInput.value = String(state.otherSpeed)
  $('#speed-caption').textContent = mode === 'car' ? '方位を別に指定 · 速さの大きさ' : '地面基準 · ＋は進行方向'
  document.querySelectorAll('.speed-control .range-ends').forEach((ends) => {
    const labels = mode === 'car' ? ['0', '50', '100 km/h'] : ['−100', '0', '＋100 km/h']
    Array.from(ends.children).forEach((label, index) => { label.textContent = labels[index] })
  })
  document.querySelectorAll<HTMLButtonElement>('.mode-button').forEach((button) => {
    const selected = button.dataset.mode === mode
    button.classList.toggle('is-active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
  document.querySelectorAll('.vehicle-label').forEach((label) => { label.textContent = mode === 'train' ? '電車' : '車' })
  $('#scene-location').textContent = mode === 'train' ? '郊外 · 線路沿い' : '郊外 · 片側一車線'
  $('#map-orientation').textContent = mode === 'train' ? '進行方向 ↑' : '北 ↑ · 東 →'
  syncSceneVisibility()
  updateOptionButtons()
  updateDirectionButtons()
  railGroup.visible = mode === 'train'
  roadMarks.visible = mode === 'car'
  asphalt.visible = mode === 'car'
  crossStreetGroup.visible = mode === 'car'
  $('#scene-canvas').setAttribute('aria-label', mode === 'train' ? '電車から見た走行中の風景' : '車から見た3D走行中の風景')
  updateReadings()
}

function setViewpoint(viewpoint: Viewpoint) {
  state.viewpoint = viewpoint
  state.cameraPosition = getCameraPositionTowardTarget(viewpoint)
  document.querySelectorAll<HTMLButtonElement>('.view-button').forEach((button) => {
    const selected = button.dataset.view === viewpoint
    button.classList.toggle('is-active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
  syncSceneVisibility()
  $('#view-label').textContent = viewpoint === 'self' ? '自分の乗り物から' : viewpoint === 'other' ? '相手の乗り物から' : '地上からの視点'
  updateOptionButtons()
  $('#caption-tag').textContent = viewpoint === 'self' ? '自分側カメラ' : viewpoint === 'other' ? '相手側カメラ' : '地上カメラ'
  $('#scene-caption').textContent = state.showScenery
    ? viewpoint === 'self' ? '相手の乗り物が動いて見える' : viewpoint === 'other' ? '自分の乗り物が動いて見える' : '2台の位置を地面から観察'
    : '周囲を隠して乗り物だけを表示'
  sceneCanvas.setAttribute('aria-label', viewpoint === 'self' ? '自分の乗り物から見た走行中の風景' : viewpoint === 'other' ? '相手の乗り物から自分を見た走行風景' : '地上から2台を見た走行風景')
  $('#scene-wrap').classList.toggle('is-outside', viewpoint === 'outside')
  updateReadings()
}

function setCameraPosition(position: 'front' | 'rear') {
  state.cameraPosition = position
  updateOptionButtons()
}

function setSceneryVisible(visible: boolean) {
  state.showScenery = visible
  syncSceneVisibility()
  updateOptionButtons()
  $('#scene-caption').textContent = visible
    ? state.viewpoint === 'self' ? '相手の乗り物が動いて見える' : state.viewpoint === 'other' ? '自分の乗り物が動いて見える' : '2台の位置を地面から観察'
    : '周囲を隠して乗り物だけを表示'
  updateReadings()
}

function syncSpeed(input: HTMLInputElement, key: 'selfSpeed' | 'otherSpeed') {
  state[key] = Number(input.value)
  document.querySelectorAll<HTMLButtonElement>('.preset-button').forEach((button) => {
    button.classList.toggle('is-selected', Number(button.dataset.self) === state.selfSpeed && Number(button.dataset.other) === state.otherSpeed)
  })
  updateReadings()
}

document.querySelectorAll<HTMLButtonElement>('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode as Mode)))
document.querySelectorAll<HTMLButtonElement>('.view-button').forEach((button) => button.addEventListener('click', () => setViewpoint(button.dataset.view as Viewpoint)))
document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => button.addEventListener('click', () => setCameraPosition(button.dataset.camera as 'front' | 'rear')))
document.querySelectorAll<HTMLButtonElement>('[data-scenery]').forEach((button) => button.addEventListener('click', () => setSceneryVisible(button.dataset.scenery === 'shown')))
document.querySelectorAll<HTMLButtonElement>('[data-direction-for]').forEach((button) => button.addEventListener('click', () => {
  const direction = button.dataset.direction as CardinalDirection
  if (button.dataset.directionFor === 'self') state.selfDirection = direction
  else state.otherDirection = direction
  state.cameraPosition = getCameraPositionTowardTarget(state.viewpoint)
  updateDirectionButtons()
  updateOptionButtons()
  updateReadings()
}))
document.querySelectorAll<HTMLButtonElement>('.preset-button').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.carPreset) {
    setMode('car')
    state.selfSpeed = 60
    state.otherSpeed = 60
    state.selfDirection = button.dataset.carPreset === 'collision' ? 'north' : 'west'
    state.otherDirection = button.dataset.carPreset === 'collision' ? 'west' : 'south'
    state.selfStartDistance = 60
    state.otherStartDistance = button.dataset.carPreset === 'collision' ? 60 : 75
    state.elapsed = 0
    state.playing = false
    resetCollisionState()
    $('#play-toggle').classList.remove('is-playing')
    $('#play-toggle').setAttribute('aria-label', 'シミュレーションを再生')
    $('#play-toggle span:last-child').textContent = '走らせる'
    selfInput.value = '60'
    otherInput.value = '60'
    setViewpoint('outside')
    setSceneryVisible(true)
    updateDirectionButtons()
  } else {
  selfInput.value = button.dataset.self ?? '0'
  otherInput.value = button.dataset.other ?? '0'
  state.selfSpeed = Number(selfInput.value)
  state.otherSpeed = Number(otherInput.value)
  if (button.dataset.equivalent === 'true') {
    setViewpoint('self')
    setSceneryVisible(false)
  } else {
    setSceneryVisible(true)
    state.cameraPosition = getCameraPositionTowardTarget(state.viewpoint)
    updateOptionButtons()
  }
  }
  selfStartDistanceInput.value = String(state.selfStartDistance)
  otherStartDistanceInput.value = String(state.otherStartDistance)
  document.querySelectorAll('.preset-button').forEach((preset) => preset.classList.toggle('is-selected', preset === button))
  updateReadings()
}))
selfInput.addEventListener('input', () => syncSpeed(selfInput, 'selfSpeed'))
otherInput.addEventListener('input', () => syncSpeed(otherInput, 'otherSpeed'))
selfStartDistanceInput.addEventListener('input', () => { state.selfStartDistance = Number(selfStartDistanceInput.value); updateReadings() })
otherStartDistanceInput.addEventListener('input', () => { state.otherStartDistance = Number(otherStartDistanceInput.value); updateReadings() })
distanceInput.addEventListener('input', () => {
  state.initialDistance = Number(distanceInput.value)
  document.querySelectorAll<HTMLButtonElement>('.preset-button').forEach((button) => button.classList.remove('is-selected'))
  state.cameraPosition = getCameraPositionTowardTarget(state.viewpoint)
  updateOptionButtons()
  updateReadings()
})

$('#play-toggle').addEventListener('click', () => {
  if (state.collisionTriggered) {
    state.elapsed = 0
    resetCollisionState()
    if (state.mode === 'car') updateCarProximity()
  }
  state.playing = !state.playing
  $('#play-toggle').classList.toggle('is-playing', state.playing)
  $('#play-toggle').setAttribute('aria-label', state.playing ? 'シミュレーションを一時停止' : 'シミュレーションを再生')
  $('#play-toggle span:last-child').textContent = state.playing ? '一時停止' : '走らせる'
})
$('#reset-time').addEventListener('click', () => {
  state.elapsed = 0
  state.playing = false
  resetCollisionState()
  $('#play-toggle').classList.remove('is-playing')
  $('#play-toggle').setAttribute('aria-label', 'シミュレーションを再生')
  $('#play-toggle span:last-child').textContent = '走らせる'
  $('#elapsed-time').textContent = '00:00'
  if (state.mode === 'car') updateCarProximity()
  drawMap()
})

function resize() {
  const { width, height } = sceneCanvas.getBoundingClientRect()
  if (!width || !height) return
  if (renderer.domElement.width === Math.round(width * renderer.getPixelRatio()) && renderer.domElement.height === Math.round(height * renderer.getPixelRatio())) return
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  drawMap()
}
new ResizeObserver(resize).observe(sceneCanvas)
window.addEventListener('resize', resize)
resize()

function animateTrainScene(time: number) {
  setCameraFieldOfView(53)
  camera.up.set(0, 1, 0)
  const motionScale = KMH_TO_MPS
  const observerSpeed = state.viewpoint === 'self' ? state.selfSpeed : state.viewpoint === 'other' ? state.otherSpeed : 0
  scenery.forEach((object) => {
    const baseZ = Number(object.userData.baseZ ?? object.position.z)
    object.userData.baseZ = baseZ
    object.position.z = state.viewpoint === 'outside' ? baseZ : wrapZ(baseZ + observerSpeed * time * motionScale)
  })
  for (const mark of [...sleepers, ...movingRoadMarks]) {
    const baseZ = Number(mark.userData.baseZ)
    mark.position.z = state.viewpoint === 'outside' ? baseZ : wrapZ(baseZ + observerSpeed * time * motionScale)
  }
  const { self: selfVehicle, other: otherVehicle } = getActiveVehicles()
  const initialGapZ = getInitialGapZ()
  const laneOffset = state.mode === 'train' ? 1.7 : 1.8
  if (state.viewpoint === 'outside') {
    selfVehicle.position.set(-laneOffset, 0, wrapZ(-state.selfSpeed * time * motionScale))
    otherVehicle.position.set(laneOffset, 0, wrapZ(initialGapZ - state.otherSpeed * time * motionScale))
    const trackDirection = state.cameraPosition === 'front' ? getSelfForwardZ() : -getSelfForwardZ()
    const outsideCameraZ = -trackDirection * 32
    camera.position.set(16, 11, outsideCameraZ)
    camera.lookAt(16, 0.8, outsideCameraZ + trackDirection * 60)
  } else {
    const watchingOther = state.viewpoint === 'other'
    const observerLane = watchingOther ? laneOffset : -laneOffset
    const targetLane = -observerLane
    const relativeDistance = watchingOther ? -initialGapZ : initialGapZ
    const relativeSpeed = watchingOther ? state.otherSpeed - state.selfSpeed : state.selfSpeed - state.otherSpeed
    const cameraHeight = state.mode === 'train' ? 2.12 : 1.62
    const lookHeight = state.mode === 'train' ? 1.6 : 1.22
    const observerForwardZ = watchingOther ? getOtherForwardZ() : getSelfForwardZ()
    const viewDirectionZ = state.cameraPosition === 'front' ? observerForwardZ : -observerForwardZ
    const cameraOffset = state.mode === 'train' ? 4.9 : 1.45
    const cameraZ = viewDirectionZ * cameraOffset
    const targetVehicle = watchingOther ? selfVehicle : otherVehicle
    const hiddenVehicle = watchingOther ? otherVehicle : selfVehicle
    targetVehicle.position.set(targetLane, 0, wrapZ(relativeDistance + relativeSpeed * time * motionScale))
    hiddenVehicle.position.set(observerLane, 0, 150)
    camera.position.set(observerLane, cameraHeight, cameraZ)
    camera.lookAt(observerLane, lookHeight, cameraZ + viewDirectionZ * 36)
  }
}

function animateCarScene(time: number) {
  const selfVelocity = getCarVelocity('self')
  const otherVelocity = getCarVelocity('other')
  const initialPosition = getCarRelativePosition()
  const relativeVelocity = { x: otherVelocity.x - selfVelocity.x, z: otherVelocity.z - selfVelocity.z }
  const starts = getCarInitialPositions()
  const selfPosition = { x: starts.self.x + selfVelocity.x * time, z: starts.self.z + selfVelocity.z * time }
  const otherPosition = { x: starts.other.x + otherVelocity.x * time, z: starts.other.z + otherVelocity.z * time }
  const { self: selfVehicle, other: otherVehicle } = getActiveVehicles()
  const observerIsOther = state.viewpoint === 'other'
  const observerVelocity = observerIsOther ? otherVelocity : selfVelocity
  const observerDirection = directionVectors[observerIsOther ? state.otherDirection : state.selfDirection]
  selfVehicle.rotation.y = getCarHeading(state.selfDirection)
  otherVehicle.rotation.y = getCarHeading(state.otherDirection)

  if (state.viewpoint === 'outside') {
    environment.position.set(0, 0, 0)
    selfVehicle.position.set(selfPosition.x, 0, selfPosition.z)
    otherVehicle.position.set(otherPosition.x, 0, otherPosition.z)
    setCameraFieldOfView(70)
    camera.up.set(0, 0, -1)
    const cameraSign = state.cameraPosition === 'front' ? 1 : -1
    camera.position.set(observerDirection.x * cameraSign * 25, 120, observerDirection.z * cameraSign * 25)
    camera.lookAt(0, 0, 0)
    return
  }

  setCameraFieldOfView(53)
  camera.up.set(0, 1, 0)
  const observerStart = observerIsOther ? starts.other : starts.self
  environment.position.set(
    wrapZ(-observerStart.x - observerVelocity.x * time),
    0,
    wrapZ(-observerStart.z - observerVelocity.z * time),
  )
  const cameraDirection = state.cameraPosition === 'front' ? observerDirection : { x: -observerDirection.x, z: -observerDirection.z }
  const cameraOffset = state.mode === 'car' ? 1.8 : 1.4
  const cameraHeight = 1.62
  camera.position.set(cameraDirection.x * cameraOffset, cameraHeight, cameraDirection.z * cameraOffset)
  camera.lookAt(camera.position.x + cameraDirection.x * 36, 1.22, camera.position.z + cameraDirection.z * 36)

  if (observerIsOther) {
    selfVehicle.position.set(-initialPosition.x - relativeVelocity.x * time, 0, -initialPosition.z - relativeVelocity.z * time)
    otherVehicle.position.set(0, 0, 150)
  } else {
    otherVehicle.position.set(initialPosition.x + relativeVelocity.x * time, 0, initialPosition.z + relativeVelocity.z * time)
    selfVehicle.position.set(0, 0, 150)
  }
  const targetVehicle = observerIsOther ? selfVehicle : otherVehicle
  targetVehicle.rotation.y = getCarHeading(observerIsOther ? state.selfDirection : state.otherDirection)
}

function animate() {
  requestAnimationFrame(animate)
  const frameTime = performance.now()
  const delta = Math.min((frameTime - previousFrameTime) / 1000, 0.05)
  previousFrameTime = frameTime
  if (state.playing) {
    const approach = state.mode === 'car' ? getClosestApproach() : null
    if (approach?.status === 'コリジョンコース' && approach.time !== null && approach.time <= delta) {
      state.elapsed += Math.max(0, approach.time)
      triggerCollision()
    } else {
      state.elapsed += delta
    }
  }
  const time = state.elapsed

  if (state.mode === 'car') animateCarScene(time)
  else animateTrainScene(time)
  $('#elapsed-time').textContent = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`
  renderer.render(scene, camera)
  if (state.mode === 'car' && state.playing) updateCarProximity()
  if (state.playing) drawMap()
}

setMode('train')
setViewpoint('self')
animate()
