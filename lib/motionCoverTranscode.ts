import { spawn } from 'child_process'
import { unlink } from 'fs/promises'

/**
 * Creates a web-optimized H.264 MP4 (no audio, capped width, faststart) for smooth in-dashboard playback.
 * Requires `ffmpeg` on PATH. Returns false if transcoding fails — caller keeps showing the full master.
 */
export async function transcodeMotionCoverForWeb(
  inputAbsolutePath: string,
  outputAbsolutePath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputAbsolutePath,
      '-an',
      '-vf',
      'scale=1280:-2',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-tune',
      'fastdecode',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputAbsolutePath,
    ]
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    ff.stderr?.on('data', (d: Buffer) => {
      err += d.toString()
    })
    ff.on('close', (code) => {
      if (code !== 0) {
        console.error('[motionCoverPreview] ffmpeg exited', code, err.trim())
        void unlink(outputAbsolutePath).catch(() => {})
        resolve(false)
        return
      }
      resolve(true)
    })
    ff.on('error', (e: NodeJS.ErrnoException) => {
      console.error('[motionCoverPreview] ffmpeg spawn error', e.code ?? e.message)
      void unlink(outputAbsolutePath).catch(() => {})
      resolve(false)
    })
  })
}
