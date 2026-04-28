import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
const WILD_VALUES = ['wild', 'wild_draw4'];

// Helper to generate a unique ID for each card
const generateId = () => Math.random().toString(36).substring(2, 9);

const createDeck = () => {
  const deck = [];
  COLORS.forEach(color => {
    deck.push({ id: generateId(), color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: generateId(), color, value: String(i) });
      deck.push({ id: generateId(), color, value: String(i) });
    }
    ['skip', 'reverse', 'draw2'].forEach(val => {
      deck.push({ id: generateId(), color, value: val });
      deck.push({ id: generateId(), color, value: val });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: generateId(), color: 'wild', value: 'wild' });
    deck.push({ id: generateId(), color: 'wild', value: 'wild_draw4' });
  }
  return deck.sort(() => Math.random() - 0.5);
};

const getCardColorClass = (color) => {
  switch(color) {
    case 'red': return 'bg-red-500 text-white';
    case 'blue': return 'bg-blue-500 text-white';
    case 'green': return 'bg-green-500 text-white';
    case 'yellow': return 'bg-yellow-400 text-[var(--border)]';
    default: return 'bg-[var(--border)] text-[var(--bg-window)]'; // Wild
  }
};

const CardUI = ({ card, onClick, className = "", hidden = false }) => {
  if (hidden || card.color === 'back') {
    return (
      <div className={`w-[60px] h-[90px] sm:w-[86px] sm:h-[128px] retro-border-thick rounded-[6px] bg-red-500 flex items-center justify-center relative retro-shadow-dark ${className}`} style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.3) 12px, rgba(0,0,0,0.3) 16px)' }}>
      </div>
    );
  }

  const isWild = card.color === 'wild';
  const displayVal = card.value === 'skip' ? 'Ø' : card.value === 'reverse' ? '⇄' : card.value === 'draw2' ? '+2' : card.value === 'wild' ? 'W' : card.value === 'wild_draw4' ? '+4' : card.value;

  const innerStyle = isWild ? {
      background: 'conic-gradient(#ef4444 90deg, #3b82f6 90deg 180deg, #facc15 180deg 270deg, #22c55e 270deg)',
      color: 'white',
      textShadow: '2px 2px 0 var(--border)'
  } : {};

  return (
    <div 
      onClick={onClick}
      className={`w-[60px] h-[90px] sm:w-[86px] sm:h-[128px] retro-border-thick rounded-[6px] flex flex-col justify-center items-center relative select-none retro-shadow-dark ${getCardColorClass(card.color)} ${onClick ? 'cursor-pointer hover:-translate-y-5 hover:scale-110 hover:z-[100] transition-all' : ''} ${className}`}
    >
      <div className="w-[72%] h-[62%] bg-[var(--bg-window)] retro-border-thick flex justify-center items-center text-[22px] sm:text-[36px] font-bold text-[var(--border)] rounded-[4px]" style={innerStyle}>
        {displayVal}
      </div>
    </div>
  );
};

