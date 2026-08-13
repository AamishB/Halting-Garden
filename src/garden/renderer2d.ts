import type { GardenState, GrowthNode, Root, Leaf, Seedpod } from './types';

const PALETTE = {
  bgTop: '#0D1310',
  bgBottom: '#080A08',
  soil: '#1A140F',
  soilLine: '#2B211A',

  barkHealthy: '#5B7A5E',
  barkHealthyLit: '#8FB596',
  barkYoung: '#7FA872',
  stemSick: '#B8552E',
  stemDead: '#4A4640',
  stemDisease: '#7A6A2E',

  leafHealthy: '#4CAF6E',
  leafHealthyLit: '#7FD99A',
  leafVein: '#2E7A4C',
  leafSick: '#C97A3E',
  leafDead: '#6B5B47',

  rootHealthy: '#6FA8DC',
  rootLeak: '#E8A33D',
  rootLeakDeep: '#C4472A',

  flowerPetal: '#F6C453',
  flowerCenter: '#D98A2B',

  glowActive: '#9FE8B8',
  text: '#EFF3EE',

  sapGlow: 'rgba(230, 200, 100, 0.3)',
  sapGlowStrong: 'rgba(230, 200, 100, 0.6)',
  podHealthy: '#406042',
  podSick: '#8A5030',
  podSeed: '#D0E5C0',

  blueprintEdge: 'rgba(120, 200, 255, 0.6)',
  kudzuVine: '#6E2C6A',
  kudzuLeaf: '#4D2447',
};

function hexToRgb(hex: string) {
  const c = parseInt(hex.slice(1), 16);
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
}

function interpolateColor(color1: string, color2: string, factor: number) {
  const f = Math.max(0, Math.min(1, factor));
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + f * (c2.r - c1.r));
  const g = Math.round(c1.g + f * (c2.g - c1.g));
  const b = Math.round(c1.b + f * (c2.b - c1.b));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

interface AnimState { value: number; target: number; }

const GROWTH_RATE = 0.16;
const SWAY_SPEED = 0.0011;

function approach(state: AnimState, target: number, rate: number) {
  state.target = target;
  state.value += (state.target - state.value) * rate;
  if (Math.abs(state.target - state.value) < 0.002) state.value = state.target;
  return state.value;
}

export class GardenRenderer2D {
  private hitRegions: { x: number; y: number; r: number; type: 'node' | 'root'; data: GrowthNode | Root }[] = [];
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  private growthAnim = new Map<string, AnimState>();
  private leafAnim = new Map<string, AnimState>();
  private rootAnim = new Map<string, AnimState>();
  private healthAnim = new Map<string, AnimState>();
  private diseaseAnim = new Map<string, AnimState>();
  private flowerAnim: AnimState = { value: 0, target: 0 };

  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private camera = { scale: 1 };

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  private anim(map: Map<string, AnimState>, id: string, target: number, rate: number = GROWTH_RATE): number {
    let s = map.get(id);
    if (!s) {
      s = { value: 0, target };
      map.set(id, s);
    }
    return approach(s, target, rate);
  }

  public reset() {
    this.growthAnim.clear();
    this.leafAnim.clear();
    this.rootAnim.clear();
    this.healthAnim.clear();
    this.diseaseAnim.clear();
    this.flowerAnim.value = 0;
    this.flowerAnim.target = 0;
  }

