/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Sparkles, 
  HelpCircle, 
  Building2, 
  User, 
  Zap, 
  Layers,
  CheckCircle,
  MessageSquare,
  X,
  ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage, Machine, UserProfile } from "../types";

interface AdvisorSectionProps {
  machines: Machine[];
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onRecommendMachines: (machineIds: string[]) => void;
  onSelectMachineForBooking: (machine: Machine) => void;
  currentUser: UserProfile | null;
  onAddSystemLog?: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

export default function AdvisorSection({
  machines,
  messages,
  setMessages,
  onRecommendMachines,
  onSelectMachineForBooking,
  currentUser,
  onAddSystemLog,
}: AdvisorSectionProps) {
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);

  // Auto-scroll to bottom of chats within the chat container only
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Action chips aligned with HuurGo's compact fleet
  const quickActionChips = [
    { text: "🎨 Schilder Binnenklus (Schaarlift)", prompt: "Ik ben schilder en zoek een compacte elektrische schaarlift voor binnen op 8 meter werkhoogte." },
    { text: "☀️ Zonnepanelen Leggen (Aanhangerlift)", prompt: "Ik ben installateur en zoek een 'Toe & Go' aanhangerhoogwerker met trekhaak om zonnepanelen te installeren op 12 meter hoogte." },
    { text: "🌳 Snoeien in de Tuin (Rupshoogwerker)", prompt: "Ik moet bomen snoeien in een achtertuin met een smalle toegang van 85cm. Wat raad je aan?" },
    { text: "🏡 Gevel Schilderen (Zelf Ophalen Aanhanger)", prompt: "Ik wil mijn gevel schilderen op 12 meter hoogte en wil de lift zelf met mijn auto trekken (rijbewijs B). Welk model past?" },
    { text: "💡 Lampen Vervangen Hal (Star Mastlift)", prompt: "Ik moet lampen vervangen in een smalle bedrijfshal op 9 meter hoogte. Welke mastlift adviseer je?" },
    { text: "🧼 Ramen Lappen Smal Pad (Smal Model 10m)", prompt: "Ik zoek een smalle schaarlift van 10 meter werkhoogte voor glasbewassing in een krap gangpad." },
    { text: "📦 Verhuizing direct via raam (Ladderlift)", prompt: "Ik zoek een ladderlift/verhuislift om meubels veilig naar de 3e verdieping te brengen." },
    { text: "🛠️ Plafond Montage Binnen (Ecolift - Wind-up)", prompt: "Ik zoek een lichte handmatige lift voor een plafondklusje op 4 meter hoogte zonder stroom of accu." }
  ];

  const extractSuggestions = (text: string): string[] => {
    const rx = /<suggest>([\w-]+)<\/suggest>/g;
    const ids: string[] = [];
    let match;
    while ((match = rx.exec(text)) !== null) {
      if (match[1]) ids.push(match[1]);
    }
    return ids;
  };

  const cleanSuggestTags = (text: string): string => {
    return text.replace(/<suggest>[\w-]+<\/suggest>/g, "").trim();
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend) return;

    if (!customText) setInputText("");

