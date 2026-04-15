// Generate Gyroflow .gcsv sidecar file from an R(t) trajectory.
//
// Fixed output layout — NO orientation remapping:
//   gx = yaw-rate        (our ωy, rotation around vertical axis)
//   gy = -pitch-rate     (our -ωx, flipped so "up" tilt is positive)
//   gz = roll-rate       (our ωz, rotation around forward axis)
// Accelerometer uses the same column order with the same pitch sign flip.
// The file writes `orientation,xyz` literally — any axis/sign adjustment is
// done in Gyroflow's own orientation dropdown.
window.APP = window.APP || {};
APP.exports = APP.exports || {};
APP.exports.buildGcsv = (function () {
  const { angularVelocity } = APP.so3;
  const { mulVec, transpose } = APP.mat3;

  function fmt(x) {
    return Number.isFinite(x) ? x.toFixed(6) : "0";
  }

  return function buildGcsv(Rfn, state) {
    const rate = state.gyroRate;
    const duration = state.duration;
    const dt = 1 / rate;
    const N = Math.round(duration * rate);
    const h = dt * 0.5;
    // Gravity: Y axis points DOWN, so g points in +Y with magnitude 9.81.
    const g_world = [0, 9.81, 0];

    const lines = [];
    lines.push("GYROFLOW IMU LOG");
    lines.push("version,1.3");
    lines.push("id,eis-test-gen");
    lines.push("orientation,xyz");
    lines.push("tscale,0.001");
    lines.push("gscale,1.0");
    lines.push("ascale,1.0");
    lines.push("note,synthetic shake");
    lines.push("t,gx,gy,gz,ax,ay,az");

    for (let i = 0; i < N; i++) {
      const t = i * dt;
      const w_body = angularVelocity(Rfn, t, h);
      const R = Rfn(t);
      const neg_g = [-g_world[0], -g_world[1], -g_world[2]];
      const a_body = mulVec(transpose(R), neg_g);

      // (gx, gy, gz) = (yaw, -pitch, roll) = (ωy, -ωx, ωz)
      const gx = w_body[1], gy = -w_body[0], gz = w_body[2];
      const ax = a_body[1], ay = -a_body[0], az = a_body[2];
      const tRaw = Math.round(t * 1000);
      lines.push(
        tRaw + "," + fmt(gx) + "," + fmt(gy) + "," + fmt(gz) +
        "," + fmt(ax) + "," + fmt(ay) + "," + fmt(az)
      );
    }
    return lines.join("\n") + "\n";
  };
})();
