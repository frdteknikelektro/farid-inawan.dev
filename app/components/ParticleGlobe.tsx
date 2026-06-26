"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 2048;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Vortex transition: during a transfer each particle spirals around the Y axis,
// peaking at the flight midpoint and unwinding to zero at both ends so it still
// lands exactly on its target. SWIRL_BULGE pushes it outward into a funnel.
const SWIRL_TURNS = 2.4;
const SWIRL_BULGE = 0.55;

// Scenes the particles pass through, in scroll order. Each particle transfers
// directly from its current shape target to the next shape target.
const SHAPE_GLOBE = 0;
const SHAPE_TEXT1 = 1;
const SHAPE_TEXT2 = 2;
const SCREEN_COUNT = 3;
const SECTION_HEIGHT_VH = SCREEN_COUNT * 100;
const SHAPE_SCREEN_INDEX = [0, 1, 2];

// Closest the camera ever sits. On narrow/portrait viewports resize() pushes it
// further back so the formations still fit horizontally.
const BASE_CAMERA_Z = 7.1;
const BASE_PARTICLE_SIZE = 0.023;
const FIT_MARGIN = 1.12;

const TL_GLOBE_HOLD_END = 0.1;
const TL_TEXT_1_IN_END = 0.45;
const TL_TEXT_1_HOLD_END = 0.55;
const TL_TEXT_2_IN_END = 0.9;

type GlobeParticle = {
  direction: THREE.Vector3;
  phase: number;
};

type FormationTargets = {
  positions: Float32Array;
  colors: Float32Array;
};

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function createTextTargets(text: string, yOffset = 0): FormationTargets {
  const canvas = document.createElement("canvas");
  const width = 1024;
  const height = 280;
  const sampleStep = 2;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const points: Array<{ x: number; y: number; alpha: number }> = [];
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;

  if (!context) {
    return { positions, colors };
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  let fontSize = 142;

  do {
    context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    fontSize -= 4;
  } while (context.measureText(text).width > width * 0.86 && fontSize > 72);

  context.fillText(text, width / 2, height / 2 + 4);

  const pixels = context.getImageData(0, 0, width, height).data;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const alpha = pixels[(y * width + x) * 4 + 3];

      if (alpha > 60) {
        points.push({ x, y, alpha });
      }
    }
  }

  if (points.length === 0) {
    return { positions, colors };
  }

  const textScale = 7.05 / width;
  const colorA = new THREE.Color("#f6fbff");
  const colorB = new THREE.Color("#58e7ff");
  const colorC = new THREE.Color("#ffd86b");

  const samples: Array<{ x: number; y: number; z: number; r: number; g: number; b: number }> = [];

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const point = points[(index * 37) % points.length];
    const jitterX = Math.sin(index * 12.9898) * 0.006;
    const jitterY = Math.sin(index * 78.233) * 0.006;
    const depth = Math.sin(index * 3.71) * 0.016;
    const normalizedY = point.y / height;
    const color = normalizedY < 0.62
      ? colorA.clone().lerp(colorB, normalizedY / 0.62)
      : colorB.clone().lerp(colorC, (normalizedY - 0.62) / 0.38);

    samples.push({
      x: (point.x - width / 2) * textScale + jitterX,
      y: -(point.y - height / 2) * textScale + jitterY + yOffset,
      z: depth * (point.alpha / 255),
      r: color.r,
      g: color.g,
      b: color.b,
    });
  }

  // Order particles top to bottom so each particle index keeps the same vertical
  // rank across shapes: top maps to top, bottom maps to bottom.
  samples.sort((a, b) => b.y - a.y);

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const sample = samples[index];
    positions[index * 3] = sample.x;
    positions[index * 3 + 1] = sample.y;
    positions[index * 3 + 2] = sample.z;
    colors[index * 3] = sample.r;
    colors[index * 3 + 1] = sample.g;
    colors[index * 3 + 2] = sample.b;
  }

  return { positions, colors };
}

