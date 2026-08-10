var client_id
var client_secret

async function checkIfHasParams(type) {
    if (type === 'all') {
        const requiredSettings = [
            { key: client_id, name: "client_id", type: "string" },
            { key: client_secret, name: "client_secret", type: "string" }
        ]

        const missingSettings = requiredSettings.find(setting => !setting.key)

        if (missingSettings) {
            return {
                success: true,
                isMissing: true,
                error: `Require ${missingSettings.name}:
new MyAnimeList({
    ${missingSettings.name}: ${missingSettings.type}
})`,
            }
        } else {
            return {
                success: true,
                isMissing: false
            }
        }
    } else if (type === 'only_client_id') {
        const requiredSettings = [
            { key: client_id, name: "client_id", type: "string" }
        ]

        const missingSettings = requiredSettings.find(setting => !setting.key)

        if (missingSettings) {
            return {
                success: true,
                isMissing: true,
                error: `Require ${missingSettings.name}:
new MyAnimeList({
    ${missingSettings.name}: ${missingSettings.type}
})`,
            }
        } else {
            return {
                success: true,
                isMissing: false
            }
        }
    } else {
        return {
            success: false,
            error: `Erreur interne au module myanimelist-module (checkIfHasParams(type))`
        }
    }
}

class MyAnimeList {
    constructor(datas) {
        client_id = datas?.client_id ?? undefined;
        client_secret = datas?.client_secret ?? undefined;
    }

