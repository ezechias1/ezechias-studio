import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Clock,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'

/* ------------------------------------------------------------------ *
 * Background: a raymarched signed-distance field of merged spheres,
 * lit as an oil slick. It reacts to the mouse, to scroll, to clicks
 * (uPulse), and floods/swells during a route change (uFlood/uDir).
 * ------------------------------------------------------------------ */
const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uScroll;
uniform float uPulse;
uniform float uFlood;
uniform float uHue;
uniform float uDir;
uniform float uQuality;

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float sdSphere(vec3 p, float r){ return length(p) - r; }

float map(vec3 p){
  float t = uTime * 0.30;
  p.y += uScroll * 2.4 * (1.0 - uFlood);
  p.y -= uDir * uFlood * 1.1;

  float swell  = 1.0 + uPulse * 0.30 + uFlood * 3.40;
  float spread = (1.0 + uScroll * 0.85) * (1.0 - uFlood * 0.74);

  float d = sdSphere(p - vec3(sin(t)*0.85*spread, cos(t*0.83)*0.62*spread, 0.0), 1.02*swell);
  d = smin(d, sdSphere(p - vec3(cos(t*1.13)*1.05*spread, sin(t*0.71)*0.86*spread,  sin(t*0.9)*0.55), 0.80*swell), 0.72);
  d = smin(d, sdSphere(p - vec3(sin(t*0.64)*-1.18*spread, cos(t*1.27)*-0.58*spread, cos(t*0.87)*0.62), 0.68*swell), 0.72);
  d = smin(d, sdSphere(p - vec3(cos(t*0.49)*0.35*spread, sin(t*1.4)*1.05*spread, -0.55), 0.58*swell), 0.68);
  d = smin(d, sdSphere(p - vec3(uMouse.x*1.75, uMouse.y*1.35, 0.75), 0.52 + uPulse*0.22), 0.62);
  return d;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(
    map(p+e.xyy) - map(p-e.xyy),
    map(p+e.yxy) - map(p-e.yxy),
    map(p+e.yyx) - map(p-e.yyx)
  ));
}

