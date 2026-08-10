chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXCHANGE_CODE_FOR_TOKEN") {
        if (!request.code || !request.verifier) {
            sendResponse({ success: false, error: "Code ou verifier manquant." });
            return true;
        }

        const details = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: request.clientID,
            client_secret: request.clientSecret,
            code: request.code,
            code_verifier: request.verifier,
            redirect_uri: request.redirectUri
        });

        fetch('https://myanimelist.net/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: details.toString()
        })
            .then(async response => {
                const data = await response.json();
                console.log(data)
                if (!response.ok) {
                    throw new Error(data.message || 'Erreur lors de l’échange du token');
                }
                console.log("SUCCESS")
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error("Erreur fetch token:", error);
                sendResponse({ success: false, error: error.message });
            });

        return true;
    } else if (request.action === "GET-ANIME-INFORMATION") {
        (async () => {

            const fields = [
                "id", "title", "main_picture", "alternative_titles", "start_date", "end_date",
                "synopsis", "mean", "rank", "popularity", "num_list_users", "num_scoring_users",
                "nsfw", "created_at", "updated_at", "media_type", "status", "genres",
                "my_list_status", "num_episodes", "start_season", "broadcast", "source",
                "average_episode_duration", "rating", "studios", "pictures", "background",
                "related_anime", "related_manga", "recommendations", "statistics"
            ];

            var anime_name = request['anime_name']
            var editedAnimeName = anime_name.split(/[:–—]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()
            if (editedAnimeName.split(" ").length > 8) {
                editedAnimeName = editedAnimeName.split(" ").slice(0, 8).join(" ")
            }

            console.log(editedAnimeName)

            var response = await fetch(`https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(editedAnimeName)}&nsfw=true&fields=${fields.join(',')}`, {
                method: "GET",
                headers: {
                    'X-MAL-CLIENT-ID': request.client_id
                }
            })

            if (!response.ok) {
                sendResponse({ success: false, error: `API Error: ${response.status}` })
                if (response.status === 401) {
                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                        if (chrome.runtime.lastError) {
                            console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                        }
                    });
                }
                return console.error(`ERROR: ${response.status}`)
            }

            const data = await response.json()
            var datas = data.data

            const correctAnime = datas.find(item => {
                const node = item.node
                const title = node.title?.toLowerCase() || ""
                const enTitle = node.alternative_titles?.en.toLowerCase() || ""
                const synonyms = node.alternative_titles?.synonyms || []

                const searchedAnime = anime_name.toLowerCase()

                return title === searchedAnime || enTitle === searchedAnime || synonyms.some(syn => syn.toLowerCase() === searchedAnime)
            })

            if (!correctAnime) {
                datas = datas[0]
            } else {
                datas = correctAnime
            }

            console.log(datas)
            sendResponse({ success: true, data: datas })

        })()

        return true;
    }
});