import { NextApiRequest, NextApiResponse } from "next";
import { MovieModel } from "../../../models/movie_model";
import { Error400Model } from "../../../models/__error400_model";
import utils from "../../../src/utils";
import { randomUUID } from "node:crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query;
  const { q, lang, page } = query;
  page ?? 1;

  /// ! check: mising params
  if (q == null || lang == null) {
    const err: Error400Model = {
      status_code: 400,
      status_message: "missing required params",
      params: [q == null ? "q" : "", lang == null ? "lang" : ""],
      example: utils.baseUrl(req) + "/api/njav/search?lang=id&q=big breast",
    };
    res.status(400).json(err);
  }

  try {
    const response = await fetch(`https://njavtv.com/${lang}/search/${q}?page=${page}`);
    const movies: MovieModel[] = [];
    const __sc = await response.text();
    // console.log('🟡 __sc', __sc)

    // ! case: found
    const codeList = Array.from(__sc.matchAll(/<a\s+class="text-secondary group-hover:text-primary".*?alt="(.*?)"/gs)).map((match) => match[1]);
    const titleList = Array.from(__sc.matchAll(/<a\s+class="text-secondary group-hover:text-primary".*?>(.*?)<\/a>/gs)).map((match) => match[1].trim());
    const fanArtList = Array.from(__sc.matchAll(/class="lozad w-full"\s+data-src="(.*?)"/gs)).map((match) => match[1]);
    const trailerList = Array.from(__sc.matchAll(/<video.*?data-src="(.*?)".*?>/gs)).map((match) => match[1]);
    const durationList = Array.from(__sc.matchAll(/<span class="absolute bottom-1 right-1 rounded-lg px-2 py-1 text-xs text-nord5 bg-gray-800 bg-opacity-75">\s*(.*?)\s*<\/span>/gs)).map((match) =>
      match[1].trim()
    );

    console.log("🟡 durationFList", durationList);

    // loop codelist
    for (let i = 0; i < codeList.length; i++) {
      const code = codeList[i];
      const title = utils.fixTitle(titleList[i]);
      const fanArt = fanArtList[i];
      const trailer = trailerList[i];
      const duration = utils.formatDurationToMinutes(durationList[i]);
      movies.push({
        video_id: utils.getVideoCode(code) ?? randomUUID(),
        video_code: code.toUpperCase(),
        title: utils.maxWords(title, 25).replaceAll(`${code.toUpperCase()}`, "").trim(),
        fan_art: fanArt,
        poster: fanArt,
        trailer: trailer,
        duration: duration,
        duration_formated: utils.toDurationFormat(duration),
      });
    }

    res.status(200).json({
      code: 200,
      server_time: Date.now(),
      page: Number(page),
      total: movies.length,
      has_next_page: movies.length == 12,
      result: movies,
    });
  } catch (error) {
    res.status(500).json(error);
  }
}
