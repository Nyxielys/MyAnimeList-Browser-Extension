var globalInfo = {
    "MAL_CLIENT_ID": undefined,
    "MAL_CLIENT_SECRET": undefined,
    "EXTENSION_ID": "ongamdeehfnghjpbofhhipcebdbknmkh"
}

async function isUserConnected() {
    var accessToken = await chrome.storage.local.get(["mal_access_token"]);
    var refreshToken = await chrome.storage.local.get(["mal_refresh_token"]);

    var client_id = await chrome.storage.local.get(["mal_client_id"])
    var client_secret = await chrome.storage.local.get(["mal_client_secret"])

    accessToken = accessToken?.mal_access_token
    refreshToken = refreshToken?.mal_refresh_token

    client_id = client_id?.mal_client_id
    client_secret = client_secret?.mal_client_secret

    const isLoggedIn = !!accessToken;
    const hasRefreshToken = !!refreshToken;

    const hasClientID = !!client_id;
    const hasClientSecret = !!client_secret;

    if (!isLoggedIn || !hasRefreshToken || !hasClientID || !hasClientSecret) {
        return false
    }

    return true
}

function generatePKCE() {
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);

    const verifier = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return { verifier, challenge: verifier };
}

async function getAnimeOnThisPage() {
    var isConnected = await isUserConnected()
    if (isConnected === false) return

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";

    if (url.includes("crunchyroll.com/watch") || url.includes("crunchyroll.com/fr/watch") || url.includes("crunchyroll.com/series") || url.includes("crunchyroll.com/fr/series")) {
        const parentDiv = document.getElementById('this-page-results')
        function clearResults() {
            parentDiv.innerHTML = ''
        }

        await clearResults()

        showView("view-anime")

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

            if (url.includes('/watch')) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: "GET-WATCHING-ANIME-INFOS" },
                    async (response) => {

                        if (chrome.runtime.lastError) {
                            console.error(chrome.runtime.lastError)
                        }

                        if (response.success === true) {
                            chrome.runtime.sendMessage({
                                action: "GET-ANIME-INFORMATION",
                                client_id: globalInfo['MAL_CLIENT_ID'],
                                anime_name: response.data['title']
                            }, async datas => {
                                var data = datas.data

                                var anime_genres = data.node.genres.map(genre => genre.name).join(', ')

                                var diffusionStatus
                                if (data.node.status === 'finished_airing') {
                                    diffusionStatus = 'Finished airing'
                                } else if (data.node.status === 'currently_airing') {
                                    diffusionStatus = 'Currently airing'
                                } else if (data.node.status === 'not_yet_aired') {
                                    diffusionStatus = 'Not yet aired'
                                }

                                var ranking = data?.node?.rank ?? `??`
                                var anime_genres = data.node.genres.map(genre => genre.name).join(', ')

                                var accessToken = await chrome.storage.local.get(["mal_access_token"])
                                accessToken = accessToken?.mal_access_token
                                var isThisAnimeInAnimeList = await fetch(`https://api.myanimelist.net/v2/anime/${data.node.id}?fields=my_list_status,num_episodes`, {
                                    method: "GET",
                                    headers: { 'Authorization': `Bearer ${accessToken}` }
                                })

                                if (!isThisAnimeInAnimeList.ok) {
                                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                                        if (chrome.runtime.lastError) {
                                            console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                                        } else {
                                            await showView('view-login')
                                        }
                                    });
                                }

                                var anime_datas = await isThisAnimeInAnimeList.json()

                                var isInMyList
                                if (anime_datas?.my_list_status) {
                                    var anime_status = anime_datas?.my_list_status?.status ?? null
                                    if (anime_status === null) {
                                        anime_status = "[❓] Unknown"
                                    } else if (anime_status === 'watching') {
                                        anime_status = "[👀] Currently watching"
                                    } else if (anime_status === 'completed') {
                                        anime_status = '[✅] Completed'
                                    } else if (anime_status === 'on_hold') {
                                        anime_status = '[⌛] On hold'
                                    } else if (anime_status === 'dropped') {
                                        anime_status = '[❌] Dropped'
                                    } else if (anime_status === 'plan_to_watch') {
                                        anime_status = '[📋] Plan to watch'
                                    }

                                    var totalAnimeEps = anime_datas?.num_episodes ?? '??'
                                    if (totalAnimeEps.toString() === '0') totalAnimeEps = '??'

                                    isInMyList = `
                                        <p id="anime-informations">
                                            <b>⭐ Rated:</b> ${anime_datas?.my_list_status?.score ?? '0'}/10
                                            <br><b>📺 Status:</b> ${anime_status}
                                            <br><b>👀 Episodes watched:</b> ${anime_datas?.my_list_status?.num_episodes_watched ?? '0'}/${totalAnimeEps}
                                        </p>
                                        <div id="anime-card-buttons">
                                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${data.node.id}">Open on MAL</button>
                                            <button id="edit-anime-list" data-anime_id="${data.node.id}">Edit</button>
                                        </div>
                                        <div id="anime-card-dlt-btn">
                                            <button id="delete-anime-from-list" data-anime_id="${data.node.id}" data-is_from="view-anime">Remove from my anime list</button>
                                        </div>
                                        `
                                } else {
                                    isInMyList = `
                                        <p id="anime-informations">
                                            <b>⭐ Rating on MAL:</b> ${data.node?.mean ?? 'Unknown'}/10
                                            <br><b>📊 Ranking:</b> ${ranking}
                                            <br><b>📋 Genres:</b> ${anime_genres}
                                            <br><b>📺 Status:</b> ${diffusionStatus}
                                        </p>
                                        <div id="anime-card-buttons">
                                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${data.node.id}"><b>Open on MAL</b></button>
                                        </div>
                                        <div id="anime-card-addwatchlist-btn">
                                            <button id="add-to-watchlist-btn" data-anime_id="${data.node.id}" data-is_from="view-anime">Add to watchlist</button>
                                        </div>
                                        `
                                }

                                var diffusionStatus
                                if (data.node.status === 'finished_airing') {
                                    diffusionStatus = 'Finished airing'
                                } else if (data.node.status === 'currently_airing') {
                                    diffusionStatus = 'Currently airing'
                                } else if (data.node.status === 'not_yet_aired') {
                                    diffusionStatus = 'Not yet aired'
                                }

                                var ranking = data?.node?.rank ?? `??`

                                const newDiv = `
                                        <div class="anime-card">
                                            <div class="anime-card-infos">
                                                <h3>${data.node.title}</h3>
                                                ${isInMyList}
                                            </div>
                                            <div class="anime-card-img">
                                                <img src="${data.node.main_picture.large}" alt="anime image">
                                            </div>
                                        </div>`

                                parentDiv.insertAdjacentHTML("beforeend", newDiv)
                            })
                        } else {
                            return;
                        }

                    })
            } else if (url.includes('/series')) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: "GET-CURRENT-PAGE-ANIME-INFOS" },
                    async (response) => {

                        if (chrome.runtime.lastError) {
                            console.error(chrome.runtime.lastError)
                        }

                        if (response.success === true) {
                            chrome.runtime.sendMessage({
                                action: "GET-ANIME-INFORMATION",
                                client_id: globalInfo['MAL_CLIENT_ID'],
                                anime_name: response.data['title']
                            }, async datas => {
                                var data = datas.data

                                var anime_genres = data.node.genres.map(genre => genre.name).join(', ')

                                var diffusionStatus
                                if (data.node.status === 'finished_airing') {
                                    diffusionStatus = 'Finished airing'
                                } else if (data.node.status === 'currently_airing') {
                                    diffusionStatus = 'Currently airing'
                                } else if (data.node.status === 'not_yet_aired') {
                                    diffusionStatus = 'Not yet aired'
                                }

                                var ranking = data?.node?.rank ?? `??`
                                var anime_genres = data.node.genres.map(genre => genre.name).join(', ')

                                var accessToken = await chrome.storage.local.get(["mal_access_token"])
                                accessToken = accessToken?.mal_access_token
                                var isThisAnimeInAnimeList = await fetch(`https://api.myanimelist.net/v2/anime/${data.node.id}?fields=my_list_status,num_episodes`, {
                                    method: "GET",
                                    headers: { 'Authorization': `Bearer ${accessToken}` }
                                })

                                if (!isThisAnimeInAnimeList.ok) {
                                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                                        if (chrome.runtime.lastError) {
                                            console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                                        } else {
                                            await showView('view-login')
                                        }
                                    });
                                }

                                var anime_datas = await isThisAnimeInAnimeList.json()

                                var isInMyList
                                if (anime_datas?.my_list_status) {
                                    var anime_status = anime_datas?.my_list_status?.status ?? null
                                    if (anime_status === null) {
                                        anime_status = "[❓] Unknown"
                                    } else if (anime_status === 'watching') {
                                        anime_status = "[👀] Currently watching"
                                    } else if (anime_status === 'completed') {
                                        anime_status = '[✅] Completed'
                                    } else if (anime_status === 'on_hold') {
                                        anime_status = '[⌛] On hold'
                                    } else if (anime_status === 'dropped') {
                                        anime_status = '[❌] Dropped'
                                    } else if (anime_status === 'plan_to_watch') {
                                        anime_status = '[📋] Plan to watch'
                                    }

                                    var totalAnimeEps = anime_datas?.num_episodes ?? '??'
                                    if (totalAnimeEps.toString() === '0') totalAnimeEps = '??'

                                    isInMyList = `
                                        <p id="anime-informations">
                                            <b>⭐ Rated:</b> ${anime_datas?.my_list_status?.score ?? '0'}/10
                                            <br><b>📺 Status:</b> ${anime_status}
                                            <br><b>👀 Episodes watched:</b> ${anime_datas?.my_list_status?.num_episodes_watched ?? '0'}/${totalAnimeEps}
                                        </p>
                                        <div id="anime-card-buttons">
                                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${data.node.id}">Open on MAL</button>
                                            <button id="edit-anime-list" data-anime_id="${data.node.id}">Edit</button>
                                        </div>
                                        <div id="anime-card-dlt-btn">
                                            <button id="delete-anime-from-list" data-anime_id="${data.node.id}" data-is_from="view-anime">Remove from my anime list</button>
                                        </div>
                                        `
                                } else {
                                    isInMyList = `
                                        <p id="anime-informations">
                                            <b>⭐ Rating on MAL:</b> ${data.node?.mean ?? 'Unknown'}/10
                                            <br><b>📊 Ranking:</b> ${ranking}
                                            <br><b>📋 Genres:</b> ${anime_genres}
                                            <br><b>📺 Status:</b> ${diffusionStatus}
                                        </p>
                                        <div id="anime-card-buttons">
                                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${data.node.id}"><b>Open on MAL</b></button>
                                        </div>
                                        <div id="anime-card-addwatchlist-btn">
                                            <button id="add-to-watchlist-btn" data-anime_id="${data.node.id}" data-is_from="view-anime">Add to watchlist</button>
                                        </div>
                                        `
                                }

                                var diffusionStatus
                                if (data.node.status === 'finished_airing') {
                                    diffusionStatus = 'Finished airing'
                                } else if (data.node.status === 'currently_airing') {
                                    diffusionStatus = 'Currently airing'
                                } else if (data.node.status === 'not_yet_aired') {
                                    diffusionStatus = 'Not yet aired'
                                }

                                var ranking = data?.node?.rank ?? `??`

                                const newDiv = `
                                        <div class="anime-card">
                                            <div class="anime-card-infos">
                                                <h3>${data.node.title}</h3>
                                                ${isInMyList}
                                            </div>
                                            <div class="anime-card-img">
                                                <img src="${data.node.main_picture.large}" alt="anime image">
                                            </div>
                                        </div>`

                                parentDiv.insertAdjacentHTML("beforeend", newDiv)
                            })
                        } else {
                            return;
                        }

                    })
            }
        })
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        var accessToken = await chrome.storage.local.get(["mal_access_token"]);
        var refreshToken = await chrome.storage.local.get(["mal_refresh_token"]);

        var client_id = await chrome.storage.local.get(["mal_client_id"])
        var client_secret = await chrome.storage.local.get(["mal_client_secret"])

        accessToken = accessToken?.mal_access_token
        refreshToken = refreshToken?.mal_refresh_token

        client_id = client_id?.mal_client_id
        client_secret = client_secret?.mal_client_secret

        const isLoggedIn = !!accessToken;
        const hasRefreshToken = !!refreshToken;

        const hasClientID = !!client_id;
        const hasClientSecret = !!client_secret;


        if (!hasClientID || !hasClientSecret) {
            showView('view-extension-introduction')
            var currentStep = await chrome.storage.local.get(["intro_step"])
            currentStep = currentStep?.intro_step

            if (!currentStep) {
                gotoStep('step-1')
            } else {
                gotoStep(currentStep)
            }

            return
        } else {
            globalInfo['MAL_CLIENT_ID'] = client_id
            globalInfo['MAL_CLIENT_SECRET'] = client_secret
        }

        if (!isLoggedIn || !hasRefreshToken) {
            showView("view-login");
            return;
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab?.url || "";

        await getAnimeOnThisPage()

        if (!url.includes("crunchyroll.com/watch") && !url.includes("crunchyroll.com/fr/watch") && !url.includes("crunchyroll.com/series") && !url.includes("crunchyroll.com/fr/series")) {
            showView("view-home")
        }

        await getAnimeList()

    } catch (error) {
        console.error("Erreur dans le popup.js :", error);
    }
});

