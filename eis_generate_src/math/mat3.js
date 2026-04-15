// 3x3 matrix utilities. Row-major flat array of 9 numbers.
// M = [ m00 m01 m02 m10 m11 m12 m20 m21 m22 ]
window.APP = window.APP || {};
APP.mat3 = (function () {
  function identity() {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  function mul(A, B) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        r[i * 3 + j] =
          A[i * 3 + 0] * B[0 * 3 + j] +
          A[i * 3 + 1] * B[1 * 3 + j] +
          A[i * 3 + 2] * B[2 * 3 + j];
      }
    }
    return r;
  }
  function mulVec(M, v) {
    return [
      M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
      M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
      M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
    ];
  }
  function transpose(M) {
    return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
  }
  function inverse(M) {
    const a = M[0], b = M[1], c = M[2];
    const d = M[3], e = M[4], f = M[5];
    const g = M[6], h = M[7], i = M[8];
    const A = e * i - f * h;
    const B = -(d * i - f * g);
    const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) throw new Error("mat3 singular");
    const invDet = 1 / det;
    return [
      A * invDet,
      -(b * i - c * h) * invDet,
      (b * f - c * e) * invDet,
      B * invDet,
      (a * i - c * g) * invDet,
      -(a * f - c * d) * invDet,
      C * invDet,
      -(a * h - b * g) * invDet,
      (a * e - b * d) * invDet,
    ];
  }
  function intrinsic(fx, fy, cx, cy) {
    return [fx, 0, cx, 0, fy, cy, 0, 0, 1];
  }
  function toColumnMajor(M) {
    return new Float32Array([M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]);
  }
  return { identity, mul, mulVec, transpose, inverse, intrinsic, toColumnMajor };
})();
