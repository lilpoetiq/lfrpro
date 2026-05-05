import { createWriteStream } from 'fs'
import { writeFile } from 'fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const CHUNK = 2 * 1024 * 1024 // 2MB backpressure window for the write side

/**
 * Save a multipart `File` to disk. Prefers a streaming pipeline (lower memory,
 * good throughput for large video/audio) and falls back to a buffer if needed.
 */
export async function writeUploadToDisk(file: File, destPath: string): Promise<void> {
  const f = file as File & { stream?: () => ReadableStream<Uint8Array> }
  if (typeof f.stream === 'function') {
    try {
      const webStream = f.stream() as import('node:stream/web').ReadableStream
      const read = Readable.fromWeb(webStream)
      const write = createWriteStream(destPath, { highWaterMark: CHUNK })
      await pipeline(read, write)
      return
    } catch (err) {
      console.warn('[writeUploadToDisk] stream pipeline failed, using buffer fallback:', err)
    }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(destPath, buffer)
}
