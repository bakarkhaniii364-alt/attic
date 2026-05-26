import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, ShareOutcomeOverlay } from '../components/UI.jsx';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';

const PLAY_WIDTH = 800;
const PLAY_HEIGHT = 400;
const BORDER_SIZE = 40;
const CANVAS_WIDTH = PLAY_WIDTH + BORDER_SIZE * 2;
const CANVAS_HEIGHT = PLAY_HEIGHT + BORDER_SIZE * 2;
const BALL_R = 12;
const POCKET_R = 30;
const VISUAL_POCKET_R = 30;

const POCKETS = [
  { x: 0, y: 0 }, { x: PLAY_WIDTH / 2, y: -2 }, { x: PLAY_WIDTH, y: 0 },
  { x: 0, y: PLAY_HEIGHT }, { x: PLAY_WIDTH / 2, y: PLAY_HEIGHT + 2 }, { x: PLAY_WIDTH, y: PLAY_HEIGHT }
];

const COLORS = {
  0: '#ffffff', // Cue
  1: '#ef4444', 2: '#ef4444', 3: '#ef4444', 4: '#ef4444', 5: '#ef4444', 6: '#ef4444', 7: '#ef4444', // Reds
  8: '#000000', // 8-ball
  9: '#3b82f6', 10: '#3b82f6', 11: '#3b82f6', 12: '#3b82f6', 13: '#3b82f6', 14: '#3b82f6', 15: '#3b82f6' // Blues
};

// Standard 8-ball rack triangle setup
const getInitialBalls = () => {
  const balls = [{ id: 0, x: 200, y: 200, vx: 0, vy: 0, type: 'cue', active: true }];
  const startX = 600;
  const startY = 200;
  const ids = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15]; // Ordered for a legal rack (8 in middle, corners mixed)
  
  let row = 0;
  let inRow = 0;
  let idx = 0;
  
  while (idx < 15) {
      const x = startX + row * (BALL_R * 2 * 0.866);
      const y = startY - (row * BALL_R) + (inRow * BALL_R * 2);
      const id = ids[idx];
      balls.push({
          id, x, y, vx: 0, vy: 0, 
          type: id === 8 ? '8' : id < 8 ? 'red' : 'blue',
          active: true
      });
      inRow++;
      idx++;
      if (inRow > row) {
          row++;
          inRow = 0;
      }
  }
  return balls;
};

const drawBall = (ctx, x, y, radius, color, id) => {
    // 1. Base color
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // 2. Dark crescent shadow (bottom right)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.beginPath();
    ctx.arc(x - radius * 0.2, y - radius * 0.2, radius, 0, Math.PI * 2);
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2, true); 
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
    ctx.restore();

    // 3. Highlight dot (top left)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 4. Black outline
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Number only for 8-ball
    if (id === 8) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('8', x, y + 1);
    }
};

