// SO(3) utilities: exp, log, angular velocity via central difference.
// Depends on APP.mat3.
window.APP = window.APP || {};
APP.so3 = (function () {
  const { identity, mul, transpose } = APP.mat3;

  function hat(w) {
    return [
      0, -w[2], w[1],
      w[2], 0, -w[0],
      -w[1], w[0], 0,
    ];
  }
  function vee(M) {
    return [
      (M[7] - M[5]) * 0.5,
      (M[2] - M[6]) * 0.5,
      (M[3] - M[1]) * 0.5,
    ];
  }
  function exp(w) {
    const theta = Math.hypot(w[0], w[1], w[2]);
    if (theta < 1e-9) {
      const K = hat(w);
      const r = identity();
      for (let i = 0; i < 9; i++) r[i] += K[i];
      return r;
    }
    const k = [w[0] / theta, w[1] / theta, w[2] / theta];
    const K = hat(k);
    const K2 = mul(K, K);
    const s = Math.sin(theta);
    const c1 = 1 - Math.cos(theta);
    const r = identity();
    for (let i = 0; i < 9; i++) r[i] += s * K[i] + c1 * K2[i];
    return r;
  }
  function log(R) {
    const tr = R[0] + R[4] + R[8];
    const cos = Math.max(-1, Math.min(1, (tr - 1) * 0.5));
    const theta = Math.acos(cos);
    if (theta < 1e-9) {
      return [
        (R[7] - R[5]) * 0.5,
        (R[2] - R[6]) * 0.5,
        (R[3] - R[1]) * 0.5,
      ];
    }
    if (Math.PI - theta < 1e-6) {
      const m00 = R[0], m11 = R[4], m22 = R[8];
      let x, y, z;
      if (m00 >= m11 && m00 >= m22) {
        x = Math.sqrt(Math.max(0, m00 - m11 - m22 + 1)) * 0.5;
        y = (R[1] + R[3]) / (4 * x);
        z = (R[2] + R[6]) / (4 * x);
      } else if (m11 >= m22) {
        y = Math.sqrt(Math.max(0, m11 - m00 - m22 + 1)) * 0.5;
        x = (R[1] + R[3]) / (4 * y);
        z = (R[5] + R[7]) / (4 * y);
      } else {
        z = Math.sqrt(Math.max(0, m22 - m00 - m11 + 1)) * 0.5;
        x = (R[2] + R[6]) / (4 * z);
        y = (R[5] + R[7]) / (4 * z);
      }
      const n = Math.hypot(x, y, z);
      return [(x / n) * theta, (y / n) * theta, (z / n) * theta];
    }
    const s = theta / (2 * Math.sin(theta));
    return [
      (R[7] - R[5]) * s,
      (R[2] - R[6]) * s,
      (R[3] - R[1]) * s,
    ];
  }
  function angularVelocity(Rfn, t, dt) {
    const R0 = Rfn(t - dt * 0.5);
    const R1 = Rfn(t + dt * 0.5);
    const dR = mul(transpose(R0), R1);
    const w = log(dR);
    return [w[0] / dt, w[1] / dt, w[2] / dt];
  }
  return { hat, vee, exp, log, angularVelocity };
})();
