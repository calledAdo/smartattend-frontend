import type * as FaceApi from 'face-api.js'

let modelsPromise: Promise<typeof FaceApi> | null = null

async function loadModels() {
  if (!modelsPromise) {
    modelsPromise = import('face-api.js').then(async faceapi => {
      const modelUrl = `${import.meta.env.BASE_URL}models`
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      ])
      return faceapi
    }).catch(issue => {
      modelsPromise = null
      throw new Error(`Face recognition could not start. Check your connection and try again. ${(issue as Error).message}`)
    })
  }
  return modelsPromise
}

export async function facialEmbeddingFromPhoto(photo: Blob): Promise<string> {
  if (!photo.type.startsWith('image/')) throw new Error('Capture a face photo first.')
  const faceapi = await loadModels()
  const image = await faceapi.bufferToImage(photo)
  const faces = await faceapi.detectAllFaces(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()
  if (faces.length === 0) throw new Error('No face was detected. Retake the photo in good light.')
  if (faces.length > 1) throw new Error('More than one face was detected. Retake the photo alone.')
  const descriptor = Array.from(faces[0].descriptor)
  if (descriptor.length !== 128 || descriptor.some(number => !Number.isFinite(number))) {
    throw new Error('The face descriptor could not be created. Retake the photo.')
  }
  return JSON.stringify(descriptor)
}
