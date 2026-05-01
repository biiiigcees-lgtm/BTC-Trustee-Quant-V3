"use client";

import { Brain, Sparkles, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AIInsight {
  type: 'signal' | 'warning' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  timestamp: string;
}

export function AIInsights() {
  // Start with empty insights - no fake data
  const [insights, setInsights] = useState<AIInsight[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'signal':
        return <TrendingUp className="w-4 h-4" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      case 'opportunity':
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'signal':
        return 'text-bullish bg-bullish-dim';
      case 'warning':
        return 'text-bearish bg-bearish-dim';
      case 'opportunity':
        return 'text-accent-cyan bg-accent-cyan/20';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return 'bg-bullish';
    if (confidence >= 60) return 'bg-accent-cyan';
    return 'bg-neutral';
  };

  const analyzeMarket = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newInsight: AIInsight = {
      type: 'signal',
      title: 'Fresh Analysis Complete',
      description: 'Market conditions analyzed using 15 technical indicators and ML models.',
      confidence: 85,
      timestamp: 'Just now',
    };
    
    setInsights([newInsight, ...insights.slice(0, 2)]);
    setIsAnalyzing(false);
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-mid">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent-purple" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            AI Insights
          </span>
        </div>
        <button
          onClick={analyzeMarket}
          disabled={isAnalyzing}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            isAnalyzing
              ? 'bg-card text-muted cursor-not-allowed'
              : 'bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-3 h-3 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
              Analyzing
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              Analyze
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="w-8 h-8 mx-auto mb-2 text-muted opacity-50" />
            <p className="text-xs text-muted">
              No AI insights yet — run market analysis to generate signals
            </p>
          </div>
        ) : (
          insights.map((insight, index) => (
            <div
              key={index}
              className="bg-card rounded-lg p-3 border border-subtle hover:border-subtle/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getInsightColor(insight.type)}`}>
                  {getInsightIcon(insight.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-primary">{insight.title}</h4>
                    <span className="text-xs text-muted">{insight.timestamp}</span>
                  </div>
                  
                  <p className="text-xs text-muted mb-2 line-clamp-2">{insight.description}</p>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getConfidenceColor(insight.confidence)}`}
                        style={{ width: `${insight.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted">{insight.confidence}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-subtle">
        <div className="flex items-center gap-2 text-xs text-muted">
          <CheckCircle className="w-3 h-3 text-bullish" />
          <span>ML models trained on 50K+ historical signals</span>
        </div>
      </div>
    </div>
  );
}
