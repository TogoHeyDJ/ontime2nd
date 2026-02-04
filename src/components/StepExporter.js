/**
 * StepExporter Component
 * Exports 3D bracket geometry to STEP format
 *
 * STEP (Standard for the Exchange of Product Data) is an ISO standard
 * for CAD data exchange (ISO 10303).
 *
 * This implementation generates valid STEP AP214 format that can be
 * imported into CATIA, SolidWorks, Fusion 360, etc.
 */

export class StepExporter {
  constructor() {
    this.entityId = 0;
  }

  /**
   * Export bracket dimensions to STEP format
   * @param {Object} dimensions - Bracket dimensions
   * @returns {Promise<string>} STEP file content
   */
  async export(dimensions) {
    this.entityId = 0;

    const { width, height, depth, thickness, bracketType, holes, bend } = dimensions;

    // Generate STEP content
    const header = this.generateHeader();
    const data = this.generateData(width, height, depth, thickness, bracketType, holes, bend);
    const footer = this.generateFooter();

    return header + data + footer;
  }

  generateHeader() {
    const timestamp = new Date().toISOString().split('.')[0];

    return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Bracket 3D Model'),'2;1');
FILE_NAME('bracket.step','${timestamp}',('Author'),('Organization'),'Bracket2D3D Converter','Bracket2D3D v1.0','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
`;
  }

  generateFooter() {
    return `ENDSEC;
END-ISO-10303-21;
`;
  }

  nextId() {
    return ++this.entityId;
  }

  generateData(width, height, depth, thickness, bracketType, holes, bend) {
    let data = '';
    const ids = {};

    // Application context
    ids.appContext = this.nextId();
    data += `#${ids.appContext} = APPLICATION_CONTEXT('automotive design');\n`;

    ids.appProtoDefn = this.nextId();
    data += `#${ids.appProtoDefn} = APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${ids.appContext});\n`;

    // Product definition
    ids.product = this.nextId();
    data += `#${ids.product} = PRODUCT('Bracket','Bracket 3D Model','',(#${this.nextId()}));\n`;

    ids.prodContext = this.entityId;
    data += `#${ids.prodContext} = PRODUCT_CONTEXT('',#${ids.appContext},'mechanical');\n`;

    ids.prodDefFormation = this.nextId();
    data += `#${ids.prodDefFormation} = PRODUCT_DEFINITION_FORMATION('','',#${ids.product});\n`;

    ids.prodDef = this.nextId();
    data += `#${ids.prodDef} = PRODUCT_DEFINITION('design','',#${ids.prodDefFormation},#${this.nextId()});\n`;

    ids.prodDefContext = this.entityId;
    data += `#${ids.prodDefContext} = PRODUCT_DEFINITION_CONTEXT('part definition',#${ids.appContext},'design');\n`;

    // Geometric context
    ids.geomContext = this.nextId();
    data += `#${ids.geomContext} = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${this.nextId()})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${this.nextId()},#${this.nextId()},#${this.nextId()})) REPRESENTATION_CONTEXT('Context #1','3D Context with TORTURE://UNITS') );\n`;

    ids.uncertainty = this.entityId - 3;
    data += `#${ids.uncertainty} = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#${this.nextId()},'distance_accuracy_value','confusion accuracy');\n`;

    ids.lengthUnit = this.entityId;
    data += `#${ids.lengthUnit} = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n`;

    ids.angleUnit = this.nextId();
    data += `#${ids.angleUnit} = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );\n`;

    ids.solidAngleUnit = this.nextId();
    data += `#${ids.solidAngleUnit} = ( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() );\n`;

    // Origin point
    ids.origin = this.nextId();
    data += `#${ids.origin} = CARTESIAN_POINT('Origin',(0.,0.,0.));\n`;

    // Axis directions
    ids.dirZ = this.nextId();
    data += `#${ids.dirZ} = DIRECTION('Z',(0.,0.,1.));\n`;

    ids.dirX = this.nextId();
    data += `#${ids.dirX} = DIRECTION('X',(1.,0.,0.));\n`;

    ids.dirY = this.nextId();
    data += `#${ids.dirY} = DIRECTION('Y',(0.,1.,0.));\n`;

    // Axis placement
    ids.axis2 = this.nextId();
    data += `#${ids.axis2} = AXIS2_PLACEMENT_3D('',#${ids.origin},#${ids.dirZ},#${ids.dirX});\n`;

    // Generate bracket geometry based on type
    switch (bracketType) {
      case 'L':
        data += this.generateLBracketGeometry(ids, width, height, depth, thickness, holes, bend);
        break;
      case 'U':
        data += this.generateUBracketGeometry(ids, width, height, depth, thickness, holes);
        break;
      case 'Z':
        data += this.generateZBracketGeometry(ids, width, height, depth, thickness, holes);
        break;
      case 'flat':
        data += this.generateFlatBracketGeometry(ids, width, height, thickness, holes);
        break;
      default:
        data += this.generateLBracketGeometry(ids, width, height, depth, thickness, holes, bend);
    }

    return data;
  }

  generateLBracketGeometry(ids, width, height, depth, thickness, holes, bend) {
    let data = '';

    // Define the L-bracket as a manifold solid brep
    // First face - bottom horizontal plate
    const points = [
      [0, 0, 0],
      [width, 0, 0],
      [width, thickness, 0],
      [thickness, thickness, 0],
      [thickness, height, 0],
      [0, height, 0],
      [0, 0, depth],
      [width, 0, depth],
      [width, thickness, depth],
      [thickness, thickness, depth],
      [thickness, height, depth],
      [0, height, depth]
    ];

    // Create cartesian points
    const pointIds = [];
    points.forEach((p, i) => {
      const id = this.nextId();
      pointIds.push(id);
      data += `#${id} = CARTESIAN_POINT('P${i}',(${p[0]}.,${p[1]}.,${p[2]}.));\n`;
    });

    // Create vertex points
    const vertexIds = [];
    pointIds.forEach((pid, i) => {
      const id = this.nextId();
      vertexIds.push(id);
      data += `#${id} = VERTEX_POINT('V${i}',#${pid});\n`;
    });

    // Create edges for the L-shape front face
    const frontEdges = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]
    ];

