import { NextApiRequest, NextApiResponse } from "next";
import { Error400Model } from "../../../models/__error400_model";
import { MovieModel } from "../../../models/movie_model";
import { ActorModel } from "../../../models/actor_model";
import utils from "../../../src/utils";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query;
  const { code } = query;

  /// ! case: mising params
  if (code == null) {
    const err: Error400Model = {
      status_code: 400,
      status_message: "missing required params",
      params: ["code"],
      example: utils.baseUrl(req) + "/api/r18/bycode?code=EYAN-181",
    };
    res.status(400).json(err);
    return;
  }

  try {
    const __r18 = await utils.r18prefix(code);
    const prefixCode = __r18["content_id"];
    const response = (await axios.get(`https://r18.dev/videos/vod/movies/detail/-/combined=${prefixCode}/json`)).data;
    const actorList: ActorModel[] = [];
    for (const actor of response["actresses"]) {
      actorList.push({
        cast_id: actor["id"],
        cast_names: actor["name_romaji"],
        cast_image: `https://pics.dmm.co.jp/mono/actjpgs/${actor["image_url"]}`,
      });
    }

    const genreList: string[] = [];
    for (const genre of __r18["categories"]) {
      genreList.push(genre["name"]);
    }

    const ssList: string[] = [];
    for (const ss of response["gallery"]) {
      ssList.push(ss["image_full"]);
    }

    /// * [OUTPUT] ------------------------------------------------------
    const movie: MovieModel = {
      video_id: prefixCode,
      video_code_id: prefixCode,
      video_code: code.toString().toUpperCase(),
      title: __r18["title"] ?? null,
      title_ja: response["title_ja"] ?? null,
      description: response["comment_en"],
      fan_art: __r18["images"]?.["jacket_image"]?.["large2"] ?? null,
      poster: __r18["images"]?.["jacket_image"]?.["large2"]?.replaceAll("pl.jpg", "ps.jpg") ?? null,
      trailer: __r18["sample"]?.["high"] ?? null,
      actors: actorList,
      genre: genreList,
      release_date: __r18["release_date"] ?? null,
      release_date_formated: __r18["release_date"] ? utils.toDateFormat(__r18["release_date"]) : null,
      duration: __r18["runtime_minutes"] ?? null,
      duration_formated: utils.toDurationFormat(__r18["runtime_minutes"]) ?? null,
      studio: __r18["maker"]?.["name"] ?? null,
      label: __r18["label"]?.["name"] ?? null,
      director: __r18["director"] ?? null,
      series: __r18["series"]?.["name"] ?? null,
      screenshot: ssList,
      view_count: null,
      score: null,
    };
    res.status(200).json(movie);
  } catch (error) {
    res.status(500).json(error);
  }
}