async function showView(viewId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";

    await document.querySelectorAll(".view").forEach(el =>
        el.style.display = "none",
    );
    await document.querySelectorAll(".notif").forEach(el =>
        el.style.display = "none",
    );
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.removeProperty("display");
    }

    var isConnected = await isUserConnected()
    await document.querySelectorAll(".login-normal-nav-bar").forEach(e =>
        e.style.display = "none",
    )

    await document.querySelectorAll(".login-not-connected-nav-bar").forEach(e =>
        e.style.display = "none",
    )

    if (isConnected === false && viewId === "view-logout") {
        const targetNav = await document.querySelector('.login-not-connected-nav-bar')
        if (targetNav) {
            targetNav.style.removeProperty('display')
        }
    } else if (isConnected === true && viewId === "view-logout") {
        const targetNav = await document.querySelector('.login-normal-nav-bar')
        if (targetNav) {
            targetNav.style.removeProperty('display')
        }
    }

    if (isConnected === false) return

    if (url.includes("crunchyroll.com/watch") || url.includes("crunchyroll.com/fr/watch") || url.includes("crunchyroll.com/series") || url.includes("crunchyroll.com/fr/series")) {
        if (viewId === "view-anime") return
        const notifView = document.getElementById('view-notif')
        if (notifView) {
            notifView.style.removeProperty("display")
        }
    }

}

