window.APP = window.APP || {};
APP.motion = APP.motion || {};
APP.motion.createSinusoidal = (function () {
  const DEG = Math.PI / 180;
  return function createSinusoidal(params) {
    const ax = (params.ax || 0) * DEG;
    const ay = (params.ay || 0) * DEG;
    const az = (params.az || 0) * DEG;
    const fx = params.fx || 0;
    const fy = params.fy || 0;
    const fz = params.fz || 0;
    const phx = params.phx || 0;
    const phy = params.phy || 0;
    const phz = params.phz || 0;
    return function axisAngleAt(t) {
      return [
        ax * Math.sin(2 * Math.PI * fx * t + phx),
        ay * Math.sin(2 * Math.PI * fy * t + phy),
        az * Math.sin(2 * Math.PI * fz * t + phz),
      ];
    };
  };
})();
