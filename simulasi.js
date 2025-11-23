import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Zap, Battery, BatteryCharging, Sun, Wind, 
  Server, Cpu, Settings, PlayCircle, PauseCircle, 
  TrendingUp, AlertTriangle, Menu, DollarSign, Power
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine, Label
} from 'recharts';

// Komponen Slider Input
const ControlSlider = ({ label, value, setValue, min, max, unit, color }) => (
  <div className="mb-4">
    <div className="flex justify-between text-xs text-slate-400 mb-1">
      <span>{label}</span>
      <span className="text-white font-bold">{value} {unit}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => setValue(parseFloat(e.target.value))}
      className={`w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-${color}-500`}
    />
  </div>
);

// Komponen Kartu Status
const StatusCard = ({ title, value, unit, icon: Icon, color, subtext, alert }) => (
  <div className={`bg-slate-800 border ${alert ? 'border-red-500 animate-pulse' : 'border-slate-700'} rounded-xl p-4 shadow-lg flex flex-col justify-between h-full transition-all`}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-wider">{title}</p>
        <h3 className="text-xl md:text-2xl font-bold text-white mt-1 truncate">{value} <span className="text-xs md:text-sm text-slate-500 font-normal">{unit}</span></h3>
        {subtext && <p className={`text-[10px] md:text-xs mt-2 ${color === 'green' ? 'text-emerald-400' : 'text-rose-400'}`}>{subtext}</p>}
      </div>
      <div className={`p-2 rounded-lg bg-opacity-20 shrink-0 ${color === 'yellow' ? 'bg-yellow-500 text-yellow-400' : color === 'blue' ? 'bg-blue-500 text-blue-400' : color === 'green' ? 'bg-emerald-500 text-emerald-400' : 'bg-rose-500 text-rose-400'}`}>
        <Icon size={18} className="md:w-5 md:h-5" />
      </div>
    </div>
  </div>
);

