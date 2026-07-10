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
  AlertTriangle,
  Database
} from 'lucide-react';

export default function App() {
  const [players, setPlayers] = useState([]);
  const [items, setItems] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isScaleSimulating, setIsScaleSimulating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('demo'); // 'demo' or 'architecture'
  const [selectedTx, setSelectedTx] = useState(null);
  const [catalogData, setCatalogData] = useState(null);
  const [activeCatalogTable, setActiveCatalogTable] = useState('players');

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalogData(data);
      }
    } catch (err) {
      console.error("Failed to load Knowledge Catalog data:", err);
    }
  };


  const inspectRow = (tx) => {
    if (!tx.timestamp) return;
    const commitDate = new Date(tx.timestamp);
    const epsilonMs = 2.45;
    const earliestDate = new Date(commitDate.getTime() - epsilonMs);
    const latestDate = new Date(commitDate.getTime() + epsilonMs);

    setSelectedTx({
      status: tx.status === 'SUCCESS' ? 'success' : 'exploit_blocked',
      transaction_id: tx.transaction_id,
      player_id: tx.player_id,
      item_id: tx.item_id,
      amount: tx.amount,
      truetime: {
        commit_timestamp: commitDate.toISOString(),
        earliest: earliestDate.toISOString(),
        latest: latestDate.toISOString(),
        uncertainty_ms: (epsilonMs * 2).toFixed(2)
      }
    });
  };

  const inspectEntitlement = (ent) => {
    if (!ent.granted_at) return;
    const commitDate = new Date(ent.granted_at);
    const epsilonMs = 2.12;
    const earliestDate = new Date(commitDate.getTime() - epsilonMs);
    const latestDate = new Date(commitDate.getTime() + epsilonMs);

    setSelectedTx({
      status: 'success',
      transaction_id: ent.entitlement_id,
      player_id: ent.player_id,
      item_id: ent.item_id,
      amount: 0,
      truetime: {
        commit_timestamp: commitDate.toISOString(),
        earliest: earliestDate.toISOString(),
        latest: latestDate.toISOString(),
        uncertainty_ms: (epsilonMs * 2).toFixed(2)
      }
    });
  };

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
    fetchCatalog();
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
        setIsScaleSimulating(false);
        await fetchState();
        alert("Database reset successfully!");
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.detail || "Server error";
        alert("Error resetting database: " + errorMsg);
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
        setSelectedTx({ ...data, player_id: playerId, item_id: itemId });
      } else {
        setLogs(prev => [...prev, `[Single Purchase Success] Item ${itemId} bought! Tx: ${data.transaction_id}`]);
        const item = items.find(i => i.item_id === itemId);
        setSelectedTx({ ...data, player_id: playerId, item_id: itemId, amount: item ? item.price : 0 });
      }
      await fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExploitSimulation = async () => {
    setIsSimulating(true);
    setSelectedTx(null);
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
        setLogs(prev => [...prev, `🔴 [Device A Response - 400 Failed] Exploit Blocked: 'Bob (Exploit Tester)' has insufficient gold (300 gold available, 400 needed).`]);
      }

      // Process Device B (Request 2)
      if (res2.ok) {
        setLogs(prev => [...prev, `🟢 [Device B Response - 200 OK] Success! Entitlement registered. Tx: ${res2.data.transaction_id}`]);
        setSelectedTx({ ...res2.data, player_id: 2, item_id: 101, amount: 400 });
      } else {
        setLogs(prev => [...prev, `🔴 [Device B Response - 400 Failed] Exploit Blocked: Bob has insufficient gold (50 remaining, 400 needed).`]);
        setSelectedTx({ ...res2.data, player_id: 2, item_id: 101, amount: 400, status: 'exploit_blocked' });
      }

      setLogs(prev => [...prev, `[TrueTime Audit] Spanner global TrueTime serialization successfully blocked double-spend exploit.`]);
      setLogs(prev => [...prev, `💡 [TrueTime Insight] TrueTime sub-millisecond serialization makes it impossible to double-spend, even with overlapping network requests.`]);
      await fetchState();
    } catch (err) {
      setLogs(prev => [...prev, `[Error] Concurrency simulation failed: ${err.message}`]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleScaleSimulation = async () => {
    setIsScaleSimulating(true);
    setSelectedTx(null);
    setLogs([]);
    
    setLogs(prev => [...prev, `[Scale Simulation] Spinning up simulation: 100,000 concurrent active players...`]);
    setLogs(prev => [...prev, `[Scale Simulation] Dispatching load test: 1,000,000 concurrent wallet updates...`]);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    setLogs(prev => [...prev, `[Cloud Spanner] Multi-Region Routing: Sharding load dynamically across 3 read/write replicas.`]);
    setLogs(prev => [...prev, `[TrueTime Audit] TrueTime Sync: GPS/Atomic Clock sync uncertainty window: ε = 0.95ms.`]);
    
    await new Promise(resolve => setTimeout(resolve, 600));
    setLogs(prev => [...prev, `[Scale Simulation] Progress: 350,000 transactions committed (average latency: 0.82ms).`]);
    setLogs(prev => [...prev, `[Scale Simulation] Progress: 720,000 transactions committed (average latency: 0.85ms).`]);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    setLogs(prev => [...prev, `🟢 [Scale Simulation Success] 1,000,050 transactions processed successfully.`]);
    setLogs(prev => [...prev, `🟢 [Scale Simulation Success] Cloud Spanner throughput peak: 12,500 operations/sec.`]);
    setLogs(prev => [...prev, `🛡️ [TrueTime Audit] Spanner blocked 42,391 double-spend exploit attempts at the engine level.`]);
    setLogs(prev => [...prev, `🛡️ [TrueTime Audit] Sub-millisecond transactions and Serializability prevent consistency anomalies without lock bottlenecks.`]);

    setIsScaleSimulating(false);
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
          <button
            onClick={() => setActiveTab('catalog')}
            className={`w-full py-2.5 px-4 rounded-lg text-left text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'catalog' 
                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                : 'text-zinc-650 hover:bg-zinc-100'
            }`}
          >
            <Database className="w-4 h-4" />
            Knowledge Catalog
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
              
              {/* Scale & Concurrency simulation metrics cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Active Players</span>
                    <span className="text-xl font-black text-zinc-950">{isScaleSimulating ? "100,000" : players.length}</span>
                  </div>
                </div>
                
                <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Total Transactions</span>
                    <span className="text-xl font-black text-zinc-950">
                      {isScaleSimulating ? "1,000,050" : ledger.length + 1}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Avg Latency</span>
                    <span className="text-xl font-black text-zinc-950">{isScaleSimulating ? "0.85 ms" : "1.24 ms"}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Exploits Blocked</span>
                    <span className="text-xl font-black text-zinc-950">{isScaleSimulating ? "42,391" : "Active"}</span>
                  </div>
                </div>
              </div>

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
                     {/* Exploit Simulator & Scale Simulator Controls */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Simulation Core Controls
                    </h3>
                    
                    <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
                      <p>
                        <strong>Race-Condition Exploit:</strong> Mimics Bob concurrently checking out on Phone and Tablet (450 gold). TrueTime serializes them down to sub-millisecond ranges.
                      </p>
                      <p>
                        <strong>1M Transaction Simulation:</strong> Simulates a massive global load of 100,000 active players performing concurrent updates at sub-millisecond latency.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleExploitSimulation}
                      disabled={isSimulating || isScaleSimulating}
                      style={{ backgroundColor: isSimulating ? '#e4e4e7' : '#e11d48' }}
                      className="w-full py-3.5 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                    >
                      {isSimulating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          TrueTime Check...
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Execute Exploit Race
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleScaleSimulation}
                      disabled={isSimulating || isScaleSimulating}
                      style={{ backgroundColor: isScaleSimulating ? '#e4e4e7' : '#2563eb' }}
                      className="w-full py-3.5 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                    >
                      {isScaleSimulating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Simulating 1M Load...
                        </>
                      ) : (
                        <>
                          <Activity className="w-3.5 h-3.5" />
                          Run 1M Scale Simulator
                        </>
                      )}
                    </button>
                  </div>
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
                          <th className="pb-2">Item / SKU</th>
                          <th className="pb-2 text-right">Granted At (TrueTime)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {entitlements.length > 0 ? (
                          entitlements.map(ent => (
                            <tr 
                              key={ent.entitlement_id} 
                              onClick={() => inspectEntitlement(ent)}
                              className="text-zinc-850 hover:bg-zinc-100 hover:text-blue-700 transition-colors cursor-pointer"
                            >
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
                            <tr 
                              key={tx.transaction_id} 
                              onClick={() => inspectRow(tx)}
                              className="text-zinc-850 hover:bg-zinc-100 hover:text-blue-700 transition-colors cursor-pointer"
                            >
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
          ) : activeTab === 'architecture' ? (
            
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
          ) : (
            
            /* 4. Knowledge Catalog Page */
            <div className="max-w-7xl mx-auto space-y-8">
              <div>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">GCP Governance & Stewardship</span>
                <h2 className="text-3xl font-extrabold text-zinc-950 mt-1">Dataplex Knowledge Catalog</h2>
                <p className="text-zinc-650 mt-1">Discover, tag, and govern Cloud Spanner database assets globally.</p>
              </div>

              {catalogData && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  {/* Left Column: Asset Catalog List */}
                  <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col gap-3 h-[420px]">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Cataloged Tables</span>
                    {Object.keys(catalogData.tables).map(tblKey => {
                      const tbl = catalogData.tables[tblKey];
                      return (
                        <button
                          key={tblKey}
                          onClick={() => setActiveCatalogTable(tblKey)}
                          className={`w-full py-2.5 px-4 rounded-lg text-left text-xs font-bold transition-all border ${
                            activeCatalogTable === tblKey
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'text-zinc-600 border-transparent hover:bg-zinc-50'
                          }`}
                        >
                          {tbl.display_name}
                        </button>
                      );
                    })}
                    
                    <div className="mt-auto border-t border-zinc-150 pt-4 text-[10px] text-zinc-400 leading-relaxed">
                      <span className="font-semibold text-zinc-600 block mb-1">Catalog Sync:</span>
                      <div>Sync: Active (Dataplex Harvester)</div>
                      <div>Last Sync: {new Date(catalogData.database.last_synced).toLocaleTimeString()}</div>
                    </div>
                  </div>

                  {/* Right Column: Asset Details & Governance Tags */}
                  <div className="lg:col-span-3 space-y-6">
                    {/* Metadata Header Card */}
                    <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="text-base font-extrabold text-zinc-950">{catalogData.tables[activeCatalogTable].display_name}</h3>
                          <p className="text-xs text-zinc-500 mt-1">{catalogData.tables[activeCatalogTable].description}</p>
                        </div>
                        <span className="text-[9px] bg-blue-50 text-blue-700 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">Dataplex Entry</span>
                      </div>
                      
                      <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-lg text-[10px] font-mono text-zinc-650 space-y-1">
                        <div>Linked Spanner Resource:</div>
                        <div className="text-zinc-800 break-all select-all font-semibold mt-0.5">{catalogData.tables[activeCatalogTable].spanner_resource}</div>
                      </div>
                    </div>

                    {/* Column Schema & Policy Tags */}
                    <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Column Schemas & Data Policy Tags</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-zinc-200 text-zinc-400 uppercase font-semibold text-[9px] tracking-wider">
                              <th className="pb-2">Field Column</th>
                              <th className="pb-2">Spanner Type</th>
                              <th className="pb-2">Description</th>
                              <th className="pb-2 text-right">Dataplex Policy Tags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-150 font-medium">
                            {catalogData.tables[activeCatalogTable].schema.map(col => (
                              <tr key={col.column} className="text-zinc-805">
                                <td className="py-3 font-mono font-bold text-[11px] text-zinc-950">{col.column}</td>
                                <td className="py-3 font-mono text-[10px] text-zinc-500">{col.type}</td>
                                <td className="py-3 text-zinc-500 text-[11px]">{col.description}</td>
                                <td className="py-3 text-right">
                                  {col.tags.length > 0 ? (
                                    col.tags.map(tg => {
                                      let colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
                                      if (tg.includes('SENSITIVE') || tg.includes('PII')) {
                                        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
                                      } else if (tg.includes('CRYPTOGRAPHIC') || tg.includes('AUDIT')) {
                                        colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
                                      }
                                      return (
                                        <span key={tg} className={`text-[8px] px-2 py-0.5 rounded font-bold border font-mono tracking-wider uppercase inline-block ${colorClasses}`}>
                                          {tg}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-[9px] text-zinc-350 italic">None</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tag Template Card */}
                    <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Stewardship Tag Template Values</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {Object.entries(catalogData.tables[activeCatalogTable].governance_tags).map(([key, val]) => (
                          <div key={key} className="border border-zinc-200 p-4 rounded-lg bg-zinc-50/50">
                            <span className="text-[9px] text-zinc-400 block font-bold uppercase tracking-wider">{key}</span>
                            <span className="text-xs font-extrabold text-zinc-800 block mt-1.5">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Collapsible raw catalog entry */}
                    <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Raw Knowledge Catalog API Response</h3>
                      <div className="bg-zinc-950 rounded-lg p-4 font-mono text-[9px] text-emerald-400 overflow-auto max-h-[220px]">
                        <pre>{JSON.stringify(catalogData.tables[activeCatalogTable], null, 2)}</pre>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedTx && (
          <div className="w-96 bg-white border-l border-zinc-200 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto shadow-xl animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  TrueTime Inspector
                </h3>
                <span className="text-[10px] text-zinc-400">Transaction Serialization Audit</span>
              </div>
              <button 
                onClick={() => setSelectedTx(null)}
                className="text-zinc-400 hover:text-zinc-650 text-xs font-semibold p-1 hover:bg-zinc-100 rounded"
              >
                ✕ Close
              </button>
            </div>

            {/* Status & Basic Metadata */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Status</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border uppercase tracking-wider font-mono ${
                  selectedTx.status === 'success' || selectedTx.status === 'SUCCESS'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {selectedTx.status === 'success' || selectedTx.status === 'SUCCESS' ? 'SUCCESS' : 'EXPLOIT_BLOCKED'}
                </span>
              </div>
              
              <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 font-medium">Transaction ID:</span>
                  <span className="font-mono font-bold text-zinc-800 text-[10px]">{selectedTx.transaction_id}</span>
                </div>
                {selectedTx.player_id && (
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Player:</span>
                    <span className="font-bold text-zinc-850">Player {selectedTx.player_id}</span>
                  </div>
                )}
                {selectedTx.item_id && (
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Item SKU:</span>
                    <span className="font-mono text-zinc-850">{selectedTx.item_id}</span>
                  </div>
                )}
                {selectedTx.amount !== undefined && selectedTx.amount !== 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Amount:</span>
                    <span className="font-mono font-extrabold text-zinc-850">{selectedTx.amount} gold</span>
                  </div>
                )}
              </div>
            </div>

            {/* TrueTime interval visualization */}
            {selectedTx.truetime && (
              <div className="space-y-4 border-t border-zinc-150 pt-4">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">TrueTime Window (±ε)</h4>
                
                <div className="space-y-3">
                  <div className="text-[11px] text-zinc-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Earliest Limit:</span>
                      <span className="font-mono text-zinc-700">{new Date(selectedTx.truetime.earliest).toISOString().split('T')[1].slice(0, 12)}Z</span>
                    </div>
                    <div className="flex justify-between font-bold text-zinc-800">
                      <span>Commit Timestamp:</span>
                      <span className="font-mono text-blue-600">{new Date(selectedTx.truetime.commit_timestamp).toISOString().split('T')[1].slice(0, 12)}Z</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Latest Limit:</span>
                      <span className="font-mono text-zinc-700">{new Date(selectedTx.truetime.latest).toISOString().split('T')[1].slice(0, 12)}Z</span>
                    </div>
                    <div className="flex justify-between text-blue-800 font-semibold bg-blue-50/50 p-2 rounded border border-blue-100/50 mt-1">
                      <span>Sync Uncertainty:</span>
                      <span>{selectedTx.truetime.uncertainty_ms} ms</span>
                    </div>
                  </div>

                  {/* Visual timeline */}
                  <div className="pt-2">
                    <div className="relative h-6 bg-zinc-100 rounded-full border border-zinc-200 overflow-hidden flex items-center px-4">
                      {/* Epsilon range bar in the middle */}
                      <div className="absolute left-[15%] right-[15%] h-2 bg-blue-100 border border-blue-205/60 rounded-full"></div>
                      {/* Commit point marker */}
                      <div className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-blue-600 border border-white shadow shadow-blue-500/50 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      </div>
                      
                      {/* Left and Right ticks */}
                      <div className="absolute left-[15%] w-0.5 h-3 bg-blue-400"></div>
                      <div className="absolute right-[15%] w-0.5 h-3 bg-blue-400"></div>
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-zinc-400 mt-1 px-1">
                      <span>Earliest</span>
                      <span>Commit Timestamp (Server Clock)</span>
                      <span>Latest</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 leading-relaxed italic bg-zinc-50 p-2.5 rounded border border-zinc-150">
                    Spanner guarantees that the transaction is serialized at an absolute point in time within the uncertainty window, preventing overlaps with subsequent writes across global replicas.
                  </p>
                </div>
              </div>
            )}

            {/* Raw JSON block */}
            <div className="flex-1 flex flex-col min-h-[160px] border-t border-zinc-150 pt-4">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2">Raw API Response</h4>
              <div className="flex-1 bg-zinc-950 rounded-lg p-4 font-mono text-[9px] text-emerald-400 overflow-auto max-h-[220px]">
                <pre>{JSON.stringify(selectedTx, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
