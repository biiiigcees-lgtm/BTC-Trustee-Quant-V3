"use client";

import { useState } from "react";
import { Wallet, ArrowDownLeft, ArrowUpRight, X, CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartWalletProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
}

type WalletDialog = "deposit" | "withdraw" | null;

const PRESET_AMOUNTS = [500, 1000, 2500, 5000];

export function SmartWallet({ balance, onBalanceChange }: SmartWalletProps) {
  const [dialog, setDialog] = useState<WalletDialog>(null);
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Simple mock NAV change for display purposes
  const navChange = 9.2;
  const navChangeValue = (balance * navChange) / 100;

  async function handleDeposit() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setStatusMsg("Please enter a valid amount.");
      return;
    }

    setIsProcessing(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/stripe/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.client_secret) throw new Error("Invalid payment response");

      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 1200));

      // TODO: When Stripe is live, replace the line below with:
      // await stripe.confirmPayment({ clientSecret: data.client_secret, ... })
      onBalanceChange(balance + parsed);
      setStatusMsg(`Deposit of $${parsed.toLocaleString()} confirmed.`);
      setAmount("");
    } catch {
      setStatusMsg("Payment processing error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleWithdraw() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setStatusMsg("Please enter a valid amount.");
      return;
    }
    if (parsed > balance) {
      setStatusMsg("Insufficient balance.");
      return;
    }

    setIsProcessing(true);
    setStatusMsg(null);

    setTimeout(() => {
      // Capture balance in closure — re-validate to avoid stale state edge cases
      if (parsed > balance) {
        setStatusMsg("Insufficient balance.");
        setIsProcessing(false);
        return;
      }
      onBalanceChange(balance - parsed);
      setStatusMsg(`Withdrawal of $${parsed.toLocaleString()} initiated.`);
      setAmount("");
      setIsProcessing(false);
    }, 1000);
  }

  function closeDialog() {
    setDialog(null);
    setAmount("");
    setStatusMsg(null);
  }

  return (
    <>
      {/* Wallet card */}
      <div className="rounded border-border bg-surface p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-cyan" />
            <span className="text-xs font-mono text-muted uppercase tracking-widest">
              Smart Wallet
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-(--neon-green)/30 text-neon-green bg-(--neon-green)/5">
            ACTIVE
          </span>
        </div>

        {/* Balance */}
        <div className="mb-3">
          <div className="text-2xl font-semibold font-mono text-foreground">
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono text-muted">NAV (BASE)</span>
            <span className="text-[10px] font-mono text-neon-green">
              +{navChange}% (+${navChangeValue.toFixed(0)})
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setDialog("deposit")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded border border-(--cyan)/40 bg-(--cyan)/5 text-cyan text-xs font-mono hover:bg-(--cyan)/10 transition-colors"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            DEPOSIT
          </button>
          <button
            onClick={() => setDialog("withdraw")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded border-border bg-surface-2 text-muted text-xs font-mono hover:text-foreground hover:border-(--foreground)/30 transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            WITHDRAW
          </button>
        </div>
      </div>

      {/* Dialog overlay */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-lg border-border bg-surface shadow-2xl">
            {/* Dialog header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {dialog === "deposit" ? (
                  <ArrowDownLeft className="w-4 h-4 text-cyan" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-amber" />
                )}
                <span className="text-sm font-mono font-semibold text-foreground">
                  {dialog === "deposit" ? "Deposit Funds" : "Withdraw Funds"}
                </span>
              </div>
              <button
                onClick={closeDialog}
                className="text-muted hover:text-foreground transition-colors"
                title="Close dialog"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dialog body */}
            <div className="p-4 space-y-4">
              {/* Balance display */}
              <div className="p-3 rounded bg-surface-2 border-border">
                <div className="text-[10px] font-mono text-muted mb-0.5">CURRENT BALANCE</div>
                <div className="text-sm font-mono font-semibold text-foreground">
                  ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label htmlFor="amount-input" className="text-[10px] font-mono text-muted mb-1.5 block uppercase">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono text-sm">
                    $
                  </span>
                  <input
                    id="amount-input"
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 bg-surface-2 border-border rounded text-sm font-mono text-foreground placeholder-muted focus:outline-none focus:border-(--cyan)/60"
                  />
                </div>
                {/* Preset amounts */}
                <div className="flex gap-1.5 mt-2">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(String(preset))}
                      className="flex-1 py-1 text-[10px] font-mono rounded border-border text-muted hover:text-cyan hover:border-(--cyan)/40 transition-colors"
                    >
                      ${preset >= 1000 ? `${preset / 1000}K` : preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment methods (deposit only) */}
              {dialog === "deposit" && (
                <div>
                  <div className="text-[10px] font-mono text-muted mb-2 uppercase">
                    Payment Method
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded border border-(--cyan)/40 bg-(--cyan)/5">
                      <Smartphone className="w-3.5 h-3.5 text-cyan" />
                      <span className="text-[11px] font-mono text-cyan">Apple Pay</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border-border bg-surface-2">
                      <CreditCard className="w-3.5 h-3.5 text-muted" />
                      <span className="text-[11px] font-mono text-muted">Card</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-muted mt-2">
                    Powered by Stripe · Demo mode
                  </p>
                </div>
              )}

              {/* Status message */}
              {statusMsg && (
                <div
                  className={cn(
                    "p-2 rounded text-[11px] font-mono",
                    statusMsg.includes("error")
                      ? "bg-(--neon-red)/10 text-neon-red border border-(--neon-red)/30"
                      : "bg-(--neon-green)/10 text-neon-green border border-(--neon-green)/30"
                  )}
                >
                  {statusMsg}
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={dialog === "deposit" ? handleDeposit : handleWithdraw}
                disabled={isProcessing || !amount || parseFloat(amount) <= 0}
                className={cn(
                  "w-full py-2.5 rounded font-mono text-sm font-semibold transition-all",
                  dialog === "deposit"
                    ? "bg-cyan text-background hover:opacity-90"
                    : "bg-(--amber)/20 text-amber border border-(--amber)/40 hover:bg-(--amber)/30",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner" />
                    Processing...
                  </span>
                ) : dialog === "deposit" ? (
                  "Confirm Deposit"
                ) : (
                  "Confirm Withdrawal"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
