import { NextApiRequest, NextApiResponse } from 'next'
import utils from '../../../src/utils'
import { readQuery } from '../../../src/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!readQuery(req, res)) return
  /// ! root
  const route = [
    {
      path: '/api/r18',
      origin: 'https://r18.dev',
      list: [
        utils.baseUrl(req) + '/api/r18/bycode?code=EYAN-181',
        //
      ],
    },
  ]
  res.status(200).json({
    code: 200,
    server_time: Date.now(),
    examples: route,
  })
}
