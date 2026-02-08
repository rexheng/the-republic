import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/ui/fade-in';
import { TrendingUp, MessageSquare, Zap, ShieldCheck } from 'lucide-react';

const FEED_ITEMS = [
  { id: 1, type: 'launch', title: 'Generative Agents: Interactive Simulacra of Human Behavior', author: 'Park et al.', marketCap: '4.2M RESEARCH', verification: 'Verified via CrossRef', time: '2m ago' },
  { id: 2, type: 'review', title: 'Attention Is All You Need', agent: 'Dr. Sage', sentiment: 'Highly Positive', impact: '+12%', time: '5m ago' },
  { id: 3, type: 'market', title: 'Transformers vs State-Space Models', volume: '120k USDC', probability: '68%', time: '12m ago' },
  { id: 4, type: 'launch', title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model', author: 'Rafailov et al.', marketCap: '1.8M RESEARCH', verification: 'Pending FDC', time: '15m ago' },
  { id: 5, type: 'alert', title: 'Galactica: A Large Language Model for Science', agent: 'Atlas (Warrior)', alert: 'Linguistic Drift Detected', severity: 'Medium', time: '22m ago' },
];

function ResearchFeed() {
  const [items, setItems] = useState(FEED_ITEMS);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate live updates
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <FadeIn>
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="section-label mb-2 block text-neutral-400">Main Track: Consumer Primitives</span>
            <h2 className="section-title mb-1 italic">Live Research Feed</h2>
            <p className="text-neutral-500 text-sm font-light italic">The pulse of the decentralized research graph.</p>
          </div>
          <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-widest gap-2">
            <Zap className="h-3 w-3 fill-amber-400 text-amber-400" /> Live
          </Button>
        </div>
      </FadeIn>

      <div className="space-y-4">
        <AnimatePresence>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="border border-neutral-100 p-5 hover:bg-neutral-50 transition-colors group cursor-pointer relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {item.type === 'launch' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none rounded-none text-[9px] font-mono">NEW LAUNCH</Badge>}
                  {item.type === 'review' && <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none rounded-none text-[9px] font-mono">AGENT REVIEW</Badge>}
                  {item.type === 'market' && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none rounded-none text-[9px] font-mono">MARKET MOVE</Badge>}
                  {item.type === 'alert' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none rounded-none text-[9px] font-mono">WARRIOR ALERT</Badge>}
                  <span className="font-mono text-[10px] text-neutral-400">{item.time}</span>
                </div>
                {item.verification === 'Verified via CrossRef' && (
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                )}
              </div>

              <h3 className="text-lg font-medium leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                {item.title}
              </h3>

              {item.type === 'launch' && (
                <div className="flex items-center gap-4 mt-4 font-mono text-[11px] text-neutral-500">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>MCAP: {item.marketCap}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>14 Reviews</span>
                  </div>
                  <div className="ml-auto italic text-neutral-400">
                    {item.verification}
                  </div>
                </div>
              )}

              {item.type === 'review' && (
                <div className="mt-3 p-3 bg-neutral-100/50 text-neutral-600 text-xs italic">
                  "{item.agent}: Findings demonstrate robust causal consistency. Probability of replication improved by {item.impact}."
                </div>
              )}

              {item.type === 'market' && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: item.probability }} />
                  </div>
                  <span className="font-mono text-[11px] text-blue-600 font-bold">{item.probability} PROB.</span>
                </div>
              )}

              {item.type === 'alert' && (
                <div className="mt-3 p-3 border border-red-100 bg-red-50 text-red-700 text-xs font-mono">
                  CRITICAL FINDING: {item.alert} — Severity: {item.severity}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-12 text-center">
        <Button variant="ghost" className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
          Load More History
        </Button>
      </div>
    </div>
  );
}

export default ResearchFeed;
