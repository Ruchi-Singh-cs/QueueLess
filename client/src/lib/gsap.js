/**
 * GSAP is here for one thing Framer Motion does not do well: scrub — animation welded to scroll
 * position rather than fired when an element appears. Everything that merely enters, hovers or
 * transitions stays on Framer Motion; adding a second library for those would be weight with no
 * capability.
 *
 * It is imported dynamically so it never lands in the initial bundle (Landing is eagerly loaded),
 * and it is never loaded at all for reduced motion or on the server.
 */
let pending = null

export function loadGsap() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve(null)
  pending ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
    .then(([g, st]) => {
      const gsap = g.gsap || g.default
      const ScrollTrigger = st.ScrollTrigger || st.default
      gsap.registerPlugin(ScrollTrigger)
      return { gsap, ScrollTrigger }
    })
    .catch(() => null)
  return pending
}

/**
 * Runs `setup({ gsap, ScrollTrigger })` once the library is in, and reverts everything it created
 * on unmount. gsap.context() tracks every tween and trigger made inside it, so cleanup is total —
 * important here, because ScrollTrigger attaches to the document and would otherwise outlive the
 * page across a route change.
 */
export function withGsap(setup, el) {
  let ctx
  let dead = false
  loadGsap().then((lib) => {
    if (dead || !lib) return
    ctx = lib.gsap.context(() => setup(lib), el)
  })
  return () => { dead = true; ctx?.revert() }
}