    onAddSystemLog?.(
      "system",
      currentUser ? currentUser.name : "Gast",
      customText
        ? `Kiest snel scenario: "${customText.substring(0, 45)}..."`
        : `Stelt adviesvraag aan AI Vloot Adviseur: "${textToSend.substring(0, 45)}..."`
    );

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await fetch("/api/gemini/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          userProfile: currentUser ? currentUser.profileType : "Schilder"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get response from advisor server");
      }

      const data = await response.json();
      const rawReply = data.reply || "Excuus, ik ondervond een storing in mijn systeem. Probeer het opnieuw.";

      const suggestedIds = extractSuggestions(rawReply);
      const cleanedReply = cleanSuggestTags(rawReply);

      if (suggestedIds.length > 0) {
        onRecommendMachines(suggestedIds);
      }

      const advisorMsg: ChatMessage = {
        id: `advisor-${Date.now()}`,
        sender: "advisor",
        text: cleanedReply,
        timestamp: new Date().toISOString(),
        recommendedMachineIds: suggestedIds.length > 0 ? suggestedIds : undefined
      };

      setMessages(prev => [...prev, advisorMsg]);

    } catch (err) {
      console.error(err);
      const fallbackAdvisorMsg: ChatMessage = {
        id: `advisor-fail-${Date.now()}`,
        sender: "advisor",
        text: "Ik ben op dit moment de vloot aan het actualiseren. Onze excuses voor het ongemak. De elektrische schaarlift is sowieso een uitstekend algemeen voorstel!",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, fallbackAdvisorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] py-6 sm:py-8 px-5 sm:px-6 lg:px-8">
      
      {/* Background Radial Glow */}
      <div className="absolute top-1/6 right-10 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px] -z-10" />

      <div className="mx-auto max-w-6xl">
        
        {/* Main Grid Layout for Chat & Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Main Chat Area */}
          <div className="lg:col-span-8 flex flex-col h-[65vh] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-md">
            
            {/* Advisor Header bar */}
            <div className="border-b border-slate-200 bg-slate-50 p-4 flex items-center justify-between animate-fade-in">
              <div className="flex items-center space-x-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 shadow-sm">
                  <Sparkles className="h-5 w-5 text-white" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-teal-500 ring-2 ring-white animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm text-slate-900">Consulente Advisor</h3>
                  <p className="text-[10px] text-teal-705 text-teal-600 font-mono tracking-wider uppercase leading-none mt-1">
                    AI-gestuurde Hoogwerkanalist
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Geactiveerd op Gemini 3.5</span>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-slate-50/50 to-white scrollbar-thin"
            >
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-550 bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}

                    <div className="max-w-[85%]">
                      <div
                        className={`p-4 rounded-2xl text-[11.5px] sm:text-xs leading-relaxed border ${
                          isUser
                            ? "bg-slate-100 border-slate-200 text-slate-800 rounded-tr-none"
                            : "bg-indigo-50 border-indigo-100 text-slate-800 rounded-tl-none"
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed">
                          {m.text}
                        </p>
                      </div>

                      {/* Machine suggestions rendered right below the reply */}
                      {m.recommendedMachineIds && m.recommendedMachineIds.length > 0 && (
                        <div className="mt-3.5 space-y-2">
                          <span className="text-[9.5px] uppercase font-bold tracking-widest text-teal-700 block font-mono">
                            Aanbevolen machines door onze adviseur:
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {m.recommendedMachineIds.map((recId) => {
                              const foundMachine = machines.find((mach) => mach.id === recId);
                              if (!foundMachine) return null;
                              return (
                                <div 
                                  key={recId} 
                                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm gap-2.5"
                                >
                                  <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                                    <div className="h-10 w-10 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shrink-0">
                                      <img 
                                        src={foundMachine.imageUrl || "/api/placeholder/100/100"} 
                                        alt={foundMachine.name}
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          e.currentTarget.src = "/placeholder-machine.webp";
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1 sm:flex-initial">
                                      <h4 className="text-xs font-bold text-slate-900 leading-none truncate">
                                        {foundMachine.name}
                                      </h4>
                                      <span className="text-[10px] text-teal-650 text-teal-650 mt-1 block font-mono">
                                        €{foundMachine.pricePerDay}/dag
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end sm:justify-start">
                                    <button
                                      onClick={() => {
                                        setSelectedDetailMachine(foundMachine);
                                        onAddSystemLog?.(
                                          "system",
                                          currentUser ? currentUser.name : "Gast",
                                          `Bekijkt specificaties van AI aanbevolen machine: "${foundMachine.name}"`
                                        );
                                      }}
                                      className="flex-1 sm:flex-none text-center px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      Details
                                    </button>
                                    <button
                                      onClick={() => onSelectMachineForBooking(foundMachine)}
                                      className="flex-1 sm:flex-none text-center bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border-none"
                                    >
                                      Direct Huren
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <span className="text-[9px] font-mono text-slate-400 mt-1 block text-right">
                        {new Date(m.timestamp).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {isUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center space-x-2.5"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shrink-0">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl rounded-tl-none flex items-center space-x-2 shadow-sm">
                      <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" />
                      <span className="text-[10px] text-slate-500 font-medium ml-1.5">Advisor analyseert...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Form Area */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder="Beschrijf uw werkhoogte, obstakels of uw project..."
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0 shadow-md cursor-pointer border-none"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Quick Chips Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-3xl space-y-4">
              <div className="flex items-center space-x-1.5">
                <HelpCircle className="h-4.5 w-4.5 text-indigo-600" />
                <h4 className="font-display font-extrabold text-xs text-slate-900 uppercase tracking-wider">Snelle Scenario's</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kies een van de snelle scenario's om direct passend advies te krijgen over specifieke werkzaamheden.
              </p>
              
              <div className="flex flex-col gap-2 pt-2">
                {quickActionChips.map((chip, idx) => {
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip.prompt)}
                      className="text-left text-xs bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-450 hover:border-indigo-400 text-slate-755 text-slate-700 hover:text-indigo-900 p-2.5 rounded-xl transition-all duration-300 cursor-pointer shadow-sm"
                    >
                      {chip.text}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-indigo-100 bg-indigo-50/50 p-5 rounded-3xl space-y-3 shadow-sm">
              <h4 className="font-display font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-teal-605 text-teal-600 animate-pulse" />
                <span>Onze Compacte Vloot Checklist</span>
              </h4>
              <p className="text-[10.5px] text-slate-655 text-slate-600 leading-relaxed font-medium">
                Onze compacte vloot herbergt emissievrije, stille en lichtgewicht typen die uitermate geschikt zijn voor doe-het-zelvers en ZZP-klussen binnenshuis of in de tuin.
              </p>
              <div className="space-y-2 pt-2 text-[10px] font-mono text-slate-500">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Aanhangerhoogwerker ("Toe & Go")</span>
                  <span className="text-slate-800 font-bold">v.a. 12m</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Rupshoogwerker (Spin)</span>
                  <span className="text-slate-800 font-bold">v.a. 15m</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Schaarlift (Standaard 8m)</span>
                  <span className="text-slate-800 font-bold">v.a. 8m</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Smal model Schaarlift (10m)</span>
                  <span className="text-slate-800 font-bold">v.a. 10m</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Mastlift (Verticale lift)</span>
                  <span className="text-slate-800 font-bold">v.a. 5m</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Ladderlift / Verhuislift</span>
                  <span className="text-slate-800 font-bold">v.a. 18m</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span>Ecolift (Handmatige lift)</span>
                  <span className="text-slate-800 font-bold">v.a. 4.2m</span>
                </div>
              </div>
            </div>

            {/* AI and Security compliance banner */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl space-y-3.5 shadow-sm">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 animate-pulse" />
                <h4 className="font-display font-semibold text-xs text-slate-900 uppercase tracking-wider">
                  Veiligheid & Kwaliteit
                </h4>
              </div>
              
              <div className="space-y-2.5 text-[11px] leading-relaxed text-slate-600 font-medium">
                <p>
                  <strong>Veilige Verbinding:</strong> Uw chats en projectgegevens worden veilig via onze proxy verwerkt en niet opgeslagen voor externe doeleinden.
                </p>
                
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 font-sans shadow-sm text-[10.5px]">
                  <div className="flex justify-between text-slate-500">
                    <span>AI Certificering:</span>
                    <span className="text-teal-700 font-semibold">Gemini Smart Shield</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Veiligheidstandaard:</span>
                    <span className="text-slate-700 font-semibold">BMWT & ISO-proof</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-100 pt-1 mt-1">
                    <span>Live Status:</span>
                    <span className="flex items-center space-x-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Optimaal & Actief</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* WhatsApp Help Banner */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4.5 transition-all text-left gap-4 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-slate-800 text-xs sm:text-sm">Hulp nodig van een expert?</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">
                Komt u er niet helemaal uit of wilt u direct contact met een planner? Stuur ons gerust een WhatsApp-bericht voor direct persoonlijk advies.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/31612345678"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-98 shadow-sm cursor-pointer whitespace-nowrap no-underline"
          >
            <span>Stuur ons een WhatsApp</span>
            <span>💬</span>
          </a>
        </div>

      </div>

      {/* Specifications Details Modal */}
      <AnimatePresence>
        {selectedDetailMachine && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailMachine(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col max-h-[90vh] my-8"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-400 via-indigo-500 to-amber-400" />

              <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                  <span className="text-[10px] text-teal-600 font-mono uppercase tracking-widest block font-bold">
                    {selectedDetailMachine.categoryLabel || "Vloot Details"} • {selectedDetailMachine.powerType}
                  </span>
                  <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">
                    {selectedDetailMachine.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailMachine(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  <div className="md:col-span-12 lg:col-span-5 space-y-4">
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 relative">
                      <img 
                        src={selectedDetailMachine.imageUrl} 
                        alt={selectedDetailMachine.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-machine.webp";
                        }}
                      />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Dagtarief:</span>
                        <span className="font-mono font-bold text-teal-600 text-base">€{selectedDetailMachine.pricePerDay} / dag</span>
                      </div>
                      
                      {selectedDetailMachine.weeklyDiscountPercent && (
                        <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2">
                          <span className="text-slate-500 font-medium">Weekkorting (7+ dagen):</span>
                          <span className="font-mono text-emerald-600 font-bold">-{selectedDetailMachine.weeklyDiscountPercent}%</span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedDetailMachine(null);
                          onSelectMachineForBooking(selectedDetailMachine);
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer border-none"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        <span>Huur Nu Direct</span>
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-12 lg:col-span-7 space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-indigo-700 uppercase tracking-widest block font-bold">Omschrijving</label>
                      <p className="text-slate-650 text-slate-600 text-xs leading-relaxed">
                        {selectedDetailMachine.description}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3.5 relative overflow-hidden">
                      <div className="flex items-center space-x-2">
                        <ShoppingBag className="h-4 w-4 text-teal-600" />
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                          Inbegrepen Pakketinhoud
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {(selectedDetailMachine.packageContents && selectedDetailMachine.packageContents.trim()
                          ? selectedDetailMachine.packageContents.split(";").map(s => s.trim()).filter(s => s.length > 0)
                          : [
                              "1x Professionele en gekeurde machine",
                              "1x Volle tank brandstof of 100% opgeladen accupakket",
                              "1x Uitgebreide instructie bij aflevering",
                              "BMWT Veiligheidscertificaat handleiding in de werkbak",
                              "24/7 Technische storingshulp & backup service"
                            ]
                        ).map((item, idx) => (
                          <div key={idx} className="flex items-start space-x-1.5 text-xs text-slate-700">
                            <span className="text-teal-600 font-bold shrink-0 mt-0.5 font-mono">✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Technische Specificaties</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Werkhoogte:</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{selectedDetailMachine.height} meter</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Zijdelings bereik:</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{selectedDetailMachine.reach} meter</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Totaal gewicht:</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{selectedDetailMachine.weight.toLocaleString('nl-NL')} kg</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Aandrijving:</span>
                          <span className="text-xs font-bold text-slate-800">{selectedDetailMachine.powerType}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end shrink-0 mt-3">
                <button
                  onClick={() => setSelectedDetailMachine(null)}
                  className="px-5 py-2 hover:bg-slate-200 bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Sluiten
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
