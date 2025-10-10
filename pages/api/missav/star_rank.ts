import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  try {
    const response = await fetch(`https://missav.live/en/actresses/ranking`);
    const ranks = [];
    const __sc = await response.text();
    console.log('🟡 __sc', __sc)

    // ! case: found
    const nameList = Array.from(__sc.matchAll(/<img\s+src="https:\/\/fourhoi.com\/actress\/.*?\.jpg"\s+alt="(.*?)"/gs)).map((match) => match[1]);
    const rankList = Array.from(__sc.matchAll(/<span\s+class="(?:\s|[^>"])*?inline-flex\s+items-center\s+px-2.5\s+py-0.5\s+rounded-md\s+text-sm\s+font-medium(?:\s|[^>"])*?"\s*>\s*(Rank\s*#\d+)\s*<\/span>/gs)).map((match) => match[1].trim());
    const avatarList = Array.from(__sc.matchAll(/<img\s+src="(https:\/\/fourhoi.com\/actress\/.*?\.jpg)"\s+alt=".*?"/gs)).map((match) => match[1]);


    // loop codelist
    for (let i = 0; i < nameList.length; i++) {
      const name = nameList[i];
      const rank = rankList[i];
      const avatar = avatarList[i];

      ranks.push({
        name: name,
        rank: rank,
        avatar: avatar,
      });
    }

    res.status(200).json({
      code: 200,
      server_time: Date.now(),
      result: ranks,
    });
  } catch (error) {
    res.status(500).json(error);
  }
}