export default function HRESDashboard() {
  // --- STATE INPUT USER ---
  const [solarInput, setSolarInput] = useState(80); // % Intensitas
  const [windInput, setWindInput] = useState(50);  // % Kecepatan
  const [loadInput, setLoadInput] = useState(40);  // kW Beban Rumah
  const [gridPrice, setGridPrice] = useState(1500); // Rp/kWh
  const [soc, setSoc] = useState(50); // % Baterai Awal

  // --- STATE SISTEM ---
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [data, setData] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState("System Idle");
  const [logicReason, setLogicReason] = useState("Initializing...");
  const [gridActive, setGridActive] = useState(false);
  
  // Konstanta Kapasitas
  const MAX_SOLAR_CAPACITY = 50; // kW
  const MAX_WIND_CAPACITY = 40; // kW
  const BATTERY_CAPACITY = 100; // kWh total
  const SOC_MAX_LIMIT = 80; // % Batas Atas Charge
  const SOC_MIN_LIMIT = 20; // % Batas Bawah Discharge
  const GRID_PRICE_EXPENSIVE = 1400; // Ambang Batas Mahal

  // --- LOGIKA UTAMA (RULE-BASED) ---
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTime(t => t + 1);
      
      // 1. Hitung Pembangkitan (DIPERBAIKI: Noise hanya jika input > 0)
      // Jika input 0, noise 0. Jika input > 0, tambahkan variasi acak kecil.
      const solarNoise = solarInput > 0 ? (Math.random() * 2 - 1) : 0;
      const windNoise = windInput > 0 ? (Math.random() * 3 - 1.5) : 0;
      const loadNoise = Math.random() * 2 - 1; // Beban rumah selalu fluktuatif sedikit

      const currentSolar = Math.max(0, (solarInput / 100) * MAX_SOLAR_CAPACITY + solarNoise);
      const currentWind = Math.max(0, (windInput / 100) * MAX_WIND_CAPACITY + windNoise);
      const currentLoad = Math.max(0, loadInput + loadNoise);
      
      const totalGen = currentSolar + currentWind;
      const netLoad = currentLoad - totalGen; // (+) Defisit, (-) Surplus

      // 2. LOGIKA PENGAMBILAN KEPUTUSAN
      let action = 0; // 0: Idle, 1: Discharge, -1: Charge
      let statusMsg = "Balanced";
      let reasonMsg = "";
      let useGrid = false;
      let newSoc = soc;

      // Cek Kondisi Dasar
      const isSurplus = netLoad < 0; // Pembangkitan > Beban (PLTS/PLTB Bagus)
      // const isDeficit = netLoad > 0; 
      const isGridExpensive = gridPrice > GRID_PRICE_EXPENSIVE;
      const batteryNotFull = soc < SOC_MAX_LIMIT;
      const batteryHealthy = soc > SOC_MIN_LIMIT;

      if (isSurplus) {
        // KONDISI: SURPLUS ENERGI
        if (batteryNotFull) {
          // Aturan: Jika < 80% -> Charge
          action = -1; 
          statusMsg = "CHARGING";
          reasonMsg = "Surplus Energy & SOC < 80%";
          // Simulasi Charge
          newSoc = Math.min(100, soc + (Math.abs(netLoad) / BATTERY_CAPACITY) * 5);
        } else {
          // Aturan: Jika = 80% -> Stop Charge (Simpan Energi)
          action = 0;
          statusMsg = "BATTERY LIMIT REACHED";
          reasonMsg = "SOC >= 80% (Stop Charging)";
          // SOC Diam (Holding)
        }
      } else {
        // KONDISI: DEFISIT ENERGI
        if (isGridExpensive) {
           // Aturan: Jika Harga Mahal -> Gunakan Baterai
           if (batteryHealthy) {
             action = 1; // Discharge
             statusMsg = "DISCHARGING";
             reasonMsg = "Gen Low & Grid Expensive";
             // Simulasi Discharge
             newSoc = Math.max(0, soc - (netLoad / BATTERY_CAPACITY) * 5);
           } else {
             // Safety: Baterai Habis (<20%)
             useGrid = true;
             statusMsg = "FORCED GRID";
             reasonMsg = "Battery Critical (<20%)";
           }
        } else {
          // Aturan: Harga Murah -> Pakai Grid, Simpan Baterai
          useGrid = true;
          statusMsg = "USING GRID";
          reasonMsg = "Grid Price Low (Save Battery)";
        }
      }

      // Update SOC State
      setSoc(newSoc);
      setSystemStatus(statusMsg);
      setLogicReason(reasonMsg);
      setGridActive(useGrid);

      // 3. Simpan Data untuk Grafik
      setData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
          solar: parseFloat(currentSolar.toFixed(2)), // Tampilkan 2 desimal biar rapi
          wind: parseFloat(currentWind.toFixed(2)),
          load: parseFloat(currentLoad.toFixed(2)),
          soc: parseFloat(newSoc.toFixed(1)),
          gridPrice: gridPrice,
          action: action,
          netLoad: parseFloat(netLoad.toFixed(2))
        }];
        if (newData.length > 30) newData.shift();
        return newData;
      });

    }, 1000);

    return () => clearInterval(interval);
  }, [time, isRunning, solarInput, windInput, loadInput, gridPrice, soc]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 md:p-6 overflow-x-hidden">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-slate-700 gap-4">
        <div className="w-full md:w-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <Cpu className="text-blue-500 w-6 h-6 md:w-8 md:h-8" />
              <span className="truncate">HRES Smart Controller</span>
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">Logic: if(Surplus &lt; 80%) Charge; if(Deficit &amp; Expensive) Discharge</p>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 bg-slate-800 rounded border border-slate-700">
            <Menu size={20} />
          </button>
        </div>

        <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex items-center gap-3`}>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${gridActive ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
            GRID: {gridActive ? 'CONNECTED' : 'OFF'}
          </div>
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
          >
            {isRunning ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
            {isRunning ? 'Pause Sim' : 'Resume Sim'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* KOLOM KIRI: INPUT PANEL (USER CONTROL) */}
        <div className="order-2 lg:order-1 col-span-1 lg:col-span-3 space-y-6">
          
          {/* Panel Kontrol Manual */}
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 shadow-lg">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Settings size={18} className="text-blue-400"/> Input Parameter
            </h3>
            
            <ControlSlider label="Intensitas Matahari" value={solarInput} setValue={setSolarInput} min={0} max={100} unit="%" color="yellow" />
            <ControlSlider label="Kecepatan Angin" value={windInput} setValue={setWindInput} min={0} max={100} unit="%" color="cyan" />
            <ControlSlider label="Beban Rumah (Load)" value={loadInput} setValue={setLoadInput} min={10} max={120} unit="kW" color="purple" />
            
            <div className="mb-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Harga Listrik Grid</span>
                <span className={gridPrice > 1400 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>Rp {gridPrice}</span>
              </div>
              <input 
                type="range" min={1000} max={2000} step={100}
                value={gridPrice} onChange={(e) => setGridPrice(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Murah (1000)</span>
                <span>Mahal (&gt;1400)</span>
              </div>
            </div>
          </div>

          {/* Decision Logic Viewer */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <h3 className="text-slate-300 font-semibold mb-3 flex items-center gap-2 text-sm">
              <Zap size={16} /> Keputusan Sistem
            </h3>
            <div className="text-center p-3 bg-slate-900 rounded-lg border border-slate-600 mb-2">
              <div className={`text-lg font-bold mb-1 ${
                systemStatus === "CHARGING" ? "text-emerald-400" : 
                systemStatus === "USING GRID" || systemStatus === "FORCED GRID" ? "text-orange-400" : 
                systemStatus === "DISCHARGING" ? "text-blue-400" : "text-slate-300"
              }`}>
                {systemStatus}
              </div>
              <div className="text-xs text-slate-400 italic">{logicReason}</div>
            </div>

            {/* Battery Visual */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Battery SOC</span>
                <span className={soc < 20 ? "text-red-500 font-bold animate-pulse" : soc >= 80 ? "text-yellow-500 font-bold" : "text-white"}>{soc.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-700 h-4 rounded-full overflow-hidden relative">
                 {/* Limit Markers */}
                 <div className="absolute left-[20%] h-full w-0.5 bg-red-500/80 z-10"></div>
                 <div className="absolute left-[80%] h-full w-0.5 bg-yellow-500/80 z-10"></div>
                 
                 <div 
                    className={`h-full transition-all duration-500 ${soc < 20 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{width: `${soc}%`}}
                  ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>0%</span>
                <span className="text-red-400">20% (Min)</span>
                <span className="text-yellow-400">80% (Limit)</span>
                <span>100%</span>
              </div>
            </div>
          </div>

        </div>

        {/* KOLOM KANAN: CHART & MONITORING */}
        <div className="order-1 lg:order-2 col-span-1 lg:col-span-9 space-y-6">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatusCard title="Solar PV" value={data[data.length-1]?.solar || 0} unit="kW" icon={Sun} color="yellow" />
            <StatusCard title="Wind Turbine" value={data[data.length-1]?.wind || 0} unit="kW" icon={Wind} color="blue" />
            <StatusCard title="Load Demand" value={data[data.length-1]?.load || 0} unit="kW" icon={Activity} color="purple" />
            <StatusCard 
              title="Grid Status" 
              value={gridActive ? "ON" : "OFF"} 
              unit={gridActive ? "Importing" : "Standby"} 
              icon={Power} 
              color={gridActive ? "rose" : "green"} 
              alert={gridActive && gridPrice > 1400}
              subtext={gridActive && gridPrice > 1400 ? "High Cost Alert!" : "System Optimized"}
            />
          </div>

          {/* Main Chart: Generation vs Load */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-5 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base md:text-lg font-bold text-white">Monitoring Daya</h3>
              <div className="flex gap-3 text-xs">
                 <span className="flex items-center gap-1 text-yellow-400"><div className="w-2 h-2 bg-yellow-400 rounded-full"></div> Solar</span>
                 <span className="flex items-center gap-1 text-cyan-400"><div className="w-2 h-2 bg-cyan-400 rounded-full"></div> Wind</span>
                 <span className="flex items-center gap-1 text-white"><div className="w-2 h-2 bg-white rounded-full"></div> Load</span>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ left: 10, right: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tick={{dy: 10}}>
                     <Label value="Waktu (Time)" offset={-5} position="insideBottom" style={{fill: '#cbd5e1', fontSize: '12px', fontWeight: 'bold'}} />
                  </XAxis>
                  <YAxis stroke="#94a3b8" fontSize={10}>
                     <Label value="Daya (kW)" angle={-90} position="insideLeft" style={{fill: '#94a3b8', fontSize: '12px'}} />
                  </YAxis>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="solar" stackId="1" stroke="#fbbf24" fill="url(#colorSolar)" />
                  <Area type="monotone" dataKey="wind" stackId="1" stroke="#22d3ee" fill="url(#colorWind)" />
                  <Line type="monotone" dataKey="load" stroke="#ffffff" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SOC Chart */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-5 shadow-lg">
              <h3 className="text-sm font-bold text-slate-300 mb-4">Status Baterai (SOC)</h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorSoc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    {/* Menampilkan sumbu X di grafik kecil juga agar lebih jelas */}
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={8} interval={5} tick={{dy: 5}} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10}>
                       <Label value="Level (%)" angle={-90} position="insideLeft" style={{fill: '#94a3b8', fontSize: '10px'}} />
                    </YAxis>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                    <ReferenceLine y={20} stroke="red" strokeDasharray="3 3" label={{ position: 'right', value: 'Min 20%', fill: 'red', fontSize: 10 }} />
                    <ReferenceLine y={80} stroke="yellow" strokeDasharray="3 3" label={{ position: 'right', value: 'Limit 80%', fill: 'yellow', fontSize: 10 }} />
                    <Area type="monotone" dataKey="soc" stroke="#10b981" strokeWidth={2} fill="url(#colorSoc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grid Price vs Usage */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-5 shadow-lg">
              <h3 className="text-sm font-bold text-slate-300 mb-4">Riwayat Harga Grid</h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    {/* Menampilkan sumbu X di grafik kecil juga agar lebih jelas */}
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={8} interval={5} tick={{dy: 5}} />
                    <YAxis domain={[0, 2000]} stroke="#94a3b8" fontSize={10}>
                       <Label value="Harga (Rp)" angle={-90} position="insideLeft" style={{fill: '#94a3b8', fontSize: '10px'}} />
                    </YAxis>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                    <ReferenceLine y={1400} stroke="orange" strokeDasharray="3 3" label={{ position: 'top', value: 'Expensive Threshold', fill: 'orange', fontSize: 10 }} />
                    <Line type="step" dataKey="gridPrice" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}