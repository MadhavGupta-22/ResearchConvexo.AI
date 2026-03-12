import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
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

/* ═══════════════ CONSTANTS ═══════════════ */

const PAPER_COUNT = 10;
const Y_SPREAD = 4.5;

// New phase timeline - reorganized for the new flow
const P = {
    stack: [0.0, 0.04],
    fly: [0.04, 0.16],           // Papers fly with wavy motion
    inputNodes: [0.16, 0.26],    // Papers arrange directly at input nodes + first layer appears
    layer1to2: [0.26, 0.36],     // Connections grow from layer1, then layer2 nodes appear
    layer2to3: [0.36, 0.46],     // Connections grow from layer2, then layer3 nodes appear
    layer3toOut: [0.46, 0.56],   // Connections grow from layer3, then output node appears
    outputConn: [0.56, 0.64],    // Connection grows out from output node
    paperForm: [0.64, 0.76],     // Output paper pixel-reveals from connection end
    summary: [0.76, 0.82],       // Summary text appears on paper
    blurStart: [0.82, 0.90],     // Site blurs, "Want to try it?" appears
    ctaAppear: [0.90, 1.0],      // Get Started button rises from bottom
};

const LAYERS = [
    { count: 8, x: -8.5 },  // Moved further left
    { count: 5, x: -4.2 },
    { count: 3, x: 0.1 },
    { count: 1, x: 4.5 },   // Moved further right
];

/* ═══════════════ HELPERS ═══════════════ */

const ph = (s, a, b) => THREE.MathUtils.clamp((s - a) / (b - a), 0, 1);
const sm = (t) => t * t * (3 - 2 * t);
const lA = (o, a, b, t) => {
    o[0] = THREE.MathUtils.lerp(a[0], b[0], t);
    o[1] = THREE.MathUtils.lerp(a[1], b[1], t);
    o[2] = THREE.MathUtils.lerp(a[2], b[2], t);
};

/* ═══════════════ NN GRAPH BUILDERS ═══════════════ */

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

/* ═══════════════ TEXTURES ═══════════════ */

