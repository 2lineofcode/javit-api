import { NextApiRequest, NextApiResponse } from "next";
import utils from "../../../src/utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  /// ! root
  const route = [
    {
      path: "/api/missav",
      origin: "https://missav.live",
      list: [
        utils.baseUrl(req) + "/api/missav/bycode?code=EYAN-181",
        utils.baseUrl(req) + "/api/missav/search?q=big tits&page=1",
        //
      ],
    },
  ];
  res.status(200).json({
    code: 200,
    server_time: Date.now(),
    examples: route,
  });
}
