export interface RankingItem {
    rank: number;
    previousRank: number;
    points: number;
    previousPoints: number;
    countryCode: string;
    countryName: string;
    date: string;
}

export interface FifaApiResponse {
    rankings: Array<{
        rankingItem: {
            rank: number;
            previousRank: number;
            totalPoints: number;
            previousTotalPoints: number;
            countryCode: string;
            countryName: string;
        };
        tag: {
            id: string;
            text: string;
        };
    }>;
}
export interface RankingHistoryItem {
    IdCountry: string;
    TeamName: { Description: string }[];
    Rank: number;
    TotalPoints: number;
    PubDate: string;
}
