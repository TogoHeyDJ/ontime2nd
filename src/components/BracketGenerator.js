/**
 * BracketGenerator Component
 * Generates 3D bracket geometry based on dimensions
 */

import * as THREE from 'three';

export class BracketGenerator {
  constructor() {
    this.lastGeometry = null;
    this.modelInfo = { vertices: 0, faces: 0 };
  }

  generate(dimensions) {
    const { width, height, depth, thickness, bracketType, holes, bend } = dimensions;

    let geometry;

    switch (bracketType) {
      case 'L':
        geometry = this.generateLBracket(width, height, depth, thickness, holes, bend);
        break;
      case 'U':
        geometry = this.generateUBracket(width, height, depth, thickness, holes);
        break;
      case 'Z':
        geometry = this.generateZBracket(width, height, depth, thickness, holes);
        break;
      case 'flat':
        geometry = this.generateFlatBracket(width, height, thickness, holes);
        break;
      default:
        geometry = this.generateLBracket(width, height, depth, thickness, holes, bend);
    }

    this.lastGeometry = geometry;
    this.modelInfo = {
      vertices: geometry.attributes.position.count,
      faces: geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
    };

    return geometry;
  }

  generateLBracket(width, height, depth, thickness, holes, bend) {
    const shape = new THREE.Shape();

    // L-shaped cross-section
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, thickness);
    shape.lineTo(thickness, thickness);
    shape.lineTo(thickness, height);
    shape.lineTo(0, height);
    shape.closePath();

    // Extrude settings
    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: Math.min(bend.radius, thickness / 2),
      bevelSize: Math.min(bend.radius, thickness / 2),
      bevelSegments: 3
    };

    let geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Add holes if enabled
    if (holes.enabled && holes.count > 0) {
      geometry = this.addHolesToGeometry(geometry, width, height, depth, thickness, holes, 'L');
    }

    return geometry;
  }

  generateUBracket(width, height, depth, thickness, holes) {
    const shape = new THREE.Shape();

    // U-shaped cross-section
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.lineTo(width - thickness, height);
    shape.lineTo(width - thickness, thickness);
    shape.lineTo(thickness, thickness);
    shape.lineTo(thickness, height);
    shape.lineTo(0, height);
    shape.closePath();

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelSegments: 2
    };

    let geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    if (holes.enabled && holes.count > 0) {
      geometry = this.addHolesToGeometry(geometry, width, height, depth, thickness, holes, 'U');
    }

    return geometry;
  }

  generateZBracket(width, height, depth, thickness, holes) {
    const shape = new THREE.Shape();

    const offset = width / 3;

    // Z-shaped cross-section
    shape.moveTo(0, 0);
    shape.lineTo(width - offset, 0);
    shape.lineTo(width - offset, thickness);
    shape.lineTo(thickness, thickness);
    shape.lineTo(thickness, height - thickness);
    shape.lineTo(offset, height - thickness);
    shape.lineTo(offset, height);
    shape.lineTo(width, height);
    shape.lineTo(width, height - thickness);
    shape.lineTo(offset + thickness, height - thickness);
    shape.lineTo(offset + thickness, thickness);
    shape.lineTo(width - offset, thickness);
    shape.lineTo(width - offset, 0);
    shape.closePath();

    // Simplified Z shape
    const shape2 = new THREE.Shape();
    shape2.moveTo(0, 0);
    shape2.lineTo(width, 0);
    shape2.lineTo(width, thickness);
    shape2.lineTo(thickness, thickness);
    shape2.lineTo(thickness, height / 2 - thickness / 2);
    shape2.lineTo(width - thickness, height / 2 - thickness / 2);
    shape2.lineTo(width - thickness, height / 2 + thickness / 2);
    shape2.lineTo(thickness, height / 2 + thickness / 2);
    shape2.lineTo(thickness, height - thickness);
    shape2.lineTo(width, height - thickness);
    shape2.lineTo(width, height);
    shape2.lineTo(0, height);
    shape2.closePath();

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelSegments: 2
    };

    let geometry = new THREE.ExtrudeGeometry(shape2, extrudeSettings);

    if (holes.enabled && holes.count > 0) {
      geometry = this.addHolesToGeometry(geometry, width, height, depth, thickness, holes, 'Z');
    }

    return geometry;
  }

  generateFlatBracket(width, height, thickness, holes) {
    // Simple flat plate with holes
    const shape = new THREE.Shape();

    // Rounded rectangle
    const radius = Math.min(5, width / 10, height / 10);

    shape.moveTo(radius, 0);
    shape.lineTo(width - radius, 0);
    shape.quadraticCurveTo(width, 0, width, radius);
    shape.lineTo(width, height - radius);
    shape.quadraticCurveTo(width, height, width - radius, height);
    shape.lineTo(radius, height);
    shape.quadraticCurveTo(0, height, 0, height - radius);
    shape.lineTo(0, radius);
    shape.quadraticCurveTo(0, 0, radius, 0);

    // Add holes to shape
    if (holes.enabled && holes.count > 0) {
      const holeRadius = holes.diameter / 2;

      for (let i = 0; i < holes.count; i++) {
        const holePath = new THREE.Path();
        let hx, hy;

        if (holes.count === 1) {
          hx = width / 2;
          hy = height / 2;
        } else if (holes.count === 2) {
          hx = i === 0 ? holes.offsetX : width - holes.offsetX;
          hy = height / 2;
        } else {
          // Grid pattern
          const cols = Math.ceil(Math.sqrt(holes.count));
          const col = i % cols;
          const row = Math.floor(i / cols);
          const spacingX = (width - 2 * holes.offsetX) / Math.max(1, cols - 1);
          const spacingY = (height - 2 * holes.offsetY) / Math.max(1, Math.ceil(holes.count / cols) - 1);

          hx = holes.offsetX + col * spacingX;
          hy = holes.offsetY + row * spacingY;
        }

        // Draw circle for hole
        holePath.absarc(hx, hy, holeRadius, 0, Math.PI * 2, true);
        shape.holes.push(holePath);
      }
    }

    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  addHolesToGeometry(baseGeometry, width, height, depth, thickness, holes, bracketType) {
    // For complex bracket types, we use CSG operations
    // Since Three.js doesn't have built-in CSG, we'll use a simplified approach
    // by creating separate hole cylinders that can be visualized

    // In a production environment, you would use a CSG library like:
    // - three-csg-ts
    // - three-bvh-csg

    // For now, return the base geometry
    // The holes are handled in the flat bracket via shape holes
    return baseGeometry;
  }

  getModelInfo() {
    return this.modelInfo;
  }
}