document.getElementById('btn-login').onclick = async () => {
    try {
        const { verifier, challenge } = generatePKCE();

        const MAL_REDIRECT_URI = `https://${globalInfo['EXTENSION_ID']}.chromiumapp.org/callback`
        await chrome.storage.local.set({ pkce_verifier: verifier });

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: globalInfo['MAL_CLIENT_ID'],
            code_challenge: challenge,
            code_challenge_method: 'plain',
            redirect_uri: MAL_REDIRECT_URI
        });

        var authUrl = `https://myanimelist.net/v1/oauth2/authorize?${params.toString()}`;

        await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (redirectedUrl) => {
            if (chrome.runtime.lastError || !redirectedUrl) {
                console.error("Erreur d'authentification :", chrome.runtime.lastError.message);
                alert('Error while attempting to connect. The Client ID and/or Client Secret are likely incorrect; please try again.')
                await chrome.storage.local.remove(['mal_client_id', 'mal_client_secret'])
                await showView('view-extension-introduction')
                await gotoStep('step-1')
                return;
            }

            const urlParams = new URLSearchParams(new URL(redirectedUrl).search);
            const code = urlParams.get('code');

            chrome.runtime.sendMessage({
                action: "EXCHANGE_CODE_FOR_TOKEN",
                code: code,
                verifier: verifier,
                redirectUri: MAL_REDIRECT_URI,
                clientID: globalInfo['MAL_CLIENT_ID'],
                clientSecret: globalInfo['MAL_CLIENT_SECRET']
            }, async (response) => {
                if (response && response.success) {

                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token']);

                    await chrome.storage.local.set({
                        mal_access_token: response.data.access_token,
                        mal_refresh_token: response.data.refresh_token
                    });

                    await showView('view-home')
                    await getAnimeList()
                } else {
                    console.error("Error :", response.error);
                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token']);
                }
            });

        });
    } catch (error) {
        console.error('Erreur lors de la préparation de l\'authentification:', error);
        alert('Une erreur est survenue, veuillez réessayer.');
    }
};

