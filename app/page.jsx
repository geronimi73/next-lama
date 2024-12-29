"use client"

import React, { useState, useEffect, useRef, createContext, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { cn } from "@/lib/utils"

// UI
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LoaderCircle, Crop, ImageUp, Github, LoaderPinwheel, Fan } from 'lucide-react'

// Image manipulations
import { resizeCanvas, mergeMasks, maskImageCanvas, resizeAndPadBox, canvasToFloat32Array, maskCanvasToFloat32Array, imgTensorToCanvas, sliceTensorMask } from "@/lib/imageutils"

export default function Home() {
  // resize+pad all images to 1024x1024
  const imageSize = {w: 512, h: 512}

  // state
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")

  // web worker, image and mask
  const samWorker = useRef(null)
  const [image, setImage] = useState(null)    // canvas
  const [mask, setMask] = useState(null)    // canvas
  const [imageURL, setImageURL] = useState("/image_portrait.png")
  const canvasEl = useRef(null)
  const fileInputEl = useRef(null)

  // Start encoding image
  const removeClick = async () => {
    const imageCanvas = image
    const maskCanvas = await getMaskCanvas()

    const {float32Array: imgArray, shape: imgArrayShape} = canvasToFloat32Array(resizeCanvas(imageCanvas, imageSize))
    const {float32Array: maskArray, shape: maskArrayShape} = maskCanvasToFloat32Array(resizeCanvas(maskCanvas, imageSize))

    samWorker.current.postMessage({ 
      type: 'runRemove', 
      data: {
        imgArray: imgArray,
        imgArrayShape: imgArrayShape,
        maskArray: maskArray,
        maskArrayShape: maskArrayShape, 
      }
    });   

    setLoading(true)
    setStatus("Removing")
  }


  async function getMaskCanvas() {
    const img = new Image();
    img.src = "/image_portrait_mask2.png"
    await img.decode()

    const canvas = document.createElement("canvas")
    canvas.height=img.naturalHeight
    canvas.width=img.naturalWidth
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, canvas.width, canvas.height);      

    return canvas
  }

  // Handle web worker messages
  const onWorkerMessage = (event) => {
    const {type, data} = event.data

    if (type == "pong" ) {
      const {success, device} = data

      if (success) {
        setLoading(false)
        setDevice(device)
        setStatus("Encode image")
      } else {
        setStatus("Error (check JS console)")
      }
    } else if (type == "downloadInProgress" || type == "loadingInProgress") {
      setLoading(true)
      setStatus("Loading model")
    } else if (type == "removeDone") {
      const imgTensor = data
      const imgCanvas = imgTensorToCanvas(imgTensor)

      const canvas = canvasEl.current
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height, 0, 0, canvas.width, canvas.height);      

      setLoading(false)
    }
  }


  // Upload new image
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    const dataURL = window.URL.createObjectURL(file)

    setImage(null)
    setMask(null)
    setStatus("Encode image")
    setImageURL(dataURL)
  }

  // Load web worker 
  useEffect(() => {
    if (!samWorker.current) {
      samWorker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      samWorker.current.addEventListener('message', onWorkerMessage)
      samWorker.current.postMessage({ type: 'ping' });   

      setLoading(true)
    }
  }, [onWorkerMessage])

  // Load image, pad to square and store in offscreen canvas
  useEffect(() => {
    if (imageURL) {
      const img = new Image();
      img.src = imageURL
      img.onload = function() {
        const largestDim = img.naturalWidth > img.naturalHeight ? img.naturalWidth : img.naturalHeight
        const box = resizeAndPadBox({h: img.naturalHeight, w: img.naturalWidth}, {h: largestDim, w: largestDim})

        const canvas = document.createElement('canvas');
        canvas.width = largestDim
        canvas.height = largestDim

        canvas.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, box.x, box.y, box.w, box.h)
        setImage(canvas)
      }
    }
  }, [imageURL]);

  // Offscreen canvas changed, draw it 
  useEffect(() => {
    if (image) {
      const canvas = canvasEl.current
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);      
    }
  }, [image]);


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <div className="absolute top-4 right-4">
{/*          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://github.com/geronimi73/next-sam', '_blank')}
          >
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
          </Button>*/}
        </div>
        <CardHeader>
          <CardTitle>
            <p>Clientside Object Removal with onnxruntime-web and <a href="https://github.com/advimman/lama">LaMa</a>
            </p>
            <p className={cn("flex gap-1 items-center", device ? "visible" : "invisible")}>
              <Fan color="#000" className="w-6 h-6 animate-[spin_2.5s_linear_infinite] direction-reverse"/>
              Running on {device}
            </p>              
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-4">
{/*              <Button onClick={removeClick}>
                Remove da ship
              </Button>*/}
              <Button onClick={removeClick} disabled={loading}>
                  { loading 
                    ? <p className="flex items-center gap-2">
                      <LoaderCircle className="animate-spin w-6 h-6" /> 
                      {status}
                    </p>
                    : <p>Remove da ship</p>
                  }
              </Button>
              <Button onClick={()=>{fileInputEl.current.click()}} variant="secondary" disabled={loading}><ImageUp/> Change image</Button>
            </div>
            <div className="flex justify-center">
              <canvas ref={canvasEl} width={512} height={512}/>
            </div>
          </div>
        </CardContent>
      </Card>
      <input ref={fileInputEl} hidden="True" accept="image/*" type='file' onInput={handleFileUpload} />
      <Analytics />
    </div>
  );
}
