// WebGL homography warp pass.
// For each output pixel p_out, samples the source at K·R·K⁻¹·p_out + srcOffset.
window.APP = window.APP || {};
APP.render = APP.render || {};
APP.render.WarpGL = (function () {
  const { mul, inverse, toColumnMajor } = APP.mat3;

  const VS = "#version 300 es\n" +
    "in vec2 a_pos;\n" +
    "out vec2 v_uv_out;\n" +
    "uniform vec2 u_outSize;\n" +
    "void main() {\n" +
    "  v_uv_out = (a_pos * 0.5 + 0.5) * u_outSize;\n" +
    "  gl_Position = vec4(a_pos, 0.0, 1.0);\n" +
    "}\n";

  const FS = "#version 300 es\n" +
    "precision highp float;\n" +
    "in vec2 v_uv_out;\n" +
    "out vec4 outColor;\n" +
    "uniform sampler2D u_src;\n" +
    "uniform mat3 u_H;\n" +
    "uniform vec2 u_srcSize;\n" +
    "uniform vec2 u_srcOffset;\n" +
    "void main() {\n" +
    "  vec3 p = u_H * vec3(v_uv_out, 1.0);\n" +
    "  vec2 p_src = p.xy / p.z + u_srcOffset;\n" +
    "  vec2 uv = p_src / u_srcSize;\n" +
    "  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {\n" +
    "    outColor = vec4(0.0, 0.0, 0.0, 1.0);\n" +
    "  } else {\n" +
    "    outColor = texture(u_src, vec2(uv.x, 1.0 - uv.y));\n" +
    "  }\n" +
    "}\n";

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error("Shader compile error: " + log);
    }
    return sh;
  }
  function compileProgram(gl, vs, fs) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  function WarpGL(canvas) {
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;
    this.canvas = canvas;
    const prog = compileProgram(gl, VS, FS);
    this.prog = prog;
    this.loc = {
      a_pos: gl.getAttribLocation(prog, "a_pos"),
      u_outSize: gl.getUniformLocation(prog, "u_outSize"),
      u_src: gl.getUniformLocation(prog, "u_src"),
      u_H: gl.getUniformLocation(prog, "u_H"),
      u_srcSize: gl.getUniformLocation(prog, "u_srcSize"),
      u_srcOffset: gl.getUniformLocation(prog, "u_srcOffset"),
    };
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW);
    this.vbo = vbo;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = tex;
  }
  WarpGL.prototype.resize = function (outW, outH) {
    this.canvas.width = outW;
    this.canvas.height = outH;
    this.gl.viewport(0, 0, outW, outH);
  };
  WarpGL.prototype.uploadSource = function (sourceCanvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  };
  WarpGL.prototype.draw = function (R, K, outW, outH, srcW, srcH) {
    const gl = this.gl;
    const Kinv = inverse(K);
    const H = mul(mul(K, R), Kinv);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.loc.a_pos);
    gl.vertexAttribPointer(this.loc.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.u_src, 0);
    gl.uniformMatrix3fv(this.loc.u_H, false, toColumnMajor(H));
    gl.uniform2f(this.loc.u_outSize, outW, outH);
    gl.uniform2f(this.loc.u_srcSize, srcW, srcH);
    gl.uniform2f(this.loc.u_srcOffset, (srcW - outW) / 2, (srcH - outH) / 2);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  return WarpGL;
})();