export function UnoGame({ config, sfx, userId, partnerId, setScores, onWin, onBack, roomId }) {
  const isMultiplayer = config.mode === '1v1_remote';
  const myPlayerId = isMultiplayer ? userId : 'p1';
  const oppPlayerId = isMultiplayer ? partnerId : 'ai';
  
  // Deterministic initialization for host
  const isHost = !isMultiplayer || userId < partnerId;

  const [gameState, setGameState] = useGlobalSync(`uno_${roomId}`, null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const aiTimeoutRef = useRef(null);

  const showMessage = (msg) => {
      setActionMessage(msg);
      setTimeout(() => setActionMessage(curr => curr === msg ? "" : curr), 1500);
  };

  // Initialize game
  useEffect(() => {
    if (isHost && !gameState) {
      let deck = createDeck();
      const p1Hand = deck.splice(0, 7);
      const p2Hand = deck.splice(0, 7);
      let firstCard = deck.pop();
      while (firstCard.color === 'wild') {
         deck.unshift(firstCard);
         firstCard = deck.pop();
      }
      
      setGameState({
        deck,
        discard: [firstCard],
        hands: {
          [myPlayerId]: p1Hand,
          [oppPlayerId]: p2Hand
        },
        turn: myPlayerId,
        currentColor: firstCard.color,
        unoCalled: { [myPlayerId]: false, [oppPlayerId]: false },
        winner: null
      });
    }
  }, [isHost, gameState, myPlayerId, oppPlayerId, setGameState]);

  const { deck, discard, hands, turn, currentColor, unoCalled, winner } = gameState || {};
  const topCard = discard ? discard[discard.length - 1] : null;
  const isMyTurn = turn === myPlayerId;

  const myHand = hands ? hands[myPlayerId] || [] : [];
  const oppHand = hands ? hands[oppPlayerId] || [] : [];

  const isValidPlay = (card) => {
    if (card.color === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  const drawCards = (playerId, amount, currentDeck, currentHands) => {
    let newDeck = [...currentDeck];
    let newDiscard = [...discard];
    const drawn = [];
    
    for (let i = 0; i < amount; i++) {
      if (newDeck.length === 0) {
        const top = newDiscard.pop();
        newDeck = newDiscard.sort(() => Math.random() - 0.5);
        newDiscard = [top];
      }
      if (newDeck.length > 0) drawn.push(newDeck.pop());
    }

    const newHand = [...currentHands[playerId], ...drawn];
    return { newDeck, newDiscard, newHand };
  };

  const endTurn = (nextPlayer, newGameStateUpdates) => {
      setGameState(prev => ({
          ...prev,
          ...newGameStateUpdates,
          turn: nextPlayer
      }));
  };

  const playCard = (card, chosenColor = null) => {
    if (!isValidPlay(card) && card.color !== 'wild') return;

    let newHands = { ...hands };
    newHands[myPlayerId] = myHand.filter(c => c.id !== card.id);
    let newDiscard = [...discard, card];
    let newDeck = [...deck];
    
    let nextColor = chosenColor || card.color;
    let nextTurn = oppPlayerId;

    if (newHands[myPlayerId].length === 0) {
       // WIN!
       playAudio('win', sfx);
       if (onWin) onWin();
       if (setScores) {
           setScores(p => ({ ...p, uno: { ...(p.uno || {}), [userId]: (p.uno?.[userId] || 0) + 1 } }));
       }
       setGameState(prev => ({ ...prev, winner: myPlayerId, hands: newHands, discard: newDiscard }));
       return;
    }

    playAudio('place', sfx);

    // Apply effects
    if (card.value === 'skip' || card.value === 'reverse') {
       showMessage(card.value === 'skip' ? 'SKIP!' : 'REVERSE!');
       // In 2-player, reverse is skip.
       nextTurn = myPlayerId;
    } else if (card.value === 'draw2') {
       showMessage('+2 DRAW!');
       const res = drawCards(oppPlayerId, 2, newDeck, newHands);
       newDeck = res.newDeck;
       newDiscard = res.newDiscard;
       newHands[oppPlayerId] = res.newHand;
       nextTurn = myPlayerId; // skip their turn
    } else if (card.value === 'wild_draw4') {
       showMessage('+4 DRAW!');
       const res = drawCards(oppPlayerId, 4, newDeck, newHands);
       newDeck = res.newDeck;
       newDiscard = res.newDiscard;
       newHands[oppPlayerId] = res.newHand;
       nextTurn = myPlayerId; // skip their turn
    } else if (card.color === 'wild') {
       showMessage('WILD!');
    }

    // Reset Uno status if I had 1 card and drew, or update if I forgot
    let newUnoCalled = { ...unoCalled };
    if (newHands[myPlayerId].length !== 1) newUnoCalled[myPlayerId] = false;

    setGameState({
        deck: newDeck,
        discard: newDiscard,
        hands: newHands,
        turn: nextTurn,
        currentColor: nextColor,
        unoCalled: newUnoCalled,
        winner: null
    });
  };

  const handleCardClick = (card) => {
    if (!isMyTurn || winner) return;
    if (!isValidPlay(card)) {
        playAudio('error', sfx);
        return;
    }

    if (card.color === 'wild') {
        setPendingWildCard(card);
        setShowColorPicker(true);
    } else {
        playCard(card);
    }
  };

  const handleDraw = () => {
    if (!isMyTurn || winner) return;
    playAudio('click', sfx);
    
    const res = drawCards(myPlayerId, 1, deck, hands);
    let newUnoCalled = { ...unoCalled };
    newUnoCalled[myPlayerId] = false;

    setGameState(prev => ({
        ...prev,
        deck: res.newDeck,
        discard: res.newDiscard,
        hands: { ...hands, [myPlayerId]: res.newHand },
        turn: oppPlayerId,
        unoCalled: newUnoCalled
    }));
  };

  const callUno = () => {
      if (winner) return;
      if (myHand.length <= 2) {
          playAudio('success', sfx);
          showMessage('UNO!');
          setGameState(p => ({ ...p, unoCalled: { ...p.unoCalled, [myPlayerId]: true }}));
      }
  };

  const catchOpponent = () => {
      if (winner) return;
      if (oppHand.length === 1 && !unoCalled[oppPlayerId]) {
          playAudio('error', sfx);
          const res = drawCards(oppPlayerId, 2, deck, hands);
          setGameState(p => ({
              ...p,
              deck: res.newDeck,
              discard: res.newDiscard,
              hands: { ...p.hands, [oppPlayerId]: res.newHand }
          }));
      }
  };

  // AI Logic
  useEffect(() => {
      if (!gameState) return;
      if (!isMultiplayer && turn === 'ai' && !winner) {
          aiTimeoutRef.current = setTimeout(() => {
              const aiHand = hands['ai'];
              
              // Catch player forgetting Uno
              if (hands[myPlayerId].length === 1 && !unoCalled[myPlayerId]) {
                  catchOpponent();
                  return; // Will process turn next tick
              }

              // Play a card
              const valid = aiHand.filter(c => isValidPlay(c));
              if (valid.length > 0) {
                  // Heuristic: action cards first
                  valid.sort((a, b) => {
                      const aAct = isNaN(a.value) ? 1 : 0;
                      const bAct = isNaN(b.value) ? 1 : 0;
                      return bAct - aAct;
                  });
                  const cardToPlay = valid[0];
                  
                  // Call uno randomly if 2 cards left
                  let newUno = { ...unoCalled };
                  if (aiHand.length === 2 && Math.random() > 0.2) {
                      newUno['ai'] = true;
                  }

                  let chosenCol = null;
                  if (cardToPlay.color === 'wild') {
                      // pick most common color
                      const colCounts = {red:0, blue:0, green:0, yellow:0};
                      aiHand.forEach(c => { if(c.color !== 'wild') colCounts[c.color]++; });
                      chosenCol = Object.keys(colCounts).reduce((a, b) => colCounts[a] > colCounts[b] ? a : b) || 'red';
                  }

                  // Execute AI play
                  let newHands = { ...hands };
                  newHands['ai'] = aiHand.filter(c => c.id !== cardToPlay.id);
                  let newDiscard = [...discard, cardToPlay];
                  let newDeck = [...deck];
                  let nextTurn = myPlayerId;

                  if (newHands['ai'].length === 0) {
                      setGameState(p => ({ ...p, winner: 'ai', hands: newHands, discard: newDiscard }));
                      playAudio('error', sfx);
                      return;
                  }

                  if (cardToPlay.value === 'skip' || cardToPlay.value === 'reverse') {
                     nextTurn = 'ai';
                  } else if (cardToPlay.value === 'draw2') {
                     const res = drawCards(myPlayerId, 2, newDeck, newHands);
                     newDeck = res.newDeck; newDiscard = res.newDiscard; newHands[myPlayerId] = res.newHand;
                     nextTurn = 'ai'; 
                  } else if (cardToPlay.value === 'wild_draw4') {
                     const res = drawCards(myPlayerId, 4, newDeck, newHands);
                     newDeck = res.newDeck; newDiscard = res.newDiscard; newHands[myPlayerId] = res.newHand;
                     nextTurn = 'ai'; 
                  }

                  setGameState(p => ({
                      ...p, deck: newDeck, discard: newDiscard, hands: newHands, turn: nextTurn, currentColor: chosenCol || cardToPlay.color, unoCalled: newUno
                  }));
                  playAudio('place', sfx);

              } else {
                  // AI must draw
                  const res = drawCards('ai', 1, deck, hands);
                  setGameState(p => ({
                      ...p, deck: res.newDeck, discard: res.newDiscard, hands: { ...p.hands, ['ai']: res.newHand }, turn: myPlayerId
                  }));
                  playAudio('click', sfx);
              }
          }, 1500);
          return () => clearTimeout(aiTimeoutRef.current);
      }
  }, [turn, isMultiplayer, winner, deck, discard, hands, unoCalled, currentColor, myPlayerId]);

  if (!gameState) return <div className="p-8 text-center animate-pulse font-black text-xl">Shuffling...</div>;

  return (
    <RetroWindow title="retro_uno.exe" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="flex flex-col md:flex-row w-full h-[80vh] bg-[var(--bg-main)] text-[var(--text-main)] font-mono select-none overflow-hidden touch-none relative">
        
         {/* Sidebar */}
         <div className="hidden md:flex flex-col w-[250px] h-full bg-[var(--bg-window)] border-r-2 border-[var(--border)] relative z-10">
              <div className="bg-[var(--border)] px-4 py-2 text-[var(--bg-window)] font-bold tracking-widest uppercase text-sm border-b-2 border-[var(--border)]">
                  sys.log
              </div>
              <div className="flex-1 p-3 flex flex-col gap-3">
                  <div className="flex-1 border-2 border-[var(--border)] bg-[var(--bg-main)] p-2 overflow-y-auto text-xs flex flex-col gap-1 shadow-[inset_2px_2px_0_rgba(0,0,0,0.1)]">
                      <div className="font-bold opacity-80">&gt; init seq...</div>
                      <div className="font-bold opacity-80">&gt; load complete.</div>
                      <div className="font-bold text-[var(--primary)]">&gt; {actionMessage || 'awaiting action...'}</div>
                      {unoCalled[oppPlayerId] && <div className="font-bold text-[var(--primary)]">&gt; OPP CALLED UNO!</div>}
                  </div>
                  <button 
                      onClick={callUno} 
                      disabled={myHand.length > 2 || unoCalled[myPlayerId]}
                      className={`font-black text-xl py-3 retro-border-thick transition-transform uppercase ${myHand.length <= 2 && !unoCalled[myPlayerId] ? 'retro-bg-primary retro-shadow-dark active:translate-y-[2px] active:translate-x-[2px] active:shadow-none animate-pulse cursor-pointer' : 'bg-gray-400 text-white cursor-not-allowed translate-y-[2px] translate-x-[2px]'}`}
                  >
                      Call UNO!
                  </button>
              </div>
         </div>

         {/* Main Game Area */}
         <div className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-main)]">
             
             {/* Action Message Overlay */}
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[48px] sm:text-[64px] font-black text-[var(--primary)] pointer-events-none transition-all duration-200 z-[500] ${actionMessage ? 'opacity-100 scale-110 -rotate-6' : 'opacity-0 scale-90'}`} style={{ textShadow: '4px 4px 0 var(--border), -2px -2px 0 var(--bg-window), 2px -2px 0 var(--bg-window), -2px 2px 0 var(--bg-window), 2px 2px 0 var(--bg-window)' }}>
                 {actionMessage}
             </div>

             {/* Opponent Hand */}
             <div className="flex justify-center h-[120px] relative w-full perspective-[800px] opacity-90 scale-[0.75] origin-top mt-4">
                 {oppHand.map((c, i) => {
                    const totalCards = oppHand.length;
                    const maxSpread = 500; 
                    const offset = Math.min(40, maxSpread / Math.max(1, totalCards));
                    const centerIndex = (totalCards - 1) / 2;
                    const distFromCenter = i - centerIndex;
                    const angle = distFromCenter * 3;
                    const drop = Math.abs(distFromCenter) * 2;
                    return (
                        <div 
                            key={i} 
                            className="absolute"
                            style={{
                                left: `calc(50% - 43px + ${distFromCenter * offset}px)`,
                                transform: `rotate(${angle}deg) translateY(${drop}px)`,
                                zIndex: i
                            }}
                        >
                            <CardUI card={{color:'back'}} hidden={true} />
                        </div>
                    )
                 })}
             </div>

             <div className="absolute top-4 right-4 bg-[var(--bg-window)] retro-border px-3 py-1 text-xs font-bold shadow-[2px_2px_0_var(--border)]">
                 CPU: {oppHand.length}
             </div>

             {/* Center Play Area */}
             <div className="flex justify-center items-center gap-[40px] flex-1">
                  <div onClick={handleDraw} className="relative cursor-pointer hover:-translate-y-2 active:translate-y-0 transition-transform after:content-['DRAW'] after:absolute after:-bottom-6 after:left-1/2 after:-translate-x-1/2 after:w-full after:text-center after:font-bold after:bg-[var(--border)] after:text-[var(--bg-window)] after:border-2 after:border-[var(--border)] after:text-[12px]">
                      <div className="relative">
                         <CardUI card={{color:'back'}} hidden={true} className="shadow-[4px_4px_0_rgba(0,0,0,0.3)] z-[2]" />
                         <CardUI card={{color:'back'}} hidden={true} className="absolute top-1 left-1 z-[1]" />
                      </div>
                  </div>

                  <div className="relative">
                      {discard.length > 0 && (
                         <CardUI card={discard[discard.length - 1]} className="rotate-[4deg]" />
                      )}
                      <div className={`absolute -bottom-6 left-0 w-full h-[10px] retro-border-thick retro-shadow-dark ${getCardColorClass(currentColor)}`}></div>
                  </div>
             </div>

             {/* Turn Indicator */}
             <div className={`absolute left-[20px] font-bold bg-[var(--bg-window)] retro-border-thick px-[15px] py-[8px] text-[16px] retro-shadow-dark transition-all duration-400 z-10 uppercase ${isMyTurn ? 'bottom-[150px] border-[var(--primary)]' : 'top-[150px] border-[var(--border)]'}`}>
                 {isMyTurn ? 'Your Turn' : 'CPU Processing...'}
             </div>

             {/* My Hand */}
             <div className="flex justify-center h-[140px] relative w-full perspective-[800px] mb-4">
                {myHand.map((c, i) => {
                    const valid = isValidPlay(c);
                    const totalCards = myHand.length;
                    const maxSpread = 600; 
                    const offset = Math.min(45, maxSpread / Math.max(1, totalCards));
                    const centerIndex = (totalCards - 1) / 2;
                    const distFromCenter = i - centerIndex;
                    const angle = distFromCenter * 3;
                    const drop = Math.abs(distFromCenter) * 2;

                    return (
                        <div 
                            key={c.id} 
                            className={`absolute transition-all duration-300 ${!valid && isMyTurn ? 'opacity-70 grayscale cursor-not-allowed' : ''}`}
                            style={{
                                left: `calc(50% - 43px + ${distFromCenter * offset}px)`,
                                transform: `rotate(${angle}deg) translateY(${drop}px)`,
                                zIndex: i
                            }}
                        >
                            <CardUI card={c} onClick={() => valid && handleCardClick(c)} />
                        </div>
                    )
                })}
             </div>
             
             {/* Mobile Call UNO button */}
             <div className="md:hidden absolute bottom-4 right-4 z-[50]">
                 {myHand.length <= 2 && !unoCalled[myPlayerId] && (
                     <button onClick={callUno} className="retro-bg-primary retro-border-thick retro-shadow-dark font-black px-4 py-2 animate-pulse active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">UNO!</button>
                 )}
             </div>

         </div>

         {/* Color Picker Modal */}
         {showColorPicker && (
              <div className="absolute inset-0 bg-black/60 z-[1000] flex justify-center items-center backdrop-blur-sm">
                  <div className="bg-[var(--bg-window)] retro-border-thick p-[20px] sm:p-[30px] retro-shadow-dark max-w-[350px] w-[90%] text-center">
                      <h2 className="text-[20px] sm:text-[24px] font-black uppercase mb-[20px] text-[var(--text-main)]">Select Color</h2>
                      <div className="grid grid-cols-2 gap-[10px]">
                          {COLORS.map(c => (
                              <button key={c} onClick={() => { playCard(pendingWildCard, c); setShowColorPicker(false); setPendingWildCard(null); }} className={`h-[60px] sm:h-[80px] retro-border-thick font-bold text-[18px] uppercase flex justify-center items-center retro-shadow-dark active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all ${getCardColorClass(c)}`}>
                                  {c}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
         )}

         {/* Outcome Modal */}
         {winner && (
            <ShareOutcomeOverlay
              outcome={winner === myPlayerId ? 'win' : 'loss'}
              score={`Cards Left: You(${myHand.length}) vs Opp(${oppHand.length})`}
              gameName="Retro Uno"
              onClose={() => onBack()}
            />
         )}
      </div>
    </RetroWindow>
  );
}