function createGlobeGeometry() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const particles: GlobeParticle[] = [];

  const north = new THREE.Color("#f4fbff");
  const equator = new THREE.Color("#72f0ff");
  const south = new THREE.Color("#ffcf6a");

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const y = 1 - (index / (PARTICLE_COUNT - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * index;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const direction = new THREE.Vector3(x, y, z).normalize();
    const particleRadius = 1.78 + Math.sin(index * 0.73) * 0.018;
    const color = y > 0 ? north.clone().lerp(equator, 1 - y) : equator.clone().lerp(south, -y);

    positions[index * 3] = direction.x * particleRadius;
    positions[index * 3 + 1] = direction.y * particleRadius;
    positions[index * 3 + 2] = direction.z * particleRadius;

    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;

    particles.push({
      direction,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return { geometry, particles };
}

export default function ParticleGlobe() {
  const sectionRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, BASE_CAMERA_Z);

    const group = new THREE.Group();
    scene.add(group);

    const { geometry: globeGeometry, particles } = createGlobeGeometry();
    const introTargets = createTextTargets("Hi! I'm Farid");
    const buildingTargets = createTextTargets("Currently building...");
    const colorAttribute = globeGeometry.getAttribute("color") as THREE.BufferAttribute;
    const globeColors = new Float32Array(colorAttribute.array as Float32Array);
    const globeMaterial = new THREE.PointsMaterial({
      size: BASE_PARTICLE_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const globe = new THREE.Points(globeGeometry, globeMaterial);
    group.add(globe);

    // Largest half-extent any formation reaches, used to fit the camera so the
    // widest text never clips off the sides on portrait/mobile screens.
    const maxAbsComponent = (arr: Float32Array, component: number) => {
      let max = 0;
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const value = Math.abs(arr[i * 3 + component]);
        if (value > max) {
          max = value;
        }
      }
      return max;
    };
    const contentHalfWidth = Math.max(
      1.78,
      maxAbsComponent(introTargets.positions, 0),
      maxAbsComponent(buildingTargets.positions, 0),
    );
    const contentHalfHeight = Math.max(
      1.78,
      maxAbsComponent(introTargets.positions, 1),
      maxAbsComponent(buildingTargets.positions, 1),
    );

    const pointer = new THREE.Vector2(0, 0);
    const pointerState = {
      hover: 0,
      targetHover: 0,
    };
    const scrollState = {
      current: 0,
      target: 0,
    };
    const clickBrush = {
      radiusBoost: 0,
      velocity: 0,
    };
    let viewportWorldHeight = 0;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height);
      const aspect = width / Math.max(height, 1);
      camera.aspect = aspect;

      // Pull the camera back until both the widest and tallest formation fit,
      // never closer than BASE_CAMERA_Z. Particle size tracks the distance so
      // dots keep the same on-screen size when the camera retreats.
      const halfFovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const zForWidth = (contentHalfWidth * FIT_MARGIN) / (halfFovTan * aspect);
      const zForHeight = (contentHalfHeight * FIT_MARGIN) / halfFovTan;
      camera.position.z = Math.max(BASE_CAMERA_Z, zForWidth, zForHeight);
      camera.updateProjectionMatrix();

      viewportWorldHeight = 2 * halfFovTan * camera.position.z;
      globeMaterial.size = BASE_PARTICLE_SIZE * (camera.position.z / BASE_CAMERA_Z);
    };

    const updateScroll = () => {
      const section = sectionRef.current;

      if (!section) {
        return;
      }

      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const rawProgress = -section.getBoundingClientRect().top / scrollable;
      scrollState.target = clamp01(rawProgress);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    updateScroll();

    const updatePointer = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointerState.targetHover = 1;
    };

    const onPointerDown = (event: PointerEvent) => {
      updatePointer(event);
      clickBrush.radiusBoost = Math.min(clickBrush.radiusBoost + 0.22, 0.34);
      clickBrush.velocity += 0.014;
    };

    const onPointerLeave = () => {
      pointerState.targetHover = 0;
    };

    mount.addEventListener("pointermove", updatePointer);
    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);

    let animationFrame = 0;
    const timer = new THREE.Timer();
    timer.connect(document);
    const positionAttribute = globeGeometry.getAttribute("position") as THREE.BufferAttribute;
    const groupQuaternion = new THREE.Quaternion();
    const inverseGroupQuaternion = new THREE.Quaternion();
    const localRight = new THREE.Vector3();
    const localUp = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    const projectedPosition = new THREE.Vector3();
    const brushDirection = new THREE.Vector3();
    const sandOffsets = new Float32Array(PARTICLE_COUNT * 3);
    const sandVelocities = new Float32Array(PARTICLE_COUNT * 3);
    const srcSample = new Float32Array(6); // x, y, z, r, g, b
    const tgtSample = new Float32Array(6);

    // Resolve one particle's position + colour for a given scene at time `elapsed`.
    // The globe keeps a subtle spin; text holds breathe in place.
    const sampleShape = (shape: number, index: number, elapsed: number, shapeWorldOffsets: number[], out: Float32Array) => {
      const offsetIndex = index * 3;
      const particle = particles[index];
      const worldOffsetY = shapeWorldOffsets[shape] ?? 0;

      if (shape === SHAPE_GLOBE) {
        const radius = 1.78 + Math.sin(elapsed * 1.35 + particle.phase) * 0.018;
        const spin = elapsed * 0.12;
        const cos = Math.cos(spin);
        const sin = Math.sin(spin);
        const dx = particle.direction.x;
        const dz = particle.direction.z;
        out[0] = (dx * cos - dz * sin) * radius;
        out[1] = particle.direction.y * radius + worldOffsetY;
        out[2] = (dx * sin + dz * cos) * radius;
        out[3] = globeColors[offsetIndex];
        out[4] = globeColors[offsetIndex + 1];
        out[5] = globeColors[offsetIndex + 2];
        return;
      }

      const text = shape === SHAPE_TEXT1 ? introTargets : buildingTargets;
      out[0] = text.positions[offsetIndex] + Math.sin(elapsed * 1.25 + particle.phase) * 0.012;
      out[1] = text.positions[offsetIndex + 1] + Math.cos(elapsed * 1.05 + particle.phase) * 0.009 + worldOffsetY;
      out[2] = text.positions[offsetIndex + 2] + Math.sin(elapsed * 1.6 + particle.phase) * 0.012;
      out[3] = text.colors[offsetIndex];
      out[4] = text.colors[offsetIndex + 1];
      out[5] = text.colors[offsetIndex + 2];
    };

    const animate = () => {
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.04);
      const elapsed = timer.getElapsed();
      const positions = positionAttribute.array as Float32Array;
      const colors = colorAttribute.array as Float32Array;

      pointerState.hover += (pointerState.targetHover - pointerState.hover) * 0.08;
      scrollState.current = scrollState.target;

      const timeline = scrollState.current;
      // Resolve the active scene segment: which shape we crumble FROM, which we
      // crumble TO, and the 0..1 sweep through that crumble. Hold segments use
      // the same shape for src and tgt with sweep = 1 (fully settled).
      let srcShape = SHAPE_GLOBE;
      let tgtShape = SHAPE_GLOBE;
      let sweep = 1;
      let scrollScreen = 0;

      if (timeline < TL_GLOBE_HOLD_END) {
        srcShape = SHAPE_GLOBE; tgtShape = SHAPE_GLOBE; sweep = 1;
        scrollScreen = SHAPE_SCREEN_INDEX[SHAPE_GLOBE];
      } else if (timeline < TL_TEXT_1_IN_END) {
        sweep = clamp01((timeline - TL_GLOBE_HOLD_END) / (TL_TEXT_1_IN_END - TL_GLOBE_HOLD_END));
        srcShape = SHAPE_GLOBE; tgtShape = SHAPE_TEXT1;
        scrollScreen = SHAPE_SCREEN_INDEX[SHAPE_GLOBE] + sweep;
      } else if (timeline < TL_TEXT_1_HOLD_END) {
        srcShape = SHAPE_TEXT1; tgtShape = SHAPE_TEXT1; sweep = 1;
        scrollScreen = SHAPE_SCREEN_INDEX[SHAPE_TEXT1];
      } else if (timeline < TL_TEXT_2_IN_END) {
        sweep = clamp01((timeline - TL_TEXT_1_HOLD_END) / (TL_TEXT_2_IN_END - TL_TEXT_1_HOLD_END));
        srcShape = SHAPE_TEXT1; tgtShape = SHAPE_TEXT2;
        scrollScreen = SHAPE_SCREEN_INDEX[SHAPE_TEXT1] + sweep;
      } else {
        srcShape = SHAPE_TEXT2; tgtShape = SHAPE_TEXT2; sweep = 1;
        scrollScreen = SHAPE_SCREEN_INDEX[SHAPE_TEXT2];
      }
      const shapeWorldOffsets = SHAPE_SCREEN_INDEX.map((screenIndex) => -viewportWorldHeight * screenIndex);
      const scrollWorldOffsetY = viewportWorldHeight * scrollScreen;

      // Pointer tilt only applies while the globe is the live shape.
      const globeWeight = 1 - smoothstep(clamp01((timeline - TL_GLOBE_HOLD_END) / (TL_TEXT_1_IN_END - TL_GLOBE_HOLD_END)));
      const targetRotationX = pointer.y * 0.16 * pointerState.hover * globeWeight;
      const targetRotationY = pointer.x * 0.28 * pointerState.hover * globeWeight;
      group.rotation.x += (targetRotationX - group.rotation.x) * 0.045;
      group.rotation.y += (targetRotationY - group.rotation.y) * 0.04;
      group.rotation.z += (Math.sin(elapsed * 0.16) * 0.035 * globeWeight - group.rotation.z) * 0.045;
      group.getWorldQuaternion(groupQuaternion);
      inverseGroupQuaternion.copy(groupQuaternion).invert();
      localRight.set(1, 0, 0).applyQuaternion(inverseGroupQuaternion);
      localUp.set(0, 1, 0).applyQuaternion(inverseGroupQuaternion);

      const step = delta * 60;
      clickBrush.velocity += -clickBrush.radiusBoost * 0.028 * step;
      clickBrush.velocity *= Math.pow(0.86, step);
      clickBrush.radiusBoost += clickBrush.velocity * step;

      if (Math.abs(clickBrush.radiusBoost) < 0.001 && Math.abs(clickBrush.velocity) < 0.001) {
        clickBrush.radiusBoost = 0;
        clickBrush.velocity = 0;
      } else if (clickBrush.radiusBoost < 0) {
        clickBrush.radiusBoost = 0;
        clickBrush.velocity *= -0.16;
      } else if (clickBrush.radiusBoost > 0.34) {
        clickBrush.radiusBoost = 0.34;
        clickBrush.velocity *= -0.22;
      }

      const brushRadius = 0.18 + clickBrush.radiusBoost;
      const brushRadiusSq = brushRadius * brushRadius;

      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const offsetIndex = index * 3;
        const particle = particles[index];

        sampleShape(srcShape, index, elapsed, shapeWorldOffsets, srcSample);
        sampleShape(tgtShape, index, elapsed, shapeWorldOffsets, tgtSample);

        // Vortex transfer: particles travel from source to target on a path that
        // spirals around the Y axis. The swirl peaks mid-flight and unwinds to
        // zero at both ends, so each particle still lands exactly on its target.
        const arrival = (PARTICLE_COUNT - index) / PARTICLE_COUNT;
        const settle = srcShape === tgtShape ? 1 : clamp01(sweep / arrival);
        const sourceWorldOffsetY = shapeWorldOffsets[srcShape] ?? 0;
        const targetWorldOffsetY = shapeWorldOffsets[tgtShape] ?? 0;
        const sourceLocalY = srcSample[1] - sourceWorldOffsetY;
        const targetLocalY = tgtSample[1] - targetWorldOffsetY;
        const sectionSettle = settle * settle;

        const lerpX = srcSample[0] + (tgtSample[0] - srcSample[0]) * settle;
        const lerpZ = srcSample[2] + (tgtSample[2] - srcSample[2]) * settle;
        const swirlEnvelope = Math.sin(settle * Math.PI); // 0 at both ends, 1 mid-flight
        const swirlAngle = swirlEnvelope * SWIRL_TURNS * (0.85 + ((index % 11) / 11) * 0.3);
        const swirlBulge = 1 + swirlEnvelope * SWIRL_BULGE;
        const swirlCos = Math.cos(swirlAngle);
        const swirlSin = Math.sin(swirlAngle);
        const baseX = (lerpX * swirlCos - lerpZ * swirlSin) * swirlBulge;
        const baseY = sourceLocalY
          + (targetLocalY - sourceLocalY) * settle
          + sourceWorldOffsetY
          + (targetWorldOffsetY - sourceWorldOffsetY) * sectionSettle
          + scrollWorldOffsetY;
        const baseZ = (lerpX * swirlSin + lerpZ * swirlCos) * swirlBulge;
        let offsetX = sandOffsets[offsetIndex];
        let offsetY = sandOffsets[offsetIndex + 1];
        let offsetZ = sandOffsets[offsetIndex + 2];
        let velocityX = sandVelocities[offsetIndex];
        let velocityY = sandVelocities[offsetIndex + 1];
        let velocityZ = sandVelocities[offsetIndex + 2];
        worldPosition.set(baseX + offsetX, baseY + offsetY, baseZ + offsetZ).applyQuaternion(groupQuaternion);
        const projected = projectedPosition.copy(worldPosition).project(camera);
        const awayX = projected.x - pointer.x;
        const awayY = projected.y - pointer.y;
        const distanceSq = awayX * awayX + awayY * awayY;

        if (distanceSq < brushRadiusSq) {
          const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
          const falloff = 1 - distanceSq / brushRadiusSq;
          const frontWeight = THREE.MathUtils.smoothstep(worldPosition.z, -0.9, 1.5);
          const clickStrength = 1 + clickBrush.radiusBoost * 1.45;
          const push = falloff * falloff * frontWeight * pointerState.hover * clickStrength * 0.034 * step;
          const grain = Math.sin(elapsed * 8 + particle.phase) * falloff * frontWeight * pointerState.hover * clickStrength * 0.005 * step;
          const forceX = (awayX / distance) * push + (-awayY / distance) * grain;
          const forceY = (awayY / distance) * push + (awayX / distance) * grain;

          brushDirection
            .copy(localRight)
            .multiplyScalar(forceX)
            .addScaledVector(localUp, forceY);

          velocityX += brushDirection.x;
          velocityY += brushDirection.y;
          velocityZ += brushDirection.z;
          offsetX += brushDirection.x * 0.48;
          offsetY += brushDirection.y * 0.48;
          offsetZ += brushDirection.z * 0.48;
        }

        velocityX += -offsetX * 0.01 * step;
        velocityY += -offsetY * 0.01 * step;
        velocityZ += -offsetZ * 0.01 * step;

        const damping = Math.pow(0.92, step);
        velocityX *= damping;
        velocityY *= damping;
        velocityZ *= damping;

        offsetX += velocityX * step;
        offsetY += velocityY * step;
        offsetZ += velocityZ * step;

        const offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);

        if (offsetLength > 0.52) {
          const limit = 0.52 / offsetLength;
          offsetX *= limit;
          offsetY *= limit;
          offsetZ *= limit;
          velocityX *= 0.45;
          velocityY *= 0.45;
          velocityZ *= 0.45;
        }

        sandOffsets[offsetIndex] = offsetX;
        sandOffsets[offsetIndex + 1] = offsetY;
        sandOffsets[offsetIndex + 2] = offsetZ;
        sandVelocities[offsetIndex] = velocityX;
        sandVelocities[offsetIndex + 1] = velocityY;
        sandVelocities[offsetIndex + 2] = velocityZ;

        positions[offsetIndex] = baseX + offsetX;
        positions[offsetIndex + 1] = baseY + offsetY;
        positions[offsetIndex + 2] = baseZ + offsetZ;

        // Colour follows the same direct source-to-target transfer.
        const cr = srcSample[3] + (tgtSample[3] - srcSample[3]) * settle;
        const cg = srcSample[4] + (tgtSample[4] - srcSample[4]) * settle;
        const cb = srcSample[5] + (tgtSample[5] - srcSample[5]) * settle;
        colors[offsetIndex] = cr;
        colors[offsetIndex + 1] = cg;
        colors[offsetIndex + 2] = cb;
      }

      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mount.removeEventListener("pointermove", updatePointer);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      mount.removeChild(renderer.domElement);

      globeGeometry.dispose();
      globeMaterial.dispose();
      timer.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#030608]"
      style={{ height: `${SECTION_HEIGHT_VH}vh` }}
    >
      <div className="sticky top-0 grid h-screen place-items-center overflow-hidden">
        <div
          ref={mountRef}
          aria-label="Interactive particle intro"
          className="h-screen w-screen cursor-crosshair touch-pan-y"
          role="img"
        />
      </div>
    </section>
  );
}
