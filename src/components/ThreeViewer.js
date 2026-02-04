/**
 * ThreeViewer Component
 * 3D viewer with CATIA-style mouse controls
 * - Middle button: Rotate
 * - Middle + Ctrl: Pan
 * - Wheel: Zoom
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
    this.isRotating = false;
    this.isPanning = false;
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
    canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e));

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Window resize
    window.addEventListener('resize', () => this.onResize());
  }

  onMouseDown(e) {
    // Middle button (button 1)
    if (e.button === 1) {
      e.preventDefault();
      if (e.ctrlKey) {
        this.isPanning = true;
      } else {
        this.isRotating = true;
      }
      this.previousMouse.x = e.clientX;
      this.previousMouse.y = e.clientY;
    }
  }

  onMouseMove(e) {
    if (!this.isRotating && !this.isPanning) return;

    const deltaX = e.clientX - this.previousMouse.x;
    const deltaY = e.clientY - this.previousMouse.y;

    if (this.isRotating) {
      // Rotate camera around target (CATIA style)
      this.spherical.theta -= deltaX * 0.01;
      this.spherical.phi -= deltaY * 0.01;

      // Clamp phi to prevent flipping
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));

      this.updateCameraPosition();
    } else if (this.isPanning) {
      // Pan camera (CATIA style)
      const panSpeed = 0.5;

      // Calculate right and up vectors
      const forward = new THREE.Vector3();
      forward.subVectors(this.target, this.camera.position).normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, this.camera.up).normalize();

      const up = new THREE.Vector3();
      up.crossVectors(right, forward).normalize();

      // Pan
      this.target.addScaledVector(right, -deltaX * panSpeed);
      this.target.addScaledVector(up, deltaY * panSpeed);

      this.updateCameraPosition();
    }

    this.previousMouse.x = e.clientX;
    this.previousMouse.y = e.clientY;
  }

  onMouseUp(e) {
    this.isRotating = false;
    this.isPanning = false;
  }

  onWheel(e) {
    e.preventDefault();

    // Zoom in/out (CATIA style - wheel zoom)
    const zoomSpeed = 1.1;

    if (e.deltaY > 0) {
      this.spherical.radius *= zoomSpeed;
    } else {
      this.spherical.radius /= zoomSpeed;
    }

    // Clamp radius
    this.spherical.radius = Math.max(50, Math.min(2000, this.spherical.radius));

    this.updateCameraPosition();
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
