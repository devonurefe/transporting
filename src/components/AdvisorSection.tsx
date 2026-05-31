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
  ArrowRight, 
  Zap, 
  Layers,
  ArrowUpToLine,
  Weight,
  Wrench,
  Sliders,
  DollarSign,
  TreePine,
  ShieldAlert,
  CheckCircle,
  TrendingUp,
  History,
  Cpu,
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
  // Navigation tabs for Advisor
  const [activeSubTab, setActiveSubTab] = useState<"chat" | "wizard">("wizard");
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Wizard state parameters
  const [wizardProfile, setWizardProfile] = useState<string>(currentUser ? currentUser.profileType : "Schilder");
  const [requiredHeight, setRequiredHeight] = useState<number>(12);
  const [requiredReach, setRequiredReach] = useState<number>(0);
  const [workArea, setWorkArea] = useState<"binnen" | "buiten" | "beide">("beide");
  const [floorType, setFloorType] = useState<"vlak" | "onverhard" | "kwetsbaar">("vlak");
  const [maxBudget, setMaxBudget] = useState<number>(250);
  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);

  // Synchronize wizard profile when current user switches
  useEffect(() => {
    setWizardProfile(currentUser ? currentUser.profileType : "Schilder");
  }, [currentUser]);

  // Auto-scroll to bottom of chats within the chat container only (prevents window jumping)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isTyping, activeSubTab]);

  // Action chips
  const quickActionChips = [
    { text: "🎨 Ik ben schilder (Binnenklus)", prompt: "Ik ben schilder en zoek een machine voor een klus binnenshuis (hoogte ca. 10m)." },
    { text: "🧼 Ik wil ramen wassen (Over obstakels)", prompt: "Ik ben glazenwasser en moet over een luifel reiken om ramen te lappen. Wat raad je aan?" },
    { text: "🌳 Boomverzorging in de tuin", prompt: "Ik zoek een hoogwerker voor boomverzorging in een achtertuin met smalle poort." },
    { text: "🏡 Particuliere gevelklus (B-Rijbewijs)", prompt: "Ik ben particulier en wil mijn dakgoot schoonmaken. Ik wil er zelf mee kunnen rijden." },
    { text: "☀️ Zonnepanelen installatie", prompt: "Ik ben installateur en zoek een machine om zonnepanelen te leggen op een schuin dak van 12m." },
    { text: "🏠 Dakreparatie & Schoorsteen", prompt: "Ik moet pannen vervangen en de schoorsteen voegen op een hoogte van 15m. Welke machine past hierbij?" },
    { text: "📹 Camera & Licht montage", prompt: "Ik moet beveiligingscamera's ophangen aan lichtmasten op 8m hoogte in een magazijn." },
    { text: "🏭 Industriele staalbouw", prompt: "Ik zoek een zware telescoophoogwerker voor staalconstructie en industriebouw op ruw terrein tot 26m." }
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
          userProfile: wizardProfile
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get response from advisor server");
      }

      const data = await response.json();
      const rawReply = data.reply || "Excuus, ik ondervond een storing in mijn systeem. Probeer het opnieuw.";

      // Extract machine suggestions
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

  // ADVANCED LOGIC: Compute real-time compatibility scores for each machine
  const calculateCompatibility = (machine: Machine) => {
    let score = 50; // Base score
    const feedBackLogs: string[] = [];
    let isHeightFailing = false;
    let isReachFailing = false;

    // 1. Profile Match Booster
    const matchesUserProfession = machine.suitableFor.some(p => 
      p.toLowerCase().includes(wizardProfile.toLowerCase()) || 
      wizardProfile.toLowerCase().includes(p.toLowerCase())
    );
    if (matchesUserProfession) {
      score += 20;
      feedBackLogs.push(`OK: Gecertificeerd geschikt bevonden voor uw beroepsprofiel (${wizardProfile})`);
    } else {
      feedBackLogs.push(`Info: Secundaire machinekeuze voor ${wizardProfile}`);
    }

    // 2. Height calculation
    if (machine.height < requiredHeight) {
      score = 0;
      isHeightFailing = true;
      feedBackLogs.push(`Kritiek: De werkhoogte van deze machine (${machine.height}m) is onvoldoende voor uw klus (${requiredHeight}m)`);
    } else {
      const exactDifference = machine.height - requiredHeight;
      if (exactDifference <= 5) {
        score += 25;
        feedBackLogs.push(`OK: Optimale werkhoogte-efficiëntie gevonden (+${machine.height}m)`);
      } else {
        // Punish extreme height over-engineering (unnecessary rental cost)
        const penalty = Math.min(15, exactDifference * 1.5);
        score += Math.max(5, 20 - penalty);
        feedBackLogs.push(`Info: Hoogte is ruimschoots voldoende, maar let op eventuele overcapaciteit`);
      }
    }

    // 3. Horizontal reach calculation
    if (requiredReach > 0) {
      if (machine.reach < requiredReach) {
        score -= 30;
        isReachFailing = true;
        feedBackLogs.push(`Beperking: Zijwaarts bereik (${machine.reach}m) voldoet niet aan uw raming van ${requiredReach}m`);
      } else {
        score += 15;
        feedBackLogs.push(`OK: Zijwaarts bereik van ${machine.reach}m is ruim toereikend`);
      }
    }

    // 4. Working area / environment calculations (Indoor vs Outdoor)
    if (workArea === "binnen") {
      if (machine.powerType === "Elektrisch") {
        score += 15;
        feedBackLogs.push(`OK: Emissievrije elektrische aandrijving is verplicht voor binnenruimtes`);
      } else if (machine.powerType === "Hybride") {
        score += 10;
        feedBackLogs.push(`OK: Hybride stempels veilig te schakelen naar binnenruimtes`);
      } else {
        score -= 40;
        feedBackLogs.push(`Waarschuwing: Dieselmotor is onveilig voor gesloten binnengebruik (uitlaatemissie)`);
      }
    } else if (workArea === "buiten" && machine.powerType === "Diesel") {
      score += 10;
      feedBackLogs.push(`OK: Krachtige dieselmotor biedt optimale acceleratie voor buitenterreinen`);
    }

    // 5. Floor type checks
    if (floorType === "kwetsbaar") {
      if (machine.weight < 2500) {
        score += 15;
        feedBackLogs.push(`OK: Lichtgewicht chassis (<2500kg) beschermt kwetsbare binnenvloeren`);
      } else {
        score -= 25;
        feedBackLogs.push(`Waarschuwing: Dit model weegt ${machine.weight}kg en kan kwetsbare tegels kraken`);
      }
      if (machine.category === "spin") {
        score += 15;
        feedBackLogs.push(`OK: Brede rubberen rupsbanden verdelen de wieldruk optimaal`);
      }
    } else if (floorType === "onverhard") {
      if (machine.category === "telescoop" || machine.category === "knikarm") {
        score += 15;
        feedBackLogs.push(`OK: Uitgerust met 4WD ruw-terrein profielbanden`);
      } else if (machine.category === "schaarlift" && machine.powerType === "Elektrisch") {
        score -= 20;
        feedBackLogs.push(`Risico: Elektrische schaarlift heeft gladde banden en kan wegzakken op onverharde grond`);
      }
    }

    // 6. Budget cap checks
    if (machine.pricePerDay <= maxBudget) {
      score += 15;
      feedBackLogs.push(`OK: Binnen uw ingestelde budget-limiet van €${maxBudget}/dag`);
    } else {
      const priceExceeds = machine.pricePerDay - maxBudget;
      const penalty = Math.min(30, priceExceeds * 0.5);
      score -= Math.max(5, penalty);
      feedBackLogs.push(`Waarschuwing: Overschrijdt uw raming met €${priceExceeds}/dag extra`);
    }

    // 7. Special past rental booster (Personal Affinity Booster)
    const hasHistoryBoost = currentUser && currentUser.historyRecommendedIds?.includes(machine.id);
    if (hasHistoryBoost) {
      score += 12;
      feedBackLogs.push(`⭐ Voorkeur: U heeft dit type hoogwerker eerder gehuurd in uw ordergeschiedenis!`);
    }

    // Cap score at 100% and min at 0%
    const finalScore = isHeightFailing ? 0 : Math.max(0, Math.min(100, Math.round(score)));
    return {
      score: finalScore,
      logs: feedBackLogs,
      isHeightFailing,
      isReachFailing,
      hasHistoryBoost
    };
  };

  // Compile calculations with machines list
  const calculatedRecommendations = machines.map(m => {
    const calc = calculateCompatibility(m);
    return {
      machine: m,
      score: calc.score,
      logs: calc.logs,
      isHeightFailing: calc.isHeightFailing,
      isReachFailing: calc.isReachFailing,
      hasHistoryBoost: calc.hasHistoryBoost
    };
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-8 px-4 sm:px-6 lg:px-8">
      
      {/* Background Radial Glow */}
      <div className="absolute top-1/6 right-10 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px] -z-10" />

      <div className="mx-auto max-w-6xl">
        
        {/* Main Selector Tabs */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setActiveSubTab("wizard")}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
                activeSubTab === "wizard" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Slimme Selectiehulp Wizard</span>
            </button>
            <button
              onClick={() => setActiveSubTab("chat")}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
                activeSubTab === "chat" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Chat met AI Adviseur</span>
            </button>
          </div>
        </div>

        {activeSubTab === "wizard" ? (
          /* =============================================================
             SUB TAB: SMART RECOMMENDATION WIZARD ENGINE
             ============================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Input Criteria Parameters Card (Left Pane) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-5 flex flex-col justify-between self-start">
              <div>
                <h3 className="font-display font-extrabold text-slate-900 text-base flex items-center space-x-2">
                  <Sliders className="h-5 w-5 text-indigo-600" />
                  <span>Configuratie Raming</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Pas de parameters voor uw aankomende project aan. Onze raming rekent direct de compatibiliteit van onze vloot uit op basis van BMWT veiligheidstandaarden en uw profiel.
                </p>
              </div>

              <div className="space-y-4 pt-3 border-t border-slate-100">
                
                {/* Sector / Profile type preselected */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-mono font-bold uppercase block">Beroepsprofiel / Sector</label>
                  <select
                    value={wizardProfile}
                    onChange={(e) => setWizardProfile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-850 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="Schilder">🎨 Schilder</option>
                    <option value="Hovenier / Groenverzorging">🌳 Hovenier / Tree Surgeon</option>
                    <option value="Glazenwasser / Gevelreiniger">🧼 Glazenwasser & Gevelreiniging</option>
                    <option value="Aannemer">🧱 Aannemer & Heavy Construction</option>
                    <option value="Installateur / Elektricien">⚡ Installateur / Elektricien</option>
                    <option value="Dakdekker / Gevelwerker">🏠 Dakdekker & Gevelwerker</option>
                    <option value="Industrieel Onderhoud">⚙️ Industrieel Onderhoud</option>
                    <option value="Particulier">🏡 Particuliere Huurder</option>
                    <option value="Overig / Anders">❓ Overig / Anders</option>
                  </select>
                </div>

                {/* Slider Height */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11px] text-slate-500 font-mono font-bold uppercase">Minimale Werkhoogte</span>
                    <span className="text-indigo-700 font-bold font-mono bg-indigo-50 px-2 py-0.5 rounded-md">{requiredHeight} meter</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="35"
                    step="1"
                    value={requiredHeight}
                    onChange={(e) => setRequiredHeight(Number(e.target.value))}
                    className="w-full select-none h-1 rounded bg-slate-200 appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>5m</span>
                    <span>15m</span>
                    <span>25m</span>
                    <span>35m</span>
                  </div>
                </div>

                {/* Slider Reach */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11px] text-slate-500 font-mono font-bold uppercase">Horizontaal Bereik</span>
                    <span className="text-indigo-700 font-bold font-mono bg-indigo-50 px-2 py-0.5 rounded-md">{requiredReach} meter</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={requiredReach}
                    onChange={(e) => setRequiredReach(Number(e.target.value))}
                    className="w-full select-none h-1 rounded bg-slate-200 appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>Niet vereist (0m)</span>
                    <span>10m</span>
                    <span>20m</span>
                    <span>25m</span>
                  </div>
                </div>

                {/* Working Area Selection (Indoor, Outdoor, Both) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-mono font-bold uppercase block">Omgevingsklasse</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    {(["binnen", "buiten", "beide"] as const).map(env => (
                      <button
                        key={env}
                        onClick={() => setWorkArea(env)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg border-none cursor-pointer capitalize transition-all ${
                          workArea === env ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {env}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Floor Underlay Type Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-mono font-bold uppercase block">Fysieke Ondergrond</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    {(["vlak", "onverhard", "kwetsbaar"] as const).map(fl => (
                      <button
                        key={fl}
                        onClick={() => setFloorType(fl)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg border-none cursor-pointer capitalize transition-all ${
                          floorType === fl ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {fl === "vlak" ? "Vlak / Beton" : fl === "onverhard" ? "Unpaved / Tuin" : "Teer / Vloer"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11px] text-slate-500 font-mono font-bold uppercase">Maximale Dagprijs Raming</span>
                    <span className="text-teal-800 font-bold font-mono bg-teal-50 px-2 py-0.5 rounded-md">€ {maxBudget} / dag</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="400"
                    step="10"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(Number(e.target.value))}
                    className="w-full select-none h-1 rounded bg-slate-200 appearance-none cursor-pointer accent-teal-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>€100</span>
                    <span>€250</span>
                    <span>€400</span>
                  </div>
                </div>

              </div>

              {/* Informative Footer Box based on profile */}
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-150 border-indigo-100 rounded-2xl flex items-start space-x-2 text-[10px] text-slate-600 leading-normal">
                <History className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                <span>
                  {currentUser ? (
                    <><strong>Geschiedenis Synthese:</strong> Door uw profiel te koppelen aan <strong>{currentUser.name}</strong>, heeft de raming een affinity-booster geladen voor machines die u eerder positief huurde.</>
                  ) : (
                    <><strong>Bezoekersmodus Actief:</strong> Meld u aan in het Klant Portaal om uw eerdere huurgeschiedenis en klantspecifieke affinity-booster te activeren.</>
                  )
                  }
                </span>
              </div>
            </div>

            {/* Structured Recommendations Scoring (Right Pane) */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-black text-slate-900 text-base">Raming Resultaten & Aanbevelingen</h3>
                  <p className="text-xs text-slate-500">Gefilterd en gerangschikt naar realtime match-score</p>
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] font-mono text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 uppercase tracking-widest font-extrabold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Realtime Score</span>
                </div>
              </div>

              {/* Loop Sorted Machines */}
              <div className="space-y-4">
                {calculatedRecommendations.map((rec, index) => {
                  const m = rec.machine;
                  const isTopMatch = index === 0 && rec.score > 70;
                  const isExcluded = rec.score === 0;

                  return (
                    <div
                      key={m.id}
                      className={`border p-5 rounded-3xl transition-all relative overflow-hidden flex flex-col justify-between ${
                        isTopMatch 
                          ? "border-indigo-500 bg-indigo-50/40 shadow-md scale-[1.01]" 
                          : isExcluded 
                            ? "opacity-65 bg-red-50/40 border-red-200" 
                            : "bg-white border-slate-200 shadow-sm"
                      }`}
                    >
                      {/* Star Badge for previous rentals */}
                      {rec.hasHistoryBoost && (
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-indigo-700 text-white text-[8px] font-mono uppercase font-bold px-3 py-1 rounded-bl-xl flex items-center space-x-1">
                          <History className="h-3 w-3" />
                          <span>Eerder Gehuurd</span>
                        </div>
                      )}

                      {/* Header containing name, score, categorizations */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-250 border-slate-200">
                            <img 
                              src={m.imageUrl} 
                              alt="" 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => {
                                e.currentTarget.src = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop";
                              }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h4 className="text-xs sm:text-xs font-bold text-slate-900 leading-none">
                                {m.name}
                              </h4>
                              {isTopMatch && (
                                <span className="bg-amber-50 text-amber-700 font-extrabold text-[8px] font-sans px-1.5 py-0.5 rounded-full border border-amber-200 uppercase">Aanbevolen</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1.5 block">
                              Maximale hoogte: <strong>{m.height}m</strong> • Reikwijdte: <strong>{m.reach}m</strong> • Aandrijving: <strong>{m.powerType}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Visual compatibility percentage ring */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <div className="text-right">
                            <div className={`text-sm font-mono font-extrabold ${isExcluded ? 'text-rose-600' : 'text-teal-600'}`}>
                              {rec.score}% Match
                            </div>
                            <span className="text-[9px] text-slate-500 font-light block">BMWT Veiligheidsindex</span>
                          </div>
                          <div className="w-1.5 h-10 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`w-full rounded-full transition-all duration-500 ${isExcluded ? 'bg-rose-500' : 'bg-gradient-to-t from-teal-500 to-indigo-500'}`} 
                              style={{ height: `${rec.score}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Diagnostic rules audit (shows bulleted details of checks) */}
                      <div className="py-3 text-[10px] leading-relaxed text-slate-650 text-slate-600 space-y-1">
                        <span className="text-[9px] font-mono text-slate-400 font-extrabold uppercase tracking-wide block">Raming Verwerking:</span>
                        {rec.logs.map((log, lIdx) => (
                          <div 
                            key={lIdx} 
                            className={`flex items-start space-x-1.5 font-medium ${
                              log.startsWith('OK:') 
                                ? 'text-slate-700' 
                                : log.startsWith('Kritiek:') || log.startsWith('Beperking:')
                                  ? 'text-rose-600 font-bold' 
                                  : 'text-slate-500'
                            }`}
                          >
                            <span className="mt-0.5 shrink-0 select-none">•</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>

                      {/* Interactive click actions (Huur Direct) */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs font-mono font-extrabold text-teal-700">
                          €{m.pricePerDay}/dag <small className="text-slate-500 font-normal">incl. HubVerzekering</small>
                        </span>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => {
                              setSelectedDetailMachine(m);
                              onAddSystemLog?.(
                                "fleet",
                                currentUser ? currentUser.name : "Gast",
                                `Specificaties van ${m.name} ingezien via de Slimme Selectiehulp Wizard`
                              );
                            }}
                            className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
                          >
                            Details
                          </button>

                          <button
                            onClick={() => onSelectMachineForBooking(m)}
                            disabled={isExcluded}
                            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all border-none ${
                              isExcluded 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                : "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.03] active:scale-97 cursor-pointer"
                            }`}
                          >
                            {isExcluded ? "Onveilig voor deze klus" : "Direct Boeken & Verhuren"}
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          /* =============================================================
             SUB TAB: NATURAL CHAT ASSISTANT
             ============================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Main Chat Area */}
            <div className="lg:col-span-8 flex flex-col h-[65vh] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-md">
              
              {/* Advisor Header bar */}
              <div className="border-b border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-550 from-indigo-600 to-teal-500 shadow-sm">
                    <Sparkles className="h-5 w-5 text-white" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-teal-500 ring-2 ring-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-slate-900">Consulente Advisor</h3>
                    <p className="text-[10px] text-teal-700 font-mono tracking-wider uppercase leading-none mt-1">
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
                className="flex-1 overflow-y-auto p-5 space-y-4 space-x-reverse bg-gradient-to-b from-slate-50/50 to-white scrollbar-thin"
              >
                
                {messages.map((m) => {
                  const isUser = m.sender === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}

                      <div className="max-w-[85%]">
                        <div
                          className={`p-4 rounded-2xl text-[11.5px] sm:text-xs leading-relaxed border ${
                            isUser
                              ? "bg-slate-100 border-slate-205 border-slate-200/60 text-slate-800 rounded-tr-none"
                              : "bg-indigo-50 border-indigo-100 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-line leading-relaxed">
                            {m.text}
                          </p>
                        </div>

                        {/* Suggestions */}
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
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 transition-all group shadow-sm"
                                  >
                                    <div className="flex items-center space-x-2.5">
                                      <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                        <img 
                                          src={foundMachine.imageUrl} 
                                          alt="" 
                                          className="h-full w-full object-cover group-hover:scale-105 transition-transform" 
                                          referrerPolicy="no-referrer" 
                                          onError={(e) => {
                                            e.currentTarget.src = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop";
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-bold text-slate-900 leading-none">
                                          {foundMachine.name}
                                        </h4>
                                        <span className="text-[10px] text-teal-600 mt-1 block font-mono">
                                          €{foundMachine.pricePerDay}/dag
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-1.5 shrink-0">
                                      <button
                                        onClick={() => {
                                          setSelectedDetailMachine(foundMachine);
                                          onAddSystemLog?.(
                                            "system",
                                            currentUser ? currentUser.name : "Gast",
                                            `Bekijkt specificaties van AI aanbevolen machine: "${foundMachine.name}"`
                                          );
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[10px] font-bold transition-all cursor-pointer"
                                      >
                                        Details
                                      </button>
                                      <button
                                        onClick={() => onSelectMachineForBooking(foundMachine)}
                                        className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border-none"
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

                        <span className="text-[9px] font-mono text-slate-500 mt-1 block text-right">
                          {new Date(m.timestamp).toLocaleTimeString("nl-NL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {isUser && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-750 border border-teal-100 shrink-0">
                          <User className="h-4 w-4 text-teal-700" />
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
                        <div className="h-2 w-2 rounded-full bg-blue-550 bg-blue-500 animate-bounce" />
                        <span className="text-[10px] text-slate-500 font-medium ml-1.5">Advisor analyseert...</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div />
              </div>

              {/* Chat Form Area */}
              <div className="p-4 bg-slate-50 border-t border-slate-150 border-slate-200 flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMessage();
                    }}
                    placeholder="Beschrijf uw werkhoogte, obstakels of uw project..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-450 placeholder-slate-400 outline-none focus:border-indigo-505 focus:border-indigo-500 transition-colors"
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
                  Pas een van de rollenspelen toe om de intelligentie van ons model te testen over specifieke klussen.
                </p>
                
                <div className="flex flex-col gap-2 pt-2">
                  {quickActionChips.map((chip, idx) => {
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip.prompt)}
                        className="text-left text-xs bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-900 p-2.5 rounded-xl transition-all duration-300 cursor-pointer shadow-sm"
                      >
                        {chip.text}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-indigo-100 bg-indigo-50/50 p-5 rounded-3xl space-y-3 shadow-sm">
                <h4 className="font-display font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                  <Layers className="h-4 w-4 text-teal-650 text-teal-600 animate-pulse" />
                  <span>Onze Vloot Bereik Checklist</span>
                </h4>
                <p className="text-[10.5px] text-slate-600 leading-relaxed">
                  Onze vloot herbergt gecertificeerde typen die binnenshuis fluisterstil en buitenshuis ruw-terrein bestendig zijn.
                </p>
                <div className="space-y-2 pt-2 text-[10px] font-mono text-slate-500">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Schaarlift (Schilderen, loods)</span>
                    <span className="text-slate-800 font-bold">v.a. 12m</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Knikarm (Obstakels gevels)</span>
                    <span className="text-slate-800 font-bold">v.a. 18m</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Telescoop (Zware bouw)</span>
                    <span className="text-slate-800 font-bold">v.a. 26m</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Autohoogwerker (Mobiliteit)</span>
                    <span className="text-slate-800 font-bold">v.a. 22m</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span>Spinhoogwerker (Krappe tuin)</span>
                    <span className="text-slate-800 font-bold">v.a. 15m</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Technical & Pricing Information Panel */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl space-y-3.5 shadow-sm">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <h4 className="font-display font-semibold text-xs text-slate-900 uppercase tracking-wider">
                    Gecertificeerde AI-Veiligheid & Privacy
                  </h4>
                </div>
                
                <div className="space-y-2.5 text-[11px] leading-relaxed text-slate-605 text-slate-600 font-medium">
                  <p>
                    <strong>Data Beveiliging:</strong> Uw ingevoerde details en chats worden verwerkt via een beveiligde full-stack API proxy (<code>/api/gemini/advisor</code>). Er worden geen persoonlijke gegevens extern opgeslagen.
                  </p>
                  
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 font-sans shadow-sm text-[10.5px]">
                    <div className="flex justify-between text-slate-500">
                      <span>AI Certificering:</span>
                      <span className="text-teal-700 font-semibold">Gemini Smart Shield</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Gegevenscodering:</span>
                      <span className="text-slate-700 font-semibold">SSL / 256-bit AES</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Veiligheidstandaard:</span>
                      <span className="text-slate-700 font-semibold">BMWT & ISO-proof</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-100 pt-1 mt-1">
                      <span>Live Systeem Status:</span>
                      <span className="flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Optimaal & Actief</span>
                      </span>
                    </div>
                  </div>

                  <p>
                    <strong>BMWT-Rustregels:</strong> Onze AI-hoogwerkanalist adviseert uitsluitend conform de officiële veiligheidsnormen en rekening houdend met de verplichte rust- en transporttijden.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* WhatsApp Help Banner */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4.5 transition-all text-left gap-4 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-slate-800 text-xs sm:text-sm">Kun je de juiste machine of optie niet vinden?</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">
                Geen probleem! Onze vloot-experts staan stand-by. Stuur ons direct een WhatsApp-bericht voor direct persoonlijk advies en antwoord op al uw vragen.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/31645617283"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-98 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span>Chat Direct op WhatsApp</span>
            <span>💬</span>
          </a>
        </div>

      </div>

      {/* Specifications & Bundle Contents Modal */}
      <AnimatePresence>
        {selectedDetailMachine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailMachine(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col max-h-[90vh]"
            >
              {/* Premium Gradient Top Stripe */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-400 via-indigo-500 to-amber-400" />

              {/* Close Button & Header */}
              <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                  <span className="text-[10px] text-teal-650 font-mono uppercase tracking-widest block font-bold">
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

              {/* Scrollable Layout Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT COLUMN: Image & Quick Details */}
                  <div className="md:col-span-12 lg:col-span-5 space-y-4">
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-white/5 relative">
                      <img 
                        src={selectedDetailMachine.imageUrl} 
                        alt={selectedDetailMachine.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent pointer-events-none" />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3.5">
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

                      {/* Call to action button */}
                      <button
                        onClick={() => {
                          setSelectedDetailMachine(null);
                          onSelectMachineForBooking(selectedDetailMachine);
                        }}
                        className="w-full relative overflow-hidden flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border border-indigo-500/25 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer border-none"
                      >
                        <ShoppingBag className="h-4 w-4 text-white" />
                        <span>Huur Nu Direct</span>
                      </button>
                    </div>

                    {/* Suitability guidelines */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2 font-bold">Perfect Geschikt Voor:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDetailMachine.suitableFor.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-semibold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: Specifications & Contents */}
                  <div className="md:col-span-12 lg:col-span-7 space-y-5">
                    
                    {/* Rich description */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-indigo-700 uppercase tracking-widest block font-bold">Omschrijving & Toepassing</label>
                      <p className="text-slate-600 text-xs leading-relaxed font-sans">
                        {selectedDetailMachine.description}
                      </p>
                    </div>

                    {/* Package Included Contents Section */}
                    <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-xl rounded-full pointer-events-none" />
                      <div className="flex items-center space-x-2">
                        <ShoppingBag className="h-4 w-4 text-teal-605 text-teal-600" />
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                          Inbegrepen Pakketinhoud ({selectedDetailMachine.id.startsWith("set-") ? "Klusgids Set" : "Standaard inspectie"})
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {((machineId: string) => {
                          switch (machineId) {
                            case "set-paint-comfort":
                              return [
                                "1x Gecertificeerde Elektrische Schaarlift (12m werkhoogte)",
                                "2x 20m zware rubberen verlengkabels (230V / IP44)",
                                "1x Handige gereedschapsbak gemonteerd op het werkplatform",
                                "1x Luxe comfort-veiligheidsharnas (EN-361 gekeurd)",
                                "4x Non-marking witte banden (geen sporen op luxe vloeren)",
                                "10m Vloerbeschermingsvlies (gratis meegeleverd)"
                              ];
                            case "set-solar-pro":
                              return [
                                "1x Knikarmhoogwerker (18m werkhoogte, 16m zijdelings bereik)",
                                "2x Heavy-duty materiaalgordels met verstelbare karbijnhaakjes",
                                "1x Speciaal ontworpen zonnepaneel-draagbeugel aan de korf",
                                "1x Alleenstaand EN-361 Premium valbeveiligingsset Pro met schokdemper",
                                "1x Geïntegreerde 230V stroomaansluiting rechtstreeks in de werkbak",
                                "All-Risk Casco schadeverzekering (geen eigen risico op dakschade)"
                              ];
                            case "set-prune-compact":
                              return [
                                "1x Spinhoogwerker Spider (15m werkhoogte) op smalle rupsbanden",
                                "4x Heavy-duty kunststof rijplaten (voorkomt sporen in gazons)",
                                "1x Gecertificeerde bosbouwer snoeihelm met vizier en oorkappen",
                                "1x Magnetische relingtray voor snoeigereedschappen",
                                "1x Biologische kettingzaag olie (1 Liter)",
                                "1x Spanbandenset voor extra stempelfixatie op hellingen"
                              ];
                            case "set-gutter-fast":
                              return [
                                "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist)",
                                "1x Telescopische dakgootschep & telescopische trekker/bezem set",
                                "1x Geïntegreerde 230V stroomaansluiting in de korf",
                                "1x Geperforeerde aluminium werkbak voor emmers en afval",
                                "1x Set van 4 wegafzetting pionnen met reflecterende strips",
                                "1x Veiligheidshesje en handschoenen (maat L)"
                              ];
                            case "set-facade-heavy":
                              return [
                                "1x Telescoophoogwerker Diesel (26m werkhoogte) - 4x4 aangedreven",
                                "2x Slanghaspel mastklemmen voor hogedrukslangen tot korf",
                                "1x Geïntegreerde generator unit (stroom & hogedrukwatertoevoer)",
                                "1x Volledige All-Risk Casco dekking zonder eigen risico",
                                "2x Waterdichte mouwbeschermers & vizierbrillen voor gevelspuiten",
                                "1x RVS werkbakorganizer voor spuitlansen"
                              ];
                            case "set-window-premium":
                              return [
                                "1x Autohoogwerker (22m werkhoogte, B-Rijbewijs vereist)",
                                "1x Osmose watertank montagebeugels aan de werkbak",
                                "1x Extra brede 2-persoons platformbak (gondel)",
                                "4x Stempelschotels om wegzakken in zachte straatstenen te voorkomen",
                                "1x Ruitenwisserset Pro (trekkers, inwasmoffen & telescoopsteel)",
                                "1x Waterbestendige opbergtas aan de korf"
                              ];
                            case "set-diy-weekend":
                              return [
                                "1x Compacte Elektrische Schaarlift (12m werkhoogte)",
                                "1x Comfort EN-361 gecertificeerd veiligheidsharnas",
                                "1x Premium klushelm met kinband",
                                "1x Stap-voor-stap gedrukte handleiding 'Veilig Werken op Hoogte'",
                                "Voorrangstoegang tot onze 24/7 telefonische hulplijn (WhatsApp)"
                              ];
                            case "set-light-install":
                              return [
                                "1x Spinhoogwerker Hybrid (15m werkhoogte) op rupsen",
                                "1x Automatische veertrommel haspelkit voor mastbekabeling",
                                "1x Magnetische bak voor schroeven, klemmen en zekeringen",
                                "2x Comfort harnassen met snelgespen",
                                "1x Professionele laser nevelmeter (te leen)"
                              ];
                            default:
                              return [
                                "1x Professionele en gekeurde machine",
                                "1x Volle tank brandstof of 100% opgeladen accupakket",
                                "1x Hub service inspectie voorafgaand aan aflevering",
                                "BMWT Veiligheidscertificaat handleiding in de werkbak",
                                "24/7 Technische storingshulp & backup service"
                              ];
                          }
                        })(selectedDetailMachine.id).map((item, idx) => (
                          <div key={idx} className="flex items-start space-x-1.5 text-xs text-slate-700">
                            <span className="text-teal-600 font-bold shrink-0 mt-0.5 font-mono">✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detailed Specifications Listing */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Technische Specificaties</h4>
                      
                      <div className="grid grid-cols-2 gap-3 font-sans">
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

                    {/* Safety compliance guarantees */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl text-[10.5px] text-slate-600 gap-3">
                      <div className="flex items-center space-x-2">
                        <span className="bg-amber-100 border border-amber-200 text-amber-900 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold font-mono">BMWT</span>
                        <span>Jaarlijks veilig geverifieerd</span>
                      </div>
                      <span className="text-indigo-600 font-mono">Art. ID: {selectedDetailMachine.id}</span>
                    </div>

                  </div>

                </div>

              </div>
              
              {/* Footer */}
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
