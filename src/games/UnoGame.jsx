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
    case 'red': return 'bg-[#d6444f]';
    case 'blue': return 'bg-[#4465e3]';
    case 'green': return 'bg-[#529959]';
    case 'yellow': return 'bg-[#f4d775]';
    default: return 'bg-[#392b23]'; // Wild
  }
};

const CardUI = ({ card, onClick, className = "", hidden = false }) => {
  if (hidden || card.color === 'back') {
    return (
      <div className={`w-[60px] h-[90px] sm:w-[86px] sm:h-[128px] border-[3px] border-[#392b23] rounded-[6px] bg-[#d6444f] flex items-center justify-center relative shadow-[-3px_4px_0_rgba(57,43,35,0.25)] ${className}`} style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, #392b23 12px, #392b23 16px)' }}>
      </div>
    );
  }

  const isWild = card.color === 'wild';
  const displayVal = card.value === 'skip' ? 'Ø' : card.value === 'reverse' ? '⇄' : card.value === 'draw2' ? '+2' : card.value === 'wild' ? 'W' : card.value === 'wild_draw4' ? '+4' : card.value;

  const innerStyle = isWild ? {
      background: 'conic-gradient(#d6444f 90deg, #4465e3 90deg 180deg, #f4d775 180deg 270deg, #529959 270deg)',
      color: 'white',
      textShadow: '2px 2px 0 #392b23'
  } : {};

  return (
    <div 
      onClick={onClick}
      className={`w-[60px] h-[90px] sm:w-[86px] sm:h-[128px] border-[3px] border-[#392b23] rounded-[6px] flex flex-col justify-center items-center relative select-none shadow-[-3px_4px_0_rgba(57,43,35,0.25)] ${getCardColorClass(card.color)} ${onClick ? 'cursor-pointer hover:-translate-y-5 hover:scale-110 hover:shadow-[-6px_10px_0_rgba(57,43,35,0.4)] hover:z-[100] hover:border-[#fcfcf2] transition-all' : ''} ${className}`}
    >
      <div className="w-[72%] h-[62%] bg-[#fcfcf2] border-[3px] border-[#392b23] flex justify-center items-center text-[22px] sm:text-[36px] font-bold text-[#392b23] rounded-[4px]" style={innerStyle}>
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
  
  const aiTimeoutRef = useRef(null);

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
       // In 2-player, reverse is skip.
       nextTurn = myPlayerId;
    } else if (card.value === 'draw2') {
       const res = drawCards(oppPlayerId, 2, newDeck, newHands);
       newDeck = res.newDeck;
       newDiscard = res.newDiscard;
       newHands[oppPlayerId] = res.newHand;
       nextTurn = myPlayerId; // skip their turn
    } else if (card.value === 'wild_draw4') {
       const res = drawCards(oppPlayerId, 4, newDeck, newHands);
       newDeck = res.newDeck;
       newDiscard = res.newDiscard;
       newHands[oppPlayerId] = res.newHand;
       nextTurn = myPlayerId; // skip their turn
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
    <div className="fixed inset-0 w-full h-full flex flex-col md:flex-row justify-center items-center p-2 sm:p-5 gap-2 sm:gap-5 bg-[#faeed9] bg-pattern-grid text-[#392b23] z-[100] font-mono select-none overflow-hidden touch-none">

       {/* Sidebar */}
       <div className="hidden md:flex flex-col w-[280px] h-[90vh] bg-[#fcfcf2] border-[4px] border-[#392b23] shadow-[8px_8px_0_rgba(57,43,35,0.15)] relative">
            <div className="bg-[#d6444f] border-b-[4px] border-[#392b23] px-4 py-2 text-[#fcfcf2] font-bold tracking-widest text-base">
                📋 sys.log
            </div>
            <div className="flex-1 p-[15px] bg-[#fcfcf2] flex flex-col gap-4">
                <div className="flex-1 border-[3px] border-[#392b23] bg-[#e3dec6] p-[10px] overflow-y-auto text-[13px] shadow-[inset_3px_3px_0_rgba(57,43,35,0.1)] flex flex-col gap-[6px]">
                    <div className="text-[#8c4b38] font-bold">&gt; system initialized.</div>
                    <div className="text-[#8c4b38] font-bold">&gt; waiting for boot...</div>
                    <div className="text-[#8c4b38] font-bold">&gt; {message || 'Game started.'}</div>
                    {unoCalled[oppPlayerId] && <div className="text-[#d6444f] font-bold">&gt; CPU/OPP called UNO!</div>}
                </div>
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={callUno} 
                        disabled={myHand.length > 2 || unoCalled[myPlayerId]}
                        className={`font-black text-[24px] py-[15px] border-[3px] border-[#392b23] transition-all uppercase ${myHand.length <= 2 && !unoCalled[myPlayerId] ? 'bg-[#d6444f] text-white shadow-[4px_4px_0_#392b23] active:translate-y-[4px] active:translate-x-[4px] active:shadow-[0_0_0_#392b23] animate-pulse cursor-pointer' : 'bg-[#999] text-white/50 translate-y-[4px] translate-x-[4px] shadow-[0_0_0_#392b23] cursor-not-allowed'}`}
                    >
                        Call UNO!
                    </button>
                </div>
            </div>
       </div>

       {/* Main Game Window */}
       <div className="flex-1 w-full max-w-[900px] h-[85vh] sm:h-[90vh] bg-[#fcfcf2] border-[4px] border-[#392b23] shadow-[8px_8px_0_rgba(57,43,35,0.15)] flex flex-col relative">
           {/* Title Bar */}
           <div className="bg-[#d6444f] border-b-[4px] border-[#392b23] px-4 py-2 flex justify-between items-center font-bold text-[#fcfcf2] tracking-widest text-[16px]">
               <div className="flex items-center gap-3">
                   <span className="text-[18px] leading-none">≡</span> 
                   <span>uno_os_v2.exe</span>
               </div>
               <button onClick={onBack} className="bg-[#f4d775] text-[#392b23] border-[3px] border-[#392b23] px-[15px] py-[6px] text-[16px] font-bold shadow-[4px_4px_0_#392b23] active:translate-y-[4px] active:translate-x-[4px] active:shadow-[0_0_0_#392b23] transition-all cursor-pointer uppercase">
                   reset
               </button>
           </div>
           
           {/* Window Content (Game Area) */}
           <div className="flex-1 flex flex-col justify-between bg-[#e3dec6] p-[20px] relative overflow-hidden h-[calc(100%-40px)]">
               
               {/* Opponent Hand */}
               <div className="flex justify-center h-[120px] relative w-full perspective-[800px] opacity-90 scale-[0.8] origin-top">
                   {oppHand.map((c, i) => {
                      const totalCards = oppHand.length;
                      const maxSpread = 600; 
                      const offset = Math.min(45, maxSpread / Math.max(1, totalCards));
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

               {/* Center Play Area */}
               <div className="flex justify-center items-center gap-[60px] flex-1 mt-8 mb-8">
                    <div onClick={handleDraw} className="relative cursor-pointer hover:scale-95 active:scale-90 transition-transform after:content-['DRAW'] after:absolute after:-bottom-8 after:left-1/2 after:-translate-x-1/2 after:w-full after:text-center after:font-bold after:bg-[#392b23] after:text-[#fcfcf2] after:border-[2px] after:border-[#392b23] after:py-[2px] after:text-[16px]">
                        <div className="relative">
                           <CardUI card={{color:'back'}} hidden={true} className="shadow-[4px_4px_0_rgba(0,0,0,0.5)] z-[2]" />
                           <CardUI card={{color:'back'}} hidden={true} className="absolute top-1 left-1 z-[1]" />
                        </div>
                    </div>

                    <div className="relative">
                        {discard.length > 0 && (
                           <CardUI card={discard[discard.length - 1]} className="rotate-[5deg]" />
                        )}
                        <div className={`absolute -bottom-8 left-0 w-full h-[14px] border-[3px] border-[#392b23] shadow-[2px_2px_0_rgba(57,43,35,0.2)] ${getCardColorClass(currentColor)}`}></div>
                    </div>
               </div>

               {/* Turn Indicator */}
               <div className={`absolute left-[20px] font-bold bg-[#fcfcf2] border-[4px] border-[#392b23] px-[20px] py-[10px] text-[20px] shadow-[4px_4px_0_#392b23] transition-all duration-400 z-10 ${isMyTurn ? 'bottom-[180px] border-[#4465e3]' : 'top-[180px] border-[#d6444f]'}`}>
                   {isMyTurn ? 'YOUR.TURN.exe' : 'CPU.PROCESSING...'}
               </div>

               {/* Action Message Overlay */}
               <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[64px] font-black text-[#d6444f] pointer-events-none transition-all duration-200 z-[500] ${message ? 'opacity-100 scale-110 -rotate-6' : 'opacity-0 scale-90'}`} style={{ textShadow: '5px 5px 0 #392b23, -2px -2px 0 #fcfcf2, 2px -2px 0 #fcfcf2, -2px 2px 0 #fcfcf2, 2px 2px 0 #fcfcf2' }}>
                   {message}
               </div>

               {/* My Hand */}
               <div className="flex justify-center h-[150px] relative w-full perspective-[800px] mt-auto">
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
                       <button onClick={callUno} className="bg-[#d6444f] text-[#fcfcf2] font-black px-4 py-2 border-[3px] border-[#392b23] shadow-[4px_4px_0_#392b23] animate-pulse active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all">UNO!</button>
                   )}
               </div>

           </div>
       </div>

       {/* Color Picker Modal */}
       {showColorPicker && (
            <div className="absolute inset-0 bg-[#392b23]/70 z-[1000] flex justify-center items-center">
                <div className="bg-[#fcfcf2] border-[5px] border-[#392b23] p-[30px] shadow-[10px_10px_0_#392b23] max-w-[400px] w-[90%] text-center">
                    <h2 className="text-[28px] font-black uppercase mb-[25px]">Select Override Color</h2>
                    <div className="grid grid-cols-2 gap-[15px]">
                        {COLORS.map(c => (
                            <button key={c} onClick={() => { playCard(pendingWildCard, c); setShowColorPicker(false); setPendingWildCard(null); }} className={`h-[80px] border-[4px] border-[#392b23] font-bold text-[20px] uppercase flex justify-center items-center shadow-[4px_4px_0_#392b23] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all ${getCardColorClass(c)} ${c === 'yellow' ? 'text-[#392b23]' : 'text-white'}`}>
                                {c === 'blue' ? 'BLU' : c === 'green' ? 'GRN' : c === 'yellow' ? 'YLW' : 'RED'}
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
            gameName="Uno OS v2"
            onClose={() => onBack()}
          />
       )}
    </div>
  );
}