document.addEventListener('click', async (e) => {
    const current_button = e.target.closest('button');

    var open_anime_link_btn = e.target.closest('#open-anime-link');
    var login_view_btn = e.target.closest('#nav-bar-login')
    var logout_view_btn = e.target.closest('#nav-bar-logout')
    var logout_btn = e.target.closest("#logout-btn")

    var reset_all_btn = e.target.closest('#reset-all-btn')

    var goto_btn = e.target.closest('#nav-bar') || e.target.closest('#notif-view-page-anime-btn')
    var anime_search_btn = e.target.closest('#search-anime-btn')

    var only_next_anime_search_btn = e.target.closest('#only-next-searched-anime-btn')
    var only_previous_anime_search_btn = e.target.closest('#only-previous-searched-anime-btn')
    var next_anime_search_btn = e.target.closest('#next-searched-anime-btn')
    var previous_anime_search_btn = e.target.closest('#previous-searched-anime-btn')

    var only_next_anime_list_btn = e.target.closest('#only-next-anime-list-btn')
    var only_previous_anime_list_btn = e.target.closest('#only-previous-anime-list-btn')
    var next_anime_list_btn = e.target.closest('#next-anime-list-btn')
    var previous_anime_list_btn = e.target.closest('#previous-anime-list-btn')

    var edit_anime_from_anime_list_btn = e.target.closest('#edit-anime-list')
    var confirm_anime_list_editing_btn = e.target.closest('#confirm-anime-list-editing')

    var add_to_watchlist_btn = e.target.closest('#add-to-watchlist-btn')
    var delete_from_animelist_btn = e.target.closest('#delete-anime-from-list')

    var step1_open_link_btn = e.target.closest('.goto-step2')
    var goto_step3_btn = e.target.closest('#goto-step3')

    var copy_redirecturi_btn = e.target.closest('#copy_redirecturi')
    var confirm_config_btn = e.target.closest('#valid-configuration')

    if (open_anime_link_btn) {

        const url = open_anime_link_btn.dataset.url;
        try {
            window.open(url, '_blank');
        } catch (err) {
            console.log(err);
        }

    } else if (login_view_btn) {
        showView('view-login')
    } else if (step1_open_link_btn) {

        const url = current_button?.dataset?.url
        try {
            await chrome.storage.local.set({ intro_step: "step-2" })
            window.open(url, '_blank')
            gotoStep('step-2')
        } catch (err) {
            console.error(err)
        }

    } else if (goto_step3_btn) {

        try {
            await chrome.storage.local.set({ intro_step: "step-3" })
            gotoStep('step-3')
        } catch (err) {
            console.error(err)
        }

    } else if (confirm_config_btn) {

        const newClientID = await document.querySelector('#set_client_id')?.value ?? undefined
        const newClientSecret = await document.querySelector('#set_client_secret')?.value ?? undefined

        if (!newClientID || newClientID.replace(/\s+/g, "") === "") {
            return alert("Client ID required")
        }

        if (!newClientSecret || newClientSecret.replace(/\s+g/, "") === "") {
            return alert("Client Secret required")
        }

        await chrome.storage.local.set({
            mal_client_id: newClientID,
            mal_client_secret: newClientSecret
        })

        globalInfo['MAL_CLIENT_ID'] = newClientID
        globalInfo['MAL_CLIENT_SECRET'] = newClientSecret

        await chrome.storage.local.remove(['intro_step', 'tempClientID', 'tempClientSecret'])
        await showView('view-login')

    } else if (copy_redirecturi_btn) {

        const redirect_uri = await document.querySelector('#mal-redirecturi').value
        navigator.clipboard.writeText(redirect_uri)
            .then(() => {
                current_button.textContent = '✅',
                    current_button.disabled = "true",
                    setTimeout(() => {
                        current_button.textContent = "Copy"
                        current_button.removeAttribute('disabled')
                    }, 1.5 * 1000)
            })

    } else if (logout_view_btn) {

        showView("view-logout")

    } else if (logout_btn) {

        await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
            if (chrome.runtime.lastError) {
                console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                await showView('viex-home')
                alert('Error during logout.')
            } else {
                await showView('view-login')
            }
        });

    } else if (goto_btn) {

        var where = goto_btn.dataset.goto;
        await showView(`${where}`)

    } else if (anime_search_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return

        await window.scroll({ top: 0, behavior: 'smooth' })
        const mal = new MyAnimeList({
            client_id: globalInfo['MAL_CLIENT_ID']
        })

        var search_area = document.querySelector('#searched-anime')
        var searched_anime = await search_area?.value ?? null
        searched_anime = searched_anime.split(':').join(" ")

        if (searched_anime === null || searched_anime.replace(/\s+/g, "") === "") {
            return alert('Please enter the title of the anime you are looking for.')
        }

        var data
        try {
            const response = await mal.getAnimeInfo({
                name: searched_anime,
                fields: ["mean", "studios", "synopsis", "rank", "status"],
                limit: 10,
                nsfw: false
            })

            if (response.error) {
                return alert(response.error)
            }

            var parentDiv = await document.querySelector('#anime-search-results')
            var buttonsDiv = await document.querySelector('#next-previous-buttons')
            function clearOldResults() {
                parentDiv.innerHTML = ''
                buttonsDiv.innerHTML = ''
            }

            await clearOldResults()

            for (i = 0; i < response.datas.data.length; i++) {
                var accessToken = await chrome.storage.local.get(["mal_access_token"])
                accessToken = accessToken?.mal_access_token

                var datas = await response.datas.data
                var diffusionStatus
                if (datas[i].node.status === 'finished_airing') {
                    diffusionStatus = 'Finished airing'
                } else if (datas[i].node.status === 'currently_airing') {
                    diffusionStatus = 'Currently airing'
                } else if (datas[i].node.status === 'not_yet_aired') {
                    diffusionStatus = 'Not yet aired'
                }

                var isThisAnimeInAnimeList = await fetch(`https://api.myanimelist.net/v2/anime/${datas[i].node.id}?fields=my_list_status,num_episodes`, {
                    method: "GET",
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                })

                if (!isThisAnimeInAnimeList.ok) {
                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                        if (chrome.runtime.lastError) {
                            console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                        } else {
                            await showView('view-login')
                        }
                    });
                }

                var anime_datas = await isThisAnimeInAnimeList.json()

                var isInMyList
                if (anime_datas?.my_list_status) {
                    var anime_status = anime_datas?.my_list_status?.status ?? null
                    if (anime_status === null) {
                        anime_status = "[❓] Unknown"
                    } else if (anime_status === 'watching') {
                        anime_status = "[👀] Currently watching"
                    } else if (anime_status === 'completed') {
                        anime_status = '[✅] Completed'
                    } else if (anime_status === 'on_hold') {
                        anime_status = '[⌛] On hold'
                    } else if (anime_status === 'dropped') {
                        anime_status = '[❌] Dropped'
                    } else if (anime_status === 'plan_to_watch') {
                        anime_status = '[📋] Plan to watch'
                    }

                    var totalAnimeEps = anime_datas?.num_episodes ?? '??'
                    if (totalAnimeEps.toString() === '0') totalAnimeEps = '??'

                    isInMyList = `
                        <p id="anime-informations">
                            <b>⭐ Rated:</b> ${anime_datas?.my_list_status?.score ?? '0'}/10
                            <br><b>📺 Status:</b> ${anime_status}
                            <br><b>👀 Episodes watched:</b> ${anime_datas?.my_list_status?.num_episodes_watched ?? '0'}/${totalAnimeEps}
                            <br>
                            <br><b>📄 Synopsis:</b>
                            <br>${datas[i].node?.synopsis ?? `No result.`}
                        </p>
                        <div id="anime-card-buttons">
                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${datas[i].node.id}">Open on MAL</button>
                            <button id="edit-anime-list" data-anime_id="${datas[i].node.id}">Edit</button>
                        </div>
                        <div id="anime-card-dlt-btn">
                            <button id="delete-anime-from-list" data-anime_id="${datas[i].node.id}" data-is_from="view-anime-search">Remove from my anime list</button>
                        </div>
                        `
                } else {
                    isInMyList = `
                        <p id="anime-informations">
                            <b>⭐ Rated on MAL:</b> ${datas[i].node.mean ?? `Unknown`}/10
                            <br><b>📺 Status:</b> ${diffusionStatus}
                            <br>
                            <br><b>📄 Synopsis:</b>
                            <br>${datas[i].node?.synopsis ?? `No result.`}
                        </p>
                        <div id="anime-card-buttons">
                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${datas[i].node.id}">Open on MAL</button>
                        </div>
                        <div id="anime-card-addwatchlist-btn">
                            <button id="add-to-watchlist-btn" data-anime_id="${datas[i].node.id}" data-is_from="view-anime-search">Add to watchlist</button>
                        </div>`
                }

                var newDiv = `
                <div class="anime-card-noanim">
                    <div class="anime-card-infos">
                        <h3>${datas[i].node.title}</h3>
                        ${isInMyList}
                    </div>
                    <div class="anime-card-img">
                        <img src="${datas[i].node?.main_picture?.large}" alt="anime image">
                    </div>
                </div>
                `

                await parentDiv.insertAdjacentHTML('beforeend', newDiv)
            }

            if (response.datas?.paging?.next && response.datas?.paging?.previous) {
                var newBtnDiv = `
                <button id="previous-searched-anime-btn" data-url="${response.datas.paging.previous}">Previous</button>
                <button id="next-searched-anime-btn" data-url="${response.datas.paging.next}">Next</button>
                `
                buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
            } else if (!response.datas?.paging?.next && response.datas?.paging?.previous) {
                var newBtnDiv = `
                <button id="only-previous-searched-anime-btn" data-url="${response.datas.paging.previous}">Previous</button>
                `
                buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
            } else if (response.datas?.paging?.next && !response.datas?.paging?.previous) {
                var newBtnDiv = `
                <button id="only-next-searched-anime-btn" data-url="${response.datas.paging.next}">Next</button>
                `
                buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
            }

        } catch (err) {
            return alert(err)
        }

    } else if (only_next_anime_search_btn || only_previous_anime_search_btn || next_anime_search_btn || previous_anime_search_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return
        await window.scroll({ top: 0, behavior: 'smooth' })
        var api_url = current_button.dataset?.url
        if (!api_url || api_url === '') {
            return alert('Invalid URL. You can perform a new search.')
        }

        const mal = new MyAnimeList({
            client_id: globalInfo['MAL_CLIENT_ID']
        })

        try {
            const response = await mal.getAnimeInfoByURL({
                api_url: api_url
            })

            if (response.error) {
                return alert(response.error)
            }

            var parentDiv = await document.querySelector('#anime-search-results')
            var buttonsDiv = await document.querySelector('#next-previous-buttons')
            function clearOldResults() {
                parentDiv.innerHTML = ''
                buttonsDiv.innerHTML = ''
            }

            await clearOldResults()

            for (i = 0; i < response.datas.data.length; i++) {
                var accessToken = await chrome.storage.local.get(["mal_access_token"])
                accessToken = accessToken?.mal_access_token

                var datas = await response.datas.data
                var diffusionStatus
                if (datas[i].node.status === 'finished_airing') {
                    diffusionStatus = 'Finished airing'
                } else if (datas[i].node.status === 'currently_airing') {
                    diffusionStatus = 'Currently airing'
                } else if (datas[i].node.status === 'not_yet_aired') {
                    diffusionStatus = 'Not yet aired'
                }

                var isThisAnimeInAnimeList = await fetch(`https://api.myanimelist.net/v2/anime/${datas[i].node.id}?fields=my_list_status,num_episodes`, {
                    method: "GET",
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                })

                if (!isThisAnimeInAnimeList.ok) {
                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                        if (chrome.runtime.lastError) {
                            console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                        } else {
                            await showView('view-login')
                        }
                    });
                }

                var anime_datas = await isThisAnimeInAnimeList.json()

                var isInMyList
                if (anime_datas?.my_list_status) {
                    var anime_status = anime_datas?.my_list_status?.status ?? null
                    if (anime_status === null) {
                        anime_status = "[❓] Unknown"
                    } else if (anime_status === 'watching') {
                        anime_status = "[👀] Currently watching"
                    } else if (anime_status === 'completed') {
                        anime_status = '[✅] Completed'
                    } else if (anime_status === 'on_hold') {
                        anime_status = '[⌛] On hold'
                    } else if (anime_status === 'dropped') {
                        anime_status = '[❌] Dropped'
                    } else if (anime_status === 'plan_to_watch') {
                        anime_status = '[📋] Plan to watch'
                    }

                    var totalAnimeEps = anime_datas?.num_episodes ?? '??'
                    if (totalAnimeEps.toString() === '0') totalAnimeEps = '??'

                    isInMyList = `
                        <p id="anime-informations">
                            <b>⭐ Rated:</b> ${anime_datas?.my_list_status?.score ?? '0'}/10
                            <br><b>📺 Status:</b> ${anime_status}
                            <br><b>👀 Episodes watched:</b> ${anime_datas?.my_list_status?.num_episodes_watched ?? '0'}/${totalAnimeEps}
                            <br>
                            <br><b>📄 Synopsis:</b>
                            <br>${datas[i].node?.synopsis ?? `No result.`}
                        </p>
                        <div id="anime-card-buttons">
                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${datas[i].node.id}">Open on MAL</button>
                            <button id="edit-anime-list" data-anime_id="${datas[i].node.id}">Edit</button>
                        </div>
                        <div id="anime-card-dlt-btn">
                            <button id="delete-anime-from-list" data-anime_id="${datas[i].node.id}" data-is_from="view-anime-search">Remove from my anime list</button>
                        </div>
                        `
                } else {
                    isInMyList = `
                        <p id="anime-informations">
                            <b>⭐ Rated on MAL:</b> ${datas[i].node.mean ?? `Unknown`}/10
                            <br><b>📺 Status:</b> ${diffusionStatus}
                            <br>
                            <br><b>📄 Synopsis:</b>
                            <br>${datas[i].node?.synopsis ?? `No result.`}
                        </p>
                        <div id="anime-card-buttons">
                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${datas[i].node.id}">Open on MAL</button>
                        </div>
                        <div id="anime-card-addwatchlist-btn">
                            <button id="add-to-watchlist-btn" data-anime_id="${datas[i].node.id}" data-is_from="view-anime-search">Add to watchlist</button>
                        </div>`
                }

                var newDiv = `
                <div class="anime-card-noanim">
                    <div class="anime-card-infos">
                        <h3>${datas[i].node.title}</h3>
                        ${isInMyList}
                    </div>
                    <div class="anime-card-img">
                        <img src="${datas[i].node?.main_picture?.large}" alt="anime image">
                    </div>
                </div>
                `

                await parentDiv.insertAdjacentHTML('beforeend', newDiv)
            }

            if (response.datas?.paging?.next && response.datas?.paging?.previous) {
                var newBtnDiv = `
                <button id="previous-searched-anime-btn" data-url="${response.datas.paging.previous}">Previous</button>
                <button id="next-searched-anime-btn" data-url="${response.datas.paging.next}">Next</button>
                `
                buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
            } else if (!response.datas?.paging?.next && response.datas?.paging?.previous) {
                var newBtnDiv = `
                <button id="only-previous-searched-anime-btn" data-url="${response.datas.paging.previous}">Previous</button>
                `
                buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
            } else if (response.datas?.paging?.next && !response.datas?.paging?.previous) {
                var newBtnDiv = `
                <button id="only-next-searched-anime-btn" data-url="${response.datas.paging.next}">Next</button>
                `
                buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
            }
        } catch (err) {
            return alert(err)
        }

    } else if (only_next_anime_list_btn || only_previous_anime_list_btn || next_anime_list_btn || previous_anime_list_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return

        var api_url = current_button.dataset?.url
        await getAnimeList(api_url)
    } else if (edit_anime_from_anime_list_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return

        var anime_id = current_button.dataset?.anime_id
        var accessToken = await chrome.storage.local.get(["mal_access_token"])
        accessToken = accessToken?.mal_access_token

        const parentDiv = document.querySelector('#anime-to-edit-result')
        function clearOldResults() {
            parentDiv.innerHTML = ''
        }

        await clearOldResults()

        var data
        var datas
        try {
            const response = await fetch(`https://api.myanimelist.net/v2/anime/${anime_id}?fields=id,title,main_picture,my_list_status`, {
                method: "GET",
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            if (!response.ok) {
                if (response.status === 401) {
                    await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                        if (chrome.runtime.lastError) {
                            console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                        } else {
                            await showView('view-login')
                        }
                    });
                }
                return
            }

            data = await response.json()

            var anime_status = data.my_list_status?.status ?? null
            if (anime_status === null) {
                anime_status = "[❓] Unknown"
            } else if (anime_status === 'watching') {
                anime_status = "[👀] Currently watching"
            } else if (anime_status === 'completed') {
                anime_status = '[✅] Completed'
            } else if (anime_status === 'on_hold') {
                anime_status = '[⌛] On hold'
            } else if (anime_status === 'dropped') {
                anime_status = '[❌] Dropped'
            } else if (anime_status === 'plan_to_watch') {
                anime_status = '[📋] Plan to watch'
            }

            var current_score = data?.my_list_status?.score ?? 0
            var current_num_ep_watched = data?.my_list_status?.num_episodes_watched ?? 0
            var current_status = data?.my_list_status?.status

            var watching_selected = ''
            var completed_selected = ''
            var on_hold_selected = ''
            var dropped_selected = ''
            var ptw_selected = ''

            if (current_status === "watching") {
                watching_selected = "selected"
            } else if (current_status === "completed") {
                completed_selected = "selected"
            } else if (current_score === "on_hold") {
                on_hold_selected = "selected"
            } else if (current_status === "dropped") {
                dropped_selected = "selected"
            } else if (current_status === "plan_to_watch") {
                ptw_selected = "selected"
            }

            const newDiv = `
                <div class="anime-card">
                    <div class="anime-card-infos">
                        <h3>${data.title}</h3>
                        <p id="anime-informations">⭐ Rated ${current_score}/10
                            <br>📺 Status: ${anime_status}
                        </p>
                    </div>
                    <div class="anime-card-img">
                        <img src="${data?.main_picture?.large}" alt="anime image">
                    </div>
                </div>
                <div id="score">
                    <p id="field-title"><b>Score:</b></p>
                    <div id="new-param">
                        <input type="number" name="anime-to-edit-score" id="anime-to-edit-score" max="10" min="0" value="${current_score}">
                        <p>/10 </p>
                    </div>
                </div>
                <div id="num_ep_watched">
                    <p id="field-title"><b>Episodes watched:</b></p>
                    <div id="new-param">
                        <input type="number" name="anime-to-edit-ep_watched" id="anime-to-edit-ep_watched" min="0" value="${current_num_ep_watched}">
                    </div>
                </div>
                <div id="status">
                    <p id="field-title"><b>Status:</b></p>
                    <div id="new-param">
                        <select name="anime-to-edit-status" id="anime-to-edit-status">
                            <option value="completed" ${completed_selected}>✅ Completed</option>
                            <option value="watching" ${watching_selected}>👀 Currently watching</option>
                            <option value="on_hold" ${on_hold_selected}>⌛ On hold</option>
                            <option value="plan_to_watch" ${ptw_selected}>📋 Plan to watch</option>
                            <option value="dropped" ${dropped_selected}>❌ Dropped</option>
                        </select>
                    </div>
                </div>
                <div style="
                height: 40px;
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                ">
                    <button id="confirm-anime-list-editing" data-anime_id="${data.id}"><b>Save</b></button>
                </div>
                `

            parentDiv.insertAdjacentHTML('beforeend', newDiv)
        } catch (err) {
            return
        }

        await showView('view-edit-anime-from-list')
    } else if (confirm_anime_list_editing_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return

        const mal = new MyAnimeList({
            client_id: globalInfo['MAL_CLIENT_ID']
        })
        var accessToken = await chrome.storage.local.get(["mal_access_token"])
        accessToken = accessToken?.mal_access_token

        var anime_id = current_button?.dataset?.anime_id

        const animeDatas = await mal.getAnimeInfoByID({
            id: anime_id,
            fields: ["num_episodes"]
        })

        var newStatus = document.querySelector('#anime-to-edit-status').value
        var newScore = document.querySelector('#anime-to-edit-score').value
        var newEpWatched = document.querySelector('#anime-to-edit-ep_watched').value

        const formData = new URLSearchParams()

        if (newStatus === "completed") {
            formData.append('status', newStatus)
            formData.append('num_watched_episodes', animeDatas?.datas?.num_episodes ?? 0)
            formData.append('score', newScore)
        } else {
            formData.append('status', newStatus)
            formData.append('num_watched_episodes', newEpWatched)
            formData.append('score', newScore)
        }

        const response = await fetch(`https://api.myanimelist.net/v2/anime/${anime_id}/my_list_status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        })

        var data = await response.json()

        if (!response.ok) {
            if (response.status === 401) {
                await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                    if (chrome.runtime.lastError) {
                        console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                    } else {
                        await showView('view-login')
                    }
                });
                return
            }
            alert('Error updating the anime')
        } else {
            alert('Changes saved')
        }

        getAnimeList()
        await getAnimeOnThisPage()
        await showView('view-home')

        var searchAnimeBarValue = document.querySelector('#searched-anime')?.value
        if (searchAnimeBarValue && searchAnimeBarValue.replace(/\s+/g, "") != "") {
            const btnToClick = document.querySelector('#search-anime-btn')
            await btnToClick.click()
        }

        const resultsDiv = document.querySelector('#anime-to-edit-result')
        function clearResults() {
            resultsDiv.innerHTML = ''
        }

        await clearResults()

    } else if (add_to_watchlist_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return

        var anime_id = current_button.dataset?.anime_id
        var isFrom = current_button.dataset?.is_from

        await AddToWatchList(anime_id, isFrom)
    } else if (delete_from_animelist_btn) {
        var isConnected = await isUserConnected()
        if (isConnected === false) return

        var anime_id = current_button.dataset?.anime_id
        var isFrom = current_button.dataset?.is_from

        await DeleteFromAnimeList(anime_id, isFrom)
    } else if (reset_all_btn) {
        await chrome.storage.local.clear()
        await showView('view-extension-introduction')
        await gotoStep('step-1')
    } else {

        return

    }
});

document.querySelector('#searched-anime').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()

        document.querySelector('#search-anime-btn').click()
    }
})

async function getAnimeList(url) {
    var isConnected = await isUserConnected()
    if (isConnected === false) return

    var accessToken = await chrome.storage.local.get(["mal_access_token"])
    accessToken = accessToken?.mal_access_token

    var apiUrl = url ?? 'https://api.myanimelist.net/v2/users/@me/animelist?fields=num_episodes,list_status&limit=15&sort=list_score&nsfw=true'

    const response = await fetch(apiUrl, {
        method: "GET",
        headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                if (chrome.runtime.lastError) {
                    console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                } else {
                    await showView('view-login')
                }
            });
        }
    }

    var data = await response.json()
    var datas = data.data

    const parentDiv = document.getElementById("your-anime-list-results")
    const buttonsDiv = document.getElementById("next-previous-buttons-anime-list")
    function clearOldResults() {
        parentDiv.innerHTML = ''
        buttonsDiv.innerHTML = ''
    }

    await clearOldResults()

    for (i = 0; i < datas.length; i++) {
        var anime_status = datas[i].list_status?.status ?? null
        if (anime_status === null) {
            anime_status = "[❓] Unknown"
        } else if (anime_status === 'watching') {
            anime_status = "[👀] Currently watching"
        } else if (anime_status === 'completed') {
            anime_status = '[✅] Completed'
        } else if (anime_status === 'on_hold') {
            anime_status = '[⌛] On hold'
        } else if (anime_status === 'dropped') {
            anime_status = '[❌] Dropped'
        } else if (anime_status === 'plan_to_watch') {
            anime_status = '[📋] Plan to watch'
        }

        const newDiv = `
                <div class="anime-card">
                    <div class="anime-card-infos">
                        <h3>${datas[i].node.title}</h3>
                        <p id="anime-informations">⭐ Rated ${datas[i].list_status?.score ?? `Unknown`}/10
                            <br>📺 Status: ${anime_status}
                            <br>👀 Episodes watched: ${datas[i].list_status?.num_episodes_watched}/${datas[i].node.num_episodes ?? '??'}
                        </p>
                        <div id="anime-card-buttons">
                            <button id="open-anime-link" data-url="https://myanimelist.net/anime/${datas[i].node.id}">Open on MAL</button>
                            <button id="edit-anime-list" data-anime_id="${datas[i].node.id}">Edit</button>
                        </div>
                        <div id="anime-card-dlt-btn">
                            <button id="delete-anime-from-list" data-anime_id="${datas[i].node.id}">Remove from my anime list</button>
                        </div>
                    </div>
                    <div class="anime-card-img">
                        <img src="${datas[i].node?.main_picture?.large}" alt="anime image">
                    </div>
                </div>
                `;

        parentDiv.insertAdjacentHTML("beforeend", newDiv)
    }

    if (data?.paging?.next && data?.paging?.previous) {
        var newBtnDiv = `
                <button id="previous-anime-list-btn" data-url="${data.paging.previous}">Previous</button>
                <button id="next-anime-list-btn" data-url="${data.paging.next}">Next</button>
                `
        buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
    } else if (!data?.paging?.next && data?.paging?.previous) {
        var newBtnDiv = `
                <button id="only-previous-anime-list-btn" data-url="${data.paging.previous}">Previous</button>
                `
        buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
    } else if (data?.paging?.next && !data?.paging?.previous) {
        var newBtnDiv = `
                <button id="only-next-anime-list-btn" data-url="${data.paging.next}">Next</button>
                `
        buttonsDiv.insertAdjacentHTML('beforeend', newBtnDiv)
    }

    await window.scroll({ top: 0, behavior: 'smooth' })
}

async function AddToWatchList(anime_id, from_page) {
    var isConnected = await isUserConnected()
    if (isConnected === false) return

    const formData = new URLSearchParams()
    formData.append('status', 'plan_to_watch')

    var accessToken = await chrome.storage.local.get(["mal_access_token"])
    accessToken = accessToken?.mal_access_token

    const response = await fetch(`https://api.myanimelist.net/v2/anime/${anime_id}/my_list_status`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    })

    if (!response.ok) {
        if (response.status === 401) {
            await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                if (chrome.runtime.lastError) {
                    console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                } else {
                    await showView('view-login')
                }
            });
        }
        return
    }

    if (from_page === "view-anime") {
        await getAnimeOnThisPage()
    } else if (from_page === "view-anime-search") {
        await window.scroll({ top: 0, behavior: 'smooth' })
        const btnToClick = document.querySelector('#search-anime-btn')
        await btnToClick.click()
    } else {
        await getAnimeList()
        await showView('view-home')
    }
    return true
}

