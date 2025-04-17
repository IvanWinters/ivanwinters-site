"use strict";

const vertexShaderSource = `
    attribute vec3 a_coords;
    attribute vec3 a_normal;
    attribute vec2 a_texcoord;
    uniform mat4 modelview;
    uniform mat4 projection;
    uniform mat3 normalMatrix;
    uniform vec4 lightPosition;
    uniform vec4 diffuseColor;
    uniform vec3 specularColor;
    uniform float specularExponent;
    varying vec4 v_color;
    varying vec2 v_texcoord;
    void main() {
        vec4 coords = vec4(a_coords, 1.0);
        vec4 eyeCoords = modelview * coords;
        gl_Position = projection * eyeCoords;
        vec3 N, L, R, V;
        N = normalize(normalMatrix * a_normal);
        if (lightPosition.w == 0.0) {
            L = normalize(lightPosition.xyz);
        } else {
            L = normalize(lightPosition.xyz / lightPosition.w - eyeCoords.xyz);
        }
        R = -reflect(L, N);
        V = normalize(-eyeCoords.xyz);
        if (dot(L, N) <= 0.0) {
            v_color = vec4(0, 0, 0, 1);
        } else {
            vec3 color = 0.8 * dot(L, N) * diffuseColor.rgb;
            if (dot(R, V) > 0.0) {
                color += 0.4 * pow(dot(R, V), specularExponent) * specularColor;
            }
            v_color = vec4(color, diffuseColor.a);
        }
        v_texcoord = a_texcoord; // Pass texture coordinates
    }`;

