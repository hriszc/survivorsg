import React, { useEffect, useRef, useState } from 'react';
import { Engine } from './game/Engine';
import { WEAPON_TYPES, Weapon } from './game/Weapons';
import { Skull, Trophy, Zap, Heart, Clock } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'levelup' | 'gameover'>('menu');
  
  // UI State
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [exp, setExp] = useState(0);
  const [expToNext, setExpToNext] = useState(10);
  const [level, setLevel] = useState(1);
  const [time, setTime] = useState(0);
  
  const [choices, setChoices] = useState<any[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const eng = new Engine(
      canvasRef.current,
      () => setGameState('levelup'),
      () => setGameState('gameover')
    );
    setEngine(eng);
    
    return () => eng.stop();
  }, []);

  // Update UI loop
  useEffect(() => {
    if (gameState !== 'playing' || !engine) return;
    
    const interval = setInterval(() => {
      setHp(engine.player.hp);
      setMaxHp(engine.player.maxHp);
      setExp(engine.player.exp);
      setExpToNext(engine.player.expToNextLevel);
      setLevel(engine.player.level);
      setTime(Math.floor(engine.gameTime));
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameState, engine]);

  useEffect(() => {
    if (gameState === 'levelup' && engine) {
      // Generate 3 random weapon choices
      const available = [...WEAPON_TYPES];
      const selected = [];
      for(let i=0; i<3; i++) {
        if(available.length === 0) break;
        const idx = Math.floor(Math.random() * available.length);
        const WeaponClass = available.splice(idx, 1)[0];
        
        // Check if player has it
        const existing = engine.weapons.find(w => w instanceof WeaponClass);
        if (existing) {
          selected.push({ type: 'upgrade', weapon: existing, class: WeaponClass });
        } else {
          const temp = new WeaponClass();
          selected.push({ type: 'new', weapon: temp, class: WeaponClass });
        }
      }
      setChoices(selected);
    }
  }, [gameState, engine]);

  const startGame = () => {
    if (engine) {
      // Reset state
      engine.player.hp = engine.player.maxHp;
      engine.player.exp = 0;
      engine.player.level = 1;
      engine.player.expToNextLevel = 10;
      engine.gameTime = 0;
      engine.snakes = [];
      engine.gems = [];
      engine.particles = [];
      engine.damageNumbers = [];
      engine.weapons = [new WEAPON_TYPES[0]()]; // Start with Magic Wand
      engine.isGameOver = false;
      engine.isPaused = false;
      engine.start();
      setGameState('playing');
    }
  };

  const handleChoice = (choice: any) => {
    if (!engine) return;
    
    if (choice.type === 'upgrade') {
      choice.weapon.levelUp();
    } else {
      engine.weapons.push(new choice.class());
    }
    
    engine.isPaused = false;
    setGameState('playing');
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900 text-white font-sans selection:bg-transparent">
      <canvas ref={canvasRef} className="absolute inset-0 block" />
      
      {/* HUD */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
          <div>
            {/* XP Bar */}
            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700 mb-2 shadow-lg">
              <div 
                className="h-full bg-blue-500 transition-all duration-200 ease-out"
                style={{ width: `${(exp / expToNext) * 100}%` }}
              />
            </div>
            
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-700 backdrop-blur-sm">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-lg">LVL {level}</span>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-700 backdrop-blur-sm">
                  <Heart className="w-5 h-5 text-red-500" />
                  <div className="w-32 h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 transition-all duration-200"
                      style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-900/80 px-4 py-2 rounded-lg border border-gray-700 backdrop-blur-sm">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="font-mono text-xl font-bold">{formatTime(time)}</span>
              </div>
            </div>
          </div>
          
          {/* Active Weapons */}
          <div className="flex gap-2">
            {engine?.weapons.map((w, i) => (
              <div key={i} className="bg-gray-900/80 border border-gray-700 rounded-lg p-2 flex flex-col items-center backdrop-blur-sm">
                <span className="text-xs text-gray-400 font-bold uppercase">{w.name}</span>
                <span className="text-sm font-bold text-blue-400">Lv.{w.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menus */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-md flex items-center justify-center pointer-events-auto">
          <div className="text-center max-w-lg p-8 bg-gray-800/50 border border-gray-700 rounded-2xl shadow-2xl">
            <h1 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 tracking-tight">
              OUROBOROS<br/>SURVIVORS
            </h1>
            <p className="text-gray-400 mb-8 text-lg">
              Survive the endless snake hordes. Destroy the body to split them, destroy the head to kill them. Use WASD to move.
            </p>
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-white text-gray-900 font-bold text-xl rounded-full hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95"
            >
              START SURVIVING
            </button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md flex items-center justify-center pointer-events-auto">
          <div className="text-center p-8 bg-gray-900/80 border border-red-500/30 rounded-2xl shadow-2xl">
            <Skull className="w-24 h-24 text-red-500 mx-auto mb-4" />
            <h2 className="text-5xl font-black text-white mb-2">YOU DIED</h2>
            <p className="text-xl text-red-200 mb-8 font-mono">Survived: {formatTime(time)}</p>
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-red-500 text-white font-bold text-xl rounded-full hover:bg-red-400 transition-transform hover:scale-105 active:scale-95"
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

      {gameState === 'levelup' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="w-full max-w-3xl p-8">
            <div className="text-center mb-8">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-4xl font-black text-white tracking-widest">LEVEL UP!</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => handleChoice(choice)}
                  className="bg-gray-800 border-2 border-gray-700 hover:border-blue-500 rounded-xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {choice.weapon.name}
                    </h3>
                    <span className="bg-gray-900 text-xs font-bold px-2 py-1 rounded text-gray-400">
                      {choice.type === 'new' ? 'NEW' : `LVL ${choice.weapon.level + 1}`}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {choice.weapon.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
