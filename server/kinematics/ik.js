'use strict';

/**
 * FABRIK Inverse Kinematics solver for a 6-axis robot arm.
 *
 * DH parameter convention (one entry per joint, angles in radians):
 *   a           — link length along x-axis (mm)
 *   d           — link offset along z-axis (mm)
 *   alpha       — twist angle about x-axis (radians)
 *   thetaOffset — constant angle offset added to the joint variable (radians)
 *
 * Approach
 * ────────
 * 1. θ1 (azimuth) is solved analytically: atan2(ty, tx).
 * 2. For the sagittal pitch joints (J3, J4) a 2D analytical scan finds a good
 *    initial solution so FABRIK starts very close to the answer.
 * 3. FABRIK runs on the free sub-chain (anchored shoulder → end-effector) and
 *    converges quickly (typically 1–5 iterations) from the seeded position.
 * 4. Joint angles are back-computed from the FABRIK joint positions via the
 *    inverse DH transform.
 *
 * Default robot (DEFAULT_DH_PARAMS) — vertical 6R arm (units: mm)
 * ─────────────────────────────────────────────────────────────────
 *   J1  base azimuth           (world Z rotation, shoulder height 400 mm)
 *   J2  shoulder twist         (sets up sagittal pitch axis — no translation)
 *   J3  upper arm  500 mm      (pitches in sagittal plane)
 *   J4  forearm    430 mm      (pitches in sagittal plane)
 *   J5  wrist twist            (pure rotation — no position effect)
 *   J6  tool       120 mm      (extends along wrist z-axis)
 *
 * Public API
 * ──────────
 *   solve(target, dhParams?, initialAngles?, options?)
 *     → { angles, positions, converged, error }
 *
 *   forwardKinematics(dhParams, angles)
 *     → { positions, transforms }
 *
 *   DEFAULT_DH_PARAMS
 */

// ─── Default DH parameters ────────────────────────────────────────────────────

const DEFAULT_DH_PARAMS = [
  { a:   0, d: 400, alpha:  0,            thetaOffset: 0 }, // J1 base azimuth
  { a:   0, d:   0, alpha: -Math.PI / 2,  thetaOffset: 0 }, // J2 shoulder twist
  { a: 500, d:   0, alpha:  0,            thetaOffset: 0 }, // J3 upper arm
  { a: 430, d:   0, alpha:  0,            thetaOffset: 0 }, // J4 forearm
  { a:   0, d:   0, alpha:  Math.PI / 2,  thetaOffset: 0 }, // J5 wrist twist
  { a:   0, d: 120, alpha:  0,            thetaOffset: 0 }, // J6 tool
];

// ─── Vector helpers ───────────────────────────────────────────────────────────

function vsub(a, b)  { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function vlen(v)     { return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]); }
function vdist(a, b) { return vlen(vsub(a, b)); }

function pullToward(p, q, len) {
  const d = vdist(p, q);
  if (d < 1e-12) return [...p];
  const s = len / d;
  return [q[0]+(p[0]-q[0])*s, q[1]+(p[1]-q[1])*s, q[2]+(p[2]-q[2])*s];
}

function pushFrom(parent, child, len) {
  const d = vdist(parent, child);
  if (d < 1e-12) return [...child];
  const s = len / d;
  return [
    parent[0]+(child[0]-parent[0])*s,
    parent[1]+(child[1]-parent[1])*s,
    parent[2]+(child[2]-parent[2])*s,
  ];
}

// ─── 4×4 matrix helpers ───────────────────────────────────────────────────────

function identity4() {
  return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
}

function matMul4(A, B) {
  const R = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
}

/** Standard DH homogeneous transform: T = Rz(θ)·Tz(d)·Tx(a)·Rx(α) */
function dhTransform(a, d, alpha, theta) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  return [
    [ ct, -st*ca,  st*sa,  a*ct ],
    [ st,  ct*ca, -ct*sa,  a*st ],
    [  0,     sa,     ca,     d ],
    [  0,      0,      0,     1 ],
  ];
}

function invertTransform(T) {
  const tx = T[0][3], ty = T[1][3], tz = T[2][3];
  return [
    [T[0][0],T[1][0],T[2][0], -(T[0][0]*tx+T[1][0]*ty+T[2][0]*tz)],
    [T[0][1],T[1][1],T[2][1], -(T[0][1]*tx+T[1][1]*ty+T[2][1]*tz)],
    [T[0][2],T[1][2],T[2][2], -(T[0][2]*tx+T[1][2]*ty+T[2][2]*tz)],
    [      0,      0,      0,  1],
  ];
}

