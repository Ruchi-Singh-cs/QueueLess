import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Copy, Check } from 'lucide-react'
import { Button, Alert } from '../ui/index.jsx'
import { useToast } from '../ui/Toast.jsx'

/** Scannable QR. Always dark-on-white: an inverted QR is unreadable to most cameras, and this one gets printed. */
export function QrCode({ value, size = 190, alt = 'QR code' }) {
  const canvas = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!value || !canvas.current) return
    setError('')
    QRCode.toCanvas(canvas.current, value, {
      width: size, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0b0d12', light: '#ffffff' },
    }).catch((e) => setError(e.message))
  }, [value, size])
  if (error) return <Alert tone="error">Couldn't draw the QR code: {error}</Alert>
  return <canvas ref={canvas} className="qr-canvas" role="img" aria-label={alt} style={{ width: size, height: size }} />
}

/** QR + the link it encodes, with copy and PNG download. */
export function QrPoster({ value, filename = 'queueless-qr.png', size = 190, children }) {
  const wrap = useRef(null)
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  function download() {
    const canvas = wrap.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { toast.error("Couldn't copy the link.") }
  }

  return (
    <div className="qr-poster" ref={wrap}>
      <div className="qr-frame"><QrCode value={value} size={size} alt={`QR code for ${value}`} /></div>
      <div className="stack gap-3 grow" style={{ minWidth: 0 }}>
        {children}
        <code className="qr-link truncate" title={value}>{value}</code>
        <div className="row gap-2 wrap">
          <Button variant="secondary" size="sm" icon={Download} onClick={download}>Download PNG</Button>
          <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
        </div>
      </div>
    </div>
  )
}
