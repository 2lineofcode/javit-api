import * as React from "react";
import Head from "next/head";
import { AppProps } from "next/app";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Client-side cache, shared for the whole session of the user in the browser.

type MyAppProps = AppProps

export default function MyApp(props: MyAppProps) {
  const { Component, pageProps } = props;
  return (
    <>
      <Head>
        <title>JavIt</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <SpeedInsights />
      <Component {...pageProps} />
    </>
  );

  // const router = useRouter();
  // useEffect(() => {
  //   router.push("/api");
  // }, [router]);
  // return null;
}