  public render(state: GardenState, hoveredNodeId: string | null = null, timeMs: number = 0) {
    const soilMargin = Math.max(50, this.height * 0.08);
    const startX = this.width / 2;
    const startY = this.height - soilMargin;

    this.paintBackground();
    this.hitRegions = [];

    if (!state.tree) {
      this.reset();
      this.camera.scale = 1;
      this.bounds = { minX: startX, maxX: startX, minY: startY, maxY: startY };
      this.paintSoil(startY);
      return;
    }

    const treeWidth = Math.max(10, this.bounds.maxX - this.bounds.minX);
    const treeHeight = Math.max(10, startY - this.bounds.minY);
    
    const paddingX = 160;
    const paddingTop = 160;
    
    const scaleX = this.width / (treeWidth + paddingX);
    const scaleY = (this.height - soilMargin) / (treeHeight + paddingTop);
    
    const targetScale = Math.min(1.2, Math.min(scaleX, scaleY));
    
    this.camera.scale += (targetScale - this.camera.scale) * 0.08;
    if (Math.abs(this.camera.scale - targetScale) < 0.001) this.camera.scale = targetScale;

    this.bounds = { minX: startX, maxX: startX, minY: startY, maxY: startY };

    this.paintSoil(startY);

    this.ctx.save();
    this.ctx.translate(startX, startY);
    this.ctx.scale(this.camera.scale, this.camera.scale);
    this.ctx.translate(-startX, -startY);

    const baseSegmentLength = 90;

    this.drawNode(state.tree, startX, startY, -Math.PI / 2, state.activePath, hoveredNodeId, timeMs, baseSegmentLength, this.width);
    
    this.ctx.restore();
  }

