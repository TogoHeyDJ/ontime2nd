/**
 * ThreeViewer Component
 * 3D viewer with CATIA-style mouse controls
 *
 * CATIA操作方式:
 * - 平行移動(パン): 中ボタンドラッグ
 * - 回転: 中ボタン + 左クリック + ドラッグ
 * - ズーム: 中ボタン + 左クリック → 左離して中ボタンのみで上下ドラッグ
 */

import * as THREE from 'three';

export class ThreeViewer {
  constructor(options) {
    this.container = options.container;
    this.onReady = options.onReady;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
    this.gridHelper = null;
    this.axesHelper = null;

    // CATIA-style controls state
    this.mouseState = {
      middleDown: false,
      leftDown: false,
      zoomMode: false,      // true when: middle+left pressed, then left released
      wasRotating: false    // track if we were in rotation mode
    };
    this.previousMouse = { x: 0, y: 0 };

    // Camera spherical coordinates
    this.spherical = {
      radius: 300,
      theta: Math.PI / 4,  // Horizontal angle
      phi: Math.PI / 3     // Vertical angle
    };

    this.target = new THREE.Vector3(0, 0, 0);

    this.init();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
    this.updateCameraPosition();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lights
    this.setupLights();

    // Helpers
    this.setupHelpers();

    // Event listeners
    this.setupEventListeners();

    // Start animation loop
    this.animate();

    // Notify ready
    if (this.onReady) {
      this.onReady();
    }
  }

  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(100, 200, 100);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    this.scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-100, 50, -100);
    this.scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x4fc3f7, 0.2);
    rimLight.position.set(0, -100, 100);
    this.scene.add(rimLight);
  }

  setupHelpers() {
    // Grid
    this.gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x333333);
    this.gridHelper.position.y = -50;
    this.scene.add(this.gridHelper);

    // Axes
    this.axesHelper = new THREE.AxesHelper(100);
    this.scene.add(this.axesHelper);
  }

  setupEventListeners() {
    const canvas = this.renderer.domElement;

    // Mouse events for CATIA-style controls
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent default middle button behavior (auto-scroll)
    canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    // Window resize
    window.addEventListener('resize', () => this.onResize());
  }

  onMouseDown(e) {
    e.preventDefault();

    // Middle button (button 1)
    if (e.button === 1) {
      this.mouseState.middleDown = true;
      this.mouseState.zoomMode = false;
      this.mouseState.wasRotating = false;
      this.previousMouse.x = e.clientX;
      this.previousMouse.y = e.clientY;
    }

    // Left button (button 0)
    if (e.button === 0) {
      this.mouseState.leftDown = true;
      // If middle is already down, we're entering rotation mode
      if (this.mouseState.middleDown) {
        this.mouseState.wasRotating = true;
      }
      this.previousMouse.x = e.clientX;
      this.previousMouse.y = e.clientY;
    }
  }

  onMouseMove(e) {
    // Check if middle button is pressed
    if (!this.mouseState.middleDown) return;

    const deltaX = e.clientX - this.previousMouse.x;
    const deltaY = e.clientY - this.previousMouse.y;

    // Determine current mode based on CATIA logic
    const isRotating = this.mouseState.middleDown && this.mouseState.leftDown;
    const isZooming = this.mouseState.zoomMode;
    const isPanning = this.mouseState.middleDown && !this.mouseState.leftDown && !this.mouseState.zoomMode;

    if (isRotating) {
      // ROTATION: Middle + Left button drag (CATIA style - reversed direction)
      this.spherical.theta += deltaX * 0.01;
      this.spherical.phi += deltaY * 0.01;

      // Clamp phi to prevent flipping
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));

      this.updateCameraPosition();
    } else if (isZooming) {
      // ZOOM: After middle+left, release left, drag up/down with middle
      const zoomSpeed = 0.01;

      // Up = zoom in (decrease radius), Down = zoom out (increase radius)
      this.spherical.radius += deltaY * this.spherical.radius * zoomSpeed;

      // Clamp radius
      this.spherical.radius = Math.max(10, Math.min(5000, this.spherical.radius));

      this.updateCameraPosition();
    } else if (isPanning) {
      // PAN: Middle button only drag
      const panSpeed = this.spherical.radius * 0.001;

      // Calculate right and up vectors relative to camera
      const forward = new THREE.Vector3();
      forward.subVectors(this.target, this.camera.position).normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, this.camera.up).normalize();

      const up = new THREE.Vector3();
      up.crossVectors(right, forward).normalize();

      // Pan the target
      this.target.addScaledVector(right, -deltaX * panSpeed);
      this.target.addScaledVector(up, deltaY * panSpeed);

      this.updateCameraPosition();
    }

    this.previousMouse.x = e.clientX;
    this.previousMouse.y = e.clientY;
  }

  onMouseUp(e) {
    // Left button released
    if (e.button === 0) {
      // If we were rotating (middle + left) and now release left,
      // enter zoom mode while middle is still down
      if (this.mouseState.middleDown && this.mouseState.wasRotating) {
        this.mouseState.zoomMode = true;
      }
      this.mouseState.leftDown = false;
    }

    // Middle button released
    if (e.button === 1) {
      this.resetMouseState();
    }
  }

  onMouseLeave(e) {
    this.resetMouseState();
  }

  resetMouseState() {
    this.mouseState.middleDown = false;
    this.mouseState.leftDown = false;
    this.mouseState.zoomMode = false;
    this.mouseState.wasRotating = false;
  }

  updateCameraPosition() {
    // Convert spherical to Cartesian coordinates
    const x = this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
    const y = this.spherical.radius * Math.cos(this.spherical.phi);
    const z = this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );

    this.camera.lookAt(this.target);
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  setGeometry(geometry) {
    // Remove existing mesh
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }

    // Material
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x4a90d9,
      metalness: 0.3,
      roughness: 0.4,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Center the geometry
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    this.scene.add(this.mesh);

    // Fit camera to object
    this.fitCameraToObject();

    return this.mesh;
  }

  fitCameraToObject() {
    if (!this.mesh) return;

    const boundingBox = new THREE.Box3().setFromObject(this.mesh);
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    this.spherical.radius = maxDim * 2.5;
    this.target.set(0, 0, 0);
    this.updateCameraPosition();
  }

  setView(view) {
    switch (view) {
      case 'front':
        this.spherical.theta = 0;
        this.spherical.phi = Math.PI / 2;
        break;
      case 'top':
        this.spherical.theta = 0;
        this.spherical.phi = 0.01;
        break;
      case 'side':
        this.spherical.theta = Math.PI / 2;
        this.spherical.phi = Math.PI / 2;
        break;
      case 'iso':
      default:
        this.spherical.theta = Math.PI / 4;
        this.spherical.phi = Math.PI / 3;
        break;
    }
    this.updateCameraPosition();
  }

  resetView() {
    this.spherical.theta = Math.PI / 4;
    this.spherical.phi = Math.PI / 3;
    this.target.set(0, 0, 0);
    this.fitCameraToObject();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}
