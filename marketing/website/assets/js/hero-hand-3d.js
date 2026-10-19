/**
 * Three.js 3D Hand Cursor & Interactive Auto-Scroll
 * Startup Tindahan Helper Marketing Page
 * 
 * Features:
 * - Responsive 3D stylized hand pointing up at the curiosity pill button
 * - 3-second initial idle delay
 * - Upward click gesture with 3D ripple ring and button press feedback
 * - Progressive scroll down towards video demo
 * - Immediate auto-stop on any user scroll or gesture
 */

(function () {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', () => {
    const handContainer = document.getElementById('three-hand-container');
    const pillBtn = document.getElementById('curiosity-pill-btn');
    const pillBox = document.getElementById('curiosity-pill-box');
    const videoSection = document.getElementById('video-demo');

    if (!handContainer || typeof THREE === 'undefined') return;

    let renderer, scene, camera, handGroup, rippleMesh;
    let animId = null;
    let autoScrollInterval = null;
    let isTerminated = false;
    let isUserInteracting = false;
    let animationStarted = false;

    // --- Stop & Cleanup Everything ---
    function stopHandAnimation() {
      if (isTerminated) return;
      isTerminated = true;

      // Restore default smooth scroll behavior
      document.documentElement.style.scrollBehavior = '';

      // Stop scrolling interval
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }

      // Smooth fade out of hand container
      if (handContainer) {
        handContainer.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        handContainer.style.opacity = '0';
        handContainer.style.transform = 'translateY(18px) scale(0.92)';
        setTimeout(() => {
          if (handContainer.parentNode) {
            handContainer.style.display = 'none';
          }
        }, 400);
      }

      // Stop Three.js animation loop to preserve battery & performance
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }

    // Stop immediately on any user gesture or scroll
    const userEvents = ['wheel', 'touchstart', 'touchmove', 'keydown', 'mousedown'];
    userEvents.forEach(evt => {
      window.addEventListener(evt, () => {
        isUserInteracting = true;
        stopHandAnimation();
      }, { passive: true, once: true });
    });

    // Also stop if user scrolls manually past top
    window.addEventListener('scroll', () => {
      if (window.scrollY > 25 && !autoScrollInterval) {
        stopHandAnimation();
      }
    }, { passive: true });

    // Handle viewport resize / screen orientation changes
    window.addEventListener('resize', () => {
      if (!renderer || !camera || !handContainer || isTerminated) return;
      const w = handContainer.clientWidth || 140;
      const h = handContainer.clientHeight || 160;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, { passive: true });

    // --- Build Three.js 3D Hand Scene ---
    function init3DHand() {
      const width = handContainer.clientWidth || 140;
      const height = handContainer.clientHeight || 160;

      scene = new THREE.Scene();

      // Camera positioned looking down slightly at hand
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 0.4, 6.2);
      camera.lookAt(0, 0.4, 0);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = false;
      handContainer.appendChild(renderer.domElement);

      // --- Lights ---
      const ambientLight = new THREE.AmbientLight(0xfff5eb, 0.85);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      keyLight.position.set(3, 5, 4);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
      fillLight.position.set(-3, 0, 3);
      scene.add(fillLight);

      const emeraldRim = new THREE.PointLight(0x10b981, 2.2, 8);
      emeraldRim.position.set(0, 2.2, 1.5);
      scene.add(emeraldRim);

      // --- Hand Meshes ---
      handGroup = new THREE.Group();
      scene.add(handGroup);

      // Materials
      const skinMaterial = new THREE.MeshStandardMaterial({
        color: 0xF6B278, // Warm stylized cartoon skin tone
        roughness: 0.32,
        metalness: 0.04
      });

      const nailMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFBF5
      });

      const cuffMaterial = new THREE.MeshStandardMaterial({
        color: 0x3B82F6, // Sleek brand blue cuff
        roughness: 0.4,
        metalness: 0.1
      });

      // 1. Forearm & Cuff
      const armGeo = new THREE.CylinderGeometry(0.5, 0.58, 2.0, 24);
      const armMesh = new THREE.Mesh(armGeo, skinMaterial);
      armMesh.position.set(0.12, -1.25, 0);
      handGroup.add(armMesh);

      const cuffGeo = new THREE.CylinderGeometry(0.58, 0.62, 0.45, 24);
      const cuffMesh = new THREE.Mesh(cuffGeo, cuffMaterial);
      cuffMesh.position.set(0.12, -2.1, 0);
      handGroup.add(cuffMesh);

      // 2. Palm Base (rounded squashed sphere + box)
      const palmBaseGeo = new THREE.SphereGeometry(0.72, 24, 16);
      const palmBase = new THREE.Mesh(palmBaseGeo, skinMaterial);
      palmBase.scale.set(1.15, 0.9, 0.55);
      palmBase.position.set(0.12, -0.25, 0);
      handGroup.add(palmBase);

      // 3. Index Finger (Points UP at the button!)
      const indexFingerGroup = new THREE.Group();
      indexFingerGroup.position.set(-0.15, 0.15, 0.05);

      const indexShaftGeo = new THREE.CylinderGeometry(0.2, 0.22, 1.5, 20);
      const indexShaft = new THREE.Mesh(indexShaftGeo, skinMaterial);
      indexShaft.position.set(0, 0.75, 0);
      indexFingerGroup.add(indexShaft);

      const indexTipGeo = new THREE.SphereGeometry(0.2, 20, 16);
      const indexTip = new THREE.Mesh(indexTipGeo, skinMaterial);
      indexTip.position.set(0, 1.5, 0);
      indexFingerGroup.add(indexTip);

      // Fingernail on index tip
      const nailGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 16);
      const nailMesh = new THREE.Mesh(nailGeo, nailMaterial);
      nailMesh.rotation.x = Math.PI / 2.2;
      nailMesh.position.set(0, 1.52, 0.16);
      indexFingerGroup.add(nailMesh);

      handGroup.add(indexFingerGroup);

      // 4. Thumb (angles out to the left)
      const thumbGroup = new THREE.Group();
      thumbGroup.position.set(-0.45, -0.4, 0.12);
      thumbGroup.rotation.z = 0.65; // ~37 degrees outwards
      thumbGroup.rotation.y = -0.2;

      const thumbShaftGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.85, 18);
      const thumbShaft = new THREE.Mesh(thumbShaftGeo, skinMaterial);
      thumbShaft.position.set(0, 0.42, 0);
      thumbGroup.add(thumbShaft);

      const thumbTipGeo = new THREE.SphereGeometry(0.19, 18, 14);
      const thumbTip = new THREE.Mesh(thumbTipGeo, skinMaterial);
      thumbTip.position.set(0, 0.85, 0);
      thumbGroup.add(thumbTip);

      handGroup.add(thumbGroup);

      // 5. Folded Fingers (Middle, Ring, Pinky - knuckles & curled curls)
      const foldedData = [
        { x: 0.32, y: 0.32, z: 0.18, r: 0.19, len: 0.75 },
        { x: 0.65, y: 0.18, z: 0.16, r: 0.18, len: 0.7 },
        { x: 0.94, y: 0.02, z: 0.13, r: 0.16, len: 0.62 }
      ];

      foldedData.forEach(f => {
        const fGroup = new THREE.Group();
        fGroup.position.set(f.x, f.y, f.z);
        fGroup.rotation.x = 1.35; // Curled tightly forward

        const fKnuckleGeo = new THREE.SphereGeometry(f.r, 16, 12);
        const fKnuckle = new THREE.Mesh(fKnuckleGeo, skinMaterial);
        fGroup.add(fKnuckle);

        const fShaftGeo = new THREE.CylinderGeometry(f.r * 0.95, f.r, f.len, 16);
        const fShaft = new THREE.Mesh(fShaftGeo, skinMaterial);
        fShaft.position.set(0, f.len / 2, 0);
        fGroup.add(fShaft);

        const fTipGeo = new THREE.SphereGeometry(f.r * 0.95, 16, 12);
        const fTip = new THREE.Mesh(fTipGeo, skinMaterial);
        fTip.position.set(0, f.len, 0);
        fGroup.add(fTip);

        handGroup.add(fGroup);
      });

      // 6. Click Ripple Ring (expands on tap)
      const ringGeo = new THREE.RingGeometry(0.1, 0.28, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x34D399,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      rippleMesh = new THREE.Mesh(ringGeo, ringMat);
      rippleMesh.position.set(-0.15, 1.85, 0.25);
      scene.add(rippleMesh);

      // Initial hand position (tucked just below)
      handGroup.position.set(0, -2.6, 0);
      handGroup.scale.set(1.1, 1.1, 1.1);

      // Start render loop
      let startTime = null;
      let clickTriggered = false;
      let rippleStartTime = null;

      function render(timestamp) {
        if (isTerminated) return;
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;

        // Phase 1: Slide up into position (0ms to 900ms)
        if (elapsed < 900) {
          const t = Math.min(1, elapsed / 900);
          // Ease out cubic
          const easeOut = 1 - Math.pow(1 - t, 3);
          handGroup.position.y = -2.6 + easeOut * 2.2; // brings index tip to ~1.2
        } 
        // Phase 2: Gentle hover breathing (900ms to 1400ms)
        else if (elapsed < 1400) {
          const hoverTime = (elapsed - 900) * 0.006;
          handGroup.position.y = -0.4 + Math.sin(hoverTime) * 0.05;
        }
        // Phase 3: Click Tap Upward (1400ms to 1800ms)
        else if (elapsed < 1800) {
          const clickProgress = (elapsed - 1400) / 400;
          if (clickProgress < 0.4) {
            // Push up towards pill
            handGroup.position.y = -0.4 + (clickProgress / 0.4) * 0.55;
            handGroup.rotation.x = -(clickProgress / 0.4) * 0.2;
          } else {
            // Rebound slightly
            const rebound = (clickProgress - 0.4) / 0.6;
            handGroup.position.y = 0.15 - rebound * 0.2;
            handGroup.rotation.x = -0.2 + rebound * 0.2;
          }

          // Trigger pill press feedback & ripple on first strike
          if (!clickTriggered && clickProgress >= 0.35) {
            clickTriggered = true;
            rippleStartTime = timestamp;
            triggerPillClickFeedback();
          }
        }
        // Phase 4: Idle hover while page scrolls down
        else {
          const t = (elapsed - 1800) * 0.004;
          handGroup.position.y = -0.1 + Math.sin(t) * 0.08;
        }

        // Animate Ripple Ring
        if (rippleStartTime) {
          const rElapsed = timestamp - rippleStartTime;
          if (rElapsed < 600) {
            const rT = rElapsed / 600;
            const rScale = 0.3 + rT * 4.2;
            rippleMesh.scale.set(rScale, rScale, rScale);
            ringMat.opacity = Math.max(0, 0.9 * (1 - rT));
          } else {
            ringMat.opacity = 0;
          }
        }

        renderer.render(scene, camera);
        animId = requestAnimationFrame(render);
      }

      animId = requestAnimationFrame(render);
    }

    // --- Pill Visual Click Reaction ---
    function triggerPillClickFeedback() {
      if (pillBox) {
        pillBox.classList.add('scale-95', 'ring-2', 'ring-emerald-400', 'shadow-[0_0_30px_rgba(16,185,129,0.8)]');
        setTimeout(() => {
          pillBox.classList.remove('scale-95', 'ring-2', 'ring-emerald-400', 'shadow-[0_0_30px_rgba(16,185,129,0.8)]');
        }, 220);
      }

      // Start scrolling down after click
      startProgressiveScroll();
    }

    // --- Progressive Auto-Scroll Down ---
    function startProgressiveScroll() {
      if (isUserInteracting || isTerminated) return;

      // Small pause after click before scrolling begins
      setTimeout(() => {
        if (isUserInteracting || isTerminated) return;

        // Ensure micro-stepping doesn't fight CSS smooth-scroll animation queue
        document.documentElement.style.scrollBehavior = 'auto';

        let currentStep = 8; // Start smooth at ~8-10px
        const maxStep = 22; // Progress up to 15-22px smoothly

        autoScrollInterval = setInterval(() => {
          if (isUserInteracting || isTerminated) {
            clearInterval(autoScrollInterval);
            return;
          }

          // Accelerate slightly like natural scroll gesture (10 += 10 or 15)
          if (currentStep < maxStep) {
            currentStep += 0.8;
          }

          window.scrollBy({
            top: currentStep,
            behavior: 'auto'
          });

          // Check if video section is now in comfortable view
          if (videoSection) {
            const rect = videoSection.getBoundingClientRect();
            if (rect.top <= 120) {
              // Video section reached! Stop completely as user requested
              stopHandAnimation();
            }
          }

          // If reached bottom of document
          if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 50) {
            stopHandAnimation();
          }
        }, 16); // ~60fps smooth scroll increments
      }, 350);
    }

    // --- 3-Second Idle Delay before appearing ---
    setTimeout(() => {
      // Only start if user hasn't scrolled or interacted
      if (isUserInteracting || isTerminated || window.scrollY > 20) {
        return;
      }

      animationStarted = true;
      handContainer.style.opacity = '1';
      init3DHand();
    }, 3000);

  });
})();