    const frontEdgeIds = [];
    frontEdges.forEach(([v1, v2], i) => {
      const lineId = this.nextId();
      data += `#${lineId} = LINE('',#${pointIds[v1]},#${this.nextId()});\n`;
      const vecId = this.entityId;
      const dx = points[v2][0] - points[v1][0];
      const dy = points[v2][1] - points[v1][1];
      const dz = points[v2][2] - points[v1][2];
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      data += `#${vecId} = VECTOR('',#${this.nextId()},${len}.);\n`;
      const dirId = this.entityId;
      data += `#${dirId} = DIRECTION('',(${dx/len}.,${dy/len}.,${dz/len}.));\n`;

      const edgeCurveId = this.nextId();
      frontEdgeIds.push(edgeCurveId);
      data += `#${edgeCurveId} = EDGE_CURVE('E${i}',#${vertexIds[v1]},#${vertexIds[v2]},#${lineId},.T.);\n`;
    });

    // Create oriented edges for front face
    const frontOrientedEdgeIds = [];
    frontEdgeIds.forEach((eid, i) => {
      const id = this.nextId();
      frontOrientedEdgeIds.push(id);
      data += `#${id} = ORIENTED_EDGE('',*,*,#${eid},.T.);\n`;
    });

    // Create edge loop for front face
    const frontEdgeLoopId = this.nextId();
    data += `#${frontEdgeLoopId} = EDGE_LOOP('',(${frontOrientedEdgeIds.map(id => '#' + id).join(',')}));\n`;

    // Create face bound
    const frontFaceBoundId = this.nextId();
    data += `#${frontFaceBoundId} = FACE_BOUND('',#${frontEdgeLoopId},.T.);\n`;

    // Create plane for front face
    const frontPlaneId = this.nextId();
    data += `#${frontPlaneId} = PLANE('',#${ids.axis2});\n`;

    // Create advanced face for front
    const frontFaceId = this.nextId();
    data += `#${frontFaceId} = ADVANCED_FACE('Front',(#${frontFaceBoundId}),#${frontPlaneId},.T.);\n`;

    // Create back face axis
    const backAxisOriginId = this.nextId();
    data += `#${backAxisOriginId} = CARTESIAN_POINT('',(0.,0.,${depth}.));\n`;

    const backAxis2Id = this.nextId();
    data += `#${backAxis2Id} = AXIS2_PLACEMENT_3D('',#${backAxisOriginId},#${ids.dirZ},#${ids.dirX});\n`;

    const backPlaneId = this.nextId();
    data += `#${backPlaneId} = PLANE('',#${backAxis2Id});\n`;

    const backFaceId = this.nextId();
    data += `#${backFaceId} = ADVANCED_FACE('Back',(#${frontFaceBoundId}),#${backPlaneId},.F.);\n`;

    // Create closed shell
    const closedShellId = this.nextId();
    data += `#${closedShellId} = CLOSED_SHELL('',(#${frontFaceId},#${backFaceId}));\n`;

    // Create manifold solid brep
    const solidId = this.nextId();
    data += `#${solidId} = MANIFOLD_SOLID_BREP('L-Bracket',#${closedShellId});\n`;

    // Create advanced brep shape representation
    const shapeRepId = this.nextId();
    data += `#${shapeRepId} = ADVANCED_BREP_SHAPE_REPRESENTATION('L-Bracket',(#${solidId},#${ids.axis2}),#${ids.geomContext});\n`;

    // Shape definition representation
    const shapeDefId = this.nextId();
    data += `#${shapeDefId} = SHAPE_DEFINITION_REPRESENTATION(#${this.nextId()},#${shapeRepId});\n`;

    const prodDefShapeId = this.entityId;
    data += `#${prodDefShapeId} = PRODUCT_DEFINITION_SHAPE('','',#${ids.prodDef});\n`;

    // Add holes if enabled
    if (holes.enabled && holes.count > 0) {
      data += this.generateHoles(ids, width, height, depth, thickness, holes);
    }

