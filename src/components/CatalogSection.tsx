import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowUpToLine, 
  ArrowRightLeft, 
  Weight, 
  Zap, 
  Check, 
  Filter, 
  Search, 
  Sparkles, 
  Flame, 
  Cpu, 
  RotateCcw,
  ShoppingBag,
  Info,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine } from "../types";

interface CatalogSectionProps {
  machines: Machine[];
  customCategories?: {
    id: string;
    label: string;
    listLabel?: string;
    desc: string;
    heights: string;
    price: string;
  }[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  onSelectMachineForBooking: (machine: Machine) => void;
  aiRecommendedMachineIds: string[]; // Machine IDs suggested by the advisor
  onAddSystemLog?: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  currentUser?: { name: string } | null;
}

export default function CatalogSection({
  machines,
  customCategories = [],
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onSelectMachineForBooking,
  aiRecommendedMachineIds,
  onAddSystemLog,
  currentUser,
}: CatalogSectionProps) {
  // Filters state
  const [maxHeight, setMaxHeight] = useState<number>(40);
  const [maxPrice, setMaxPrice] = useState<number>(500);
  const [selectedPowerTypes, setSelectedPowerTypes] = useState<string[]>(["Elektrisch", "Diesel", "Hybride"]);
  const [sortBy, setSortBy] = useState<string>("default");

  // Compare state
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [selectedDetailMachine, setSelectedDetailMachine] = useState<Machine | null>(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
  const [showFiltersMobile, setShowFiltersMobile] = useState<boolean>(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setActiveDetailImageIndex(0);
  }, [selectedDetailMachine]);

  const togglePowerType = (type: string) => {
    if (selectedPowerTypes.includes(type)) {
      setSelectedPowerTypes(selectedPowerTypes.filter(t => t !== type));
    } else {
      setSelectedPowerTypes([...selectedPowerTypes, type]);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setMaxHeight(40);
    setMaxPrice(500);
    setSelectedPowerTypes(["Elektrisch", "Diesel", "Hybride"]);
    setSortBy("default");
  };

  const categoryTabs = useMemo(() => [
    { id: "all", label: "Alle Types" },
    ...customCategories.map((category) => ({
      id: category.id,
      label: category.listLabel || category.label
    }))
  ], [customCategories]);

  // Filtered & Sorted Machines
  const filteredMachines = useMemo(() => {
    const filtered = machines.filter((machine) => {
      // Category Match
      const matchesCategory = selectedCategory === "all" 
        ? machine.category !== "klussensets" 
        : machine.category === selectedCategory;
      
      // Search Match
      const matchesSearch = 
        searchQuery.trim() === "" || 
        machine.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.suitableFor.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()));

      // Height Match
      const matchesHeight = machine.height <= maxHeight;

      // Price Match
      const matchesPrice = machine.pricePerDay <= maxPrice;

      // Power Match
      const matchesPower = selectedPowerTypes.includes(machine.powerType);

      return matchesCategory && matchesSearch && matchesHeight && matchesPrice && matchesPower;
    });

    // Apply Sorting logic
    if (sortBy === "price_asc") {
      return [...filtered].sort((a, b) => a.pricePerDay - b.pricePerDay);
    } else if (sortBy === "price_desc") {
      return [...filtered].sort((a, b) => b.pricePerDay - a.pricePerDay);
    } else if (sortBy === "height_asc") {
      return [...filtered].sort((a, b) => a.height - b.height);
    } else if (sortBy === "height_desc") {
      return [...filtered].sort((a, b) => b.height - a.height);
    }

    return filtered;
  }, [machines, selectedCategory, searchQuery, maxHeight, maxPrice, selectedPowerTypes, sortBy]);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] py-6 sm:py-10 px-5 sm:px-6 lg:px-8">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-10 left-5 h-80 w-80 rounded-full bg-blue-600/5 blur-[100px] -z-10" />

      <div className="mx-auto max-w-7xl">
        
        {/* Title Deck */}
        <div className="mb-6">
          <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center space-x-2">
            <span>Ons Machinepark</span>
            {aiRecommendedMachineIds.length > 0 && (
              <span className="flex items-center space-x-1 text-[11px] font-mono uppercase bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-full animate-pulse ml-2.5">
                <Sparkles className="h-3 w-3 text-indigo-600" />
                <span>AI Match Beschikbaar</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Professioneel gekeurde en direct leverbare hoogwerkers voor elk type werkzaamheid in heel Nederland.
          </p>
        </div>

        {/* Clean Unified Control Bar (Responsive) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm mb-6">
          {/* Left/Main: Category tabs */}
          <div className="flex-grow min-w-0">
            <nav 
              aria-label="Categorie filter" 
              className="flex items-center space-x-1.5 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none"
            >
              {categoryTabs.map((tab) => {
                const isActive = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSelectedCategory(tab.id);
                      onAddSystemLog?.(
                        "system",
                        currentUser ? currentUser.name : "Gast",
                        `Filtert catalogus op categorie: "${tab.label}"`
                      );
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all border cursor-pointer ${
                      isActive 
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions (Sort, Reset, Mobile Filter Toggle) */}
          <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
            {/* Mobile Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="lg:hidden flex items-center space-x-1.5 bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-sm"
            >
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              <span>{showFiltersMobile ? "Verberg" : "Filters"}</span>
              <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.2 rounded-full">
                {filteredMachines.length}
              </span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 hover:border-indigo-400 transition-colors shadow-sm">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs font-bold bg-transparent focus:outline-none cursor-pointer text-slate-800 border-none p-0 pr-1 select-none"
              >
                <option value="default">Sorteer: Standaard</option>
                <option value="price_asc">Laagste prijs</option>
                <option value="price_desc">Hoogste prijs</option>
                <option value="height_asc">Minimale hoogte</option>
                <option value="height_desc">Maximale hoogte</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetFilters}
              title="Filters Herstellen"
              className="flex items-center justify-center text-slate-500 hover:text-rose-600 transition-colors p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 cursor-pointer shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Outer Split Wrapper (Filters left, Grid right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          
          {/* LEFT: Floating Sticky Filter Controls */}
          <div className="lg:col-span-3 lg:sticky lg:top-24">
            
            {/* Filter Content */}
            <div className={`glass-panel p-5 rounded-2xl space-y-6 bg-white border border-slate-200 shadow-sm ${
              showFiltersMobile ? "block" : "hidden lg:block"
            } mb-6 lg:mb-0`}>
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Filters</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-full">
                  {filteredMachines.length} vloot
                </span>
              </div>

              {/* Text Search Input */}
              <div className="space-y-2">
                <label htmlFor="catalog-search" className="text-xs font-bold text-slate-700 block">Snel Zoeken</label>
                <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200/80 px-2.5 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-colors">
                  <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
                  <input
                    id="catalog-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchQuery.trim()) {
                        onAddSystemLog?.(
                          "system",
                          currentUser ? currentUser.name : "Gast",
                          `Zoekt in catalogus naar: "${searchQuery}"`
                        );
                      }
                    }}
                    onBlur={() => {
                      if (searchQuery.trim()) {
                        onAddSystemLog?.(
                          "system",
                          currentUser ? currentUser.name : "Gast",
                          `Zoekt in catalogus naar: "${searchQuery}"`
                        );
                      }
                    }}
                    placeholder="Schilder, 15m, rups..."
                    className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Slider: Working Height */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="height-range" className="font-bold text-slate-700">Min. Werkhoogte</label>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{maxHeight} meter</span>
                </div>
                <input
                  id="height-range"
                  type="range"
                  min="10"
                  max="40"
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>10m</span>
                  <span>25m</span>
                  <span>40m</span>
                </div>
              </div>

              {/* Slider: Max Tarief / Dag */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="price-range" className="font-bold text-slate-700">Max. Huurtarief/dag</label>
                  <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">€{maxPrice}</span>
                </div>
                <input
                  id="price-range"
                  type="range"
                  min="100"
                  max="500"
                  step="20"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>€100</span>
                  <span>€300</span>
                  <span>€500</span>
                </div>
              </div>

              {/* Checkboxes: Power Source Types */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 block">Aandrijving</label>
                <div className="space-y-2">
                  {["Elektrisch", "Diesel", "Hybride"].map((power) => {
                    const isChecked = selectedPowerTypes.includes(power);
                    return (
                      <label
                        key={power}
                        className="flex items-center space-x-2.5 cursor-pointer select-none group"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePowerType(power)}
                          className="sr-only"
                        />
                        <div className={`h-4 w-4 rounded flex items-center justify-center border transition-all ring-offset-1 focus-within:ring-2 focus-within:ring-indigo-500/50 ${
                          isChecked 
                            ? "bg-indigo-600 border-indigo-700 text-white" 
                            : "bg-slate-50 border-slate-200 group-hover:border-slate-350 group-hover:border-slate-300"
                        }`}>
                          {isChecked && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-xs font-medium text-slate-650 group-hover:text-slate-800 transition-colors">
                          {power}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT: Grid Machinery Deck */}
          <div className="lg:col-span-9 space-y-6">

            {/* Micro Warning if list is empty */}
            {filteredMachines.length === 0 && (
              <div className="glass-panel p-12 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 bg-white border border-slate-200 shadow-sm">
                <Info className="h-8 w-8 text-indigo-600" />
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Geen machines gevonden</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Er zijn momenteel geen machines die voldoen aan al uw geselecteerde filtercriteria. Probeer uw bereik of tariefgrenzen te verhogen.
                  </p>
                </div>
                <button
                  onClick={resetFilters}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0"
                >
                  Alle filters wissen
                </button>
              </div>
            )}

            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredMachines.map((machine) => {
                  const isRecommended = aiRecommendedMachineIds.includes(machine.id);
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      key={machine.id}
                      className={`machine-card group relative overflow-hidden rounded-2xl border ${
                        isRecommended 
                          ? "border-indigo-500 bg-white shadow-lg animate-pulse-intensity" 
                          : "border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                      } flex flex-col justify-between min-h-[460px]`}
                    >
                      {/* AI Spark indicator badge */}
                      {isRecommended && (
                        <div className="absolute top-3.5 left-3.5 z-20 flex items-center space-x-1.5 bg-indigo-600 py-1 px-3 rounded-full text-[9px] font-extrabold uppercase tracking-widest text-white shadow-md">
                          <Sparkles className="h-3 w-3 text-emerald-300" />
                          <span>AI Geadviseerd</span>
                        </div>
                      )}

                      {/* Header Category and Power indicator & Compare checkbox */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        onMouseDown={(e) => e.stopPropagation()} 
                        className="absolute top-3.5 right-3.5 z-20 flex items-center space-x-1.5"
                      >
                        <span className="bg-slate-900/95 backdrop-blur text-white px-2 py-0.5 rounded-md text-[9px] font-mono tracking-wider font-bold">
                          {machine.powerType}
                        </span>

                        <div className="bg-white/95 backdrop-blur border border-slate-200 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 hover:border-indigo-400 transition-colors shadow-sm">
                          <input
                            id={`compare-${machine.id}`}
                            type="checkbox"
                            checked={compareIds.includes(machine.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked) {
                                if (compareIds.length >= 4) {
                                  return;
                                }
                                setCompareIds(prev => [...prev, machine.id]);
                              } else {
                                setCompareIds(prev => prev.filter(id => id !== machine.id));
                              }
                            }}
                            className="h-3.5 w-3.5 accent-indigo-600 bg-white border-slate-300 rounded cursor-pointer"
                          />
                          <label htmlFor={`compare-${machine.id}`} className="text-[10px] text-slate-850 font-bold tracking-wide font-sans cursor-pointer select-none">
                            Vergelijk
                          </label>
                        </div>
                      </div>

                      {/* MACHINE IMAGE: Smooth scale on hover */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-50 border-b border-slate-100">
                        <img
                          src={machine.imageUrl}
                          alt={machine.imageAlt}
                          className="h-full w-full object-cover group-hover:scale-106 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-machine.webp";
                          }}
                        />
                        {/* Shimmer overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent pointer-events-none" />
                      </div>

                      {/* DATA CONTAINER */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        
                        <div className="space-y-2">
                          <h3 className="font-display font-extrabold text-base text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
                            {machine.name}
                          </h3>
                          <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                            {machine.description}
                          </p>
                        </div>

                        {/* SPEC BADGES - Premium mini icons */}
                        <div className="grid grid-cols-3 gap-2 py-3.5 border-t border-b border-slate-200 my-3.5 bg-slate-50 rounded-xl px-2">
                          
                          <div className="text-center">
                            <ArrowUpToLine className="h-4 w-4 mx-auto text-indigo-600" />
                            <span className="text-[10px] font-mono font-extrabold text-slate-800 block mt-1">
                              {machine.height} m
                            </span>
                            <span className="text-[9px] text-slate-500 block">Werkhoogte</span>
                          </div>

                          <div className="text-center">
                            <ArrowRightLeft className="h-4 w-4 mx-auto text-teal-650" />
                            <span className="text-[10px] font-mono font-extrabold text-slate-800 block mt-1">
                              {machine.reach} m
                            </span>
                            <span className="text-[9px] text-slate-500 block">Bereik</span>
                          </div>

                          <div className="text-center">
                            <Weight className="h-4 w-4 mx-auto text-amber-600" />
                            <span className="text-[10px] font-mono font-extrabold text-slate-800 block mt-1">
                              {machine.weight} kg
                            </span>
                            <span className="text-[9px] text-slate-500 block">Gewicht</span>
                          </div>

                        </div>

                        {/* PRICE & HUUR NU BUTTON - Responsive layout */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pt-2 border-t border-slate-100 mt-2">
                          <div className="flex sm:flex-col items-baseline justify-between sm:justify-start w-full sm:w-auto">
                            <span className="text-[9px] text-slate-500 uppercase font-bold font-mono">Dagtotaal</span>
                            <div className="flex items-baseline space-x-0.5">
                              <span className="text-lg font-bold text-teal-700 font-mono">€{machine.pricePerDay}</span>
                              <span className="text-[10px] text-slate-500 font-medium">/dag</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                setSelectedDetailMachine(machine);
                                onAddSystemLog?.(
                                  "system",
                                  currentUser ? currentUser.name : "Gast",
                                  `Bekijkt technische specificaties van: "${machine.name}"`
                                );
                              }}
                              className="flex-1 sm:flex-none text-center px-2.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[11px] font-bold transition-all active:scale-97 cursor-pointer"
                              title="Bekijk alle details & specificaties"
                            >
                              Details
                            </button>

                            <button
                              onClick={() => onSelectMachineForBooking(machine)}
                              className="flex-[2] sm:flex-none relative overflow-hidden flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-bold transition-all hover:scale-[1.03] active:scale-97 hover:border-indigo-500/60 shadow-[0_2px_10px_rgba(79,70,229,0.15)] cursor-pointer whitespace-nowrap"
                            >
                              <ShoppingBag className="h-3.5 w-3.5 text-teal-350 text-teal-300" />
                              <span>Huur Nu</span>
                            </button>
                          </div>
                        </div>

                      </div>

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

          </div>

        </div>

      </div>

      {/* Sticky floating 'Vergelijk Machines' bar */}
      <AnimatePresence>
        {compareIds.length >= 2 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-white border border-slate-200 shadow-xl rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center space-x-3 w-full sm:w-auto overflow-x-auto py-1 scrollbar-none">
              <div className="bg-indigo-50 p-2 rounded-xl shrink-0 animate-pulse">
                <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="shrink-0">
                <h4 className="text-xs font-bold text-slate-900">Vergelijk Machines</h4>
                <p className="text-[10px] text-slate-500 font-mono">{compareIds.length} geselecteerd (max 4)</p>
              </div>
              
              {/* Small horizontal preview grid */}
              <div className="flex items-center space-x-2 pl-2">
                {compareIds.map(id => {
                  const m = machines.find(item => item.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="relative group/thumb shrink-0">
                      <img 
                        src={m.imageUrl} 
                        alt={m.name} 
                        className="h-8 w-12 object-cover rounded-md border border-slate-200" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-machine.webp";
                        }}
                      />
                      <button
                        onClick={() => setCompareIds(compareIds.filter(cid => cid !== id))}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 transition-colors cursor-pointer z-10"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => setCompareIds([])}
                className="px-4 py-2 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer transition-colors"
              >
                Wissen
              </button>

              <button
                onClick={() => setShowCompareModal(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition-all cursor-pointer text-white flex items-center justify-center space-x-1.5"
              >
                <span>Vergelijk Nu</span>
                <ArrowRightLeft className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal Overlay */}
      <AnimatePresence>
        {showCompareModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCompareModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col max-h-[90vh] my-8"
            >
              {/* Top bar stripe */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-indigo-505 via-indigo-500 to-amber-500" />

              <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                  <span className="text-[10px] text-indigo-600 font-mono uppercase tracking-wider block font-bold">Zij-aan-zij Vergelijking</span>
                  <h3 className="font-display text-2xl font-black text-slate-900 tracking-tight">Vloot Specificatievergelijker</h3>
                </div>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="p-1.5 rounded-xl bg-slate-150 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable grid Table container */}
              <div className="overflow-x-auto flex-1 pb-4 scrollbar-thin scrollbar-thumb-white/10">
                <div className="min-w-[640px] divide-y divide-white/5 space-y-4">
                  {/* Header cards row */}
                  <div className="grid grid-cols-5 gap-4 pb-4">
                    <div className="col-span-1 flex flex-col justify-end">
                      <p className="text-[10px] text-slate-500 uppercase font-bold font-mono">Eigenschappen</p>
                    </div>

                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      if (!m) return <div key={id} className="col-span-1" />;
                      return (
                        <div key={id} className="col-span-1 bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between space-y-3 relative group">
                          <button
                            onClick={() => setCompareIds(compareIds.filter(cid => cid !== id))}
                            className="absolute top-2 right-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-lg p-1 transition-colors z-20 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-200">
                            <img 
                              src={m.imageUrl} 
                              alt={m.name} 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-machine.webp";
                              }}
                            />
                          </div>

                          <div>
                            <h4 className="font-sans font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                              {m.name}
                            </h4>
                            <span className="text-[9px] font-mono text-indigo-600 block mt-1 uppercase tracking-wider">{m.categoryLabel}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pad remaining empty slots up to 4 columns */}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="col-span-1 border border-dashed border-white/5 bg-white/2 rounded-2xl flex flex-col items-center justify-center p-4 min-h-[140px]">
                        <p className="text-[10.5px] text-slate-500 font-mono text-center">Selecteer nog een machine...</p>
                      </div>
                    ))}
                  </div>

                  {/* Row 1: Werkhoogte */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <ArrowUpToLine className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>Werkhoogte</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-bold text-white text-center sm:text-left">
                          {m ? `${m.height} meter` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-h-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 2: Zijdelings Bereik */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <ArrowRightLeft className="h-4 w-4 text-teal-400 shrink-0" />
                      <span>Zijdelings Bereik</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-bold text-white text-center sm:text-left">
                          {m ? `${m.reach} meter` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-r-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 3: Machinegewicht */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <Weight className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Machinegewicht</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-bold text-white text-center sm:text-left">
                          {m ? `${m.weight.toLocaleString('nl-NL')} kg` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-w-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 4: Aandrijving */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Aandrijving</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-bold text-slate-300 text-center sm:text-left">
                          {m ? m.powerType : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-p-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 5: Geschikt voor */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-start text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Geschikt voor</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 flex flex-wrap gap-1">
                          {m ? m.suitableFor.map((app, idx2) => (
                            <span key={idx2} className="inline-block bg-white/5 border border-white/5 px-2 py-0.5 rounded text-[10px] text-indigo-300">
                              {app}
                            </span>
                          )) : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-s-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 6: Tarief per dag */}
                  <div className="grid grid-cols-5 gap-4 py-3 items-center text-xs">
                    <div className="col-span-1 font-bold text-slate-400 flex items-center space-x-1.5">
                      <span className="font-mono font-black text-teal-400 text-sm">€</span>
                      <span>Tarief / dag</span>
                    </div>
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      return (
                        <div key={id} className="col-span-1 font-mono font-extrabold text-[#14b8a6] text-sm text-center sm:text-left">
                          {m ? `€ ${m.pricePerDay}` : "—"}
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-t-${idx}`} className="col-span-1 text-center font-mono text-slate-600">—</div>
                    ))}
                  </div>

                  {/* Row 7: Direct Boeken */}
                  <div className="grid grid-cols-5 gap-4 py-4 items-center">
                    <div className="col-span-1" />
                    {compareIds.map(id => {
                      const m = machines.find(item => item.id === id);
                      if (!m) return <div key={id} className="col-span-1" />;
                      return (
                        <div key={id} className="col-span-1">
                          <button
                            onClick={() => {
                              setShowCompareModal(false);
                              onSelectMachineForBooking(m);
                            }}
                            className="w-full relative overflow-hidden flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-600 hover:bg-indigo-505 bg-indigo-500 text-white text-xs font-bold transition-all hover:scale-[1.03] active:scale-97 cursor-pointer text-center"
                          >
                            <ShoppingBag className="h-3.5 w-3.5 text-teal-300" />
                            <span>Direct Boeken</span>
                          </button>
                        </div>
                      );
                    })}
                    {Array.from({ length: 4 - compareIds.length }).map((_, idx) => (
                      <div key={`empty-b-${idx}`} className="col-span-1 font-mono text-slate-600">—</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer warning */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-500 text-[10px] uppercase font-mono tracking-wider shrink-0 mt-2">
                <span>BMWT-Veiligheidsgids 2026 - Hub inspectie inbegrepen</span>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold tracking-normal uppercase transition-colors cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Specifications & Bundle Contents Modal */}
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
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Layout Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT COLUMN: Image & Quick Details */}
                  <div className="md:col-span-12 lg:col-span-5 space-y-4">
                    {(() => {
                      const allDetailImages = [
                        selectedDetailMachine.imageUrl,
                        ...(selectedDetailMachine.additionalImages || [])
                      ].filter(Boolean);

                      return (
                        <>
                          {/* Main Image Slider */}
                          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-sm relative group">
                            <AnimatePresence mode="wait">
                              <motion.img 
                                key={activeDetailImageIndex}
                                src={allDetailImages[activeDetailImageIndex] || "/placeholder-machine.webp"} 
                                alt={`${selectedDetailMachine.name} - ${activeDetailImageIndex}`} 
                                className="w-full h-full object-cover"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder-machine.webp";
                                }}
                              />
                            </AnimatePresence>
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent pointer-events-none" />

                            {allDetailImages.length > 1 && (
                              <>
                                {/* Navigation Chevrons */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDetailImageIndex((prev) => (prev === 0 ? allDetailImages.length - 1 : prev - 1));
                                  }}
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center shadow-lg"
                                  title="Vorige"
                                >
                                  <ChevronLeft className="h-4.5 w-4.5" />
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDetailImageIndex((prev) => (prev === allDetailImages.length - 1 ? 0 : prev + 1));
                                  }}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center shadow-lg"
                                  title="Volgende"
                                >
                                  <ChevronRight className="h-4.5 w-4.5" />
                                </button>

                                {/* Dots overlay */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10 bg-slate-950/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                                  {allDetailImages.map((_, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setActiveDetailImageIndex(i)}
                                      className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeDetailImageIndex ? 'bg-indigo-400 w-3.5' : 'bg-white/60 hover:bg-white'}`}
                                    />
                                  ))}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Thumbnails Row */}
                          {allDetailImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto py-1 px-0.5 scrollbar-none animate-fade-in justify-center">
                              {allDetailImages.map((url, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setActiveDetailImageIndex(i)}
                                  className={`relative h-12 w-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer shadow-sm ${i === activeDetailImageIndex ? 'border-indigo-650 border-indigo-600 scale-95 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-400 hover:scale-102'}`}
                                >
                                  <img src={url} alt={`Thumbnail ${i}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}

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
                        className="w-full relative overflow-hidden flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border border-indigo-500/25 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
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

                    {/* Package Included Contents Section! (Extremely important for Sets) */}
                    <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-xl rounded-full pointer-events-none" />
                      <div className="flex items-center space-x-2">
                        <ShoppingBag className="h-4 w-4 text-teal-600" />
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                          Inbegrepen Pakketinhoud ({selectedDetailMachine.id.startsWith("set-") ? "Klusgids Set" : "Standaard inspectie"})
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {(selectedDetailMachine.packageContents && selectedDetailMachine.packageContents.trim()
                          ? selectedDetailMachine.packageContents.split(";").map(s => s.trim()).filter(s => s.length > 0)
                          : ((machineId: string) => {
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
                            })(selectedDetailMachine.id)
                        ).map((item, idx) => (
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
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
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
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl text-[10.5px] text-slate-605 text-slate-600 gap-3">
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
                  className="px-5 py-2 hover:bg-slate-150 bg-slate-55 bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