  public hitTest(x: number, y: number): { type: 'node' | 'root'; data: GrowthNode | Root } | null {
    const soilMargin = Math.max(50, this.height * 0.08);
    const startX = this.width / 2;
    const startY = this.height - soilMargin;
    
    const worldX = startX + (x - startX) / this.camera.scale;
    const worldY = startY + (y - startY) / this.camera.scale;

    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const region = this.hitRegions[i];
      const dx = worldX - region.x;
      const dy = worldY - region.y;
      if (dx * dx + dy * dy <= region.r * region.r) {
        return { type: region.type, data: region.data };
      }
    }
    return null;
  }

  private paintBackground() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, PALETTE.bgTop);
    grad.addColorStop(1, PALETTE.bgBottom);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const glowX = this.width / 2;
    const glowY = this.height * 0.55;
    const glowR = Math.max(this.width, this.height) * 0.55;
    const glow = this.ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
    glow.addColorStop(0, 'rgba(143, 181, 150, 0.10)');
    glow.addColorStop(0.5, 'rgba(143, 181, 150, 0.03)');
    glow.addColorStop(1, 'rgba(143, 181, 150, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private paintSoil(y: number) {
    this.ctx.save();
    const soilHeight = this.height - y + 20;
    const grad = this.ctx.createLinearGradient(0, y - 6, 0, y + soilHeight);
    grad.addColorStop(0, PALETTE.soilLine);
    grad.addColorStop(1, PALETTE.soil);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, y - 6, this.width, soilHeight);

    const shadowGrad = this.ctx.createRadialGradient(
      this.width / 2, y, 0,
      this.width / 2, y, Math.min(this.width, 260)
    );
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = shadowGrad;
    this.ctx.fillRect(0, y - 40, this.width, 80);

    this.ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 40; i++) {
      const fx = (i * 97.3) % this.width;
      const fy = y + 10 + ((i * 53.7) % (soilHeight - 20));
      const r = 1 + (i % 3) * 0.6;
      this.ctx.beginPath();
      this.ctx.arc(fx, fy, r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.strokeStyle = PALETTE.soilLine;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, y - 6);
    this.ctx.lineTo(this.width, y - 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawTaperedStem(x: number, y: number, endX: number, endY: number, cpX: number, cpY: number, widthStart: number, widthEnd: number, color: string) {
    const ctx = this.ctx;
    const dx = endX - x;
    const dy = endY - y;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + nx * widthStart, y + ny * widthStart);
    ctx.quadraticCurveTo(cpX + nx * (widthStart + widthEnd) / 2, cpY + ny * (widthStart + widthEnd) / 2, endX + nx * widthEnd, endY + ny * widthEnd);
    ctx.lineTo(endX - nx * widthEnd, endY - ny * widthEnd);
    ctx.quadraticCurveTo(cpX - nx * (widthStart + widthEnd) / 2, cpY - ny * (widthStart + widthEnd) / 2, x - nx * widthStart, y - ny * widthStart);
    ctx.closePath();

    const grad = ctx.createLinearGradient(x, y, endX, endY);
    grad.addColorStop(0, color);
    grad.addColorStop(1, interpolateColor(color, PALETTE.barkHealthyLit, 0.35));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + nx * widthStart * 0.3, y + ny * widthStart * 0.3);
    ctx.quadraticCurveTo(
      cpX + nx * (widthStart + widthEnd) * 0.25, cpY + ny * (widthStart + widthEnd) * 0.25,
      endX + nx * widthEnd * 0.3, endY + ny * widthEnd * 0.3
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = Math.max(0.5, widthEnd * 0.35);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = Math.max(0.5, widthEnd * 0.3);
    ctx.stroke();
    ctx.restore();

    this.bounds.minX = Math.min(this.bounds.minX, x, endX);
    this.bounds.maxX = Math.max(this.bounds.maxX, x, endX);
    this.bounds.minY = Math.min(this.bounds.minY, y, endY);
  }

  private drawRoots(roots: Root[], x: number, y: number, baseAngle: number, timeMs: number, scale: number = 1) {
    if (roots.length === 0) return;

    this.ctx.save();

    const spread = Math.PI * 0.6;
    const fanStart = baseAngle + Math.PI - spread / 2;
    const angleStep = roots.length > 1 ? spread / (roots.length - 1) : 0;
    roots.forEach((root, i) => {
      const angle = fanStart + i * angleStep;
      const targetLength = (14 + Math.min(root.size, 20) * 1.5) * scale;
      const grown = this.anim(this.rootAnim, root.id, targetLength);
      const wobble = Math.sin(timeMs * SWAY_SPEED * 0.7 + i) * 1.5 * scale;

      const endX = x + Math.cos(angle) * grown;
      const endY = y + Math.sin(angle) * grown + wobble;
      const cpX = x + Math.cos(angle) * grown * 0.5 + Math.cos(angle + Math.PI / 2) * 4 * scale;
      const cpY = y + Math.sin(angle) * grown * 0.5 + Math.sin(angle + Math.PI / 2) * 4 * scale;

      const sick = root.health < 1;
      const color = sick
        ? interpolateColor(PALETTE.rootLeakDeep, PALETTE.rootLeak, root.health * 2)
        : PALETTE.rootHealthy;

      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2.2 * scale;
      this.ctx.lineCap = 'round';
      if (sick) {
        this.ctx.shadowColor = PALETTE.rootLeak;
        this.ctx.shadowBlur = 6 * (1 - root.health);
      }
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;

      const noduleR = (sick ? 3.5 : 2.5) * scale;
      const noduleGrad = this.ctx.createRadialGradient(
        endX - noduleR * 0.3, endY - noduleR * 0.3, 0,
        endX, endY, noduleR
      );
      noduleGrad.addColorStop(0, interpolateColor(color, '#FFFFFF', 0.25));
      noduleGrad.addColorStop(1, color);
      this.ctx.beginPath();
      this.ctx.arc(endX, endY, noduleR, 0, Math.PI * 2);
      this.ctx.fillStyle = noduleGrad;
      this.ctx.fill();

      this.hitRegions.push({ x: endX, y: endY, r: 15 * scale, type: 'root', data: root });

      this.bounds.minX = Math.min(this.bounds.minX, endX);
      this.bounds.maxX = Math.max(this.bounds.maxX, endX);
      this.bounds.minY = Math.min(this.bounds.minY, endY - noduleR - 10);
    });

    this.ctx.restore();
  }

  private static readonly DEPTH_DECAY = 0.82;

  private drawNode(
    node: GrowthNode,
    x: number,
    y: number,
    angle: number,
    activePath: string[],
    hoveredNodeId: string | null,
    timeMs: number,
    baseSegmentLength: number,
    canvasWidth: number
  ) {
    if (node.health <= 0) return;

    this.ctx.save();

    const levelScale = Math.pow(GardenRenderer2D.DEPTH_DECAY, node.depth);
    const targetLength = Math.max(8, baseSegmentLength * levelScale);
    const grownLength = this.anim(this.growthAnim, node.id, targetLength);

    const healthTarget = node.health;
    const displayHealth = this.anim(this.healthAnim, node.id, healthTarget, 0.08);
    const displayDisease = this.anim(this.diseaseAnim, node.id, node.diseaseLevel, 0.05);

    const refScale = baseSegmentLength / 60;
    const diseaseThinning = 1 - displayDisease * 0.35;
    const widthStart = Math.max(1.2, (6 - node.depth) * 0.9) * Math.max(0.5, Math.min(6, refScale)) * diseaseThinning;
    const widthEnd = Math.max(0.8, widthStart * 0.72);

    const isActive = activePath.includes(node.id);
    const isHovered = hoveredNodeId === node.id;

    const swaySeed = node.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const sway = Math.sin(timeMs * SWAY_SPEED + swaySeed) * (0.02 + node.depth * 0.004);
    const droop = displayDisease * 0.32;
    const drawAngle = angle + sway + droop;

    const endX = x + Math.cos(drawAngle) * grownLength;
    const endY = y + Math.sin(drawAngle) * grownLength;

    this.hitRegions.push({ x: endX, y: endY, r: 14 * Math.max(0.5, Math.min(6, refScale)), type: 'node', data: node });

    const dx = endX - x;
    const dy = endY - y;
    const bend = (Math.sin(swaySeed * 0.7) * 5) + Math.sin(timeMs * SWAY_SPEED * 0.5 + swaySeed) * 2;
    const cpX = x + dx / 2 - Math.sin(drawAngle) * bend;
    const cpY = y + dy / 2 + Math.cos(drawAngle) * bend;

    let baseColor = isActive ? PALETTE.barkHealthyLit : (node.depth === 0 ? PALETTE.barkHealthy : PALETTE.barkYoung);
    let strokeColor = displayHealth < 1
      ? interpolateColor(PALETTE.stemSick, baseColor, displayHealth)
      : baseColor;
    if (displayDisease > 0.02) {
      strokeColor = interpolateColor(strokeColor, PALETTE.stemDisease, Math.min(1, displayDisease));
    }

    if (isHovered) {
      this.ctx.shadowColor = PALETTE.glowActive;
      this.ctx.shadowBlur = 10;
    }

    if (node.hasProtectiveSap) {
      this.ctx.shadowColor = PALETTE.sapGlowStrong;
      this.ctx.shadowBlur = 15;
    }

    if (node.sealedSnap) {
      this.ctx.beginPath();
      this.ctx.moveTo(x - Math.sin(drawAngle)*widthStart*1.2, y + Math.cos(drawAngle)*widthStart*1.2);
      this.ctx.lineTo(x + Math.sin(drawAngle)*widthStart*1.2, y - Math.cos(drawAngle)*widthStart*1.2);
      this.ctx.strokeStyle = PALETTE.sapGlowStrong;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }

    this.drawTaperedStem(x, y, endX, endY, cpX, cpY, widthStart, widthEnd, strokeColor);
    
    if (node.kudzuLevel && node.kudzuLevel > 0) {
      this.drawKudzu(x, y, endX, endY, cpX, cpY, widthStart, widthEnd, node.kudzuLevel, timeMs, node.id);
    }
    
    this.ctx.shadowBlur = 0;

    const geomScale = Math.max(0.5, Math.min(6, refScale));
    this.drawLeaves(node.leaves, endX, endY, drawAngle, isActive || isHovered, displayHealth, timeMs, geomScale);
    this.drawSeedpods(node.seedpods, endX, endY, drawAngle, geomScale);
    this.drawBlueprints(node.blueprints || [], endX, endY, drawAngle, geomScale);
    this.drawFruits(node.fruits || [], endX, endY, drawAngle, geomScale, timeMs);
    this.drawRoots(node.roots, endX, endY, drawAngle, timeMs, geomScale);

    const childCount = node.children.length;
    const widthBoost = Math.max(1, Math.min(2.2, canvasWidth / 900));
    if (childCount > 0) {
      if (node.type === 'whorl') {
        const spread = Math.min(Math.PI * 1.8, Math.PI * 1.2 * widthBoost);
        const startAngle = drawAngle - spread / 2;
        const step = childCount > 1 ? spread / (childCount - 1) : 0;
        node.children.forEach((child, i) => {
          const jitter = Math.sin(i * 13.37) * 0.1;
          this.drawNode(child, endX, endY, startAngle + i * step + jitter, activePath, hoveredNodeId, timeMs, baseSegmentLength, canvasWidth);
        });
      } else if (childCount === 1) {
        this.drawNode(node.children[0], endX, endY, drawAngle, activePath, hoveredNodeId, timeMs, baseSegmentLength, canvasWidth);
      } else {
        const depthBoost = Math.max(0, 4 - node.depth) * 0.15;
        const spread = Math.min(Math.PI * 0.9, (Math.PI / 3.5) * widthBoost * (1 + depthBoost));
        const startAngle = drawAngle - spread / 2;
        const step = spread / (childCount - 1);
        node.children.forEach((child, i) => {
          let offset = 0;
          if (node.depth > 2 && childCount === 2) {
            offset = (i === 0 ? -0.15 : 0.15) * (node.depth % 2 === 0 ? 1 : -1);
          }
          this.drawNode(child, endX, endY, startAngle + i * step + offset, activePath, hoveredNodeId, timeMs, baseSegmentLength, canvasWidth);
        });
      }
    } else if (node.isComplete && node.id === 'root' && node.health === 1) {
      const bloom = approach(this.flowerAnim, 1, 0.06);
      this.drawFlower(endX, endY, timeMs, bloom, geomScale);
    }

    this.ctx.restore();
  }

  private drawKudzu(x: number, y: number, endX: number, endY: number, cpX: number, cpY: number, widthStart: number, widthEnd: number, level: number, timeMs: number, seed: string) {
    const ctx = this.ctx;
    ctx.save();
    const len = Math.max(0.001, Math.hypot(endX - x, endY - y));
    const steps = 10;
    
    const sSeed = seed.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (t > level) break;

      const curX = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cpX + t * t * endX;
      const curY = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cpY + t * t * endY;
      
      const nx = -(endY - y) / len;
      const ny = (endX - x) / len;
      
      const width = widthStart * (1 - t) + widthEnd * t;
      const wrap = Math.sin(t * Math.PI * 6 + sSeed + timeMs * 0.0005) * (width * 1.3);
      
      if (i === 0) ctx.moveTo(curX + nx * wrap, curY + ny * wrap);
      else ctx.lineTo(curX + nx * wrap, curY + ny * wrap);
    }
    
    ctx.strokeStyle = PALETTE.kudzuVine;
    ctx.lineWidth = Math.max(1, widthEnd * 0.4);
    ctx.stroke();
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (t > level) break;
      const curX = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cpX + t * t * endX;
      const curY = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cpY + t * t * endY;
      const nx = -(endY - y) / len;
      const ny = (endX - x) / len;
      const width = widthStart * (1 - t) + widthEnd * t;
      const wrap = Math.sin(t * Math.PI * 6 + sSeed + timeMs * 0.0005) * (width * 1.3);
      
      const px = curX + nx * wrap;
      const py = curY + ny * wrap;
      
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.5, widthEnd * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.kudzuLeaf;
      ctx.fill();
    }
    
    ctx.restore();
  }

  private drawBlueprints(blueprints: any[], x: number, y: number, stemAngle: number, geomScale: number) {
    if (!blueprints || blueprints.length === 0) return;
    this.ctx.save();
    
    blueprints.forEach((bp, i) => {
      const angle = stemAngle + Math.PI / 2 + (i % 2 === 0 ? -1 : 1) * 0.4;
      const px = x + Math.cos(angle) * 12 * geomScale;
      const py = y + Math.sin(angle) * 12 * geomScale;
      
      this.ctx.save();
      this.ctx.translate(px, py);
      
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 8 * geomScale, 0, Math.PI * 2);
      this.ctx.strokeStyle = PALETTE.blueprintEdge;
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([3, 3]);
      this.ctx.stroke();
      
      this.ctx.fillStyle = PALETTE.text;
      this.ctx.font = '9px "JetBrains Mono", monospace';
      this.ctx.fillText(`class ${bp.name}`, -15 * geomScale, -12 * geomScale);
      
      this.ctx.restore();
    });
    
    this.ctx.restore();
  }

  private drawFruits(fruits: any[], x: number, y: number, stemAngle: number, geomScale: number, timeMs: number) {
    if (!fruits || fruits.length === 0) return;
    this.ctx.save();
    
    fruits.forEach((fruit, i) => {
      const angle = stemAngle - Math.PI / 2 + (i % 2 === 0 ? -1 : 1) * 0.3;
      const sway = Math.sin(timeMs * SWAY_SPEED * 1.5 + i * 3) * 0.1;
      const drawAngle = angle + sway;
      
      const px = x + Math.cos(drawAngle) * 14 * geomScale;
      const py = y + Math.sin(drawAngle) * 14 * geomScale;
      
      this.ctx.save();
      this.ctx.translate(px, py);
      
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 7 * geomScale, 0, Math.PI * 2);
      const grad = this.ctx.createRadialGradient(-2*geomScale, -2*geomScale, 0, 0, 0, 7*geomScale);
      grad.addColorStop(0, '#FFA87D');
      grad.addColorStop(1, '#D86334');
      this.ctx.fillStyle = grad;
      this.ctx.fill();
      this.ctx.strokeStyle = '#8A3B1B';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      
      const props = Object.keys(fruit.props);
      if (props.length > 0) {
        this.ctx.fillStyle = '#FFEBD6';
        props.forEach((_prop, pi) => {
          const pa = (pi / props.length) * Math.PI * 2;
          const sx = Math.cos(pa) * 3 * geomScale;
          const sy = Math.sin(pa) * 3 * geomScale;
          this.ctx.beginPath();
          this.ctx.arc(sx, sy, 1.2 * geomScale, 0, Math.PI * 2);
          this.ctx.fill();
        });
      }
      
      this.ctx.restore();
    });
    
    this.ctx.restore();
  }

  private drawLeaves(leaves: Leaf[], x: number, y: number, stemAngle: number, showLabel: boolean, health: number, timeMs: number, geomScale: number = 1) {
    if (leaves.length === 0) return;

    this.ctx.save();
    leaves.forEach((leaf, i) => {
      const angle = stemAngle + Math.PI / 2 + (i % 2 === 0 ? -1 : 1) * 0.35 + Math.floor(i / 2) * 0.5;
      const growProgress = this.anim(this.leafAnim, leaf.id, 1, 0.1);
      const sway = Math.sin(timeMs * SWAY_SPEED * 1.3 + i * 2.1) * 0.08;
      const drawAngle = angle + sway;

      const len = 9 * growProgress * geomScale;
      const wid = 4.5 * growProgress * geomScale;
      const lx = x + Math.cos(drawAngle) * 6 * geomScale;
      const ly = y + Math.sin(drawAngle) * 6 * geomScale;

      this.ctx.save();
      this.ctx.translate(lx, ly);
      this.ctx.rotate(drawAngle);

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.quadraticCurveTo(len * 0.38, -wid * 1.1, len, 0);
      this.ctx.quadraticCurveTo(len * 0.42, wid * 0.85, 0, 0);
      const leafColor = health < 1 ? interpolateColor(PALETTE.leafSick, PALETTE.leafHealthy, health) : PALETTE.leafHealthy;
      const grad = this.ctx.createLinearGradient(0, -wid, len * 0.7, wid * 0.6);
      grad.addColorStop(0, health < 1 ? leafColor : PALETTE.leafHealthyLit);
      grad.addColorStop(0.55, health < 1 ? leafColor : PALETTE.leafHealthy);
      grad.addColorStop(1, interpolateColor(leafColor, PALETTE.leafVein, 0.3));
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      this.ctx.strokeStyle = health < 1 ? 'rgba(0,0,0,0.22)' : PALETTE.leafVein;
      this.ctx.lineWidth = 0.6;
      this.ctx.beginPath();
      this.ctx.moveTo(1, 0);
      this.ctx.lineTo(len - 1, 0);
      this.ctx.stroke();
      this.ctx.lineWidth = 0.35;
      this.ctx.globalAlpha = 0.6;
      for (const t of [0.35, 0.6]) {
        this.ctx.beginPath();
        this.ctx.moveTo(len * t, 0);
        this.ctx.lineTo(len * t + wid * 0.5, -wid * 0.55);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(len * t, 0);
        this.ctx.lineTo(len * t + wid * 0.4, wid * 0.45);
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
      this.ctx.restore();

      if (showLabel) {
        this.ctx.fillStyle = PALETTE.text;
        this.ctx.font = '10px "JetBrains Mono", monospace';
        this.ctx.fillText(`${leaf.name}=${leaf.value}`, lx + Math.cos(drawAngle) * 10 + 4, ly + Math.sin(drawAngle) * 10 + 4);
      }
    });
    this.ctx.restore();
  }

  private drawSeedpods(seedpods: Seedpod[], x: number, y: number, stemAngle: number, geomScale: number = 1) {
    if (!seedpods || seedpods.length === 0) return;

    this.ctx.save();
    seedpods.forEach((pod, i) => {
      const angle = stemAngle - Math.PI / 2 + (i % 2 === 0 ? -1 : 1) * 0.2;
      
      const elementsCount = Math.max(1, pod.elements.length);
      const podLen = (12 + elementsCount * 4) * geomScale;
      const podWid = 5 * geomScale;
      
      const px = x + Math.cos(angle) * 8 * geomScale;
      const py = y + Math.sin(angle) * 8 * geomScale;

      this.ctx.save();
      this.ctx.translate(px, py);
      this.ctx.rotate(angle);

      this.ctx.beginPath();
      this.ctx.ellipse(podLen/2, 0, podLen/2, podWid, 0, 0, Math.PI * 2);
      
      const sick = pod.caterpillarDamage && pod.caterpillarDamage > 0;
      this.ctx.fillStyle = sick ? PALETTE.podSick : PALETTE.podHealthy;
      this.ctx.fill();

      if (sick) {
        this.ctx.beginPath();
        this.ctx.arc(podLen * 0.8, -podWid * 0.5, podWid * 0.8, 0, Math.PI * 2);
        this.ctx.fillStyle = PALETTE.bgTop; 
        this.ctx.fill();
        this.ctx.strokeStyle = PALETTE.stemSick;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      this.ctx.fillStyle = PALETTE.podSeed;
      const seedSpacing = podLen / (elementsCount + 1);
      for (let j = 0; j < elementsCount; j++) {
        this.ctx.beginPath();
        this.ctx.arc(seedSpacing * (j + 1), 0, 1.8 * geomScale, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private drawFlower(x: number, y: number, timeMs: number, bloom: number, geomScale: number = 1) {
    this.ctx.save();
    const petals = 6;
    const petalLen = 10 * bloom * geomScale;
    const petalWid = 4.5 * bloom * geomScale;
    const spin = timeMs * SWAY_SPEED * 0.4;

    const glowR = petalLen * 2.2;
    if (glowR > 0) {
      const glow = this.ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, `rgba(246, 196, 83, ${0.35 * bloom})`);
      glow.addColorStop(1, 'rgba(246, 196, 83, 0)');
      this.ctx.fillStyle = glow;
      this.ctx.beginPath();
      this.ctx.arc(x, y, glowR, 0, Math.PI * 2);
      this.ctx.fill();
    }

    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2 + spin;
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.quadraticCurveTo(petalWid, -petalLen * 0.5, 0, -petalLen);
      this.ctx.quadraticCurveTo(-petalWid, -petalLen * 0.5, 0, 0);
      const petalGrad = this.ctx.createLinearGradient(0, 0, 0, -petalLen);
      petalGrad.addColorStop(0, PALETTE.flowerCenter);
      petalGrad.addColorStop(0.6, PALETTE.flowerPetal);
      petalGrad.addColorStop(1, '#FDE199');
      this.ctx.fillStyle = petalGrad;
      this.ctx.globalAlpha = 0.6 + 0.4 * bloom;
      this.ctx.fill();
      this.ctx.restore();
    }

    const centerR = 4 * bloom * geomScale;
    const centerGrad = this.ctx.createRadialGradient(x - centerR * 0.3, y - centerR * 0.3, 0, x, y, centerR);
    centerGrad.addColorStop(0, '#F2C15E');
    centerGrad.addColorStop(1, PALETTE.flowerCenter);
    this.ctx.beginPath();
    this.ctx.arc(x, y, centerR, 0, Math.PI * 2);
    this.ctx.fillStyle = centerGrad;
    this.ctx.globalAlpha = 1;
    this.ctx.fill();
    this.ctx.restore();
  }
}
