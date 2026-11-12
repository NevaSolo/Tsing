import React from 'react'
import { OrbitControls } from '@react-three/drei'

const OrbitControlsWarper = () => {
  return (
    <OrbitControls
    enablePan={true}
    enableZoom={true}
    enableRotate={true}
    zoomSpeed={0.6}
    panSpeed={0.5}
    rotateSpeed={0.4}
    minDistance={0.5}
    maxDistance={1}
 />
  )
}

export default OrbitControlsWarper