import path from 'path';

import * as ort from 'onnxruntime-web/all';
// ort.env.wasm.numThreads=1
// ort.env.wasm.simd = false;


const LAMA_URL = "/lama_fp32.onnx"

export class LAMA {
  modelBuffer = null
  modelSession = null
  modelEp = null
  image_encoded = null

  constructor() { }

  async downloadModels() {
    this.modelBuffer = await this.downloadModel(LAMA_URL)
  }

  async downloadModel(url) {
    // step 1: check if cached
    const root = await navigator.storage.getDirectory();
    const filename = path.basename(url);

    let fileHandle = await root.getFileHandle(filename).catch(e => console.error("File does not exist:", filename, e));

    if (fileHandle) {
      const file = await fileHandle.getFile();
      if (file.size>0) return await file.arrayBuffer()
    }

    // step 2: download if not cached
    console.log("File " + filename + " not in cache, downloading from " + url)
    let buffer = null
    try {
      buffer = await fetch(
        url,
        {
          headers: new Headers({
              Origin: location.origin,
          }),
          mode: 'cors',
        }).then(response => response.arrayBuffer());
    }
    catch (e) {
      console.error("Download of " + url + " failed: ", e)
      return null
    }

    // step 3: store 
    try {
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      console.log("Stored " + filename)
    }
    catch (e) {
      console.error("Storage of " + filename + " failed: ", e)
    }
    return buffer
  }

  async createSessions() {
    const [session, ep] = await this.getORTSession()
    
    return {
      success: session != null,
      device: ep
    }
  }

  async getORTSession() {
    /** Creating a session with executionProviders: {"webgpu", "cpu"} fails
     *  => "Error: multiple calls to 'initWasm()' detected."
     *  but ONLY in Safari and Firefox (wtf)
     *  seems to be related to web worker, see https://github.com/microsoft/onnxruntime/issues/22113
     *  => loop through each ep, catch e if not available and move on
     */
    if (!this.modelSession) {
      // for (let ep of ["webgpu", "cpu"]) {
      for (let ep of ["cpu"]) {
        try { 
          // console.log("loading model on", ep)
          this.modelSession = await ort.InferenceSession.create(this.modelBuffer, { executionProviders: [ep]})
          this.modelEp = ep 
          break
        }
        catch (e) { console.error(e); continue }
      }      
    }
    return [this.modelSession, this.modelEp]
  }

  async removeArea(imageTensor, maskTensor) {
    const [session, device] = await this.getORTSession()
    const results = await session.run({
      image: imageTensor,
      mask: maskTensor,
    });

    console.log(results)

    return results
  }

}
