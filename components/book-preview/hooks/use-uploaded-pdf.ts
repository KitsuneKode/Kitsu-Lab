'use client'

import { type BookPreviewAction } from '../reducer'
import { useCallback, useEffect, useState, type Dispatch } from 'react'
import { isPdfFile } from '../reader-utils'

// The shell owns uploaded documents: a picked or dropped File becomes an
// object URL merged into the normalized source, so every engine reads it
// through the same pdfUrl path — an upload made in pdf mode keeps working in
// scroll or curl. The URL is revoked on replace, on source change, and on
// unmount, all through one cleanup path.
export function useUploadedPdf({
  sourceKey,
  allowUpload,
  dispatch,
}: {
  sourceKey: string
  allowUpload: boolean
  dispatch: Dispatch<BookPreviewAction>
}) {
  const [upload, setUpload] = useState<{
    url: string
    name: string
    /** Stable across uploads of the same file — the object URL is not. */
    fingerprint: string
    /** Kept so Share can hand the file itself to the share sheet — a link
        cannot carry a document that only exists on this device. */
    file: File
  } | null>(null)

  const uploadPdf = useCallback(
    (file: File) => {
      if (!allowUpload) return
      if (!isPdfFile(file)) {
        dispatch({
          type: 'engine-error',
          error: { kind: 'upload', message: 'Only PDF files can be uploaded.' },
        })
        return
      }
      setUpload({
        url: URL.createObjectURL(file),
        name: file.name,
        fingerprint: `${file.name}|${file.size}|${file.lastModified}`,
        file,
      })
    },
    [allowUpload, dispatch],
  )

  // Revokes the previous upload's URL whenever it is replaced and on unmount.
  useEffect(() => {
    return () => {
      if (upload) URL.revokeObjectURL(upload.url)
    }
  }, [upload])

  // A new consumer source drops whatever document the reader opened itself —
  // adjusted during render (the React-recommended alternative to an effect).
  const [lastSourceKey, setLastSourceKey] = useState(sourceKey)
  if (lastSourceKey !== sourceKey) {
    setLastSourceKey(sourceKey)
    setUpload(null)
  }

  return { upload, uploadPdf }
}
