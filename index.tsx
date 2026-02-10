
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
    ChefHat, Search, Clock, Users, ArrowRight, ArrowLeft, 
    UtensilsCrossed, Flame, Sparkles, Volume2, VolumeX, 
    BookOpen, Landmark, Languages, MapPin, Wifi, WifiOff, 
    BrainCircuit, Edit3, Send, Signal
} from 'lucide-react';

// --- CONFIGURAÇÃO DA IA ---
const getAI = () => new GoogleGenAI({ apiKey: "gen-lang-client-0811414621" });

// --- HELPERS DE ÁUDIO ---
function decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

// --- APP COMPONENT ---
const App = () => {
    // Estados de Navegação e Usuário
    const [view, setView] = useState<'landing' | 'loading' | 'recipe' | 'cooking' | 'research' | 'auth'>('landing');
    const [user, setUser] = useState<{name: string, plan: string} | null>(null);
    const [lang, setLang] = useState<'pt' | 'en'>('pt');
    
    // Estados de Conteúdo
    const [ingredient, setIngredient] = useState('');
    const [recipe, setRecipe] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [researchResult, setResearchResult] = useState('');
    
    // Estados de Sistema
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showLearningModal, setShowLearningModal] = useState(false);
    const [correctionText, setCorrectionText] = useState('');

    const audioContextRef = useRef<AudioContext | null>(null);
    const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Monitor de Rede
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const stopAudio = () => {
        if (currentAudioSourceRef.current) {
            try { currentAudioSourceRef.current.stop(); } catch (e) {}
        }
        setIsSpeaking(false);
    };

    const playStepNarration = async (stepIndex: number) => {
        if (!isAudioEnabled || !recipe || user?.plan === 'Grátis' || !isOnline) return;
        stopAudio();
        
        const step = recipe.steps[stepIndex];
        const textToSpeak = `Passo ${stepIndex + 1}. ${step.title}. ${step.instruction}`;
        
        setIsSpeaking(true);
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: textToSpeak }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: lang === 'en' ? 'Puck' : 'Kore' },
                        },
                    },
                },
            });
            
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const ctx = audioContextRef.current;
                const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.onended = () => setIsSpeaking(false);
                currentAudioSourceRef.current = source;
                source.start();
            } else {
                setIsSpeaking(false);
            }
        } catch (e) {
            console.error("Erro no TTS:", e);
            setIsSpeaking(false);
        }
    };

    useEffect(() => {
        if (view === 'cooking' && recipe) {
            playStepNarration(currentStep);
        } else {
            stopAudio();
        }
    }, [view, currentStep, isAudioEnabled]);

    const handleSearch = async (e?: React.FormEvent, feedback?: string) => {
        if (e) e.preventDefault();
        if (!isOnline) return;
        if (!user) { setView('auth'); return; }
        
        setView('loading');
        setLoadingMsg(feedback ? 'IA Integrando seu conhecimento...' : 'IA Identificando origem e segredos...');
        
        try {
            const ai = getAI();
            const prompt = `Você é um Historiador Gastronômico e Master Chef. 
            Analise o input: "${ingredient}". 
            ${feedback ? `AVISO DE CORREÇÃO DO PESQUISADOR: "${feedback}". Adapte a receita conforme este conhecimento especialista.` : ''}
            Idioma: ${lang === 'pt' ? 'Português' : 'English'}.`;

            const modelResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            origin: { type: Type.STRING },
                            isRefined: { type: Type.BOOLEAN },
                            ingredients: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        item: { type: Type.STRING },
                                        quantity: { type: Type.STRING }
                                    }
                                }
                            },
                            steps: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        title: { type: Type.STRING },
                                        instruction: { type: Type.STRING },
                                        tip: { type: Type.STRING }
                                    }
                                }
                            }
                        },
                        required: ['title', 'description', 'ingredients', 'steps', 'origin']
                    }
                }
            });

            const newRecipe = JSON.parse(modelResponse.text || '{}');
            
            // Gerar Imagem
            const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: `High quality food photography of ${newRecipe.title}. Traditional dish from ${newRecipe.origin}.` }] },
                config: { imageConfig: { aspectRatio: "16:9" } }
            });
            const imgPart = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
            const imageUrl = imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';

            setRecipe({ ...newRecipe, imageUrl });
            setView('recipe');
            setShowLearningModal(false);
            setCorrectionText('');
        } catch (error) {
            console.error(error);
            alert('Erro ao processar. Verifique sua conexão.');
            setView('landing');
        }
    };

    const handleResearch = async (query: string) => {
        if (!isOnline) return;
        if (user?.plan !== 'Pesquisador') { setView('auth'); return; }
        setView('loading');
        setLoadingMsg('Consultando registros históricos mundiais...');
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: `Faça uma pesquisa acadêmica e histórica profunda sobre: ${query}. Use Markdown. Idioma: ${lang === 'pt' ? 'Português' : 'English'}.`,
            });
            setResearchResult(response.text || '');
            setView('research');
        } catch (e) {
            setView('landing');
        }
    };

    const login = (plan: string) => {
        setUser({ name: 'Chef Connoisseur', plan });
        setView('landing');
    };

    const texts = {
        pt: { welcome: "Gourmet AI World", sub: "A inteligência que aprende com mestre-cucas.", placeholder: "Digite o prato (ex: Cachupa, Fubá...)", research: "História", refined: "Refinado" },
        en: { welcome: "Gourmet AI World", sub: "The AI that learns from culinary masters.", placeholder: "Enter dish (e.g., Stew, Fuba...)", research: "History", refined: "Refined" }
    }[lang];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-50 glass border-b border-orange-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
                    <div className="bg-orange-600 p-2 rounded-xl shadow-lg"><ChefHat className="text-white w-7 h-7" /></div>
                    <h1 className="font-black text-2xl text-orange-900 hidden md:block">Gourmet AI <span className="text-orange-500">World</span></h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-gray-100 rounded-full px-4 py-1.5 gap-2">
                        <Languages className="w-4 h-4 text-gray-500" />
                        <select value={lang} onChange={(e) => setLang(e.target.value as any)} className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer">
                            <option value="pt">Português</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    {user ? (
                        <div className="flex items-center gap-3 bg-white p-1 pr-4 rounded-full border border-orange-100">
                            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-[10px] font-black">{user.plan[0]}</div>
                            <p className="text-sm font-bold text-gray-700">{user.name}</p>
                        </div>
                    ) : (
                        <button onClick={() => setView('auth')} className="bg-gray-900 text-white px-6 py-2 rounded-full font-bold text-sm">Login</button>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-6xl mx-auto w-full p-6">
                {view === 'landing' && (
                    <div className="py-12 space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="text-center space-y-6 max-w-3xl mx-auto">
                            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                                <BrainCircuit className="w-4 h-4" /> Aprendizado Contínuo
                            </div>
                            <h2 className="text-7xl font-black text-gray-900 leading-none tracking-tight">O Sabor que <span className="text-orange-600">Evolui</span>.</h2>
                            <p className="text-2xl text-gray-500 font-medium">{texts.sub}</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="bg-gradient-to-br from-orange-50 to-white p-10 rounded-[3rem] border border-orange-100 shadow-xl space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-orange-600 rounded-2xl text-white shadow-lg"><UtensilsCrossed className="w-8 h-8" /></div>
                                    <h4 className="text-2xl font-black">Identificador de Pratos</h4>
                                </div>
                                <form onSubmit={handleSearch} className="relative">
                                    <input
                                        type="text"
                                        value={ingredient}
                                        onChange={(e) => setIngredient(e.target.value)}
                                        placeholder={texts.placeholder}
                                        className="w-full p-6 pr-16 rounded-3xl border-2 border-white focus:border-orange-500 outline-none shadow-sm text-xl font-medium"
                                    />
                                    <button type="submit" className="absolute right-4 top-4 bg-orange-600 text-white p-3 rounded-2xl hover:bg-orange-700 transition"><Search /></button>
                                </form>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-white p-10 rounded-[3rem] border border-blue-100 shadow-xl space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg"><BookOpen className="w-8 h-8" /></div>
                                    <h4 className="text-2xl font-black">{texts.research}</h4>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        onKeyDown={(e) => e.key === 'Enter' && handleResearch((e.target as HTMLInputElement).value)}
                                        placeholder="Pesquisar história gastronômica..." 
                                        className="w-full p-6 rounded-3xl border-2 border-white focus:border-blue-500 outline-none text-xl" 
                                    />
                                    <button className="absolute right-4 top-4 bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700"><Search /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-40 space-y-8 animate-in fade-in">
                        <div className="w-32 h-32 border-8 border-orange-50 border-t-orange-600 rounded-full animate-spin"></div>
                        <p className="text-3xl font-black text-gray-900">{loadingMsg}</p>
                    </div>
                )}

                {view === 'recipe' && recipe && (
                    <div className="space-y-12 animate-in slide-in-from-right-8 duration-700">
                        <div className="relative h-[600px] rounded-[4rem] overflow-hidden shadow-2xl border-4 border-white group">
                            <img src={recipe.imageUrl} className="w-full h-full object-cover animate-subtle-zoom" alt={recipe.title} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex items-end p-16">
                                <div className="space-y-6 w-full">
                                    <div className="flex gap-3">
                                        <div className="bg-orange-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                            <MapPin className="w-4 h-4" /> {recipe.origin}
                                        </div>
                                        {recipe.isRefined && (
                                            <div className="bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                                <BrainCircuit className="w-4 h-4" /> {texts.refined}
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
                                    <h3 className="text-3xl font-black flex items-center gap-4 text-gray-900 border-b pb-6">Ingredientes</h3>
                                    <div className="space-y-4">
                                        {recipe.ingredients.map((ing: any, i: number) => (
                                            <div key={i} className="flex flex-col p-5 bg-white rounded-3xl border border-gray-100 hover:scale-[1.02] transition shadow-sm">
                                                <span className="text-orange-600 font-black text-xl">{ing.quantity}</span>
                                                <span className="font-bold text-gray-700">{ing.item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-2 space-y-12">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-4xl font-black text-gray-900">Sobre o Prato</h3>
                                    {user?.plan === 'Pesquisador' && (
                                        <button onClick={() => setShowLearningModal(true)} className="flex items-center gap-2 text-blue-600 font-black text-sm uppercase bg-blue-50 px-5 py-3 rounded-2xl hover:bg-blue-100 transition shadow-sm">
                                            <Edit3 className="w-4 h-4" /> Corrigir IA
                                        </button>
                                    )}
                                </div>
                                <p className="text-2xl text-gray-600 leading-relaxed font-medium">{recipe.description}</p>
                                <button onClick={() => { setView('cooking'); setCurrentStep(0); }} className="w-full py-10 bg-gray-900 text-white rounded-[3rem] text-3xl font-black shadow-2xl flex items-center justify-center gap-4 hover:bg-black transition transform active:scale-95">
                                    Iniciar Preparo <ArrowRight className="w-8 h-8" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'cooking' && recipe && (
                    <div className="max-w-4xl mx-auto py-10 space-y-12 animate-in zoom-in-95 duration-500">
                        <div className="flex items-center justify-between bg-white p-5 rounded-[2.5rem] shadow-xl border border-gray-100">
                            <button onClick={() => setView('recipe')} className="text-gray-400 font-black flex items-center gap-3 hover:text-orange-600 transition"><ArrowLeft /> Voltar</button>
                            <span className="text-3xl font-black text-orange-600">{currentStep + 1} <span className="text-gray-200">/ {recipe.steps.length}</span></span>
                            <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isAudioEnabled ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {isAudioEnabled ? <Volume2 /> : <VolumeX />}
                            </button>
                        </div>
                        <div className="bg-white rounded-[4rem] shadow-3xl overflow-hidden border border-gray-50">
                            <div className="bg-orange-600 p-16 text-white relative">
                                {isSpeaking && <div className="absolute top-10 right-10 flex gap-1 h-8 items-end">
                                    {[1,2,3,4].map(i => <div key={i} className="w-1.5 bg-white/50 rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i*0.2}s` }}></div>)}
                                </div>}
                                <h2 className="text-5xl font-black leading-tight tracking-tight">{recipe.steps[currentStep].title}</h2>
                            </div>
                            <div className="p-16 space-y-16">
                                <p className="text-4xl font-bold text-gray-800 leading-[1.35]">{recipe.steps[currentStep].instruction}</p>
                                {recipe.steps[currentStep].tip && (
                                    <div className="bg-amber-50 p-8 rounded-3xl border-l-8 border-amber-400 text-amber-900 font-bold text-xl flex gap-4 shadow-inner">
                                        <Sparkles className="shrink-0 w-8 h-8" /> {recipe.steps[currentStep].tip}
                                    </div>
                                )}
                                <div className="flex gap-8">
                                    <button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} className="flex-1 py-10 rounded-[2.5rem] bg-gray-50 text-gray-400 font-black text-2xl disabled:opacity-20 hover:bg-gray-100 transition">Anterior</button>
                                    <button onClick={() => currentStep < recipe.steps.length - 1 ? setCurrentStep(prev => prev + 1) : setView('landing')} className="flex-[2] py-10 rounded-[2.5rem] bg-gray-900 text-white font-black text-3xl shadow-2xl hover:bg-black transition active:scale-95">
                                        {currentStep === recipe.steps.length - 1 ? 'Concluir' : 'Próxima'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'research' && (
                    <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
                        <button onClick={() => setView('landing')} className="flex items-center gap-3 text-gray-400 font-black hover:text-blue-600 transition"><ArrowLeft /> Voltar</button>
                        <div className="bg-white p-16 rounded-[4rem] border border-blue-100 shadow-2xl prose prose-xl max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg"><Landmark /></div>
                                <h2 className="m-0 text-4xl">Dossiê Gastronômico</h2>
                            </div>
                            <div className="whitespace-pre-line text-gray-700 font-medium leading-relaxed">
                                {researchResult}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'auth' && (
                    <div className="max-w-2xl mx-auto py-24 space-y-12 text-center animate-in zoom-in-95 duration-500">
                        <h2 className="text-6xl font-black text-gray-900">Escolha sua <span className="text-orange-600">Jornada</span></h2>
                        <div className="grid gap-6">
                            <button onClick={() => login('Pesquisador')} className="p-10 rounded-[3rem] border-4 border-blue-100 bg-white hover:border-blue-600 transition text-left group shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-4 bg-blue-600 text-white rounded-2xl group-hover:scale-110 transition shadow-md"><BrainCircuit /></div>
                                    <span className="text-xs font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">Elite</span>
                                </div>
                                <h4 className="text-3xl font-black text-gray-900">Modo Pesquisador</h4>
                                <p className="text-gray-500 font-bold">Poder de ensinar a IA, áudio-guia em todas as etapas e pesquisa acadêmica.</p>
                            </button>
                            <button onClick={() => login('Grátis')} className="p-10 rounded-[3rem] border-4 border-gray-100 bg-white hover:border-orange-600 transition text-left group shadow-lg">
                                <div className="p-4 bg-gray-200 text-gray-600 rounded-2xl mb-4 group-hover:bg-orange-600 group-hover:text-white transition shadow-sm"><ChefHat /></div>
                                <h4 className="text-3xl font-black text-gray-900">Modo Cozinheiro</h4>
                                <p className="text-gray-500 font-bold">Acesso a receitas básicas e guias visuais.</p>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <footer className="p-10 text-center border-t border-gray-50 mt-10">
                <p className="text-gray-300 text-[10px] font-black uppercase tracking-[0.5em]">© 2024 Gourmet AI World. A inteligência que alimenta o mundo.</p>
            </footer>

            {/* Modal de Aprendizado */}
            {showLearningModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowLearningModal(false)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-[4rem] shadow-4xl p-12 space-y-8 animate-in zoom-in-95">
                        <div className="flex items-center gap-6">
                            <div className="p-5 bg-blue-600 text-white rounded-3xl shadow-lg"><BrainCircuit className="w-10 h-10" /></div>
                            <div>
                                <h3 className="text-3xl font-black text-gray-900">Ensinar algo novo à IA</h3>
                                <p className="text-blue-600 font-bold">Seu conhecimento será incorporado para futuras receitas.</p>
                            </div>
                        </div>
                        <textarea 
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            placeholder="Ex: A receita original de Muamba em Angola não leva ingredientes processados..."
                            className="w-full h-64 p-8 bg-gray-50 rounded-[2.5rem] border-2 border-transparent focus:border-blue-500 outline-none text-xl font-medium resize-none shadow-inner"
                        />
                        <div className="flex gap-4">
                            <button onClick={() => setShowLearningModal(false)} className="flex-1 py-6 rounded-3xl bg-gray-100 text-gray-500 font-black text-lg hover:bg-gray-200 transition">Cancelar</button>
                            <button 
                                onClick={() => handleSearch(undefined, correctionText)}
                                disabled={!correctionText.trim()}
                                className="flex-[2] py-6 rounded-3xl bg-blue-600 text-white font-black text-xl shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-blue-700 transition"
                            >
                                Atualizar IA <Send className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