async function DeleteFromAnimeList(anime_id, from_page) {
    var isConnected = await isUserConnected()
    if (isConnected === false) return

    var accessToken = await chrome.storage.local.get(["mal_access_token"])
    accessToken = accessToken?.mal_access_token

    const response = await fetch(`https://api.myanimelist.net/v2/anime/${anime_id}/my_list_status`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
    })

    if (!response.ok) {
        if (response.status === 401) {
            await chrome.storage.local.remove(['mal_access_token', 'mal_refresh_token'], async function () {
                if (chrome.runtime.lastError) {
                    console.error("Erreur lors de la suppression :", chrome.runtime.lastError);
                } else {
                    await showView('view-login')
                }
            });
        }
        return
    }

    if (from_page === "view-anime") {
        await getAnimeOnThisPage()
    } else if (from_page === "view-anime-search") {
        await window.scroll({ top: 0, behavior: 'smooth' })
        const btnToClick = document.querySelector('#search-anime-btn')
        await btnToClick.click()
    } else {
        await getAnimeList()
        await showView('view-home')
    }
    return true
}

async function gotoStep(step) {
    await document.querySelectorAll('#step').forEach(e =>
        e.style.display = "none"
    )

    const requestedStep = await document.querySelector(`.${step}`)
    if (requestedStep) {
        requestedStep.style.removeProperty("display")
    }

    if (step === "step-3") {
        const clientIDField = await document.getElementById('set_client_id')
        var tempClientIDValue = await chrome.storage.local.get(['tempClientID'])
        tempClientIDValue = tempClientIDValue?.tempClientID ?? null

        const clientSecretField = await document.getElementById('set_client_secret')
        var tempClientSecretValue = await chrome.storage.local.get(['tempClientSecret'])
        tempClientSecretValue = tempClientSecretValue?.tempClientSecret ?? null

        if (tempClientIDValue) {
            clientIDField.value = tempClientIDValue
        }

        if (tempClientSecretValue) {
            clientSecretField.value = tempClientSecretValue
        }
    }
}

const clientIDTextareaInput = document.getElementById('set_client_id')
clientIDTextareaInput.addEventListener('input', async () => {
    const value = clientIDTextareaInput.value
    await chrome.storage.local.set({ tempClientID: value })
})

const clientSecretTextareaInput = document.getElementById('set_client_secret')
clientSecretTextareaInput.addEventListener('input', async () => {
    const value = clientSecretTextareaInput.value
    await chrome.storage.local.set({ tempClientSecret: value })
})