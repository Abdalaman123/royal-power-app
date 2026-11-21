import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'

interface Meta {
  title: string
  description: string
  index: boolean
}

const BRAND_DESC = 'Raise IT support tickets, request equipment, track every request and follow IT SOPs in one smart helpdesk and asset management portal.'

/** Page-specific titles/descriptions. Anything not listed (admin, unknown) is kept out of search results. */
function metaFor(path: string, site: string, tagline: string): Meta {
  const p = path.replace(/\/+$/, '') || '/'
  switch (p) {
    case '/':
      return { title: `${site} – ${tagline} | IT Helpdesk, Tickets & Equipment Requests`, description: BRAND_DESC, index: true }
    case '/request/new':
      return { title: `Create IT Support Request – ${site}`, description: `Submit an IT support or equipment request to the ${site} helpdesk and get a ticket ID instantly (RP-YYYY-NNNNN).`, index: true }
    case '/catalog':
      return { title: `IT Equipment Catalog – ${site}`, description: `Browse the ${site} IT equipment catalog: computers, displays, printers, network and power accessories you can request from the IT team.`, index: true }
    case '/sops':
      return { title: `IT SOPs & Guidelines – ${site}`, description: `Standard operating procedures for IT equipment issue, return, repair and support at ${site}.`, index: true }
    case '/about':
      return { title: `About IT Support & FAQ – ${site}`, description: `How the ${site} IT helpdesk works: services, response priorities, approvals and frequently asked questions.`, index: true }
    case '/track':
      return { title: `Track My IT Request – ${site}`, description: `Follow the live status of your ${site} IT ticket using your ticket ID and tracking code.`, index: true }
    default:
      return { title: `${site} – ${tagline}`, description: BRAND_DESC, index: false }
  }
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

/** Keeps <title>, description, canonical, robots and Open Graph tags in sync with the current page. */
export function RouteSeo() {
  const { pathname } = useLocation()
  const { settings } = useSettings()

  useEffect(() => {
    const isPrivate = pathname.startsWith('/admin')
    const m = metaFor(pathname, settings.site_name, settings.tagline)
    const index = m.index && !isPrivate
    const url = `${window.location.origin}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`

    document.title = m.title
    setMeta('meta[name="description"]', 'name', 'description', m.description)
    setMeta('meta[name="robots"]', 'name', 'robots', index ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,nofollow')
    setMeta('meta[property="og:title"]', 'property', 'og:title', m.title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', m.description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', m.title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', m.description)

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = url
  }, [pathname, settings.site_name, settings.tagline])

  return null
}
