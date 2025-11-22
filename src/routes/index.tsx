import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import Chart from "chart.js/auto";
import { Title } from "@solidjs/meta";
import { FIFA_COUNTRIES } from "~/data/countries";
import { downloadCSV, downloadJSON } from "~/utils/download";
import { RankingHistoryItem } from "~/types";

interface RankingResult {
  countryCode: string;
  countryName: string;
  rank: number;
  previousRank: number;
  points: number;
  date: string;
  gender: string;
}



const COLORS = [
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
  "#14b8a6", // teal-500
  "#d946ef", // fuchsia-500
  "#e11d48", // rose-600
  "#22c55e", // green-500
  "#0ea5e9", // sky-500
  "#a855f7", // purple-500
  "#f43f5e", // rose-500
  "#64748b", // slate-500
  "#a3e635", // lime-400
  "#2dd4bf", // teal-400
  "#fbbf24", // amber-400
  "#c084fc", // purple-400
  "#f472b6", // pink-400
  "#38bdf8", // sky-400
  "#818cf8", // indigo-400
  "#fb7185", // rose-400
  "#34d399", // emerald-400
  "#a78bfa", // violet-400
  "#e879f9", // fuchsia-400
  "#22d3ee", // cyan-400
];

export default function Dashboard() {
  const [selectedCountries, setSelectedCountries] = createSignal<string[]>([]);
  const [gender, setGender] = createSignal("1"); // 1 = Men, 2 = Women
  const [footballType, setFootballType] = createSignal("football");
  const [results, setResults] = createSignal<RankingResult[]>([]);
  const [historyData, setHistoryData] = createSignal<Record<string, RankingHistoryItem[]>>({});
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal("");

  // Time range state
  const [timeRange, setTimeRange] = createSignal("all"); // "1y", "2y", "3y", "4y", "5y", "6y", "all", "custom"
  const [customStartYear, setCustomStartYear] = createSignal(new Date().getFullYear() - 10);
  const [customEndYear, setCustomEndYear] = createSignal(new Date().getFullYear());

  let chartCanvas: HTMLCanvasElement | undefined;
  let chartInstance: Chart | null = null;

  // Filter countries based on search
  const filteredCountries = () =>
    FIFA_COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(search().toLowerCase()) ||
      c.code.toLowerCase().includes(search().toLowerCase())
    );

  const toggleCountry = (code: string) => {
    const current = selectedCountries();
    if (current.includes(code)) {
      setSelectedCountries(current.filter(c => c !== code));
    } else {
      setSelectedCountries([...current, code]);
    }
  };

  const updateChart = () => {
    if (!chartCanvas) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const countries = Object.keys(historyData());
    if (countries.length === 0) return;

    // Filter history based on time range
    const filteredHistoryData: Record<string, RankingHistoryItem[]> = {};
    const now = new Date();

    Object.keys(historyData()).forEach(code => {
      const history = historyData()[code];
      filteredHistoryData[code] = history.filter(item => {
        const itemDate = new Date(item.PubDate);

        if (timeRange() === "custom") {
          const year = itemDate.getFullYear();
          return year >= customStartYear() && year <= customEndYear();
        } else if (timeRange() !== "all") {
          const years = parseInt(timeRange().replace("y", ""));
          const cutoffDate = new Date();
          cutoffDate.setFullYear(now.getFullYear() - years);
          return itemDate >= cutoffDate;
        }
        return true;
      });
    });

    // Get all unique dates from filtered data and sort them
    const allDates = new Set<string>();
    Object.values(filteredHistoryData).forEach(history => {
      history.forEach(item => {
        allDates.add(new Date(item.PubDate).toLocaleDateString());
      });
    });
    const labels = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const datasets = countries.map((code, index) => {
      const history = filteredHistoryData[code];
      // Create a map of date -> rank for easy lookup
      const rankMap = new Map(history.map(h => [new Date(h.PubDate).toLocaleDateString(), h.Rank]));

      const data = labels.map(date => rankMap.get(date) || null);

      const color = index < COLORS.length
        ? COLORS[index]
        : COLORS[Math.floor(Math.random() * COLORS.length)];

      return {
        label: `${history[0]?.TeamName[0]?.Description || code} (${code})`,
        data: data,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    chartInstance = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            reverse: true, // Rank 1 is at the top
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#9ca3af'
            },
            title: {
              display: true,
              text: 'Rank',
              color: '#9ca3af'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#9ca3af'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(75, 85, 99, 0.5)',
            borderWidth: 1
          }
        }
      }
    });
  };

  const fetchRankings = async () => {
    if (selectedCountries().length === 0) return;

    setLoading(true);
    setResults([]);
    setHistoryData({});

    try {
      const promises = selectedCountries().map(async (code) => {
        const res = await fetch(
          `/api/rankings?countryCode=${code}&gender=${gender()}&footballType=${footballType()}`
        );
        const data = await res.json();

        // Handle history data (rankings array)
        const rankings = data.rankings as RankingHistoryItem[];

        if (rankings && rankings.length > 0) {
          // Sort by date descending for current rank check
          rankings.sort((a, b) => new Date(b.PubDate).getTime() - new Date(a.PubDate).getTime());

          const current = rankings[0];
          const previous = rankings[1] || current;

          return {
            result: {
              countryCode: code,
              countryName: current.TeamName?.[0]?.Description || code,
              rank: current.Rank,
              previousRank: previous.Rank,
              points: current.TotalPoints,
              date: current.PubDate,
              gender: gender() === "1" ? "Men" : "Women"
            },
            history: rankings,
            code: code
          };
        }
        return null;
      });

      const fetchedData = (await Promise.all(promises)).filter(Boolean);

      const newResults: RankingResult[] = [];
      const newHistory: Record<string, RankingHistoryItem[]> = {};

      fetchedData.forEach(item => {
        if (item) {
          newResults.push(item.result);
          newHistory[item.code] = item.history;
        }
      });

      setResults(newResults);
      setHistoryData(newHistory);
      updateChart();

    } catch (err) {
      console.error("Error fetching rankings:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main class="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <Title>FIFA Ranking Preview and Download</Title>

      <div class="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div class="text-start space-y-2">
          <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            FIFA Ranking Preview and Download
          </h1>
          <p class="text-gray-400">Select countries to compare their latest FIFA rankings</p>
        </div>

        {/* Controls */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Filters */}
          <div class="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4 h-fit">
            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
              ⚙️ Settings
            </h2>

            <div class="space-y-2">
              <label class="text-sm text-gray-400">Gender</label>
              <div class="flex gap-2 p-1 bg-gray-800 rounded-lg">
                <button
                  onClick={() => setGender("1")}
                  class={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${gender() === "1" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                >
                  Men's
                </button>
                <button
                  onClick={() => setGender("2")}
                  class={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${gender() === "2" ? "bg-pink-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                >
                  Women's
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm text-gray-400">Football Type</label>
              <select
                value={footballType()}
                onChange={(e) => setFootballType(e.currentTarget.value)}
                class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="football">Football (Soccer)</option>
                <option value="futsal">Futsal</option>
                <option value="beach">Beach Soccer</option>
              </select>
            </div>

            <button
              onClick={fetchRankings}
              disabled={loading() || selectedCountries().length === 0}
              class="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              {loading() ? "Fetching Data..." : "Get Rankings"}
            </button>
          </div>

          {/* Country Selector */}
          <div class="md:col-span-2 bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col h-[500px]">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold text-white">Select Countries</h2>
              <span class="text-sm text-blue-400 font-medium">
                {selectedCountries().length} selected
              </span>
            </div>

            {/* Selected Tags */}
            <Show when={selectedCountries().length > 0}>
              <div class="flex flex-wrap gap-2 mb-4">
                <For each={selectedCountries()}>
                  {(code) => (
                    <button
                      onClick={() => toggleCountry(code)}
                      class="flex items-center gap-1 bg-blue-900/50 text-blue-200 px-3 py-1 rounded-full text-sm border border-blue-500/30 hover:bg-blue-900/70 hover:border-blue-500/50 transition-colors group"
                    >
                      <span class="font-mono font-semibold">#{code}</span>
                      <span class="text-blue-400 group-hover:text-blue-200">×</span>
                    </button>
                  )}
                </For>
                <button
                  onClick={() => setSelectedCountries([])}
                  class="text-xs text-gray-500 hover:text-gray-300 underline px-2"
                >
                  Clear all
                </button>
              </div>
            </Show>

            <input
              type="text"
              placeholder="Search country..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div class="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
              <For each={filteredCountries()}>
                {(country) => (
                  <button
                    onClick={() => toggleCountry(country.code)}
                    class={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${selectedCountries().includes(country.code)
                      ? "bg-blue-900/30 border border-blue-500/50 text-blue-100"
                      : "bg-gray-800/50 border border-transparent hover:bg-gray-800 text-gray-300"
                      }`}
                  >
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-xs bg-gray-950 px-2 py-1 rounded text-gray-500">
                        {country.code}
                      </span>
                      <span>{country.name}</span>
                    </div>
                    <Show when={selectedCountries().includes(country.code)}>
                      <span class="text-blue-400">✓</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <Show when={results().length > 0}>
          <div class="space-y-8">
            {/* Chart Section */}
            <div class="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="flex items-center gap-4">
                  <h2 class="text-xl font-semibold text-white">Ranking History</h2>
                  <div class="flex gap-2">
                    <button
                      onClick={() => downloadCSV(historyData())}
                      class="flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md text-xs font-medium transition-colors border border-gray-700"
                      title="Download as CSV"
                    >
                      <span>📊</span> CSV
                    </button>
                    <button
                      onClick={() => downloadJSON(historyData())}
                      class="flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md text-xs font-medium transition-colors border border-gray-700"
                      title="Download as JSON"
                    >
                      <span>{ }</span> JSON
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <div class="flex bg-gray-800 rounded-lg p-1 overflow-x-auto max-w-full">
                    <For each={["1y", "2y", "3y", "4y", "5y", "6y", "all"]}>
                      {(range) => (
                        <button
                          onClick={() => {
                            setTimeRange(range);
                            updateChart();
                          }}
                          class={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${timeRange() === range
                            ? "bg-blue-600 text-white"
                            : "text-gray-400 hover:text-white hover:bg-gray-700"
                            }`}
                        >
                          {range === "all" ? "All Years" : `${range.replace("y", "")} Year${range !== "1y" ? "s" : ""}`}
                        </button>
                      )}
                    </For>
                    <button
                      onClick={() => {
                        setTimeRange("custom");
                        updateChart();
                      }}
                      class={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${timeRange() === "custom"
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                        }`}
                    >
                      Custom
                    </button>
                  </div>

                  <Show when={timeRange() === "custom"}>
                    <div class="flex items-center gap-2 bg-gray-800 p-1 rounded-lg">
                      <input
                        type="number"
                        min="1990"
                        max={new Date().getFullYear()}
                        value={customStartYear()}
                        onInput={(e) => {
                          setCustomStartYear(parseInt(e.currentTarget.value));
                          updateChart();
                        }}
                        class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <span class="text-gray-400 text-xs">-</span>
                      <input
                        type="number"
                        min="1990"
                        max={new Date().getFullYear()}
                        value={customEndYear()}
                        onInput={(e) => {
                          setCustomEndYear(parseInt(e.currentTarget.value));
                          updateChart();
                        }}
                        class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </Show>
                </div>
              </div>

              <div class="h-[400px] w-full">
                <canvas ref={chartCanvas} />
              </div>
            </div>

            <div class="space-y-4">
              <h2 class="text-2xl font-bold text-white">Current Rankings</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <For each={results().sort((a, b) => a.rank - b.rank)}>
                  {(item) => (
                    <div class="bg-gray-900 rounded-xl border border-gray-800 p-6 relative overflow-hidden group hover:border-gray-700 transition-colors">
                      <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span class="text-6xl font-bold">{item.rank}</span>
                      </div>

                      <div class="relative z-10">
                        <div class="flex justify-between items-start mb-4">
                          <div>
                            <h3 class="text-xl font-bold text-white">{item.countryName}</h3>
                            <span class="text-sm text-gray-400">{item.gender} • {item.countryCode}</span>
                          </div>
                          <div class="bg-gray-800 px-3 py-1 rounded-full text-sm font-mono">
                            {item.points.toFixed(2)} pts
                          </div>
                        </div>

                        <div class="flex items-end gap-2">
                          <span class="text-4xl font-bold text-white">#{item.rank}</span>
                          <div class={`flex items-center text-sm font-medium mb-1 ${item.previousRank > item.rank ? "text-green-400" :
                            item.previousRank < item.rank ? "text-red-400" : "text-gray-500"
                            }`}>
                            {item.previousRank > item.rank ? "▲" : item.previousRank < item.rank ? "▼" : "−"}
                            {Math.abs(item.previousRank - item.rank)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </main>
  );
}
