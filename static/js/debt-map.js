// Schwing — Orbital Debt Map (Three.js)
// Renders a 3D orbital scene: a glowing "YOU" core with debts orbiting as colored spheres.

function interestColor(rate) {
  if (rate < 8) return 0x10b981;
  if (rate < 14) return 0xeab308;
  if (rate < 20) return 0xf97316;
  return 0xef4444;
}

function makeTextSprite(text, color, scale) {
  scale = scale || 0.4;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 48;
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = metrics.width + 20;
  canvas.height = fontSize + 20;
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(scale * aspect * 2.2, scale * 2.2, 1);
  return sprite;
}

/**
 * Initialize the orbital debt scene.
 * @param {Object} opts
 * @param {HTMLElement} opts.container - element to mount the canvas in
 * @param {Array} opts.debts - [{name, monthly_emi, total_amount, interest_rate}]
 * @param {number} opts.takeHome - monthly take-home
 * @param {boolean} [opts.interactive=true] - enable drag rotation + click details
 * @param {boolean} [opts.autoRotate=true] - slow auto rotation
 * @param {Function} [opts.onSelect] - callback(userData) when an orb is clicked
 * @returns {Object} handle with { renderer, dispose }
 */
function initOrbitalDebtMap(opts) {
  const {
    container,
    debts,
    takeHome,
    interactive = true,
    autoRotate = true,
    onSelect = null,
    cameraDistance = 11
  } = opts;

  const W = container.clientWidth || window.innerWidth;
  const H = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = null; // transparent, let CSS bg show through
  scene.fog = new THREE.Fog(0xf0f9ff, 9, 28);

  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  camera.position.set(0, 2.5, cameraDistance);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(5, 8, 5);
  scene.add(dirLight);

  // Ambient particles
  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0x12AAED, size: 0.06, transparent: true, opacity: 0.3 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Center "YOU" core
  const coreGroup = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(0.9, 2);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0A1628,
    emissive: 0x12AAED,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.4
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  coreGroup.add(core);

  const haloGeo = new THREE.SphereGeometry(1.3, 32, 32);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x12AAED, transparent: true, opacity: 0.12 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  coreGroup.add(halo);
  scene.add(coreGroup);

  // Debt orbs
  const totalEMI = debts.reduce((s, d) => s + d.monthly_emi, 0);
  const surplus = Math.max(0, takeHome - totalEMI);

  const allItems = [...debts];
  if (surplus > 0) {
    allItems.push({ name: 'Savings / Surplus', monthly_emi: surplus, interest_rate: -1, total_amount: 0, isSurplus: true });
  }

  const rotatingGroup = new THREE.Group();
  const orbData = [];

  const n = allItems.length;
  allItems.forEach((item, i) => {
    const angle = (i / n) * Math.PI * 2;
    const orbitRadius = 3.2 + (i % 2) * 1.1;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = Math.sin(angle * 2) * 0.6;

    const size = 0.22 + Math.min(0.55, (item.monthly_emi / takeHome) * 2.2);
    const color = item.isSurplus ? 0x10b981 : interestColor(item.interest_rate);

    const geo = new THREE.SphereGeometry(size, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.3
    });
    const orb = new THREE.Mesh(geo, mat);
    orb.position.set(x, y, z);
    orb.userData = {
      ...item,
      colorHex: '#' + color.toString(16).padStart(6, '0'),
      baseY: y,
      phase: Math.random() * Math.PI * 2
    };
    rotatingGroup.add(orb);
    orbData.push(orb);

    // connecting tube
    const dist = Math.sqrt(x * x + y * y + z * z);
    const cylGeo = new THREE.CylinderGeometry(
      0.015 + (item.monthly_emi / takeHome) * 0.05,
      0.015 + (item.monthly_emi / takeHome) * 0.05,
      dist, 8
    );
    const cylMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(x / 2, y / 2, z / 2);
    cyl.lookAt(0, 0, 0);
    cyl.rotateX(Math.PI / 2);
    rotatingGroup.add(cyl);

    // labels
    const label = makeTextSprite(item.name, item.isSurplus ? '#10b981' : '#0A1628');
    label.position.set(x * 1.35, y + size + 0.45, z * 1.35);
    rotatingGroup.add(label);

    const emiLabel = makeTextSprite(`₹${Math.round(item.monthly_emi / 1000)}k/mo`, '#6b7280', 0.32);
    emiLabel.position.set(x * 1.35, y + size + 0.1, z * 1.35);
    rotatingGroup.add(emiLabel);
  });

  scene.add(rotatingGroup);

  // Interaction
  let isDragging = false;
  let prevX = 0, prevY = 0;
  let targetRotY = 0, targetRotX = 0;
  let currentRotY = 0, currentRotX = 0;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onPointerDown(x, y) {
    isDragging = true;
    prevX = x;
    prevY = y;
  }
  function onPointerMove(x, y) {
    if (!isDragging) return;
    const dx = x - prevX;
    const dy = y - prevY;
    targetRotY += dx * 0.005;
    targetRotX += dy * 0.003;
    targetRotX = Math.max(-0.6, Math.min(0.6, targetRotX));
    prevX = x;
    prevY = y;
  }
  function onPointerUp() { isDragging = false; }

  const dom = renderer.domElement;
  let cleanupFns = [];

  if (interactive) {
    const mdown = (e) => onPointerDown(e.clientX, e.clientY);
    const mmove = (e) => onPointerMove(e.clientX, e.clientY);
    const mup = () => onPointerUp();
    const tstart = (e) => onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    const tmove = (e) => onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    const tend = () => onPointerUp();

    dom.addEventListener('mousedown', mdown);
    window.addEventListener('mousemove', mmove);
    window.addEventListener('mouseup', mup);
    dom.addEventListener('touchstart', tstart, { passive: true });
    window.addEventListener('touchmove', tmove, { passive: true });
    window.addEventListener('touchend', tend);

    const click = (e) => {
      const rect = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(orbData);
      if (intersects.length > 0 && onSelect) {
        onSelect(intersects[0].object.userData);
      }
    };
    dom.addEventListener('click', click);

    cleanupFns.push(() => {
      dom.removeEventListener('mousedown', mdown);
      window.removeEventListener('mousemove', mmove);
      window.removeEventListener('mouseup', mup);
      dom.removeEventListener('touchstart', tstart);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend', tend);
      dom.removeEventListener('click', click);
    });
  }

  // Animation loop
  const clock = new THREE.Clock();
  let rafId;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    currentRotY += (targetRotY - currentRotY) * 0.08;
    currentRotX += (targetRotX - currentRotX) * 0.08;

    rotatingGroup.rotation.y = currentRotY + (autoRotate ? t * 0.05 : 0);
    rotatingGroup.rotation.x = currentRotX;

    core.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04);
    halo.scale.setScalar(1 + Math.sin(t * 1.5) * 0.08);
    coreGroup.rotation.y = t * 0.15;

    orbData.forEach(orb => {
      orb.position.y = orb.userData.baseY + Math.sin(t * 0.8 + orb.userData.phase) * 0.15;
    });

    particles.rotation.y = t * 0.01;

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    cleanupFns.forEach(fn => fn());
    renderer.dispose();
    if (dom.parentElement) dom.parentElement.removeChild(dom);
  }

  // Trigger initial selection
  if (orbData.length > 0 && onSelect) {
    onSelect(orbData[0].userData);
  }

  return { renderer, scene, camera, orbData, dispose };
}   