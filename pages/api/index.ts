import axios from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import utils from "../../src/utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { site, image, video } = req.query;

  /// ! root
  if (Object.keys(req.query).length === 0) {
    const route = [
      {
        helper: "== HELPER ==",
        list: [
          {
            getSiteWithProxy: utils.baseUrl(req) + "/api?site=https://www.reddit.com",
            getImageWithProxy: utils.baseUrl(req) + "/api?image=https://pics.dmm.co.jp/digital/video/eyan00181/eyan00181jp-1.jpg",
            getVideoWithProxy: utils.baseUrl(req) + "/api?video=https://www.sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
          },
        ],
      },
      {
        provider_name: "r18",
        desc: "Fast and Accurate Data Source",
        api_url: utils.baseUrl(req) + "/api/r18/",
        site: "https://r18.dev",
      },
      {
        provider_name: "njav",
        desc: "Support Multi Language",
        api_url: utils.baseUrl(req) + "/api/njav/",
        site: "https://njavtv.com/",
      },
      {
        provider_name: "missav",
        desc: "Support Multi Language",
        api_url: utils.baseUrl(req) + "/api/missav/",
        site: "https://missav.ws/",
      },
    ];
    res.status(200).json({
      code: 200,
      server_time: Date.now(),
      examples: route,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // ⵌ ~~~~
  // ────────────────────────────────────────────────────────────────

  /// ! site
  else if (site) {
    let targetUrl: URL;
    try {
      if (Array.isArray(site)) {
        throw new Error("Invalid site parameter: multiple values provided.");
      }
      targetUrl = new URL(site);
    } catch (parseError) {
      console.error(`Invalid URL provided for site: ${site}`, parseError);
      return res.status(400).send("Bad Request: Invalid URL format.");
    }

    try {
      const siteResponse = await axios.get(targetUrl.href, {
        responseType: "text",
        timeout: 10000,
      });

      if (siteResponse.headers["content-type"]) {
        res.setHeader("Content-Type", siteResponse.headers["content-type"]);
      } else {
        res.setHeader("Content-Type", "text/html");
      }

      res.status(siteResponse.status).send(siteResponse.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error(`Error proxying site: ${targetUrl.href}`, error.message);

        if (error.response) {
          return res.status(error.response.status).send(error.response.data);
        } else if (error.code === "ECONNABORTED") {
          return res.status(504).send("Gateway Timeout: The target server took too long to respond.");
        } else {
          return res.status(502).send("Bad Gateway: Could not connect to the target server or other network issue.");
        }
      } else {
        console.error("An unexpected error occurred during site proxy:", error);
        return res.status(500).send("Internal Server Error: An unexpected issue occurred.");
      }
    }
  }

  /// ! image
  else if (image != null) {
    try {
      const imageResponse = await axios.get(`${image}`, {
        responseType: "arraybuffer",
        timeout: 10000,
      });
      const imageBuffer = Buffer.from(imageResponse.data, "binary");

      if (imageResponse.headers["content-type"]) {
        res.setHeader("Content-Type", imageResponse.headers["content-type"]);
      } else {
        res.setHeader("Content-Type", "application/mp4");
      }
      res.status(imageResponse.status).send(imageBuffer);
    } catch (error: any) {
      console.error(`Error proxying image: ${image}`, error.message);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          return res.status(error.response.status).send(error.response.data);
        } else if (error.code === "ECONNABORTED") {
          return res.status(504).send("Gateway Timeout for image.");
        } else {
          return res.status(502).send("Bad Gateway for image.");
        }
      } else {
        console.error("An unexpected error occurred during image proxy:", error);
        return res.status(500).send("Internal Server Error for image.");
      }
    }
  }

  /// ! video
  else if (video != null) {
    try {
      const videoUrl = Array.isArray(video) ? video[0] : video;
      const isHls = videoUrl.endsWith(".m3u8");

      // Headers to mimic a real browser request
      const specificHeaders = {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        origin: "https://javtrailers.com",
        referer: "https://javtrailers.com/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      };

      if (isHls) {
        const mainPlaylistResponse = await axios.get(videoUrl, {
          headers: specificHeaders,
          responseType: "text",
          timeout: 20000,
        });

        const mainPlaylistContent = mainPlaylistResponse.data;
        let childPlaylistUrl;

        const resolutionRegex = /#EXT-X-STREAM-INF:BANDWIDTH=\d+.*RESOLUTION=1280x720.*\n(.+)/;
        const match = mainPlaylistContent.match(resolutionRegex);

        if (match) {
          childPlaylistUrl = new URL(match[1], videoUrl).toString();
        } else {
          const fallbackRegex = /#EXT-X-STREAM-INF:BANDWIDTH=\d+.*\n(.+)/g;
          const allMatches = [...mainPlaylistContent.matchAll(fallbackRegex)];
          if (allMatches.length > 0) {
            const highestBandwidthMatch = allMatches[allMatches.length - 1];
            childPlaylistUrl = new URL(highestBandwidthMatch[1], videoUrl).toString();
          } else {
            throw new Error("Could not find any playlist URLs in the m3u8 file.");
          }
        }

        const childPlaylistResponse = await axios.get(childPlaylistUrl, {
          headers: specificHeaders,
          responseType: "text",
          timeout: 20000,
        });

        const host = req.headers.host;
        const protocol = req.headers["x-forwarded-proto"] || "http";
        const baseUrl = `${protocol}://${host}${req.url?.split("?")[0] || ''}`;

        const modifiedChildContent = childPlaylistResponse.data.replace(/(.+?\.(?:ts|mp4|m4s|aac))/g, (match: string) => `${baseUrl}?video=${encodeURIComponent(new URL(match, childPlaylistUrl).toString())}`);

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.status(200).send(modifiedChildContent);
      } else {
        // --- Perbaikan untuk file MP4 dengan penanganan stream manual ---
        const range = req.headers.range;

        const requestHeaders: any = { ...specificHeaders };
        if (range) {
          requestHeaders.Range = range;
        }

        const proxyResponse = await axios.get(videoUrl as string, {
          headers: requestHeaders,
          responseType: "stream",
          timeout: 20000,
        });

        // Set status code dari respons asli
        res.status(proxyResponse.status);

        // Hapus header yang sering bikin masalah saat streaming
        // Ini termasuk header yang memaksa browser untuk download
        if (proxyResponse.headers["transfer-encoding"]) {
          delete proxyResponse.headers["transfer-encoding"];
        }
        if (proxyResponse.headers["connection"]) {
          delete proxyResponse.headers["connection"];
        }
        if (proxyResponse.headers["content-disposition"]) {
          delete proxyResponse.headers["content-disposition"];
        }

        // Tulis semua header dari respons asli kecuali yang kita handle spesifik
        for (const key in proxyResponse.headers) {
          if (!["content-type"].includes(key.toLowerCase())) {
            res.setHeader(key, proxyResponse.headers[key]);
          }
        }

        // Tetapkan Content-Type secara eksplisit dan wajib
        res.setHeader("Content-Type", "video/mp4");

        // Teruskan stream data langsung ke klien secara manual
        proxyResponse.data.on("data", (chunk: Buffer) => {
          res.write(chunk);
        });

        proxyResponse.data.on("end", () => {
          res.end();
        });

        proxyResponse.data.on("error", (err: any) => {
          console.error("Error during streaming:", err);
          if (!res.headersSent) {
            res.status(500).end("Internal Server Error during stream.");
          }
        });
      }
    } catch (error: any) {
      console.error(`Error proxying content: ${video}`, error.message);
      if (axios.isAxiosError(error) && error.response) {
        console.error("Target server responded with status:", error.response.status);
        return res.status(error.response.status).send(`Error from target server (Status: ${error.response.status}).`);
      } else if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
        return res.status(504).send("Gateway Timeout.");
      } else {
        return res.status(500).send("Internal Server Error.");
      }
    }
  }
}