const solveCollision = (b1, b2, onCueHit, onBallHit) => {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const dist = Math.hypot(dx, dy);
  
  if (dist === 0 || dist >= BALL_R * 2) return;
  const overlap = (BALL_R * 2 - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  
  // Move apart
  b1.x -= nx * overlap; b1.y -= ny * overlap;
  b2.x += nx * overlap; b2.y += ny * overlap;

  if (b1.id === 0 && onCueHit) onCueHit(b2);
  if (b2.id === 0 && onCueHit) onCueHit(b1);
  
  // Velocity response
  const rvx = b2.vx - b1.vx;
  const rvy = b2.vy - b1.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  
  if (velAlongNormal > 0) return;
  
  const restitution = 0.9;
  const impulse = -(1 + restitution) * velAlongNormal / 2;
  
  const ix = nx * impulse;
  const iy = ny * impulse;
  
  b1.vx -= ix; b1.vy -= iy;
  b2.vx += ix; b2.vy += iy;

  // Trigger SFX on meaningful collision (speed threshold avoids spam)
  const speed = Math.abs(velAlongNormal);
  if (speed > 1.5 && onBallHit) onBallHit(speed);
};

export function PoolGame({ config, sfx, userId, partnerId, setScores, onWin, onBack, roomId, onShareToChat, onSaveToScrapbook, partnerName }) {
  const isMultiplayer = config.mode === '1v1_remote';
  const myPlayerId = isMultiplayer ? userId : 'p1';
  const oppPlayerId = isMultiplayer ? partnerId : 'p2';
  const isHost = !isMultiplayer || userId < partnerId;

  const canvasRef = useRef(null);
  const firstBallHitRef = useRef(null);
  const engineRef = useRef({
      balls: [],
      isSimulating: false,
      dragStart: null,
      currentMouse: null,
      hoverMouse: null
  });

  const executeShot = useCallback((vx, vy) => {
      const cue = engineRef.current.balls.find(b => b.id === 0);
      if (cue) {
          cue.vx = vx;
          cue.vy = vy;
          engineRef.current.isSimulating = true;
          firstBallHitRef.current = null;
          // Use break shot SFX for high-power shots, regular hit for others
          const shotSpeed = Math.hypot(vx, vy);
          playAudio(shotSpeed > 18 ? 'pool_break' : 'pool_hit', sfx);
          startPhysicsLoop();
      }
  }, [sfx]);

  const [gameState, setGameState] = useGlobalSync(`pool_${roomId}`, null);
  
  // Low-latency shot animation cue (non-authoritative — just starts the visual on guest side)
  const broadcastShotCue = useBroadcast(`pool_shot_${roomId}`, (payload) => {
      if (isMultiplayer && payload.sender !== userId && !isHost) {
         // Guest: apply the shot vector for visual animation only
         // Authoritative positions will come from setGameState (useGlobalSync) after host settles
         executeShot(payload.vx, payload.vy);
      }
  });

  // Init game - ONLY on first mount or when manually requested
  useEffect(() => {
      if (isHost && !gameState) {
          setGameState({
              ballsState: getInitialBalls(), // snapshot
              turn: myPlayerId,
              assignments: { [myPlayerId]: null, [oppPlayerId]: null }, // 'solid' or 'stripe'
              points: { [myPlayerId]: 0, [oppPlayerId]: 0 },
              winner: null,
              message: "Break!"
          });
      }
  }, [isHost, isMultiplayer]); // Run once on mount

  const handleManualReset = () => {
    if (!isHost && isMultiplayer) return;
    playAudio('click', sfx);
    setGameState(null);
    engineRef.current.balls = getInitialBalls();
    engineRef.current.isSimulating = false;
  };

  // Load authoritative state from DB into engine
  // - Solo/Host: only when not simulating (don't interrupt active physics)
  // - Guest (non-host, multiplayer): ALWAYS load — host is authoritative, override local sim
  useEffect(() => {
      if (!gameState?.ballsState) return;
      if (!isMultiplayer || isHost) {
          // Host / solo: load only when idle
          if (!engineRef.current.isSimulating) {
              engineRef.current.balls = gameState.ballsState.map(b => ({ ...b }));
          }
      } else {
          // Guest: forcibly stop any running local sim and snap to host state
          engineRef.current.isSimulating = false;
          engineRef.current.balls = gameState.ballsState.map(b => ({ ...b }));
      }
  }, [gameState]);

   function startPhysicsLoop() {
      const loop = () => {
          let moving = false;
          const engine = engineRef.current;
          const balls = engine.balls;

          // Process physics
          for (let i = 0; i < balls.length; i++) {
              const b = balls[i];
              if (!b.active) continue;

              b.x += b.vx;
              b.y += b.vy;
              
              // Friction
              b.vx *= 0.99;
              b.vy *= 0.99;
              if (Math.abs(b.vx) < 0.05) b.vx = 0;
              if (Math.abs(b.vy) < 0.05) b.vy = 0;
              
              if (b.vx !== 0 || b.vy !== 0) moving = true;

              // Pockets - Improved detection and "pull" force
              let pocketed = false;
              for (const p of POCKETS) {
                  const distToPocket = Math.hypot(b.x - p.x, b.y - p.y);
                  if (distToPocket < POCKET_R) {
                      if (distToPocket > 5) {
                          const pull = 0.5;
                          b.vx += (p.x - b.x) / distToPocket * pull;
                          b.vy += (p.y - b.y) / distToPocket * pull;
                      }
                      if (distToPocket < 15) {
                        b.active = false;
                        b.vx = 0; b.vy = 0;
                        playAudio('pool_sink', sfx);
                        pocketed = true;
                        break;
                      }
                  }
              }

              if (pocketed) continue;

              // Walls — play cushion SFX on hard bounces
              const nearPocket = POCKETS.some(p => Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R * 1.5);
              if (!nearPocket) {
                  if (b.x < BALL_R) { b.x = BALL_R; if (Math.abs(b.vx) > 2) playAudio('pool_cushion', sfx); b.vx *= -0.8; }
                  else if (b.x > PLAY_WIDTH - BALL_R) { b.x = PLAY_WIDTH - BALL_R; if (Math.abs(b.vx) > 2) playAudio('pool_cushion', sfx); b.vx *= -0.8; }
                  if (b.y < BALL_R) { b.y = BALL_R; if (Math.abs(b.vy) > 2) playAudio('pool_cushion', sfx); b.vy *= -0.8; }
                  else if (b.y > PLAY_HEIGHT - BALL_R) { b.y = PLAY_HEIGHT - BALL_R; if (Math.abs(b.vy) > 2) playAudio('pool_cushion', sfx); b.vy *= -0.8; }
              }
          }

          // Collisions - sub-stepping for better accuracy
          for (let step = 0; step < 10; step++) {
              for (let i = 0; i < balls.length; i++) {
                  if (!balls[i].active) continue;
                  for (let j = i + 1; j < balls.length; j++) {
                      if (!balls[j].active) continue;
                      solveCollision(
                        balls[i], balls[j],
                        (other) => { if (firstBallHitRef.current === null) firstBallHitRef.current = other.id; },
                        (speed) => { if (step === 0) playAudio('pool_hit', sfx); } // only fire on first sub-step
                      );
                  }
              }
          }

          if (moving) {
              requestAnimationFrame(loop);
          } else {
              engine.isSimulating = false;
              if (isHost || !isMultiplayer) processTurnEnd();
          }
      };
      requestAnimationFrame(loop);
  };

   function processTurnEnd() {
      // Evaluate rules
      const oldState = gameState;
      const balls = engineRef.current.balls;
      let nextTurn = oldState.turn === myPlayerId ? oppPlayerId : myPlayerId;
      let newAssignments = { ...oldState.assignments };
      let msg = "";
      let winner = null;
      
      const pocketedThisTurn = balls.filter(b => !b.active && oldState.ballsState.find(ob => ob.id === b.id)?.active);
      const cue = balls.find(b => b.id === 0);
      const eight = balls.find(b => b.id === 8);

      let scratch = false;
      let legitimateSink = false;

      const currentTurnPlayer = oldState.turn;
      const myType = oldState.assignments[currentTurnPlayer];
      const myBallsLeft = balls.filter(b => b.active && b.type === myType);

      if (firstBallHitRef.current === 8 && (myType === null || myBallsLeft.length > 0)) {
          winner = nextTurn;
          msg = "Hit 8-ball first! You lose.";
      }

      if (!cue.active) {
          scratch = true;
          cue.active = true;
          let rx = 200, ry = 200;
          let valid = false;
          while(!valid && ry < PLAY_HEIGHT - BALL_R) {
              valid = true;
              for(const b of balls) {
                  if(b.id !== 0 && b.active && Math.hypot(b.x - rx, b.y - ry) < BALL_R * 2 + 5) {
                      valid = false;
                      rx += 10;
                      if(rx > PLAY_WIDTH - BALL_R) { rx = BALL_R * 2; ry += 20; }
                      break;
                  }
              }
          }
          cue.x = rx; cue.y = ry; cue.vx = 0; cue.vy = 0;
          msg = "Scratch! Opponent's turn.";
      }

      if (!eight.active) {
          // Did they legally win?
          const myType = oldState.assignments[oldState.turn];
          const myBallsLeft = balls.filter(b => b.active && b.type === myType);
          
          if (scratch || myBallsLeft.length > 0 || myType === null) {
              winner = nextTurn; // Loss
              msg = "8-Ball sunk illegally! You lose.";
          } else {
              winner = oldState.turn; // Win
              msg = "8-Ball sunk! You win!";
          }
      }

      if (!scratch && !winner) {
          pocketedThisTurn.forEach(b => {
              if (b.type === 'red' || b.type === 'blue') {
                  if (newAssignments[myPlayerId] === null) {
                      newAssignments[oldState.turn] = b.type;
                      newAssignments[nextTurn] = b.type === 'red' ? 'blue' : 'red';
                      msg = `You are ${b.type}s!`;
                  }
                  if (newAssignments[oldState.turn] === b.type) {
                      legitimateSink = true; // Keep turn
                  }
              }
          });

           if (legitimateSink) {
               nextTurn = oldState.turn;
               if(!msg) msg = "Good shot! Shoot again.";
           }

           // Explicit end condition: if one player scores all the balls of their color, game ends
           const myType = newAssignments[myPlayerId];
           const oppType = newAssignments[oppPlayerId];
           if (myType && balls.filter(b => b.active && b.type === myType).length === 0) {
               winner = myPlayerId;
               msg = "You pocketed all your balls! You win!";
           } else if (oppType && balls.filter(b => b.active && b.type === oppType).length === 0) {
               winner = oppPlayerId;
               msg = "Opponent pocketed all their balls! You lose.";
           }
       }

       const oldPoints = oldState.points || { [myPlayerId]: 0, [oppPlayerId]: 0 };
       const newPoints = { ...oldPoints };
       pocketedThisTurn.forEach(b => {
           if (b.type === 'red' || b.type === 'blue') {
               if (newAssignments[oldState.turn] === b.type) {
                   newPoints[oldState.turn] += 100;
               }
           } else if (b.type === '8' && winner === oldState.turn) {
               newPoints[oldState.turn] += 500;
           }
       });

      if (winner && setScores && winner === myPlayerId) {
          setScores(p => ({ ...p, pool: { ...(p.pool || {}), [userId]: (p.pool?.[userId] || 0) + 1 } }));
          try {
              import('../utils/userDataHelpers.js').then(({ submitHighscore }) => {
                  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
                  submitHighscore('pool', config?.mode || 'arcade', newPoints[myPlayerId] || 1, profile?.name || 'Player', userId);
              });
          } catch(e) {}
          if (onWin) onWin();
      }

      setGameState({
          ballsState: balls.map(b => ({ ...b })),
          turn: nextTurn,
          assignments: newAssignments,
          points: newPoints,
          winner,
          message: msg || (nextTurn === oldState.turn ? "Shoot again" : "Turn passed")
      });
  };

      // Rendering Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = CANVAS_WIDTH * 2;
      canvas.height = CANVAS_HEIGHT * 2;
      ctx.scale(2, 2);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const bodyStyles = getComputedStyle(document.body);

      let frameId;
      const render = () => {
          // Smooth curves
          ctx.imageSmoothingEnabled = true;

          const bgWindow = bodyStyles.getPropertyValue('--bg-window').trim() || '#ffffff';

          // Clear outer background
          ctx.fillStyle = bgWindow;
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // 1. Board Structure from Image
          const WOOD = 32;
          const OUTLINE = 8;
          
          const outerX = BORDER_SIZE - WOOD - OUTLINE;
          const outerY = BORDER_SIZE - WOOD - OUTLINE;
          const outerW = PLAY_WIDTH + WOOD*2 + OUTLINE*2;
          const outerH = PLAY_HEIGHT + WOOD*2 + OUTLINE*2;

          // Outer Black Outline (Rounded)
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          if (ctx.roundRect) {
              ctx.roundRect(outerX, outerY, outerW, outerH, 20);
          } else {
              ctx.fillRect(outerX, outerY, outerW, outerH);
          }
          ctx.fill();

          // Wood Base
          ctx.fillStyle = '#8C5741';
          ctx.beginPath();
          if (ctx.roundRect) {
              ctx.roundRect(BORDER_SIZE - WOOD, BORDER_SIZE - WOOD, PLAY_WIDTH + WOOD*2, PLAY_HEIGHT + WOOD*2, 12);
          } else {
              ctx.fillRect(BORDER_SIZE - WOOD, BORDER_SIZE - WOOD, PLAY_WIDTH + WOOD*2, PLAY_HEIGHT + WOOD*2);
          }
          ctx.fill();

          // Inner Black Outline
          ctx.fillStyle = '#000000';
          ctx.fillRect(BORDER_SIZE - OUTLINE, BORDER_SIZE - OUTLINE, PLAY_WIDTH + OUTLINE*2, PLAY_HEIGHT + OUTLINE*2);

          // Felt Surface
          ctx.fillStyle = '#46A04A';
          ctx.fillRect(BORDER_SIZE, BORDER_SIZE, PLAY_WIDTH, PLAY_HEIGHT);

          ctx.save();
          ctx.translate(BORDER_SIZE, BORDER_SIZE);

          // 2. Pockets (Black circles overlapping wood and felt)
          ctx.fillStyle = '#000000';
          POCKETS.forEach(p => {
              ctx.beginPath();
              // Smooth black circles
              ctx.arc(p.x, p.y, VISUAL_POCKET_R, 0, Math.PI * 2);
              ctx.fill();
          });

          const engine = engineRef.current;
          
          // Draw aiming line
          const isMyTurn = gameState?.turn === myPlayerId;
          const cue = engine.balls.find(b => b.id === 0);
          
          if (isMyTurn && !engine.isSimulating && cue && cue.active && engine.dragStart && engine.currentMouse) {
              const dx = engine.dragStart.x - engine.currentMouse.x;
              const dy = engine.dragStart.y - engine.currentMouse.y;
              const pullDist = Math.hypot(dx, dy);

              if (pullDist > 0) {
                  const nx = dx / pullDist;
                  const ny = dy / pullDist;

                  // REFACTORED TRAJECTORY SYSTEM (Supports 1 bounce)
                  const findIntersection = (ox, oy, dx, dy, ignoreId = null) => {
                      let bestT = Infinity;
                      let bestBall = null;
                      engine.balls.forEach(b => {
                          if (!b.active || b.id === ignoreId) return;
                          const vx = ox - b.x;
                          const vy = oy - b.y;
                          const bTerm = vx * dx + vy * dy;
                          const cTerm = vx * vx + vy * vy - (BALL_R * 2) ** 2;
                          const disc = bTerm * bTerm - cTerm;
                          if (disc >= 0) {
                              const t = -bTerm - Math.sqrt(disc);
                              if (t > 0.1 && t < bestT) {
                                  bestT = t;
                                  bestBall = b;
                              }
                          }
                      });
                      
                      let wallT = Infinity;
                      let wallN = { x: 0, y: 0 };
                      if (dx > 0) { const t = (PLAY_WIDTH - BALL_R - ox) / dx; if(t > 0.1 && t < wallT) { wallT = t; wallN = {x:-1, y:0}; } }
                      else if (dx < 0) { const t = (BALL_R - ox) / dx; if(t > 0.1 && t < wallT) { wallT = t; wallN = {x:1, y:0}; } }
                      if (dy > 0) { const t = (PLAY_HEIGHT - BALL_R - oy) / dy; if(t > 0.1 && t < wallT) { wallT = t; wallN = {x:0, y:-1}; } }
                      else if (dy < 0) { const t = (BALL_R - oy) / dy; if(t > 0.1 && t < wallT) { wallT = t; wallN = {x:0, y:1}; } }
                      
                      if (bestBall && bestT < wallT) return { t: bestT, ball: bestBall, type: 'ball' };
                      if (wallT < Infinity) return { t: wallT, n: wallN, type: 'wall' };
                      return null;
                  };

                  const firstHit = findIntersection(cue.x, cue.y, nx, ny, 0);
                  let path = [{ x: cue.x, y: cue.y }];

                  if (firstHit) {
                      const hx = cue.x + nx * firstHit.t;
                      const hy = cue.y + ny * firstHit.t;
                      path.push({ x: hx, y: hy });

                      if (firstHit.type === 'wall') {
                          // Calculate reflected ray for 1 bounce
                          const rnx = nx + 2 * firstHit.n.x * (-(nx * firstHit.n.x + ny * firstHit.n.y));
                          const rny = ny + 2 * firstHit.n.y * (-(nx * firstHit.n.x + ny * firstHit.n.y));
                          const secondHit = findIntersection(hx, hy, rnx, rny, 0);
                          if (secondHit) {
                              path.push({ x: hx + rnx * secondHit.t, y: hy + rny * secondHit.t });
                              if (secondHit.type === 'ball') path[path.length-1].hitBall = secondHit.ball;
                          } else {
                              path.push({ x: hx + rnx * 100, y: hy + rny * 100 });
                          }
                      } else {
                          path[path.length-1].hitBall = firstHit.ball;
                      }
                  } else {
                      path.push({ x: cue.x + nx * 100, y: cue.y + ny * 100 });
                  }

                  // Draw path
                  ctx.beginPath();
                  ctx.setLineDash([5, 5]);
                  ctx.moveTo(path[0].x, path[0].y);
                  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  ctx.setLineDash([]);

                  // Draw ghost cue and target impact
                  if (path.some(p => p.hitBall)) {
                      const impactPoint = path.find(p => p.hitBall);
                      // Ghost cue
                      ctx.beginPath();
                      ctx.arc(impactPoint.x, impactPoint.y, BALL_R, 0, Math.PI * 2);
                      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                      ctx.stroke();

                      // Target ball direction
                      const tBall = impactPoint.hitBall;
                      const dtx = tBall.x - impactPoint.x;
                      const dty = tBall.y - impactPoint.y;
                      const ddist = Math.hypot(dtx, dty);
                      const tx = dtx / ddist;
                      const ty = dty / ddist;
                      ctx.beginPath();
                      ctx.moveTo(tBall.x, tBall.y);
                      ctx.lineTo(tBall.x + tx * 100, tBall.y + ty * 100);
                      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                      ctx.stroke();
                  }
                  
                  // Power Pull Preview
                  const maxPower = 30;
                  const currentSpeed = Math.min(pullDist * 0.15, maxPower);
                  const powerRatio = currentSpeed / maxPower;
                  
                  ctx.beginPath();
                  ctx.moveTo(cue.x, cue.y);
                  ctx.lineTo(cue.x - nx * (powerRatio * 150), cue.y - ny * (powerRatio * 150));
                  ctx.strokeStyle = `rgba(255, ${255 * (1 - powerRatio)}, 0, 0.8)`;
                  ctx.lineWidth = 6;
                  ctx.lineCap = 'round';
                  ctx.stroke();
              }
          }

          // Draw balls
          engine.balls.forEach(b => {
              if (!b.active) return;
              drawBall(ctx, b.x, b.y, BALL_R, COLORS[b.id], b.id);
          });

          ctx.restore();

          frameId = requestAnimationFrame(render);
      };
      render();

      return () => cancelAnimationFrame(frameId);
  }, [gameState !== null]);

  const handlePointerDown = (e) => {
      const isMyTurn = gameState?.turn === myPlayerId;
      if (!isMyTurn || engineRef.current.isSimulating || gameState?.winner) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (e.clientX - rect.left) * scaleX - BORDER_SIZE;
      const y = (e.clientY - rect.top) * scaleY - BORDER_SIZE;
      
      const cue = engineRef.current.balls.find(b => b.id === 0);
      if (cue && Math.hypot(cue.x - x, cue.y - y) < BALL_R * 3) {
          engineRef.current.dragStart = { x, y };
          engineRef.current.currentMouse = { x, y };
      }
  };

  const handlePointerMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (e.clientX - rect.left) * scaleX - BORDER_SIZE;
      const y = (e.clientY - rect.top) * scaleY - BORDER_SIZE;
      
      engineRef.current.hoverMouse = { x, y };

      if (engineRef.current.dragStart) {
          engineRef.current.currentMouse = { x, y };
      }
  };

  const handlePointerUp = () => {
      const engine = engineRef.current;
      if (engine.dragStart && engine.currentMouse) {
          const dx = engine.dragStart.x - engine.currentMouse.x;
          const dy = engine.dragStart.y - engine.currentMouse.y;
          
          const maxPower = 30;
          let vx = dx * 0.15;
          let vy = dy * 0.15;
          const speed = Math.hypot(vx, vy);
          if (speed > maxPower) {
              vx = (vx / speed) * maxPower;
              vy = (vy / speed) * maxPower;
          }

          if (speed > 1) {
              // Broadcast shot cue for guest animation
              if (isMultiplayer) broadcastShotCue({ vx, vy, sender: userId });
              executeShot(vx, vy);
          }
      }
      engine.dragStart = null;
      engine.currentMouse = null;
  };

  // AI Turn Logic
  useEffect(() => {
      if (!gameState || isMultiplayer || gameState.winner || engineRef.current.isSimulating) return;

      if (gameState.turn === oppPlayerId) {
          const aiTimer = setTimeout(() => {
              const engine = engineRef.current;
              const balls = engine.balls;
              const cue = balls.find(b => b.id === 0);
              const eight = balls.find(b => b.id === 8);
              
              if (!cue || !cue.active) return; // Wait for cue to be placed

              let targetType = gameState.assignments[oppPlayerId];
              let targets = balls.filter(b => b.active && b.type === targetType);
              
              if (!targetType) {
                  targets = balls.filter(b => b.active && (b.type === 'red' || b.type === 'blue'));
              }
              
              if (targets.length === 0 && eight && eight.active) {
                  targets = [eight];
              }
              
              if (targets.length === 0) return;

              // Simple AI: pick random target and a pocket
              const target = targets[Math.floor(Math.random() * targets.length)];
              // Find closest pocket to target
              let bestPocket = POCKETS[0];
              let minDist = Infinity;
              POCKETS.forEach(p => {
                  const d = Math.hypot(p.x - target.x, p.y - target.y);
                  if (d < minDist) { minDist = d; bestPocket = p; }
              });

              // Ghost ball: position cue ball needs to be to hit target into pocket
              const dxTargetToPocket = bestPocket.x - target.x;
              const dyTargetToPocket = bestPocket.y - target.y;
              const distToPocket = Math.hypot(dxTargetToPocket, dyTargetToPocket);
              const nx = dxTargetToPocket / distToPocket;
              const ny = dyTargetToPocket / distToPocket;

              const ghostX = target.x - nx * (BALL_R * 2);
              const ghostY = target.y - ny * (BALL_R * 2);

              // Vector from cue to ghost ball
              const dxCueToGhost = ghostX - cue.x;
              const dyCueToGhost = ghostY - cue.y;
              const distCueToGhost = Math.hypot(dxCueToGhost, dyCueToGhost);

              // Add randomness (error)
              const errorAngle = (Math.random() - 0.5) * 0.15; // up to ~8.5 degrees error
              const cos = Math.cos(errorAngle);
              const sin = Math.sin(errorAngle);
              const finalDx = dxCueToGhost * cos - dyCueToGhost * sin;
              const finalDy = dxCueToGhost * sin + dyCueToGhost * cos;

              let power = Math.min(30, distCueToGhost * 0.05 + 10);
              
              const vx = (finalDx / distCueToGhost) * power;
              const vy = (finalDy / distCueToGhost) * power;

              if (isMultiplayer) broadcastShotCue({ vx, vy, sender: userId });
              executeShot(vx, vy);

          }, 1500);
          return () => clearTimeout(aiTimer);
      }
  }, [gameState, isMultiplayer, oppPlayerId]);

  if (!gameState) return <div className="p-8 text-center animate-pulse font-black uppercase text-xl">Racking balls...</div>;

  const isMyTurn = gameState.turn === myPlayerId;
  const myType = gameState.assignments[myPlayerId];
  const oppType = gameState.assignments[oppPlayerId];

  return (
    <RetroWindow title="retro_pool.exe" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
        <div className="flex flex-col md:flex-row w-full h-[80vh] bg-[var(--bg-main)] text-[var(--text-main)] font-mono select-none overflow-hidden touch-none relative">
            
            {/* Side Panel */}
            <div className="hidden md:flex flex-col w-[250px] h-full bg-[var(--bg-window)] border-r-2 border-[var(--border)] relative z-10">
                <div className="bg-[var(--border)] px-4 py-2 text-[var(--bg-window)] font-bold tracking-widest uppercase text-sm border-b-2 border-[var(--border)]">
                    retro_pool.sys
                </div>
                <div className="flex-1 p-4 flex flex-col gap-4">
                    <div className={`p-4 retro-border-thick retro-shadow-dark transition-all ${gameState?.turn === myPlayerId ? 'bg-[var(--primary)] text-[var(--text-on-primary)] scale-105' : 'bg-[var(--bg-main)] opacity-70'}`}>
                        <div className="font-black uppercase text-xl mb-1 flex justify-between items-center">
                            <span>YOU</span>
                            <span className="text-sm font-bold opacity-80">{gameState?.points?.[myPlayerId] || 0} pts</span>
                        </div>
                        <div className="font-bold flex items-center gap-2">
                           {myType === 'red' && <div className="w-4 h-4 rounded-full bg-red-500 border border-black"></div>}
                           {myType === 'blue' && <div className="w-4 h-4 rounded-full bg-blue-500 border border-black"></div>}
                           <span className="uppercase">{myType || 'OPEN TABLE'}</span>
                        </div>
                    </div>
                    
                    <div className="font-black text-2xl text-center opacity-50 uppercase">VS</div>

                    <div className={`p-4 retro-border-thick retro-shadow-dark transition-all ${gameState?.turn === oppPlayerId ? 'bg-[var(--primary)] text-[var(--text-on-primary)] scale-105' : 'bg-[var(--bg-main)] opacity-70'}`}>
                        <div className="font-black uppercase text-xl mb-1 flex justify-between items-center">
                            <span>{isMultiplayer ? 'P2' : 'AI'}</span>
                            <span className="text-sm font-bold opacity-80">{gameState?.points?.[oppPlayerId] || 0} pts</span>
                        </div>
                        <div className="font-bold flex items-center gap-2">
                           {oppType === 'red' && <div className="w-4 h-4 rounded-full bg-red-500 border border-black"></div>}
                           {oppType === 'blue' && <div className="w-4 h-4 rounded-full bg-blue-500 border border-black"></div>}
                           <span className="uppercase">{oppType || 'OPEN TABLE'}</span>
                        </div>
                    </div>

                    {/* Pocketed Info */}
                    <div className="mt-4 p-3 bg-[var(--bg-main)] retro-border">
                        <div className="text-[10px] font-black uppercase opacity-40 mb-2">Balls Remaining</div>
                        <div className="flex flex-wrap gap-2">
                            {engineRef.current.balls.filter(b => b.active && b.id !== 0).map(b => (
                                <div key={b.id} className="w-5 h-5 rounded-full border border-black shadow-sm" style={{ backgroundColor: COLORS[b.id] }}></div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                        <div className="text-xs opacity-70 font-bold mb-1 uppercase">Game Status</div>
                        <div className="text-sm font-bold bg-[var(--bg-main)] p-2 retro-border shadow-[inset_2px_2px_0_rgba(0,0,0,0.1)]">
                            {gameState?.message}
                        </div>
                        {(gameState?.winner || (isHost || !isMultiplayer)) && (
                            <button onClick={handleManualReset} className="mt-2 w-full py-2 bg-[var(--primary)] text-white font-black uppercase text-xs retro-border hover:scale-105 transition-all">
                                New Game
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Window Content (Game Area) */}
            <div 
                className="flex-1 relative overflow-hidden flex justify-center items-center p-4 bg-[var(--bg-main)]"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* Scoring Overlay for Mobile */}
                <div className="absolute top-4 left-4 right-4 md:hidden flex justify-between z-20 pointer-events-none">
                    <div className="bg-white/90 p-2 retro-border text-xs font-bold">
                        YOU: {engineRef.current.balls.filter(b => !b.active && b.type === myType).length}
                    </div>
                    <div className="bg-white/90 p-2 retro-border text-xs font-bold">
                        OPP: {engineRef.current.balls.filter(b => !b.active && b.type === oppType).length}
                    </div>
                </div>

                <div className="relative max-h-full max-w-full aspect-[11/6]">
                    <canvas 
                       ref={canvasRef} 
                       width={CANVAS_WIDTH} 
                       height={CANVAS_HEIGHT} 
                       className="block w-full h-full object-contain pointer-events-none"
                    />
                </div>
                
                {/* Messages Over Canvas - Visible on Mobile */}
                <div className={`md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] sm:text-[28px] font-bold text-center bg-[var(--bg-window)] text-[var(--text-main)] px-[30px] py-[15px] retro-border-thick retro-shadow-dark pointer-events-none transition-opacity duration-100 ${gameState?.message && gameState.message !== 'Break!' ? 'opacity-100' : 'opacity-0'}`}>
                    {gameState?.message}
                </div>

                {/* Mobile Status Indicator */}
                <div className="md:hidden absolute top-[10px] left-[10px] bg-[var(--bg-window)] retro-border-thick p-[5px] sm:p-[10px] text-[10px] sm:text-[12px] font-bold retro-shadow-dark pointer-events-none flex flex-col gap-1 z-20">
                     <div className={gameState?.turn === myPlayerId ? "text-[var(--primary)]" : "opacity-50"}>
                         YOU: {myType || 'open'}
                     </div>
                     <div className={gameState?.turn === oppPlayerId ? "text-[var(--primary)]" : "opacity-50"}>
                         OPP: {oppType || 'open'}
                     </div>
                </div>
            </div>

            {gameState?.winner && (
               <ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
                 gameName={`Retro Pool (${config.mode})`}
                 stats={{ Result: gameState.winner === myPlayerId ? 'You Win!' : 'You Lose!' }}
                 onClose={() => onBack()}
                 onRematch={() => {
                     setGameState({
                         ballsState: getInitialBalls(),
                         turn: myPlayerId,
                         assignments: { [myPlayerId]: null, [oppPlayerId]: null },
                         points: { [myPlayerId]: 0, [oppPlayerId]: 0 },
                         winner: null,
                         message: "Break!"
                     });
                 }}
                 onShareToChat={onShareToChat}
                 onSaveToScrapbook={onSaveToScrapbook}
                 partnerNickname={config.mode === 'vs_ai' ? 'AI' : undefined}
               />
            )}
        </div>
    </RetroWindow>
  );
}
