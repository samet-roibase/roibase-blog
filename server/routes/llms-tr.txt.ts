import { defineEventHandler, setHeader } from 'h3'
import { buildLlmsNav } from '~/server/utils/llms'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600')
  return await buildLlmsNav(event, 'tr', siteUrl)
})
