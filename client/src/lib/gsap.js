// GSAP is used only for scroll scrub, which Framer Motion cannot do. Loaded lazily; never for reduced motion.
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

/** Runs setup once GSAP is loaded; the returned cleanup reverts every tween and ScrollTrigger it created. */
export function withGsap(setup, el) {
  let ctx
  let dead = false
  loadGsap().then((lib) => {
    if (dead || !lib) return
    ctx = lib.gsap.context(() => setup(lib), el)
  })
  return () => { dead = true; ctx?.revert() }
}