    async getAnimeInfo(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var anime_name = settings?.name

        var offset = settings?.offset ?? ''
        if (offset != '' && isNaN(offset)) return { success: false, error: `The "offset" field must be a valid positive number.` }
        if (offset != '') offset = `&offset=${offset}`

        var limit = settings?.limit ?? ''
        if (limit != '' && isNaN(limit)) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '' && limit > 500) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '') limit = `&limit=${limit}`

        var fields = settings?.fields ?? []
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        if (!anime_name) {
            return {
                success: false,
                error: `Require name: getAnimeInfo({ name: string })`
            }
        }

        var editedAnimeName = anime_name.split(/[:–—]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()
        if (editedAnimeName.split(" ").length > 8) {
            editedAnimeName = editedAnimeName.split(" ").slice(0, 8).join(" ")
        }

        const url = `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(editedAnimeName)}${offset}${limit}${fields}${nsfw}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }
            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getAnimeInfoByURL(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var url = settings?.api_url
        if (!url) {
            return {
                success: false,
                error: `Require api_url: getAnimeInfo({ api_url: string })`
            }
        }

        if (!url.includes('api.myanimelist.net')) {
            return {
                success: false,
                error: `Invalid URL.`
            }
        }

        var data
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }

            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getSpecificAnimeInfo(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var anime_name = settings?.name

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getSpecificAnimeInfo({ fields: [array] })` }
        await fields.push("alternative_titles")
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        if (!anime_name) {
            return {
                success: false,
                error: `Require name: getSpecificAnimeInfo({ name: string })`
            }
        }

        var editedAnimeName = anime_name.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()
        if (editedAnimeName.split(" ").length > 8) {
            editedAnimeName = editedAnimeName.split(" ").slice(0, 8).join(" ")
        }

        const url = `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(editedAnimeName)}${fields}${nsfw}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }
            data = await response.json()

        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        try {
            var datas = data.data
            const animeInfos = datas.find(anime => {
                const anime_datas = anime.node

                const title = anime_datas.title?.toLowerCase() || ""
                var editedTitle = title.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()

                const enTitle = anime_datas.alternative_titles?.en.toLowerCase() || ""
                var editedEnTitle = enTitle.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()

                const synonyms = anime_datas.alternative_titles?.synonyms || []
                var editedSynonyms = []

                for (let i = 0; i < synonyms.length; i++) {
                    editedSynonyms.push(synonyms[i].split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim())
                }

                const searchedAnime = anime_name?.toLowerCase() || ""
                var editedSearchedAnime = searchedAnime.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()

                return editedTitle === editedSearchedAnime || editedEnTitle === editedSearchedAnime || editedSynonyms.some(syn => syn.toLowerCase() === editedSearchedAnime)
            })

            if (animeInfos) data = animeInfos
        } catch (err) {
            return {
                success: true,
                datas: data
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getAnimeInfoByID(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var anime_id = settings?.id
        if (isNaN(anime_id)) return { success: false, error: `The "id" field must be a valid positive number.` }

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getAnimeInfoByID({ fields: [array] })` }
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `?nsfw=true` } else { nsfw = `?nsfw=false` }

        if (!anime_id) {
            return {
                success: false,
                error: `Require id (number >0): getAnimeInfoByID({ id: number })`
            }
        }

        const url = `https://api.myanimelist.net/v2/anime/${anime_id}${nsfw}${fields}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }

            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getAnimeRanking(settings) {
        const available_ranking_type = ["all", "airing", "upcoming", "tv", "ova", "movie", "special", "bypopularity", "favorite"]

        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var ranking_type = settings?.type ?? "all"
        if (!available_ranking_type.includes(ranking_type)) return { success: false, error: `Please use a valid ranking type: ${available_ranking_type.map(f => f).join(', ')}` }

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getAnimeRanking({ fields: [array] })` }
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var limit = settings?.limit ?? ''
        if (limit != '' && isNaN(limit)) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '' && limit > 500) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '') limit = `&limit=${limit}`

        var offset = settings?.offset ?? ''
        if (offset != '' && isNaN(offset) && limit.toString() != '0') return { success: false, error: `The "offset" field must be a valid positive number.` }
        if (offset != '') offset = `&offset=${offset}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        const url = `https://api.myanimelist.net/v2/anime/ranking?ranking_type=${ranking_type}${fields}${limit}${offset}${nsfw}`
        var data
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }

            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getSeasonalAnime(settings) {
        const seasonsList = ['winter', 'spring', 'summer', 'fall']
        async function getSeason() {
            var data = new Date()
            var month = data.getUTCMonth()

            var index = Number(month)
            if (index <= 2) {
                return seasonsList[0]
            } else if (index > 2 && index <= 5) {
                return seasonsList[1]
            } else if (index > 5 && index <= 8) {
                return seasonsList[2]
            } else if (index > 8 && index <= 11) {
                return seasonsList[3]
            }
        }

        async function getYear() {
            var date = new Date()
            var year = date.getUTCFullYear()

            return year
        }

        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var season = settings?.season ?? await getSeason()
        if (!seasonsList.includes(season)) return { success: false, error: `Please use a valid season: ${seasonsList.map(f => f).join(', ')}` }

        var year = settings?.year ?? await getYear()
        if (isNaN(year)) return { success: false, error: `The "year" field must be a valid positive number.` }

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getAnimeRanking({ fields: [array] })` }
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var limit = settings?.limit ?? ''
        if (limit != '' && isNaN(limit)) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '' && limit > 500) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '') limit = `&limit=${limit}`

        var offset = settings?.offset ?? 0
        if (offset != '' && isNaN(offset) && limit.toString() != '0') return { success: false, error: `The "offset" field must be a valid positive number.` }

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        const url = `https://api.myanimelist.net/v2/anime/season/${year}/${season}?offset=${offset}${limit}${fields}${nsfw}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }

            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getMangaInfo(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var manga_name = settings?.name

        var offset = settings?.offset ?? ''
        if (offset != '' && isNaN(offset)) return { success: false, error: `The "offset" field must be a valid positive number.` }
        if (offset != '') offset = `&offset=${offset}`

        var limit = settings?.limit ?? ''
        if (limit != '' && isNaN(limit)) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '' && limit > 500) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '') limit = `&limit=${limit}`

        var fields = settings?.fields ?? []
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        if (!manga_name) {
            return {
                success: false,
                error: `Require name: getMangaInfo({ name: string })`
            }
        }

        var editedMangaName = manga_name.split(/[:–—]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()
        if (editedMangaName.split(" ").length > 8) {
            editedMangaName = editedMangaName.split(" ").slice(0, 8).join(" ")
        }

        const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(editedMangaName)}${offset}${limit}${fields}${nsfw}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }
            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getSpecificMangaInfo(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var manga_name = settings?.name

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getSpecificMangaInfo({ fields: [array] })` }
        await fields.push("alternative_titles")
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        if (!manga_name) {
            return {
                success: false,
                error: `Require name: getSpecificMangaInfo({ name: string })`
            }
        }

        var editedMangaName = manga_name.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()
        if (editedMangaName.split(" ").length > 8) {
            editedMangaName = editedMangaName.split(" ").slice(0, 8).join(" ")
        }

        const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(editedMangaName)}${fields}${nsfw}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }
            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        try {
            var datas = data.data
            const mangaInfos = datas.find(manga => {
                const manga_datas = manga.node

                const title = manga_datas.title?.toLowerCase() || ""
                var editedTitle = title.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()

                const enTitle = manga_datas.alternative_titles?.en.toLowerCase() || ""
                var editedEnTitle = enTitle.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()

                const synonyms = manga_datas.alternative_titles?.synonyms || []
                var editedSynonyms = []

                for (let i = 0; i < synonyms.length; i++) {
                    editedSynonyms.push(synonyms[i].split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim())
                }

                const searchedManga = manga_name?.toLowerCase() || ""
                var editedSearchedManga = searchedManga.split(/[:–—-]/)[0].replace(/[^a-zA-Z0-9\s]/g, "").trim()

                return editedTitle === editedSearchedManga || editedEnTitle === editedSearchedManga || editedSynonyms.some(syn => syn.toLowerCase() === editedSearchedManga)
            })

            if (mangaInfos) data = mangaInfos
        } catch (err) {
            return {
                success: true,
                datas: data
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getMangaInfoByID(settings) {
        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var manga_id = settings?.id
        if (isNaN(manga_id)) return { success: false, error: `The "id" field must be a valid positive number.` }

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getMangaInfoByID({ fields: [array] })` }
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `?nsfw=true` } else { nsfw = `?nsfw=false` }

        if (!manga_id) {
            return {
                success: false,
                error: `Require id (number >0): getMangaInfoByID({ id: number })`
            }
        }

        const url = `https://api.myanimelist.net/v2/manga/${manga_id}${nsfw}${fields}`
        var data

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }

            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

    async getMangaRanking(settings) {
        const available_ranking_type = ["all", "manga", "novels", "oneshots", "doujin", "manhwa", "manhua", "bypopularity", "favorite"]

        const hasForgetParam = await checkIfHasParams('only_client_id')
        if (hasForgetParam.error) {
            return {
                success: false,
                error: hasForgetParam.error
            }
        }

        var ranking_type = settings?.type ?? "all"
        if (!available_ranking_type.includes(ranking_type)) return { success: false, error: `Please use a valid ranking type: ${available_ranking_type.map(f => f).join(', ')}` }

        var fields = settings?.fields ?? []
        if (!Array.isArray(fields)) return { success: false, error: `The "fields" field must be a list: getMangaRanking({ fields: [array] })` }
        if (fields.length > 0) fields = `&fields=${fields.map(field => field).join(',')}`

        var limit = settings?.limit ?? ''
        if (limit != '' && isNaN(limit)) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '' && limit > 500) return { success: false, error: `The "limit" field must be a valid positive number (<=500).` }
        if (limit != '') limit = `&limit=${limit}`

        var offset = settings?.offset ?? ''
        if (offset != '' && isNaN(offset) && limit.toString() != '0') return { success: false, error: `The "offset" field must be a valid positive number.` }
        if (offset != '') offset = `&offset=${offset}`

        var nsfw = settings?.nsfw ?? false
        if (nsfw === true) { nsfw = `&nsfw=true` } else { nsfw = `&nsfw=false` }

        const url = `https://api.myanimelist.net/v2/manga/ranking?ranking_type=${ranking_type}${fields}${limit}${offset}${nsfw}`
        var data
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MAL-CLIENT-ID': client_id
                }
            })

            if (!response.ok) {
                return {
                    success: false,
                    error: `API Error: ${response.status}`
                }
            }

            data = await response.json()
        } catch (err) {
            return {
                success: false,
                error: err
            }
        }

        return {
            success: true,
            datas: data
        }
    }

}