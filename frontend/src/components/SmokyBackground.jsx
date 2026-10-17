import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scroll;
uniform float u_dark;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Scroll ke saath rang: candy red -> violet -> ember orange -> teal
vec3 palette(float s) {
  vec3 c0 = vec3(0.90, 0.12, 0.22);
  vec3 c1 = vec3(0.36, 0.27, 0.72);
  vec3 c2 = vec3(0.85, 0.30, 0.10);
  vec3 c3 = vec3(0.10, 0.55, 0.45);
  float x = clamp(s, 0.0, 1.0) * 3.0;
  if (x < 1.0) return mix(c0, c1, x);
  if (x < 2.0) return mix(c1, c2, x - 1.0);
  return mix(c2, c3, x - 2.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  p *= 1.6;
  p.y += u_scroll * 1.2;
  float t = u_time * 0.035;

  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(p + 3.5 * q + vec2(1.7, 9.2) + 1.5 * t),
    fbm(p + 3.5 * q + vec2(8.3, 2.8) - 1.2 * t)
  );
  float f = fbm(p + 3.5 * r);

  float ridge = 1.0 - abs(2.0 * f - 1.0);
  float dens = smoothstep(0.35, 0.95, mix(f, ridge, 0.55));
  dens = pow(dens, 1.6);

  vec3 tint = mix(palette(u_scroll), palette(clamp(u_scroll + 0.25, 0.0, 1.0)), r.x);

  vec3 darkCol = vec3(0.025, 0.022, 0.04) + tint * dens * 0.55 + tint * 0.04 * f;
  float vig = smoothstep(1.2, 0.2, length(uv - 0.5));
  darkCol *= mix(0.6, 1.0, vig);

  vec3 lightCol = mix(vec3(0.955, 0.945, 0.94), tint * 0.9 + 0.1, dens * 0.5);

  gl_FragColor = vec4(mix(lightCol, darkCol, u_dark), 1.0);
}
`;

// Dark mode body ke text colour se pehchanta hai: text halka hai to dark mode.
// Isse CSS aur background hamesha ek hi mode me rehte hain.
function isDarkTheme() {
    const html = document.documentElement;
    const body = document.body;
    if (
        html.classList.contains("dark") ||
        html.dataset.theme === "dark" ||
        body.classList.contains("dark") ||
        body.dataset.theme === "dark"
    ) {
        return true;
    }
    const m = getComputedStyle(body).color.match(/[\d.]+/g);
    if (!m || m.length < 3) return false;
    const [r, g, b] = m.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Smoke shader error:", gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

export default function SmokyBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext("webgl", {
            antialias: false,
            alpha: false,
            powerPreference: "low-power",
        });
        if (!gl) return; // WebGL nahi to solid background dikhega, site chalti rahegi

        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Smoke program error:", gl.getProgramInfoLog(program));
            return;
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, "a_pos");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        const uRes = gl.getUniformLocation(program, "u_res");
        const uTime = gl.getUniformLocation(program, "u_time");
        const uScroll = gl.getUniformLocation(program, "u_scroll");
        const uDark = gl.getUniformLocation(program, "u_dark");

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const SCALE = 0.5;
        let raf = 0;
        let dark = isDarkTheme();
        let target = 0;
        let current = 0;

        const resize = () => {
            canvas.width = Math.max(1, Math.floor(window.innerWidth * SCALE));
            canvas.height = Math.max(1, Math.floor(window.innerHeight * SCALE));
            gl.viewport(0, 0, canvas.width, canvas.height);
        };

        const readScroll = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        };

        const draw = (ms) => {
            current += (target - current) * 0.05;
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, 40 + ms / 1000);
            gl.uniform1f(uScroll, current);
            gl.uniform1f(uDark, dark ? 1 : 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        const loop = (ms) => {
            draw(ms);
            raf = requestAnimationFrame(loop);
        };

        const staticRedraw = () => {
            current = target;
            draw(0);
        };

        const refreshTheme = () => {
            dark = isDarkTheme();
            if (reduceMotion) staticRedraw();
        };

        const onScroll = () => {
            readScroll();
            if (reduceMotion) staticRedraw();
        };
        const onResize = () => {
            resize();
            readScroll();
            if (reduceMotion) staticRedraw();
        };
        const onVisibility = () => {
            if (reduceMotion) return;
            if (document.hidden) cancelAnimationFrame(raf);
            else raf = requestAnimationFrame(loop);
        };

        // Theme badalne par palette badle (observer + halka polling, dono)
        const observer = new MutationObserver(refreshTheme);
        const watch = { attributes: true, attributeFilter: ["class", "data-theme"] };
        observer.observe(document.documentElement, watch);
        observer.observe(document.body, watch);
        const themeTimer = setInterval(refreshTheme, 400);

        resize();
        readScroll();
        current = target;

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisibility);

        if (reduceMotion) staticRedraw();
        else raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            clearInterval(themeTimer);
            observer.disconnect();
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVisibility);
            // NOTE: context ko yahan "lose" nahi karna, warna StrictMode me dusri baar canvas khali reh jata hai
        };
    }, []);

    return <canvas ref={canvasRef} className="smoke-canvas" aria-hidden="true" />;
}