function transformPoint(T, p) {
  return [
    T[0][0]*p[0]+T[0][1]*p[1]+T[0][2]*p[2]+T[0][3],
    T[1][0]*p[0]+T[1][1]*p[1]+T[1][2]*p[2]+T[1][3],
    T[2][0]*p[0]+T[2][1]*p[1]+T[2][2]*p[2]+T[2][3],
  ];
}

// ─── Forward kinematics ───────────────────────────────────────────────────────

function forwardKinematics(dh, angles) {
  const positions  = [[0, 0, 0]];
  const transforms = [identity4()];
  let T = identity4();
  for (let i = 0; i < dh.length; i++) {
    const { a, d, alpha, thetaOffset } = dh[i];
    const Ti = dhTransform(a, d, alpha, angles[i] + thetaOffset);
    T = matMul4(T, Ti);
    transforms.push(T.map(r => [...r]));
    positions.push([T[0][3], T[1][3], T[2][3]]);
  }
  return { positions, transforms };
}

// ─── Anchor detection ─────────────────────────────────────────────────────────

function findAnchors(dh) {
  const anchored = new Set([0]);
  for (let i = 0; i < dh.length; i++) {
    if (anchored.has(i) && Math.abs(dh[i].a) < 1e-6) {
      anchored.add(i + 1);
    }
  }
  return anchored;
}

// ─── 2-D analytical seed ──────────────────────────────────────────────────────

/**
 * For a 2-link + tool arm in the sagittal plane, find θ3, θ4 analytically.
 *
 * Arm geometry in (r, z) plane starting from shoulder (0, d1):
 *   J3 position: (L3·cos θ3,  d1 − L3·sin θ3)                [+θ3 = downward]
 *   J4 position: J3 + (L4·cos α,  −L4·sin α)                 [α = θ3+θ4]
 *   Tool tip:    J4 + (L6·sin α,   L6·cos α)                  [⊥ to forearm]
 *
 * Given target (r_t, z_t) we scan α ∈ [−π, π] and for each α solve for θ3:
 *   L3·cos θ3 = r_t − L4·cos α − L6·sin α  =: C
 *   L3·sin θ3 = d1  − z_t − L4·sin α + L6·cos α  =: S (wait, sign corrected below)
 *   Valid when C²+S² ≈ L3²
 *
 * Returns the α that minimises |C²+S² − L3²|, plus θ3 and θ4=α−θ3.
 *
 * @param {number} rt   Horizontal reach of target
 * @param {number} zt   Vertical height of target
 * @param {number} d1   Shoulder height (mm)
 * @param {number} L3   Upper-arm link length (mm)
 * @param {number} L4   Forearm link length (mm)
 * @param {number} L6   Tool extension length (mm)
 * @returns {{ theta3: number, theta4: number, alpha: number }}
 */
