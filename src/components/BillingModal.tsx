import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  CreditCard,
  Check,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  Receipt,
} from 'lucide-react';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  description: string;
  aiCreditsIncluded: number;
  features: string[];
}

interface PaymentRecord {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  tierGranted?: string;
  creditsGranted: number;
  receiptUrl?: string;
  createdAt: string;
}

export const BillingModal: React.FC<BillingModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creditPacks, setCreditPacks] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    Promise.all([api.getPaymentPlans(), api.getPaymentHistory()])
      .then(([planData, historyData]) => {
        if (!isMounted) return;
        setPlans(planData.plans || []);
        setCreditPacks(planData.creditPacks || []);
        setPayments(historyData.payments || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load billing details:', err);
        setErrorMessage('Failed to connect to PostgreSQL payment service.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckout = async (planId: string) => {
    setProcessingPlanId(planId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.processCheckout(planId);
      setSuccessMessage(res.message);
      await refreshUser();
      // Refresh payment history
      const historyData = await api.getPaymentHistory();
      setPayments(historyData.payments || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setErrorMessage(message);
    } finally {
      setProcessingPlanId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Subscription & Payments</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/40 text-emerald-400">
                  PostgreSQL ACID Ledger
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Current Plan:{' '}
                <span className="font-semibold text-cyan-400 capitalize">{user?.tier || 'Free'}</span> • AI Credits:{' '}
                <span className="font-semibold text-white">{user?.aiCreditsRemaining ?? 50} remaining</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 text-xs font-semibold px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'plans'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Available Plans & AI Packs
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs font-semibold px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt size={14} />
            <span>Payment History ({payments.length})</span>
          </button>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <Check size={16} />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl text-xs flex items-center gap-2">
            <X size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              <span>Connecting to PostgreSQL payment ledger...</span>
            </div>
          ) : activeTab === 'plans' ? (
            <>
              {/* Subscription Plans */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Engineering Subscription Tiers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((p) => {
                    const isCurrent = user?.tier === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                          isCurrent
                            ? 'bg-cyan-950/20 border-cyan-500/50 ring-1 ring-cyan-500/20'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-white">{p.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-2xl font-black text-white">
                              ${(p.priceCents / 100).toFixed(0)}
                            </span>
                            <span className="text-xs text-slate-400">/{p.interval}</span>
                          </div>
                          <p className="text-xs text-slate-400 mb-4">{p.description}</p>
                          <div className="space-y-2 mb-6">
                            {p.features.map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                                <Check size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          disabled={isCurrent || processingPlanId !== null}
                          onClick={() => handleCheckout(p.id)}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                            isCurrent
                              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                          }`}
                        >
                          {processingPlanId === p.id ? (
                            <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                          ) : isCurrent ? (
                            'Active Tier'
                          ) : (
                            <>
                              <Zap size={14} />
                              <span>Upgrade to {p.name}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Generative Drafting Credit Packs */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-400" />
                  <span>AI Drafting Credit Packs</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creditPacks.map((pack) => (
                    <div
                      key={pack.id}
                      className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{pack.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{pack.description}</p>
                        <span className="text-base font-extrabold text-purple-400 mt-2 block">
                          ${(pack.priceCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <button
                        disabled={processingPlanId !== null}
                        onClick={() => handleCheckout(pack.id)}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {processingPlanId === pack.id ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Zap size={14} />
                            <span>Buy Credits</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Payment History Tab */
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                PostgreSQL Transaction History
              </h3>
              {payments.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-slate-400 text-xs">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Transaction ID</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Tier / Credits</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {payments.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-400">{tx.id}</td>
                          <td className="py-3 px-4 font-bold text-white">
                            ${(tx.amountCents / 100).toFixed(2)} {tx.currency}
                          </td>
                          <td className="py-3 px-4 text-cyan-400">
                            {tx.tierGranted ? `Tier: ${tx.tierGranted.toUpperCase()}` : ''}{' '}
                            {tx.creditsGranted ? `+${tx.creditsGranted} AI Credits` : ''}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold uppercase">
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>PCI-DSS & Stripe compliant server architecture</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
