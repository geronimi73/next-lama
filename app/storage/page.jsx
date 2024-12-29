"use client"

import React, { useState, useEffect, useRef, createContext } from 'react';
import path from 'path';

import * as ort from 'onnxruntime-web';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { 
  LoaderCircle, 
} from 'lucide-react'

export default function Home() {
  const [filestatus, setFilestatus] = useState("not checked yet")

  const load = async () => {
    const modelFile = await getCachedModelFile()

    const session = await ort.InferenceSession.create(await modelFile.arrayBuffer())

    console.log(session)
  }

  const getCachedModelFile = async () => {
    const fileUrl = 'https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder.onnx';
    const fileName = path.basename(fileUrl);
    const handle = await navigator.storage.getDirectory();

    let fileHandle
    try {
      fileHandle = await handle.getFileHandle(fileName);
    }
    catch(e) {
      console.error("file does not exist")
    } 

    if (fileHandle) {
      const file = await fileHandle.getFile();

      if (file.size>0) {
        setFilestatus("file! size: " + file.size)
        return file        
      } else {
        setFilestatus("file exists but empty")
        alert("cached model is empty!")
        return null
      }
    } else {
      setFilestatus("file does not exist")
      alert("no cached model!")
      return null
    }
    // Get a File object for the file
    // console.log(file);
  }


  const download = async () => {
    // download 
    console.log("downloading")
    const fileUrl = 'https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder.onnx';
    const fileName = path.basename(fileUrl);
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer]);
    const file = new File([blob], "");    
    console.log("download done")
    console.log(buffer.byteLength)

    // store
    console.log("storing")
    try {
      const handle = await navigator.storage.getDirectory();
      const writableStream = await handle.getFileHandle(fileName, { create: true });
      // alert(writableStream)
      // const writable = await writableStream.createSyncAccessHandle();
      const writable = await writableStream.createWritable();
      await writable.write(buffer);
      await writable.close();

      console.log("storing done")
    }
    catch(error) {
      console.log("storing failed")
      console.log(error.toString())
    }
  }

  const store = () => {
    const currentTime = new Date().toLocaleTimeString();

    localStorage.setItem('model', currentTime);
  }

  useEffect(()=>{

  }, [])

  return (
    <div className="grid grid-col gap-20 items-center justify-center h-screen">
      <div className="flex p-2">
      <Card>
        <CardHeader>
          <CardTitle>Storage test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p>In Store: {filestatus} </p>
            <Button onClick={getCachedModelFile}>Check if exists</Button>
            <Button onClick={download}>Download</Button>
            <Button onClick={load}>Load model</Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
