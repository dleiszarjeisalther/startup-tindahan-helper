/**
 * Interactive 3D Background with Three.js
 * Startup Tindahan Helper Marketing Page
 */

(function () {
  const container = document.getElementById('three-hero-container');
  if (!container) return;

  // Scene setup
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 18;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.id = 'three-canvas';
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const blueLight = new THREE.PointLight(0x208aef, 3, 50);
  blueLight.position.set(-10, 8, 10);
  scene.add(blueLight);

  const greenLight = new THREE.PointLight(0x10b981, 2.5, 50);
  greenLight.position.set(10, -6, 8);
  scene.add(greenLight);

  const goldLight = new THREE.PointLight(0xf59e0b, 2, 40);
  goldLight.position.set(0, 10, 5);
  scene.add(goldLight);

  // Group of floating 3D objects
  const objectsGroup = new THREE.Group();
  scene.add(objectsGroup);

  // Materials
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.25,
    wireframe: false,
  });

  const techCubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x208aef,
    metalness: 0.4,
    roughness: 0.2,
    transparent: true,
    opacity: 0.85,
  });

  const emeraldCubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    metalness: 0.5,
    roughness: 0.3,
    transparent: true,
    opacity: 0.8,
  });

  // Coin Geometry (Cylinder)
  const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32);

  // Store Box Geometry
  const boxGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);

  // Create floating elements
  const floatingMeshes = [];

  // Helper to spawn meshes
  function addFloatingItem(geo, mat, x, y, z, rotSpeedX, rotSpeedY) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI;
    objectsGroup.add(mesh);
    floatingMeshes.push({
      mesh,
      origY: y,
      speed: 0.005 + Math.random() * 0.01,
      offset: Math.random() * Math.PI * 2,
      rx: rotSpeedX,
      ry: rotSpeedY,
    });
  }

  // Position items across viewport
  addFloatingItem(coinGeo, coinMaterial, -9, 4, -2, 0.01, 0.015);
  addFloatingItem(coinGeo, coinMaterial, 8, -4, -3, -0.012, 0.01);
  addFloatingItem(boxGeo, techCubeMaterial, -7, -3, 0, 0.008, 0.012);
  addFloatingItem(boxGeo, emeraldCubeMaterial, 9, 3, -1, -0.01, 0.008);
  addFloatingItem(coinGeo, coinMaterial, 6, 6, -4, 0.015, -0.01);
  addFloatingItem(boxGeo, techCubeMaterial, -4, 7, -5, 0.009, 0.01);

  // Starfield / Micro-particles
  const particleCount = 200;
  const particleGeo = new THREE.BufferGeometry();
  const particleCoords = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    particleCoords[i] = (Math.random() - 0.5) * 45;
    particleCoords[i + 1] = (Math.random() - 0.5) * 35;
    particleCoords[i + 2] = (Math.random() - 0.5) * 20;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particleCoords, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.12,
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.7,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Mouse interaction
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  window.addEventListener('mousemove', (e) => {
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    targetX = (e.clientX - halfWidth) * 0.001;
    targetY = (e.clientY - halfHeight) * 0.001;
  });

  // Handle Resize
  window.addEventListener('resize', () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Animation Loop
  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Smooth camera drift with mouse
    mouseX += (targetX - mouseX) * 0.05;
    mouseY += (targetY - mouseY) * 0.05;
    objectsGroup.rotation.y = mouseX * 2;
    objectsGroup.rotation.x = mouseY * 2;

    // Animate individual meshes
    floatingMeshes.forEach((item) => {
      item.mesh.rotation.x += item.rx;
      item.mesh.rotation.y += item.ry;
      item.mesh.position.y = item.origY + Math.sin(elapsedTime * 1.5 + item.offset) * 0.4;
    });

    // Rotate particle starfield
    particles.rotation.y = elapsedTime * 0.02;

    renderer.render(scene, camera);
  }

  animate();
})();
