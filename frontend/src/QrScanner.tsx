import { useEffect, useRef, useState } from 'react'

type Props = {
  onDetect: (value: string) => void
  onClose: () => void
}

export default function QrScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let detector: any = null

    const start = async () => {
      if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
        setError('Este navegador no permite usar la cámara.')
        return
      }
      const BD = (globalThis as unknown as { BarcodeDetector?: any }).BarcodeDetector
      if (!BD) {
        setError('Este navegador no soporta escaneo de QR automático.')
        return
      }

      detector = new BD({ formats: ['qr_code'] })

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        streamRef.current = stream
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()

        const loop = async () => {
          const vv = videoRef.current
          if (!vv || vv.readyState < 2 || !detector) {
            rafRef.current = requestAnimationFrame(loop)
            return
          }
          try {
            const bmp = await createImageBitmap(vv)
            const codes = await detector.detect(bmp)
            bmp.close()
            const value = codes[0]?.rawValue
            if (value) {
              onDetect(value)
              return
            }
          } catch {
          }
          rafRef.current = requestAnimationFrame(loop)
        }

        rafRef.current = requestAnimationFrame(loop)
      } catch {
        setError('No pudimos acceder a la cámara. Revisá permisos.')
      }
    }

    void start()

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop()
      }
      detector = null
    }
  }, [onDetect])

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-900">
        <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline />
      </div>
      {error ? (
        <p className="text-center text-xs text-red-700">{error}</p>
      ) : (
        <p className="text-center text-xs text-zinc-500">
          Apuntá la cámara al QR de la sede.
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
      >
        Cerrar escáner
      </button>
    </div>
  )
}

