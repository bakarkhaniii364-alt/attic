import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, ShareOutcomeOverlay } from '../components/UI.jsx';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';

const PLAY_WIDTH = 800;
const PLAY_HEIGHT = 400;
const BORDER_SIZE = 40;
const CANVAS_WIDTH = PLAY_WIDTH + BORDER_SIZE * 2;
const CANVAS_HEIGHT = PLAY_HEIGHT + BORDER_SIZE * 2;
const BALL_R = 14;
const POCKET_R = 26;

const POCKETS = [
  { x: 0, y: 0 }, { x: PLAY_WIDTH / 2, y: -10 }, { x: PLAY_WIDTH, y: 0 },
  { x: 0, y: PLAY_HEIGHT }, { x: PLAY_WIDTH / 2, y: PLAY_HEIGHT + 10 }, { x: PLAY_WIDTH, y: PLAY_HEIGHT }
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

const solveCollision = (b1, b2) => {
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
};

export function PoolGame({ config, sfx, userId, partnerId, setScores, onWin, onBack, roomId }) {
  const isMultiplayer = config.mode === '1v1_remote';
  const myPlayerId = isMultiplayer ? userId : 'p1';
  const oppPlayerId = isMultiplayer ? partnerId : 'p2';
  const isHost = !isMultiplayer || userId < partnerId;

  const canvasRef = useRef(null);
  const engineRef = useRef({
      balls: [],
      isSimulating: false,
      dragStart: null,
      currentMouse: null,
      hoverMouse: null
  });

  const [gameState, setGameState] = useGlobalSync(`pool_${roomId}`, null);
  const broadcastShot = useBroadcast(`pool_shot_${roomId}`);

  // Init game
  useEffect(() => {
      if (isHost && !gameState) {
          setGameState({
              ballsState: getInitialBalls(), // snapshot
              turn: myPlayerId,
              assignments: { [myPlayerId]: null, [oppPlayerId]: null }, // 'solid' or 'stripe'
              winner: null,
              message: "Break!"
          });
      }
  }, [isHost, gameState, setGameState, myPlayerId, oppPlayerId]);

  // Load state into engine when simulation is idle
  useEffect(() => {
      if (gameState && !engineRef.current.isSimulating) {
          // deep copy
          engineRef.current.balls = gameState.ballsState.map(b => ({ ...b }));
      }
  }, [gameState]);

  // Remote shot handler
  useEffect(() => {
      const unsub = broadcastShot(payload => {
          if (payload.sender !== userId) {
             executeShot(payload.vx, payload.vy);
          }
      });
      return () => unsub && unsub();
  }, [broadcastShot, userId]);

  const executeShot = (vx, vy) => {
      const cue = engineRef.current.balls.find(b => b.id === 0);
      if (cue) {
          cue.vx = vx;
          cue.vy = vy;
          engineRef.current.isSimulating = true;
          playAudio('hit', sfx);
          startPhysicsLoop();
      }
  };

  const startPhysicsLoop = () => {
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
              b.vx *= 0.985;
              b.vy *= 0.985;
              if (Math.abs(b.vx) < 0.05) b.vx = 0;
              if (Math.abs(b.vy) < 0.05) b.vy = 0;
              
              if (b.vx !== 0 || b.vy !== 0) moving = true;

              // Walls
              if (b.x < BALL_R) { b.x = BALL_R; b.vx *= -0.8; }
              if (b.x > PLAY_WIDTH - BALL_R) { b.x = PLAY_WIDTH - BALL_R; b.vx *= -0.8; }
              if (b.y < BALL_R) { b.y = BALL_R; b.vy *= -0.8; }
              if (b.y > PLAY_HEIGHT - BALL_R) { b.y = PLAY_HEIGHT - BALL_R; b.vy *= -0.8; }

              // Pockets
              for (const p of POCKETS) {
                  if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R + 5) {
                      b.active = false;
                      b.vx = 0; b.vy = 0;
                      playAudio('sink', sfx);
                      break;
                  }
              }
          }

          // Collisions
          for (let i = 0; i < balls.length; i++) {
              if (!balls[i].active) continue;
              for (let j = i + 1; j < balls.length; j++) {
                  if (!balls[j].active) continue;
                  solveCollision(balls[i], balls[j]);
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

  const processTurnEnd = () => {
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
      }

      if (winner && setScores && winner === myPlayerId) {
          setScores(p => ({ ...p, pool: { ...(p.pool || {}), [userId]: (p.pool?.[userId] || 0) + 1 } }));
          if (onWin) onWin();
      }

      setGameState({
          ballsState: balls.map(b => ({ ...b })),
          turn: nextTurn,
          assignments: newAssignments,
          winner,
          message: msg || (nextTurn === oldState.turn ? "Shoot again" : "Turn passed")
      });
  };

      // Rendering Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
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
              // Smooth large black circles
              ctx.arc(p.x, p.y, POCKET_R + 2, 0, Math.PI * 2);
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

                  // Raycast for collision
                  let closestHit = null;
                  let minT = Infinity;
                  
                  engine.balls.forEach(b => {
                      if (!b.active || b.id === 0) return;
                      const vx = b.x - cue.x;
                      const vy = b.y - cue.y;
                      const t = vx * nx + vy * ny;
                      if (t > 0) {
                          const qx = cue.x + t * nx;
                          const qy = cue.y + t * ny;
                          const dsq = (b.x - qx)**2 + (b.y - qy)**2;
                          const rsq = (BALL_R * 2)**2;
                          if (dsq <= rsq) {
                              const tInt = t - Math.sqrt(rsq - dsq);
                              if (tInt > 0 && tInt < minT) {
                                  minT = tInt;
                                  closestHit = { ball: b, tInt, qx, qy, dsq };
                              }
                          }
                      }
                  });

                  // Raycast for walls
                  let wallT = Infinity;
                  let wallNX = 0, wallNY = 0;
                  if (nx > 0) { const t = (PLAY_WIDTH - BALL_R - cue.x) / nx; if(t > 0 && t < wallT) { wallT = t; wallNX = -1; wallNY = 0; } }
                  else if (nx < 0) { const t = (BALL_R - cue.x) / nx; if(t > 0 && t < wallT) { wallT = t; wallNX = 1; wallNY = 0; } }
                  
                  if (ny > 0) { const t = (PLAY_HEIGHT - BALL_R - cue.y) / ny; if(t > 0 && t < wallT) { wallT = t; wallNX = 0; wallNY = -1; } }
                  else if (ny < 0) { const t = (BALL_R - cue.y) / ny; if(t > 0 && t < wallT) { wallT = t; wallNX = 0; wallNY = 1; } }

                  ctx.beginPath();
                  ctx.moveTo(cue.x, cue.y);

                  if (closestHit && minT < wallT) {
                      const hx = cue.x + nx * minT;
                      const hy = cue.y + ny * minT;
                      ctx.lineTo(hx, hy);
                      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                      ctx.lineWidth = 6;
                      ctx.stroke();
                      
                      // Draw ghost cue ball outline
                      ctx.beginPath();
                      ctx.arc(hx, hy, BALL_R, 0, Math.PI * 2);
                      ctx.strokeStyle = '#ffffff';
                      ctx.lineWidth = 2;
                      ctx.stroke();

                      // Target ball trajectory
                      const tBall = closestHit.ball;
                      const nColX = tBall.x - hx;
                      const nColY = tBall.y - hy;
                      const nColDist = Math.hypot(nColX, nColY);
                      const ncx = nColX / nColDist;
                      const ncy = nColY / nColDist;
                      
                      ctx.beginPath();
                      ctx.moveTo(tBall.x, tBall.y);
                      ctx.lineTo(tBall.x + ncx * 150, tBall.y + ncy * 150);
                      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                      ctx.lineWidth = 4;
                      ctx.stroke();
                  } else if (wallT !== Infinity) {
                      const hx = cue.x + nx * wallT;
                      const hy = cue.y + ny * wallT;
                      ctx.lineTo(hx, hy);
                      
                      // Reflection
                      const rx = nx - 2 * (nx * wallNX + ny * wallNY) * wallNX;
                      const ry = ny - 2 * (nx * wallNX + ny * wallNY) * wallNY;
                      
                      ctx.lineTo(hx + rx * 200, hy + ry * 200);
                      
                      const grad = ctx.createLinearGradient(cue.x, cue.y, hx + rx * 200, hy + ry * 200);
                      grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                      
                      ctx.strokeStyle = grad;
                      ctx.lineWidth = 6;
                      ctx.stroke();
                  } else {
                      const aimLen = 600;
                      const grad = ctx.createLinearGradient(cue.x, cue.y, cue.x + nx * aimLen, cue.y + ny * aimLen);
                      grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                      ctx.lineTo(cue.x + nx * aimLen, cue.y + ny * aimLen); 
                      ctx.strokeStyle = grad;
                      ctx.lineWidth = 6;
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
              if (isMultiplayer) broadcastShot({ vx, vy, sender: userId });
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

              if (isMultiplayer) broadcastShot({ vx, vy, sender: userId });
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
                        <div className="font-black uppercase text-xl mb-1">YOU</div>
                        <div className="font-bold flex items-center gap-2">
                           {myType === 'red' && <div className="w-4 h-4 rounded-full bg-red-500 border border-black"></div>}
                           {myType === 'blue' && <div className="w-4 h-4 rounded-full bg-blue-500 border border-black"></div>}
                           <span className="uppercase">{myType || 'OPEN TABLE'}</span>
                        </div>
                    </div>
                    
                    <div className="font-black text-2xl text-center opacity-50 uppercase">VS</div>

                    <div className={`p-4 retro-border-thick retro-shadow-dark transition-all ${gameState?.turn === oppPlayerId ? 'bg-[var(--primary)] text-[var(--text-on-primary)] scale-105' : 'bg-[var(--bg-main)] opacity-70'}`}>
                        <div className="font-black uppercase text-xl mb-1">{isMultiplayer ? 'P2' : 'AI'}</div>
                        <div className="font-bold flex items-center gap-2">
                           {oppType === 'red' && <div className="w-4 h-4 rounded-full bg-red-500 border border-black"></div>}
                           {oppType === 'blue' && <div className="w-4 h-4 rounded-full bg-blue-500 border border-black"></div>}
                           <span className="uppercase">{oppType || 'OPEN TABLE'}</span>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <div className="text-xs opacity-70 font-bold mb-1 uppercase">Game Status</div>
                        <div className="text-sm font-bold bg-[var(--bg-main)] p-2 retro-border shadow-[inset_2px_2px_0_rgba(0,0,0,0.1)]">
                            {gameState?.message}
                        </div>
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
                <div className="retro-border-thick retro-shadow-dark bg-[var(--border)] relative p-2 max-h-full max-w-full aspect-[11/6]">
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
                 onShareToChat={onShareToChat}
                 onSaveToScrapbook={onSaveToScrapbook}
                 partnerNickname={config.mode === 'vs_ai' ? 'AI' : undefined}
               />
            )}
        </div>
    </RetroWindow>
  );
}
