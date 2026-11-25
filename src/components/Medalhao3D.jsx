import { useEffect, useRef } from 'react'

const base = import.meta.env.BASE_URL

// Medalhão do grupo como uma moeda 3D: gira sozinho e pode ser girado com o mouse/dedo.
export default function Medalhao3D({ tamanho = 170, espessura = 12 }) {
  const moeda = useRef(null)
  const estado = useRef({ angulo: -20, vel: 0, arrastando: false, x: 0 })

  useEffect(() => {
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const velBase = reduzido ? 0 : 0.55
    let id
    const quadro = () => {
      const e = estado.current
      if (!e.arrastando) {
        e.vel += (velBase - e.vel) * 0.03 // volta suavemente à rotação normal
        e.angulo += e.vel
      }
      if (moeda.current) moeda.current.style.transform = `rotateX(8deg) rotateY(${e.angulo}deg)`
      id = requestAnimationFrame(quadro)
    }
    id = requestAnimationFrame(quadro)
    return () => cancelAnimationFrame(id)
  }, [])

  const inicio = (ev) => {
    const e = estado.current
    e.arrastando = true
    e.x = ev.clientX
    e.vel = 0
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
  }
  const mover = (ev) => {
    const e = estado.current
    if (!e.arrastando) return
    const dx = ev.clientX - e.x
    e.x = ev.clientX
    e.angulo += dx * 0.7
    e.vel = dx * 0.7
  }
  const fim = () => {
    estado.current.arrastando = false
  }

  const fatias = 14
  return (
    <div
      className="medalhao-cena"
      style={{ width: tamanho, height: tamanho + 24 }}
      onPointerDown={inicio}
      onPointerMove={mover}
      onPointerUp={fim}
      onPointerCancel={fim}
      title="Arraste para girar"
      aria-label="Medalhão do grupo Kairós"
      role="img"
    >
      <div className="medalhao" ref={moeda} style={{ width: tamanho, height: tamanho }}>
        {Array.from({ length: fatias }, (_, i) => (
          <div
            key={i}
            className="medalhao-borda"
            style={{ transform: `translateZ(${-espessura / 2 + (espessura * i) / (fatias - 1)}px)` }}
          />
        ))}
        <img className="medalhao-face" src={`${base}medalhao-512.png`} alt="" draggable={false}
          style={{ transform: `translateZ(${espessura / 2 + 0.5}px)` }} />
        <img className="medalhao-face verso" src={`${base}medalhao-512.png`} alt="" draggable={false}
          style={{ transform: `rotateY(180deg) translateZ(${espessura / 2 + 0.5}px) scaleX(-1)` }} />
      </div>
      <div className="medalhao-sombra" />
    </div>
  )
}
