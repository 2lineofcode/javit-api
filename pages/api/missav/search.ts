import { NextApiRequest, NextApiResponse } from "next";
import { MovieModel } from "../../../models/movie_model";
import { Error400Model } from "../../../models/__error400_model";
import utils from "../../../src/utils";
import { randomUUID } from "node:crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query;
  const { q, page } = query;
  page ?? 1;

  /// ! check: mising params
  if (q == null) {
    const err: Error400Model = {
      status_code: 400,
      status_message: "missing required params",
      params: ["q"],
      example: utils.baseUrl(req) + "/api/njav/search?q=big breast",
    };
    res.status(400).json(err);
  }

  try {
    const response = await fetch(`https://missav.live/en/search/${q}?page=${page}`);
    const movies: MovieModel[] = [];
    const __sc = await response.text();
    // console.log('🟡 __sc', __sc)

    // ! case: found
    const codeList = Array.from(__sc.matchAll(/<a\s+class="text-secondary group-hover:text-primary".*?alt="(.*?)"/gs)).map((match) => match[1]);
    const titleList = Array.from(__sc.matchAll(/<a\s+class="text-secondary group-hover:text-primary".*?>(.*?)<\/a>/gs)).map((match) => match[1].trim());
    const fanArtList = Array.from(__sc.matchAll(/class="lozad w-full"\s+data-src="(.*?)"/gs)).map((match) => match[1]);
    const trailerList = Array.from(__sc.matchAll(/<video.*?data-src="(.*?)".*?>/gs)).map((match) => match[1]);


    // loop codelist
    for (let i = 0; i < codeList.length; i++) {
      const code = codeList[i];
      const title = titleList[i];
      const fanArt = fanArtList[i];
      const trailer = trailerList[i];
      movies.push({
        video_id: utils.getVideoCode(code) ?? randomUUID(),
        video_code: code.toUpperCase(),
        title: utils.maxWords(title, 25).replaceAll(`${code.toUpperCase()}`,"").trim(),
        fan_art: fanArt.replace("?class=thumbnail", ""),
        poster: fanArt,
        trailer: trailer,
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
