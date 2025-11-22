import { RankingHistoryItem } from "../types";

interface CountryRankingData {
    rank: number;
    points: number;
    countryName: string;
}

interface TimeSeriesEntry {
    date: string;
    [key: string]: CountryRankingData | string;
}

export const downloadCSV = (historyData: Record<string, RankingHistoryItem[]>) => {
    const countries = Object.keys(historyData);
    if (countries.length === 0) return;

    // Get all unique dates and sort them
    const allDates = new Set<string>();
    Object.values(historyData).forEach(history => {
        history.forEach(item => {
            allDates.add(new Date(item.PubDate).toISOString().split('T')[0]);
        });
    });
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Create Header
    // Date, Country1 Rank, Country1 Points, Country2 Rank, Country2 Points...
    let csvContent = "Date";
    countries.forEach(code => {
        csvContent += `,${code} Rank,${code} Points`;
    });
    csvContent += "\n";

    // Create Rows
    sortedDates.forEach(date => {
        let row = `${date}`;
        countries.forEach(code => {
            const history = historyData[code];
            // Find item for this date (comparing YYYY-MM-DD)
            const item = history.find(h => new Date(h.PubDate).toISOString().split('T')[0] === date);

            if (item) {
                row += `,${item.Rank},${item.TotalPoints}`;
            } else {
                row += `,,`; // Empty values if no data for this date
            }
        });
        csvContent += row + "\n";
    });

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fifa_ranking_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const downloadJSON = (historyData: Record<string, RankingHistoryItem[]>) => {
    const countries = Object.keys(historyData);
    if (countries.length === 0) return;

    // Get all unique dates and sort them
    const allDates = new Set<string>();
    Object.values(historyData).forEach(history => {
        history.forEach(item => {
            allDates.add(new Date(item.PubDate).toISOString().split('T')[0]);
        });
    });
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Transform to Time Series JSON
    const jsonOutput: TimeSeriesEntry[] = sortedDates.map(date => {
        const entry: TimeSeriesEntry = { date };
        countries.forEach(code => {
            const history = historyData[code];
            const item = history.find(h => new Date(h.PubDate).toISOString().split('T')[0] === date);
            if (item) {
                entry[code] = {
                    rank: item.Rank,
                    points: item.TotalPoints,
                    countryName: item.TeamName[0]?.Description
                };
            }
        });
        return entry;
    });

    // Download
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fifa_ranking_history_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
