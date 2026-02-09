
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChefHat, Search, Clock, Users, ArrowRight, ArrowLeft, CheckCircle2, 
  UtensilsCrossed, Flame, Sparkles, Volume2, VolumeX, Globe, 
  LogIn, BookOpen, Landmark, Languages, MapPin, Flag, Wifi, WifiOff, Signal, BrainCircuit, Edit3, Send
} from 'lucide-react';
import { generateRecipe, generateRecipeImage, generateSpeech, performGastronomyResearch } from './services/geminiService';
import { Recipe, ViewState, Continent, Language, User, UserPlan } from './types';

function decodeBase64(b: string) { const s = atob(b); const l = s.length; const y = new Uint8Array(l); for (let i = 0; i < l; i++) y[i] = s.charCodeAt(i); return y; }
async function decodeAudioData(d: Uint8Array, c: AudioContext, r: number, n: number): Promise<AudioBuffer> { const i16 = new Int16Array(d.buffer); const f = i16.length / n; const b = c.createBuffer(n, f, r); for (let ch = 0; ch < n; ch++) { const cd = b.getChannelData(ch); for (let i = 0; i < f; i++) cd[i] = i16[i * n + ch] / 32768.0; } return b; }

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('pt');
  const [continent, setContinent] = useState<Continent>('Global');
  
  const [ingredient, setIngredient] = useState('');
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResult, setResearchResult] = useState('');
  const [recipe, setRecipe] = useState<(Recipe & { continentDetected?: string, isRefined?: boolean }) | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Feedback System
  const [showLearningModal, setShowLearningModal] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const h = () => setIsOnline(true);
    const o = () => setIsOnline(false);
    window.addEventListener('online', h);
    window.addEventListener('offline', o);
    return () => { window.removeEventListener('online', h); window.removeEventListener('offline', o); };
  }, []);

  const t = {
    pt: { 
      welcome: "Gourmet AI World",
      sub: "A inteligência que aprende com pesquisadores e mestres da culinária.",
      placeholder: "Digite o prato ou ingredientes",
      offline: "IA requer internet (Wi-Fi/Móvel).",
      learning: "Ensinar algo novo à IA",
      learningSub: "Sua correção ajudará a IA a ser mais precisa no futuro.",
      refined: "Conhecimento Refinado"
    },
    en: { 
      welcome: "Gourmet AI World",
      sub: "The AI that learns from researchers and culinary masters.",
      placeholder: "Enter dish or ingredients",
      offline: "AI requires internet (Wi-Fi/Mobile).",
      learning: "Teach something new to AI",
      learningSub: "Your correction will help the AI be more accurate in the future.",
      refined: "Refined Knowledge"
    }
  }[lang];

  const stopAudio = () => {
    if (currentAudioSourceRef.current) { try { currentAudioSourceRef.current.stop(); } catch (e) {} }
    setIsSpeaking(false);
  };

  const playStepNarration = async (stepIndex: number) => {
    if (!isAudioEnabled || !recipe || user?.plan === 'Grátis' || !isOnline) return;
    stopAudio();
    const step = recipe.steps[stepIndex];
    const text = `Passo ${stepIndex + 1}. ${step.title}. ${step.instruction}`;
    setIsSpeaking(true);
    const base64 = await generateSpeech(text, lang);
    if (base64) {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      const buffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      currentAudioSourceRef.current = source;
      source.start();
    } else { setIsSpeaking(false); }
  };

  useEffect(() => {
    if (view === 'cooking' && recipe) playStepNarration(currentStep);
    else stopAudio();
  }, [view, currentStep, isAudioEnabled]);

  const handleSearch = async (e: React.FormEvent, feedback?: string) => {
    if (e) e.preventDefault();
    if (!isOnline) { alert(t.offline); return; }
    if (!user) { setView('auth'); return; }
    
    setView('loading');
    setLoadingMsg(feedback ? 'IA Integrando seu conhecimento...' : 'IA Identificando origem geográfica...');
    
    try {
      const newRecipe = await generateRecipe(ingredient, lang, continent, feedback);
      setLoadingMsg(`Culinária de ${newRecipe.origin} ${feedback ? 'Aprimorada' : 'Detectada'}.`);
      const imageUrl = recipe?.imageUrl && !feedback ? recipe.imageUrl : await generateRecipeImage(newRecipe.title);
      setRecipe({ ...newRecipe, imageUrl });
      setView('recipe');
      setShowLearningModal(false);
      setCorrectionText('');
    } catch (error) {
      alert('Erro na conexão com o cérebro gourmet.');
      setView('landing');
    }
  };

  const loginDemo = (plan: UserPlan) => {
    setUser({ id: '1', name: 'Chef Connoisseur', email: 'user@gourmet.ai', plan, language: lang });
    setView('landing');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      {!isOnline && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-xs font-bold animate-pulse flex items-center justify-center gap-2 z-[100]">
          <WifiOff className="w-4 h-4" /> {t.offline}
        </div>
      )}

      <header className="sticky top-0 z-50 glass border-b border-orange-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
          <div className="bg-orange-600 p-2 rounded-xl shadow-lg">
            <ChefHat className="text-white w-7 h-7" />
          </div>
          <h1 className="font-black text-2xl text-orange-900 hidden md:block">Gourmet AI <span className="text-orange-500">World</span></h1>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${isOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isOnline ? 'Cloud Active' : 'Offline'}</span>
          </div>

          <div className="flex items-center bg-gray-100 rounded-full px-4 py-1.5 gap-2">
            <Languages className="w-4 h-4 text-gray-500" />
            <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="bg-transparent text-sm font-bold focus:outline-none">
              <option value="pt">Português</option>
              <option value="en">English</option>
            </select>
          </div>
          
          {user ? (
            <div className="flex items-center gap-3 bg-white p-1 pr-4 rounded-full border border-orange-100">
              <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-[10px] font-black">
                {user.plan[0]}
              </div>
              <p className="text-sm font-bold text-gray-700">{user.name}</p>
            </div>
          ) : (
            <button onClick={() => setView('auth')} className="bg-gray-900 text-white px-6 py-2 rounded-full font-bold text-sm">Login</button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        {view === 'landing' && (
          <div className="py-12 space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                <BrainCircuit className="w-4 h-4" /> Inteligência Evolutiva
              </div>
              <h2 className="text-7xl font-black text-gray-900 leading-none tracking-tight">O Sabor que <span className="text-orange-600">Aprende</span> com Você.</h2>
              <p className="text-2xl text-gray-500 font-medium">{t.sub}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              <div className="bg-gradient-to-br from-orange-50 to-white p-10 rounded-[3rem] border border-orange-100 shadow-xl space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-orange-600 rounded-2xl text-white"><UtensilsCrossed className="w-8 h-8" /></div>
                  <h4 className="text-2xl font-black">Identificador de Pratos</h4>
                </div>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={ingredient}
                      onChange={(e) => setIngredient(e.target.value)}
                      placeholder={t.placeholder}
                      className="w-full p-6 pr-16 rounded-3xl border-2 border-white focus:border-orange-500 outline-none shadow-sm text-xl font-medium"
                    />
                    <button type="submit" className="absolute right-4 top-4 bg-orange-600 text-white p-3 rounded-2xl"><Search /></button>
                  </div>
                </form>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-white p-10 rounded-[3rem] border border-blue-100 shadow-xl space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-600 rounded-2xl text-white"><BookOpen className="w-8 h-8" /></div>
                  <h4 className="text-2xl font-black">Investigação Histórica</h4>
                </div>
                <div className="relative">
                  <input type="text" placeholder="Origem da Cachupa..." className="w-full p-6 rounded-3xl border-2 border-white focus:border-blue-500 outline-none text-xl" />
                  <button className="absolute right-4 top-4 bg-blue-600 text-white p-3 rounded-2xl"><Search /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'loading' && (
          <div className="flex flex-col items-center justify-center py-40 space-y-8 animate-in fade-in">
            <div className="w-32 h-32 border-8 border-orange-50 border-t-orange-600 rounded-full animate-spin"></div>
            <div className="text-center space-y-3">
              <p className="text-3xl font-black text-gray-900">{loadingMsg}</p>
              <div className="flex justify-center gap-1">
                {[1,2,3].map(i => <div key={i} className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }}></div>)}
              </div>
            </div>
          </div>
        )}

        {view === 'recipe' && recipe && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="relative h-[600px] rounded-[4rem] overflow-hidden shadow-2xl border-4 border-white">
              <img src={recipe.imageUrl} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex items-end p-16">
                <div className="space-y-6 w-full">
                  <div className="flex gap-3">
                    <div className="bg-orange-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {recipe.origin}
                    </div>
                    {recipe.isRefined && (
                      <div className="bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                        <BrainCircuit className="w-4 h-4" /> {t.refined}
                      </div>
                    )}
                  </div>
                  <h2 className="text-7xl font-black text-white leading-none tracking-tight">{recipe.title}</h2>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-16">
              <div className="lg:col-span-1 space-y-10">
                <div className="bg-gray-50 p-10 rounded-[3.5rem] space-y-8 border border-gray-100">
                  <h3 className="text-3xl font-black flex items-center gap-4 text-gray-900 border-b pb-6">
                    <UtensilsCrossed className="text-orange-600" /> Ingredientes
                  </h3>
                  <div className="space-y-4">
                    {recipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex flex-col p-5 bg-white rounded-3xl border border-gray-100">
                        <span className="text-orange-600 font-black text-xl">{ing.quantity}</span>
                        <span className="font-bold text-gray-700">{ing.item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-12 py-4">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-4xl font-black text-gray-900">História e Cultura</h3>
                    {user?.plan === 'Pesquisador' && (
                      <button 
                        onClick={() => setShowLearningModal(true)}
                        className="flex items-center gap-2 text-blue-600 font-black text-sm uppercase bg-blue-50 px-5 py-3 rounded-2xl hover:bg-blue-100 transition"
                      >
                        <Edit3 className="w-4 h-4" /> Corrigir IA
                      </button>
                    )}
                  </div>
                  <p className="text-2xl text-gray-600 leading-relaxed font-medium">{recipe.description}</p>
                </div>
                
                <button onClick={() => setView('cooking')} className="w-full py-10 bg-gray-900 text-white rounded-[3rem] text-3xl font-black shadow-2xl flex items-center justify-center gap-4 transform active:scale-95 transition">
                  Iniciar Preparo <ArrowRight className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'cooking' && recipe && (
           <div className="max-w-4xl mx-auto py-10 space-y-12 animate-in zoom-in-95">
             <div className="flex items-center justify-between bg-white p-5 rounded-[2.5rem] shadow-xl border border-gray-100">
               <button onClick={() => setView('recipe')} className="text-gray-400 font-black flex items-center gap-3">
                 <ArrowLeft /> Voltar
               </button>
               <span className="text-3xl font-black text-orange-600">{currentStep + 1} <span className="text-gray-200">/ {recipe.steps.length}</span></span>
               <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition ${isAudioEnabled ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                 {isAudioEnabled ? <Volume2 /> : <VolumeX />}
               </button>
             </div>

             <div className="bg-white rounded-[4rem] shadow-3xl overflow-hidden">
                <div className="bg-orange-600 p-16 text-white">
                  <h2 className="text-5xl font-black leading-tight">{recipe.steps[currentStep].title}</h2>
                </div>
                <div className="p-16 space-y-16">
                  <p className="text-4xl font-bold text-gray-800 leading-[1.35]">{recipe.steps[currentStep].instruction}</p>
                  <div className="flex gap-8">
                    <button disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)} className="flex-1 py-10 rounded-[2.5rem] bg-gray-50 text-gray-400 font-black text-2xl disabled:opacity-20">Anterior</button>
                    <button onClick={() => currentStep < recipe.steps.length - 1 ? setCurrentStep(currentStep + 1) : setView('landing')} className="flex-[2] py-10 rounded-[2.5rem] bg-gray-900 text-white font-black text-3xl shadow-2xl">
                      {currentStep === recipe.steps.length - 1 ? 'Concluir' : 'Próxima'}
                    </button>
                  </div>
                </div>
             </div>
           </div>
        )}

        {view === 'auth' && (
          <div className="max-w-2xl mx-auto py-24 space-y-12 text-center animate-in zoom-in-95">
            <h2 className="text-6xl font-black text-gray-900">Escolha sua <span className="text-orange-600">Jornada</span></h2>
            <div className="grid gap-6">
              <button onClick={() => loginDemo('Pesquisador')} className="p-10 rounded-[3rem] border-4 border-blue-100 bg-white hover:border-blue-600 transition text-left group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-blue-600 text-white rounded-2xl group-hover:scale-110 transition"><BrainCircuit /></div>
                  <span className="text-xs font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase">Elite</span>
                </div>
                <h4 className="text-3xl font-black text-gray-900">Modo Pesquisador</h4>
                <p className="text-gray-500 font-bold">Poder de corrigir a IA e ensinar novas receitas.</p>
              </button>
              <button onClick={() => loginDemo('Grátis')} className="p-10 rounded-[3rem] border-4 border-gray-100 bg-white hover:border-orange-600 transition text-left">
                <h4 className="text-3xl font-black text-gray-900">Modo Cozinheiro</h4>
                <p className="text-gray-500 font-bold">Acesso a receitas básicas e guias visuais.</p>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Learning Modal for Researchers */}
      {showLearningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowLearningModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[4rem] shadow-4xl overflow-hidden p-12 space-y-8 animate-in zoom-in-95">
            <div className="flex items-center gap-6">
              <div className="p-5 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-200">
                <BrainCircuit className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-gray-900">{t.learning}</h3>
                <p className="text-blue-600 font-bold">{t.learningSub}</p>
              </div>
            </div>
            
            <textarea 
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="Ex: A receita de Calulu original leva óleo de palma vermelho e não azeite comum..."
              className="w-full h-64 p-8 bg-gray-50 rounded-[2.5rem] border-2 border-transparent focus:border-blue-500 outline-none text-xl font-medium resize-none"
            />

            <div className="flex gap-4">
              <button onClick={() => setShowLearningModal(false)} className="flex-1 py-6 rounded-3xl bg-gray-100 text-gray-500 font-black text-lg">Cancelar</button>
              <button 
                onClick={() => handleSearch(null as any, correctionText)}
                disabled={!correctionText.trim()}
                className="flex-[2] py-6 rounded-3xl bg-blue-600 text-white font-black text-xl shadow-2xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                Atualizar Cérebro IA <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
