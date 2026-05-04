import React, { useState, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { Heart, Camera, HelpCircle, Check, X, RefreshCw, Image as ImageIcon, LineChart } from 'lucide-react';

const QUIZ_QUESTIONS = {
   random: ["What is my favorite color?", "What food do I hate the most?", "What is my dream vacation destination?", "What's my go-to fast food order?", "What song always gets me dancing?", "Who is my celebrity crush?"],
   deep: ["What is my biggest fear?", "When did I know I loved you?", "What is my happiest childhood memory?", "What is a trait I admire most in you?", "What always cheers me up when I'm sad?", "What is my ultimate career goal?"],
   funny: ["What is my most embarrassing habit?", "If I were an animal, what would I be?", "Who would play me in a movie?", "What is my weirdest quirk?", "What irrational thing makes me angry?", "What meme represents my life?"],
   spicy: ["What is my favorite physical feature of yours?", "Where is the craziest place we've done it?", "What is my secret fantasy?", "What outfit of yours do I love the most?", "What's my favorite way to be touched?", "What do I think is your sexiest quality?"]
};

export function CouplesQuiz({ onBack, sfx, onWin, onShareToChat, onSaveToScrapbook }) {
  const [history, setHistory] = useLocalStorage('quiz_history', []);
  
  const [view, setView] = useState('menu'); // menu, setup, history, p1, intro_p2, p2, grading, result
  const [bgImage, setBgImage] = useState(null);
  const [category, setCategory] = useState('random');
  const [wager, setWager] = useState('Loser pays for dinner!');
  
  const [questions, setQuestions] = useState([]);
  const [p1Answers, setP1Answers] = useState([]);
  const [p2Answers, setP2Answers] = useState([]);
  const [judgments, setJudgments] = useState([]); // true/false
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  
  const [lifelineUsed, setLifelineUsed] = useState(false);
  const [lifelineMsg, setLifelineMsg] = useState('');

  const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => setBgImage(evt.target.result);
          reader.readAsDataURL(file);
      }
  };

  const startP1 = () => {
      playAudio('click', sfx);
      let pool = [...QUIZ_QUESTIONS[category]].sort(()=>Math.random()-0.5).slice(0, 5);
      setQuestions(pool);
      setP1Answers([]);
      setCurrentIndex(0);
      setCurrentInput('');
      setView('p1');
  };

  const submitP1Answer = (e) => {
      e.preventDefault();
      if (!currentInput.trim()) return;
      playAudio('click', sfx);
      const newAns = [...p1Answers, currentInput];
      setP1Answers(newAns);
      if (newAns.length >= questions.length) { setView('intro_p2'); }
      else { setCurrentIndex(c => c+1); }
      setCurrentInput('');
  };

  const skipQuestion = () => {
      playAudio('click', sfx);
      const newPool = [...questions];
      const remaining = QUIZ_QUESTIONS[category].filter(q => !newPool.includes(q));
      if (remaining.length > 0) newPool[currentIndex] = remaining[Math.floor(Math.random()*remaining.length)];
      setQuestions(newPool);
  };

  const startP2 = () => {
      playAudio('click', sfx);
      setCurrentIndex(0);
      setCurrentInput('');
      setP2Answers([]);
      setView('p2');
  };

  const submitP2Answer = (e) => {
      e.preventDefault();
      if (!currentInput.trim()) return;
      playAudio('click', sfx);
      const newAns = [...p2Answers, currentInput];
      setP2Answers(newAns);
      if (newAns.length >= questions.length) { setView('grading'); setCurrentIndex(0); }
      else { setCurrentIndex(c => c+1); }
      setCurrentInput('');
      setLifelineMsg('');
  };

  const useLifeline = () => {
      if (lifelineUsed) return;
      playAudio('click', sfx);
      setLifelineUsed(true);
      const fakePercentages = [42, 69, 88, 12, 99, 50, 5];
      const p = fakePercentages[Math.floor(Math.random()*fakePercentages.length)];
      setLifelineMsg(`Audience says... we are ${p}% sure you should know this!`);
  };

  const gradeAnswer = (isMatch) => {
      playAudio('click', sfx);
      const newJ = [...judgments, isMatch];
      setJudgments(newJ);
      if (newJ.length >= questions.length) {
          const score = newJ.filter(Boolean).length;
          setHistory(h => [{ date: new Date().toISOString(), category, wager, score, maxScore: questions.length }, ...h]);
          if (score >= Math.ceil(questions.length/2)) onWin();
          setView('result');
      } else {
          setCurrentIndex(c => c+1);
      }
  };

  // --- Views ---

  if (view === 'menu') {
      return (
        <RetroWindow title="quiz_menu.exe" className="w-full max-w-sm h-auto" onClose={onBack}>
          <div className="flex flex-col items-center p-4">
              <Heart size={48} className="text-[#ffb6b9] animate-pulse mb-4"/>
              <h2 className="text-2xl font-bold mb-6 tracking-widest uppercase">Couples Quiz</h2>
              <div className="w-full space-y-3">
                  <RetroButton variant="primary" onClick={()=>{playAudio('click',sfx); setView('setup')}} className="w-full py-4 text-lg border-2">Start New Quiz</RetroButton>
                  <RetroButton variant="white" onClick={()=>{playAudio('click',sfx); setView('history')}} className="w-full py-3 opacity-80"><LineChart size={16} className="inline mr-2"/>View History</RetroButton>
              </div>
          </div>
        </RetroWindow>
      );
  }

  if (view === 'history') {
      return (
        <RetroWindow title="quiz_history.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px] flex flex-col" onClose={() => setView('menu')}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-window)]">
             {history.length === 0 ? <div className="text-center opacity-50 mt-10">No quizzes taken yet!</div> :
               history.map((h, i) => (
                   <div key={i} className="retro-border p-3 retro-shadow-sm bg-white relative">
                       {h.score === h.maxScore && <div className="absolute top-2 right-2 text-3xl rotate-12 drop-shadow-md">💯</div>}
                       <div className="font-bold text-[var(--primary)] uppercase text-sm mb-1">{h.category}</div>
                       <div className="text-xs opacity-70 mb-2">{new Date(h.date).toLocaleDateString()}</div>
                       <div className="font-bold text-lg mb-1">Score: {h.score} / {h.maxScore}</div>
                       <div className="text-xs bg-yellow-100 p-1 border-l-2 border-yellow-400">Wager: {h.wager || 'None'}</div>
                   </div>
               ))
             }
          </div>
        </RetroWindow>
      );
  }

  if (view === 'setup') {
      return (
        <RetroWindow title="quiz_setup.exe" className="w-full max-w-md h-auto" onClose={() => setView('menu')}>
          <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold border-b border-black/10 pb-2">Quiz Setup</h2>
              
              <div>
                  <label className="font-bold opacity-70 block mb-2 text-sm">Theme Category</label>
                  <div className="grid grid-cols-2 gap-2">
                     {Object.keys(QUIZ_QUESTIONS).map(c => (
                         <RetroButton key={c} variant={category === c ? 'primary' : 'white'} onClick={()=>{playAudio('click',sfx); setCategory(c)}} className="py-2 text-sm uppercase">{c}</RetroButton>
                     ))}
                  </div>
              </div>

              <div>
                  <label className="font-bold opacity-70 block mb-2 text-sm mt-2">What are the Stakes? (Wager)</label>
                  <input type="text" value={wager} onChange={(e)=>setWager(e.target.value)} placeholder="Winner gets..." className="w-full p-2 retro-border font-bold text-sm focus:outline-none focus:ring-2" />
              </div>

              <div>
                  <label className="font-bold opacity-70 block mb-2 text-sm mt-2 flex justify-between">
                     <span>Custom Background <span className="opacity-50 font-normal">(Optional)</span></span>
                  </label>
                  <label className="w-full py-3 retro-border retro-bg-secondary flex justify-center items-center gap-2 cursor-pointer hover:opacity-80 active:translate-y-px retro-shadow-dark font-bold text-sm text-[var(--text-main)]">
                      <ImageIcon size={16}/> {bgImage ? 'Image Loaded!' : 'Upload Image'}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
              </div>

              <RetroButton variant="accent" onClick={startP1} className="w-full py-4 text-lg mt-4 shadow-xl">Continue to P1</RetroButton>
          </div>
        </RetroWindow>
      );
  }

  // Common wrapper for answering phases
  const PhaseWrapper = ({ children }) => (
    <RetroWindow title={`quiz_${view}.exe`} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[700px] flex flex-col relative" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
          {bgImage && <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'grayscale(50%)'}}></div>}
          <div className="relative z-10 flex flex-col h-full bg-white/70 backdrop-blur-sm">
             {children}
          </div>
      </RetroWindow>
  );

  if (view === 'p1') {
      return (
          <PhaseWrapper>
              <div className="bg-[var(--primary)] text-white p-3 font-bold text-center border-b-[3px] border-black flex justify-between px-4">
                  <span>Player 1: Set the Answers!</span>
                  <span>{currentIndex+1} / 5</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <h3 className="text-2xl sm:text-3xl font-bold mb-8 italic text-gray-800 tracking-tight leading-tight">"{questions[currentIndex]}"</h3>
                  <form onSubmit={submitP1Answer} className="w-full max-w-md">
                      <input type="text" value={currentInput} onChange={e=>setCurrentInput(e.target.value)} placeholder="Type your answer..." className="w-full p-4 mb-4 retro-border text-center font-bold text-xl drop-shadow-sm focus:outline-none focus:ring-4 focus:ring-[var(--primary)]" autoFocus />
                      <RetroButton type="submit" variant="primary" className="w-full py-3 text-lg mb-4">Lock Answer</RetroButton>
                      <button type="button" onClick={skipQuestion} className="opacity-50 hover:opacity-100 font-bold text-xs uppercase underline"><RefreshCw size={12} className="inline"/> Switch Question</button>
                  </form>
              </div>
          </PhaseWrapper>
      );
  }

  if (view === 'intro_p2') {
      return (
          <PhaseWrapper>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-50">
                  <div className="text-6xl mb-6">🤫</div>
                  <h2 className="text-3xl font-bold mb-4 uppercase text-[#ff8a8f] border-b-4 border-dashed pb-2 border-[#ff8a8f]">Hand Device to Player 2</h2>
                  <p className="font-bold opacity-70 mb-8 max-w-sm">No cheating! It's time to see how well you actually know your partner.</p>
                  <RetroButton variant="accent" onClick={startP2} className="px-8 py-4 text-xl shadow-xl animate-pulse">I am Player 2. Start!</RetroButton>
              </div>
          </PhaseWrapper>
      );
  }

  if (view === 'p2') {
       return (
          <PhaseWrapper>
              <div className="bg-[var(--secondary)] text-white p-3 font-bold text-center border-b-[3px] border-black flex justify-between px-4">
                  <span>Player 2: Guess the Answers!</span>
                  <span>{currentIndex+1} / 5</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
                  {lifelineMsg && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-300 text-black font-bold p-2 px-4 shadow-lg border-2 border-black -rotate-2 z-50 animate-in zoom-in">{lifelineMsg}</div>}
                  
                  <h3 className="text-2xl sm:text-3xl font-bold mb-8 italic text-gray-800 tracking-tight leading-tight">"{questions[currentIndex]}"</h3>
                  <form onSubmit={submitP2Answer} className="w-full max-w-md">
                      <input type="text" value={currentInput} onChange={e=>setCurrentInput(e.target.value)} placeholder="Type your guess..." className="w-full p-4 mb-4 retro-border text-center font-bold text-xl drop-shadow-sm focus:outline-none focus:ring-4 focus:ring-[var(--secondary)]" autoFocus />
                      <RetroButton type="submit" variant="secondary" className="w-full py-3 text-lg mb-4">Submit Guess</RetroButton>
                      <button type="button" onClick={useLifeline} disabled={lifelineUsed} className={`font-bold text-sm uppercase px-4 py-2 border-2 border-dashed ${lifelineUsed?'opacity-30 border-gray-400 text-gray-400':'border-yellow-500 text-yellow-600 bg-yellow-50 hover:bg-yellow-100'} transition-colors`}><HelpCircle size={14} className="inline mr-1"/> Fake Lifeline</button>
                  </form>
              </div>
          </PhaseWrapper>
      );
  }

  if (view === 'grading') {
       return (
          <PhaseWrapper>
              <div className="bg-[var(--accent)] text-[var(--border)] p-3 font-bold text-center border-b-[3px] border-black">
                  Grading Phase - You decide if it's right!
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/80">
                  <h3 className="text-xl sm:text-2xl font-bold mb-8 text-center italic opacity-80 border-b border-black/10 pb-4 max-w-lg w-full">"{questions[currentIndex]}"</h3>
                  
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full max-w-lg mb-8 items-stretch">
                      <div className="flex-1 bg-white retro-border p-4 text-center relative shadow-sm">
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-white text-xs font-bold px-2 py-1 uppercase rounded-full">P1's Answer</div>
                          <div className="mt-4 text-xl sm:text-2xl font-bold text-[var(--primary-hover)]">{p1Answers[currentIndex]}</div>
                      </div>
                      <div className="flex justify-center items-center text-4xl text-gray-300 font-bold hidden sm:flex">VS</div>
                      <div className="flex-1 bg-white retro-border p-4 text-center relative shadow-sm">
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--secondary)] text-white text-xs font-bold px-2 py-1 uppercase rounded-full">P2's Guess</div>
                          <div className="mt-4 text-xl sm:text-2xl font-bold text-[var(--secondary)]">{p2Answers[currentIndex]}</div>
                      </div>
                  </div>

                  <div className="flex gap-4 w-full max-w-sm">
                      <RetroButton variant="primary" onClick={()=>gradeAnswer(true)} className="flex-1 py-4 flex flex-col items-center gap-1 hover:bg-green-500"><Check size={24}/> Match!</RetroButton>
                      <RetroButton variant="white" onClick={()=>gradeAnswer(false)} className="flex-1 py-4 flex flex-col items-center gap-1 hover:bg-red-500 hover:text-white border-2"><X size={24}/> Nope</RetroButton>
                  </div>
              </div>
          </PhaseWrapper>
      );
  }

  if (view === 'result') {
      const score = judgments.filter(Boolean).length;
      return ( <ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")} partnerNickname={(typeof config !== "undefined" && config?.mode === "vs_ai") || (typeof mode !== "undefined" && mode === "vs_ai") || (typeof gameMode !== "undefined" && gameMode === "vs_ai") ? "AI" : undefined} gameName={`Couples Quiz`} stats={{"Category": category, "Final Score": `${score} / 5`, "Stakes": wager, "P1": "Grader", "P2": "Guesser"}} onClose={() => {setView('menu')}} onRematch={() => {setView('setup')}} onShareToChat={onShareToChat} onSaveToScrapbook={onSaveToScrapbook} sfx={sfx} /> );
  }

  return null;
}