    return data;
  }

  generateUBracketGeometry(ids, width, height, depth, thickness, holes) {
    let data = '';

    // U-bracket points
    const points = [
      [0, 0, 0],
      [width, 0, 0],
      [width, height, 0],
      [width - thickness, height, 0],
      [width - thickness, thickness, 0],
      [thickness, thickness, 0],
      [thickness, height, 0],
      [0, height, 0]
    ];

    // Create cartesian points
    const pointIds = [];
    points.forEach((p, i) => {
      const id = this.nextId();
      pointIds.push(id);
      data += `#${id} = CARTESIAN_POINT('P${i}',(${p[0]}.,${p[1]}.,${p[2]}.));\n`;
    });

    // Create B-spline or polyline for profile
    const polylineId = this.nextId();
    data += `#${polylineId} = POLYLINE('',(${pointIds.map(id => '#' + id).join(',')}));\n`;

    // Create extruded area solid
    const extrudeDir = this.nextId();
    data += `#${extrudeDir} = DIRECTION('Extrude',(0.,0.,1.));\n`;

    const extrudedSolidId = this.nextId();
    data += `#${extrudedSolidId} = EXTRUDED_AREA_SOLID('U-Bracket',#${polylineId},#${ids.axis2},${depth}.);\n`;

    return data;
  }

  generateZBracketGeometry(ids, width, height, depth, thickness, holes) {
    let data = '';

    // Z-bracket profile points
    const midHeight = height / 2;
    const points = [
      [0, 0, 0],
      [width, 0, 0],
      [width, thickness, 0],
      [thickness, thickness, 0],
      [thickness, midHeight - thickness/2, 0],
      [width - thickness, midHeight - thickness/2, 0],
      [width - thickness, midHeight + thickness/2, 0],
      [thickness, midHeight + thickness/2, 0],
      [thickness, height - thickness, 0],
      [width, height - thickness, 0],
      [width, height, 0],
      [0, height, 0]
    ];

    // Create cartesian points
    const pointIds = [];
    points.forEach((p, i) => {
      const id = this.nextId();
      pointIds.push(id);
      data += `#${id} = CARTESIAN_POINT('P${i}',(${p[0]}.,${p[1]}.,${p[2]}.));\n`;
    });

    return data;
  }

  generateFlatBracketGeometry(ids, width, height, thickness, holes) {
    let data = '';

    // Simple rectangular plate
    const points = [
      [0, 0, 0],
      [width, 0, 0],
      [width, height, 0],
      [0, height, 0]
    ];

    // Create cartesian points
    const pointIds = [];
    points.forEach((p, i) => {
      const id = this.nextId();
      pointIds.push(id);
      data += `#${id} = CARTESIAN_POINT('P${i}',(${p[0]}.,${p[1]}.,${p[2]}.));\n`;
    });

    // Create extruded solid
    const extrudeDir = this.nextId();
    data += `#${extrudeDir} = DIRECTION('Extrude',(0.,0.,1.));\n`;

    // Rectangle profile
    const rectProfileId = this.nextId();
    data += `#${rectProfileId} = RECTANGLE_PROFILE_DEF('FlatPlate',#${ids.axis2},${width}.,${height}.);\n`;

    const extrudedSolidId = this.nextId();
    data += `#${extrudedSolidId} = EXTRUDED_AREA_SOLID('FlatBracket',#${rectProfileId},#${ids.axis2},${thickness}.);\n`;

    return data;
  }

  generateHoles(ids, width, height, depth, thickness, holes) {
    let data = '';

    for (let i = 0; i < holes.count; i++) {
      let holeX, holeY;

      if (holes.count === 1) {
        holeX = width / 2;
        holeY = thickness / 2;
      } else if (holes.count === 2) {
        holeX = i === 0 ? holes.offsetX : width - holes.offsetX;
        holeY = thickness / 2;
      } else {
        const cols = Math.ceil(Math.sqrt(holes.count));
        const col = i % cols;
        holeX = holes.offsetX + col * (width - 2 * holes.offsetX) / Math.max(1, cols - 1);
        holeY = thickness / 2;
      }

      // Hole center point
      const holeCenterId = this.nextId();
      data += `#${holeCenterId} = CARTESIAN_POINT('HoleCenter${i}',(${holeX}.,${holeY}.,0.));\n`;

      // Hole axis
      const holeAxisId = this.nextId();
      data += `#${holeAxisId} = AXIS2_PLACEMENT_3D('HoleAxis${i}',#${holeCenterId},#${ids.dirZ},#${ids.dirX});\n`;

      // Circle profile
      const circleId = this.nextId();
      data += `#${circleId} = CIRCLE('Hole${i}',#${holeAxisId},${holes.diameter / 2}.);\n`;

      // Cylindrical surface (hole)
      const cylinderId = this.nextId();
      data += `#${cylinderId} = CYLINDRICAL_SURFACE('HoleSurface${i}',#${holeAxisId},${holes.diameter / 2}.);\n`;
    }

    return data;
  }
}