const createScribbleTexture = (seed = 0) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d');

    // 1. Give papers slightly different off-white tints so they contrast
    const tints = ['#fbfbf8', '#f5f5f0', '#faf9f5', '#f0f0eb'];
    ctx.fillStyle = tints[seed % tints.length];
    ctx.fillRect(0, 0, 512, 720);

    // 2. Draw a subtle grey border around the very edge of the paper
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 714); // Inset slightly so it renders cleanly

    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.015})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 720, 1, 1);
    }

    let s = seed * 9301 + 49297;
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    ctx.strokeStyle = '#2d2d2d';
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
        ctx.strokeStyle = `rgba(30, 30, 30, ${0.35 + rng() * 0.3})`;
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
            ctx.fillStyle = '#fbfbf8';
            ctx.fillRect(gapX, y - 5, 12 + rng() * 18, 10);
        }
    }

    if (seed % 3 === 0) {
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        ctx.arc(24, 52, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    t.anisotropy = 16;
    return t;
};

const createOutputScribbleTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#fbfbf8';
    ctx.fillRect(0, 0, 512, 720);

    for (let i = 0; i < 320; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.02})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 720, 1, 1);
    }

    let s = 77;
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    ctx.font = '700 38px "Sora", "Plus Jakarta Sans", "SF Pro Display", sans-serif';
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'left';
    ctx.fillText('SUMMARY', 50, 75);

    ctx.strokeStyle = 'rgba(17, 17, 17, 0.92)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 90);
    ctx.lineTo(250, 90);
    ctx.stroke();

    const bodyStartY = 125;
    const lineSpacing = 26;
    const totalLines = 20;

    for (let l = 0; l < totalLines; l++) {
        const y = bodyStartY + l * lineSpacing + (rng() - 0.5) * 2;
        const isShort = l === totalLines - 1 || l === 8 || l === 14;
        const lineWidth = isShort ? 80 + rng() * 100 : 340 + rng() * 90;

        ctx.strokeStyle = `rgba(17, 17, 17, ${0.55 + rng() * 0.3})`;
        ctx.lineWidth = 1.5 + rng() * 0.5;
        ctx.lineCap = 'round';
        ctx.beginPath();

        let lx = 50;
        ctx.moveTo(lx, y);
        while (lx < 50 + lineWidth) {
            lx += 3 + rng() * 7;
            ctx.lineTo(Math.min(lx, 50 + lineWidth), y + (rng() - 0.5) * 1.2);
        }
        ctx.stroke();

        if (rng() > 0.6 && !isShort && l > 0) {
            const gapX = 50 + lineWidth * (0.2 + rng() * 0.5);
            ctx.fillStyle = '#fbfbf8';
            ctx.fillRect(gapX, y - 4, 8 + rng() * 14, 8);
        }
    }

    [125, 255, 385].forEach((by) => {
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(36, by, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    t.anisotropy = 16;
    return t;
};

const createLogoIconTexture = () => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    const cx = 64;
    const drawLayer = (cy, opacity, scale) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.fillStyle = `rgba(167, 139, 250, ${opacity})`;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(28, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-28, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(124, 58, 237, ${opacity + 0.1})`;
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
        ctx.restore();
    };

    drawLayer(76, 0.25, 1.0);
    drawLayer(58, 0.45, 1.0);
    drawLayer(40, 0.85, 1.0);

    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
};

/* ═══════════════ PIXEL REVEAL TEXTURE (PAPER & DRAWING BORDER) ═══════════════ */

// Notice we added a second parameter: borderProgress
const createPixelRevealTexture = (pixelProgress, borderProgress) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d');

    ctx.clearRect(0, 0, 512, 720);

    if (pixelProgress <= 0) return new THREE.CanvasTexture(c);

    // Create the full output content first
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = 512;
    fullCanvas.height = 720;
    const fullCtx = fullCanvas.getContext('2d');

    // Light paper background
    fullCtx.fillStyle = '#fcfbf7';
    fullCtx.fillRect(0, 0, 512, 720);

    let s = 77;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    fullCtx.font = '700 38px "Sora", sans-serif';
    fullCtx.fillStyle = '#111111';
    fullCtx.textAlign = 'left';
    fullCtx.fillText('SUMMARY', 50, 75);

    // Abstract data lines
    for (let l = 0; l < 20; l++) {
        const y = 125 + l * 26 + (rng() - 0.5) * 2;
        const isShort = l === 19 || l === 8 || l === 14;
        const lineWidth = isShort ? 80 + rng() * 100 : 340 + rng() * 90;
        fullCtx.strokeStyle = `rgba(17, 17, 17, ${0.55 + rng() * 0.3})`;
        fullCtx.lineWidth = 1.5 + rng() * 0.5;
        fullCtx.lineCap = 'round';
        fullCtx.beginPath();
        let lx = 50;
        fullCtx.moveTo(lx, y);
        while (lx < 50 + lineWidth) {
            lx += 3 + rng() * 7;
            fullCtx.lineTo(Math.min(lx, 50 + lineWidth), y + (rng() - 0.5) * 1.2);
        }
        fullCtx.stroke();
    }

    // Pixel reveal logic - USING TRANSPARENCY
    const blockSize = 8;
    const cols = Math.ceil(512 / blockSize);
    const rows = Math.ceil(720 / blockSize);
    const centerX = cols / 2;
    const centerY = rows / 2;
    const blocks = [];
    let maxDist = 0;

    for (let r = 0; r < rows; r++) {
        for (let c2 = 0; c2 < cols; c2++) {
            const dx = c2 - centerX;
            const dy = r - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const jitter = ((c2 * 7 + r * 13) % 17) / 17.0 * 3;
            const finalDist = dist + jitter;
            if (finalDist > maxDist) maxDist = finalDist;
            blocks.push({ c: c2, r, dist: finalDist });
        }
    }

    const fadeWindow = 0.25;
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const startFadeProgress = (block.dist / maxDist) * (1.0 - fadeWindow);
        let blockAlpha = (pixelProgress - startFadeProgress) / fadeWindow;
        blockAlpha = Math.max(0, Math.min(1, blockAlpha));

        if (blockAlpha > 0) {
            ctx.globalAlpha = blockAlpha;
            const sx = block.c * blockSize;
            const sy = block.r * blockSize;
            ctx.drawImage(fullCanvas, sx, sy, blockSize, blockSize, sx, sy, blockSize, blockSize);
        }
    }

    ctx.globalAlpha = 1.0; // Reset alpha

    // === ANIMATED THIN BLACK BORDER ===
    // This only starts drawing when borderProgress is greater than 0
    if (borderProgress > 0) {
        ctx.strokeStyle = '#111111'; // Thin black color
        ctx.lineWidth = 4;

        const w = 508;
        const h = 716;
        const perimeter = (w * 2) + (h * 2);
        const drawLength = borderProgress * perimeter; // How far along the path to draw

        ctx.beginPath();
        ctx.rect(2, 2, w, h); // Inset slightly so it fits on canvas
        ctx.setLineDash([drawLength, perimeter]); // Creates the animating snake effect
        ctx.stroke();
    }

    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    t.anisotropy = 16;
    return t;
};

/* ═══════════════ BACKGROUND ═══════════════ */

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
        ref.current.material.opacity = 0.12 + scrollProgress.current * 0.08;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                color="#a78bfa"
                transparent
                opacity={0.12}
                size={0.05}
                sizeAttenuation
            />
        </points>
    );
};

/* ═══════════════ FLEXIBLE PAPER CARD ═══════════════ */

const PaperCard = ({ index, phases, stackPos, flyPos, inputNodePos, scrollProgress }) => {
    const meshRef = useRef(null);
    const shadowRef = useRef(null);
    const pos = useMemo(() => [0, 0, 0], []);
    const texture = useMemo(() => createScribbleTexture(index), [index]);

    // Unique per-paper wave parameters
    const waveParams = useMemo(() => ({
        freq1: 1.5 + Math.random() * 1.5,
        freq2: 0.8 + Math.random() * 1.0,
        freq3: 2.0 + Math.random() * 1.0,
        amp1: 0.12 + Math.random() * 0.08,
        amp2: 0.06 + Math.random() * 0.06,
        amp3: 0.04 + Math.random() * 0.03,
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        phase3: Math.random() * Math.PI * 2,
        flySpeedVar: 0.8 + Math.random() * 0.4,
    }), []);

    const rRot = useMemo(
        () => [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2],
        []
    );

    // Create subdivided geometry for bending
    const geometry = useMemo(() => {
        return new THREE.PlaneGeometry(4, 5.5, 14, 18);
    }, []);

    const origPositions = useMemo(() => {
        return geometry.attributes.position.array.slice();
    }, [geometry]);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const s = scrollProgress.current;
        const t = clock.getElapsedTime();

        const flyP = phases.current.fly;
        const inputP = phases.current.inputNodes;
        const vanishStart = phases.current.layer1to2;

        // Position: stack -> fly -> input nodes (skip grid)
        lA(pos, stackPos, flyPos, flyP);
        if (inputP > 0) lA(pos, pos, inputNodePos, inputP);

        // During network phases, shrink and vanish into nodes
        const vanish = Math.min(vanishStart, 1);
        if (vanish > 0) {
            pos[0] = THREE.MathUtils.lerp(pos[0], inputNodePos[0], vanish);
            pos[1] = THREE.MathUtils.lerp(pos[1], inputNodePos[1], vanish);
            pos[2] = THREE.MathUtils.lerp(pos[2], inputNodePos[2], vanish);
        }

        const idle = (1 - flyP) * 0.3;
        pos[1] += Math.sin(t * 0.8 + index * 0.7) * 0.04 * idle;

        meshRef.current.position.set(pos[0], pos[1], pos[2]);

        // Rotation: apply wavy rotation during flight
        const bz = index * 0.035;
        const flyWave = flyP * (1 - inputP);
        meshRef.current.rotation.set(
            rRot[0] * flyWave + Math.sin(t * waveParams.freq1 + waveParams.phase1) * 0.2 * flyWave,
            rRot[1] * flyWave + Math.sin(t * waveParams.freq2 + waveParams.phase2) * 0.8 * flyWave,
            bz * (1 - flyP) + rRot[2] * flyWave + Math.sin(t * waveParams.freq3 + waveParams.phase3) * 0.12 * flyWave
        );

        // Scale: shrink as papers arrive at nodes, then vanish during network build
        const arriveScale = THREE.MathUtils.lerp(1.3, 0.35, inputP);
        const vanishScale = THREE.MathUtils.lerp(arriveScale, 0, sm(vanish));
        const sc = Math.max(vanishScale, 0);
        meshRef.current.scale.setScalar(sc);

        // === FLEXIBLE PAPER BENDING ===
        // Bend the geometry vertices to simulate paper waving in air
        const bendIntensity = flyP * (1 - inputP * 0.9);
        const positions = meshRef.current.geometry.attributes.position.array;

        if (bendIntensity > 0.01) {
            const segW = 14;
            const segH = 18;
            const verticesPerRow = segW + 1;

            for (let j = 0; j <= segH; j++) {
                for (let i = 0; i <= segW; i++) {
                    const idx = (j * verticesPerRow + i) * 3;
                    const origX = origPositions[idx];
                    const origY = origPositions[idx + 1];
                    const origZ = origPositions[idx + 2];

                    const nx = (origX / 2.8) + 0.5;
                    const ny = (origY / 3.5) + 0.5;

                    // Primary wave along horizontal
                    const wave1 = Math.sin(nx * Math.PI * 2.5 + t * waveParams.freq1 * 2.5 + waveParams.phase1)
                        * waveParams.amp1 * bendIntensity;

                    // Secondary wave along vertical
                    const wave2 = Math.sin(ny * Math.PI * 2.0 + t * waveParams.freq2 * 2.5 + waveParams.phase2)
                        * waveParams.amp2 * bendIntensity;

                    // Diagonal ripple
                    const wave3 = Math.sin((nx + ny) * Math.PI * 1.8 + t * waveParams.freq3 * 2.5 + waveParams.phase3)
                        * waveParams.amp3 * bendIntensity;

                    // Leading/trailing edge flutter
                    const edgeFactor = Math.sin(nx * Math.PI) * Math.sin(ny * Math.PI);
                    const flutter = Math.sin(t * 5.0 + ny * Math.PI * 4 + index * 0.5)
                        * 0.06 * bendIntensity * edgeFactor;

                    // Corner curl effect
                    const cornerDist = Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5)) * 2;
                    const cornerCurl = Math.sin(t * 3 + cornerDist * Math.PI + waveParams.phase1)
                        * 0.04 * bendIntensity * cornerDist;

                    positions[idx] = origX;
                    positions[idx + 1] = origY;
                    positions[idx + 2] = origZ + wave1 + wave2 + wave3 + flutter + cornerCurl;
                }
            }
            meshRef.current.geometry.attributes.position.needsUpdate = true;
            meshRef.current.geometry.computeVertexNormals();
        } else {
            // Reset to flat when not flying
            for (let k = 0; k < positions.length; k++) {
                positions[k] = origPositions[k];
            }
            meshRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // Opacity
        meshRef.current.material.opacity = THREE.MathUtils.lerp(1, 0, sm(vanish));

        if (shadowRef.current) {
            shadowRef.current.position.set(pos[0] + 0.04, pos[1] - 0.04, pos[2] - 0.04);
            shadowRef.current.rotation.copy(meshRef.current.rotation);
            shadowRef.current.scale.copy(meshRef.current.scale);
            shadowRef.current.material.opacity = 0.18 * (1 - sm(vanish));
        }
    });

    return (
        <group>
            <mesh ref={shadowRef}>
                <planeGeometry args={[3.25, 5.05, 1, 1]} />
                <meshBasicMaterial color="#0a0a12" transparent opacity={0.18} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={meshRef} geometry={geometry} castShadow>
                <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
        </group>
    );
};

/* ═══════════════ NETWORK NODE — SCROLL-DRIVEN ═══════════════ */

const NetworkNode = ({ position, phases, isOutput, layerIndex, nodeIndex }) => {
    const coreRef = useRef(null);
    const glowRef = useRef(null);

    const nodeColor = useMemo(() => new THREE.Color('#a78bfa'), []);
    const outputColor = useMemo(() => new THREE.Color('#fbbf24'), []);
    const darkColor = useMemo(() => new THREE.Color('#0a0a0f'), []);

    useFrame(() => {
        if (!coreRef.current) return;

        // Determine when this node should appear based on layer
        let nodeAppear = 0;
        const baseSize = isOutput ? 0.4 : 0.18;

        if (layerIndex === 0) {
            // First layer appears during inputNodes phase
            nodeAppear = phases.current.inputNodes;
        } else if (layerIndex === 1) {
            // Second layer appears at end of layer1to2 connections
            nodeAppear = sm(ph(phases.current.layer1to2Raw, 0.6, 1.0));
        } else if (layerIndex === 2) {
            // Third layer appears at end of layer2to3 connections
            nodeAppear = sm(ph(phases.current.layer2to3Raw, 0.6, 1.0));
        } else if (layerIndex === 3) {
            // Output node appears at end of layer3toOut connections
            nodeAppear = sm(ph(phases.current.layer3toOutRaw, 0.6, 1.0));
        }

        const smoothAppear = sm(nodeAppear);

        // Scale up from 0
        coreRef.current.scale.setScalar(smoothAppear * baseSize);

        // Color: start dark/black, become colored as they appear
        const targetColor = isOutput ? outputColor : nodeColor;
        const displayColor = new THREE.Color().lerpColors(darkColor, targetColor, smoothAppear);

        coreRef.current.material.color.copy(displayColor);
        coreRef.current.material.emissive.copy(displayColor);
        coreRef.current.material.emissiveIntensity = smoothAppear * 1.5;
        coreRef.current.material.opacity = smoothAppear;

        if (glowRef.current) {
            glowRef.current.scale.setScalar(smoothAppear * (baseSize + 0.15));
            glowRef.current.material.opacity = smoothAppear * 0.3;
            glowRef.current.material.color.copy(displayColor);
        }
    });

    return (
        <group position={position}>
            <mesh ref={glowRef}>
                <circleGeometry args={[1, 32]} />
                <meshBasicMaterial color="#000000" transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial
                    color="#0a0a0f"
                    emissive="#0a0a0f"
                    emissiveIntensity={0}
                    transparent
                    opacity={0}
                />
            </mesh>
        </group>
    );
};

/* ═══════════════ CONNECTION LINE — GROWS WITH SCROLL ═══════════════ */

const ConnectionLine = ({ from, to, phases, layer }) => {
    const lineRef = useRef(null);
    const glowRef = useRef(null);
    const tubeRef = useRef(null);
    const tubeGlowRef = useRef(null);

    const mid = useMemo(() => {
        const m = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
        m.z += 0.15;
        return m;
    }, [from, to]);

    const curve = useMemo(() => new THREE.QuadraticBezierCurve3(from, mid, to), [from, mid, to]);

    // We'll animate by updating the geometry based on connection growth progress
    useFrame(() => {
        if (!tubeRef.current) return;

        let connProgress = 0;

        // Each layer's connections grow during their respective phase
        if (layer === 0) {
            connProgress = sm(ph(phases.current.layer1to2Raw, 0.0, 0.55));
        } else if (layer === 1) {
            connProgress = sm(ph(phases.current.layer2to3Raw, 0.0, 0.55));
        } else if (layer === 2) {
            connProgress = sm(ph(phases.current.layer3toOutRaw, 0.0, 0.55));
        }

        // Update tube geometry to show partial connection
        if (connProgress > 0.01) {
            const points = [];
            const segments = 24;
            const endT = Math.max(0.02, connProgress);
            for (let i = 0; i <= segments; i++) {
                const t = (i / segments) * endT;
                points.push(curve.getPoint(t));
            }
            const newGeo = new THREE.BufferGeometry().setFromPoints(points);

            if (tubeRef.current.geometry) tubeRef.current.geometry.dispose();
            tubeRef.current.geometry = newGeo;

            if (tubeGlowRef.current) {
                if (tubeGlowRef.current.geometry) tubeGlowRef.current.geometry.dispose();
                tubeGlowRef.current.geometry = newGeo.clone();
            }
        }

        // Opacity
        tubeRef.current.material.opacity = connProgress > 0.01 ? 0.15 + connProgress * 0.25 : 0;
        if (tubeGlowRef.current) {
            tubeGlowRef.current.material.opacity = connProgress > 0.01 ? connProgress * 0.5 : 0;
        }
    });

    const initGeo = useMemo(() => {
        return new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]);
    }, [from]);

    return (
        <group>
            <line ref={tubeRef} geometry={initGeo}>
                <lineBasicMaterial color="#3b2580" transparent opacity={0} linewidth={1} />
            </line>
            <line ref={tubeGlowRef} geometry={initGeo.clone()}>
                <lineBasicMaterial color="#8b5cf6" transparent opacity={0} linewidth={1} />
            </line>
        </group>
    );
};

/* ═══════════════ OUTPUT CONNECTION (from output node) ═══════════════ */

const OutputConnection = ({ phases, outputNodePos }) => {
    const lineRef = useRef(null);

    const startPos = useMemo(() => outputNodePos.clone(), [outputNodePos]);
    const endPos = useMemo(() => new THREE.Vector3(outputNodePos.x + 3.0, outputNodePos.y, outputNodePos.z), [outputNodePos]);

    const mid = useMemo(() => {
        const m = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        m.z += 0.1;
        return m;
    }, [startPos, endPos]);

    const curve = useMemo(() => new THREE.QuadraticBezierCurve3(startPos, mid, endPos), [startPos, mid, endPos]);

    useFrame(() => {
        if (!lineRef.current) return;
        const connProgress = sm(phases.current.outputConn);

        if (connProgress > 0.01) {
            const points = [];
            const segments = 20;
            const endT = Math.max(0.02, connProgress);
            for (let i = 0; i <= segments; i++) {
                const t = (i / segments) * endT;
                points.push(curve.getPoint(t));
            }
            const newGeo = new THREE.BufferGeometry().setFromPoints(points);
            if (lineRef.current.geometry) lineRef.current.geometry.dispose();
            lineRef.current.geometry = newGeo;
        }

        lineRef.current.material.opacity = connProgress > 0.01 ? 0.3 + connProgress * 0.5 : 0;
    });

    const initGeo = useMemo(() => {
        return new THREE.BufferGeometry().setFromPoints([startPos.clone(), startPos.clone()]);
    }, [startPos]);

    return (
        <line ref={lineRef} geometry={initGeo}>
            <lineBasicMaterial color="#fbbf24" transparent opacity={0} linewidth={2} />
        </line>
    );
};

/* ═══════════════ DATA FLOW PARTICLES ═══════════════ */

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
        const t = clock.getElapsedTime();

        let anyVisible = false;
        for (let i = 0; i < N; i++) {
            const { ci, spd, off, sz } = data[i];
            const conn = connections[ci];

            // Determine if this connection's layer is currently growing
            let layerProgress = 0;
            if (conn.layer === 0) layerProgress = phases.current.layer1to2Raw;
            else if (conn.layer === 1) layerProgress = phases.current.layer2to3Raw;
            else if (conn.layer === 2) layerProgress = phases.current.layer3toOutRaw;

            const la = sm(ph(layerProgress, 0.0, 0.55));

            if (la < 0.01) {
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                ref.current.setMatrixAt(i, dummy.matrix);
                continue;
            }

            anyVisible = true;
            const p = ((t * spd * 0.3 + off) % 1) * la;
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
        ref.current.material.opacity = anyVisible ? 0.8 : 0;
    });

    return (
        <instancedMesh ref={ref} args={[null, null, N]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial
                color="#c4b5fd"
                emissive="#a78bfa"
                emissiveIntensity={1.5}
                transparent
                opacity={0}
            />
        </instancedMesh>
    );
};

/* ═══════════════ OUTPUT CARD (SINGLE PLANE, DRAWING BORDER) ═══════════════ */

const OutputCard = ({ phases, scrollProgress, outputNodePos }) => {
    const gRef = useRef(null);
    const pixelRef = useRef(null);

    const cardPos = useMemo(() => new THREE.Vector3(
        outputNodePos.x + 3.0,
        outputNodePos.y,
        outputNodePos.z
    ), [outputNodePos]);

    const currentTextureRef = useRef(null);
    const lastPixelProgress = useRef(-1);
    const lastBorderProgress = useRef(-1);

    useFrame(({ clock }) => {
        if (!gRef.current) return;
        const t = clock.getElapsedTime();
        const s = scrollProgress.current;

        // Phase 1: Paper pixels in (0 to 1)
        const paperFormP = sm(ph(s, ...P.paperForm));
        // Phase 2: Border draws itself (0 to 1) starts right after paper finishes
        const summaryP = sm(ph(s, ...P.summary));

        const appear = sm(Math.min(paperFormP * 1.5, 1));

        const baseX = cardPos.x;
        const baseY = cardPos.y + Math.sin(t * 0.8) * 0.02 * appear;
        const baseZ = cardPos.z;

        // Keep it locked to the node position
        gRef.current.position.set(baseX, baseY, baseZ);

        const scale = appear * 1.6;
        gRef.current.scale.setScalar(scale);
        gRef.current.rotation.set(0, 0, 0);

        // Update texture if paper OR border progress is changing
        if (pixelRef.current) {
            const pDelta = Math.abs(paperFormP - lastPixelProgress.current);
            const bDelta = Math.abs(summaryP - lastBorderProgress.current);

            if (pDelta > 0.01 || bDelta > 0.01) {
                lastPixelProgress.current = paperFormP;
                lastBorderProgress.current = summaryP;

                if (currentTextureRef.current) {
                    currentTextureRef.current.dispose();
                }

                // Pass both animation values to the texture generator
                currentTextureRef.current = createPixelRevealTexture(paperFormP, summaryP);
                pixelRef.current.material.map = currentTextureRef.current;
                pixelRef.current.material.needsUpdate = true;
            }
        }
    });

    return (
        <group ref={gRef} scale={0}>
            {/* Just one single flat plane. Everything is handled by the canvas texture. */}
            <mesh ref={pixelRef} position={[0, 0, 0]}>
                <planeGeometry args={[2.0, 2.8]} />
                <meshBasicMaterial transparent toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};
/* ═══════════════ CAMERA ═══════════════ */

const CameraController = ({ scrollProgress }) => {
    const { camera } = useThree();
    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        const s = scrollProgress.current;
        camera.position.x = Math.sin(t * 0.1) * 0.15;
        camera.position.y = Math.cos(t * 0.08) * 0.1;

        // Zoom in as we approach end
        const networkZoom = sm(ph(s, 0.3, 0.5));
        const outputZoom = sm(ph(s, 0.6, 0.76));
        const finalZoom = sm(ph(s, 0.82, 0.92));

        let z = 13.5;
        // z = THREE.MathUtils.lerp(z, 11.0, networkZoom);
        // z = THREE.MathUtils.lerp(z, 9.5, outputZoom);
        // z = THREE.MathUtils.lerp(z, 7.5, finalZoom);

        // camera.position.z = z;
        camera.lookAt(0, 0, 0);
    });
    return null;
};

/* ═══════════════ SCENE ═══════════════ */

const Scene = ({ scrollProgress }) => {
    const phases = useRef({
        fly: 0,
        inputNodes: 0,
        layer1to2: 0,
        layer1to2Raw: 0,
        layer2to3: 0,
        layer2to3Raw: 0,
        layer3toOut: 0,
        layer3toOutRaw: 0,
        outputConn: 0,
        paperForm: 0,
    });

    const stackPositions = useMemo(
        () =>
            Array.from({ length: PAPER_COUNT }, (_, i) => [
                7.0 + (Math.random() - 0.5) * 0.3, // X position
                -0.5 + (Math.random() - 0.5) * 0.3, // Y position (Changed from -0.5 to 2.0 to move it up)
                i * 0.035,                         // Z position (Layering them on top of each other)
            ]),
        []
    );

    const flyPositions = useMemo(
        () =>
            Array.from({ length: PAPER_COUNT }, (_, i) => {
                const angle = (i / PAPER_COUNT) * Math.PI * 1.5 + Math.random() * 0.5;
                const r = 5 + Math.random() * 3;
                return [
                    -r * Math.cos(angle) * 0.6,
                    r * Math.sin(angle) * 0.7,
                    (Math.random() - 0.5) * 2,
                ];
            }),
        []
    );

    // Papers go directly to input node positions (skip grid)
    const inputNodePositions = useMemo(() => {
        const n = 8; // input layer count
        return Array.from({ length: PAPER_COUNT }, (_, i) => [
            -8.5,
            ((i % n) - (n - 1) / 2) * ((Y_SPREAD / (n - 1)) * 2),
            0,
        ]);
    }, []);

    const networkNodes = useMemo(() => buildNodes(), []);
    const connections = useMemo(() => buildConnections(networkNodes), [networkNodes]);
    const flatNodes = useMemo(() => {
        const r = [];
        networkNodes.forEach((layer, li) =>
            layer.forEach((pos, ni) =>
                r.push({
                    pos,
                    layerIndex: li,
                    nodeIndex: ni,
                    isOutput: li === networkNodes.length - 1,
                })
            )
        );
        return r;
    }, [networkNodes]);

    const outputNodePos = useMemo(() => {
        const lastLayer = networkNodes[networkNodes.length - 1];
        return lastLayer[0]; // single output node
    }, [networkNodes]);

    useFrame(() => {
        const s = scrollProgress.current;
        phases.current.fly = sm(ph(s, ...P.fly));
        phases.current.inputNodes = sm(ph(s, ...P.inputNodes));

        // Raw progress for layered connection growth
        phases.current.layer1to2Raw = ph(s, ...P.layer1to2);
        phases.current.layer1to2 = sm(phases.current.layer1to2Raw);

        phases.current.layer2to3Raw = ph(s, ...P.layer2to3);
        phases.current.layer2to3 = sm(phases.current.layer2to3Raw);

        phases.current.layer3toOutRaw = ph(s, ...P.layer3toOut);
        phases.current.layer3toOut = sm(phases.current.layer3toOutRaw);

        phases.current.outputConn = sm(ph(s, ...P.outputConn));
        phases.current.paperForm = sm(ph(s, ...P.paperForm));
    });

    return (
        <group>
            <CameraController scrollProgress={scrollProgress} />
            <AmbientParticles scrollProgress={scrollProgress} />

            {/* Papers with flexible bending */}
            {Array.from({ length: PAPER_COUNT }, (_, i) => (
                <PaperCard
                    key={i}
                    index={i}
                    phases={phases}
                    stackPos={stackPositions[i]}
                    flyPos={flyPositions[i]}
                    inputNodePos={inputNodePositions[i]}
                    scrollProgress={scrollProgress}
                />
            ))}

            {/* Network nodes - appear layer by layer with scroll */}
            {flatNodes.map((n, i) => (
                <NetworkNode
                    key={`n${i}`}
                    position={n.pos}
                    phases={phases}
                    isOutput={n.isOutput}
                    layerIndex={n.layerIndex}
                    nodeIndex={n.nodeIndex}
                />
            ))}

            {/* Connections - grow from one layer to next with scroll */}
            {connections.map((c, i) => (
                <ConnectionLine key={`c${i}`} from={c.from} to={c.to} phases={phases} layer={c.layer} />
            ))}

            {/* Data flow particles */}
            <DataFlowParticles connections={connections} phases={phases} />

            {/* Output connection from output node */}
            <OutputConnection phases={phases} outputNodePos={outputNodePos} />

            {/* Output card with pixel reveal */}
            <OutputCard phases={phases} scrollProgress={scrollProgress} outputNodePos={outputNodePos} />

            <EffectComposer>
                <Bloom intensity={0.6} luminanceThreshold={0.9} luminanceSmoothing={0.4} />
                <Vignette eskil={false} offset={0.1} darkness={0.7} />
            </EffectComposer>
        </group>
    );
};

/* ═══════════════ PROGRESS BAR ═══════════════ */

const ProgressBar = ({ scrollProgress }) => {
    const ref = useRef(null);
    useEffect(() => {
        let raf;
        const tick = () => {
            if (ref.current) ref.current.style.transform = `scaleX(${scrollProgress.current})`;
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(raf);
    }, [scrollProgress]);
    return <div ref={ref} className="progress-bar" />;
};

/* ═══════════════ BLUR + TEXT OVERLAY ═══════════════ */

const BlurTextOverlay = ({ scrollProgress }) => {
    const containerRef = useRef(null);
    const textRef = useRef(null);
    const subTextRef = useRef(null);

    useEffect(() => {
        let raf;
        const tick = () => {
            if (!containerRef.current) {
                raf = requestAnimationFrame(tick);
                return;
            }
            const s = scrollProgress.current;
            const blurP = sm(ph(s, ...P.blurStart));
            const ctaP = sm(ph(s, ...P.ctaAppear));

            // Blur the entire canvas behind
            containerRef.current.style.opacity = blurP > 0.01 ? 1 : 0;
            containerRef.current.style.pointerEvents = blurP > 0.3 ? 'all' : 'none';
            containerRef.current.style.backdropFilter = `blur(${blurP * 20}px)`;
            containerRef.current.style.webkitBackdropFilter = `blur(${blurP * 20}px)`;
            containerRef.current.style.background = `rgba(15, 16, 22, ${blurP * 0.6})`;

            if (textRef.current) {
                const textAppear = sm(ph(blurP, 0.3, 0.8));
                textRef.current.style.opacity = textAppear;
                textRef.current.style.transform = `translateY(${(1 - textAppear) * 40}px)`;
            }

            if (subTextRef.current) {
                subTextRef.current.style.opacity = ctaP;
                subTextRef.current.style.transform = `translateY(${(1 - ctaP) * 30}px)`;
            }

            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(raf);
    }, [scrollProgress]);

    return (
        <div ref={containerRef} className="blur-text-overlay" style={{ opacity: 0 }}>
            <div className="blur-text-content">
                <h2 ref={textRef} className="blur-main-text" style={{ opacity: 0 }}>
                    Tired of Reading Those Big PDF's
                </h2>
                {/* <p ref={subTextRef} className="blur-sub-text" style={{ opacity: 0 }}>
                    Let AI transform your research into clear intelligence.
                </p> */}
            </div>
        </div>
    );
};

/* ═══════════════ EXPAND OVERLAY ═══════════════ */

const ExpandOverlay = ({ scrollProgress }) => {
    const ref = useRef(null);
    useEffect(() => {
        let raf;
        const tick = () => {
            if (ref.current) {
                const blurP = sm(ph(scrollProgress.current, ...P.blurStart));
                ref.current.style.opacity = blurP * 0.4;
                ref.current.style.pointerEvents = blurP > 0.5 ? 'all' : 'none';
            }
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(raf);
    }, [scrollProgress]);

    return <div ref={ref} className="expand-overlay" />;
};

/* ═══════════════ ABOUT US DROPDOWN (TECH UI) ═══════════════ */

const AboutDropdown = () => {
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const btnRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target) &&
                btnRef.current &&
                !btnRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="nav-right" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button
                ref={btnRef}
                className={`about-trigger tech-btn ${open ? 'open' : ''}`}
                onClick={() => setOpen((prev) => !prev)}
                onFocus={() => setOpen(true)}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <span className="btn-bracket">[</span>
                ABOUT_US
                <span className="btn-bracket">]</span>
                <span className="about-caret">▼</span>
            </button>
            <div ref={panelRef} className={`about-panel tech-panel ${open ? 'visible' : ''}`}>
                <div className="tech-panel-header">
                    <span className="tech-dot blink"></span>
                    <span className="tech-sys-text">SYS.INFO // v1.0</span>
                </div>
                <div className="tech-panel-divider"></div>
                <div className="tech-panel-body">
                    <span className="about-scroll-text">{">"} QUERY: WHO_ARE_WE</span>
                    <div className="about-scroll-anim">
                        <div className="tech-mouse">
                            <div className="tech-wheel" />
                        </div>
                        <p className="about-panel-text">
                            AWAITING_SCROLL_INPUT<span className="cursor-blink">_</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
/* ═══════════════ APP ════���══════════ */

export default function App() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const ctaBtnRef = useRef(null);
    const heroRef = useRef(null);
    const scrollProgress = useRef(0);
    const ctaVisible = useRef(false);
    const heroHidden = useRef(false);
    const scrollReady = useRef(false);
    const [loading, setLoading] = useState(true);
    const [phaseInfo, setPhaseInfo] = useState({ step: '', title: '', visible: false });
    const [showDashboard, setShowDashboard] = useState(false);
    const [showTransition, setShowTransition] = useState(false);

    const phaseLabels = useMemo(
        () => [
            { r: [0.04, 0.16], step: 'Phase 01', title: 'Papers Take Flight' },
            { r: [0.16, 0.26], step: 'Phase 02', title: 'Mapping to Input Layer' },
            { r: [0.26, 0.36], step: 'Phase 03', title: 'Building Hidden Layer 1' },
            { r: [0.36, 0.46], step: 'Phase 04', title: 'Building Hidden Layer 2' },
            { r: [0.46, 0.56], step: 'Phase 05', title: 'Reaching Output Node' },
            { r: [0.56, 0.64], step: 'Phase 06', title: 'Generating Output' },
            { r: [0.64, 0.76], step: 'Phase 07', title: 'Forming Results' },
            { r: [0.76, 0.82], step: 'Phase 08', title: 'Summary Complete' },
        ],
        []
    );

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1800);
        const fallback = setTimeout(() => setLoading(false), 5000);
        return () => {
            clearTimeout(timer);
            clearTimeout(fallback);
        };
    }, []);

    useEffect(() => {
        if (loading || showDashboard || showTransition) return;

        ScrollTrigger.getAll().forEach((t) => t.kill());

        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        scrollProgress.current = 0;
        heroHidden.current = false;
        ctaVisible.current = false;
        scrollReady.current = false;

        if (heroRef.current) {
            gsap.set(heroRef.current, { opacity: 1, y: 0 });
        }
        if (ctaBtnRef.current) {
            gsap.set(ctaBtnRef.current, { opacity: 0, y: 60 });
        }

        const initTimeout = setTimeout(() => {
            window.scrollTo(0, 0);
            ScrollTrigger.refresh(true);

            const trigger = ScrollTrigger.create({
                trigger: containerRef.current,
                start: 'top top',
                end: '+=3200%',
                scrub: 0.5,
                onUpdate: (self) => {
                    scrollProgress.current = self.progress;

                    if (!scrollReady.current) {
                        if (self.progress < 0.01) {
                            scrollReady.current = true;
                        }
                        return;
                    }

                    if (self.progress > 0.04 && !heroHidden.current) {
                        heroHidden.current = true;
                        if (heroRef.current) {
                            gsap.to(heroRef.current, {
                                opacity: 0,
                                y: -40,
                                duration: 0.6,
                                ease: 'power3.in',
                            });
                        }
                    } else if (self.progress <= 0.04 && heroHidden.current) {
                        heroHidden.current = false;
                        if (heroRef.current) {
                            gsap.to(heroRef.current, {
                                opacity: 1,
                                y: 0,
                                duration: 0.7,
                                ease: 'power3.out',
                            });
                        }
                    }

                    // CTA button appears during ctaAppear phase
                    if (self.progress > P.ctaAppear[0] + 0.03 && !ctaVisible.current) {
                        ctaVisible.current = true;
                        if (ctaBtnRef.current) {
                            gsap.to(ctaBtnRef.current, {
                                opacity: 1,
                                y: 0,
                                duration: 0.8,
                                ease: 'power3.out',
                            });
                        }
                    } else if (self.progress <= P.ctaAppear[0] + 0.03 && ctaVisible.current) {
                        ctaVisible.current = false;
                        if (ctaBtnRef.current) {
                            gsap.to(ctaBtnRef.current, {
                                opacity: 0,
                                y: 60,
                                duration: 0.3,
                                ease: 'power2.in',
                            });
                        }
                    }

                    const active = phaseLabels.find(
                        (l) => self.progress >= l.r[0] && self.progress < l.r[1]
                    );
                    if (active)
                        setPhaseInfo({ step: active.step, title: active.title, visible: true });
                    else setPhaseInfo((prev) => ({ ...prev, visible: false }));
                },
            });

            triggerRef.current = trigger;
        }, 300);

        const triggerRef = { current: null };

        const preventOverscroll = (e) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll - 2 && e.deltaY > 0) e.preventDefault();
        };
        const preventOverscrollKeys = (e) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (
                window.scrollY >= maxScroll - 2 &&
                ['ArrowDown', 'Space', 'PageDown', 'End'].includes(e.code)
            )
                e.preventDefault();
        };
        let touchStartY = 0;
        const onTouchStart = (e) => {
            touchStartY = e.touches[0].clientY;
        };
        const preventOverscrollTouch = (e) => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll - 2 && e.touches[0].clientY < touchStartY)
                e.preventDefault();
        };

        window.addEventListener('wheel', preventOverscroll, { passive: false });
        window.addEventListener('keydown', preventOverscrollKeys, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', preventOverscrollTouch, { passive: false });
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';

        return () => {
            clearTimeout(initTimeout);
            if (triggerRef.current) triggerRef.current.kill();
            ScrollTrigger.getAll().forEach((t) => t.kill());
            window.removeEventListener('wheel', preventOverscroll);
            window.removeEventListener('keydown', preventOverscrollKeys);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', preventOverscrollTouch);
            document.body.style.overscrollBehavior = '';
            document.documentElement.style.overscrollBehavior = '';
        };
    }, [loading, showDashboard, showTransition, phaseLabels]);

    const handleGetStarted = useCallback(() => {
        setShowTransition(true);
    }, []);

    const handleTransitionComplete = useCallback(() => {
        setTimeout(() => {
            setShowDashboard(true);
            setShowTransition(false);
        }, 400);
    }, []);

    if (showDashboard) {
        ScrollTrigger.getAll().forEach((t) => t.kill());
        gsap.killTweensOf('*');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        return <Dashboard />;
    }

    return (
        <>
            <TransitionAnimation
                active={showTransition}
                onComplete={handleTransitionComplete}
                minDuration={2500}
            />

            <div className={`loading-screen ${!loading ? 'hidden' : ''}`}>
                <div className="loading-logo">
                    <div className="loading-ring" />
                    <div className="loading-ring-inner" />
                </div>
                <div className="loading-text">Aurora.ai</div>
            </div>

            <div ref={containerRef} className="scroll-container">
                {Array.from({ length: 8 }, (_, i) => (
                    <section key={i} className="scroll-section" />
                ))}
            </div>

            <div ref={canvasRef} className="canvas-wrapper">
                <ProgressBar scrollProgress={scrollProgress} />

                <div className="hero-shell">
                    <ExpandOverlay scrollProgress={scrollProgress} />
                    <div className="shell-ornament shell-ornament-a" />
                    <div className="shell-ornament shell-ornament-b" />

                    <nav className="top-nav">
                        <a className="nav-logo" href="#">
                            <div className="nav-logo-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                >
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <span className="nav-logo-text">
                                Aurora<span className="nav-logo-dot">.</span>ai
                            </span>
                        </a>
                        <AboutDropdown />
                    </nav>

                    <div ref={heroRef} className="hero-overlay">
                        <div className="hero-content">
                            <div className="hero-badge">
                                <span className="hero-badge-dot" />
                                Process of Stack-to-Sheet
                            </div>
                            <h1 className="hero-title">
                                <br />
                                Turn Complex Bundles
                                <br />
                                <span className="hero-gradient">Into Meaningful Personalised Insight</span>
                            </h1>
                            {/* <p className="hero-subtitle">
                                Scroll to watch your paper stack fly, map into neural layers, and
                                become a final summary sheet.
                            </p> */}
                            <div className="scroll-indicator">
                                <div className="scroll-mouse">
                                    <div className="scroll-dot" />
                                </div>
                                {/* <span className="scroll-text">Scroll to explore</span> */}
                            </div>
                        </div>
                    </div>

                    <div className={`phase-label-overlay ${phaseInfo.visible ? 'visible' : ''}`}>
                        <span className="phase-step">{phaseInfo.step}</span>
                        <span className="phase-title">{phaseInfo.title}</span>
                    </div>

                    {/* Blur overlay with text */}
                    <BlurTextOverlay scrollProgress={scrollProgress} />

                    <div className="scene-layer">
                        <Canvas
                            camera={{ position: [0, 0, 13.5], fov: 50 }}
                            dpr={[1, 2]}
                            gl={{
                                antialias: true,
                                alpha: true,
                                powerPreference: 'high-performance',
                                toneMapping: THREE.NoToneMapping,
                            }}
                            style={{ background: 'transparent' }}
                        >
                            <ambientLight intensity={0.8} color="#c4b5fd" />
                            <directionalLight
                                position={[5, 8, 8]}
                                intensity={0.5}
                                color="#a78bfa"
                                castShadow
                            />
                            <Scene scrollProgress={scrollProgress} />
                        </Canvas>
                    </div>

                    <div ref={ctaBtnRef} className="cta-button-wrapper" style={{ opacity: 0, transform: 'translateX(-50%) translateY(60px)' }}>
                        <button className="cta-button cta-button-large" onClick={handleGetStarted}>
                            <span>Get Started</span>
                            <svg
                                className="cta-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                        <span className="cta-subtext">No credit card required</span>
                    </div>
                </div>
            </div>
        </>
    );
}