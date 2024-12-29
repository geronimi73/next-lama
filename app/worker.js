import { SAM2 } from "./SAM2"
import { Tensor } from 'onnxruntime-web';

const sam = new SAM2()

self.onmessage = async (e) => {
  // console.log("worker received message")

  const { type, data } = e.data;

  if (type === 'ping') {
    self.postMessage({ type: 'downloadInProgress' })
    await sam.downloadModels()

    self.postMessage({ type: 'loadingInProgress' })
    const report = await sam.createSessions()

    self.postMessage({ type: 'pong', data: report })

  } else if (type === 'encodeImage') {
    const {float32Array, shape} = data
    const imgTensor = new Tensor("float32", float32Array, shape);

    const startTime = performance.now();
    await sam.encodeImage(imgTensor)
    const durationMs = performance.now() - startTime;

    self.postMessage({ type: 'encodeImageDone', data: {durationMs: durationMs} })

  } else if (type === 'decodeMask') {
    const point = data
    const decodingResults = await sam.decode(point) // decodingResults = Tensor [B=1, Masks, W, H]

    self.postMessage({ type: 'decodeMaskResult', data: decodingResults })

  } else {
    throw new Error(`Unknown message type: ${type}`);
  }
}