vec3 slick(float t){
  vec3 a = vec3(0.52, 0.38, 0.58);
  vec3 b = vec3(0.48, 0.42, 0.42);
  vec3 c = vec3(1.00, 0.95, 0.85);
  vec3 d = vec3(0.00, 0.22, 0.58);
  return a + b * cos(6.28318 * (c*(t + uHue) + d));
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 4.35);
  vec3 rd = normalize(vec3(uv, -1.55));

  float grad = smoothstep(-0.75, 0.85, uv.y);
  vec3 col = mix(vec3(0.026, 0.010, 0.046), vec3(0.062, 0.022, 0.082), grad);
  col += vec3(0.045, 0.006, 0.062) * (1.0 - length(uv)*0.75);

  float t = 0.0; float hit = 0.0;
  int steps = int(uQuality);
  for(int i = 0; i < 72; i++){
    if(i >= steps) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    if(d < 0.0018){ hit = 1.0; break; }
    if(t > 11.0) break;
    t += d * 0.88;
  }

  if(hit > 0.5){
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lightA = normalize(vec3(-0.65,  0.85,  0.55));
    vec3 lightB = normalize(vec3( 0.80, -0.35,  0.42));
    float diffA = max(dot(n, lightA), 0.0);
    float diffB = max(dot(n, lightB), 0.0);
    float fres  = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
    vec3  refl  = reflect(rd, n);
    float env   = refl.y * 0.5 + 0.5;

    vec3 irid = slick(fres * 1.35 + env * 0.42 + uTime * 0.035 + p.y * 0.10);
    float specA = pow(max(dot(refl, lightA), 0.0), 42.0);
    float specB = pow(max(dot(refl, lightB), 0.0), 26.0);

    vec3 surf = irid * (0.16 + diffA * 0.62 + diffB * 0.30);
    surf += vec3(1.00, 0.94, 0.99) * specA * 1.55;
    surf += vec3(0.62, 0.32, 1.00) * specB * 0.85;
    surf += irid * fres * 1.15;
    surf += slick(env + 0.35) * pow(fres, 1.4) * 0.55;
    surf += slick(env + uTime*0.2) * uPulse * fres * 1.1;
    surf += slick(env * 2.2 + uTime * 0.5) * uFlood * 0.30;

    col = mix(col, surf, 0.97);
    col += slick(env) * 0.05;
  }

  float g = hash(gl_FragCoord.xy + fract(uTime) * 91.7);
  col += (g - 0.5) * 0.030;
  col = pow(max(col, 0.0), vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`

const VERT = 'void main(){ gl_Position = vec4(position, 1.0); }'

function useShaderBackground(canvasRef, ctl) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = window.innerWidth < 700

    const renderer = new WebGLRenderer({ canvas, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.2 : 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = {
      uRes: { value: new Vector2() },
      uTime: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
      uScroll: { value: 0 },
      uPulse: { value: 0 },
      uFlood: { value: 0 },
      uHue: { value: 0 },
      uDir: { value: 1 },
      uQuality: { value: small ? 44 : 68 },
    }
    const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms })
    scene.add(new Mesh(new PlaneGeometry(2, 2), material))

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      const dpr = renderer.getPixelRatio()
      uniforms.uRes.value.set(window.innerWidth * dpr, window.innerHeight * dpr)
    }
    resize()

    const target = { x: 0, y: 0 }
    const onMove = (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2
      target.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)

    let raf
    const clock = new Clock()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      uniforms.uTime.value = reduced ? 0.8 : clock.getElapsedTime()
      uniforms.uMouse.value.x += (target.x - uniforms.uMouse.value.x) * 0.045
      uniforms.uMouse.value.y += (target.y - uniforms.uMouse.value.y) * 0.045

      const range = document.body.scrollHeight - window.innerHeight
      const progress = range > 0 ? window.scrollY / range : 0
      uniforms.uScroll.value += (progress - uniforms.uScroll.value) * 0.06

      ctl.pulse.current *= 0.93
      uniforms.uPulse.value = ctl.pulse.current

      const want = ctl.floodTarget.current
      ctl.flood.current += (want - ctl.flood.current) * (want > ctl.flood.current ? 0.085 : 0.042)
      uniforms.uFlood.value = ctl.flood.current

      uniforms.uDir.value += (ctl.dir.current - uniforms.uDir.value) * 0.1
      uniforms.uHue.value += (ctl.hue.current - uniforms.uHue.value) * 0.03

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
      material.dispose()
      renderer.dispose()
    }
  }, [])
}

/* ------------------------------------------------------------------ *
 * Content. Edit these arrays to change what the site says.
 * ------------------------------------------------------------------ */
const ROUTES = [
  { path: '/', label: 'INDEX', title: 'EZECHIAS', hue: 0 },
  { path: '/work', label: 'WORK', title: 'WORK', hue: 0.16 },
  { path: '/stack', label: 'STACK', title: 'STACK', hue: 0.32 },
  { path: '/story', label: 'STORY', title: 'STORY', hue: 0.48 },
  { path: '/contact', label: 'CONTACT', title: 'CONTACT', hue: 0.64 },
]

const WORK = [
  {
    id: '01',
    name: 'Headless Brand Platform',
    meta: 'Production · OneDayOnly',
    body: 'Migrated brand pages off a Magento 1 monolith that had become too slow to keep.',
    detail:
      'Content runs on Sanity and renders through Astro, then gets stitched into the live site at the edge by a Cloudflare Worker so the legacy platform and the new one serve as one site. Deploys go out through Wrangler via Bitbucket Pipelines. The hard part wasn’t the CMS — it was the stitching layer, where routing has to stay invisible to the customer.',
    stack: ['Sanity', 'Astro', 'Cloudflare Workers', 'Wrangler'],
  },
  {
    id: '02',
    name: 'Deep Sea Protocol',
    meta: 'Solo build',
    body: 'B2B lead research that runs itself.',
    detail:
      'A multi-agent graph crawls a target company, enriches what it finds against people data, then writes a usable brief. Built on LangGraph so each agent has a defined role and the whole run stays inspectable when it goes wrong — which, with agents, it does.',
    stack: ['FastAPI', 'LangGraph', 'Gemini 1.5 Pro', 'Firecrawl'],
    href: 'https://github.com/ezechias1/deep-sea-protocol',
  },
  {
    id: '03',
    name: 'OneDayOnly Redesign',
    meta: 'Unsolicited · 130 pages',
    body: 'A full reimagining of the daily-deals site I work at.',
    detail:
      'Built the entire frontend before anyone asked for it — cart, wishlist, search, dark mode, page transitions, across 130 routes. State in Zustand, motion in Framer. Started as a way to learn Next.js 16 properly and turned into the largest thing in my portfolio.',
    stack: ['Next.js 16', 'Tailwind', 'Framer Motion', 'Zustand'],
    href: 'https://github.com/ezechias1/onedayonly-redesign',
  },
  {
    id: '04',
    name: 'Multi-Store Commerce',
    meta: 'Production · OneDayOnly',
    body: 'Four Shopify storefronts stood up for launch.',
    detail:
      'Wired end to end with GA4 event tracking and conversion pipelines into Meta and Google Ads. Most of the work was making the analytics agree with each other — a purchase should count once, in every system, with the same value attached.',
    stack: ['Shopify', 'GA4', 'Meta Ads', 'Google Ads'],
  },
  {
    id: '05',
    name: 'Nexus AI',
    meta: 'Solo build',
    body: 'A chat platform that actually remembers you.',
    detail:
      'Vector-backed persistent memory across sessions, which is the part most AI products skip. Embeddings live in pgvector, retrieval is scoped per user, and memory gets summarised on write so context doesn’t grow without bound.',
    stack: ['Next.js', 'pgvector', 'Supabase'],
    href: 'https://github.com/ezechias1/nexus-ai',
  },
  {
    id: '06',
    name: 'BudgetWise',
    meta: 'Side venture · Live trial',
    body: 'A budgeting PWA I built and still run.',
    detail:
      'Row-level security across every table, Postgres edge functions, and bank feeds in progress. I wrote the security audit myself and it found real gaps — which taught me more about Postgres permissions than any tutorial did.',
    stack: ['React 18', 'TypeScript', 'Supabase', 'Capacitor'],
    href: 'https://github.com/ezechias1/BudgetWise-React',
  },
]

const TIMELINE = [
  {
    when: 'Jun 2026 —',
    role: 'Developer Intern',
    org: 'OneDayOnly.co.za',
    body:
      'Moved brand pages off Magento 1 onto a Sanity + Astro headless CMS, stitched in at the edge with Cloudflare Workers. Shipped PulseAI, a tagline service on FastAPI + Gemini. Set up four Shopify storefronts with GA4, Meta, and Google Ads tracking.',
  },
  {
    when: 'Apr 2026 —',
    role: 'Founder & Lead Developer',
    org: 'BudgetWise (Pty) Ltd',
    body:
      'Side venture. Took a vanilla-JS prototype to a production React PWA with row-level security across every table, Postgres edge functions, trip expense tracking, and a written security audit. Useful practice in owning a system end to end.',
  },
  {
    when: 'Nov 2025 — Apr 2026',
    role: 'Freelance Developer',
    org: 'DogDown Media',
    body:
      'Built and shipped ten-plus client sites — storefronts, booking systems, property listings, portfolios, and business tools. Covered the full stack on each project: frontend, backend, hosting, and deployment. Learned to deliver on someone else’s deadline without cutting corners on the technical side.',
  },
]

const STACK = [
  ['Frontend', 'React · Next.js · Astro · TypeScript · Three.js'],
  ['Backend', 'Supabase · Postgres · FastAPI · Node · C#'],
  ['AI', 'LangGraph · Gemini · Groq · pgvector · RAG'],
  ['Infra', 'Cloudflare Workers · Vercel · Cloud Run · Wrangler'],
  ['Commerce', 'Shopify · WooCommerce · Magento · GA4 · Meta Ads'],
  ['Content', 'Sanity · headless CMS · Bitbucket Pipelines'],
]

const panel = {
  position: 'relative',
  background: 'rgba(7, 2, 15, 0.88)',
  backdropFilter: 'blur(30px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,.10)',
  padding: 'clamp(26px, 4vw, 44px)',
  boxShadow: '0 30px 90px -30px rgba(0,0,0,.9)',
}

/* ------------------------------------------------------------------ *
 * Presentational pieces
 * ------------------------------------------------------------------ */
function TextReveal({ text, style, delay = 0, stagger = 0.03, trigger }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(false)
    const t = setTimeout(() => setShown(true), 40)
    return () => clearTimeout(t)
  }, [trigger])

  return (
    <span aria-label={text} style={{ display: 'inline-block', ...style }}>
      {[...text].map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}
        >
          <span
            style={{
              display: 'inline-block',
              transform: shown ? 'none' : 'translateY(105%) rotate(5deg)',
              opacity: shown ? 1 : 0,
              transition: `transform 1s cubic-bezier(.16,1,.3,1) ${delay + i * stagger}s, opacity .65s ease ${
                delay + i * stagger
              }s`,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        </span>
      ))}
    </span>
  )
}

function Reveal({ children, delay = 0, dir = 'up' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const fallback = setTimeout(() => setShown(true), 1400)
    if (!('IntersectionObserver' in window)) {
      setShown(true)
      return () => clearTimeout(fallback)
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          clearTimeout(fallback)
        }
      },
      { threshold: 0.08 }
    )
    if (ref.current) io.observe(ref.current)
    return () => {
      io.disconnect()
      clearTimeout(fallback)
    }
  }, [])

  const hidden =
    dir === 'left' ? 'inset(0 100% 0 0)' : dir === 'right' ? 'inset(0 0 0 100%)' : 'inset(100% 0 0 0)'

  return (
    <div
      ref={ref}
      style={{
        clipPath: shown ? 'inset(0 0 0 0)' : hidden,
        transform: shown ? 'none' : 'translateY(30px)',
        transition: `clip-path 1s cubic-bezier(.16,1,.3,1) ${delay}s, transform 1s cubic-bezier(.16,1,.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

const PageTitle = ({ text, k }) => (
  <h1
    style={{
      font: "800 clamp(46px,11vw,150px)/0.86 'Bricolage Grotesque', sans-serif",
      letterSpacing: '-.05em',
      textTransform: 'uppercase',
      marginBottom: 'clamp(28px,4vw,52px)',
      textShadow: '0 6px 60px rgba(7,2,17,.95)',
    }}
  >
    <TextReveal text={text} trigger={k} delay={0.1} stagger={0.045} />
  </h1>
)

const Wrap = ({ children }) => (
  <div
    style={{
      maxWidth: 1000,
      margin: '0 auto',
      padding: 'clamp(110px,14vh,170px) clamp(22px,3.5vw,40px) clamp(90px,11vw,140px)',
    }}
  >
    {children}
  </div>
)

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */
function Home({ k }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(100px,13vh,150px) clamp(22px,3.5vw,40px) clamp(90px,11vw,130px)',
        maxWidth: 1000,
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          font: "800 clamp(50px,12.5vw,175px)/0.82 'Bricolage Grotesque', sans-serif",
          letterSpacing: '-.055em',
          textTransform: 'uppercase',
          textShadow: '0 6px 60px rgba(7,2,17,.95)',
        }}
      >
        <TextReveal text="EZECHIAS" trigger={k} delay={0.12} stagger={0.045} />
        <br />
        <TextReveal text="MULAMBA" trigger={k} delay={0.36} stagger={0.045} />
      </h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'clamp(20px,5vw,56px)',
          marginTop: 'clamp(26px,4vw,40px)',
          alignItems: 'flex-end',
        }}
      >
        <Reveal delay={0.7}>
          <p
            style={{
              font: '300 clamp(16px,1.8vw,20px)/1.62 Sora, sans-serif',
              color: '#F5EEFF',
              maxWidth: 430,
              textShadow: '0 2px 24px rgba(7,2,17,.95)',
            }}
          >
            Full-stack developer in Cape Town. I work across commerce platforms, headless
            architecture, and AI systems — and I ship things end to end.
          </p>
        </Reveal>
        <Reveal delay={0.8}>
          <div
            style={{
              font: "400 11px/2.1 'JetBrains Mono', monospace",
              color: 'rgba(245,238,255,.7)',
              letterSpacing: '.05em',
              textShadow: '0 2px 20px rgba(7,2,17,.95)',
            }}
          >
            <div>LAT −33.9249 · LON 18.4241</div>
            <div>REPOS 30 · STACK TS/PY/C#</div>
            <div>SHIPPING SINCE 2025</div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.9}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
            gap: 1,
            marginTop: 'clamp(36px,5vw,56px)',
            background: 'rgba(255,255,255,.09)',
            border: '1px solid rgba(255,255,255,.09)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {[
            ['NOW', 'Developer Intern', 'OneDayOnly.co.za — headless CMS, Shopify, AI services'],
            ['ALSO', 'Founder & Lead Dev', 'BudgetWise (Pty) Ltd — budgeting PWA, live trial'],
            ['BEFORE', 'Freelance Developer', 'DogDown Media — 10+ client builds'],
            ['DEPTH', '30 repos · since 2025', 'TypeScript, Python, C# — frontend through infra'],
          ].map(([label, title, body]) => (
            <div
              key={label}
              style={{
                background: 'rgba(7,2,15,.88)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                padding: '22px 20px',
              }}
            >
              <div
                style={{
                  font: "500 10px/1 'JetBrains Mono', monospace",
                  color: '#FF6FB5',
                  letterSpacing: '.22em',
                  marginBottom: 12,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  font: "700 clamp(15px,1.7vw,18px)/1.25 'Bricolage Grotesque', sans-serif",
                  letterSpacing: '-.01em',
                  marginBottom: 7,
                }}
              >
                {title}
              </div>
              <div style={{ font: '300 13px/1.55 Sora, sans-serif', color: 'rgba(245,238,255,.62)' }}>
                {body}
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

function Work({ k, poke }) {
  const [open, setOpen] = useState('01')

  return (
    <Wrap>
      <PageTitle text="WORK" k={k} />
      <Reveal>
        <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
          {WORK.map((item, i) => {
            const isOpen = open === item.id
            return (
              <div key={item.id} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.09)' }}>
                <Reveal delay={i * 0.06} dir="left">
                  <button
                    data-hover
                    className="row"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpen(isOpen ? null : item.id)
                      poke()
                    }}
                    style={{ padding: 'clamp(22px,3vw,30px) clamp(22px,3.4vw,38px)', display: 'block' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 18,
                        flexWrap: 'wrap',
                      }}
                    >
                      <h3
                        style={{
                          font: "700 clamp(22px,3vw,34px)/1.05 'Bricolage Grotesque', sans-serif",
                          letterSpacing: '-.03em',
                        }}
                      >
                        <span
                          style={{
                            font: "400 12px/1 'JetBrains Mono', monospace",
                            color: '#FF6FB5',
                            verticalAlign: 'super',
                            marginRight: 12,
                          }}
                        >
                          {item.id}
                        </span>
                        {item.name}
                      </h3>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span
                          style={{
                            font: "400 11px/1 'JetBrains Mono', monospace",
                            color: '#5CE1FF',
                            letterSpacing: '.16em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.meta}
                        </span>
                        <span
                          style={{
                            font: '300 22px/1 Sora, sans-serif',
                            color: '#FF6FB5',
                            transform: isOpen ? 'rotate(45deg)' : 'none',
                            transition: 'transform .5s cubic-bezier(.16,1,.3,1)',
                            display: 'inline-block',
                          }}
                        >
                          +
                        </span>
                      </span>
                    </div>
                    <p
                      style={{
                        font: '300 clamp(15px,1.6vw,17px)/1.7 Sora, sans-serif',
                        color: 'rgba(245,238,255,.82)',
                        maxWidth: 620,
                        marginTop: 10,
                      }}
                    >
                      {item.body}
                    </p>
                  </button>
                </Reveal>

                <div
                  style={{
                    maxHeight: isOpen ? 440 : 0,
                    opacity: isOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height .6s cubic-bezier(.16,1,.3,1), opacity .45s ease',
                  }}
                >
                  <div style={{ padding: '0 clamp(22px,3.4vw,38px) clamp(24px,3vw,32px)' }}>
                    <p
                      style={{
                        font: '300 clamp(14px,1.5vw,16px)/1.78 Sora, sans-serif',
                        color: 'rgba(245,238,255,.74)',
                        maxWidth: 640,
                        borderLeft: '2px solid rgba(255,111,181,.45)',
                        paddingLeft: 18,
                      }}
                    >
                      {item.detail}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                      {item.stack.map((tag, j) => (
                        <span
                          key={tag}
                          className="tag"
                          style={{
                            font: "400 11px/1 'JetBrains Mono', monospace",
                            color: 'rgba(245,238,255,.6)',
                            border: '1px solid rgba(255,255,255,.16)',
                            borderRadius: 3,
                            padding: '6px 11px',
                            letterSpacing: '.05em',
                            transform: isOpen ? 'none' : 'translateY(10px)',
                            opacity: isOpen ? 1 : 0,
                            transition: `transform .5s cubic-bezier(.16,1,.3,1) ${
                              0.12 + j * 0.05
                            }s, opacity .4s ease ${0.12 + j * 0.05}s, border-color .3s, color .3s`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {item.href && (
                      <a
                        data-hover
                        className="u"
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-block',
                          marginTop: 20,
                          font: "500 12px/1 'JetBrains Mono', monospace",
                          letterSpacing: '.14em',
                          color: '#5CE1FF',
                          textDecoration: 'none',
                          paddingBottom: 3,
                        }}
                      >
                        VIEW SOURCE →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Reveal>
    </Wrap>
  )
}

function Stack({ k }) {
  return (
    <Wrap>
      <PageTitle text="STACK" k={k} />
      <Reveal>
        <div style={panel}>
          {STACK.map(([label, value], i) => (
            <Reveal key={label} delay={i * 0.07} dir="left">
              <div
                className="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'clamp(90px,14vw,150px) 1fr',
                  gap: 'clamp(14px,3vw,40px)',
                  padding: '18px 12px',
                  margin: '0 -12px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.08)',
                  alignItems: 'baseline',
                  borderRadius: 4,
                }}
              >
                <span
                  style={{
                    font: "500 11px/1.4 'JetBrains Mono', monospace",
                    color: '#FF6FB5',
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </span>
                <span style={{ font: '300 clamp(15px,1.7vw,18px)/1.6 Sora, sans-serif', color: '#F5EEFF' }}>
                  {value}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </Wrap>
  )
}

function Story({ k }) {
  return (
    <Wrap>
      <PageTitle text="STORY" k={k} />
      <div style={{ display: 'grid', gap: 14 }}>
        {TIMELINE.map((entry, i) => (
          <Reveal key={entry.org} delay={i * 0.1} dir={i % 2 === 0 ? 'left' : 'right'}>
            <div
              style={{
                ...panel,
                display: 'grid',
                gridTemplateColumns: 'clamp(80px,12vw,130px) 1fr',
                gap: 'clamp(16px,3vw,40px)',
              }}
            >
              <span
                style={{
                  font: "400 12px/1.5 'JetBrains Mono', monospace",
                  color: '#5CE1FF',
                  letterSpacing: '.1em',
                }}
              >
                {entry.when}
              </span>
              <div>
                <h3
                  style={{
                    font: "700 clamp(20px,2.5vw,28px)/1.15 'Bricolage Grotesque', sans-serif",
                    letterSpacing: '-.02em',
                  }}
                >
                  {entry.role}
                </h3>
                <p
                  style={{
                    font: "500 11px/1 'JetBrains Mono', monospace",
                    color: '#FF6FB5',
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    margin: '9px 0 14px',
                  }}
                >
                  {entry.org}
                </p>
                <p
                  style={{
                    font: '300 clamp(15px,1.6vw,17px)/1.75 Sora, sans-serif',
                    color: 'rgba(245,238,255,.82)',
                  }}
                >
                  {entry.body}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Wrap>
  )
}

function Contact({ k }) {
  return (
    <Wrap>
      <PageTitle text="CONTACT" k={k} />
      <Reveal delay={0.28}>
        <p
          style={{
            font: '300 clamp(17px,2vw,22px)/1.62 Sora, sans-serif',
            color: '#F5EEFF',
            maxWidth: 470,
            marginBottom: 44,
          }}
        >
          Open to full-stack and AI roles, in South Africa or remote. WhatsApp is the fastest way to
          reach me.
        </p>
      </Reveal>
      <Reveal delay={0.4}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(20px,4vw,44px)',
            font: "500 clamp(13px,1.5vw,15px)/1 'JetBrains Mono', monospace",
            letterSpacing: '.12em',
          }}
        >
          <a
            data-hover
            className="u"
            href="https://wa.me/27682531230"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', paddingBottom: 4, color: '#5CE1FF' }}
          >
            WHATSAPP →
          </a>
          <a
            data-hover
            className="u"
            href="mailto:ezechiasmulamba@gmail.com"
            style={{ textDecoration: 'none', paddingBottom: 4 }}
          >
            EMAIL →
          </a>
          <a
            data-hover
            className="u"
            href="https://github.com/ezechias1"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', paddingBottom: 4 }}
          >
            GITHUB →
          </a>
        </div>
      </Reveal>
    </Wrap>
  )
}

const PAGES = { '/': Home, '/work': Work, '/stack': Stack, '/story': Story, '/contact': Contact }

const currentHash = () => window.location.hash.replace(/^#/, '') || '/'

/** How much overscroll it takes to travel to the next page. */
const TRAVEL = 480

export default function App() {
  const canvasRef = useRef(null)
  const cursorRef = useRef(null)

  const pulse = useRef(0)
  const flood = useRef(0)
  const floodTarget = useRef(0)
  const hue = useRef(0)
  const dir = useRef(1)

  const [route, setRoute] = useState(currentHash)
  const [phase, setPhase] = useState('idle')
  const [veilRoute, setVeilRoute] = useState(null)
  const [travelDir, setTravelDir] = useState(1)
  const [pageKey, setPageKey] = useState(0)
  const [intent, setIntent] = useState(0)
  const [intentDir, setIntentDir] = useState(null)
  const locked = useRef(false)

  useShaderBackground(canvasRef, { pulse, flood, floodTarget, hue, dir })

  const index = Math.max(0, ROUTES.findIndex((r) => r.path === route))

  useEffect(() => {
    hue.current = ROUTES[index].hue
  }, [index])

  const go = useCallback(
    (path, direction = 1) => {
      if (locked.current || path === route) return
      locked.current = true
      setTravelDir(direction)
      dir.current = direction
      setVeilRoute(ROUTES.find((r) => r.path === path))
      setIntent(0)
      pulse.current = 1
      floodTarget.current = 1
      setPhase('out')

      setTimeout(() => {
        window.history.replaceState(null, '', '#' + path)
        setRoute(path)
        setPageKey((n) => n + 1)
        window.scrollTo(0, 0)
        floodTarget.current = 0
        setPhase('in')
        setTimeout(() => {
          setPhase('idle')
          setVeilRoute(null)
          locked.current = false
        }, 1050)
      }, 760)
    },
    [route]
  )

  const step = useCallback(
    (delta) => {
      const next = ROUTES[index + delta]
      if (next) go(next.path, delta)
    },
    [index, go]
  )

  /* Scroll past the edge to travel. Intent accumulates on a meter; when
     it fills, the veil takes over and the next route loads. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let accumulated = 0
    let resetTimer

    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3
    const atTop = () => window.scrollY <= 3

    const push = (amount) => {
      if (locked.current) return
      const down = amount > 0
      const canTravel = down ? atBottom() && index < ROUTES.length - 1 : atTop() && index > 0
      if (!canTravel) {
        accumulated = 0
        setIntent(0)
        setIntentDir(null)
        return
      }
      accumulated += Math.abs(amount)
      setIntentDir(down ? 'down' : 'up')
      setIntent(Math.min(accumulated / TRAVEL, 1))
      clearTimeout(resetTimer)
      resetTimer = setTimeout(() => {
        accumulated = 0
        setIntent(0)
        setIntentDir(null)
      }, 320)
      if (accumulated >= TRAVEL) {
        accumulated = 0
        setIntent(0)
        setIntentDir(null)
        step(down ? 1 : -1)
      }
    }

    const onWheel = (e) => push(e.deltaY)

    let touchY = null
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      if (touchY === null) return
      const delta = touchY - e.touches[0].clientY
      touchY = e.touches[0].clientY
      push(delta * 2.4)
    }
    const onTouchEnd = () => {
      touchY = null
      accumulated = 0
      setIntent(0)
      setIntentDir(null)
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      clearTimeout(resetTimer)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [index, step])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'PageDown') {
        e.preventDefault()
        step(1)
      }
      if (e.key === 'PageUp') {
        e.preventDefault()
        step(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  useEffect(() => {
    const onHash = () => {
      const next = currentHash()
      if (next !== route && !locked.current) {
        setRoute(next)
        setPageKey((n) => n + 1)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [route])

  /* Custom cursor — only where a pointer actually hovers. */
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return
    const el = cursorRef.current
    let x = 0
    let y = 0
    let targetX = 0
    let targetY = 0
    let raf

    const onMove = (e) => {
      targetX = e.clientX
      targetY = e.clientY
    }
    const onOver = (e) => {
      const hot = e.target.closest('[data-hover]')
      el.style.transform = `translate(-50%,-50%) scale(${hot ? 3.2 : 1})`
      el.style.background = hot ? 'rgba(92,225,255,.18)' : '#FF6FB5'
      el.style.borderColor = hot ? '#5CE1FF' : 'transparent'
    }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      x += (targetX - x) * 0.18
      y += (targetY - y) * 0.18
      el.style.left = x + 'px'
      el.style.top = y + 'px'
    }
    tick()

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
    }
  }, [])

  const poke = useCallback(() => {
    pulse.current = 1
  }, [])

  const Page = PAGES[route] || Home
  const nextRoute = ROUTES[index + (intentDir === 'up' ? -1 : 1)]
  const outShift = travelDir > 0 ? -70 : 70
  const inShift = travelDir > 0 ? 70 : -70

  return (
    <div style={{ background: '#070211', color: '#F5EEFF', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Sora:wght@300;400&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#070211;overscroll-behavior-y:none}
        html{-webkit-font-smoothing:antialiased}
        ::selection{background:#FF6FB5;color:#070211}
        ::-webkit-scrollbar{width:0}
        a,button{color:inherit;font:inherit}
        button{background:none;border:none;text-align:left;width:100%}
        :focus-visible{outline:2px solid #5CE1FF;outline-offset:4px;border-radius:3px}
        .u{background-image:linear-gradient(#FF6FB5,#FF6FB5);background-size:0% 1px;background-repeat:no-repeat;background-position:0 100%;transition:background-size .45s cubic-bezier(.16,1,.3,1)}
        .u:hover,.u:focus-visible{background-size:100% 1px}
        .row{transition:background .35s ease}
        .row:hover{background:rgba(255,111,181,.06)}
        .tag{transition:border-color .3s,color .3s}
        .tag:hover{border-color:#5CE1FF;color:#5CE1FF}
        .nav-link{position:relative;width:auto;padding:6px 0;transition:color .3s}
        .nav-link::after{content:'';position:absolute;left:0;bottom:0;height:1px;width:0;background:linear-gradient(90deg,#FF6FB5,#5CE1FF);transition:width .45s cubic-bezier(.16,1,.3,1)}
        .nav-link:hover::after,.nav-link[data-active="true"]::after{width:100%}
        @media (hover:hover){*{cursor:none!important}}
        @media (prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:.01ms!important;clip-path:none!important}}
      `}</style>

      <canvas ref={canvasRef} onClick={poke} style={{ position: 'fixed', inset: 0, zIndex: 0, display: 'block' }} />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background: '#070211',
          opacity: route === '/' ? 0.2 : 0.6,
          transition: 'opacity 1.2s ease',
        }}
      />

      <div
        ref={cursorRef}
        style={{
          position: 'fixed',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#FF6FB5',
          border: '1px solid transparent',
          pointerEvents: 'none',
          zIndex: 95,
          transform: 'translate(-50%,-50%)',
          transition: 'transform .28s cubic-bezier(.16,1,.3,1), background .28s, border-color .28s',
          mixBlendMode: 'exclusion',
        }}
      />

      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          padding: 'clamp(18px,2.6vw,30px) clamp(22px,3.5vw,40px)',
          background: 'linear-gradient(180deg, rgba(7,2,17,.85), transparent)',
        }}
      >
        <button
          data-hover
          className="nav-link"
          onClick={() => go('/', -1)}
          style={{ font: "500 12px/1 'JetBrains Mono', monospace", letterSpacing: '.2em', color: '#F5EEFF' }}
        >
          E.MULAMBA
        </button>
        <div style={{ display: 'flex', gap: 'clamp(14px,2.4vw,30px)', flexWrap: 'wrap' }}>
          {ROUTES.slice(1).map((r, i) => (
            <button
              key={r.path}
              data-hover
              className="nav-link"
              data-active={route === r.path}
              onClick={() => go(r.path, i + 1 >= index ? 1 : -1)}
              style={{
                font: "500 11px/1 'JetBrains Mono', monospace",
                letterSpacing: '.18em',
                color: route === r.path ? '#5CE1FF' : 'rgba(245,238,255,.6)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </nav>

      <main
        key={pageKey}
        style={{
          position: 'relative',
          zIndex: 2,
          opacity: phase === 'out' ? 0 : 1,
          transform: phase === 'out' ? `translateY(${outShift}px) scale(.965)` : 'none',
          filter: phase === 'out' ? 'blur(11px)' : 'blur(0)',
          animation: phase === 'in' ? 'pageIn 1.05s cubic-bezier(.16,1,.3,1) both' : 'none',
          transition: 'opacity .62s ease, transform .76s cubic-bezier(.5,0,.75,0), filter .62s ease',
        }}
      >
        <style>{`@keyframes pageIn{from{opacity:0;transform:translateY(${inShift}px) scale(1.035);filter:blur(11px)}to{opacity:1;transform:none;filter:blur(0)}}`}</style>
        <Page k={pageKey} go={go} poke={poke} />
      </main>

      {/* Veil: covers the swap and names the destination. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          pointerEvents: 'none',
          opacity: phase === 'out' ? 1 : 0,
          transition: phase === 'out' ? 'opacity .55s ease' : 'opacity .95s ease .1s',
          background:
            'radial-gradient(120% 90% at 50% 50%, rgba(42,7,51,.55) 0%, rgba(11,2,24,.94) 62%, #0B0218 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {veilRoute && (
          <div
            style={{
              textAlign: 'center',
              transform: phase === 'out' ? 'none' : `translateY(${-travelDir * 30}px)`,
              opacity: phase === 'out' ? 1 : 0,
              transition: 'transform .9s cubic-bezier(.16,1,.3,1) .1s, opacity .5s ease .1s',
            }}
          >
            <div
              style={{
                font: "500 11px/1 'JetBrains Mono', monospace",
                color: '#5CE1FF',
                letterSpacing: '.4em',
                marginBottom: 18,
              }}
            >
              {String(ROUTES.indexOf(veilRoute) + 1).padStart(2, '0')} / {String(ROUTES.length).padStart(2, '0')}
            </div>
            <div
              style={{
                font: "800 clamp(40px,11vw,140px)/0.9 'Bricolage Grotesque', sans-serif",
                letterSpacing: '-.05em',
                textTransform: 'uppercase',
                color: '#F5EEFF',
              }}
            >
              {veilRoute.title}
            </div>
          </div>
        )}
      </div>

      {/* Travel meter: fills as you push past the edge. */}
      {nextRoute && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 28,
            transform: `translateX(-50%) translateY(${intent > 0 ? 0 : 16}px)`,
            zIndex: 55,
            pointerEvents: 'none',
            textAlign: 'center',
            opacity: phase === 'idle' ? (intent > 0 ? 1 : 0.42) : 0,
            transition: 'opacity .4s ease, transform .5s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <div
            style={{
              font: "500 10px/1 'JetBrains Mono', monospace",
              letterSpacing: '.28em',
              color: intent > 0.15 ? '#5CE1FF' : 'rgba(245,238,255,.5)',
              marginBottom: 10,
              transition: 'color .3s',
            }}
          >
            {intentDir === 'up' ? '↑ ' : ''}
            {nextRoute.label}
            {intentDir === 'up' ? '' : ' ↓'}
          </div>
          <div
            style={{
              width: 150,
              height: 2,
              background: 'rgba(255,255,255,.14)',
              borderRadius: 2,
              overflow: 'hidden',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${intent * 100}%`,
                background: 'linear-gradient(90deg,#FF6FB5,#5CE1FF)',
                transition: 'width .12s linear',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
