// utils.ts

import axios from "axios";
import { NextApiRequest } from "next";

function getVideoCode(s: string): string | null {
  const expressions: RegExp[] = [new RegExp("([a-zA-Z]+-[0-9]+)"), new RegExp("([a-zA-Z]+[0-9]+)")];

  for (const expression of expressions) {
    const match = s.match(expression);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function baseUrl(req: NextApiRequest): string {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["host"];
  const baseUrl = `${protocol}://${host}`;

  return baseUrl;
}

async function r18prefix(code: string | string[]): Promise<any> {
  const response = await axios.get(`https://r18.dev/videos/vod/movies/detail/-/dvd_id=${code}/json`);
  return response.data;
}

function fixTitle(title: string): string {
  const fixSymbol = title.replace(/&#(\d+);/g, function (_match, dec) {
    return String.fromCharCode(dec);
  });

  const videoCode = getVideoCode(title);
  if (!videoCode) {
    return fixSymbol.trim();
  }
  
  return fixSymbol.replaceAll(videoCode, "").trim();
}

function reverseName(name: string): string {
  const parts = name.split(" ");
  return parts.reverse().join(" ");
}

function formatDurationToMinutes(durationStr: string): number {
  const parts = durationStr.split(":");
  let minutes = 0;

  if (parts.length === 3) {
    minutes += parseInt(parts[0], 10) * 60;
    minutes += parseInt(parts[1], 10);
    minutes += parseInt(parts[2], 10) / 60;
  } else if (parts.length === 2) {
    minutes += parseInt(parts[0], 10);
    minutes += parseInt(parts[1], 10) / 60;
  }

  return Math.round(minutes);
}

function toDurationFormat(value: number): string {
  const hour: number = Math.floor(value / 60);
  const minute: number = value % 60;
  return `${hour} hrs ${minute} min`;
}

function toDateFormat(dateString: string): string {
  const date = new Date(dateString);
  return Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" as const }).format(date);
}

function maxWords(str: string, n: number): string {
  const words = str.split(" ");
  if (words.length <= n) {
    return str;
  }
  return words.slice(0, n).join(" ") + "...";
}

function removeAllSymbol(str: string): string {
  return str.replace(/&#(\d+);/g, function (_match, dec) {
    return String.fromCharCode(dec);
  });
}

const utils = {
  getVideoCode,
  baseUrl,
  fixTitle,
  r18prefix,
  reverseName,
  toDurationFormat,
  formatDurationToMinutes,
  toDateFormat,
  maxWords,
  removeAllSymbol,
};

export default utils;
