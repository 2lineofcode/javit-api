import { NextApiRequest, NextApiResponse } from "next";
import { Error400Model } from "../../models/__error400_model";
import utils from "../../src/utils";
import axios from "axios";
import * as wanakana from "wanakana";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query;
  const { q, page, perPage } = query;
  page ?? 1;
  perPage ?? 100;

  /// ! check: mising params
  if (q == null) {
    const err: Error400Model = {
      status_code: 400,
      status_message: "missing required params",
      params: ["q"],
      example: utils.baseUrl(req) + "/api/actress?q=Miina",
    };
    res.status(400).json(err);
    return;
  }

  try {
    const _url = `https://api.dmm.com/affiliate/v3/`;
    const _apiId = "UrwskPfkqQ0DuVry2gYL";
    const _affiliateId = "10278-996";
    const hiraganaName = wanakana.toHiragana(q.toString());

    const response = await axios.get(`${_url}ActressSearch`, {
      params: {
        api_id: _apiId,
        affiliate_id: _affiliateId,
        output: "json",
        offset: page,
        hits: perPage,
        keyword: hiraganaName,
        sort: "-birthday",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json(error);
  }
}