function seed2D(rt, zt, d1, L3, L4, L6) {
  const STEPS  = 720;           // resolution of α scan
  let bestAlpha = 0, bestT3 = 0, bestT4 = 0, bestResid = Infinity;

  for (let k = 0; k <= STEPS; k++) {
    const alpha = -Math.PI + (2 * Math.PI / STEPS) * k;

    // Target position of J4 in (r, z)
    const wristR = rt - L6 * Math.sin(alpha);
    const wristZ = zt - L6 * Math.cos(alpha);

    // Upper-arm components must equal (L3·cosθ3, d1 − L3·sinθ3) for some θ3
    //   C = wristR − L4·cos α    (= L3·cos θ3)
    //   S = d1 − wristZ − L4·sin α  but rearranging J4_z eqn:
    //     d1 − L3·sinθ3 − L4·sinα = wristZ
    //   → L3·sinθ3 = d1 − wristZ − L4·sinα =: S
    const C = wristR - L4 * Math.cos(alpha);
    const S = d1 - wristZ - L4 * Math.sin(alpha);

    const resid = Math.abs(C * C + S * S - L3 * L3);
    if (resid < bestResid) {
      bestResid = resid;
      bestAlpha = alpha;
      bestT3    = Math.atan2(S, C);
      bestT4    = alpha - bestT3;
    }
  }

  // Normalise to (−π, π]
  const norm = v => ((v + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
  return { theta3: norm(bestT3), theta4: norm(bestT4), alpha: bestAlpha };
}

// ─── FABRIK ───────────────────────────────────────────────────────────────────

function fabrik(positions, lengths, anchors, target, tolerance, maxIter) {
  const MIN_LEN = 1e-3;
  const n   = positions.length;
  const pos = positions.map(p => [...p]);

  let rootIdx = 0;
  for (let i = n - 2; i >= 0; i--) {
    if (anchors.has(i)) { rootIdx = i; break; }
  }
  const rootPos = [...pos[rootIdx]];

  const subIdx = [rootIdx];
  const subLen = [];
  for (let i = rootIdx; i < n - 1; i++) {
    if (lengths[i] > MIN_LEN) {
      subIdx.push(i + 1);
      subLen.push(lengths[i]);
    } else {
      pos[i + 1] = [...pos[i]];
    }
  }

  if (subIdx.length < 2) return { positions: pos, converged: false };

  const sub = subIdx.map(i => [...pos[i]]);
  const totalReach = subLen.reduce((s, l) => s + l, 0);

  if (vdist(rootPos, target) >= totalReach) {
    sub[sub.length - 1] = [...target];
    for (let i = sub.length - 2; i >= 1; i--)
      sub[i] = pullToward(sub[i], sub[i + 1], subLen[i]);
    subIdx.forEach((idx, k) => { pos[idx] = [...sub[k]]; });
    return { positions: pos, converged: false };
  }

  let converged = false;
  for (let iter = 0; iter < maxIter; iter++) {
    sub[sub.length - 1] = [...target];
    for (let i = sub.length - 2; i >= 0; i--)
      sub[i] = pullToward(sub[i], sub[i + 1], subLen[i]);
    sub[0] = [...rootPos];
    for (let i = 1; i < sub.length; i++)
      sub[i] = pushFrom(sub[i - 1], sub[i], subLen[i - 1]);
    if (vdist(sub[sub.length - 1], target) < tolerance) { converged = true; break; }
  }

  subIdx.forEach((idx, k) => { pos[idx] = [...sub[k]]; });
  for (let i = rootIdx + 1; i < n; i++) {
    if (lengths[i - 1] <= MIN_LEN) pos[i] = [...pos[i - 1]];
  }
  return { positions: pos, converged };
}

// ─── Angle extraction ─────────────────────────────────────────────────────────

/**
 * Back-compute DH joint angles from world-space joint positions.
 *
 *  a ≠ 0  →  θ = atan2(local_y, local_x) − thetaOffset
 *             where local = T_prev^{−1} · fabrikPos[i+1]
 *
 *  a = 0, d ≠ 0, i = 0  →  θ = atan2(target_y, target_x)  (base azimuth)
 *
 *  a = 0, d ≠ 0, i > 0  →  θ from direction to nearest XY-displaced descendant
 *
 *  a = 0, d = 0  →  pure rotation, no positional effect → θ = 0
 */
function extractAngles(dh, fabrikPos, target) {
  const angles = new Array(dh.length).fill(0);
  let T = identity4();

  for (let i = 0; i < dh.length; i++) {
    const { a, d, alpha, thetaOffset } = dh[i];
    let theta = 0;

    if (Math.abs(a) > 1e-6) {
      const local = transformPoint(invertTransform(T), fabrikPos[i + 1]);
      theta = Math.atan2(local[1], local[0]) - thetaOffset;

    } else if (Math.abs(d) > 1e-6) {
      if (i === 0) {
        // Base azimuth: reading any descendant's direction encodes θ1+θ2+…,
        // so we solve it directly from the target XY direction instead.
        theta = Math.atan2(target[1] - fabrikPos[0][1],
                           target[0] - fabrikPos[0][0]) - thetaOffset;
      } else {
        const Tinv = invertTransform(T);
        const lCur = transformPoint(Tinv, fabrikPos[i]);
        let found = false;
        for (let j = i + 1; j < fabrikPos.length; j++) {
          const lD = transformPoint(Tinv, fabrikPos[j]);
          const dx = lD[0] - lCur[0], dy = lD[1] - lCur[1];
          if (Math.sqrt(dx*dx + dy*dy) > 1.0) {
            theta = Math.atan2(dy, dx) - thetaOffset;
            found = true; break;
          }
        }
        if (!found) {
          const lT = transformPoint(Tinv, target);
          theta = Math.atan2(lT[1] - lCur[1], lT[0] - lCur[0]) - thetaOffset;
        }
      }
    }
    // a=0, d=0 → pure rotation, leave θ=0

    theta = ((theta + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
    angles[i] = theta;
    T = matMul4(T, dhTransform(a, d, alpha, theta + thetaOffset));
  }
  return angles;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Solve IK for a 6-axis robot arm using FABRIK.
 *
 * For DEFAULT_DH_PARAMS the solver combines:
 *   • Analytical 2-D scan for J3/J4 (sagittal plane joints) → near-exact seed
 *   • FABRIK refinement so the chain satisfies link-length constraints exactly
 *   • DH angle extraction from the FABRIK positions
 *
 * @param {number[]}  target          Desired end-effector position [x,y,z] (mm)
 * @param {object[]}  [dhParams]      DH parameter array (defaults to DEFAULT_DH_PARAMS)
 * @param {number[]}  [initialAngles] Starting joint angles in radians (default: zeros)
 * @param {object}    [options]
 * @param {number}    [options.tolerance=1.0]  Convergence threshold (mm)
 * @param {number}    [options.maxIter=100]    Maximum FABRIK iterations
 *
 * @returns {{
 *   angles:    number[],    // solved joint angles [θ1…θ6] in radians
 *   positions: number[][],  // world-space joint origins after IK (n+1 points)
 *   converged: boolean,
 *   error:     number       // residual |end-effector − target| (mm)
 * }}
 */
function solve(target, dhParams, initialAngles, options) {
  dhParams      = dhParams      || DEFAULT_DH_PARAMS;
  initialAngles = initialAngles || new Array(dhParams.length).fill(0);
  const { tolerance = 1.0, maxIter = 100 } = options || {};

  if (!Array.isArray(target) || target.length < 3)
    throw new TypeError('target must be an array [x, y, z]');
  if (dhParams.length !== initialAngles.length)
    throw new RangeError('dhParams and initialAngles must have the same length');

  const anchors = findAnchors(dhParams);
  const seedAngles = [...initialAngles];

  // ── θ1: base azimuth ──────────────────────────────────────────────────────
  if (anchors.has(1) && Math.abs(dhParams[0].a) < 1e-6) {
    seedAngles[0] = Math.atan2(target[1], target[0]);
  }

  // ── 2-D analytical seed for sagittal joints ───────────────────────────────
  // Detect the pattern: anchored shoulder, then two a≠0 pitch joints, then tool.
  // For DEFAULT_DH_PARAMS: anchors={0,1,2}, pitch joints = 2,3, tool = 5.
  {
    const anchorList = [...anchors].sort((a, b) => a - b);
    const deepAnchor = anchorList[anchorList.length - 1];   // index 2 for default
    const n = dhParams.length;

    // Collect free joints with a≠0 after the deep anchor
    const freeA = [];
    for (let i = deepAnchor; i < n; i++) {
      if (Math.abs(dhParams[i].a) > 1e-6) freeA.push(i);
    }
    // Collect tool joint: first a=0, d≠0 after the free-a joints
    let toolIdx = -1;
    for (let i = (freeA.length ? freeA[freeA.length - 1] + 1 : deepAnchor); i < n; i++) {
      if (Math.abs(dhParams[i].a) < 1e-6 && Math.abs(dhParams[i].d) > 1e-6) {
        toolIdx = i; break;
      }
    }

    if (freeA.length >= 2) {
      const d1 = dhParams[0].d;           // shoulder height
      const L3 = dhParams[freeA[0]].a;    // upper-arm link
      const L4 = dhParams[freeA[1]].a;    // forearm link
      const L6 = toolIdx >= 0 ? dhParams[toolIdx].d : 0;  // tool

      const rt = Math.sqrt(target[0] * target[0] + target[1] * target[1]);
      const zt = target[2];

      const { theta3, theta4 } = seed2D(rt, zt, d1, L3, L4, L6);
      seedAngles[freeA[0]] = theta3;
      seedAngles[freeA[1]] = theta4;
    }
  }

  // ── Initial positions from seeded angles ──────────────────────────────────
  const { positions: initPos } = forwardKinematics(dhParams, seedAngles);
  const segLengths = initPos.slice(1).map((p, i) => vdist(initPos[i], p));

  // ── FABRIK ────────────────────────────────────────────────────────────────
  const { positions: fabrikPos, converged } = fabrik(
    initPos, segLengths, anchors, target, tolerance, maxIter
  );

  // ── Angle extraction ──────────────────────────────────────────────────────
  const angles = extractAngles(dhParams, fabrikPos, target);

  // ── Final FK → residual error ─────────────────────────────────────────────
  const { positions: finalPos } = forwardKinematics(dhParams, angles);
  const error = vdist(finalPos[finalPos.length - 1], target);

  return { angles, positions: finalPos, converged, error };
}

module.exports = { solve, forwardKinematics, DEFAULT_DH_PARAMS };
