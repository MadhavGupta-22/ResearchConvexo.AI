import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Dashboard from './Dashboard';
import TransitionAnimation from './TransitionAnimation';
import './App.css';
gsap.registerPlugin(ScrollTrigger);

const PAPER_COUNT = 18;
const Y_SPREAD = 4.5;

const P = {
    stack: [0.0, 0.08],
    explode: [0.08, 0.2],
    grid: [0.2, 0.33],
    network: [0.33, 0.46],
    attach: [0.46, 0.55],
    dataflow: [0.55, 0.7],
    output: [0.7, 0.82],
    morph: [0.82, 0.92],
    expand: [0.92, 0.97],
    cta: [0.97, 1.0],
};

const LAYERS = [
    { count: 8, x: -5 },
    { count: 5, x: -1.7 },
    { count: 3, x: 1.5 },
    { count: 1, x: 5.5 },
];

const ph = (s, a, b) => THREE.MathUtils.clamp((s - a) / (b - a), 0, 1);
const sm = (t) => t * t * (3 - 2 * t);
const lA = (o, a, b, t) => {
    o[0] = THREE.MathUtils.lerp(a[0], b[0], t);
    o[1] = THREE.MathUtils.lerp(a[1], b[1], t);
    o[2] = THREE.MathUtils.lerp(a[2], b[2], t);
};

const buildNodes = () =>
    LAYERS.map((l) =>
        Array.from({ length: l.count }, (_, i) => {
            const y =
                l.count === 1
                    ? 0
                    : (i - (l.count - 1) / 2) * ((Y_SPREAD * 2) / (l.count - 1));
            return new THREE.Vector3(l.x, y, 0);
        })
    );

const buildConnections = (nodes) => {
    const c = [];
    for (let l = 0; l < nodes.length - 1; l++)
        for (const from of nodes[l])
            for (const to of nodes[l + 1])
                c.push({ from: from.clone(), to: to.clone(), layer: l });
    return c;
};