// Fragment shader program
const fragmentShaderSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
       precision highp float;
    #else
       precision mediump float;
    #endif
    varying vec4 v_color;
    varying vec2 v_texcoord;
    uniform sampler2D u_texture;
    void main() {
        vec4 texColor = texture2D(u_texture, v_texcoord);
        gl_FragColor = texColor * v_color;
    }`;

let gl;
let program;
let a_coords_loc, a_normal_loc, a_texcoord_loc;
let a_coords_buffer, a_normal_buffer, index_buffer;
let u_modelview, u_projection, u_normalMatrix, u_texture;
let u_diffuseColor, u_specularColor, u_specularExponent, u_lightPosition;
let texture;
const projection = mat4.create();
let modelview = mat4.create();
const normalMatrix = mat3.create();
const lightPositions = [[0, 0, 0, 1]];
const objects = [Torus(3, 1, 64, 32)];
let angle = 0;

function Torus(outerRadius, innerRadius, slices, stacks) {
  outerRadius = outerRadius || 0.5;
  innerRadius = innerRadius || outerRadius / 3;
  slices = slices || 32;
  stacks = stacks || 16;
  var vertexCount = (slices + 1) * (stacks + 1);
  var vertices = new Float32Array(3 * vertexCount);
  var normals = new Float32Array(3 * vertexCount);
  var texCoords = new Float32Array(2 * vertexCount);
  var indices = new Uint16Array(2 * slices * stacks * 3);
  var du = (2 * Math.PI) / slices;
  var dv = (2 * Math.PI) / stacks;
  var centerRadius = (innerRadius + outerRadius) / 2;
  var tubeRadius = outerRadius - centerRadius;
  var i, j, u, v, cx, cy, sin, cos, x, y, z;
  var indexV = 0;
  var indexT = 0;
  for (j = 0; j <= stacks; j++) {
    v = -Math.PI + j * dv;
    cos = Math.cos(v);
    sin = Math.sin(v);
    for (i = 0; i <= slices; i++) {
      u = i * du;
      cx = Math.cos(u);
      cy = Math.sin(u);
      x = cx * (centerRadius + tubeRadius * cos);
      y = cy * (centerRadius + tubeRadius * cos);
      z = sin * tubeRadius;
      vertices[indexV] = x;
      normals[indexV++] = cx * cos;
      vertices[indexV] = y;
      normals[indexV++] = cy * cos;
      vertices[indexV] = z;
      normals[indexV++] = sin;
      texCoords[indexT++] = i / slices;
      texCoords[indexT++] = j / stacks;
    }
  }
  var k = 0;
  for (j = 0; j < stacks; j++) {
    var row1 = j * (slices + 1);
    var row2 = (j + 1) * (slices + 1);
    for (i = 0; i < slices; i++) {
      indices[k++] = row1 + i;
      indices[k++] = row2 + i + 1;
      indices[k++] = row2 + i;
      indices[k++] = row1 + i;
      indices[k++] = row1 + i + 1;
      indices[k++] = row2 + i + 1;
    }
  }
  return {
    vertexPositions: vertices,
    vertexNormals: normals,
    vertexTextureCoords: texCoords,
    indices: indices,
  };
}

function loadTexture(url) {
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255])); // White pixel as placeholder

  // Load the actual texture image
  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // If non-power-of-two, adjust wrapping mode and filtering
    const isPowerOfTwo = (value) => (value & (value - 1)) === 0;
    if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
      // Use mipmapping for power-of-two textures
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // Adjust wrapping and filtering for non-power-of-two textures
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  };

  image.onerror = function () {
    console.error(`Unable to load image from URL: ${url}`);
  };

  image.src = url;
}

function setTexture() {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(u_texture, 0);
}

function draw() {
  gl.clearColor(0.15, 0.15, 0.3, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.perspective(projection, Math.PI / 5, gl.canvas.width / gl.canvas.height, 0.1, 20);
  mat4.identity(modelview);
  mat4.lookAt(modelview, [0, 0, 10], [0, 0, 0], [0, 1, 0]);
  mat4.rotateY(modelview, modelview, angle);

  mat3.normalFromMat4(normalMatrix, modelview);
  gl.uniformMatrix3fv(u_normalMatrix, false, normalMatrix);
  gl.uniformMatrix4fv(u_modelview, false, modelview);
  gl.uniformMatrix4fv(u_projection, false, projection);

  setTexture();

  gl.drawElements(gl.TRIANGLES, objects[0].indices.length, gl.UNSIGNED_SHORT, 0);

  angle += 0.01;
  requestAnimationFrame(draw);
}

function installModel(modelData) {
  gl.bindBuffer(gl.ARRAY_BUFFER, a_coords_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_coords_loc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_coords_loc);

  gl.bindBuffer(gl.ARRAY_BUFFER, a_normal_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexNormals, gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_normal_loc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_normal_loc);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexTextureCoords, gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_texcoord_loc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_texcoord_loc);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);
}

function initGL() {
  program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  a_coords_loc = gl.getAttribLocation(program, "a_coords");
  a_normal_loc = gl.getAttribLocation(program, "a_normal");
  a_texcoord_loc = gl.getAttribLocation(program, "a_texcoord");

  u_modelview = gl.getUniformLocation(program, "modelview");
  u_projection = gl.getUniformLocation(program, "projection");
  u_normalMatrix = gl.getUniformLocation(program, "normalMatrix");
  u_texture = gl.getUniformLocation(program, "u_texture");
  u_lightPosition = gl.getUniformLocation(program, "lightPosition");
  u_diffuseColor = gl.getUniformLocation(program, "diffuseColor");
  u_specularColor = gl.getUniformLocation(program, "specularColor");
  u_specularExponent = gl.getUniformLocation(program, "specularExponent");

  a_coords_buffer = gl.createBuffer();
  a_normal_buffer = gl.createBuffer();
  index_buffer = gl.createBuffer();

  gl.enable(gl.DEPTH_TEST);
  gl.uniform3f(u_specularColor, 0.5, 0.5, 0.5);
  gl.uniform4f(u_diffuseColor, 1, 1, 1, 1);
  gl.uniform1f(u_specularExponent, 10);
  gl.uniform4f(u_lightPosition, 0, 0, 0, 1);

  loadTexture("../assets/torus/blue.jpg");

  installModel(objects[0]);
  requestAnimationFrame(draw);
}

function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error(`Error in vertex shader: ${gl.getShaderInfoLog(vsh)}`);
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error(`Error in fragment shader: ${gl.getShaderInfoLog(fsh)}`);
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Link error in program: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML = "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL();
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML = `<p>Could not initialize the WebGL graphics context: ${e.message}</p>`;
    return;
  }
}

window.onload = init;
