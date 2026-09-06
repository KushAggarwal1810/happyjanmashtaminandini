// A small GPU river/foliage treatment. Krishna's figure stays still and undistorted.
// The original image remains the accessible, no-WebGL fallback.
(() => {
  const canvas = document.querySelector('#livingArt');
  const artwork = document.querySelector('#heroArt img');
  const host = document.querySelector('#heroArt');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: false });
  if (!gl) return;
  let frame = 0;
  let ready = false;
  let inView = true;
  let elapsed = 0;
  let lastTime = 0;
  let previousDraw = 0;
  let width = 0, height = 0;
  let program;
  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUV;
    uniform vec2 uScale;
    uniform vec2 uOffset;
    void main() {
      vUV = aPosition * .5 + .5;
      gl_Position = vec4(aPosition * uScale + uOffset, 0., 1.);
    }
  `;
  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 vUV;
    uniform sampler2D uImage;
    uniform float uTime;
    uniform vec2 uSampleStep;
    void main() {
      vec2 uv = vUV;
      float water = (1. - smoothstep(.28, .46, uv.x)) * smoothstep(.04, .13, uv.y) * (1. - smoothstep(.36, .45, uv.y));
      float ripple = sin(uv.y * 180. + uTime * 1.4) * .0018 + sin(uv.y * 87. - uTime * .8 + uv.x * 15.) * .0013;
      uv.x += ripple * water;
      uv.y += sin(uv.x * 36. + uTime * .7) * .0009 * water;
      float foliage = smoothstep(.72, .92, uv.y) * (1. - smoothstep(.27, .44, uv.x));
      uv.x += sin(uv.y * 13. + uTime * .6) * .0009 * foliage;
      uv = clamp(uv, .002, .998);
      vec4 color = (texture2D(uImage, uv + uSampleStep) + texture2D(uImage, uv - uSampleStep)
        + texture2D(uImage, uv + vec2(uSampleStep.x, -uSampleStep.y))
        + texture2D(uImage, uv + vec2(-uSampleStep.x, uSampleStep.y))) * .25;
      float reflection = pow(max(0., sin(uv.y * 210. + uTime * 1.2)), 12.) * water;
      color.rgb += vec3(.025, .042, .043) * reflection;
      gl_FragColor = color;
    }
  `;
  function shader(type, source) {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader unavailable');
    return s;
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.round(rect.width * dpr); height = Math.round(rect.height * dpr);
    canvas.width = width; canvas.height = height;
    gl.viewport(0, 0, width, height);
    const imageRatio = artwork.naturalWidth / artwork.naturalHeight;
    const boxRatio = width / height;
    const sx = Math.min(1, imageRatio / boxRatio), sy = Math.min(1, boxRatio / imageRatio);
    gl.uniform2f(gl.getUniformLocation(program, 'uScale'), sx, sy);
    gl.uniform2f(gl.getUniformLocation(program, 'uOffset'), 1 - sx, 0);
    gl.uniform2f(gl.getUniformLocation(program, 'uSampleStep'), .28 / (width * sx), .28 / (height * sy));
  }
  function draw() {
    if (!ready || gl.isContextLost()) return;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function tick(time) {
    frame = 0;
    if (!ready || !inView || document.hidden || document.body.classList.contains('motion-paused')) return;
    if (time - previousDraw >= 32) {
      elapsed += Math.min((time - lastTime) / 1000, .05) * .5;
      previousDraw = time; draw();
    }
    lastTime = time;
    frame = requestAnimationFrame(tick);
  }
  function update() {
    cancelAnimationFrame(frame); frame = 0;
    if (ready) { draw(); lastTime = performance.now(); frame = requestAnimationFrame(tick); }
  }
  function init() {
    try {
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artwork);
      resize(); ready = true; draw(); host.classList.add('gpu-ready'); update();
      new ResizeObserver(() => { resize(); draw(); }).observe(host);
      new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update(); }).observe(host);
      document.addEventListener('visibilitychange', update);
      canvas.addEventListener('webglcontextlost', () => { ready = false; cancelAnimationFrame(frame); host.classList.remove('gpu-ready'); });
    } catch (_) { host.classList.remove('gpu-ready'); }
  }
  if (artwork.complete && artwork.naturalWidth) init(); else artwork.addEventListener('load', init, { once: true });
})();
