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
  1: '#eab308', 2: '#3b82f6', 3: '#ef4444', 4: '#8b5cf6', 5: '#f97316', 6: '#22c55e', 7: '#78350f', // Solids
  8: '#000000', // 8-ball
  9: '#eab308', 10: '#3b82f6', 11: '#ef4444', 12: '#8b5cf6', 13: '#f97316', 14: '#22c55e', 15: '#78350f' // Stripes
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
          type: id === 8 ? '8' : id < 8 ? 'solid' : 'stripe',
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
      currentMouse: null
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
          cue.x = 200; cue.y = 200; cue.vx = 0; cue.vy = 0;
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
              if (b.type === 'solid' || b.type === 'stripe') {
                  if (newAssignments[myPlayerId] === null) {
                      newAssignments[oldState.turn] = b.type;
                      newAssignments[nextTurn] = b.type === 'solid' ? 'stripe' : 'solid';
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

      let frameId;
      const render = () => {
          // Background - Wood border
          ctx.fillStyle = '#e3a05c'; 
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          
          // Wood border outline
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          ctx.save();
          ctx.translate(BORDER_SIZE, BORDER_SIZE);

          // Felt
          ctx.fillStyle = '#22c55e'; // classic vibrant green
          ctx.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
          
          // Inner felt outline
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);

          // Cushions
          ctx.fillStyle = '#166534';
          ctx.fillRect(POCKET_R, 0, PLAY_WIDTH - POCKET_R * 2, 14);
          ctx.fillRect(POCKET_R, PLAY_HEIGHT - 14, PLAY_WIDTH - POCKET_R * 2, 14);
          ctx.fillRect(0, POCKET_R, 14, PLAY_HEIGHT - POCKET_R * 2);
          ctx.fillRect(PLAY_WIDTH - 14, POCKET_R, 14, PLAY_HEIGHT - POCKET_R * 2);

          // Baulk line
          ctx.beginPath();
          ctx.moveTo(PLAY_WIDTH * 0.25, 0);
          ctx.lineTo(PLAY_WIDTH * 0.25, PLAY_HEIGHT);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Pockets
          ctx.fillStyle = '#000000';
          POCKETS.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
              ctx.fill();
          });

          const engine = engineRef.current;
          
          // Draw aiming line & Stick
          if (engine.dragStart && engine.currentMouse && !engine.isSimulating) {
              const cue = engine.balls.find(b => b.id === 0);
              if (cue && cue.active) {
                  const dx = engine.dragStart.x - engine.currentMouse.x;
                  const dy = engine.dragStart.y - engine.currentMouse.y;
                  
                  // Aiming line
                  ctx.beginPath();
                  ctx.moveTo(cue.x, cue.y);
                  ctx.lineTo(cue.x + dx * 3, cue.y + dy * 3);
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                  ctx.setLineDash([5, 5]);
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  ctx.setLineDash([]);

                  // Stick
                  const stickDist = Math.hypot(dx, dy) + BALL_R + 5;
                  const angle = Math.atan2(dy, dx);
                  
                  ctx.save();
                  ctx.translate(cue.x, cue.y);
                  ctx.rotate(angle);
                  const stickLength = 250;
                  ctx.fillStyle = '#d97706';
                  ctx.fillRect(-stickDist - stickLength, -3, stickLength - 15, 6);
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(-stickDist - 15, -3, 15, 6);
                  ctx.fillStyle = '#3b82f6';
                  ctx.fillRect(-stickDist, -3, 3, 6);
                  
                  ctx.strokeStyle = '#000000';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(-stickDist - stickLength, -3, stickLength, 6);
                  ctx.restore();
              }
          }

          // Draw balls
          engine.balls.forEach(b => {
              if (!b.active) return;
              ctx.beginPath();
              ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
              
              if (b.type === 'stripe') {
                  ctx.fillStyle = '#ffffff';
                  ctx.fill();
                  ctx.fillStyle = COLORS[b.id];
                  ctx.fillRect(b.x - BALL_R, b.y - BALL_R * 0.45, BALL_R * 2, BALL_R * 0.9);
              } else {
                  ctx.fillStyle = COLORS[b.id];
                  ctx.fill();
              }
              
              // Retro chunky outline
              ctx.beginPath();
              ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2.5;
              ctx.stroke();
              
              if (b.id !== 0) {
                 ctx.fillStyle = '#ffffff';
                 ctx.beginPath();
                 ctx.arc(b.x, b.y, BALL_R * 0.55, 0, Math.PI * 2);
                 ctx.fill();
                 ctx.strokeStyle = '#000000';
                 ctx.lineWidth = 1.5;
                 ctx.stroke();

                 ctx.fillStyle = '#000000';
                 ctx.font = 'bold 11px monospace';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(b.id, b.x, b.y + 1);
              }
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
      if (engineRef.current.dragStart) {
          const rect = canvasRef.current.getBoundingClientRect();
          const scaleX = CANVAS_WIDTH / rect.width;
          const scaleY = CANVAS_HEIGHT / rect.height;
          engineRef.current.currentMouse = {
              x: (e.clientX - rect.left) * scaleX - BORDER_SIZE,
              y: (e.clientY - rect.top) * scaleY - BORDER_SIZE
          };
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

  if (!gameState) return <div className="p-8 text-center animate-pulse font-black uppercase text-xl">Racking balls...</div>;

  const isMyTurn = gameState.turn === myPlayerId;
  const myType = gameState.assignments[myPlayerId];
  const oppType = gameState.assignments[oppPlayerId];

  return (
    <RetroWindow title="retro_pool.exe" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
        <div className="flex flex-col w-full h-[75vh] bg-[var(--bg-main)] text-[var(--text-main)] font-mono select-none overflow-hidden touch-none relative">
            
            {/* Window Content (Game Area) */}
            <div 
                className="flex-1 relative overflow-hidden flex justify-center items-center bg-[var(--border)]"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <canvas 
                   ref={canvasRef} 
                   width={CANVAS_WIDTH} 
                   height={CANVAS_HEIGHT} 
                   className="block w-full h-full object-contain pointer-events-none"
                />
                
                {/* Messages */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] sm:text-[28px] font-bold text-center bg-[var(--bg-window)] text-[var(--text-main)] px-[30px] py-[15px] retro-border-thick retro-shadow-dark pointer-events-none transition-opacity duration-100 ${gameState?.message && gameState.message !== 'Break!' ? 'opacity-100' : 'opacity-0'}`}>
                    {gameState?.message}
                </div>

                {/* Status Indicator */}
                <div className="absolute top-[10px] left-[10px] bg-[var(--bg-window)] retro-border-thick p-[5px] sm:p-[10px] text-[10px] sm:text-[12px] font-bold retro-shadow-dark pointer-events-none flex flex-col gap-1">
                     <div className={gameState?.turn === myPlayerId ? "text-[var(--primary)]" : "opacity-50"}>
                         YOU: {myType || 'open'}
                     </div>
                     <div className={gameState?.turn === oppPlayerId ? "text-[var(--primary)]" : "opacity-50"}>
                         OPP: {oppType || 'open'}
                     </div>
                </div>
            </div>

            <div className="text-center text-[12px] sm:text-[14px] font-bold text-[var(--bg-window)] mt-0 bg-[var(--border)] px-[15px] py-[5px]">
                Drag anywhere to aim & shoot
            </div>

            {gameState?.winner && (
               <ShareOutcomeOverlay
                 outcome={gameState.winner === myPlayerId ? 'win' : 'loss'}
                 score={`Winner: ${gameState.winner === myPlayerId ? 'You' : 'Opponent'}`}
                 gameName="Retro Pool"
                 onClose={() => onBack()}
               />
            )}
        </div>
    </RetroWindow>
  );
}
