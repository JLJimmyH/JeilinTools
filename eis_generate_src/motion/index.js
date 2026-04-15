// Combines motion components into a single R(t) trajectory function.
window.APP = window.APP || {};
APP.motion = APP.motion || {};
APP.motion.buildTrajectory = (function () {
  const { exp } = APP.so3;
  const { identity, mul } = APP.mat3;
  const createSinusoidal = APP.motion.createSinusoidal;

  return function buildTrajectory(state) {
    const components = [];
    components.push(
      createSinusoidal({
        ax: state.sinAx, fx: state.sinFx, phx: 0,
        ay: state.sinAy, fy: state.sinFy, phy: 0,
        az: state.sinAz, fz: state.sinFz, phz: 0,
      })
    );
    return function Rat(t) {
      let R = identity();
      for (const comp of components) {
        const w = comp(t);
        R = mul(R, exp(w));
      }
      return R;
    };
  };
})();
