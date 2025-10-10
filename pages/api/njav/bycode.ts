import { NextApiRequest, NextApiResponse } from "next";
import { Error400Model } from "../../../models/__error400_model";
import { MovieModel } from "../../../models/movie_model";
import { ActorModel } from "../../../models/actor_model";
import utils from "../../../src/utils";
import * as wanakana from "wanakana";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query;
  const { code, lang } = query;

  lang ?? "id";

  /// ! case: mising params
  if (code == null || lang == null) {
    const err: Error400Model = {
      status_code: 400,
      status_message: "missing required params",
      params: [
        code == null ? "code" : "",
        lang == null ? "lang (en, id, cn, ja, ko, ms, th, de, fr, vi, fil, pt)" : "",
        //
      ],
      example: utils.baseUrl(req) + "/api/njav/bycode?code=EYAN-181&lang=id",
    };
    res.status(400).json(err);
    return;
  }

  try {
    const response = await fetch(`https://njavtv.com/${lang}/${code}`);
    const sc = await response.text();

    if (sc.includes(">404<")) {
      const err: Error400Model = {
        status_code: 400,
        status_message: "video with code `" + code + "` not found",
      };
      res.status(400).json(err);
    }

    const vidCode = sc.match(/<span>Code:<\/span>\s*<span class="font-medium">([^<]+)<\/span>/)?.[1] ?? null;
    const title = (sc.match(new RegExp(`<meta property="og:title" content="(.*?)" />`)) || [])[1]?.trim() || "";
    const titleJa = sc.match(/<span>Title:<\/span>\s*<span class="font-medium">([^<]+)<\/span>/)?.[1] ?? null;
    const desc = (sc.match(new RegExp(`<meta property="og:description" content="(.*?)" />`)) || [])[1]?.trim() || "";

    const casts = Array.from(sc.matchAll(/https:.*?\/actresses\/(.*?)" class="text-nord13 font-medium">/g)).map((match) => match[1]);
    const actorList: ActorModel[] = [];
    for (let i = 0; i < casts.length; i++) {
      const _namePrefixUrl = utils.reverseName(casts[i].replace("%20", " "))?.toLowerCase().replace(" ", "_");
      actorList.push({
        cast_id: casts[i].replaceAll("%20", "_").toLowerCase(),
        cast_image: `https://pics.dmm.co.jp/mono/actjpgs/${_namePrefixUrl}.jpg`,
      });
    }

    const genres = Array.from(sc.matchAll(/https:.*?\/genres\/(.*?)" class="text-nord13 font-medium">/g)).map((match) => match[1]);
    const genreList: string[] = genres.map((genre) => genre.replaceAll("%20", " "));

    const fanArt = (sc.match(new RegExp(`<meta name="twitter:image" content="(.*?)" />`)) || [])[1]?.trim() || "";
    const releaseDate = sc.match(/<span>Release date:<\/span>\s*<time datetime="[^"]+" class="font-medium">([^<]+)<\/time>/)?.[1] ?? null;
    const maker = sc.match(/.*?makers\/(.*?)"/)?.[1] ?? null;
    const label = sc.match(/.*?labels\/(.*?)"/)?.[1] ?? null;
    const director = sc.match(/.*?directors\/(.*?)"/)?.[1] ?? null;
    const series = sc.match(/.*?series\/(.*?)"/)?.[1] ?? null;

    const duration = sc.match(/<meta property="og:video:duration" content="(\d+)" \/>/)?.[1] ?? null;
    const duration_time = duration ? (parseInt(duration) / 60).toFixed(0) : '0';
    const duration_formated = utils.toDurationFormat(parseInt(duration_time));

    const movie: MovieModel = {
      video_id: vidCode,
      video_code_id: vidCode,
      video_code: code.toString().toUpperCase(),
      title: utils.fixTitle(title),
      title_ja: titleJa,
      description: desc,
      fan_art: fanArt,
      poster: fanArt.replace("?class=normal", "?class=thumbnail"),
      trailer: "",
      actors: actorList,
      genre: genreList,
      release_date: releaseDate,
      release_date_formated: releaseDate ? utils.toDateFormat(releaseDate) : null,
      duration: parseInt(duration_time),
      duration_formated: duration_formated,
      studio: maker ? wanakana.toRomaji(maker) : '',
      label: label ? wanakana.toRomaji(decodeURIComponent(label)) : '',
      director: director ? decodeURIComponent(director) : '',
      series: series ? decodeURIComponent(series) : '',
      screenshot: [fanArt],
      view_count: null,
      score: null,
    };
    res.status(200).json(movie);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
