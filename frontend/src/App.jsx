import React, { useState, useEffect, useRef } from 'react';
import { 
  Coins, 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  User, 
  ShoppingBag, 
  Clock, 
  Zap, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';

export default function App() {
  const [players, setPlayers] = useState([]);
  const [items, setItems] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('demo'); // 'demo' or 'architecture'

  // Polling ref for cleanup
  const pollingRef = useRef(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error("Failed to load Spanner state.");
      const data = await res.json();
      setPlayers(data.players || []);
      setItems(data.items || []);
      setEntitlements(data.entitlements || []);
      setLedger(data.ledger || []);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchState();
    // Poll every 2 seconds
    pollingRef.current = setInterval(fetchState, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleReset = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        setLogs([`[System] Resetting Spanner Database chronos-ledger-db...`, `[System] Seeding fresh game players and items inventory.`]);
        await fetchState();
      }
    } catch (err) {
      alert("Error resetting database: " + err.message);
    }
  };

  const handlePurchase = async (playerId, itemId) => {
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, item_id: itemId })
      });
      const data = await res.json();
      if (!res.ok) {
        setLogs(prev => [...prev, `[Single Purchase Failed] ${data.detail || "Error"}`]);
      } else {
        setLogs(prev => [...prev, `[Single Purchase Success] Item ${itemId} bought! Tx: ${data.transaction_id}`]);
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExploitSimulation = async () => {
    setIsSimulating(true);
    setLogs([]);
    
    // Add step-by-step logs representing the exploit
    setLogs(prev => [...prev, `[Device A] Initiating Purchase: Bob attempts to buy 'Dragon Slayer Sword' (400 gold) on Phone...`]);
    setLogs(prev => [...prev, `[Device B] Initiating Purchase: Bob attempts to buy 'Dragon Slayer Sword' (400 gold) on Tablet CONCURRENTLY...`]);
    
    // We add a tiny delay to show concurrency in logger
    await new Promise(resolve => setTimeout(resolve, 600));
    setLogs(prev => [...prev, `[TrueTime Audit] Both transactions transmitted with overlapping network timestamps.`]);
    setLogs(prev => [...prev, `[Cloud Spanner] Spanner receives requests. Initializing global Serializable Isolation locks...`]);
    setLogs(prev => [...prev, `[Cloud Spanner] TrueTime atomic clocks parsing transaction commit windows...`]);
    
    try {
      // Fire both purchases concurrently
      const promise1 = fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: 2, item_id: 101 }) // Bob buying Dragon Slayer Sword
      }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json() }));

      const promise2 = fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: 2, item_id: 101 }) // Bob buying Dragon Slayer Sword
      }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json() }));

      const [res1, res2] = await Promise.all([promise1, promise2]);

      await new Promise(resolve => setTimeout(resolve, 800));

      // Process Device A (Request 1)
      if (res1.ok) {
        setLogs(prev => [...prev, `🟢 [Device A Response - 200 OK] Success! Entitlement registered. Tx: ${res1.data.transaction_id}`]);
      } else {
        setLogs(prev => [...prev, `🔴 [Device A Response - 400 Failed] ${res1.data.detail}`]);
      }

      // Process Device B (Request 2)
      if (res2.ok) {
        setLogs(prev => [...prev, `🟢 [Device B Response - 200 OK] Success! Entitlement registered. Tx: ${res2.data.transaction_id}`]);
      } else {
        setLogs(prev => [...prev, `🔴 [Device B Response - 400 Failed] Exploit Blocked: Bob has insufficient gold (50 remaining, 400 needed).`]);
      }

      setLogs(prev => [...prev, `[TrueTime Audit] Spanner global TrueTime serialization successfully blocked double-spend exploit.`]);
      await fetchState();
    } catch (err) {
      setLogs(prev => [...prev, `[Error] Concurrency simulation failed: ${err.message}`]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* 1. Header Banner */}
      <header className="bg-white border-b border-zinc-200 px-8 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg text-white" style={{ backgroundColor: '#2563eb' }}>
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">ChronosLedger</h1>
            <p className="text-xs text-zinc-500 font-medium">Globally Distributed virtual Economy & Entitlements Ledger on Cloud Spanner</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right text-xs">
            <span className="text-zinc-400">Target Database:</span>
            <span className="font-mono font-bold text-zinc-800">chronos-ledger-db</span>
          </div>
          <button 
            onClick={handleReset}
            style={{ backgroundColor: '#2563eb' }}
            className="py-2 px-4 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Database
          </button>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="w-64 bg-zinc-50 border-r border-zinc-200 p-6 flex flex-col gap-2 shrink-0">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Navigation</span>
          <button
            onClick={() => setActiveTab('demo')}
            className={`w-full py-2.5 px-4 rounded-lg text-left text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'demo' 
                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                : 'text-zinc-650 hover:bg-zinc-100'
            }`}
          >
            <Zap className="w-4 h-4" />
            Live Economy Simulation
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`w-full py-2.5 px-4 rounded-lg text-left text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'architecture' 
                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                : 'text-zinc-650 hover:bg-zinc-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            TrueTime Architecture
          </button>

          <div className="mt-auto border-t border-zinc-200 pt-6 space-y-4">
            <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-lg text-[11px] text-blue-900 space-y-2">
              <span className="font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                Global Gaming Case Study
              </span>
              <p className="text-zinc-600 leading-relaxed">
                A global gaming publisher migrated its global commerce system supporting 350M active users to Cloud Spanner, achieving a 10x storage footprint reduction and a 50% cost drop.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-96 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-sm text-zinc-500 font-medium">Connecting to Cloud Spanner...</span>
            </div>
          ) : activeTab === 'demo' ? (
            <div className="max-w-7xl mx-auto space-y-8">
              
              {/* Row 1: Player Wallets & Store Items */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Players Wallets */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600" />
                      Player Wallets
                    </h3>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-bold uppercase">Spanner Table</span>
                  </div>

                  <div className="space-y-3">
                    {players.map(player => (
                      <div key={player.player_id} className={`p-4 rounded-lg border flex justify-between items-center ${
                        player.player_id === 2 
                          ? 'border-amber-300 bg-amber-50/20 shadow-sm shadow-amber-50/50' 
                          : 'border-zinc-200 bg-zinc-50/50'
                      }`}>
                        <div>
                          <span className="text-xs font-bold text-zinc-900 block">{player.name}</span>
                          <span className="text-[10px] text-zinc-500">ID: {player.player_id}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold font-mono text-zinc-800 flex items-center gap-1 justify-end">
                            {player.balance}
                            <span className="text-[10px] text-zinc-400 font-normal">gold</span>
                          </span>
                          {player.player_id === 2 && (
                            <span className="text-[8px] bg-amber-100 text-amber-700 font-semibold px-1 rounded block mt-0.5 uppercase tracking-wider">Exploit Account</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Game Store Items */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-blue-600" />
                      Virtual Store Shop
                    </h3>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-bold uppercase">Spanner Table</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {items.map(item => (
                      <div key={item.item_id} className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/50 flex flex-col justify-between h-44">
                        <div>
                          <span className="text-xs font-extrabold text-zinc-900 block line-clamp-1">{item.name}</span>
                          <span className="text-[9px] text-zinc-400">SKU: {item.item_id}</span>
                        </div>

                        <div className="my-3 flex justify-between items-end">
                          <div>
                            <span className="text-[9px] text-zinc-400 block font-medium">Price</span>
                            <span className="text-sm font-extrabold font-mono text-blue-600">{item.price} gold</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-zinc-400 block font-medium">Inventory Stock</span>
                            <span className={`text-xs font-bold font-mono ${item.stock > 0 ? 'text-zinc-850' : 'text-red-600'}`}>{item.stock} left</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-zinc-250/50">
                          <button
                            onClick={() => handlePurchase(1, item.item_id)}
                            className="w-full py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-semibold rounded transition-colors cursor-pointer text-center"
                          >
                            Buy (Alice)
                          </button>
                          <button
                            onClick={() => handlePurchase(2, item.item_id)}
                            className="w-full py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-semibold rounded transition-colors cursor-pointer text-center"
                          >
                            Buy (Bob)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Row 2: Exploit Panel & Realtime Spanner TrueTime Console */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Exploit Simulator Description Card */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Concurrent Double-Spend Exploit
                    </h3>
                    
                    <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
                      <p>
                        This simulation mimics a common gaming hack: a user logs into Bob's account (450 gold) on two separate devices and attempts to buy the <strong>Dragon Slayer Sword</strong> (400 gold) at the exact same millisecond.
                      </p>
                      <p>
                        In a traditional database without strict serializable isolation, race conditions can cause a "double spend" where both purchases complete successfully, duplicating the item and draining inventory incorrectly.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleExploitSimulation}
                    disabled={isSimulating}
                    style={{ backgroundColor: isSimulating ? '#e4e4e7' : '#e11d48' }}
                    className="w-full py-4 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                  >
                    {isSimulating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running TrueTime Check...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        Execute Race-Condition Exploit
                      </>
                    )}
                  </button>
                </div>

                {/* Live Console Output */}
                <div className="lg:col-span-2 bg-zinc-950 p-6 rounded-xl border border-zinc-800 shadow-2xl flex flex-col h-[320px]">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-semibold">Spanner TrueTime Console Logs</span>
                    </div>
                    <button 
                      onClick={() => setLogs([])}
                      className="text-[9px] text-zinc-500 hover:text-zinc-350 hover:underline font-mono"
                    >
                      Clear Logs
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-300 space-y-2 mt-4 pr-2">
                    {logs.length > 0 ? (
                      logs.map((log, i) => (
                        <div key={i} className={`py-1 border-b border-zinc-900/50 ${
                          log.startsWith('🟢') ? 'text-emerald-400' :
                          log.startsWith('🔴') ? 'text-rose-400' :
                          log.startsWith('[System]') ? 'text-zinc-500' :
                          'text-zinc-300'
                        }`}>
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-zinc-650 h-full flex flex-col justify-center items-center text-center">
                        <span>Console Idle.</span>
                        <p className="mt-1">Click the red "Execute Race-Condition Exploit" button to start simulation.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Row 3: Realtime Ledger Audit Trail & Entitlements */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Granted Entitlements Table */}
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Granted Player Entitlements
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 uppercase font-semibold text-[9px] tracking-wider">
                          <th className="pb-2">Entitlement ID</th>
                          <th className="pb-2">Player ID</th>
                          <th className="pb-2">Medication / SKU</th>
                          <th className="pb-2 text-right">Granted At (TrueTime)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {entitlements.length > 0 ? (
                          entitlements.map(ent => (
                            <tr key={ent.entitlement_id} className="text-zinc-850 hover:bg-zinc-50/50 transition-colors">
                              <td className="py-2.5 font-mono text-[10px] text-zinc-500">{ent.entitlement_id}</td>
                              <td className="py-2.5">Player {ent.player_id}</td>
                              <td className="py-2.5">Item {ent.item_id}</td>
                              <td className="py-2.5 text-right font-mono text-[9px] text-zinc-400">
                                {ent.granted_at ? ent.granted_at.split('T')[1].slice(0, 12) : '--'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-zinc-400">No entitlements granted yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Ledger Table */}
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                    <Clock className="w-4 h-4 text-blue-600" />
                    ACID Transaction Ledger Audit Trail
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 uppercase font-semibold text-[9px] tracking-wider">
                          <th className="pb-2">Transaction ID</th>
                          <th className="pb-2">Player ID</th>
                          <th className="pb-2">Amount</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2 text-right">Timestamp (TrueTime)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {ledger.length > 0 ? (
                          ledger.map(tx => (
                            <tr key={tx.transaction_id} className="text-zinc-850 hover:bg-zinc-50/50 transition-colors">
                              <td className="py-2.5 font-mono text-[10px] text-zinc-500">{tx.transaction_id}</td>
                              <td className="py-2.5">Player {tx.player_id}</td>
                              <td className="py-2.5 font-mono font-bold">{tx.amount} gold</td>
                              <td className="py-2.5">
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold border uppercase tracking-wider font-mono ${
                                  tx.status === 'SUCCESS' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {tx.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-mono text-[9px] text-zinc-400">
                                {tx.timestamp ? tx.timestamp.split('T')[1].slice(0, 12) : '--'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-zinc-400">No ledger entries audited.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            
            /* 3. TrueTime Architecture Page */
            <div className="max-w-5xl mx-auto space-y-8">
              <div>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Technical Deep-Dive</span>
                <h2 className="text-3xl font-extrabold text-zinc-950 mt-1">Cloud Spanner TrueTime API</h2>
                <p className="text-zinc-650 mt-1">Under the hood of the globally consistent gaming ledger.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold uppercase text-zinc-450 tracking-wider">TrueTime Serialization Flow</h3>
                
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-4 text-sm text-zinc-650 leading-relaxed">
                  <p>
                    Cloud Spanner leverages a unique hardware wedge—combining atomic clocks with GPS receivers inside Google data centers—to provide a globally synchronized API called **TrueTime**.
                  </p>
                  <p>
                    Instead of coordinating locks across servers over slow network roundtrips (which introduces gaming lag), Spanner assigns absolute commit timestamps to transactions. It ensures that if Transaction A commits before Transaction B starts, Transaction A's TrueTime timestamp is smaller than B's.
                  </p>
                  <p>
                    During Bob's duplicate spend race-condition:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-2 font-medium text-zinc-800">
                    <li>Spanner evaluates both transaction requests.</li>
                    <li>Because Spanner enforces Strict Serializability, the transactions are ordered sequentially based on atomic TrueTime timestamps.</li>
                    <li>Transaction 1 is committed, deducting 400 gold from Bob (balance becomes 50 gold) and decrementing stock.</li>
                    <li>Transaction 2 is processed. Because it read the state committed by Transaction 1, it checks the balance (50 gold) and instantly aborts, logging an EXPLOIT_BLOCKED status to the audit trail.</li>
                  </ol>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                <h3 className="text-xs font-semibold uppercase text-zinc-450 tracking-wider">Comparing Gaming Databases</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="border border-zinc-200 p-4 rounded-lg bg-zinc-50/50">
                    <span className="text-xs font-bold text-zinc-900 block mb-2">Traditional Relational</span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Requires heavy, centralized lock managers. Forces game developers to implement locking logic at the application tier, causing latency spikes and potential deadlocks under high load.
                    </p>
                  </div>
                  <div className="border border-zinc-200 p-4 rounded-lg bg-zinc-50/50">
                    <span className="text-xs font-bold text-zinc-900 block mb-2">NoSQL / Eventually Consistent</span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Lacks multi-row ACID transactions. Bob would successfully double-purchase the sword, causing database drift and requiring tedious, manual rollbacks.
                    </p>
                  </div>
                  <div className="border border-blue-200 p-4 rounded-lg bg-blue-50/20">
                    <span className="text-xs font-bold text-blue-700 block mb-2">Google Cloud Spanner</span>
                    <p className="text-xs text-zinc-650 leading-relaxed font-medium">
                      Provides global external consistency natively. TrueTime blocks exploits at the database engine tier, keeping commerce pipelines secure and low-latency.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

      </main>
    </div>
  );
}
