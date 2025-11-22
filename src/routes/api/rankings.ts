import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

export async function GET({ request }: APIEvent) {
    const url = new URL(request.url);
    const countryCode = url.searchParams.get("countryCode");
    const gender = url.searchParams.get("gender") || "1";
    const footballType = url.searchParams.get("footballType") || "football";

    if (!countryCode) {
        return json({ error: "Country code is required" }, { status: 400 });
    }

    try {
        const fifaUrl = `https://inside.fifa.com/api/rankings/by-country?gender=${gender}&countryCode=${countryCode}&footballType=${footballType}&locale=en`;
        console.log("Fetching:", fifaUrl);

        const response = await fetch(fifaUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`FIFA API responded with ${response.status}`);
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        console.error("API Error:", error);
        return json({ error: "Failed to fetch data" }, { status: 500 });
    }
}
