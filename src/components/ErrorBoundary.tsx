/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import { motion } from "motion/react";
import { isChunkLoadError, tryAutoReloadOnce } from "../utils/chunkError";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  autoReloading: boolean;
}

// Small animated aerial lift — the platform rides up and down between two rails,
// on brand for a lift-rental site instead of a generic spinner.
function LiftAnimation() {
  return (
    <div className="relative mx-auto mb-2 h-20 w-16" aria-hidden="true">
      <div className="absolute left-1 top-0 bottom-0 w-1 rounded-full bg-slate-200" />
      <div className="absolute right-1 top-0 bottom-0 w-1 rounded-full bg-slate-200" />
      <motion.div
        className="absolute left-0 right-0 flex flex-col items-center"
        animate={{ y: [44, 4, 44] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="h-2.5 w-14 rounded-md bg-orange-500 shadow-md" />
        <div className="mt-0.5 h-3.5 w-3.5 rounded-full bg-slate-700" />
      </motion.div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    autoReloading: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      autoReloading: isChunkLoadError(error)
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside HuurGo frontend:", error, errorInfo);
    if (this.state.autoReloading) {
      const reloaded = tryAutoReloadOnce();
      if (!reloaded) {
        // Already tried once this session — stop pretending we're reloading.
        this.setState({ autoReloading: false });
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, autoReloading: false });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.autoReloading) {
        return (
          <div className="min-h-[80vh] flex items-center justify-center px-4">
            <div className="text-center">
              <LiftAnimation />
              <p className="text-sm text-slate-500 font-medium">Nieuwste versie laden...</p>
            </div>
          </div>
        );
      }

      const chunkError = isChunkLoadError(this.state.error);

      if (chunkError) {
        return (
          <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-orange-500/5 blur-[120px] -z-10" />
            <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-[120px] -z-10" />

            <div className="w-full max-w-lg bg-white border border-slate-200 p-8 rounded-3xl space-y-6 text-center shadow-xl">
              <LiftAnimation />

              <div>
                <span className="text-[10px] font-mono uppercase bg-orange-50 border border-orange-200 text-orange-700 px-3 py-1 rounded-full font-extrabold tracking-wider">
                  Onderhoud bezig
                </span>
                <h1 className="font-display text-2xl font-black text-slate-900 mt-4 leading-tight">
                  Onze hoogwerkers zijn in actie!
                </h1>
                <p className="text-xs text-slate-600 font-medium mt-2 max-w-md mx-auto leading-relaxed">
                  We zijn de site aan het bijwerken naar de nieuwste versie. Een moment
                  geduld, we zijn zo weer online.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-orange-100 cursor-pointer flex items-center justify-center space-x-1.5 border-none"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Pagina herladen</span>
                </button>

                <button
                  onClick={this.handleReset}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition-all border border-slate-200 cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Terug naar Home</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-rose-500/5 blur-[120px] -z-10" />
          <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-amber-500/3 blur-[120px] -z-10" />

          <div className="w-full max-w-lg bg-white border border-slate-200 p-8 rounded-3xl space-y-6 text-center shadow-xl">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 shadow-sm animate-pulse mb-2">
              <ShieldAlert className="h-9 w-9" />
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1 rounded-full font-extrabold tracking-wider">
                Systeembeveiliging Geactiveerd
              </span>
              <h1 className="font-display text-2xl font-black text-slate-900 mt-4 leading-tight">
                Er is een onverwachte fout opgetreden
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-2 max-w-md mx-auto leading-relaxed">
                Onze systemen hebben de fout veilig geïsoleerd om uw gegevens en actieve sessie te beschermen.
              </p>
              {this.state.error && (
                <div className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-950 text-left">
                  <span className="text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider block">Foutmelding log</span>
                  <code className="text-[10.5px] font-mono text-slate-300 break-all leading-normal">
                    {this.state.error.message}
                  </code>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={this.handleReset}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-orange-100 cursor-pointer flex items-center justify-center space-x-1.5 border-none"
              >
                <Home className="h-4 w-4" />
                <span>Terug naar Home</span>
              </button>

              <button
                onClick={() => window.location.reload()}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition-all border border-slate-200 cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Pagina herladen</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
