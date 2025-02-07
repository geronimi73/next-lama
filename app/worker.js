import { LAMA } from "./lama"
import { Tensor } from 'onnxruntime-web';

const lama = new LAMA()

self.onmessage = async (e) => {
  console.log("worker received message", e.data)

  const { type, data } = e.data;

  if (type === 'ping') {
    self.postMessage({ type: 'downloadInProgress' })
    await lama.downloadModels()

    self.postMessage({ type: 'loadingInProgress' })
    const report = await lama.createSessions()

    self.postMessage({ type: 'pong', data: report })

  } else if (type === 'runRemove') {
    const {imgArray, imgArrayShape, maskArray, maskArrayShape} = data

    const imgTensor = new Tensor("float32", imgArray, imgArrayShape);
    const maskTensor = new Tensor("float32", maskArray, maskArrayShape);

    const result = await lama.removeArea(imgTensor, maskTensor)

    // result.output is the 
    self.postMessage({ type: 'removeDone', data: result.output })

  } else {
    throw new Error(`Unknown message type: ${type}`);
  }
}
