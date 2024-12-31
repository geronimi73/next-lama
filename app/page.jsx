"use client"

import React, { useState, useEffect, useRef, createContext, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { cn } from "@/lib/utils"

// UI
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LoaderCircle, Crop, ImageUp, Github, LoaderPinwheel, Fan, Download } from 'lucide-react'

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
  const lamaWorker = useRef(null)
  const [image, setImage] = useState(null)    // canvas
  const [mask, setMask] = useState(null)    // canvas
  const [mousedown, setMousedown] = useState(false)    
  const [diddrag, setDiddrag] = useState(false)    
  const [imageURL, setImageURL] = useState("/image_portrait.png")
  const canvasEl = useRef(null)
  const fileInputEl = useRef(null)

  // Start encoding image
  const removeClick = async () => {
    const imageCanvas = image
    const maskCanvas = mask

    const {float32Array: imgArray, shape: imgArrayShape} = canvasToFloat32Array(resizeCanvas(imageCanvas, imageSize))
    const {float32Array: maskArray, shape: maskArrayShape} = maskCanvasToFloat32Array(resizeCanvas(maskCanvas, imageSize))

    lamaWorker.current.postMessage({ 
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

  function canvasDrag(evt) {
    if (loading) return

    const rect = canvasEl.current.getBoundingClientRect();
    const pos = {
      x: (evt.clientX - rect.left) / rect.width * canvasEl.current.width,
      y: (evt.clientY - rect.top) / rect.height * canvasEl.current.height,
    }

    // Add circle to mask
    const maskCtx = mask.getContext('2d');
    maskCtx.fillStyle=`rgba(237, 25, 233, 1)`
    maskCtx.beginPath();
    maskCtx.arc(pos.x, pos.y, 50, 0, 4 * Math.PI);      
    maskCtx.fill();

    updateCanvas()
  }

  function canvasDragStop(evt) {
    removeClick()
  }

  // redraw visible canvas, overlay with mask 
  function updateCanvas() {
    const canvas = canvasEl.current
    const ctx = canvas.getContext('2d');
    ctx.save()
    canvas.height=image.height
    canvas.width=image.width

    ctx.drawImage(image, 0, 0);      
    if (mask) {
      ctx.globalAlpha = 0.3
      ctx.drawImage(mask, 0, 0);            
    }
    ctx.restore()

  }

  // Handle web worker messages
  function onWorkerMessage (event) {
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
      let imgCanvas = imgTensorToCanvas(imgTensor)

      setImage((prevImage) => {
        return resizeCanvas(imgCanvas, {w: prevImage.width, h: prevImage.height})
      })

      setLoading(false)
    }
  }

  // Upload new image
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    const dataURL = window.URL.createObjectURL(file)

    setImage(null)
    setStatus("Encode image")
    setImageURL(dataURL)
  }

  const downloadClick = (event) => {
    const link = document.createElement("a");
    link.href = image.toDataURL();
    link.download = "montage.png";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Load web worker 
  useEffect(() => {
    if (!lamaWorker.current) {
      lamaWorker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      lamaWorker.current.addEventListener('message', onWorkerMessage)
      lamaWorker.current.postMessage({ type: 'ping' });   

      setLoading(true)
    }
  }, [onWorkerMessage, image])

  // Load image, store in offscreen canvas
  useEffect(() => {
    if (imageURL) {
      const img = new Image();
      img.src = imageURL
      img.onload = function() {
        // draw image onto offscreen canvas
        let canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        canvas.getContext('2d').drawImage(img, 0, 0) //, img.naturalWidth, img.naturalHeight, box.x, box.y, box.w, box.h)
        setImage(canvas)

      }
    }
  }, [imageURL]);

  useEffect(() => {
    if (image) {
      // new image -> update mask (-> new mask -> updateCanvas)
      const canvas = document.createElement('canvas');
      canvas.width = image.width
      canvas.height = image.height

      setMask(canvas)
    }
  }, [image]);

  useEffect(() => {
    if (image) {
      updateCanvas()
    }
  }, [mask]);


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="sm"
            disabled={true}
            // onClick={() => window.open('https://github.com/geronimi73/next-sam', '_blank')}
          >
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
          </Button>
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
            <div className="flex justify-center gap-4 h-10">
              { loading 
                ? <p className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin w-6 h-6" /> 
                  {status}
                </p>
                : <div className="flex space-between gap-2">
                    <Button onClick={()=>{fileInputEl.current.click()}} variant="secondary" disabled={loading}><ImageUp/> Change image</Button>
                    <Button onClick={downloadClick} variant="secondary" disabled={loading}><Download /> </Button>
                  </div>
              }
            </div>
            <div className="flex justify-center">
              <canvas 
                className="max-h-[500px] max-w-[500px]" 
                onMouseDown={(e)=>{setMousedown(true);canvasDrag(e)}} 
                onMouseLeave={(e)=>{setMousedown(false)}} 
                onMouseUp={(e)=>{setMousedown(false);if(mousedown) canvasDragStop(e)}} 
                onMouseMove={(e)=>{if(mousedown) canvasDrag(e)}}

                ref={canvasEl}/ >
            </div>
          </div>
        </CardContent>
      </Card>
      <input ref={fileInputEl} hidden="True" accept="image/*" type='file' onInput={handleFileUpload} />
      <Analytics />
    </div>
  );
}
