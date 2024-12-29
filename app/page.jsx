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
import { resizeCanvas, mergeMasks, maskImageCanvas, resizeAndPadBox, canvasToFloat32Array, sliceTensorMask } from "@/lib/imageutils"

export default function Home() {
  // resize+pad all images to 1024x1024
  const imageSize = {w: 1024, h: 1024}

  // state
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [imageEncoded, setImageEncoded] = useState(false)
  const [status, setStatus] = useState("")

  // web worker, image and mask
  const samWorker = useRef(null)
  const [image, setImage] = useState(null)    // canvas
  const [mask, setMask] = useState(null)    // canvas
  // const [imageURL, setImageURL] = useState("/image_landscape.png")
  // const [imageURL, setImageURL] = useState("/image_portrait.png")
  const [imageURL, setImageURL] = useState("/image_square.png")
  const canvasEl = useRef(null)
  const fileInputEl = useRef(null)

  // Start encoding image
  const encodeImageClick = async () => {
    samWorker.current.postMessage({ type: 'encodeImage', data: canvasToFloat32Array(resizeCanvas(image, imageSize)) });   

    setLoading(true)
    setStatus("Encoding")
  }

  // Start decoding, prompt with mouse coords
  const imageClick = (event) => {
    if (!imageEncoded) return;

    const canvas = canvasEl.current
    const rect = event.target.getBoundingClientRect();

    // input image will be resized to 1024x1024 -> normalize mouse pos to 1024x1024
    const point = {
      x: (event.clientX - rect.left) / canvas.width * imageSize.w,
      y: (event.clientY - rect.top) / canvas.height * imageSize.h,
      label: 1
    }

    samWorker.current.postMessage({ type: 'decodeMask', data: point });  

    setLoading(true)
    setStatus("Decoding")
  }

  // Decoding finished -> parse result and update mask
  const handleDecodingResults = (decodingResults) => {
    // SAM2 returns 3 mask along with scores -> select best one    
    const maskTensors = decodingResults.masks
    const maskScores = decodingResults.iou_predictions.cpuData
    const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores))
    const maskCanvas = sliceTensorMask(maskTensors, bestMaskIdx)    

    setMask((prevMask) => {
      if (prevMask) {
        return mergeMasks(maskCanvas, prevMask)
      } else {
        return resizeCanvas(maskCanvas, imageSize)
      }
    })
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
    } else if (type == "encodeImageDone" ) {
      // alert(data.durationMs)
      setImageEncoded(true)
      setLoading(false)
      setStatus("Ready. Click on image")
    } else if (type == "decodeMaskResult" ) {
      handleDecodingResults(data) 
      setLoading(false)
      setStatus("Ready. Click on image")
    }
  }

  // Crop image with mask
  const cropClick = (event) => {
    const link = document.createElement("a");
    link.href = maskImageCanvas(image, mask).toDataURL();
    link.download = "crop.png";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Upload new image
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    const dataURL = window.URL.createObjectURL(file)

    setImage(null)
    setMask(null)
    setImageEncoded(false)
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
  }, [onWorkerMessage, handleDecodingResults])

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

  // Mask changed, draw original image and mask on top with some alpha
  useEffect(() => {
    if (mask) {
      const canvas = canvasEl.current
      const ctx = canvas.getContext('2d')

      ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);      
      ctx.globalAlpha = 0.4
      ctx.drawImage(mask, 0, 0, mask.width, mask.height, 0, 0, canvas.width, canvas.height);      
      ctx.globalAlpha = 1;
    }
  }, [mask, image])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://github.com/geronimi73/next-sam', '_blank')}
          >
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
          </Button>
        </div>
        <CardHeader>
          <CardTitle>
            <p>Clientside Image Segmentation with onnxruntime-web and Meta's SAM2
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
              <Button onClick={encodeImageClick} disabled={loading || imageEncoded}>
                <p className="flex items-center gap-2">
                  { loading && <LoaderCircle className="animate-spin w-6 h-6" /> }
                  {status}
                </p>
              </Button>
              { mask &&
                <Button onClick={cropClick} variant="secondary"><Crop/> Crop</Button>
              }
              <Button onClick={()=>{fileInputEl.current.click()}} variant="secondary" disabled={loading}><ImageUp/> Change image</Button>
            </div>
            <div className="flex justify-center">
              <canvas ref={canvasEl} width={512} height={512} onClick={imageClick}/>
            </div>
          </div>
        </CardContent>
      </Card>
      <input ref={fileInputEl} hidden="True" accept="image/*" type='file' onInput={handleFileUpload} />
      <Analytics />
    </div>
  );
}
