import Head from 'next/head'
import type { AppProps } from 'next/app'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props
  return (
    <>
      <Head>
        <title>JavIt</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <SpeedInsights />
      <Component {...pageProps} />
    </>
  )
}