/* ─── Handwriting scribble texture for input papers ─── */
const createScribbleTexture = (seed = 0) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#fefdfb';
    ctx.fillRect(0, 0, 512, 720);

    for (let i = 0; i < 800; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.015})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 720, 1, 1);
    }

    let s = seed * 9301 + 49297;
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let px = 40;
    const titleY = 52;
    const titleW = 140 + rng() * 120;
    ctx.moveTo(px, titleY);
    while (px < 40 + titleW) {
        px += 4 + rng() * 6;
        ctx.lineTo(px, titleY + (rng() - 0.5) * 2);
    }
    ctx.stroke();

    for (let l = 0; l < 22; l++) {
        const y = 95 + l * 28 + (rng() - 0.5) * 4;
        const w = l >= 20 ? 60 + rng() * 100 : 280 + rng() * 150;
        ctx.strokeStyle = `rgba(20,20,20,${0.7 + rng() * 0.3})`;
        ctx.lineWidth = 1.8 + rng() * 0.8;
        ctx.beginPath();
        let lx = 40;
        ctx.moveTo(lx, y);
        while (lx < 40 + w) {
            lx += 3 + rng() * 8;
            ctx.lineTo(Math.min(lx, 40 + w), y + (rng() - 0.5) * 1.8);
        }
        ctx.stroke();

        if (rng() > 0.7 && l < 19) {
            const gapX = 40 + w * (0.3 + rng() * 0.4);
            ctx.fillStyle = '#fefdfb';
            ctx.fillRect(gapX, y - 5, 12 + rng() * 18, 10);
        }
    }

    if (seed % 3 === 0) {
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath();
        ctx.arc(24, 52, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    if (seed % 3 === 1) {
        for (let i = 0; i < 4; i++) {
            const by = 500 + i * 28;
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(50, by, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(64, by);
            let bx = 64;
            while (bx < 64 + 100 + rng() * 120) {
                bx += 4 + rng() * 7;
                ctx.lineTo(bx, by + (rng() - 0.5) * 1.5);
            }
            ctx.stroke();
        }
    }

    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    t.anisotropy = 16;
    return t;
};

/* ─── Output card scribble: "Summary" heading + body scribble lines ─── */
const createOutputScribbleTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 720);

    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.006})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 720, 1, 1);
    }

    let s = 77;
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    // "Summary" heading
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.fillText('Summary', 50, 75);

    // Indigo accent underline
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 88);
    ctx.lineTo(210, 88);
    ctx.stroke();

    // Body scribble lines
    const bodyStartY = 125;
    const lineSpacing = 26;
    const totalLines = 20;

    for (let l = 0; l < totalLines; l++) {
        const y = bodyStartY + l * lineSpacing + (rng() - 0.5) * 2;
        const isShort = l === totalLines - 1 || l === 8 || l === 14;
        const lineWidth = isShort ? 80 + rng() * 100 : 340 + rng() * 90;

        ctx.strokeStyle = `rgba(30, 41, 59, ${0.45 + rng() * 0.2})`;
        ctx.lineWidth = 1.5 + rng() * 0.5;
        ctx.lineCap = 'round';
        ctx.beginPath();

        let lx = 50;
        ctx.moveTo(lx, y);
        while (lx < 50 + lineWidth) {
            const step = 3 + rng() * 7;
            lx += step;
            const wobble = (rng() - 0.5) * 1.2;
            ctx.lineTo(Math.min(lx, 50 + lineWidth), y + wobble);
        }
        ctx.stroke();

        if (rng() > 0.6 && !isShort && l > 0) {
            const gapX = 50 + lineWidth * (0.2 + rng() * 0.5);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(gapX, y - 4, 8 + rng() * 14, 8);
        }
    }

    // Indigo bullet dots
    [125, 255, 385].forEach((by) => {
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(36, by, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    t.anisotropy = 16;
    return t;
};

/* ─── Background ─── */
const BackgroundEffects = ({ scrollProgress }) => {
    const gridRef = useRef(null);

    const gridGeo = useMemo(() => {
        const pts = [];
        for (let i = -30; i <= 30; i += 2) {
            pts.push(i, -30, -15, i, 30, -15, -30, i, -15, 30, i, -15);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        return g;
    }, []);

    useFrame(() => {
        if (gridRef.current)
            gridRef.current.material.opacity = 0.03 + scrollProgress.current * 0.04;
    });

    return (
        <lineSegments ref={gridRef} geometry={gridGeo}>
            <lineBasicMaterial color="#c7d2fe" transparent opacity={0.03} />
        </lineSegments>
    );
};

const AmbientParticles = ({ scrollProgress }) => {
    const ref = useRef(null);
    const N = 120;
    const positions = useMemo(() => {
        const p = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            p[i * 3] = (Math.random() - 0.5) * 40;
            p[i * 3 + 1] = (Math.random() - 0.5) * 25;
            p[i * 3 + 2] = -10 - Math.random() * 10;
        }
        return p;
    }, []);

    useFrame(({ clock }) => {
        if (!ref.current) return;
        const t = clock.getElapsedTime();
        const arr = ref.current.geometry.attributes.position.array;
        for (let i = 0; i < N; i++) {
            arr[i * 3 + 1] += Math.sin(t * 0.2 + i * 0.8) * 0.001;
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
        ref.current.material.opacity = 0.15 + scrollProgress.current * 0.1;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                color="#818cf8"
                transparent
                opacity={0.15}
                size={0.05}
                sizeAttenuation
            />
        </points>
    );
};

/* ─── Paper Card ─── */
const PaperCard = ({ index, phases, stackPos, explodePos, gridPos, inputNodePos }) => {
    const ref = useRef(null);
    const shadowRef = useRef(null);
    const pos = useMemo(() => [0, 0, 0], []);
    const texture = useMemo(() => createScribbleTexture(index), [index]);
    const rRot = useMemo(
        () => [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2],
        []
    );

    useFrame(({ clock }) => {
        if (!ref.current) return;
        const { explode, grid, attach, output } = phases.current;
        const t = clock.getElapsedTime();

        lA(pos, stackPos, explodePos, explode);
        if (grid > 0) lA(pos, pos, gridPos, grid);
        if (attach > 0) lA(pos, pos, inputNodePos, attach);
        if (output > 0) {
            pos[0] = THREE.MathUtils.lerp(pos[0], 0, output);
            pos[1] = THREE.MathUtils.lerp(pos[1], 0, output);
            pos[2] = THREE.MathUtils.lerp(pos[2], 0, output);
        }

        const idle = (1 - explode) * 0.3;
        pos[1] += Math.sin(t * 0.8 + index * 0.7) * 0.04 * idle;

        ref.current.position.set(pos[0], pos[1], pos[2]);

        const bz = index * 0.035;
        const gs = grid * (1 - attach);
        ref.current.rotation.set(
            rRot[0] * explode * (1 - grid) + Math.sin(t * 0.5 + index) * 0.015 * gs,
            rRot[1] * explode * (1 - grid),
            bz * (1 - explode) + rRot[2] * explode * (1 - grid)
        );

        const gridScale = THREE.MathUtils.lerp(1, 0.6, grid);
        const sc = Math.max(
            THREE.MathUtils.lerp(
                THREE.MathUtils.lerp(1.3, 0.35, attach),
                0,
                output
            ) * gridScale,
            0
        );
        ref.current.scale.setScalar(sc);
        ref.current.material.opacity = THREE.MathUtils.lerp(1, 0, output);

        if (shadowRef.current) {
            shadowRef.current.position.set(pos[0] + 0.04, pos[1] - 0.04, pos[2] - 0.04);
            shadowRef.current.rotation.copy(ref.current.rotation);
            shadowRef.current.scale.copy(ref.current.scale);
            shadowRef.current.material.opacity = 1 * (1 - output);
        }
    });

    return (
        <group>
            <mesh ref={shadowRef}>
                <boxGeometry args={[2.88, 3.58, 0.01]} />
                <meshBasicMaterial color="#94a3b8" transparent opacity={0.12} />
            </mesh>
            <mesh ref={ref} castShadow>
                <boxGeometry args={[2.8, 3.5, 0.02]} />
                <meshBasicMaterial map={texture} toneMapped={false} transparent side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

/* ─── Network Node ─── */
const NetworkNode = ({ position, phases, isOutput, layerIndex, nodeIndex }) => {
    const coreRef = useRef(null);
    const glowRef = useRef(null);

    const displayColor = useMemo(() => new THREE.Color(), []);
    const dullBlue = useMemo(() => new THREE.Color('#1e3a5f'), []);
    const brightBlue = useMemo(() => new THREE.Color('#4f8fff'), []);
    const dullYellow = useMemo(() => new THREE.Color('#5c4a1e'), []);
    const brightYellow = useMemo(() => new THREE.Color('#fbbf24'), []);
    const superBrightYellow = useMemo(() => new THREE.Color('#fff176'), []);

    useFrame(() => {
        if (!coreRef.current) return;
        const net = phases.current.network;
        const df = phases.current.dataflow;
        const outputP = phases.current.output;

        const layerDelay = layerIndex * 0.3;
        const nodeDelay = nodeIndex * 0.08;
        const totalDelay = layerDelay + nodeDelay;
        const activation = THREE.MathUtils.clamp((df - totalDelay) * 2.5, 0, 1);
        const smoothActivation = activation * activation * (3 - 2 * activation);

        const baseSize = isOutput ? 0.4 : 0.18;

        if (isOutput) {
            const outputBoost = smoothActivation + outputP * 0.5;
            const clampedBoost = Math.min(outputBoost, 1.0);
            const activatedSize = baseSize * (1 + clampedBoost * 0.6);
            coreRef.current.scale.setScalar(net * activatedSize);
            if (outputP > 0) displayColor.lerpColors(brightYellow, superBrightYellow, outputP);
            else displayColor.lerpColors(dullYellow, brightYellow, smoothActivation);
            coreRef.current.material.emissiveIntensity = 0.1 + smoothActivation * 2.0 + outputP * 3.0;
            coreRef.current.material.opacity = net * (0.5 + clampedBoost * 0.5);
        } else {
            const activatedSize = baseSize * (1 + smoothActivation * 0.3);
            coreRef.current.scale.setScalar(net * activatedSize);
            displayColor.lerpColors(dullBlue, brightBlue, smoothActivation);
            coreRef.current.material.emissiveIntensity = 0.1 + smoothActivation * 2.0;
            coreRef.current.material.opacity = net * (0.5 + smoothActivation * 0.5);
        }

        coreRef.current.material.color.copy(displayColor);
        coreRef.current.material.emissive.copy(displayColor);

        if (glowRef.current) {
            if (isOutput) {
                const glowSize = net * (baseSize + 0.1 + smoothActivation * 0.25 + outputP * 0.4);
                glowRef.current.scale.setScalar(glowSize);
                glowRef.current.material.opacity = net * (smoothActivation * 0.25 + outputP * 0.35);
                const glowColor = new THREE.Color();
                glowColor.lerpColors(new THREE.Color('#9ca3af'), new THREE.Color('#d1d5db'), outputP);
                glowRef.current.material.color.copy(glowColor);
            } else {
                const glowSize = net * (baseSize + 0.1 + smoothActivation * 0.25);
                glowRef.current.scale.setScalar(glowSize);
                glowRef.current.material.opacity = net * smoothActivation * 0.3;
                glowRef.current.material.color.copy(displayColor);
            }
        }
    });

    return (
        <group position={position}>
            <mesh ref={glowRef}>
                <circleGeometry args={[1, 32]} />
                <meshBasicMaterial color={isOutput ? '#9ca3af' : '#1e3a5f'} transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial color="#1e3a5f" emissive="#1e3a5f" emissiveIntensity={0.1} transparent opacity={0} />
            </mesh>
        </group>
    );
};

/* ─── Connection Line ─── */
const ConnectionLine = ({ from, to, phases, layer }) => {
    const borderRef = useRef(null);
    const glowRef = useRef(null);

    const borderGeo = useMemo(() => {
        const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
        mid.z += 0.15;
        return new THREE.BufferGeometry().setFromPoints(
            new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(30)
        );
    }, [from, to]);

    const glowGeo = useMemo(() => {
        const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
        mid.z += 0.16;
        return new THREE.BufferGeometry().setFromPoints(
            new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(30)
        );
    }, [from, to]);

    const borderDull = useMemo(() => new THREE.Color('#0c1929'), []);
    const borderActive = useMemo(() => new THREE.Color('#1a3a6b'), []);
    const borderColor = useMemo(() => new THREE.Color(), []);
    const dimCyan = useMemo(() => new THREE.Color('#362a7a'), []);
    const brightCyan = useMemo(() => new THREE.Color('#2f00ff'), []);
    const glowColor = useMemo(() => new THREE.Color(), []);

    useFrame(() => {
        if (!borderRef.current || !glowRef.current) return;
        const net = phases.current.network;
        const df = phases.current.dataflow;
        const layerActivation = THREE.MathUtils.clamp((df - layer * 0.3) * 2.5, 0, 1);
        const smoothActivation = layerActivation * layerActivation * (3 - 2 * layerActivation);

        borderColor.lerpColors(borderDull, borderActive, smoothActivation);
        borderRef.current.material.color.copy(borderColor);
        borderRef.current.material.opacity = net * (0.15 + smoothActivation * 0.25);

        glowColor.lerpColors(dimCyan, brightCyan, smoothActivation);
        glowRef.current.material.color.copy(glowColor);
        glowRef.current.material.opacity = net * smoothActivation * 0.7;
    });

    return (
        <group>
            <line ref={borderRef} geometry={borderGeo}>
                <lineBasicMaterial color="#0c1929" transparent opacity={0} linewidth={1} />
            </line>
            <line ref={glowRef} geometry={glowGeo}>
                <lineBasicMaterial color="#0004ff" transparent opacity={0} linewidth={1} />
            </line>
        </group>
    );
};

/* ─── Data Flow Particles ─── */
const DataFlowParticles = ({ connections, phases }) => {
    const ref = useRef(null);
    const N = Math.min(connections.length, 200);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const data = useMemo(
        () =>
            Array.from({ length: N }, () => ({
                ci: Math.floor(Math.random() * connections.length),
                spd: 0.3 + Math.random() * 0.2,
                off: Math.random(),
                sz: 0.025 + Math.random() * 0.015,
            })),
        [connections.length, N]
    );

    useFrame(({ clock }) => {
        if (!ref.current) return;
        const df = phases.current.dataflow;
        const t = clock.getElapsedTime();

        for (let i = 0; i < N; i++) {
            const { ci, spd, off, sz } = data[i];
            const conn = connections[ci];
            const la = THREE.MathUtils.clamp((df - conn.layer * 0.3) * 2.5, 0, 1);
            const p = (t * spd * 0.3 + off) % 1;
            const mid = new THREE.Vector3().addVectors(conn.from, conn.to).multiplyScalar(0.5);
            mid.z += 0.15;
            const pos = new THREE.Vector3();
            if (p < 0.5) pos.lerpVectors(conn.from, mid, p * 2);
            else pos.lerpVectors(mid, conn.to, (p - 0.5) * 2);
            dummy.position.copy(pos);
            dummy.scale.setScalar(la * sz);
            dummy.updateMatrix();
            ref.current.setMatrixAt(i, dummy.matrix);
        }
        ref.current.instanceMatrix.needsUpdate = true;
        ref.current.material.opacity = df * 0.8;
    });

    return (
        <instancedMesh ref={ref} args={[null, null, N]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color="#00eeff" emissive="#00eeff" emissiveIntensity={1.5} transparent opacity={0} />
        </instancedMesh>
    );
};

/* ─── Output Card — CLEAN: pure white + scribble texture only. NO logo inside. ─── */
const OutputCard = ({ phases, scrollProgress }) => {
    const gRef = useRef(null);
    const glowRef = useRef(null);
    const borderRef = useRef(null);
    const scribbleRef = useRef(null);

    const outputTexture = useMemo(() => createOutputScribbleTexture(), []);

    useFrame(({ clock }) => {
        if (!gRef.current) return;

        const outputP = phases.current.output;
        const morphP = sm(ph(scrollProgress.current, ...P.morph));
        const expandP = sm(ph(scrollProgress.current, ...P.expand));
        const t = clock.getElapsedTime();

        // ═══ WIND-BLOWN NON-LINEAR FLIGHT PATH ═══
        const flyProgress = sm(Math.min(outputP * 1.3, 1));
        const windX = Math.sin(flyProgress * Math.PI * 2.5) * 1.2 * (1 - flyProgress);
        const windY = Math.cos(flyProgress * Math.PI * 1.8) * 0.8 * (1 - flyProgress)
            + Math.sin(flyProgress * Math.PI * 3.2) * 0.3 * (1 - flyProgress);
        const baseX = THREE.MathUtils.lerp(5.5, 0, flyProgress) + windX;
        const baseY = windY + Math.sin(t * 0.8) * 0.03 * outputP;
        const flightRotZ = Math.sin(flyProgress * Math.PI * 3) * 0.15 * (1 - flyProgress);
        const flightRotX = Math.cos(flyProgress * Math.PI * 2) * 0.08 * (1 - flyProgress);

        // ═══ SCALE ═══
        let scale = outputP > 0.01
            ? THREE.MathUtils.lerp(0.1, 2.0, sm(Math.min(outputP * 1.1, 1)))
            : 0;
        scale = THREE.MathUtils.lerp(scale, 2.4, morphP * 0.2);
        const expandScale = THREE.MathUtils.lerp(scale, 14.0, expandP);
        gRef.current.scale.setScalar(expandScale);

        const expandZ = THREE.MathUtils.lerp(0.5, 6.0, expandP);
        gRef.current.position.set(
            THREE.MathUtils.lerp(baseX, 0, expandP),
            THREE.MathUtils.lerp(baseY, 0, expandP),
            expandZ
        );
        gRef.current.rotation.set(
            THREE.MathUtils.lerp(flightRotX, 0, Math.max(morphP, expandP)),
            0,
            THREE.MathUtils.lerp(flightRotZ, 0, Math.max(morphP, expandP))
        );

        // ═══ GLOW & BORDER ═══
        if (glowRef.current) {
            glowRef.current.material.opacity = outputP * 0.08 * (1 - expandP);
            glowRef.current.scale.setScalar(1.6);
        }
        if (borderRef.current) {
            borderRef.current.material.opacity = outputP * 0.9 * (1 - expandP * 0.7);
        }

        // ═══ SCRIBBLE: visible when card arrives, fades during expand ═══
        if (scribbleRef.current) {
            const scribbleAppear = sm(Math.min(outputP * 1.5, 1));
            scribbleRef.current.material.opacity = scribbleAppear * (1 - expandP);
        }
    });

    return (
        <group ref={gRef} scale={0}>
            <mesh ref={glowRef} position={[0, 0, -0.25]}>
                <circleGeometry args={[2.2, 64]} />
                <meshBasicMaterial color="#a5b4fc" transparent opacity={0} />
            </mesh>
            <RoundedBox ref={borderRef} args={[2.08, 2.88, 0.05]} radius={0.1} smoothness={4} position={[0, 0, -0.01]}>
                <meshBasicMaterial color="#e2e8f0" transparent opacity={0} />
            </RoundedBox>
            <RoundedBox args={[2.0, 2.8, 0.04]} radius={0.08} smoothness={4}>
                <meshStandardMaterial color="#ffffff" roughness={0.02} metalness={0} />
            </RoundedBox>
            {/* Scribble texture: "Summary" heading + wavy body lines */}
            <mesh ref={scribbleRef} position={[0, 0, 0.025]}>
                <planeGeometry args={[1.9, 2.7]} />
                <meshBasicMaterial map={outputTexture} transparent opacity={0} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

/* ─── Camera ─── */
const CameraController = ({ scrollProgress }) => {
    const { camera } = useThree();
    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        const s = scrollProgress.current;
        camera.position.x = Math.sin(t * 0.1) * 0.15;
        camera.position.y = Math.cos(t * 0.08) * 0.1;
        const zoom = sm(ph(s, 0.7, 0.85));
        const expandZoom = sm(ph(s, 0.92, 0.97));
        camera.position.z = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(13.5, 10.5, zoom),
            8.0,
            expandZoom
        );
        camera.lookAt(0, 0, 0);
    });
    return null;
};

/* ─── Scene ─── */
const Scene = ({ scrollProgress }) => {
    const phases = useRef({
        explode: 0, grid: 0, network: 0, attach: 0, dataflow: 0, output: 0,
    });

    const stackPositions = useMemo(() =>
        Array.from({ length: PAPER_COUNT }, (_, i) => [
            (Math.random() - 0.5) * 0.4, -1.5 + (Math.random() - 0.5) * 0.2, i * 0.035,
        ]), []);

    const explodePositions = useMemo(() =>
        Array.from({ length: PAPER_COUNT }, () => {
            const th = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 4.5 + Math.random() * 3.5;
            return [r * Math.sin(phi) * Math.cos(th), r * Math.sin(phi) * Math.sin(th), r * Math.cos(phi) * 0.3];
        }), []);

    const gridPositions = useMemo(() => {
        const cols = 6, sx = 3.6, sy = 3.5;
        const rows = Math.ceil(PAPER_COUNT / cols);
        return Array.from({ length: PAPER_COUNT }, (_, i) => [
            ((i % cols) - (cols - 1) / 2) * sx, (Math.floor(i / cols) - (rows - 1) / 2) * sy, 0,
        ]);
    }, []);

    const inputNodePositions = useMemo(() => {
        const n = 8;
        return Array.from({ length: PAPER_COUNT }, (_, i) => [
            -5, ((i % n) - (n - 1) / 2) * ((Y_SPREAD / (n - 1)) * 2), 0,
        ]);
    }, []);

    const networkNodes = useMemo(() => buildNodes(), []);
    const connections = useMemo(() => buildConnections(networkNodes), [networkNodes]);
    const flatNodes = useMemo(() => {
        const r = [];
        networkNodes.forEach((layer, li) =>
            layer.forEach((pos, ni) =>
                r.push({ pos, layerIndex: li, nodeIndex: ni, isOutput: li === networkNodes.length - 1 })
            )
        );
        return r;
    }, [networkNodes]);

    useFrame(() => {
        const s = scrollProgress.current;
        phases.current.explode = sm(ph(s, ...P.explode));
        phases.current.grid = sm(ph(s, ...P.grid));
        phases.current.network = sm(ph(s, ...P.network));
        phases.current.attach = sm(ph(s, ...P.attach));
        phases.current.dataflow = sm(ph(s, ...P.dataflow));
        phases.current.output = sm(ph(s, ...P.output));
    });

    return (
        <group>
            <CameraController scrollProgress={scrollProgress} />
            <BackgroundEffects scrollProgress={scrollProgress} />
            <AmbientParticles scrollProgress={scrollProgress} />
            {Array.from({ length: PAPER_COUNT }, (_, i) => (
                <PaperCard key={i} index={i} phases={phases} stackPos={stackPositions[i]}
                    explodePos={explodePositions[i]} gridPos={gridPositions[i]} inputNodePos={inputNodePositions[i]} />
            ))}
            {flatNodes.map((n, i) => (
                <NetworkNode key={`n${i}`} position={n.pos} phases={phases}
                    isOutput={n.isOutput} layerIndex={n.layerIndex} nodeIndex={n.nodeIndex} />
            ))}
            {connections.map((c, i) => (
                <ConnectionLine key={`c${i}`} from={c.from} to={c.to} phases={phases} layer={c.layer} />
            ))}
            <DataFlowParticles connections={connections} phases={phases} />
            <OutputCard phases={phases} scrollProgress={scrollProgress} />
            <EffectComposer>
                <Bloom intensity={0.5} luminanceThreshold={0.95} luminanceSmoothing={0.4} />
                <Vignette eskil={false} offset={0.1} darkness={0.6} />
            </EffectComposer>
        </group>
    );
};

/* ─── Progress Bar ─── */
const ProgressBar = ({ scrollProgress }) => {
    const ref = useRef(null);
    useEffect(() => {
        const tick = () => {
            if (ref.current) ref.current.style.transform = `scaleX(${scrollProgress.current})`;
            requestAnimationFrame(tick);
        };
        tick();
    }, [scrollProgress]);
    return <div ref={ref} className="progress-bar" />;
};

/* ─── White Expand Overlay ─── */
const ExpandOverlay = ({ scrollProgress }) => {
    const ref = useRef(null);
    useEffect(() => {
        const tick = () => {
            if (ref.current) {
                const expandP = sm(ph(scrollProgress.current, ...P.expand));
                ref.current.style.opacity = expandP * 0.92;
                ref.current.style.pointerEvents = expandP > 0.5 ? 'all' : 'none';
            }
            requestAnimationFrame(tick);
        };
        tick();
    }, [scrollProgress]);
    return <div ref={ref} className="expand-overlay" />;
};

/* ─── Animated Logo Clone — HTML element that flies from nav to center ─── */
const FlyingLogo = ({ scrollProgress }) => {
    const ref = useRef(null);

    useEffect(() => {
        const tick = () => {
            if (!ref.current) { requestAnimationFrame(tick); return; }
            const expandP = sm(ph(scrollProgress.current, ...P.expand));
            const ctaP = sm(ph(scrollProgress.current, ...P.cta));
            const showP = Math.max(expandP, ctaP);

            if (showP < 0.01) {
                ref.current.style.opacity = '0';
                ref.current.style.pointerEvents = 'none';
                requestAnimationFrame(tick);
                return;
            }

            // Fly progress: 0 = top-left, 1 = center
            const fly = sm(THREE.MathUtils.clamp((expandP - 0.05) / 0.6, 0, 1));

            // Start: nav logo position (approx 36px from left, 18px from top)
            const startX = 60;
            const startY = 30;

            // End: center of viewport, above CTA button (roughly 35% from top)
            const endX = window.innerWidth / 2;
            const endY = window.innerHeight * 0.3;

            // Arc path: swoops right and down via a sine curve
            const arcX = Math.sin(fly * Math.PI) * (window.innerWidth * 0.12);
            const arcY = -Math.sin(fly * Math.PI) * 40;

            const x = startX + (endX - startX) * fly + arcX;
            const y = startY + (endY - startY) * fly + arcY;

            // Scale: nav-size (1) → big bold (2.5)
            const scale = 1 + fly * 1.8;

            ref.current.style.opacity = String(showP);
            ref.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
            ref.current.style.pointerEvents = 'none';

            requestAnimationFrame(tick);
        };
        tick();
    }, [scrollProgress]);

    return (
        <div ref={ref} className="flying-logo">
            <div className="flying-logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                </svg>
            </div>
            <span className="flying-logo-text">
                Aurora<span className="flying-logo-dot">.</span>ai
            </span>
        </div>
    );
};

/* ─── App ─── */
export default function App() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const ctaBtnRef = useRef(null);
    const heroRef = useRef(null);
    const navLogoRef = useRef(null);
    const scrollProgress = useRef(0);
    const ctaVisible = useRef(false);
    const heroHidden = useRef(false);
    const [loading, setLoading] = useState(true);
    const [phaseInfo, setPhaseInfo] = useState({ step: '', title: '', visible: false });
    const [metricsVisible, setMetricsVisible] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [showTransition, setShowTransition] = useState(false);

    const phaseLabels = useMemo(() => [
        { r: [0.08, 0.2], step: 'Phase 01', title: 'Discovering Patterns' },
        { r: [0.2, 0.33], step: 'Phase 02', title: 'Organizing Knowledge' },
        { r: [0.33, 0.46], step: 'Phase 03', title: 'Neural Pathways' },
        { r: [0.46, 0.55], step: 'Phase 04', title: 'Connecting Inputs' },
        { r: [0.55, 0.7], step: 'Phase 05', title: 'Processing Data' },
        { r: [0.7, 0.82], step: 'Phase 06', title: 'Generating Output' },
        { r: [0.82, 0.92], step: 'Phase 07', title: 'Final Synthesis' },
        { r: [0.92, 0.97], step: 'Phase 08', title: 'Presenting Results' },
    ], []);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (loading || showDashboard || showTransition) return;
        window.scrollTo(0, 0);
        if (containerRef.current) containerRef.current.style.height = '700vh';

        const trigger = ScrollTrigger.create({
            trigger: containerRef.current,
            start: 'top top',
            end: '+=3000%',
            scrub: true,
            pin: canvasRef.current,
            onUpdate: (self) => {
                scrollProgress.current = self.progress;

                // Hide hero
                if (self.progress > 0.04 && !heroHidden.current) {
                    heroHidden.current = true;
                    gsap.to(heroRef.current, { opacity: 0, y: -40, duration: 0.6, ease: 'power3.in' });
                } else if (self.progress <= 0.04 && heroHidden.current) {
                    heroHidden.current = false;
                    gsap.to(heroRef.current, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
                }

                // Hide the REAL nav logo when flying logo takes over
                if (navLogoRef.current) {
                    const expandP = sm(ph(self.progress, ...P.expand));
                    navLogoRef.current.style.opacity = String(1 - expandP);
                }

                // CTA button
                if (self.progress > 0.95 && !ctaVisible.current) {
                    ctaVisible.current = true;
                    gsap.to(ctaBtnRef.current, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
                } else if (self.progress <= 0.95 && ctaVisible.current) {
                    ctaVisible.current = false;
                    gsap.to(ctaBtnRef.current, { opacity: 0, y: 30, duration: 0.3, ease: 'power2.in' });
                }

                // Phase labels
                const active = phaseLabels.find((l) => self.progress >= l.r[0] && self.progress < l.r[1]);
                if (active) setPhaseInfo({ step: active.step, title: active.title, visible: true });
                else setPhaseInfo((prev) => ({ ...prev, visible: false }));

                setMetricsVisible(self.progress > 0.5 && self.progress < 0.82);
            },
        });

        const preventOverscroll = (e) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll - 2 && e.deltaY > 0) e.preventDefault();
        };
        const preventOverscrollKeys = (e) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll - 2 && ['ArrowDown', 'Space', 'PageDown', 'End'].includes(e.code)) e.preventDefault();
        };
        let touchStartY = 0;
        const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
        const preventOverscrollTouch = (e) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll - 2 && e.touches[0].clientY < touchStartY) e.preventDefault();
        };

        window.addEventListener('wheel', preventOverscroll, { passive: false });
        window.addEventListener('keydown', preventOverscrollKeys, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', preventOverscrollTouch, { passive: false });
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';

        return () => {
            trigger.kill();
            ScrollTrigger.getAll().forEach((t) => t.kill());
            window.removeEventListener('wheel', preventOverscroll);
            window.removeEventListener('keydown', preventOverscrollKeys);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', preventOverscrollTouch);
            document.body.style.overscrollBehavior = '';
            document.documentElement.style.overscrollBehavior = '';
        };
    }, [loading, showDashboard, showTransition, phaseLabels]);

    const handleGetStarted = () => { setShowTransition(true); };
    const handleTransitionComplete = () => {
        setTimeout(() => { setShowDashboard(true); setShowTransition(false); }, 400);
    };

    if (showDashboard) {
        ScrollTrigger.getAll().forEach((t) => t.kill());
        gsap.killTweensOf('*');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        return <Dashboard />;
    }

    return (
        <>
            <TransitionAnimation active={showTransition} onComplete={handleTransitionComplete} minDuration={2500} />

            <div className={`loading-screen ${!loading ? 'hidden' : ''}`}>
                <div className="loading-logo">
                    <div className="loading-ring" />
                    <div className="loading-ring-inner" />
                </div>
                <div className="loading-text">Aurora.ai</div>
            </div>

            <div ref={containerRef} className="scroll-container">
                {Array.from({ length: 7 }, (_, i) => (
                    <section key={i} className="scroll-section" />
                ))}
            </div>

            <div ref={canvasRef} className="canvas-wrapper">
                <ProgressBar scrollProgress={scrollProgress} />
                <ExpandOverlay scrollProgress={scrollProgress} />

                {/* Flying logo clone — animates from top-left to center during expand */}
                <FlyingLogo scrollProgress={scrollProgress} />

                {/* Real nav logo — fades out when flying logo takes over */}
                <nav className="top-nav">
                    <a ref={navLogoRef} className="nav-logo" href="#">
                        <div className="nav-logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="nav-logo-text">
                            Aurora<span className="nav-logo-dot">.</span>ai
                        </span>
                    </a>
                </nav>

                <div ref={heroRef} className="hero-overlay">
                    <div className="hero-badge">
                        <span className="hero-badge-dot" />
                        Process of Stact-to-Sheet
                    </div>
                    <h1 className="hero-title">
                        Transform Research<br />
                        <span className="hero-gradient">Into Personalised Insight</span>
                    </h1>
                    <div className="scroll-indicator">
                        <div className="scroll-mouse"><div className="scroll-dot" /></div>
                        <span className="scroll-text">Scroll to explore</span>
                    </div>
                </div>

                <div className={`phase-label-overlay ${phaseInfo.visible ? 'visible' : ''}`}>
                    <span className="phase-step">{phaseInfo.step}</span>
                    <span className="phase-title">{phaseInfo.title}</span>
                </div>

                <Canvas
                    camera={{ position: [0, 0, 13.5], fov: 50 }}
                    dpr={[1, 2]}
                    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
                >
                    <ambientLight intensity={1.2} color="#ffffff" />
                    <directionalLight position={[5, 8, 8]} intensity={0.8} color="#ffffff" castShadow />
                    <Scene scrollProgress={scrollProgress} />
                </Canvas>

                <div ref={ctaBtnRef} className="cta-button-wrapper">
                    <button className="cta-button cta-button-large" onClick={handleGetStarted}>
                        <span>Get Started Free</span>
                        <svg className="cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                    <span className="cta-subtext">No credit card required</span>
                </div>
            </div>
        </>
    );
}