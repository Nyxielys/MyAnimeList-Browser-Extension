let currentURL = window.location.href
var animeInfos = {}

async function getAnimeInfos() {
    const get_anime_title = document.querySelector('.show-title-link h4')
    const get_anime_ep = document.querySelector('.current-media-wrapper h1')
    if (get_anime_title && get_anime_ep) {
        var animeTitle = get_anime_title.textContent.trim()
        var anime_ep = get_anime_ep.textContent.trim().split("-")[0].split('E')[1].split(" ")[0]
        return [animeTitle, anime_ep]
    } else {
        return false
    }
}

async function getAnimePageInfos() {
    const meta = document.querySelector('meta[property="og:title"]')

    if (meta) {
        var animeTitle = meta.getAttribute('content').split(' ').splice(1).join(' ')
        return animeTitle
    } else {
        return false
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET-WATCHING-ANIME-INFOS") {
        (async () => {
            currentURL = await window.location.href
            if (currentURL.includes("/watch")) {
                var response = await getAnimeInfos()
                var animeInfos = {}

                if (response) {
                    animeInfos['title'] = response?.[0] ?? "Non indiqué"
                    animeInfos['episode'] = response?.[1] ?? "Non indiqué"

                    sendResponse({ success: true, data: animeInfos })
                } else {
                    alert('Please try again when the page has loaded.')
                    sendResponse({ success: false, error: "Please try again when the page has loaded." })
                    return false
                }
            }
        })();

        return true
    } else if (request.action === "GET-CURRENT-PAGE-ANIME-INFOS") {
        (async () => {
            currentURL = await window.location.href
            if (currentURL.includes("/series")) {
                var response = await getAnimePageInfos()
                var animeInfos = {}

                if (response) {
                    animeInfos['title'] = response ?? "Non indiqué"

                    sendResponse({ success: true, data: animeInfos })
                } else {
                    alert('Please try again when the page has loaded.')
                    sendResponse({ success: false, error: "Please try again when the page has loaded." })
                    return false
                }
            }
        })();

        return true;
    }
})