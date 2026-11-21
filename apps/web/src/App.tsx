import { useEffect, useState } from 'react'
import { buildFontTestPdf } from './lib/pdfText'

// Temporary page for the first task: confirm Ethiopic renders in the generated PDF.
export default function App() {
  const [url, setUrl] = useState<string>()
  const [err, setErr] = useState<string>()
  useEffect(() => {
    buildFontTestPdf()
      .then((bytes) => setUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))))
      .catch((e) => setErr(String(e)))
  }, [])
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Font test</h1>
      {err && <p className="text-red-600">{err}</p>}
      {url && <iframe src={url} className="w-full h-[80vh]" />}
      {url && <a className="underline" href={url} download="font-test.pdf">Download</a>}
    </div>
  )
}
