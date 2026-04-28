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
    case 'red': return 'bg-red-500 border-red-700';
    case 'blue': return 'bg-blue-500 border-blue-700';
    case 'green': return 'bg-green-500 border-green-700';
    case 'yellow': return 'bg-yellow-400 border-yellow-600';
    default: return 'bg-gray-800 border-gray-900'; // Wild
  }
};

const CardUI = ({ card, onClick, className = "", hidden = false }) => {
  if (hidden) {
    return (
      <div className={`w-16 h-24 sm:w-20 sm:h-32 bg-black retro-border border-[4px] rounded-sm flex items-center justify-center retro-shadow-dark ${className}`}>
        <div className="w-[80%] h-[80%] border-2 border-red-500 rounded-full flex items-center justify-center rotate-45 bg-red-600">
           <span className="font-black text-white italic text-xs -rotate-45 drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">UNO</span>
        </div>
      </div>
    );
  }

  const isWild = card.color === 'wild';
  const displayVal = card.value === 'skip' ? '⊘' : card.value === 'reverse' ? '⇄' : card.value === 'draw2' ? '+2' : card.value === 'wild' ? 'W' : card.value === 'wild_draw4' ? '+4' : card.value;

  return (
    <div 
      onClick={onClick}
      className={`w-16 h-24 sm:w-20 sm:h-32 ${getCardColorClass(card.color)} border-[4px] rounded-sm flex flex-col relative select-none retro-shadow-dark ${onClick ? 'cursor-pointer hover:-translate-y-2 hover:z-10 transition-transform' : ''} ${className}`}
    >
      <div className="absolute top-1 left-1 font-black text-white text-[10px] sm:text-xs drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)] leading-none">{displayVal}</div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-[70%] h-[70%] bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30 rotate-12">
           <span className={`font-black text-white ${displayVal.length > 1 ? 'text-sm sm:text-lg' : 'text-xl sm:text-3xl'} drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)] -rotate-12`}>{displayVal}</span>
        </div>
      </div>
      <div className="absolute bottom-1 right-1 font-black text-white text-[10px] sm:text-xs drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)] leading-none rotate-180">{displayVal}</div>
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
    <RetroWindow title="retro_uno.exe" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="flex flex-col items-center justify-between p-4 min-h-[70vh] bg-green-800 retro-border-thick relative overflow-hidden">
        
        {/* Opponent Hand */}
        <div className="flex justify-center -space-x-12 sm:-space-x-16 mb-4 scale-75 sm:scale-100 origin-top">
           {oppHand.map((c, i) => (
               <CardUI key={i} card={c} hidden={true} />
           ))}
        </div>
        
        <div className="flex w-full justify-between px-4 absolute top-4 left-0">
             <div className="bg-black/50 text-white font-bold text-[10px] px-2 py-1 retro-border uppercase">{isMultiplayer ? 'Partner' : 'AI'} : {oppHand.length} cards</div>
             {oppHand.length === 1 && !unoCalled[oppPlayerId] && !winner && (
                 <button onClick={catchOpponent} className="bg-red-500 text-white font-black text-xs px-2 py-1 retro-border retro-shadow-dark animate-pulse hover:scale-110">CATCH UNO!</button>
             )}
             {unoCalled[oppPlayerId] && <div className="bg-yellow-400 text-black font-black text-xs px-2 py-1 retro-border">UNO!</div>}
        </div>

        {/* Center Play Area */}
        <div className="flex items-center gap-8 my-8 relative">
           {/* Deck */}
           <div className="relative cursor-pointer hover:-translate-y-1 transition-transform" onClick={handleDraw}>
               {deck.length > 0 && <CardUI card={deck[0]} hidden={true} className="shadow-[4px_4px_0_0_rgba(0,0,0,0.8)]" />}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-black/80 text-white text-[10px] font-black px-2 py-1 uppercase retro-border">Draw</span>
               </div>
           </div>

           {/* Discard */}
           <div className="relative">
               {discard.slice(Math.max(0, discard.length - 3)).map((c, i) => (
                   <CardUI key={c.id} card={c} className={i !== discard.length - 1 ? 'absolute top-0 left-0 opacity-50 rotate-6 scale-95' : 'relative z-10'} />
               ))}
               <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-2 ${getCardColorClass(currentColor)} border-2 border-black`}></div>
           </div>
        </div>

        {/* Status / Color Picker Overlay */}
        {showColorPicker && (
            <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
                <h3 className="text-white font-black text-xl uppercase mb-4 retro-text-shadow">Choose Color</h3>
                <div className="grid grid-cols-2 gap-4">
                    {COLORS.map(c => (
                        <button key={c} onClick={() => { playCard(pendingWildCard, c); setShowColorPicker(false); setPendingWildCard(null); }} className={`w-16 h-16 ${getCardColorClass(c)} retro-border retro-shadow-dark hover:scale-110 active:scale-95`}></button>
                    ))}
                </div>
            </div>
        )}

        {/* Turn Indicator */}
        <div className={`font-black uppercase tracking-widest px-4 py-2 mb-4 retro-border shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] ${isMyTurn ? 'bg-white text-black' : 'bg-black/50 text-white'}`}>
            {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
        </div>

        <div className="flex w-full justify-between px-4 absolute bottom-4 left-0 pointer-events-none z-20">
             <div className="bg-black/50 text-white font-bold text-[10px] px-2 py-1 retro-border uppercase pointer-events-auto">You : {myHand.length} cards</div>
             {myHand.length <= 2 && !unoCalled[myPlayerId] && (
                 <button onClick={callUno} className="bg-red-600 text-white font-black text-xl px-4 py-2 retro-border retro-shadow-dark animate-pulse hover:scale-110 pointer-events-auto shadow-[0_0_15px_red]">UNO!</button>
             )}
             {unoCalled[myPlayerId] && <div className="bg-yellow-400 text-black font-black text-xs px-2 py-1 retro-border pointer-events-auto">UNO!</div>}
        </div>

        {/* My Hand */}
        <div className="flex justify-center -space-x-10 sm:-space-x-8 mt-auto scale-90 sm:scale-100 origin-bottom flex-wrap px-4 pb-12 w-full max-w-4xl">
           {myHand.map((c, i) => {
               const valid = isValidPlay(c);
               return (
                   <div key={c.id} className={`${!valid && isMyTurn ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}>
                       <CardUI card={c} onClick={() => handleCardClick(c)} />
                   </div>
               )
           })}
        </div>

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
